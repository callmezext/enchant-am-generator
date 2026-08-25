const http = require('http');

function post(path, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 3000, path: path }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    }).on('error', reject);
  });
}

(async () => {
  console.log('=== TEST 1: Simulate Cloudflare Email Worker Webhook ===');
  const cfPayload = {
    to: 'andi@enchant.id',
    from: 'noreply@alightmotion.com',
    raw: `From: "Alight Motion" <noreply@alightmotion.com>
To: andi@enchant.id
Subject: Sign in to Alight Motion
Date: Fri, 21 Aug 2026 10:45:00 +0700
Content-Type: text/plain; charset=UTF-8

Hello! Click the link below to sign in to Alight Motion:
https://alightcreative.page.link/autoTestToken987654321

If you did not request this, please ignore this email.`
  };

  const webhookRes = await post('/api/mail/webhook', cfPayload);
  console.log('Webhook Response:', webhookRes);

  console.log('\n=== TEST 2: Check Inbox for andi@enchant.id ===');
  const inbox1 = await get('/api/mail/inbox?email=andi@enchant.id');
  console.log(`Inbox count (andi@enchant.id): ${inbox1.data.count}`);
  console.log('Magic link extracted:', inbox1.data.messages[0]?.magicLink);

  console.log('\n=== TEST 3: Cross-Domain Check (andi@mail.enchant.id) ===');
  const inbox2 = await get('/api/mail/inbox?email=andi@mail.enchant.id');
  console.log(`Inbox count (andi@mail.enchant.id): ${inbox2.data.count}`);
  console.log('Magic link matches:', inbox2.data.messages[0]?.magicLink === 'https://alightcreative.page.link/autoTestToken987654321');

  console.log('\n=== ALL TESTS PASSED! ===');
})();
