const https = require('https');

const TOKEN = 'YOUR_CLOUDFLARE_TOKEN';
const ZONE_ID = 'cd8976dfd57a17ce748306497a8698a7';
const ACCOUNT_ID = '8dd85180d0eb0a0cc7ae4726f9480468';

const endpoints = [
  { method: 'GET', path: '/user/tokens/verify' },
  { method: 'GET', path: `/accounts/${ACCOUNT_ID}/workers/scripts` },
  { method: 'GET', path: `/accounts/${ACCOUNT_ID}/email/routing/addresses` },
  { method: 'GET', path: `/zones/${ZONE_ID}` },
  { method: 'GET', path: `/zones/${ZONE_ID}/dns_records` },
  { method: 'GET', path: `/zones/${ZONE_ID}/email/routing` },
  { method: 'GET', path: `/zones/${ZONE_ID}/email/routing/rules` },
  { method: 'GET', path: `/zones/${ZONE_ID}/email/routing/rules/catch_all` },
  { method: 'GET', path: `/zones/${ZONE_ID}/email/routing/dns` }
];

(async () => {
  for (const ep of endpoints) {
    await new Promise((resolve) => {
      const req = https.request(`https://api.cloudflare.com/client/v4${ep.path}`, {
        method: ep.method,
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => {
          try {
            const j = JSON.parse(data);
            console.log(`[${res.statusCode}] ${ep.method} ${ep.path} -> success: ${j.success}`, j.errors ? j.errors : '');
          } catch {
            console.log(`[${res.statusCode}] ${ep.method} ${ep.path} -> raw: ${data.substring(0, 80)}`);
          }
          resolve();
        });
      });
      req.on('error', (e) => {
        console.error(`Error on ${ep.path}:`, e.message);
        resolve();
      });
      req.end();
    });
  }
})();
