const https = require('https');

const payload = JSON.stringify({
  to: 'testuser@enchant.id',
  from: 'noreply@alightcreative.com',
  subject: 'Masuk ke Alight Motion',
  html: '<p>Klik tautan ini: <a href="https://alightcreative.page.link/test12345">Login ke Alight Motion</a></p>',
  text: 'Klik tautan ini: https://alightcreative.page.link/test12345'
});

const req = https.request('https://mail.enchant.id/api/mail/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log('Webhook test response:', data));
});
req.write(payload);
req.end();
