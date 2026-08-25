/**
 * WhatsApp Bot Service for Enchant AM Premium & Temp Mail Hub
 * Powered by whatsapp-web.js (Official WhatsApp Web Engine)
 * Features:
 * - QR Scan for Owner in Admin Dashboard
 * - Link user WhatsApp account via unique code / redirect link
 * - Auto-forward incoming emails, OTP, and Alight Creative Magic Links directly to WhatsApp
 */

const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

const PAIRINGS_FILE = path.join(__dirname, 'wa_pairings.json');

class WABotService {
  constructor() {
    this.client = null;
    this.status = 'DISCONNECTED'; // DISCONNECTED | INITIALIZING | WAITING_QR | CONNECTED | ERROR
    this.qrDataUrl = null;
    this.botNumber = null;
    this.botName = null;
    this.errorMessage = null;

    // Pairing Store: { [userEmail]: { userEmail, mailbox, phone, chatId, pairedAt } }
    // User Mailboxes: { [userEmail]: ['mamah', 'nino', ...] }
    // Mailbox Owner: { [mailboxKey]: userEmail }
    this.data = {
      pairings: {},        // userEmail -> { userEmail, mailbox, phone, chatId, pairedAt }
      mailboxToPhone: {},  // mailbox (key) -> [{ phone, chatId }]
      userToMailboxes: {}, // userEmail -> [mailboxKey]
      mailboxToUser: {},   // mailboxKey -> userEmail
      pendingTokens: {},   // token -> { userEmail, mailbox, createdAt }
      sentLogs: []         // [ { timestamp, phone, mailbox, type, status } ]
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

  // ===== REGISTER MAILBOX FOR USER =====
  registerUserMailbox(userEmail, mailbox) {
    if (!userEmail || !mailbox) return;
    const uEmail = userEmail.toLowerCase().trim();
    const mbKey = mailbox.toLowerCase().trim().replace(/@enchant\.id$/, '').replace(/^@/, '');

    if (!this.data.userToMailboxes[uEmail]) this.data.userToMailboxes[uEmail] = [];
    if (!this.data.userToMailboxes[uEmail].includes(mbKey)) {
      this.data.userToMailboxes[uEmail].push(mbKey);
    }

    this.data.mailboxToUser[mbKey] = uEmail;

    // If this user already has a paired WhatsApp, automatically link this new mailbox!
    const pairing = this.data.pairings[uEmail];
    if (pairing) {
      if (!this.data.mailboxToPhone[mbKey]) this.data.mailboxToPhone[mbKey] = [];
      const exists = this.data.mailboxToPhone[mbKey].some(e => (typeof e === 'object' ? e.chatId : e) === (pairing.chatId || pairing.phone));
      if (!exists) {
        this.data.mailboxToPhone[mbKey].push({
          phone: pairing.phone,
          chatId: pairing.chatId || (pairing.phone.includes('@') ? pairing.phone : `${pairing.phone}@c.us`)
        });
        console.log(`[WABot] 🔗 Mailbox baru [${mbKey}@enchant.id] otomatis ditautkan ke WhatsApp user ${uEmail} (+${pairing.phone})`);
      }
    }

    this.saveData();
  }

  // ===== INITIALIZE BOT =====
  init() {
    if (this.client) {
      try { this.client.destroy(); } catch (e) {}
    }

    this.status = 'INITIALIZING';
    this.qrDataUrl = null;
    this.errorMessage = null;

    console.log('[WABot] 🚀 Initializing WhatsApp Web Client...');

    try {
      const winChrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
      const linuxChromeCandidates = [
        '/usr/bin/google-chrome-stable',
        '/usr/bin/google-chrome',
        '/usr/bin/chromium-browser',
        '/usr/bin/chromium'
      ];
      const linuxChrome = linuxChromeCandidates.find(p => fs.existsSync(p));

      const puppeteerOpts = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      };
      if (process.platform === 'win32' && fs.existsSync(winChrome)) {
        puppeteerOpts.executablePath = winChrome;
      } else if (linuxChrome) {
        puppeteerOpts.executablePath = linuxChrome;
      }

      this.client = new Client({
        authStrategy: new LocalAuth({
          dataPath: path.join(__dirname, '.wabot_auth')
        }),
        puppeteer: puppeteerOpts
      });

      this.client.on('qr', async (qr) => {
        console.log('[WABot] 📱 QR Code received, generating data URL for Admin Dashboard...');
        this.status = 'WAITING_QR';
        try {
          this.qrDataUrl = await qrcode.toDataURL(qr, { width: 320, margin: 2 });
        } catch (err) {
          console.error('[WABot] QR Error:', err.message);
        }
      });

      this.client.on('authenticated', () => {
        console.log('[WABot] 🔐 WhatsApp authenticated successfully.');
        this.status = 'INITIALIZING';
        this.qrDataUrl = null;
      });

      this.client.on('auth_failure', (msg) => {
        console.error('[WABot] ❌ Auth failure:', msg);
        this.status = 'ERROR';
        this.errorMessage = 'Gagal autentikasi WhatsApp: ' + msg;
      });

      this.client.on('ready', () => {
        this.status = 'CONNECTED';
        this.qrDataUrl = null;
        this.botNumber = this.client.info && this.client.info.wid ? this.client.info.wid.user : 'Unknown';
        this.botName = this.client.info && this.client.info.pushname ? this.client.info.pushname : 'Enchant Bot';
        console.log(`[WABot] 🟢 WhatsApp Bot READY! Connected as ${this.botName} (+${this.botNumber})`);
      });

      this.client.on('disconnected', (reason) => {
        console.warn('[WABot] ⚠️ WhatsApp disconnected:', reason);
        this.status = 'DISCONNECTED';
        this.qrDataUrl = null;
        this.botNumber = null;
      });

      // Handle Incoming WhatsApp Messages for Pairing
      const handleMsg = async (msg) => {
        try {
          await this.handleIncomingWhatsAppMessage(msg);
        } catch (e) {
          console.error('[WABot] Message Handler Error:', e.message);
        }
      };

      this.client.on('message', handleMsg);
      this.client.on('message_create', handleMsg);

      this.client.initialize().catch((err) => {
        console.error('[WABot] Init Error:', err.message);
        this.status = 'ERROR';
        this.errorMessage = err.message;
      });

    } catch (err) {
      console.error('[WABot] Setup Error:', err.message);
      this.status = 'ERROR';
      this.errorMessage = err.message;
    }
  }

  // ===== HANDLE INCOMING MESSAGE (PAIRING) =====
  async handleIncomingWhatsAppMessage(msg) {
    if (!msg || !msg.body) return;

    const rawText = (msg.body || '').trim();
    if (!rawText) return;

    const upperText = rawText.toUpperCase();
    const isFromMe = !!msg.fromMe;
    const chatId = msg.from;
    const fromPhone = (chatId.includes('@') ? chatId.split('@')[0] : chatId).replace(/[^0-9]/g, '');

    console.log(`[WABot] 💬 Pesan WhatsApp diterima [Chat: ${chatId} | From: +${fromPhone} | FromMe: ${isFromMe}]: "${rawText}"`);

    // Find any token in pendingTokens
    let foundToken = null;
    let tokenInfo = null;

    // Check all active pending tokens
    for (const [tKey, tData] of Object.entries(this.data.pendingTokens || {})) {
      if (upperText.includes(tKey.toUpperCase())) {
        foundToken = tKey;
        tokenInfo = tData;
        break;
      }
    }

    // Fallback regex match for ENC-XXXX format
    if (!foundToken) {
      const match = upperText.match(/ENC-[A-Z0-9]{3,8}/);
      if (match && this.data.pendingTokens[match[0]]) {
        foundToken = match[0];
        tokenInfo = this.data.pendingTokens[foundToken];
      }
    }

    if (foundToken && tokenInfo) {
      console.log(`[WABot] 🎯 Token valid ditemukan: ${foundToken} untuk user ${tokenInfo.userEmail}`);

      const userEmail = (tokenInfo.userEmail || 'user').toLowerCase().trim();
      const rawMb = (tokenInfo.mailbox || 'user').toLowerCase().trim().replace(/@enchant\.id$/, '');
      const fullMailbox = `${rawMb}@enchant.id`;
      const targetPhone = fromPhone || this.botNumber || 'User';

      // Save exact WhatsApp chatId (supports @lid and @c.us)
      const pairingRecord = {
        userEmail,
        mailbox: fullMailbox,
        phone: targetPhone,
        chatId: chatId,
        pairedAt: new Date().toISOString()
      };

      this.data.pairings[userEmail] = pairingRecord;

      // Register mailbox index for CURRENT mailbox
      if (!this.data.mailboxToPhone[rawMb]) this.data.mailboxToPhone[rawMb] = [];
      const existingEntry = this.data.mailboxToPhone[rawMb].find(e => (typeof e === 'object' ? e.chatId : e) === chatId);
      if (!existingEntry) {
        this.data.mailboxToPhone[rawMb].push({ phone: targetPhone, chatId });
      }

      // Also auto-link ALL previous & current mailboxes created by this user!
      if (!this.data.userToMailboxes[userEmail]) this.data.userToMailboxes[userEmail] = [];
      if (!this.data.userToMailboxes[userEmail].includes(rawMb)) {
        this.data.userToMailboxes[userEmail].push(rawMb);
      }
      this.data.mailboxToUser[rawMb] = userEmail;

      this.data.userToMailboxes[userEmail].forEach(mb => {
        if (!this.data.mailboxToPhone[mb]) this.data.mailboxToPhone[mb] = [];
        const found = this.data.mailboxToPhone[mb].some(e => (typeof e === 'object' ? e.chatId : e) === chatId);
        if (!found) {
          this.data.mailboxToPhone[mb].push({ phone: targetPhone, chatId });
        }
      });

      // Clean up token
      delete this.data.pendingTokens[foundToken];
      this.saveData();

      console.log(`[WABot] 🔗 Berhasil menghubungkan WhatsApp [ChatId: ${chatId}] -> ${userEmail} (${fullMailbox} & ${this.data.userToMailboxes[userEmail].length} mailbox)`);

      // Reply confirmation to WhatsApp
      const replyText = `🤖 *ENCHANT NOTIFICATION BOT*\n━━━━━━━━━━━━━━━━━━━\n` +
        `✅ *MAIL CONNECTED!*\n\n` +
        `📧 *Akun Gmail:* ${userEmail}\n` +
        `📬 *Mailbox Aktif:* ${fullMailbox}\n` +
        `📱 *WhatsApp:* +${targetPhone}\n` +
        `🕒 *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n` +
        `✨ *Status: AKTIF*\n` +
        `Nomor WhatsApp ini sekarang terhubung ke akun Anda. Setiap kali membuat atau login akun AM di mailbox @enchant.id mana pun, *Link Login & Kode OTP* akan otomatis dikirimkan ke sini tanpa perlu connect ulang!\n━━━━━━━━━━━━━━━━━━━`;

      try {
        if (typeof msg.reply === 'function') {
          await msg.reply(replyText);
        } else {
          await this.client.sendMessage(chatId, replyText);
        }
        console.log(`[WABot] 📤 Balasan Mail Connected terkirim ke ${chatId}`);
      } catch (err) {
        console.warn(`[WABot] Fallback sendMessage to ${chatId}:`, err.message);
        try {
          await this.client.sendMessage(chatId, replyText);
        } catch (e2) {
          console.error('[WABot] Gagal mengirim konfirmasi balasan:', e2.message);
        }
      }
    }
  }

  // ===== GENERATE PAIR TOKEN =====
  generatePairToken(userEmail, mailbox = '') {
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    const token = `ENC-${rand}`;

    this.data.pendingTokens[token] = {
      userEmail: (userEmail || '').trim().toLowerCase(),
      mailbox: (mailbox || '').trim().toLowerCase(),
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + 15 * 60 * 1000 // 15 mins
    };

    this.saveData();

    const botNum = this.botNumber || '';
    const messageTemplate = encodeURIComponent(`CONNECT ENCHANT ${token}`);
    const waUrl = botNum ? `https://wa.me/${botNum}?text=${messageTemplate}` : null;

    return {
      token,
      botNumber: botNum,
      waUrl,
      expiresInMinutes: 15
    };
  }

  // ===== CHECK PAIR STATUS =====
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

  // ===== DISCONNECT / UNPAIR USER =====
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

  // ===== FORWARD INCOMING EMAIL TO WHATSAPP =====
  async forwardEmailNotification({ mailboxKey, from, to, subject, text, html, otp, loginLink }) {
    if (this.status !== 'CONNECTED' || !this.client) return false;

    const key = (mailboxKey || '').toLowerCase().trim();
    
    // Collect all target recipients (from mailbox index AND pairings)
    const targets = [];

    // 1. Check mailboxToPhone
    const mbTargets = this.data.mailboxToPhone[key] || [];
    mbTargets.forEach(t => targets.push(t));

    // 2. Check all pairings matching mailbox or user
    Object.values(this.data.pairings || {}).forEach(p => {
      const pMb = (p.mailbox || '').toLowerCase().replace(/@enchant\.id$/, '');
      if (pMb === key || (to && p.mailbox && p.mailbox.toLowerCase() === to.toLowerCase())) {
        if (!targets.some(existing => (existing.chatId || existing) === (p.chatId || p.phone))) {
          targets.push({ phone: p.phone, chatId: p.chatId || (p.phone.includes('@') ? p.phone : `${p.phone}@c.us`) });
        }
      }
    });

    if (!targets || targets.length === 0) {
      console.log(`[WABot] ℹ️ Tidak ada user WhatsApp yang terhubung untuk mailbox: [${key}] (${to})`);
      return false;
    }

    console.log(`[WABot] 🚀 Menyiapkan penerusan email ke ${targets.length} penerima WhatsApp...`);

    let messageBody = `📩 *[ENCHANT MAIL] PESAN BARU DITERIMA*\n━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *Dari:* ${from || 'noreply@alight-creative.firebaseapp.com'}\n` +
      `📬 *Mailbox:* ${to || `${key}@enchant.id`}\n` +
      `📋 *Subjek:* ${subject || '(Tanpa Subjek)'}\n` +
      `🕒 *Waktu:* ${new Date().toLocaleString('id-ID')}\n\n`;

    if (loginLink) {
      messageBody += `🔗 *LINK LOGIN ALIGHT CREATIVE TERDETEKSI:*\n${loginLink}\n\n` +
        `💡 _Klik link di atas pada HP kamu untuk langsung masuk ke akun Alight Motion tanpa buka website!_\n\n`;
    }

    if (otp) {
      messageBody += `🔑 *KODE OTP:* *${otp}*\n\n`;
    }

    const snippet = (text || html || '').replace(/<[^>]+>/g, ' ').substring(0, 140).trim();
    if (snippet && !loginLink) {
      messageBody += `📄 *Isi Pesan:* ${snippet}...\n\n`;
    }

    messageBody += `━━━━━━━━━━━━━━━━━━━\n_Dikirim otomatis oleh Enchant AM Premium Engine_`;

    for (const target of targets) {
      let destChatId = typeof target === 'object' ? (target.chatId || target.phone) : target;
      let displayPhone = typeof target === 'object' ? target.phone : target;

      if (!destChatId.includes('@')) {
        destChatId = `${destChatId}@c.us`;
      }

      try {
        await this.client.sendMessage(destChatId, messageBody);
        console.log(`[WABot] ✅ Berhasil meneruskan pesan ke WhatsApp ${destChatId} (+${displayPhone})`);

        if (!this.data.sentLogs) this.data.sentLogs = [];
        this.data.sentLogs.unshift({
          timestamp: new Date().toISOString(),
          phone: displayPhone,
          mailbox: `${key}@enchant.id`,
          type: loginLink ? 'MAGIC_LINK' : (otp ? 'OTP' : 'EMAIL'),
          status: 'SUCCESS'
        });
        if (this.data.sentLogs.length > 50) this.data.sentLogs.pop();
        this.saveData();

      } catch (err) {
        console.error(`[WABot] Gagal mengirim ke ${destChatId}:`, err.message);
      }
    }

    return true;
  }

  // ===== SEND NOTIFICATION TO ADMIN ON NEW ACTIVATION =====
  async sendAdminNotification({ userEmail, targetEmail, mode, expiresAt, durationSeconds, ip }) {
    if (this.status !== 'CONNECTED' || !this.client) {
      console.log('[WABot] ⚠️ WA Bot belum connected, notif admin tidak dapat dikirim.');
      return false;
    }

    const ADMIN_NUMBER = '6285704625361';
    const adminChatId = `${ADMIN_NUMBER}@c.us`;

    const modeText = mode === 'auto' ? '⚡ Otomatis (@enchant.id)' : '✍️ Manual (Email Pribadi)';
    const expText = expiresAt ? (typeof expiresAt === 'number' ? new Date(expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : expiresAt) : '1 Tahun (365 Hari)';

    const message = `🔔 *[NOTIFIKASI AKTIVASI BARU]*\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `👤 *User Login Web:* ${userEmail || '(Guest/Anonim)'}\n` +
      `💎 *Email AM Pro:* \`${targetEmail}\`\n` +
      `⚙️ *Metode:* ${modeText}\n` +
      `⏳ *Masa Aktif:* ${expText}\n` +
      `⏱️ *Durasi Proses:* ${durationSeconds ? durationSeconds.toFixed(1) + 's' : '-'}\n` +
      `🌐 *IP Pengguna:* ${ip || '-'}\n` +
      `🕒 *Waktu:* ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\n` +
      `━━━━━━━━━━━━━━━━━━━\n` +
      `_Notifikasi Admin Enchant AM Premium Hub_`;

    try {
      await this.client.sendMessage(adminChatId, message);
      console.log(`[WABot] 📢 Notifikasi aktivasi berhasil dikirim ke Admin WhatsApp (${ADMIN_NUMBER})`);
      return true;
    } catch (err) {
      console.error('[WABot] ❌ Gagal mengirim notif ke Admin WhatsApp:', err.message);
      return false;
    }
  }

  // ===== GET BOT STATUS & METRICS FOR ADMIN =====
  getStatus() {
    return {
      status: this.status,
      qrDataUrl: this.qrDataUrl,
      botNumber: this.botNumber,
      botName: this.botName,
      errorMessage: this.errorMessage,
      pairedUsersCount: Object.keys(this.data.pairings || {}).length,
      pairings: Object.values(this.data.pairings || {}),
      recentLogs: (this.data.sentLogs || []).slice(0, 20)
    };
  }

  // ===== RESTART BOT =====
  restart() {
    console.log('[WABot] 🔄 Restarting WhatsApp Bot...');
    this.init();
    return { success: true, message: 'WhatsApp Bot sedang di-restart...' };
  }

  // ===== LOGOUT BOT =====
  async logout() {
    if (this.client) {
      try {
        await this.client.logout();
        await this.client.destroy();
      } catch (e) {}
    }
    this.status = 'DISCONNECTED';
    this.qrDataUrl = null;
    this.botNumber = null;
    this.saveData();
    this.init();
    return { success: true, message: 'WhatsApp Bot berhasil logout. Scan QR ulang.' };
  }
}

module.exports = new WABotService();
