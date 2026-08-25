/**
 * Generate 1 Real AM Premium Account for User on @enchant.id
 * Uses Live Theyka Turnstile Solver & Live Firebase Email Processing
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const emailStore = require('./emailStore');

const targetUser = 'ampro' + Math.floor(Math.random() * 900 + 100);
const targetEmail = `${targetUser}@enchant.id`;

console.log(`====================================================`);
console.log(`🚀 MEMULAI GENERASI AKUN ALIGHT MOTION PREMIUM REAL`);
console.log(`📧 Target Email: ${targetEmail}`);
console.log(`📬 Inbox URL: https://mail.enchant.id/${targetUser}`);
console.log(`====================================================`);

(async () => {
  try {
    // Call /api/custom-email/send-magic-link via Express
    console.log(`\n[Step 1] Mengirim Magic Link resmi Alight Motion/Firebase ke ${targetEmail}...`);
    
    const sendPayload = JSON.stringify({
      targetEmail: targetEmail,
      solverType: 'theyka',
      theykaUrl: 'http://localhost:5000/turnstile'
    });

    const sendRes = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/custom-email/send-magic-link',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(sendPayload)
        },
        timeout: 60000
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(data)); }
        });
      });
      req.on('error', reject);
      req.write(sendPayload);
      req.end();
    });

    console.log('[Step 1 Result]:', sendRes);
    if (!sendRes.success) throw new Error(sendRes.error || 'Gagal mengirim magic link');

    const sessionId = sendRes.sessionId;
    console.log(`\n[Step 2] Menunggu email masuk dari Firebase ke inbox https://mail.enchant.id/${targetUser}...`);

    let magicLink = null;
    let receivedMessage = null;

    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const msgs = emailStore.getMessages(targetEmail);
      console.log(`[Polling Inbox #${i+1}] Total email masuk: ${msgs.length}`);
      
      for (const m of msgs) {
        if (m.magicLink) {
          magicLink = m.magicLink;
          receivedMessage = m;
          break;
        }
      }
      if (magicLink) break;
    }

    if (!magicLink) {
      throw new Error(`Timeout: Email dari Firebase belum sampai ke inbox.`);
    }

    console.log(`\n✅ EMAIL DARI FIREBASE BERHASIL DITERIMA!`);
    console.log(`- Dari: ${receivedMessage.from}`);
    console.log(`- Subjek: ${receivedMessage.subject}`);
    console.log(`- Magic Link: ${magicLink}`);

    console.log(`\n[Step 3] Memverifikasi Magic Link & Mengaktifkan Alight Motion Premium...`);
    const applyPayload = JSON.stringify({
      sessionId: sessionId,
      magicLink: magicLink
    });

    const applyRes = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/custom-email/verify-and-apply',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(applyPayload)
        },
        timeout: 60000
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(new Error(data)); }
        });
      });
      req.on('error', reject);
      req.write(applyPayload);
      req.end();
    });

    console.log('[Step 3 Result]:', applyRes);

    console.log(`\n====================================================`);
    console.log(`🎉 GENERASI SUKSES 100%!`);
    console.log(`📧 Email Akun: ${targetEmail}`);
    console.log(`📬 Cek Inbox Asli: https://mail.enchant.id/${targetUser}`);
    console.log(`🔗 Link Login AM: ${magicLink}`);
    console.log(`====================================================`);

  } catch (err) {
    console.error('\n❌ ERROR:', err.message);
  }
})();
