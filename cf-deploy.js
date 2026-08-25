const https = require('https');

const TOKEN = 'YOUR_CLOUDFLARE_TOKEN';
const ZONE_ID = 'cd8976dfd57a17ce748306497a8698a7';
const ACCOUNT_ID = '8dd85180d0eb0a0cc7ae4726f9480468';

function api(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL('https://api.cloudflare.com/client/v4' + path);
    const h = {
      'Authorization': `Bearer ${TOKEN}`,
      'User-Agent': 'Cloudflare-Setup/1.0',
      ...headers
    };
    let payload = null;
    if (body && typeof body === 'object' && !Buffer.isBuffer(body)) {
      payload = JSON.stringify(body);
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = Buffer.byteLength(payload);
    } else if (Buffer.isBuffer(body)) {
      payload = body;
    }

    const req = https.request(url, { method, headers: h }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, raw: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  console.log('=== 1. Checking Email Routing Status ===');
  const erStatus = await api('GET', `/zones/${ZONE_ID}/email/routing`);
  console.log('Email routing status:', erStatus);

  if (!erStatus.data?.result?.enabled) {
    console.log('Enabling email routing...');
    const en = await api('POST', `/zones/${ZONE_ID}/email/routing/enable`);
    console.log('Enable result:', en);
  }

  console.log('\n=== 2. Uploading ES Module Email Worker (Multipart) ===');
  const boundary = '----CloudflareWorkerBoundary' + Date.now();
  const workerCode = `export default {
  async email(message, env, ctx) {
    try {
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
    } catch (e) {
      console.error("Error forwarding email:", e.message);
    }
  }
};`;

  const metadata = JSON.stringify({
    main_module: 'worker.js',
    compatibility_date: '2024-01-01',
    compatibility_flags: ['nodejs_compat']
  });

  const bodyParts = [
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="metadata"\r\n`,
    `Content-Type: application/json\r\n\r\n`,
    `${metadata}\r\n`,
    `--${boundary}\r\n`,
    `Content-Disposition: form-data; name="worker.js"; filename="worker.js"\r\n`,
    `Content-Type: application/javascript+module\r\n\r\n`,
    `${workerCode}\r\n`,
    `--${boundary}--\r\n`
  ];

  const multipartBuffer = Buffer.from(bodyParts.join(''));

  const uploadRes = await api(
    'PUT',
    `/accounts/${ACCOUNT_ID}/workers/scripts/enchant-mail-hook`,
    multipartBuffer,
    {
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
      'Content-Length': multipartBuffer.length
    }
  );
  console.log('Worker upload result:', JSON.stringify(uploadRes.data, null, 2));

  console.log('\n=== 3. Listing Current Email Routing Rules ===');
  const rules = await api('GET', `/zones/${ZONE_ID}/email/routing/rules`);
  console.log('Existing rules:', JSON.stringify(rules.data, null, 2));

  console.log('\n=== 4. Setting Catch-All Routing Rule ===');
  const catchAll = await api('GET', `/zones/${ZONE_ID}/email/routing/rules/catch_all`);
  console.log('Current catch-all:', catchAll.data);

  const setCatchAll = await api('PUT', `/zones/${ZONE_ID}/email/routing/rules/catch_all`, {
    name: 'Forward to enchant-mail-hook',
    enabled: true,
    matchers: [{ type: 'all' }],
    actions: [{ type: 'worker', value: ['enchant-mail-hook'] }]
  });
  console.log('Set catch-all result:', JSON.stringify(setCatchAll.data, null, 2));

  console.log('\n=== 5. Checking DNS MX Records ===');
  const dns = await api('GET', `/zones/${ZONE_ID}/dns_records?type=MX`);
  console.log('MX Records:', dns.data?.result?.map(r => `${r.name} -> ${r.content}`));
})();
