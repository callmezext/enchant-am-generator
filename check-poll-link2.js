const https = require('https');
const fs = require('fs');

const accounts = JSON.parse(fs.readFileSync('accounts.json', 'utf8'));
const acc = accounts[0];

function req(method, path, body = null) {
  return new Promise((resolve) => {
    const cookieStr = acc.cookies ? acc.cookies.map(([k,v]) => `${k}=${v}`).join('; ') : '';
    const payload = body ? JSON.stringify(body) : null;
    const r = https.request(`https://amprem.irfanjawa.com${path}`, {
      method,
      headers: {
        'Cookie': cookieStr,
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://amprem.irfanjawa.com/dashboard-v2',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    r.on('error', e => resolve({ error: e.message }));
    if (payload) r.write(payload);
    r.end();
  });
}

(async () => {
  console.log('--- Checking Poll Email & Temp Mail Messages ---');
  const poll = await req('GET', '/api/generator-v2/poll-email');
  console.log('Poll:', poll);

  const msgs = await req('GET', '/api/temp-mail/messages');
  console.log('Messages in temp mail:', JSON.stringify(msgs, null, 2));

  const st = await req('GET', '/api/generator-v2/status');
  console.log('Current Status:', JSON.stringify(st, null, 2));
})();
