const https = require('https');

const payload = JSON.stringify({ email: 'admin@enchant.id' });

const req = https.request('http://localhost:3000/api/send-link', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log('Response:', data));
});
req.write(payload);
req.end();
