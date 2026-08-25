/**
 * Test Standard Ads Completion & Generator Apply for Custom Email
 */

const https = require('https');
const fs = require('fs');

const accounts = JSON.parse(fs.readFileSync('accounts.json', 'utf8'));
const acc = accounts[0];

function req(method, path, body = null) {
  return new Promise((resolve, reject) => {
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
        try { resolve(JSON.parse(data)); } catch { resolve(data); }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  console.log('=== 1. Checking Ads Status ===');
  let adStatus = await req('GET', '/api/ads/status');
  console.log('Initial Ads status:', adStatus);

  console.log('\n=== 2. Completing 5 Ads for Generator V1 ===');
  for (let i = 1; i <= 5; i++) {
    console.log(`Watching ad #${i}...`);
    const record = await req('POST', '/api/ads/record', {});
    console.log(`Ad #${i} record result:`, record);
    if (i < 5) {
      console.log('Waiting 15.5s interval...');
      await sleep(15500);
    }
  }

  adStatus = await req('GET', '/api/ads/status');
  console.log('\nFinal Ads status:', adStatus);

  console.log('\n=== 3. Applying Premium License to Custom Email ===');
  const apply = await req('POST', '/api/generator/apply', { email: 'amprovip@enchant.id' });
  console.log('Generator Apply Result:', JSON.stringify(apply, null, 2));
})();
