/**
 * Core AM Premium Engine (Base System)
 * With Warm Session Pool & Smart Auto-Fallback Turnstile Solver
 * By Zx
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');
const crypto = require('crypto');
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

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
    this.credentials = null;
    this.lastRequestTime = 0;
    this.v2AdsMethod = { url: '/api/ads/record', payload: { source: 'generator-v2' } };
    
    this.cfApiUrl = 'https://fgsi.dpdns.org/api/tools/cfclearance/turnstile-min';
    this.cfApiKey = config.cfApiKey || 'fgsiapi-1623d434-6d';
    this.theykaUrl = config.theykaUrl || 'http://localhost:5000/turnstile';
  }

  _log(...a) {
    if (this.debug) console.log(`[AM ${new Date().toISOString().slice(11, 19)}]`, ...a);
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  async _rateLimit() {
    const wait = 500 - (Date.now() - this.lastRequestTime);
    if (wait > 0) await this._sleep(wait);
    this.lastRequestTime = Date.now();
  }

  _parseCookies(list) {
    (Array.isArray(list) ? list : [list]).forEach(c => {
      const [name, ...v] = c.split(';')[0].split('=');
      this.cookies.set(name.trim(), v.join('=').trim());
    });
  }

  _cookieStr() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  _randEmail() { return crypto.randomBytes(8).toString('hex') + '@zxy.com'; }
  _randPass() { return crypto.randomBytes(12).toString('base64') + 'A1!'; }

  async _request(method, pathStr, body = null, options = {}) {
    await this._rateLimit();
    const url = new URL(pathStr, this.baseUrl);
    const headers = {
      'User-Agent': this.userAgent,
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
      'Referer': options.referer || `${this.baseUrl}/dashboard-v2`,
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
          this._log(`${method} ${pathStr} → ${res.statusCode} ${json?.message || json?.error || ''}`);
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
    try {
      this._log('🛡️ Mencoba Turnstile via FongsiDev API...');
      const token = await this._solveFongsiDev();
      if (token && typeof token === 'string' && token.length > 30) {
        this._log(`✓ Turnstile solved via FongsiDev (${token.length} chars)`);
        return token;
      }
    } catch (e) {
      this._log(`⚠️ FongsiDev gagal (${e.message}). Otomatis beralih ke Theyka Turnstile-Solver...`);
    }

    this._log('⚡ Menyelesaikan Turnstile via Theyka Turnstile-Solver...');
    const token = await this._solveTheyka();
    this._log(`✓ Turnstile solved via Theyka (${token.length} chars)`);
    return token;
  }

  async _solveFongsiDev() {
    const apiUrl = new URL(this.cfApiUrl);
    apiUrl.searchParams.append('apikey', this.cfApiKey);
    apiUrl.searchParams.append('url', `${this.baseUrl}/auth`);
    apiUrl.searchParams.append('sitekey', this.turnstileSiteKey);

    return new Promise((resolve, reject) => {
      const req = https.request(apiUrl, {
        method: 'GET',
        timeout: 15000,
        headers: { 'Accept': 'application/json', 'User-Agent': this.userAgent }
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.status === false || json.error || (json.message && /limit|expired/i.test(json.message))) {
              return reject(new Error(json.message || 'API limit habis'));
            }
            let token = json.result || json.token || json.response || json.cf_turnstile_response;
            if (!token && json.data) {
              if (typeof json.data === 'string') token = json.data;
              else if (typeof json.data === 'object' && json.data.token) token = json.data.token;
            }
            if (token && typeof token === 'string' && token.length > 30) {
              return resolve(token);
            }
            reject(new Error('Token tidak valid: ' + data));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout FongsiDev')); });
      req.end();
    });
  }

  async _solveTheyka() {
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
        timeout: 45000
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            let token = json.token || json.value || json.turnstile_value || json.result;
            if (token && typeof token === 'string' && token.length > 30) {
              return resolve(token);
            }
            reject(new Error(json.message || 'Format respon Theyka invalid'));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout Theyka')); });
      req.write(payload);
      req.end();
    });
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
        this._log('✓ Menggunakan sesi login tersimpan (Instan)');
        return true;
      }
      this.cookies.clear();
    }

    this._log(`🔑 Login generator: ${this.credentials.email}`);
    const token = await this.solveTurnstile();
    const res = await this._post('/api/auth/login', { ...this.credentials, turnstileToken: token }, { allowFail: true, referer: `${this.baseUrl}/auth` });
    if (!res.ok || !res.json?.success) throw new Error(res.json?.error || 'Login failed');
    this._log('✓ Berhasil login generator');
    return true;
  }

  async ensureReady() {
    const st = await this._get('/api/generator-v2/status', { allowFail: true, silent: true });
    let count = st?.json?.session?.adsCompleted || 0;
    let points = st?.json?.adPoints || 0;

    if (count >= 5 || points >= 1) return true;

    this._log('🎯 Menyiapkan poin generasi...');
    for (let i = 0; i < 15; i++) {
      const res = await this._post(this.v2AdsMethod.url, this.v2AdsMethod.payload, { allowFail: true, silent: true });
      if (res.ok && res.json?.success) {
        count = res.json.count !== undefined ? res.json.count : count + 1;
        if (count >= 5) break;
        await this._sleep(15500);
      } else {
        await this._sleep(4000);
      }
    }
    return true;
  }
}

module.exports = GenerateAmPremAkun;
