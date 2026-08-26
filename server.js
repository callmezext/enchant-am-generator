/**
 * Enchant AM Generator + Temp Mail Hub
 * 2 Modes: Auto (@enchant.id) & Manual (Gmail/TempMail/pribadi)
 * Premium via ArkanStudio
 */

const express = require('express');
const crypto = require('crypto');
const path = require('path');

const emailStore = require('./emailStore');
const smtpReceiver = require('./smtpReceiver');
const arkanaEngine = require('./arkanaEngine');
const statsManager = require('./statsManager');
const waBotService = require('./waBotService');

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

try { smtpReceiver.start(2525); } catch (e) { console.log('[SMTP]', e.message); }

// Initialize WhatsApp Web Bot
try { waBotService.init(); } catch (e) { console.error('[WABot] Auto-init Error:', e.message); }

const manualSessions = new Map();
const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  next();
});

// Real Client IP Helper
function getClientIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  const forwarded = req.headers['x-forwarded-for'];
  const rawIp = cfIp || (forwarded ? forwarded.split(',')[0] : null) || req.socket.remoteAddress || '127.0.0.1';
  return rawIp.replace(/^::ffff:/, '').trim();
}

function formatExpiryDate(rawDate) {
  if (!rawDate) return '1 Tahun';
  if (typeof rawDate === 'string') {
    if (rawDate.match(/\d{1,2}\s+[A-Za-z]+\s+\d{4}/)) return rawDate;
  }
  try {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }
  } catch (e) {}
  return typeof rawDate === 'string' ? rawDate : '1 Tahun';
}

// Global Banned IP Blocker Middleware for APIs
app.use('/api', (req, res, next) => {
  const clientIp = getClientIp(req);
  if (statsManager.isIpBanned(clientIp)) {
    const banInfo = statsManager.getBannedInfo(clientIp);
    return res.status(403).json({
      success: false,
      banned: true,
      error: `Akses Ditolak: Alamat IP Anda (${clientIp}) telah diblokir otomatis oleh sistem karena terdeteksi spam.`,
      reason: banInfo ? banInfo.reason : 'Spam terdeteksi'
    });
  }
  next();
});

// Hostname routing
app.use((req, res, next) => {
  const host = (req.hostname || req.headers.host || '').toLowerCase();
  const isApi = req.path.startsWith('/api/');
  const hasExt = path.extname(req.path) !== '';
  if (host.includes('mail.enchant.id') && !isApi && !hasExt) return res.sendFile(path.join(__dirname, 'public', 'mail.html'));
  if ((host.includes('am.enchant.id') || req.path === '/' || req.path === '/index.html') && !isApi && !hasExt) return res.sendFile(path.join(__dirname, 'public', 'index.html'));
  next();
});
app.get(['/mail', '/mail/:u'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'mail.html')));
app.use(express.static(path.join(__dirname, 'public')));

// ===== TEMP MAIL API =====
app.get(['/api/v1/mailbox/search', '/api/mailbox/search'], (req, res) => {
  const q = req.query.q || req.query.email || req.query.username;
  if (!q) return res.status(400).json({ success: false, error: 'Masukkan email.' });
  const key = emailStore.normalizeKey(q);
  if (!emailStore.isMailboxRegistered(key)) return res.status(404).json({ success: false, exists: false, error: `"${key}@enchant.id" belum dibuat.` });
  res.json({ success: true, exists: true, username: key, email: `${key}@enchant.id`, messages: emailStore.getMessages(key) });
});

app.post(['/api/v1/mailbox/create', '/api/mailbox/create'], (req, res) => {
  const clientIp = getClientIp(req);
  const userEmail = (req.body.userEmail || req.body.authUserEmail || 'guest').trim().toLowerCase();

  // IP Spam Check
  const spamCheck = statsManager.trackAndCheckIpSpam(clientIp, userEmail, 'Pembuatan Mailbox Baru');
  if (!spamCheck.allowed) {
    return res.status(403).json({ success: false, banned: true, error: spamCheck.reason });
  }

  let { username } = req.body || {};
  if (username) username = username.toLowerCase().trim().replace(/[^a-z0-9_.-]/g, '');
  if (!username) username = 'user_' + crypto.randomBytes(4).toString('hex');
  const isNew = !emailStore.isMailboxRegistered(username);
  const mb = emailStore.registerMailbox(username);

  // Auto-link to WhatsApp if user is authenticated
  if (userEmail && userEmail !== 'guest' && mb.email) {
    waBotService.registerUserMailbox(userEmail, mb.email);
  }

  res.json({ success: true, email: mb.email, username: mb.username, isNew });
});

