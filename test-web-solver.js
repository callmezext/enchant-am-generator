const http = require('http');

const payload = JSON.stringify({
  solverType: 'theyka',
  theykaUrl: 'http://localhost:5000/turnstile'
});

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/solver/test',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  },
  timeout: 45000
}, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Data:', JSON.parse(data));
  });
});
req.write(payload);
req.end();
