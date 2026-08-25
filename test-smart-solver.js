const https = require('https');
const http = require('http');
const { URL } = require('url');

class SmartSolver {
  constructor(opts = {}) {
    this.baseUrl = opts.baseUrl || 'https://amprem.irfanjawa.com';
    this.turnstileSiteKey = opts.turnstileSiteKey || '0x4AAAAAADsWLA16vNVNqTCH';
    this.cfApiKey = opts.cfApiKey || 'fgsiapi-1623d434-6d';
    this.cfApiUrl = 'https://fgsi.dpdns.org/api/tools/cfclearance/turnstile-min';
    this.theykaUrl = opts.theykaUrl || 'http://localhost:5000/turnstile';
    this.userAgent = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36';
  }

  async solve() {
    // 1. Try FongsiDev
    try {
      console.log('[Solver] Mencoba via FongsiDev API...');
      const token = await this.solveFongsiDev();
      if (token && token.length > 30) {
        console.log('[Solver] ✓ Berhasil via FongsiDev API');
        return { token, provider: 'fongsidev' };
      }
    } catch (err) {
      console.log(`[Solver] ⚠️ FongsiDev API gagal (${err.message}). Beralih otomatis ke Theyka Turnstile-Solver...`);
    }

    // 2. Fallback to Theyka Solver
    console.log('[Solver] Menyelesaikan via Theyka Turnstile-Solver...');
    const token = await this.solveTheyka();
    console.log('[Solver] ✓ Berhasil via Theyka Solver');
    return { token, provider: 'theyka' };
  }

  async solveFongsiDev() {
    const apiUrl = new URL(this.cfApiUrl);
    apiUrl.searchParams.append('apikey', this.cfApiKey);
    apiUrl.searchParams.append('url', `${this.baseUrl}/auth`);
    apiUrl.searchParams.append('sitekey', this.turnstileSiteKey);

    return new Promise((resolve, reject) => {
      const req = https.request(apiUrl, {
        method: 'GET',
        timeout: 20000,
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
            reject(new Error('Token tidak ditemukan: ' + data));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
      req.end();
    });
  }

  async solveTheyka() {
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
            reject(new Error(json.message || 'Theyka token invalid'));
          } catch (e) {
            reject(e);
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Theyka Timeout')); });
      req.write(payload);
      req.end();
    });
  }
}

(async () => {
  const solver = new SmartSolver();
  const res = await solver.solve();
  console.log('Result:', { provider: res.provider, tokenLen: res.token.length, snippet: res.token.slice(0, 35) + '...' });
})();
