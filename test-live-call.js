const https = require('https');

const req = https.request({
  hostname: 'am.enchant.id',
  path: '/api/generate-instant',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', data);
  });
});
req.on('error', (e) => console.error('Error:', e.message));
req.write(JSON.stringify({ apiKey: 'fgsiapi-1623d434-6d' }));
req.end();
