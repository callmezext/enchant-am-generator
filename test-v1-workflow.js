const https = require('https');
const crypto = require('crypto');

class AmTester {
  constructor() {
    this.cookies = new Map();
    this.baseUrl = 'https://amprem.irfanjawa.com';
    this.theykaUrl = 'http://localhost:5000/turnstile';
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  
  _parseCookies(list) {
    (Array.isArray(list) ? list : [list]).forEach(c => {
      const [name, ...v] = c.split(';')[0].split('=');
      this.cookies.set(name.trim(), v.join('=').trim());
    });
  }

  _cookieStr() { return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; '); }

  async req(method, path, body = null) {
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(body) : null;
      const r = https.request(`https://amprem.irfanjawa.com${path}`, {
        method,
        headers: {
          'Cookie': this._cookieStr(),
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://amprem.irfanjawa.com/dashboard',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      }, (res) => {
        if (res.headers['set-cookie']) this._parseCookies(res.headers['set-cookie']);
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, json: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, raw: data.substring(0, 100) }); }
        });
      });
      r.on('error', reject);
      if (payload) r.write(payload);
      r.end();
    });
  }

  async solveTheyka() {
    const http = require('http');
    const payload = JSON.stringify({
      url: 'https://amprem.irfanjawa.com/auth',
      sitekey: '0x4AAAAAADsWLA16vNVNqTCH'
    });
    return new Promise((resolve, reject) => {
      const req = http.request('http://localhost:5000/turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          const j = JSON.parse(data);
          resolve(j.token || j.result);
        });
      });
      req.write(payload);
      req.end();
    });
  }

  async run() {
    console.log('1. Register & Login...');
    const email = crypto.randomBytes(8).toString('hex') + '@zxy.com';
    const password = crypto.randomBytes(12).toString('base64') + 'A1!';
    const token = await this.solveTheyka();
    await this.req('POST', '/api/auth/register', { email, password, turnstileToken: token });
    const logRes = await this.req('POST', '/api/auth/login', { email, password, turnstileToken: token });
    console.log('Logged in:', logRes);

    console.log('2. Watch 5 standard V1 ads...');
    for (let i = 1; i <= 5; i++) {
      const ad = await this.req('POST', '/api/ads/record', {});
      console.log(`Ad #${i}:`, ad);
      if (i < 5) await this._sleep(15500);
    }

    const st = await this.req('GET', '/api/ads/status');
    console.log('Ads status:', st);

    console.log('3. Test Apply V1 to admin@enchant.id:');
    const app = await this.req('POST', '/api/generator/apply', { email: 'admin@enchant.id' });
    console.log('Apply result:', app);
  }
}

new AmTester().run();
