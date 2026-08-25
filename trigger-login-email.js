/**
 * Trigger Real Alight Motion Login email to amprovip@enchant.id
 */

const http = require('http');

(async () => {
  console.log('Mengirim permintaan Magic Link Login Alight Motion ke amprovip@enchant.id...');

  const payload = JSON.stringify({
    targetEmail: 'amprovip@enchant.id',
    solverType: 'theyka',
    theykaUrl: 'http://localhost:5000/turnstile'
  });

  const req = http.request({
    hostname: 'localhost',
    port: 3000,
    path: '/api/custom-email/send-magic-link',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload)
    }
  }, (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => console.log('Response:', data));
  });

  req.write(payload);
  req.end();
})();
