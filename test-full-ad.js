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
  const email = crypto.randomBytes(8).toString('hex') + '@zxy.com';
  const password = crypto.randomBytes(12).toString('base64') + 'A1!';

  console.log('1. Register & Login...');
  let token = await solveTurnstile();
  await req('POST', '/api/auth/register', { email, password, turnstileToken: token });
  token = await solveTurnstile();
  await req('POST', '/api/auth/login', { email, password, turnstileToken: token });

  console.log('Initial status:');
  let st = await req('GET', '/api/generator-v2/status');
  console.log(st.json);

  console.log('Watching 5 ads with 15s delay...');
  await req('POST', '/api/ads/record', { source: 'generator-v2' });
  for (let i = 1; i <= 5; i++) {
    await sleep(15500);
    let r = await req('POST', '/api/ads/record', { source: 'generator-v2' });
    console.log(`Ad ${i}:`, r.json);
  }

  console.log('Status after 5 ads:');
  st = await req('GET', '/api/generator-v2/status');
  console.log(st.json);

  console.log('Generating temp email:');
  let mail = await req('POST', '/api/temp-mail/generate', {});
  console.log(mail.json);

  if (mail.json?.emailAddress) {
    console.log('Status before select-email:');
    st = await req('GET', '/api/generator-v2/status');
    console.log(st.json);

    console.log('Selecting email:', mail.json.emailAddress);
    let sel = await req('POST', '/api/generator-v2/select-email', { emailAddress: mail.json.emailAddress });
    console.log('Select result:', sel.json);

    console.log('Status after select:');
    st = await req('GET', '/api/generator-v2/status');
    console.log(st.json);
  }
})();
