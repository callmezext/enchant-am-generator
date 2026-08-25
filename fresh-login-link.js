const https = require('https');
const http = require('http');
const emailStore = require('./emailStore');

const TARGET = 'admin@enchant.id';
const FIREBASE_KEY = 'AIzaSyDrZ9jr_Y16ltSBqsQR5IH6I04FRga6Ki0';

const sleep = ms => new Promise(r => setTimeout(r, ms));

function sendFirebaseLink(email) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      email, requestType: "EMAIL_SIGNIN",
      continueUrl: "https://alightcreative.com",
      canHandleCodeInApp: true,
      androidPackageName: "com.alightcreative.motion",
      androidInstallApp: true, androidMinimumVersion: "12",
      iOSBundleId: "com.alightcreative.alightmotion"
    });
    const req = https.request(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'Mozilla/5.0', 'X-Client-Version': 'Chrome/JsCore/10.12.0/FirebaseCore-web',
        'Referer': 'https://alight-creative.firebaseapp.com/', 'Origin': 'https://alight-creative.firebaseapp.com'
      }
    }, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => res.statusCode === 200 ? resolve(true) : reject(new Error(d)));
    });
    req.on('error', reject); req.write(payload); req.end();
  });
}

function getInbox(email) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:3000/api/v1/mail/inbox?email=${encodeURIComponent(email)}`, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

(async () => {
  // Clear old messages
  emailStore.clearInbox(TARGET);
  
  console.log(`1. Mengirim email login resmi Alight Motion ke ${TARGET}...`);
  await sendFirebaseLink(TARGET);
  console.log('   ✓ Email terkirim!\n');

  console.log('2. Menunggu email masuk di inbox @enchant.id...');
  let link = null;
  for (let i = 0; i < 15; i++) {
    await sleep(2000);
    const inbox = await getInbox(TARGET);
    const msgs = inbox.messages || [];
    if (msgs.length > 0) {
      const msg = msgs[0];
      link = (msg.links || []).find(l => /firebaseapp|alightcreative/i.test(l));
      if (link) {
        console.log(`   ✓ Email diterima dari: ${msg.from}`);
        break;
      }
    }
  }

  if (!link) {
    console.log('   ❌ Tidak ada email masuk!');
    return;
  }

  console.log('\n═══════════════════════════════════════════════');
  console.log('📲 BUKA LINK INI DI HP KAMU (Alight Motion):');
  console.log('═══════════════════════════════════════════════');
  console.log(link);
  console.log('═══════════════════════════════════════════════');
  console.log('\nCara: Salin link di atas → Buka di browser HP');
  console.log('→ Pilih "Buka di Alight Motion"');
  console.log('→ Cek status Premium di menu Profil/Akun');
})();
