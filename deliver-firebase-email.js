const http = require('http');

const payload = JSON.stringify({
  to: 'amprovip@enchant.id',
  from: 'noreply@alight-motion.firebaseapp.com',
  subject: 'Masuk ke Alight Motion (Firebase Magic Link)',
  html: `
    <div style="font-family:sans-serif;padding:24px;background:#ffffff;color:#111827;border-radius:12px;max-width:500px;margin:auto;">
      <h2 style="color:#6366f1;margin-bottom:12px;">Alight Motion</h2>
      <p style="font-size:15px;line-height:1.6;">Halo, silakan gunakan tautan verifikasi resmi Firebase di bawah ini untuk masuk ke aplikasi Alight Motion dengan akun Premium Anda:</p>
      <p style="margin:24px 0;">
        <a href="https://alightcreative.page.link/amprovip_auth" style="background:#6366f1;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
          🚀 Masuk ke Alight Motion
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px;line-height:1.4;">Tautan ini dibuat secara otomatis oleh sistem otentikasi resmi Alight Motion Firebase.</p>
    </div>
  `,
  text: 'Klik tautan ini untuk masuk ke Alight Motion: https://alightcreative.page.link/amprovip_auth',
  magicLink: 'https://alightcreative.page.link/amprovip_auth'
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/mail/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log('Webhook Response:', data));
});
req.write(payload);
req.end();
