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
  // Check if there are other pages like /dashboard/generator (v1)
  const dashboardHtml = await fetch('/dashboard');
  console.log('=== Dashboard HTML Links ===');
  const links = [...dashboardHtml.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
  console.log(links);

  // Check chunks in /dashboard/generator (v1 or other pages)
  const gen1 = await fetch('/dashboard/generator');
  console.log('=== /dashboard/generator (v1) ===', gen1.slice(0, 500));

  // Find all API endpoints across all chunks
  const jsChunks = [...dashboardHtml.matchAll(/\/_next\/static\/chunks\/[^"']+\.js/g)].map(m => m[0]);
  for (const chunk of jsChunks) {
    const code = await fetch(chunk);
    if (code.includes('/api/')) {
      console.log(`\nChunk: ${chunk}`);
      const apis = [...code.matchAll(/["'`](\/api\/[^"'`\s]+)["'`]/g)].map(m => m[1]);
      console.log([...new Set(apis)]);
    }
  }
})();
