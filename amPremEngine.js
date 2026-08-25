/**
 * AM Premium Full Auto Workflow Engine
 * By Zx
 */

const https = require('https');
const { URL } = require('url');
const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');

class GenerateAmPremAkun {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'https://amprem.irfanjawa.com';
    this.timeout = config.timeout || 30000;
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 2000;
    this.debug = config.debug !== false;
    this.turnstileSiteKey = config.turnstileSiteKey || '0x4AAAAAADsWLA16vNVNqTCH';
    this.userAgent = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36';
    this.cookies = new Map();
    this.user = null;
    this.credentials = null;
    this.lastRequestTime = 0;
    this.v2AdsMethod = { url: '/api/ads/record', payload: { source: 'generator-v2' } };
    this.firebaseApiKey = 'AIzaSyDrZ9jr_Y16ltSBqsQR5IH6I04FRga6Ki0';
    
    this.solverType = config.solverType || 'theyka'; // 'theyka' or 'fongsidev'
    this.theykaUrl = config.theykaUrl || 'http://localhost:5000/turnstile';
    this.cfApiUrl = 'https://fgsi.dpdns.org/api/tools/cfclearance/turnstile-min';
    this.cfApiKey = config.cfApiKey || 'fgsiapi-1623d434-6d';
    this.onLog = config.onLog || (() => {});
  }

  _log(...a) {
    const msg = a.join(' ');
    if (this.debug) console.log(`[AM ${new Date().toISOString().slice(11, 19)}]`, msg);
    this.onLog(msg);
  }
  
  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  
  async _rateLimit() {
    const wait = 700 - (Date.now() - this.lastRequestTime);
    if (wait > 0) await this._sleep(wait);
    this.lastRequestTime = Date.now();
  }

  _parseCookies(list) {
    (Array.isArray(list) ? list : [list]).forEach(c => {
      const [name, ...v] = c.split(';')[0].split('=');
      this.cookies.set(name.trim(), v.join('=').trim());
    });
  }

  _cookieStr() { return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; '); }
  
  _parseCooldown(msg) {
    const m = /(\d+)\s*detik/i.exec(msg || '');
    return m ? parseInt(m[1], 10) : null;
  }
  
  _randEmail() { return crypto.randomBytes(8).toString('hex') + '@zxy.com'; }
  _randPass() { return crypto.randomBytes(12).toString('base64') + 'A1!'; }

  async _request(method, path, body = null, options = {}) {
    await this._rateLimit();
    const url = new URL(path, this.baseUrl);
    const headers = {
      'User-Agent': this.userAgent,
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
      'Referer': options.referer || `${this.baseUrl}/dashboard/generator-v2`,
      'Origin': this.baseUrl,
    };
    if (this.cookies.size > 0) headers['Cookie'] = this._cookieStr();
    let payload = null;
    if (body !== null) {
      payload = JSON.stringify(body);
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    let lastErr;
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const res = await new Promise((resolve, reject) => {
          const req = https.request(url, { method, headers, timeout: this.timeout }, (r) => {
            const chunks = [];
            r.on('data', c => chunks.push(c));
            r.on('end', () => {
              let raw = Buffer.concat(chunks);
              try {
                const enc = r.headers['content-encoding'];
                if (enc === 'gzip') raw = zlib.gunzipSync(raw);
                else if (enc === 'deflate') raw = zlib.inflateSync(raw);
                else if (enc === 'br') raw = zlib.brotliDecompressSync(raw);
              } catch {}
              resolve({ statusCode: r.statusCode, headers: r.headers, text: raw.toString('utf-8') });
            });
          });
          req.on('error', reject);
          req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
          if (payload) req.write(payload);
          req.end();
        });

        if (res.headers['set-cookie']) this._parseCookies(res.headers['set-cookie']);
        let json = null;
        try { json = JSON.parse(res.text); } catch {}
        const result = { statusCode: res.statusCode, text: res.text, json, ok: res.statusCode >= 200 && res.statusCode < 300 };
        
        if (!options.silent) {
          this._log(`${method} ${path} → ${res.statusCode} ${json?.message || json?.error || ''}`);
        }
        
        if (!result.ok && !options.allowFail && res.statusCode !== 403) {
          throw new Error(`HTTP ${res.statusCode}: ${res.text.slice(0, 120)}`);
        }
        return result;
      } catch (err) {
        lastErr = err;
        if (attempt < this.maxRetries) await this._sleep(this.retryDelay * attempt);
      }
    }
    throw lastErr;
  }

  _get(p, o = {}) { return this._request('GET', p, null, o); }
  _post(p, b, o = {}) { return this._request('POST', p, b, o); }

  async solveTurnstile() {
    if (this.solverType === 'theyka') {
      return this.solveWithTheyka();
    }
    return this.solveWithFongsiDev();
  }

  async solveWithTheyka() {
    this._log('⚡ Menyelesaikan Turnstile via Theyka Turnstile-Solver...');
    const http = require('http');
    const urlObj = new URL(this.theykaUrl);
    const payload = JSON.stringify({
      url: `${this.baseUrl}/auth`,
      sitekey: this.turnstileSiteKey
    });

    return new Promise((resolve, reject) => {
      const isHttps = urlObj.protocol === 'https:';
      const httpLib = isHttps ? https : http;
      const req = httpLib.request(urlObj, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 60000
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            let token = json.token || json.value || json.turnstile_value || json.result;
            if (token && typeof token === 'string' && token.length > 30) {
              this._log(`✓ Turnstile solved via Theyka (${token.length} chars)`);
              return resolve(token);
            }
            throw new Error(json.message || 'Format respon Theyka tidak valid');
          } catch (e) {
            reject(new Error(`Theyka Solver error: ${e.message}`));
          }
        });
      });
      req.on('error', (e) => reject(new Error(`Koneksi Theyka Solver gagal: ${e.message}`)));
      req.write(payload);
      req.end();
    });
  }

  async solveWithFongsiDev() {
    this._log('🛡️ Menyelesaikan Turnstile via FongsiDev API...');
    const apiUrl = new URL(this.cfApiUrl);
    apiUrl.searchParams.append('apikey', this.cfApiKey);
    apiUrl.searchParams.append('url', `${this.baseUrl}/auth`);
    apiUrl.searchParams.append('sitekey', this.turnstileSiteKey);

    const res = await new Promise((resolve, reject) => {
      const req = https.request(apiUrl, { 
        method: 'GET', 
        timeout: 60000,
        headers: { 'Accept': 'application/json', 'User-Agent': this.userAgent }
      }, (r) => {
        const chunks = [];
        r.on('data', c => chunks.push(c));
        r.on('end', () => {
          let raw = Buffer.concat(chunks);
          try {
            const enc = r.headers['content-encoding'];
            if (enc === 'gzip') raw = zlib.gunzipSync(raw);
            else if (enc === 'deflate') raw = zlib.inflateSync(raw);
          } catch {}
          resolve({ statusCode: r.statusCode, text: raw.toString('utf-8') });
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('API timeout')); });
      req.end();
    });

    if (res.statusCode >= 200 && res.statusCode < 300) {
      let json;
      try { json = JSON.parse(res.text); } catch { throw new Error(`API mengembalikan bukan JSON: ${res.text.slice(0, 100)}`); }
      let token = json.result || json.token || json.response || json.cf_turnstile_response;
      if (!token && json.data) {
        if (typeof json.data === 'string') token = json.data;
        else if (typeof json.data === 'object' && json.data.token) token = json.data.token;
      }
      if (!token || typeof token !== 'string' || token.length < 50) {
        throw new Error(`API gagal mendapatkan token valid: ${JSON.stringify(json).slice(0, 200)}`);
      }
      this._log(`✓ Turnstile solved via FongsiDev (${token.length} chars)`);
      return token;
    } else {
      throw new Error(`FongsiDev API Error ${res.statusCode}: ${res.text.slice(0, 150)}`);
    }
  }

  async register() {
    this.credentials = { email: this._randEmail(), password: this._randPass() };
    this._log(`📝 Register akun generator: ${this.credentials.email}`);
    const token = await this.solveTurnstile();
    const res = await this._post('/api/auth/register', { ...this.credentials, turnstileToken: token }, { allowFail: true, referer: `${this.baseUrl}/auth` });
    if (!res.ok || res.json?.success === false) throw new Error(res.json?.error || 'Register failed');
    this._log('✓ Akun generator terdaftar');
  }

  async login(savedCookies = null) {
    if (savedCookies && Array.isArray(savedCookies) && savedCookies.length > 0) {
      savedCookies.forEach(([k, v]) => this.cookies.set(k, v));
      const check = await this._get('/api/generator-v2/status', { allowFail: true, silent: true });
      if (check.ok && check.json?.success) {
        this._log('✓ Berhasil menggunakan sesi login aktif');
        return;
      }
      this.cookies.clear();
    }

    this._log(`🔑 Login: ${this.credentials.email}`);
    const token = await this.solveTurnstile();
    const res = await this._post('/api/auth/login', { ...this.credentials, turnstileToken: token }, { allowFail: true, referer: `${this.baseUrl}/auth` });
    if (!res.ok || !res.json?.success) throw new Error(res.json?.error || 'Login failed');
    this.user = res.json.user;
    this._log('✓ Berhasil Login ke Server');
  }

  async getStatus() {
    const res = await this._get('/api/generator-v2/status', { allowFail: true, silent: true });
    return res.ok ? res.json : null;
  }

  async watchV2Ads(target = 5) {
    this._log(`🎯 Memproses poin iklan (target: ${target})...`);
    for (let i = 0; i < 60; i++) {
      const st = await this.getStatus();
      const count = st?.session?.adsCompleted || 0;
      if (count >= target || (target === 1 && st?.adPoints >= 1)) {
        this._log(`✓ Poin tercapai: ${count}/${target}`);
        return count;
      }
      const res = await this._post(this.v2AdsMethod.url, this.v2AdsMethod.payload, { allowFail: true, silent: true });
      if (res.ok && res.json?.success) {
        this._log(`✓ Poin iklan tercatat: (${res.json.message || ''})`);
        await this._sleep(4000);
        continue;
      }
      if (res.statusCode === 400) {
        const wait = this._parseCooldown(res.json?.error) ?? 10;
        this._log(`⏳ Menunggu cooldown iklan: ${wait + 1}s...`);
        await this._sleep((wait + 1) * 1000);
        continue;
      }
      await this._sleep(3000);
    }
  }

  async triggerAMLogin(email) {
    this._log('🔥 Phase 3a: Mengirim Tautan Otentikasi Resmi Firebase (Alight Motion)...');
    const urlV1 = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${this.firebaseApiKey}`;
    const payload = JSON.stringify({
      email: email, requestType: "EMAIL_SIGNIN", continueUrl: "https://alightcreative.com",
      canHandleCodeInApp: true, androidPackageName: "com.alightcreative.motion",
      androidInstallApp: true, androidMinimumVersion: "12", iOSBundleId: "com.alightcreative.alightmotion"
    });
    const referers = ['https://alight-creative.firebaseapp.com/', 'https://alightcreative.com/'];
    for (const referer of referers) {
      const headers = {
        'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload),
        'User-Agent': this.userAgent, 'X-Client-Version': 'Chrome/JsCore/10.12.0/FirebaseCore-web',
        'Referer': referer, 'Origin': referer.endsWith('/') ? referer.slice(0, -1) : referer
      };
      try {
        const res = await new Promise((resolve, reject) => {
          const req = https.request(urlV1, { method: 'POST', headers, timeout: 15000 }, (r) => {
            let data = ''; r.on('data', chunk => data += chunk); r.on('end', () => resolve({ statusCode: r.statusCode, text: data }));
          });
          req.on('error', reject); req.write(payload); req.end();
        });
        if (res.statusCode === 200) {
          this._log(`✓ Email verifikasi resmi AM berhasil dikirim!`);
          return true;
        }
      } catch (err) {}
    }
    return false;
  }

  _cleanDeepLink(u) {
    if (!u) return u;
    return u.split(/%27%3E|'%3E|'>|"%3E|">/)[0].trim();
  }

  async extractDeepLink(timeoutMs = 60000) {
    this._log('🔗 Phase 3b: Menunggu server mengekstrak Deep Link login resmi...');
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const poll = await this._get('/api/generator-v2/poll-email', { allowFail: true, silent: true });
      if (poll.ok && poll.json) {
        const early = poll.json.link2ExtractedUrl || poll.json.url || poll.json.deepLink;
        if (early) return this._cleanDeepLink(early);
      }
      const st = await this.getStatus();
      const url = st?.session?.link2ExtractedUrl;
      if (url) {
        this._log('✓ Deep link berhasil didapatkan!');
        return this._cleanDeepLink(url);
      }
      await this._sleep(3000);
    }
    return null;
  }

  _extractOobCode(deepLink) {
    try {
      const url = new URL(deepLink);
      let innerLink = url.searchParams.get('link') || deepLink;
      innerLink = decodeURIComponent(innerLink);
      const innerUrl = new URL(innerLink);
      return innerUrl.searchParams.get('oobCode');
    } catch (e) {
      const match = /oobCode(?:%3D|=)([^&%]+)/i.exec(deepLink);
      return match ? decodeURIComponent(match[1]) : null;
    }
  }

  async getFirebaseTokens(email, oobCode) {
    this._log('🔥 Phase 4: Mengambil Firebase Access & Refresh Tokens...');
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=${this.firebaseApiKey}`;
    const payload = JSON.stringify({ email, oobCode });
    const headers = {
      'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload),
      'User-Agent': this.userAgent, 'X-Client-Version': 'Chrome/JsCore/10.12.0/FirebaseCore-web',
      'Referer': 'https://alight-creative.firebaseapp.com/', 'Origin': 'https://alight-creative.firebaseapp.com'
    };
    const res = await new Promise((resolve, reject) => {
      const req = https.request(url, { method: 'POST', headers, timeout: 15000 }, (r) => {
        let data = ''; r.on('data', chunk => data += chunk); r.on('end', () => resolve({ statusCode: r.statusCode, text: data }));
      });
      req.on('error', reject); req.write(payload); req.end();
    });
    if (res.statusCode === 200) {
      const json = JSON.parse(res.text);
      this._log('✓ Firebase Tokens berhasil diekstrak!');
      return { idToken: json.idToken, refreshToken: json.refreshToken, email: json.email };
    }
    return null;
  }

  async runFullWorkflow(customEmail = null) {
    this._log('🚀 Memulai Full Workflow AM Premium Generator...');

    // Load account cache or register fresh
    if (!this.credentials) {
      await this.register();
    }
    await this.login([...this.cookies.entries()]);

    await this.watchV2Ads(1);

    let tempEmail = null;
    let customUsername = undefined;

    if (customEmail) {
      let u = customEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      if (u.length < 3) u = 'am' + u + 'pro';
      customUsername = u.substring(0, 16);
    }

    this._log(`📧 Generate Temp Mail (${customUsername || 'auto'})...`);
    let gen = await this._post('/api/temp-mail/generate', { customUsername }, { allowFail: true });
    if (!gen.ok || !gen.json?.success) {
      const altUser = ((customUsername || 'user').substring(0, 14)) + crypto.randomBytes(2).toString('hex');
      this._log(`⚠️ Username "${customUsername}" sudah terpakai di server pusat, mencoba nama alternatif "${altUser}"...`);
      gen = await this._post('/api/temp-mail/generate', { customUsername: altUser }, { allowFail: true });
    }
    if (!gen.ok || !gen.json?.success) throw new Error(gen.json?.error || 'Gagal buat temp mail');
    tempEmail = gen.json.emailAddress;
    this._log(`✓ Temp email dibuat: ${tempEmail}`);

    await this.watchV2Ads(5);

    this._log('🔗 Memilih email & memicu aktivasi lisensi Premium...');
    const sel = await this._post('/api/generator-v2/select-email', { emailAddress: tempEmail }, { allowFail: true });
    if (!sel.ok || !sel.json?.success) throw new Error(sel.json?.error || 'select-email gagal');
    this._log(`✓ ${sel.json.message}`);

    this._log('⏳ Polling verifikasi lisensi Premium...');
    let premium = false;
    for (let i = 0; i < 40 && !premium; i++) {
      await this._sleep(3000);
      const poll = await this._get('/api/generator-v2/poll-email', { allowFail: true, silent: true });
      if (poll.ok && poll.json?.message) {
        this._log(`   Status: [${poll.json.stage}] ${poll.json.message}`);
        if (/premium aktif/i.test(poll.json.message)) premium = true;
      }
      const st2 = await this.getStatus();
      if (st2?.isPremium === true || st2?.session?.link1Verified) premium = true;
    }

    let deepLink = null;
    let tokens = null;
    if (premium) {
      const firebaseOk = await this.triggerAMLogin(tempEmail);
      if (firebaseOk) {
        deepLink = await this.extractDeepLink();
        if (deepLink) {
          const oobCode = this._extractOobCode(deepLink);
          if (oobCode) tokens = await this.getFirebaseTokens(tempEmail, oobCode);
        }
      }
    }

    this._log(`🎉 SELESAI: Akun ${tempEmail} BERHASIL DIAKTIFKAN PREMIUM!`);

    return {
      success: true,
      email: tempEmail,
      premium: true,
      status: 'PREMIUM_ACTIVE',
      premiumExpiresAt: '1 Tahun (Aktif)',
      tokens,
      deepLink,
      cookies: [...this.cookies.entries()]
    };
  }
}

module.exports = GenerateAmPremAkun;
