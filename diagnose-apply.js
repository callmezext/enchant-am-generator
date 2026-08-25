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
        'Referer': 'https://amprem.irfanjawa.com/dashboard',
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
  console.log('Account:', acc.email);

  console.log('1. Check V1 Ads Status:');
  const v1Status = await req('GET', '/api/ads/status');
  console.log('V1 Ads status:', v1Status);

  console.log('2. Check V2 Status:');
  const v2Status = await req('GET', '/api/generator-v2/status');
  console.log('V2 status:', v2Status);

  console.log('3. Test Generator V1 Apply:');
  const apply1 = await req('POST', '/api/generator/apply', { email: 'admin@enchant.id' });
  console.log('Apply V1:', apply1);
})();
