const https = require('https');
const zlib = require('zlib');
const crypto = require('crypto');
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
  // Fetch the generator page JS
  const pageJs = await fetch('/_next/static/chunks/app/dashboard/generator-v2/page-754c7b36840163a6.js');
  
  // Find context around select-email
  console.log('=== Context around select-email ===');
  let idx = 0;
  while ((idx = pageJs.indexOf('select-email', idx)) !== -1) {
    const start = Math.max(0, idx - 300);
    const end = Math.min(pageJs.length, idx + 300);
    console.log(`\n--- at pos ${idx} ---`);
    console.log(pageJs.slice(start, end));
    idx += 12;
  }

  // Find context around temp-mail/generate
  console.log('\n\n=== Context around temp-mail/generate ===');
  idx = 0;
  while ((idx = pageJs.indexOf('temp-mail/generate', idx)) !== -1) {
    const start = Math.max(0, idx - 300);
    const end = Math.min(pageJs.length, idx + 300);
    console.log(`\n--- at pos ${idx} ---`);
    console.log(pageJs.slice(start, end));
    idx += 18;
  }

  // Find context around poll-email
  console.log('\n\n=== Context around poll-email ===');
  idx = 0;
  while ((idx = pageJs.indexOf('poll-email', idx)) !== -1) {
    const start = Math.max(0, idx - 300);
    const end = Math.min(pageJs.length, idx + 300);
    console.log(`\n--- at pos ${idx} ---`);
    console.log(pageJs.slice(start, end));
    idx += 10;
  }

  // Also find all JSON.stringify / body patterns
  console.log('\n\n=== All body: JSON.stringify patterns ===');
  const bodyMatches = [...pageJs.matchAll(/body:\s*JSON\.stringify\(([^)]{1,200})\)/g)];
  for (const m of bodyMatches) {
    console.log(`  body: JSON.stringify(${m[1]})`);
  }
  
  // Find all status endpoint calls
  console.log('\n\n=== Context around /status ===');
  idx = 0;
  while ((idx = pageJs.indexOf('generator-v2/status', idx)) !== -1) {
    const start = Math.max(0, idx - 200);
    const end = Math.min(pageJs.length, idx + 400);
    console.log(`\n--- at pos ${idx} ---`);
    console.log(pageJs.slice(start, end));
    idx += 19;
  }
})();
