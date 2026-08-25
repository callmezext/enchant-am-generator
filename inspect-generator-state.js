const https = require('https');
const fs = require('fs');

const accounts = JSON.parse(fs.readFileSync('accounts.json', 'utf8'));
const acc = accounts[0];

console.log('Testing active account session:', acc.email);

function req(method, path, body = null, cookies = acc.cookies) {
  return new Promise((resolve, reject) => {
    const cookieStr = cookies ? cookies.map(([k,v]) => `${k}=${v}`).join('; ') : '';
    const payload = body ? JSON.stringify(body) : null;
    const r = https.request(`https://amprem.irfanjawa.com${path}`, {
      method,
      headers: {
        'Cookie': cookieStr,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

(async () => {
  console.log('--- 1. Generator V2 Status ---');
  const st = await req('GET', '/api/generator-v2/status');
  console.log('Status:', JSON.stringify(st, null, 2));

  console.log('--- 2. Generator V1 Status ---');
  const st1 = await req('GET', '/api/generator/status');
  console.log('Status V1:', JSON.stringify(st1, null, 2));
})();
