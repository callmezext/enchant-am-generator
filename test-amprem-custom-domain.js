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
        'Referer': 'https://amprem.irfanjawa.com/dashboard/generator-v2',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, raw: data.substring(0, 100) }); }
      });
    });
    r.on('error', e => resolve({ error: e.message }));
    if (payload) r.write(payload);
    r.end();
  });
}

(async () => {
  console.log('Testing custom email on temp-mail generate...');
  const g1 = await req('POST', '/api/temp-mail/generate', { domain: 'enchant.id', customUsername: 'admin' });
  console.log('g1:', g1);

  const g2 = await req('POST', '/api/temp-mail/generate', { emailAddress: 'admin@enchant.id' });
  console.log('g2:', g2);
})();
