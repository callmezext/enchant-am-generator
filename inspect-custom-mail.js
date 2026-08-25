const https = require('https');
const zlib = require('zlib');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36';
const BASE = 'https://amprem.irfanjawa.com';
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

async function fetch(path) {
  return new Promise((resolve) => {
    const url = new URL(path, BASE);
    const req = https.request(url, { method: 'GET', agent, timeout: 15000, headers: { 'User-Agent': UA, 'Accept': '*/*' }}, (res) => {
      let chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let raw = Buffer.concat(chunks);
        try {
          const enc = res.headers['content-encoding'];
          if (enc === 'gzip') raw = zlib.gunzipSync(raw);
          else if (enc === 'deflate') raw = zlib.inflateSync(raw);
          else if (enc === 'br') raw = zlib.brotliDecompressSync(raw);
        } catch {}
        resolve(raw.toString('utf-8'));
      });
    });
    req.on('error', () => resolve(''));
    req.end();
  });
}

(async () => {
  const code = await fetch('/_next/static/chunks/app/dashboard/generator/page-e37740f7ec71f528.js');
  console.log('=== Length:', code.length, '===');

  // Search for fetch calls and body JSON.stringify
  const fetches = [...code.matchAll(/fetch\s*\(\s*["'`]([^"'`]+)["'`](?:\s*,\s*(\{[^}]+\}))?/g)];
  fetches.forEach(f => {
    console.log('\nFETCH:', f[0]);
  });

  // Search context around send-magic-link, verify-magic-link, apply
  const terms = ['send-magic-link', 'verify-magic-link', 'generator/apply', 'ads/status'];
  for (const t of terms) {
    let idx = 0;
    console.log(`\n=== CONTEXT: ${t} ===`);
    while ((idx = code.indexOf(t, idx)) !== -1) {
      console.log(code.slice(Math.max(0, idx - 200), Math.min(code.length, idx + 400)));
      idx += t.length;
    }
  }
})();
