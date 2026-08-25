const https = require('https');
const TOKEN = 'YOUR_CLOUDFLARE_TOKEN';
const ZONE_ID = 'cd8976dfd57a17ce748306497a8698a7';

const req = https.request({
  hostname: 'api.cloudflare.com',
  path: `/client/v4/zones/${ZONE_ID}/dns_records`,
  method: 'GET',
  headers: { 'Authorization': `Bearer ${TOKEN}` }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log('DNS status code:', res.statusCode, JSON.parse(d)));
});
req.end();
