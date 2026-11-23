/**
 * WhatsApp Bot Service for Enchant AM Premium & Temp Mail Hub
 * Powered by zapo-js (Lightweight WebSocket Engine - Zero Chrome/Puppeteer)
 */

if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = require('ws');
}

const { createSqliteStore } = require('@innovatorssoft/store-sqlite');
const { createStore, WaClient, ConsoleLogger } = require('zapo-js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const PAIRINGS_FILE = path.join(__dirname, 'wa_pairings.json');
const SESSION_DIR = path.join(__dirname, '.wabot_zapo');
const SQLITE_PATH = path.join(SESSION_DIR, 'session.sqlite');
const SESSION_ID = 'amprem-wa-bot';

function extractTextFromMessage(message) {
  if (!message) return '';
  if (message.ephemeralMessage?.message) return extractTextFromMessage(message.ephemeralMessage.message);
  if (message.viewOnceMessage?.message) return extractTextFromMessage(message.viewOnceMessage.message);
  if (message.viewOnceMessageV2?.message) return extractTextFromMessage(message.viewOnceMessageV2.message);
  if (message.documentWithCaptionMessage?.message) return extractTextFromMessage(message.documentWithCaptionMessage.message);
  if (message.editedMessage?.message) return extractTextFromMessage(message.editedMessage.message);
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    message.documentMessage?.caption ||
    message.interactiveResponseMessage?.body?.text ||
    message.buttonsResponseMessage?.selectedButtonId ||
    message.templateButtonReplyMessage?.selectedId ||
    message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    ''
  );
}

function toZapoJid(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (s.endsWith('@lid') || s.endsWith('@s.whatsapp.net')) return s;
  if (s.endsWith('@c.us')) return s.replace(/@c\.us$/i, '@s.whatsapp.net');
  let digits = s.replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  return digits ? (digits + '@s.whatsapp.net') : '';
}

function hasSavedSqliteAuth(sqlitePath) {
  try {
    if (!fs.existsSync(sqlitePath)) return false;
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(sqlitePath, { readOnly: true });
    try {
      const row = db.prepare("SELECT me_jid FROM auth_credentials WHERE me_jid IS NOT NULL AND me_jid != '' LIMIT 1").get();
      return !!(row && row.me_jid);
    } finally {
      db.close();
    }
  } catch (_) {
    return false;
  }
}

class WABotService {
  constructor() {
    this.client = null;
    this.store = null;
    this.status = 'DISCONNECTED';
    this.qrDataUrl = null;
    this.pairingCode = null;
    this.botNumber = null;
    this.botName = null;
    this.errorMessage = null;
    this._isStarting = false;
    this._manualStop = false;
    this._reconnectTimer = null;
    this._pairingReadyWaiters = [];

    this.data = {
      pairings: {},
      mailboxToPhone: {},
      userToMailboxes: {},
      mailboxToUser: {},
      pendingTokens: {},
      sentLogs: []
    };

    this.loadData();
  }

  loadData() {
    try {
      if (fs.existsSync(PAIRINGS_FILE)) {
        const raw = fs.readFileSync(PAIRINGS_FILE, 'utf8');
        const loaded = JSON.parse(raw);
        this.data = {
          ...this.data,
          ...loaded,
          pairings: loaded.pairings || {},
          mailboxToPhone: loaded.mailboxToPhone || {},
          userToMailboxes: loaded.userToMailboxes || {},
          mailboxToUser: loaded.mailboxToUser || {},
          pendingTokens: loaded.pendingTokens || {},
          sentLogs: loaded.sentLogs || []
        };
      }
    } catch (e) {
      console.error('[WABot] Error loading wa_pairings.json:', e.message);
    }
  }

