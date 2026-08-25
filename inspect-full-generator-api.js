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
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data.substring(0, 150) });
        }
      });
    });
    r.on('error', e => resolve({ error: e.message }));
    if (payload) r.write(payload);
    r.end();
  });
}

(async () => {
  const routes = [
    { method: 'GET', path: '/api/generator-v2/status' },
    { method: 'POST', path: '/api/generator-v2/reset' },
    { method: 'POST', path: '/api/generator/apply', body: { email: 'amprovip@enchant.id' } },
    { method: 'POST', path: '/api/generator-v2/apply', body: { email: 'amprovip@enchant.id' } },
    { method: 'POST', path: '/api/generator/process', body: { email: 'amprovip@enchant.id' } },
    { method: 'POST', path: '/api/generator-v2/process', body: { email: 'amprovip@enchant.id' } },
    { method: 'GET', path: '/api/user/profile' },
    { method: 'GET', path: '/api/ads/status' }
  ];

  for (const r of routes) {
    const res = await req(r.method, r.path, r.body);
    console.log(`[${res.status}] ${r.method} ${r.path}:`, res.data || res.raw || res.error);
  }
})();
