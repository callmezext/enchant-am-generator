const https = require('https');

const payload = JSON.stringify({
  to: 'developer@enchant.id',
  from: 'service@github.com',
  subject: 'Your GitHub verification code is 849201',
  html: '<div style="font-family:sans-serif;"><h3>GitHub Security</h3><p>Use code <b>849201</b> to verify your device.</p></div>',
  text: 'Your GitHub verification code is 849201'
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
  res.on('end', () => console.log('Delivered:', data));
});
req.write(payload);
req.end();
