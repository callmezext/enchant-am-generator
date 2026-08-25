const http = require('http');

console.log('Sending solve request to Python Theyka Turnstile-Solver (http://localhost:5000/turnstile)...');

const payload = JSON.stringify({
  url: 'https://amprem.irfanjawa.com/auth',
  sitekey: '0x4AAAAAADsWLA16vNVNqTCH'
});

const req = http.request({
  hostname: 'localhost',
  port: 5000,
  path: '/turnstile',
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
    console.log('Status Code:', res.statusCode);
    try {
      const json = JSON.parse(data);
      console.log('Solve Result:', {
        status: json.status,
        tokenLength: json.token ? json.token.length : 0,
        tokenSnippet: json.token ? json.token.substring(0, 40) + '...' : null
      });
    } catch {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', e => console.error('Error:', e.message));
req.write(payload);
req.end();
