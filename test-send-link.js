const https = require('https');
const zlib = require('zlib');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
const BASE = 'https://amprem.irfanjawa.com';

function req(path, body) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const payload = JSON.stringify(body);
    const r = https.request(url, {
      method: 'POST',
      agent,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Referer': `${BASE}/auth`
      }
    }, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let raw = Buffer.concat(chunks);
        try {
          const enc = res.headers['content-encoding'];
          if (enc === 'gzip') raw = zlib.gunzipSync(raw);
          else if (enc === 'deflate') raw = zlib.inflateSync(raw);
        } catch {}
        try {
          resolve({ status: res.statusCode, json: JSON.parse(raw.toString('utf8')) });
        } catch {
          resolve({ status: res.statusCode, text: raw.toString('utf8') });
        }
      });
    });
    r.on('error', e => resolve({ error: e.message }));
    r.write(payload);
    r.end();
  });
}

(async () => {
  console.log('Testing send-magic-link directly without login...');
  const res = await req('/api/auth/send-magic-link', { email: 'mantap@enchant.id' });
  console.log('Result:', res);
})();
