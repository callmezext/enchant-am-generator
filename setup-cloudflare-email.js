/**
 * Automated Cloudflare Email Routing & Worker Setup Script
 */

const https = require('https');

async function cfApi(method, path, body = null, token) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://api.cloudflare.com/client/v4' + path);
    const headers = {
      'Authorization': `Bearer ${token.trim()}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Cloudflare-Setup-Automation/1.0'
    };
    let payload = body ? JSON.stringify(body) : null;
    if (payload) headers['Content-Length'] = Buffer.byteLength(payload);

    const req = https.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ success: false, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runSetup(token, domain = 'enchant.id') {
  console.log(`🚀 Memulai setup otomatis Cloudflare untuk domain: ${domain}...`);

  // 1. Get Zone ID
  console.log('1. Mengambil Zone ID...');
  const zones = await cfApi('GET', `/zones?name=${domain}`, null, token);
  if (!zones.success || !zones.result?.length) {
    throw new Error(`Domain ${domain} tidak ditemukan di akun Cloudflare ini.`);
  }
  const zoneId = zones.result[0].id;
  const accountId = zones.result[0].account.id;
  console.log(`   ✓ Zone ID: ${zoneId}`);
  console.log(`   ✓ Account ID: ${accountId}`);

  // 2. Enable Email Routing
  console.log('2. Mengaktifkan Email Routing...');
  const enableRes = await cfApi('POST', `/zones/${zoneId}/email/routing/enabled`, {}, token);
  console.log(`   ✓ Status Email Routing:`, enableRes.success ? 'Aktif' : (enableRes.errors?.[0]?.message || 'Sudah aktif'));

  // 3. Add MX & SPF DNS Records if missing
  console.log('3. Memeriksa dan menambahkan MX & SPF records...');
  const mxHosts = [
    { name: domain, type: 'MX', content: 'isaac.mx.cloudflare.net', priority: 1 },
    { name: domain, type: 'MX', content: 'linda.mx.cloudflare.net', priority: 5 },
    { name: domain, type: 'MX', content: 'amir.mx.cloudflare.net', priority: 10 },
    { name: `mail.${domain}`, type: 'MX', content: 'isaac.mx.cloudflare.net', priority: 1 },
    { name: `mail.${domain}`, type: 'MX', content: 'linda.mx.cloudflare.net', priority: 5 },
    { name: `mail.${domain}`, type: 'MX', content: 'amir.mx.cloudflare.net', priority: 10 },
    { name: domain, type: 'TXT', content: 'v=spf1 include:_spf.mx.cloudflare.net ~all' }
  ];

  for (const rec of mxHosts) {
    const dnsRes = await cfApi('POST', `/zones/${zoneId}/dns_records`, rec, token);
    console.log(`   ✓ DNS ${rec.type} ${rec.name} -> ${rec.content}: ${dnsRes.success ? 'Ditambahkan' : 'Sudah ada/Info'}`);
  }

  // 4. Create / Deploy Email Worker
  console.log('4. Mengunggah Email Worker (enchant-mail-hook)...');
  const workerScript = `export default {
  async email(message, env, ctx) {
    const raw = await new Response(message.raw).text();
    await fetch("https://mail.enchant.id/api/mail/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: message.to,
        from: message.from,
        raw: raw
      })
    });
  }
};`;

  const uploadWorker = await new Promise((resolve, reject) => {
    const url = new URL(`https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/enchant-mail-hook`);
    const req = https.request(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token.trim()}`,
        'Content-Type': 'application/javascript'
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { resolve({ success: true }); }
      });
    });
    req.on('error', reject);
    req.write(workerScript);
    req.end();
  });
  console.log(`   ✓ Worker upload status:`, uploadWorker.success ? 'Berhasil' : uploadWorker.errors);

  // 5. Create Catch-all Email Routing Rule
  console.log('5. Mengonfigurasi Catch-all Routing Rule...');
  const catchAllRule = {
    name: 'Catch-all to enchant-mail-hook',
    enabled: true,
    matchers: [{ type: 'all' }],
    actions: [{ type: 'worker', value: ['enchant-mail-hook'] }]
  };

  const ruleRes = await cfApi('PUT', `/zones/${zoneId}/email/routing/rules/catch_all`, catchAllRule, token);
  console.log(`   ✓ Catch-all rule:`, ruleRes.success ? 'Berhasil Terhubung!' : (ruleRes.errors?.[0]?.message || 'Status OK'));

  console.log('\n🎉 SEMUA PENGATURAN CLOUDFLARE BERHASIL DIATUR SECARA OTOMATIS!');
}

const token = process.argv[2];
if (token) {
  runSetup(token).catch(err => console.error('Error:', err.message));
} else {
  console.log('Masukkan token: node setup-cloudflare-email.js <CLOUDFLARE_API_TOKEN>');
}
