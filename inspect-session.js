const https = require('https');
const zlib = require('zlib');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36';
const BASE = 'https://amprem.irfanjawa.com';

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
  const pageJs = await fetch('/_next/static/chunks/app/dashboard/generator-v2/page-754c7b36840163a6.js');
  
  // Find "Sesi generator belum dimulai" or other error strings
  const searchTerms = ['Sesi generator', 'generator-v2/start', 'generator-v2/init', 'generator-v2/session', 'action:', 'stage'];
  for (const term of searchTerms) {
    let idx = 0;
    console.log(`\n=== SEARCH: ${term} ===`);
    while ((idx = pageJs.indexOf(term, idx)) !== -1) {
      console.log(pageJs.slice(Math.max(0, idx - 150), Math.min(pageJs.length, idx + 200)));
      idx += term.length;
    }
  }

  // Find all endpoints in pageJs
  console.log('\n=== ALL FETCH CALLS IN PAGE JS ===');
  const fetches = [...pageJs.matchAll(/fetch\s*\(\s*["'`]([^"'`]+)["'`](?:\s*,\s*(\{[^}]+\}))?/g)];
  fetches.forEach(f => console.log(f[0]));
})();
