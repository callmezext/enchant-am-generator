const https = require('https');
const zlib = require('zlib');
const crypto = require('crypto');
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const cookies = new Map();
const UA = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36';
const BASE = 'https://amprem.irfanjawa.com';
const agent = new https.Agent({ rejectUnauthorized: false, keepAlive: true });

function parseCookies(list) {
  (Array.isArray(list) ? list : [list]).forEach(c => {
    const [name, ...v] = c.split(';')[0].split('=');
    cookies.set(name.trim(), v.join('=').trim());
  });
}
function cookieStr() { return [...cookies.entries()].map(([k,v]) => `${k}=${v}`).join('; '); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function req(method, path, body = null) {
  const url = new URL(path, BASE);
  const headers = {
    'User-Agent': UA,
    'Accept': 'application/json, text/html, */*',
    'Accept-Encoding': 'gzip, deflate',
    'Content-Type': 'application/json',
    'Connection': 'keep-alive',
    'Referer': `${BASE}/dashboard/generator-v2`,
    'Origin': BASE,
  };
  if (cookies.size > 0) headers['Cookie'] = cookieStr();
  let payload = body ? JSON.stringify(body) : null;
  if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

  return new Promise((resolve) => {
    const r = https.request(url, { method, headers, timeout: 30000, agent }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        let raw = Buffer.concat(chunks);
        try {
          const enc = res.headers['content-encoding'];
          if (enc === 'gzip') raw = zlib.gunzipSync(raw);
          else if (enc === 'deflate') raw = zlib.inflateSync(raw);
          else if (enc === 'br') raw = zlib.brotliDecompressSync(raw);
        } catch {}
        if (res.headers['set-cookie']) parseCookies(res.headers['set-cookie']);
        let json = null;
        try { json = JSON.parse(raw.toString('utf-8')); } catch {}
        resolve({ status: res.statusCode, text: raw.toString('utf-8'), json });
      });
    });
    r.on('error', (e) => resolve({ status: 0, text: e.message, json: null }));
    if (payload) r.write(payload);
    r.end();
  });
}

async function solveTurnstile() {
  console.log('🛡️ Solving Turnstile Captcha via FongsiDev...');
  const url = new URL('https://fgsi.dpdns.org/api/tools/cfclearance/turnstile-min');
  url.searchParams.append('apikey', 'fgsiapi-1623d434-6d');
  url.searchParams.append('url', `${BASE}/auth`);
  url.searchParams.append('sitekey', '0x4AAAAAADsWLA16vNVNqTCH');
  return new Promise((resolve, reject) => {
    const r = https.request(url, { method: 'GET', timeout: 60000, agent, headers: { 'Accept': 'application/json', 'User-Agent': UA }}, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const json = JSON.parse(data);
        let token = json.result || json.token;
        if (!token && json.data) token = typeof json.data === 'string' ? json.data : json.data.token;
        resolve(token);
      });
    });
    r.on('error', reject);
    r.end();
  });
}

(async () => {
  console.log('=== 1. Login with saved account (a9d77240b61714b8@zxy.com) ===');
  let token = await solveTurnstile();
  const loginRes = await req('POST', '/api/auth/login', {
    email: 'a9d77240b61714b8@zxy.com',
    password: 'UvNxPH8j428xb3ggA1!',
    turnstileToken: token
  });
  console.log('Login Result:', loginRes.json);

  console.log('\n=== 2. Check Session Status ===');
  let st = await req('GET', '/api/generator-v2/status');
  console.log('Current Status:', st.json);

  // If stage is ads, complete the ads
  if (st.json?.session?.stage === 'ads' && (st.json?.session?.adsCompleted < 5 || (st.json?.adPoints || 0) < 1)) {
    console.log('Completing ads (15s interval)...');
    let completed = st.json?.session?.adsCompleted || 0;
    if (completed === 0) await req('POST', '/api/ads/record', { source: 'generator-v2' });

    while (completed < 5) {
      console.log(`Waiting 15.5s for ad #${completed + 1}...`);
      await sleep(15500);
      let r = await req('POST', '/api/ads/record', { source: 'generator-v2' });
      console.log('Ad response:', r.json);
      if (r.json?.success) {
        completed = r.json.count !== undefined ? r.json.count : completed + 1;
      }
      st = await req('GET', '/api/generator-v2/status');
      if (st.json?.session?.stage === 'select_email' || st.json?.session?.adsCompleted >= 5) break;
    }
  }

  console.log('\n=== 3. Generate Real Temp Email with Live MX ===');
  let mailRes = await req('POST', '/api/temp-mail/generate', {});
  console.log('Temp Mail Response:', mailRes.json);

  const realTempEmail = mailRes.json?.emailAddress;
  if (!realTempEmail) {
    console.error('Failed to generate temp email. Status:', st.json);
    return;
  }
  console.log(`✓ Real Temp Email Created: ${realTempEmail}`);

  console.log(`\n=== 4. Select Email & Trigger Real Firebase Magic Link to ${realTempEmail} ===`);
  let selRes = await req('POST', '/api/generator-v2/select-email', { emailAddress: realTempEmail });
  console.log('Select Email Result:', selRes.json);

  console.log('\n=== 5. Poll Inbox to Catch Real Firebase Email ===');
  let extractedLink = null;

  for (let i = 0; i < 30; i++) {
    await sleep(4000);
    let poll = await req('GET', '/api/generator-v2/poll-email');
    console.log(`Poll #${i+1}: stage=${poll.json?.stage}, message=${poll.json?.message}`);

    let msgRes = await req('GET', '/api/temp-mail/messages');
    let emails = msgRes.json?.emails || [];
    console.log(`  Inbox has ${emails.length} email(s)`);

    if (emails.length > 0) {
      console.log('  Email Content:', JSON.stringify(emails[0], null, 2));
    }

    let statusChk = await req('GET', '/api/generator-v2/status');
    if (statusChk.json?.session?.link2ExtractedUrl) {
      extractedLink = statusChk.json.session.link2ExtractedUrl;
      console.log('✓ Extracted Magic Link from Session:', extractedLink);
    }

    if (poll.json?.stage === 'done' || poll.json?.stage === 'wait_link_2' || statusChk.json?.session?.stage === 'done') {
      console.log('🎉 Generation Step Completed!');
      break;
    }
  }

  const finalStatus = await req('GET', '/api/generator-v2/status');
  console.log('\n========================================');
  console.log('🎉 FINAL GENERATION RESULT:');
  console.log('Email Alight Motion:', realTempEmail);
  console.log('Link Login AM:', extractedLink || finalStatus.json?.session?.link2ExtractedUrl);
  console.log('Status Session:', finalStatus.json?.session);
  console.log('========================================');
})();