app.get(['/api/v1/mail/inbox', '/api/mail/inbox'], (req, res) => {
  const email = req.query.email || req.query.address;
  if (!email) return res.status(400).json({ success: false, error: 'Email wajib.' });
  const key = emailStore.normalizeKey(email);
  if (!emailStore.isMailboxRegistered(key)) return res.status(404).json({ success: false, error: 'Mailbox belum dibuat.' });
  res.json({ success: true, email: `${key}@enchant.id`, messages: emailStore.getMessages(key) });
});

app.delete(['/api/v1/mail/message/:id', '/api/mail/message/:id'], (req, res) => {
  res.json({ success: emailStore.deleteMessage(req.params.id) });
});

app.delete(['/api/v1/mail/inbox', '/api/mail/inbox'], (req, res) => {
  if (!req.query.email) return res.status(400).json({ success: false });
  emailStore.clearInbox(req.query.email);
  res.json({ success: true });
});

app.get(['/api/v1/mail/events', '/api/mail/events'], (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).end();
  res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
  const key = emailStore.normalizeKey(email);
  const fn = (msg) => res.write(`event: message\ndata: ${JSON.stringify(msg)}\n\n`);
  emailStore.on(`message:${key}`, fn);
  req.on('close', () => emailStore.removeListener(`message:${key}`, fn));
});

app.post(['/api/mail/webhook', '/api/v1/mail/webhook'], async (req, res) => {
  try { const msg = await smtpReceiver.handleWebhook(req.body, req.headers); res.json({ success: true, id: msg.id }); }
  catch (e) { res.status(400).json({ success: false, error: e.message }); }
});

// ===== CLOUDFLARE TURNSTILE VERIFICATION =====
const CF_TURNSTILE_SECRET = '0x4AAAAAAEYI0X2herXz9JgG3A0ecjqrwGQ';

