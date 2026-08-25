const http = require('http');

const payload = JSON.stringify({ mode: 'auto' });
const req = http.request('http://localhost:3000/api/activate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
}, (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => console.log(d));
});
req.write(payload);
req.end();
