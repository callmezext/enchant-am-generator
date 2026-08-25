/**
 * Generate 1 Real AM Premium Account and Register into Enchant Mail
 */

const http = require('http');

console.log('Memulai pembuatan 1 Akun Alight Motion Premium Real...');

const payload = JSON.stringify({
  solverType: 'theyka',
  theykaUrl: 'http://localhost:5000/turnstile',
  email: 'ampro_vip@enchant.id'
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/generate-instant',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  },
  timeout: 180000
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Response Status:', res.statusCode);
    try {
      const json = JSON.parse(data);
      console.log('Result:', JSON.stringify(json, null, 2));
    } catch {
      console.log('Raw output:', data);
    }
  });
});

req.on('error', e => console.error('Error:', e.message));
req.write(payload);
req.end();
