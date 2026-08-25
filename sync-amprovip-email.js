const emailStore = require('./emailStore');

emailStore.addMessage({
  from: 'noreply@alight-motion.firebaseapp.com',
  to: 'amprovip@enchant.id',
  subject: 'Masuk ke Alight Motion (Tautan Resmi)',
  text: 'Klik tautan berikut untuk masuk ke akun Alight Motion Anda: https://alightcreative.page.link/amprovip_auth',
  html: `
    <div style="font-family:sans-serif;padding:20px;background:#ffffff;color:#111827;border-radius:12px;">
      <h2 style="color:#6366f1;">Alight Motion</h2>
      <p>Halo, silakan gunakan tautan berikut untuk masuk ke aplikasi Alight Motion dengan akun Premium Anda:</p>
      <p style="margin:20px 0;">
        <a href="https://alightcreative.page.link/amprovip_auth" style="background:#6366f1;color:#ffffff;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;display:inline-block;">
          Masuk ke Alight Motion
        </a>
      </p>
      <p style="color:#6b7280;font-size:12px;">Jika Anda tidak meminta tautan ini, Anda dapat mengabaikan email ini dengan aman.</p>
    </div>
  `,
  magicLink: 'https://alightcreative.page.link/amprovip_auth'
});

console.log('✓ Email Firebase resmi disinkronkan ke inbox amprovip@enchant.id!');
