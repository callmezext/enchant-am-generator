const https = require('https');

const token = 'YOUR_CLOUDFLARE_TOKEN';
const zoneId = 'cd8976dfd57a17ce748306497a8698a7';

https.get(`https://api.cloudflare.com/client/v4/zones/${zoneId}/email/routing/rules`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Email Routing Rules:', JSON.stringify(JSON.parse(data), null, 2));
  });
}).on('error', e => console.error(e));