  saveData() {
    try {
      fs.writeFileSync(PAIRINGS_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('[WABot] Error saving wa_pairings.json:', e.message);
    }
  }

  _notifyPairingReady() {
    const waiters = this._pairingReadyWaiters.splice(0);
    for (const resolve of waiters) {
      try { resolve(true); } catch (_) {}
    }
  }

  registerUserMailbox(userEmail, mailbox) {
    if (!userEmail || !mailbox) return;
    const uEmail = userEmail.toLowerCase().trim();
    const mbKey = mailbox.toLowerCase().trim().replace(/@enchant\.id$/, '').replace(/^@/, '');

    if (!this.data.userToMailboxes[uEmail]) this.data.userToMailboxes[uEmail] = [];
    if (!this.data.userToMailboxes[uEmail].includes(mbKey)) {
      this.data.userToMailboxes[uEmail].push(mbKey);
    }
    this.data.mailboxToUser[mbKey] = uEmail;

    const pairing = this.data.pairings[uEmail];
    if (pairing) {
      if (!this.data.mailboxToPhone[mbKey]) this.data.mailboxToPhone[mbKey] = [];
      const targetChatId = toZapoJid(pairing.chatId || pairing.phone);
      const exists = this.data.mailboxToPhone[mbKey].some(e => toZapoJid(typeof e === 'object' ? e.chatId : e) === targetChatId);
      if (!exists) {
        this.data.mailboxToPhone[mbKey].push({ phone: pairing.phone, chatId: targetChatId });
      }
    }
    this.saveData();
  }

  async init(options = {}) {
    const forceQr = !!options.forceQr;
    if (this._isStarting) return;

    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }

    const hasPaired = hasSavedSqliteAuth(SQLITE_PATH);
    if (!forceQr && !hasPaired) {
      this.status = 'DISCONNECTED';
      this.qrDataUrl = null;
      this.pairingCode = null;
      console.log('[WABot] Standby (belum ada sesi login). Buka WA Panel untuk Scan QR / Pairing Code.');
      return;
    }

    this._isStarting = true;
    this._manualStop = false;
    this.status = 'INITIALIZING';
    this.qrDataUrl = null;
    this.pairingCode = null;
    this.errorMessage = null;

    try {
      if (this.client) {
        try { await this.client.disconnect(); } catch (_) {}
        this.client = null;
      }

      if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
      }

      const sqliteBackend = createSqliteStore({ path: SQLITE_PATH });
      this.store = createStore({
        backends: { sqlite: sqliteBackend },
        providers: {
          auth: 'sqlite', signal: 'sqlite', preKey: 'sqlite', session: 'sqlite',
          identity: 'sqlite', senderKey: 'sqlite', appState: 'sqlite',
          messages: 'none', threads: 'none', contacts: 'none', privacyToken: 'sqlite'
        }
      });

      this.client = new WaClient(
        { store: this.store, sessionId: SESSION_ID },
        new ConsoleLogger('warn')
      );

      this.client.on('auth_qr', async ({ qr }) => {
        this.status = 'WAITING_QR';
        try {
          this.qrDataUrl = await qrcode.toDataURL(qr, { width: 320, margin: 2 });
        } catch (err) {
          console.error('[WABot] QR Error:', err.message);
        }
        this._notifyPairingReady();
        console.log('[WABot] QR Code baru siap di-scan.');
      });

      this.client.on('auth_pairing_code', ({ code }) => {
        this.pairingCode = code ? (code.match(/.{1,4}/g)?.join('-') || code) : null;
        this.status = 'WAITING_QR';
      });

      this.client.on('auth_pairing_required', async ({ forceManual }) => {
        this._notifyPairingReady();
        if (forceManual && this.status !== 'CONNECTED') {
          console.log('[WABot] Batas waktu QR habis, kembali ke mode Standby.');
          await this.disconnect();
        }
      });

      this.client.on('auth_paired', ({ credentials }) => {
        const meJid = credentials?.meJid || '';
        this.status = 'CONNECTED';
        this.qrDataUrl = null;
        this.pairingCode = null;
        this.botNumber = meJid.split('@')[0]?.split(':')[0] || this.botNumber;
        this.botName = credentials?.pushName || 'Enchant AM Bot';
        console.log('[WABot] Berhasil terhubung sebagai +' + this.botNumber);
      });

      this.client.on('connection', ({ status, isLogout }) => {
        if (status === 'open') {
          const creds = this.client?.getCredentials?.();
          const meJid = creds?.meJid || '';
          this.status = 'CONNECTED';
          this.qrDataUrl = null;
          this.pairingCode = null;
          this.errorMessage = null;
          this.botNumber = meJid.split('@')[0]?.split(':')[0] || this.botNumber;
          this.botName = creds?.pushName || this.botName || 'Enchant AM Bot';
          console.log('[WABot] Koneksi WhatsApp AKTIF (+' + (this.botNumber || 'connected') + ')');
        } else if (status === 'close') {
          const wasPaired = hasSavedSqliteAuth(SQLITE_PATH);
          if (isLogout) {
            console.warn('[WABot] Perangkat di-unlink dari HP, membersihkan sesi...');
            this.logout().catch(() => {});
            return;
          }
          if (!this._manualStop && wasPaired) {
            this.status = 'INITIALIZING';
            this._reconnectTimer = setTimeout(() => {
              if (!this._manualStop && this.status !== 'CONNECTED') {
                this.init({ forceQr: false }).catch(() => {});
              }
            }, 4000);
          } else if (!wasPaired) {
            this.status = 'DISCONNECTED';
            this.qrDataUrl = null;
          }
        }
      });

      this.client.on('message', async (event) => {
        try {
          await this.handleIncomingWhatsAppMessage(event);
        } catch (e) {
          console.error('[WABot] Message Handler Error:', e.message);
        }
      });

      await this.client.connect();

      const creds = this.client?.getCredentials?.();
      if (creds?.meJid) {
        this.status = 'CONNECTED';
        this.botNumber = creds.meJid.split('@')[0]?.split(':')[0] || this.botNumber;
        this.botName = creds.pushName || 'Enchant AM Bot';
        this.qrDataUrl = null;
        this.pairingCode = null;
      }
    } catch (err) {
      if (this._manualStop) {
        this.status = 'DISCONNECTED';
        this.errorMessage = null;
      } else {
        console.error('[WABot] Init Error:', err.message);
        this.status = 'ERROR';
        this.errorMessage = err.message;
      }
    } finally {
      this._isStarting = false;
    }
  }

  async handleIncomingWhatsAppMessage(event) {
    const rawChatId = event?.chatJid || event?.key?.remoteJid || '';
    if (!rawChatId) return;
    if (rawChatId.endsWith('@g.us') || rawChatId.endsWith('@newsletter') || rawChatId.endsWith('@broadcast')) return;

    const rawText = extractTextFromMessage(event?.message).trim();
    if (!rawText) return;

    const upperText = rawText.toUpperCase();
    const chatId = toZapoJid(rawChatId);
    const senderSource = event?.senderPn || event?.senderJid || rawChatId;
    const fromPhone = (senderSource.includes('@') ? senderSource.split('@')[0].split(':')[0] : senderSource).replace(/[^0-9]/g, '');

    let foundToken = null;
    let tokenInfo = null;

    for (const [tKey, tData] of Object.entries(this.data.pendingTokens || {})) {
      if (upperText.includes(tKey.toUpperCase())) {
        foundToken = tKey;
        tokenInfo = tData;
        break;
      }
    }

    if (!foundToken) {
      const match = upperText.match(/ENC-[A-Z0-9]{3,8}/);
      if (match && this.data.pendingTokens[match[0]]) {
        foundToken = match[0];
        tokenInfo = this.data.pendingTokens[foundToken];
      }
    }

    if (foundToken && tokenInfo) {
      const userEmail = (tokenInfo.userEmail || 'user').toLowerCase().trim();
      const rawMb = (tokenInfo.mailbox || 'user').toLowerCase().trim().replace(/@enchant\.id$/, '');
      const fullMailbox = rawMb + '@enchant.id';
      const targetPhone = fromPhone || this.botNumber || 'User';

      const pairingRecord = {
        userEmail,
        mailbox: fullMailbox,
        phone: targetPhone,
        chatId,
        pairedAt: new Date().toISOString()
      };
      this.data.pairings[userEmail] = pairingRecord;

      if (!this.data.mailboxToPhone[rawMb]) this.data.mailboxToPhone[rawMb] = [];
      const existingEntry = this.data.mailboxToPhone[rawMb].find(e => toZapoJid(typeof e === 'object' ? e.chatId : e) === chatId);
      if (!existingEntry) {
        this.data.mailboxToPhone[rawMb].push({ phone: targetPhone, chatId });
      }

      if (!this.data.userToMailboxes[userEmail]) this.data.userToMailboxes[userEmail] = [];
      if (!this.data.userToMailboxes[userEmail].includes(rawMb)) {
        this.data.userToMailboxes[userEmail].push(rawMb);
      }
      this.data.mailboxToUser[rawMb] = userEmail;

      this.data.userToMailboxes[userEmail].forEach(mb => {
        if (!this.data.mailboxToPhone[mb]) this.data.mailboxToPhone[mb] = [];
        const found = this.data.mailboxToPhone[mb].some(e => toZapoJid(typeof e === 'object' ? e.chatId : e) === chatId);
        if (!found) {
          this.data.mailboxToPhone[mb].push({ phone: targetPhone, chatId });
        }
      });

      delete this.data.pendingTokens[foundToken];
      this.saveData();

      const replyText = '🤖 *ENCHANT NOTIFICATION BOT*\n━━━━━━━━━━━━━━━━━━━\n' +
        '✅ *MAIL CONNECTED!*\n\n' +
        '📧 *Akun Gmail:* ' + userEmail + '\n' +
        '📬 *Mailbox Aktif:* ' + fullMailbox + '\n' +
        '📱 *WhatsApp:* +' + targetPhone + '\n' +
        '🕒 *Waktu:* ' + new Date().toLocaleString('id-ID') + '\n\n' +
        '✨ *Status: AKTIF*\n' +
        'Nomor WhatsApp ini sekarang terhubung ke akun Anda. Setiap kali membuat atau login akun AM di mailbox @enchant.id mana pun, *Link Login & Kode OTP* akan otomatis dikirimkan ke sini tanpa perlu connect ulang!\n━━━━━━━━━━━━━━━━━━━';

      try {
        await this.client.message.send(chatId, replyText);
      } catch (err) {
        console.error('[WABot] Gagal mengirim konfirmasi balasan:', err.message);
      }
    }
  }

  generatePairToken(userEmail, mailbox = '') {
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const token = 'ENC-' + rand;
    this.data.pendingTokens[token] = {
      userEmail: (userEmail || '').trim().toLowerCase(),
      mailbox: (mailbox || '').trim().toLowerCase(),
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 15 * 60 * 1000
    };
    this.saveData();

    const botNum = this.botNumber || '';
    const messageTemplate = encodeURIComponent('CONNECT ENCHANT ' + token);
    const waUrl = botNum ? ('https://wa.me/' + botNum + '?text=' + messageTemplate) : null;
    return { token, botNumber: botNum, waUrl, expiresInMinutes: 15 };
  }

  checkPairStatus(userEmail, token) {
    const email = (userEmail || '').trim().toLowerCase();
    const pairing = this.data.pairings[email];
    if (pairing) {
      return { connected: true, phone: pairing.phone, mailbox: pairing.mailbox, pairedAt: pairing.pairedAt };
    }
    if (token && !this.data.pendingTokens[token]) {
      return { connected: false, expired: true };
    }
    return { connected: false, pending: true };
  }

  unpairUser(userEmail) {
    const email = (userEmail || '').trim().toLowerCase();
    const pairing = this.data.pairings[email];
    if (pairing) {
      const mb = pairing.mailbox.replace(/@enchant\.id$/, '').toLowerCase();
      if (this.data.mailboxToPhone[mb]) {
        this.data.mailboxToPhone[mb] = this.data.mailboxToPhone[mb].filter(p => (typeof p === 'object' ? p.phone : p) !== pairing.phone);
      }
      delete this.data.pairings[email];
      this.saveData();
      return { success: true };
    }
    return { success: false, error: 'User belum terhubung.' };
  }

  async forwardEmailNotification({ mailboxKey, from, to, subject, text, html, otp, loginLink }) {
    if (this.status !== 'CONNECTED' || !this.client) return false;
    const key = (mailboxKey || '').toLowerCase().trim();
    const targets = [];

    (this.data.mailboxToPhone[key] || []).forEach(t => targets.push(t));
    Object.values(this.data.pairings || {}).forEach(p => {
      const pMb = (p.mailbox || '').toLowerCase().replace(/@enchant\.id$/, '');
      if (pMb === key || (to && p.mailbox && p.mailbox.toLowerCase() === to.toLowerCase())) {
        const jid = toZapoJid(p.chatId || p.phone);
        if (!targets.some(existing => toZapoJid(existing.chatId || existing) === jid)) {
          targets.push({ phone: p.phone, chatId: jid });
        }
      }
    });

    if (!targets.length) return false;

    let messageBody = '📩 *[ENCHANT MAIL] PESAN BARU DITERIMA*\n━━━━━━━━━━━━━━━━━━━\n' +
      '👤 *Dari:* ' + (from || 'noreply@alight-creative.firebaseapp.com') + '\n' +
      '📬 *Mailbox:* ' + (to || (key + '@enchant.id')) + '\n' +
      '📋 *Subjek:* ' + (subject || '(Tanpa Subjek)') + '\n' +
      '🕒 *Waktu:* ' + new Date().toLocaleString('id-ID') + '\n\n';

    if (loginLink) {
      messageBody += '🔗 *LINK LOGIN ALIGHT CREATIVE TERDETEKSI:*\n' + loginLink + '\n\n' +
        '💡 _Klik link di atas pada HP kamu untuk langsung masuk ke akun Alight Motion tanpa buka website!_\n\n';
    }
    if (otp) {
      messageBody += '🔑 *KODE OTP:* *' + otp + '*\n\n';
    }
    const snippet = (text || html || '').replace(/<[^>]+>/g, ' ').substring(0, 140).trim();
    if (snippet && !loginLink) {
      messageBody += '📄 *Isi Pesan:* ' + snippet + '...\n\n';
    }
    messageBody += '━━━━━━━━━━━━━━━━━━━\n_Dikirim otomatis oleh Enchant AM Premium Engine_';

    for (const target of targets) {
      const destChatId = toZapoJid(typeof target === 'object' ? (target.chatId || target.phone) : target);
      const displayPhone = typeof target === 'object' ? target.phone : target;
      if (!destChatId) continue;
      try {
        await this.client.message.send(destChatId, messageBody);
        if (!this.data.sentLogs) this.data.sentLogs = [];
        this.data.sentLogs.unshift({
          timestamp: new Date().toISOString(),
          phone: displayPhone,
          mailbox: key + '@enchant.id',
          type: loginLink ? 'MAGIC_LINK' : (otp ? 'OTP' : 'EMAIL'),
          status: 'SUCCESS'
        });
        if (this.data.sentLogs.length > 50) this.data.sentLogs.pop();
        this.saveData();
      } catch (err) {
        console.error('[WABot] Gagal mengirim ke ' + destChatId + ':', err.message);
      }
    }
    return true;
  }

  async sendAdminNotification({ userEmail, targetEmail, mode, expiresAt, durationSeconds, ip }) {
    if (this.status !== 'CONNECTED' || !this.client) return false;
    const ADMIN_NUMBER = '6285704625361';
    const adminChatId = toZapoJid(ADMIN_NUMBER);
    const modeText = mode === 'auto' ? '⚡ Otomatis (@enchant.id)' : '✍️ Manual (Email Pribadi)';
    const expText = expiresAt ? (typeof expiresAt === 'number' ? new Date(expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : expiresAt) : '1 Tahun (365 Hari)';

    const message = '🔔 *[NOTIFIKASI AKTIVASI BARU]*\n━━━━━━━━━━━━━━━━━━━\n' +
      '👤 *User Login Web:* ' + (userEmail || '(Guest/Anonim)') + '\n' +
      '💎 *Email AM Pro:* `' + targetEmail + '`\n' +
      '⚙️ *Metode:* ' + modeText + '\n' +
      '⏳ *Masa Aktif:* ' + expText + '\n' +
      '⏱️ *Durasi Proses:* ' + (durationSeconds ? durationSeconds.toFixed(1) + 's' : '-') + '\n' +
      '🌐 *IP Pengguna:* ' + (ip || '-') + '\n' +
      '🕒 *Waktu:* ' + new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + '\n' +
      '━━━━━━━━━━━━━━━━━━━\n_Notifikasi Admin Enchant AM Premium Hub_';

    try {
      await this.client.message.send(adminChatId, message);
      return true;
    } catch (err) {
      console.error('[WABot] ❌ Gagal mengirim notif ke Admin WhatsApp:', err.message);
      return false;
    }
  }

  getStatus() {
    return {
      status: this.status,
      connected: this.status === 'CONNECTED',
      qrDataUrl: this.qrDataUrl,
      pairingCode: this.pairingCode,
      botNumber: this.botNumber,
      botName: this.botName,
      errorMessage: this.errorMessage,
      pairedUsersCount: Object.keys(this.data.pairings || {}).length,
      pairings: Object.values(this.data.pairings || {}),
      recentLogs: (this.data.sentLogs || []).slice(0, 20)
    };
  }

  async startPairing() {
    await this.init({ forceQr: true });
    return { success: true, message: 'Memulai sesi QR WhatsApp...', ...this.getStatus() };
  }

  async disconnect() {
    this._manualStop = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    this._notifyPairingReady();
    if (this.client) {
      try { await this.client.disconnect(); } catch (_) {}
      this.client = null;
    }
    this.status = 'DISCONNECTED';
    this.qrDataUrl = null;
    this.pairingCode = null;
    return { success: true, message: 'WhatsApp Bot dihentikan sementara (Standby).' };
  }

  restart() {
    console.log('[WABot] 🔄 Restarting WhatsApp Bot (QR active)...');
    this.init({ forceQr: true }).catch((e) => console.error('[WABot] Restart err:', e.message));
    return { success: true, message: 'WhatsApp Bot sedang memuat QR Code baru...' };
  }

  async requestPairingCode(phoneNumber) {
    let cleaned = String(phoneNumber || '').replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0')) cleaned = '62' + cleaned.slice(1);
    if (!cleaned || cleaned.length < 8) {
      throw new Error('Nomor WhatsApp tidak valid (contoh: 628123456789).');
    }

    if (!this.client || (this.status !== 'WAITING_QR' && this.status !== 'INITIALIZING')) {
      const readyPromise = new Promise((resolve) => {
        this._pairingReadyWaiters.push(resolve);
        setTimeout(() => resolve(false), 9000);
      });
      await this.init({ forceQr: true });
      if (!this.qrDataUrl) {
        await readyPromise;
      }
    }

    if (!this.client || !this.client.auth) {
      throw new Error('Client WhatsApp belum siap, coba klik Tampilkan QR terlebih dahulu.');
    }

    const rawCode = await this.client.auth.requestPairingCode(cleaned);
    const formatted = rawCode ? (rawCode.match(/.{1,4}/g)?.join('-') || rawCode) : rawCode;
    this.pairingCode = formatted;
    return formatted;
  }

  async logout() {
    this._manualStop = true;
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.client) {
      try { await this.client.logout(); } catch (_) {}
      try { await this.client.disconnect(); } catch (_) {}
      this.client = null;
    }
    try {
      if (fs.existsSync(SESSION_DIR)) {
        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
      }
    } catch (_) {}
    this.status = 'DISCONNECTED';
    this.qrDataUrl = null;
    this.pairingCode = null;
    this.botNumber = null;
    this.botName = null;
    this.saveData();
    return { success: true, message: 'WhatsApp Bot berhasil logout. Klik Tampilkan QR / Pairing Code untuk menautkan nomor baru.' };
  }
}

module.exports = new WABotService();