app.post('/api/verify-turnstile', async (req, res) => {
  const { token, remoteip } = req.body || {};
  if (!token) return res.status(400).json({ success: false, error: 'Token Turnstile wajib diisi.' });

  try {
    const formData = new URLSearchParams();
    formData.append('secret', CF_TURNSTILE_SECRET);
    formData.append('response', token);
    if (remoteip) formData.append('remoteip', remoteip);

    const cfRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    const cfData = await cfRes.json();
    if (cfData.success) {
      return res.json({ success: true, verified: true, timestamp: cfData.challenge_ts });
    } else {
      return res.status(400).json({ success: false, verified: false, error: 'Verifikasi Cloudflare gagal.', details: cfData['error-codes'] });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ===== STATS & ADMIN CONFIG APIS =====
app.get('/api/stats', (req, res) => {
  const userEmail = req.query.userEmail || '';
  res.json({ success: true, ...statsManager.getStats(userEmail) });
});

app.post('/api/admin/settings', (req, res) => {
  const { adminEmail, dailyLimitPerUser, totalActivationsReset } = req.body;
  try {
    const updated = statsManager.updateSettings({
      adminEmail,
      dailyLimitPerUser: Number(dailyLimitPerUser),
      totalActivationsReset: totalActivationsReset !== undefined ? Number(totalActivationsReset) : undefined
    });
    res.json({ success: true, message: 'Pengaturan Admin berhasil disimpan!', stats: updated });
  } catch (err) {
    res.status(403).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/unban', (req, res) => {
  const { adminEmail, ip } = req.body || {};
  try {
    const result = statsManager.unbanIp({ adminEmail, ip });
    res.json({ success: true, message: `IP ${ip} berhasil dibuka blokirnya!`, result });
  } catch (err) {
    res.status(403).json({ success: false, error: err.message });
  }
});

app.post('/api/admin/ban', (req, res) => {
  const { adminEmail, ip, userEmail, reason } = req.body || {};
  try {
    const result = statsManager.banIpManual({ adminEmail, ip, userEmail, reason });
    res.json({ success: true, message: `IP ${ip} berhasil diblokir!`, result });
  } catch (err) {
    res.status(403).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/security', (req, res) => {
  const adminEmail = req.query.adminEmail || '';
  try {
    const data = statsManager.getSecurityData(adminEmail);
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(403).json({ success: false, error: err.message });
  }
});

// ===== WHATSAPP BOT USER & ADMIN APIS =====
app.get('/api/wa/status', (req, res) => {
  res.json({ success: true, ...waBotService.getStatus() });
});

app.post('/api/wa/generate-pair-token', (req, res) => {
  const { userEmail, mailbox } = req.body || {};
  if (!userEmail) return res.status(400).json({ success: false, error: 'Email user wajib diisi.' });

  const result = waBotService.generatePairToken(userEmail, mailbox);
  res.json({ success: true, ...result });
});

app.get('/api/wa/pair-status', (req, res) => {
  const { userEmail, token } = req.query || {};
  if (!userEmail) return res.status(400).json({ success: false, error: 'Email user wajib diisi.' });

  const status = waBotService.checkPairStatus(userEmail, token);
  res.json({ success: true, ...status });
});

app.post('/api/wa/unpair', (req, res) => {
  const { userEmail } = req.body || {};
  if (!userEmail) return res.status(400).json({ success: false, error: 'Email user wajib diisi.' });

  const result = waBotService.unpairUser(userEmail);
  res.json(result);
});

app.post('/api/admin/wa/restart', (req, res) => {
  const { adminEmail } = req.body || {};
  if (!statsManager.isAdmin(adminEmail)) return res.status(403).json({ success: false, error: 'Akses ditolak: Hanya Owner yang dapat me-restart bot!' });

  const result = waBotService.restart();
  res.json(result);
});

app.post('/api/admin/wa/logout', async (req, res) => {
  const { adminEmail } = req.body || {};
  if (!statsManager.isAdmin(adminEmail)) return res.status(403).json({ success: false, error: 'Akses ditolak: Hanya Owner yang dapat me-logout bot!' });

  const result = await waBotService.logout();
  res.json(result);
});

// ===== MODE 1: OTOMATIS (random atau custom @enchant.id) =====
app.post('/api/activate', async (req, res) => {
  const clientIp = getClientIp(req);
  const authUserEmail = (req.body.authUserEmail || '').trim().toLowerCase();
  
  // Mandatory @gmail.com validation
  if (authUserEmail && !authUserEmail.endsWith('@gmail.com')) {
    return res.status(403).json({ success: false, error: 'Hanya akun @gmail.com yang diizinkan untuk menggunakan layanan ini.' });
  }

  // IP Spam Protection Check
  const spamCheck = statsManager.trackAndCheckIpSpam(clientIp, authUserEmail, 'Aktivasi Otomatis');
  if (!spamCheck.allowed) {
    return res.status(403).json({ success: false, banned: true, error: spamCheck.reason });
  }

  // Enforce daily limit check
  const check = statsManager.canUserGenerate(authUserEmail);
  if (!check.allowed) {
    return res.status(429).json({ success: false, error: check.error });
  }

  const startTime = Date.now();
  try {
    const customName = req.body.username || req.body.email || '';
    console.log(`[AM] 🚀 Mode Otomatis [IP: ${clientIp} | User: ${authUserEmail || 'guest'}]: Membuat akun @enchant.id (${customName || 'Random'}) & aktivasi...`);
    const result = await arkanaEngine.activateAuto(customName);

    const durationSeconds = (Date.now() - startTime) / 1000;

    if (result.success) {
      statsManager.recordActivation({
        userEmail: authUserEmail,
        targetEmail: result.email,
        mode: 'auto',
        durationSeconds
      });

      // Auto-register this mailbox to user's connected WhatsApp pairing
      if (authUserEmail && result.email) {
        waBotService.registerUserMailbox(authUserEmail, result.email);
      }

      // Send WhatsApp alert to Admin
      waBotService.sendAdminNotification({
        userEmail: authUserEmail,
        targetEmail: result.email,
        mode: 'auto',
        expiresAt: result.expiresAt,
        durationSeconds,
        ip: clientIp
      }).catch(e => console.error('[Admin Notif Error]:', e.message));

      const exp = formatExpiryDate(result.expiresAt);
      res.json({
        success: true,
        email: result.email,
        status: 'PREMIUM_ACTIVE',
        premiumExpiresAt: exp,
        durationSeconds: parseFloat(durationSeconds.toFixed(1)),
        activationDetail: result.activationDetail || 'Play Billing Resmi',
        message: `Akun ${result.email} berhasil diaktifkan Premium hingga ${exp}!`
      });
    } else {
      throw new Error(result.error || 'Gagal aktivasi.');
    }
  } catch (err) {
    console.error('[AM Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== MODE 1B: BULK GENERATOR (Parallel Concurrency) =====
app.post('/api/activate/bulk', async (req, res) => {
  const clientIp = getClientIp(req);
  const authUserEmail = (req.body.authUserEmail || '').trim().toLowerCase();

  // Mandatory @gmail.com validation
  if (authUserEmail && !authUserEmail.endsWith('@gmail.com')) {
    return res.status(403).json({ success: false, error: 'Hanya akun @gmail.com yang diizinkan untuk menggunakan layanan ini.' });
  }

  const requestedCount = Math.min(Math.max(parseInt(req.body.count || '5', 10), 1), 25);
  const prefix = (req.body.prefix || 'am').trim();
  const concurrency = Math.min(Math.max(parseInt(req.body.concurrency || '3', 10), 1), 5);

  // IP Spam Protection Check
  const spamCheck = statsManager.trackAndCheckIpSpam(clientIp, authUserEmail, `Aktivasi Bulk (${requestedCount}x)`);
  if (!spamCheck.allowed) {
    return res.status(403).json({ success: false, banned: true, error: spamCheck.reason });
  }

  // Enforce daily limit check
  const check = statsManager.canUserGenerate(authUserEmail, requestedCount);
  if (!check.allowed) {
    return res.status(429).json({ success: false, error: check.error });
  }

  const startTime = Date.now();
  try {
    console.log(`[AM] 🚀 Mode Bulk [IP: ${clientIp} | User: ${authUserEmail || 'guest'}]: Generating ${requestedCount} accounts (prefix: ${prefix}, concurrency: ${concurrency})...`);
    
    const result = await arkanaEngine.activateBulk({
      count: requestedCount,
      prefix,
      concurrency
    });

    const totalDuration = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));

    if (result && result.results) {
      const formattedAccounts = result.results.map(acc => {
        const exp = formatExpiryDate(acc.expiresAt);
        return {
          ...acc,
          premiumExpiresAt: exp
        };
      });

      // Record activations
      statsManager.recordBulkActivation({
        userEmail: authUserEmail,
        count: requestedCount,
        accounts: formattedAccounts,
        durationSeconds: totalDuration
      });

      // Auto-register mailboxes to WhatsApp
      if (authUserEmail) {
        formattedAccounts.forEach(acc => {
          if (acc.success && acc.email) {
            waBotService.registerUserMailbox(authUserEmail, acc.email);
          }
        });
      }

      // Send admin WhatsApp notification
      const successCount = formattedAccounts.filter(a => a.success).length;
      waBotService.sendAdminNotification({
        userEmail: authUserEmail,
        targetEmail: `[BULK] ${successCount}/${requestedCount} Akun (${prefix})`,
        mode: 'bulk',
        expiresAt: '1 Tahun',
        durationSeconds: totalDuration,
        ip: clientIp
      }).catch(e => console.error('[Admin Notif Error]:', e.message));

      res.json({
        success: true,
        totalRequested: requestedCount,
        totalSuccess: successCount,
        totalFailed: requestedCount - successCount,
        durationSeconds: totalDuration,
        accounts: formattedAccounts,
        message: `Berhasil men-generate ${successCount} dari ${requestedCount} akun dalam ${totalDuration} detik!`
      });
    } else {
      throw new Error(result.error || 'Gagal eksekusi bulk generator.');
    }
  } catch (err) {
    console.error('[AM Bulk Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== MODE 2: MANUAL - Step 1: Kirim link verifikasi =====
app.post('/api/manual/send', async (req, res) => {
  const clientIp = getClientIp(req);
  const authUserEmail = (req.body.authUserEmail || '').trim().toLowerCase();
  
  // Mandatory @gmail.com validation
  if (authUserEmail && !authUserEmail.endsWith('@gmail.com')) {
    return res.status(403).json({ success: false, error: 'Hanya akun @gmail.com yang diizinkan untuk menggunakan layanan ini.' });
  }

  // IP Spam Protection Check
  const spamCheck = statsManager.trackAndCheckIpSpam(clientIp, authUserEmail, 'Kirim Link Manual');
  if (!spamCheck.allowed) {
    return res.status(403).json({ success: false, banned: true, error: spamCheck.reason });
  }

  // Enforce daily limit check
  const check = statsManager.canUserGenerate(authUserEmail);
  if (!check.allowed) {
    return res.status(429).json({ success: false, error: check.error });
  }

  const email = (req.body.email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ success: false, error: 'Email wajib diisi.' });

  try {
    console.log(`[AM] Mode Manual [IP: ${clientIp}]: Mengirim verifikasi ke ${email}...`);
    const result = await arkanaEngine.manualSend(email);

    if (result.success) {
      const sessionId = crypto.randomBytes(16).toString('hex');
      manualSessions.set(sessionId, { 
        email, 
        jobId: result.jobId, 
        authUserEmail,
        clientIp,
        createdAt: Date.now() 
      });

      if (authUserEmail && email) {
        waBotService.registerUserMailbox(authUserEmail, email);
      }

      res.json({
        success: true,
        sessionId,
        email,
        message: `Link verifikasi berhasil dikirim ke ${email}!`
      });
    } else {
      throw new Error(result.error || 'Gagal mengirim verifikasi.');
    }
  } catch (err) {
    console.error('[Manual Send Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ===== MODE 2: MANUAL - Step 2: Verifikasi & aktifkan premium =====
app.post('/api/manual/verify', async (req, res) => {
  const { sessionId, magicLink } = req.body;
  if (!sessionId || !magicLink) return res.status(400).json({ success: false, error: 'Session ID dan Link wajib diisi.' });

  const session = manualSessions.get(sessionId);
  if (!session) return res.status(400).json({ success: false, error: 'Sesi kedaluwarsa. Ulangi langkah 1.' });

  const startTime = session.createdAt || Date.now();
  try {
    console.log(`[AM] Mode Manual: Verifikasi untuk ${session.email}...`);
    const result = await arkanaEngine.manualVerify(magicLink.trim());

    manualSessions.delete(sessionId);
    const durationSeconds = (Date.now() - startTime) / 1000;

    if (result.success) {
      statsManager.recordActivation({
        userEmail: session.authUserEmail,
        targetEmail: result.email || session.email,
        mode: 'manual',
        durationSeconds
      });

      // Send WhatsApp alert to Admin
      waBotService.sendAdminNotification({
        userEmail: session.authUserEmail,
        targetEmail: result.email || session.email,
        mode: 'manual',
        expiresAt: result.expiresAt,
        durationSeconds,
        ip: session.clientIp
      }).catch(e => console.error('[Admin Notif Error]:', e.message));

      const exp = formatExpiryDate(result.expiresAt);
      res.json({
        success: true,
        email: result.email || session.email,
        status: 'PREMIUM_ACTIVE',
        premiumExpiresAt: exp,
        durationSeconds: parseFloat(durationSeconds.toFixed(1)),
        activationDetail: result.activationDetail || 'Play Billing Resmi',
        message: `Akun ${result.email || session.email} berhasil diaktifkan Premium hingga ${exp}!`
      });
    } else {
      throw new Error(result.error || 'Verifikasi gagal.');
    }
  } catch (err) {
    console.error('[Manual Verify Error]:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', domain: req.hostname, timestamp: new Date().toISOString() });
});

app.all('/api/*', (req, res) => {
  res.status(404).json({ success: false, error: `${req.method} ${req.path} not found.` });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  ╔══════════════════════════════════════════════════════╗
  ║   AM Generator (ArkanStudio) + Mail Hub              ║
  ║   http://localhost:${PORT}                                ║
  ╚══════════════════════════════════════════════════════╝
  `);
});
