const https = require('https');

function arkanaReq(method, path, body) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'arkanastudio.xyz',
      path: path,
      method: method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Content-Type': 'application/json',
        'Origin': 'https://arkanastudio.xyz',
        'Referer': 'https://arkanastudio.xyz/',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    };
    const req = https.request(opts, (res) => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, raw: d.substring(0, 500) }); }
      });
    });
    req.on('error', e => resolve({ error: e.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  console.log('=== Testing arkanastudio.xyz API endpoints ===\n');

  // Step 1: Generate job
  console.log('1. POST /api/generate...');
  const gen = await arkanaReq('POST', '/api/generate', { email: 'admin@enchant.id', mode: 'CUSTOM_EMAIL' });
  console.log('   Status:', gen.status);
  console.log('   Response:', JSON.stringify(gen.json || gen.raw, null, 2));

  const jobId = gen.json?.id;
  if (!jobId) { console.log('No job ID!'); return; }

  // Step 2: Poll /api/jobs
  console.log('\n2. GET /api/jobs...');
  const jobs = await arkanaReq('GET', '/api/jobs');
  console.log('   Status:', jobs.status);
  console.log('   Response:', JSON.stringify(jobs.json || jobs.raw, null, 2));

  // The latest magic link from our inbox
  const latestLink = 'https://alight-creative.firebaseapp.com/__/auth/links?link=https://alightcreative.com/auth_action/?apiKey%3DAIzaSyDrZ9jr_Y16ltSBqsQR5IH6I04FRga6Ki0%26mode%3DsignIn%26oobCode%3DDsF6HRPFOESndBpOdwZKIrA3Br7rn20_b5462U8EtEkAAAGgJtujkg%26continueUrl%3Dhttps://alightcreative.com?ui_sid%253D0366624874%2526ui_sd%253D0%26lang%3Den';

  // Try various verify endpoints
  const endpoints = [
    ['POST', '/api/verify', { id: jobId, link: latestLink }],
    ['POST', '/api/confirm', { id: jobId, link: latestLink }],
    ['POST', '/api/submit-link', { id: jobId, link: latestLink }],
    ['PATCH', '/api/jobs', { id: jobId, link: latestLink }],
    ['POST', '/api/generate/verify', { id: jobId, link: latestLink }],
    ['POST', '/api/activate', { id: jobId, link: latestLink }],
    ['POST', '/api/complete', { id: jobId, link: latestLink }],
    ['POST', '/api/link', { id: jobId, link: latestLink }],
    ['PUT', '/api/generate', { id: jobId, link: latestLink }],
    ['POST', '/api/verify-link', { id: jobId, link: latestLink }],
  ];

  for (const [method, path, body] of endpoints) {
    const res = await arkanaReq(method, path, body);
    if (res.status !== 404 && res.status !== 405) {
      console.log(`\n** HIT ** ${method} ${path}`);
      console.log('   Status:', res.status);
      console.log('   Response:', JSON.stringify(res.json || res.raw, null, 2));
    } else {
      console.log(`   ${method} ${path} -> ${res.status}`);
    }
  }
})();
