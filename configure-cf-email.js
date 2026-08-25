const https = require('https');

const TOKEN = 'YOUR_CLOUDFLARE_TOKEN';
const ZONE_ID = 'cd8976dfd57a17ce748306497a8698a7';
const ACCOUNT_ID = '8dd85180d0eb0a0cc7ae4726f9480468';

function cf(method, path, body = null) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = https.request(`https://api.cloudflare.com/client/v4${path}`, {
      method,
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
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
    req.on('error', e => resolve({ error: e.message }));
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  console.log('--- 1. Verify Token ---');
  const ver = await cf('GET', `/accounts/${ACCOUNT_ID}/tokens/verify`);
  console.log('Account Token Verify:', ver);

  const verUser = await cf('GET', '/user/tokens/verify');
  console.log('User Token Verify:', verUser);

  console.log('--- 2. Enable Email Routing ---');
  const en = await cf('POST', `/zones/${ZONE_ID}/email/routing/enable`);
  console.log('Enable Email Routing:', en);

  console.log('--- 3. Check Catch-All Rule ---');
  const ca = await cf('GET', `/zones/${ZONE_ID}/email/routing/rules/catch_all`);
  console.log('Catch-All:', ca);

  console.log('--- 4. Set Catch-All Rule to Worker enchant-mail-hook ---');
  const setCa = await cf('PUT', `/zones/${ZONE_ID}/email/routing/rules/catch_all`, {
    name: 'Forward to enchant-mail-hook',
    enabled: true,
    matchers: [{ type: 'all' }],
    actions: [{ type: 'worker', value: ['enchant-mail-hook'] }]
  });
  console.log('Set Catch-All Result:', JSON.stringify(setCa, null, 2));

  console.log('--- 5. Setup DNS MX Records for Email Routing ---');
  const dnsAuto = await cf('POST', `/zones/${ZONE_ID}/email/routing/dns`);
  console.log('DNS Auto Result:', JSON.stringify(dnsAuto, null, 2));
})();
