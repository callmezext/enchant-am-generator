const http = require('http');

function get(path) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3000${path}`, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
  });
}

function post(path, body) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const req = http.request(`http://localhost:3000${path}`, {
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
    req.write(payload);
    req.end();
  });
}

(async () => {
  console.log('1. Search non-existing:');
  const s1 = await get('/api/v1/mailbox/search?q=belumdibuat999');
  console.log(s1);

  console.log('\n2. Create new mailbox:');
  const c = await post('/api/v1/mailbox/create', { username: 'budi_santoso' });
  console.log(c);

  console.log('\n3. Search newly created:');
  const s2 = await get('/api/v1/mailbox/search?q=budi_santoso');
  console.log(s2);
})();
