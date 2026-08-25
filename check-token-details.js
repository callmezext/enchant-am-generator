const https = require('https');
const TOKEN = 'YOUR_CLOUDFLARE_TOKEN';

https.get('https://api.cloudflare.com/client/v4/user/tokens/verify', {
  headers: { 'Authorization': `Bearer ${TOKEN}` }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => console.log('Token Details:', JSON.stringify(JSON.parse(data), null, 2)));
});
