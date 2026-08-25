const https = require('https');

(async () => {
  const html = await new Promise((resolve) => {
    https.get('https://amprem.irfanjawa.com/dashboard-v2', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    });
  });

  const chunks = html.match(/\/static\/chunks\/[a-zA-Z0-9_-]+\.js/g) || [];
  console.log('Found Next.js chunks:', chunks);

  for (const chunk of chunks) {
    const js = await new Promise((resolve) => {
      https.get(`https://amprem.irfanjawa.com/_next${chunk}`, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve(data));
      });
    });

    const endpoints = js.match(/\/api\/[a-zA-Z0-9_\-\/]+/g);
    if (endpoints) {
      console.log(`Endpoints in ${chunk}:`, [...new Set(endpoints)]);
    }
  }
})();
