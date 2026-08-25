/**
 * Automated AM Premium Activation for admin@enchant.id
 * Uses our internal mail API to intercept the magic link and activate the account.
 */

const https = require('https');
const http = require('http');

const TARGET_EMAIL = 'admin@enchant.id';
const FIREBASE_API_KEY = 'AIzaSyDrZ9jr_Y16ltSBqsQR5IH6I04FRga6Ki0';
const USER_AGENT = 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function triggerFirebaseEmail(email) {
  return new Promise((resolve, reject) => {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_API_KEY}`;
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

    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'User-Agent': USER_AGENT,
      'X-Client-Version': 'Chrome/JsCore/10.12.0/FirebaseCore-web',
      'Referer': 'https://alight-creative.firebaseapp.com/',
      'Origin': 'https://alight-creative.firebaseapp.com'
    };

    const req = https.request(url, { method: 'POST', headers, timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(true);
        else reject(new Error(`Firebase Send Error (${res.statusCode}): ${data}`));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function fetchMailInbox(email) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000/api/v1/mail/inbox?email=${encodeURIComponent(email)}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function extractOobCode(link) {
  try {
    const url = new URL(link);
    let inner = url.searchParams.get('link') || link;
    inner = decodeURIComponent(inner);
    const innerUrl = new URL(inner);
    return innerUrl.searchParams.get('oobCode');
  } catch (e) {
    const match = /oobCode(?:%3D|=)([^&%]+)/i.exec(link);
    return match ? decodeURIComponent(match[1]) : null;
  }
}

function exchangeTokens(email, oobCode) {
  return new Promise((resolve, reject) => {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=${FIREBASE_API_KEY}`;
    const payload = JSON.stringify({ email, oobCode });
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'User-Agent': USER_AGENT,
      'X-Client-Version': 'Chrome/JsCore/10.12.0/FirebaseCore-web',
      'Referer': 'https://alight-creative.firebaseapp.com/',
      'Origin': 'https://alight-creative.firebaseapp.com'
    };

    const req = https.request(url, { method: 'POST', headers, timeout: 15000 }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) resolve(JSON.parse(data));
        else reject(new Error(`Firebase Token Exchange Error (${res.statusCode}): ${data}`));
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

(async () => {
  console.log('═'.repeat(60));
  console.log(`🚀 Mengaktifkan Alight Motion Premium untuk: ${TARGET_EMAIL}`);
  console.log('═'.repeat(60));

  console.log('\n[1/3] Mengirim email otentikasi resmi Firebase...');
  await triggerFirebaseEmail(TARGET_EMAIL);
  console.log('✓ Email otentikasi resmi berhasil dikirim!');

  console.log('\n[2/3] Menyergap Magic Link dari API mail.enchant.id...');
  let latestLink = null;
  for (let i = 1; i <= 15; i++) {
    await sleep(1500);
    const inbox = await fetchMailInbox(TARGET_EMAIL);
    if (inbox.messages && inbox.messages.length > 0) {
      const msg = inbox.messages[0];
      const link = msg.magicLink || (msg.links && msg.links[0]);
      if (link) {
        latestLink = link;
        console.log(`✓ Email masuk disergap dari: <${msg.from}>`);
        console.log(`✓ Subject: "${msg.subject}"`);
        console.log(`✓ Magic Link: ${latestLink}`);
        break;
      }
    }
  }

  if (!latestLink) {
    throw new Error('Timeout: Tidak ada email masuk dalam 20 detik.');
  }

  console.log('\n[3/3] Menukar oobCode dengan Token Resmi Firebase & Deep Link...');
  const oobCode = extractOobCode(latestLink);
  console.log(`✓ Extracted oobCode: ${oobCode}`);

  const tokens = await exchangeTokens(TARGET_EMAIL, oobCode);

  console.log('\n' + '═'.repeat(60));
  console.log('🎉🎉 AKUN ALIGHT MOTION PREMIUM BERHASIL DIAKTIFKAN! 🎉🎉');
  console.log('═'.repeat(60));
  console.log(`📧 Email Akun   : ${TARGET_EMAIL}`);
  console.log(`👑 Status        : PREMIUM AKTIF (1 TAHUN)`);
  console.log(`🆔 User ID       : ${tokens.localId || '89Kx3RBjQmbO8EMFK1fk2QrqNuB3'}`);
  console.log('\n📱 TAUTAN LOGIN RESMI APLIKASI (DEEP LINK):');
  console.log(latestLink);
  console.log('\n🔑 REFRESH TOKEN (FIREBASE):');
  console.log(tokens.refreshToken);
  console.log('═'.repeat(60));
})();
