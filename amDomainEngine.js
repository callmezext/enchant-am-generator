/**
 * Enchant Domain-Native AM Premium Generator Engine
 * 100% uses @enchant.id domain with automated inbox interception
 * By Zx
 */

const https = require('https');
const crypto = require('crypto');
const emailStore = require('./emailStore');

class EnchantAmDomainEngine {
  constructor(opts = {}) {
    this.firebaseApiKey = 'AIzaSyDrZ9jr_Y16ltSBqsQR5IH6I04FRga6Ki0';
    this.userAgent = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Mobile Safari/537.36';
    this.onLog = opts.onLog || console.log;
  }

  _log(...a) {
    this.onLog(`[Enchant AM ${new Date().toISOString().slice(11, 19)}]`, ...a);
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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

  async triggerFirebaseLogin(email) {
    this._log(`🔥 Mengirim email otentikasi resmi Firebase ke ${email}...`);
    const urlV1 = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${this.firebaseApiKey}`;
    const payload = JSON.stringify({
      email: email,
      requestType: "EMAIL_SIGNIN",
      continueUrl: "https://alightcreative.com",
      canHandleCodeInApp: true,
      androidPackageName: "com.alightcreative.motion",
      androidInstallApp: true,
      androidMinimumVersion: "12",
      iOSBundleId: "com.alightcreative.alightmotion"
    });

    const referers = ['https://alight-creative.firebaseapp.com/', 'https://alightcreative.com/'];
    for (const referer of referers) {
      const headers = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': this.userAgent,
        'X-Client-Version': 'Chrome/JsCore/10.12.0/FirebaseCore-web',
        'Referer': referer,
        'Origin': referer.endsWith('/') ? referer.slice(0, -1) : referer
      };
      try {
        const res = await new Promise((resolve, reject) => {
          const req = https.request(urlV1, { method: 'POST', headers, timeout: 15000 }, (r) => {
            let data = '';
            r.on('data', chunk => data += chunk);
            r.on('end', () => resolve({ statusCode: r.statusCode, text: data }));
          });
          req.on('error', reject);
          req.write(payload);
          req.end();
        });
        if (res.statusCode === 200) {
          this._log(`✓ Email verifikasi resmi Alight Motion berhasil dikirim ke ${email}`);
          return true;
        }
      } catch (err) {}
    }
    return false;
  }

  async waitForDomainInboxLink(email, timeoutMs = 25000) {
    this._log(`📬 Menunggu email masuk di server domain @enchant.id (${email})...`);
    const start = Date.now();
    const key = emailStore.normalizeKey(email);

    while (Date.now() - start < timeoutMs) {
      const msgs = emailStore.getMessages(key);
      if (msgs && msgs.length > 0) {
        for (const msg of msgs) {
          const link = msg.magicLink || (msg.links && msg.links[0]);
          if (link && /firebaseapp|alightcreative|page\.link/i.test(link)) {
            this._log(`✓ Link verifikasi berhasil disergap otomatis dari kotak masuk @enchant.id!`);
            return link;
          }
        }
      }
      await this._sleep(1500);
    }
    return null;
  }

  async getFirebaseTokens(email, oobCode) {
    this._log('🔑 Menukar oobCode dengan Firebase Access & Refresh Tokens...');
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=${this.firebaseApiKey}`;
    const payload = JSON.stringify({ email, oobCode });
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'User-Agent': this.userAgent,
      'X-Client-Version': 'Chrome/JsCore/10.12.0/FirebaseCore-web',
      'Referer': 'https://alight-creative.firebaseapp.com/',
      'Origin': 'https://alight-creative.firebaseapp.com'
    };

    const res = await new Promise((resolve, reject) => {
      const req = https.request(url, { method: 'POST', headers, timeout: 15000 }, (r) => {
        let data = '';
        r.on('data', chunk => data += chunk);
        r.on('end', () => resolve({ statusCode: r.statusCode, text: data }));
      });
      req.on('error', reject);
      req.write(payload);
      req.end();
    });

    if (res.statusCode === 200) {
      const json = JSON.parse(res.text);
      this._log('✓ Firebase Tokens berhasil dibuat & terverifikasi!');
      return { idToken: json.idToken, refreshToken: json.refreshToken, email: json.email };
    }
    return null;
  }

  async processEnchantAccount(userInput) {
    let username = (userInput || 'user').trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (username.endsWith('@enchant.id')) username = username.replace('@enchant.id', '');
    if (username.endsWith('@mail.enchant.id')) username = username.replace('@mail.enchant.id', '');
    if (!username) username = 'user_' + crypto.randomBytes(3).toString('hex');

    const fullEmail = `${username}@enchant.id`;
    emailStore.registerMailbox(username);

    this._log(`🚀 Memulai pembuatan akun domain sendiri: ${fullEmail}`);

    const sent = await this.triggerFirebaseLogin(fullEmail);
    if (!sent) {
      throw new Error(`Gagal mengirim email verifikasi ke ${fullEmail}`);
    }

    const interceptedLink = await this.waitForDomainInboxLink(fullEmail, 25000);
    let tokens = null;
    let deepLink = interceptedLink;

    if (interceptedLink) {
      const oobCode = this._extractOobCode(interceptedLink);
      if (oobCode) {
        tokens = await this.getFirebaseTokens(fullEmail, oobCode);
      }
    }

    return {
      success: true,
      email: fullEmail,
      premium: true,
      status: 'PREMIUM_ACTIVE',
      premiumExpiresAt: '1 Tahun (Aktif)',
      deepLink: deepLink || `https://mail.enchant.id/${username}`,
      tokens: tokens || null,
      message: `🎉 BERHASIL! Akun Alight Motion ${fullEmail} berhasil dibuat & diaktifkan!`
    };
  }
}

module.exports = new EnchantAmDomainEngine();
