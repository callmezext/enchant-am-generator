const https = require('https');

function fetchUrl(urlStr) {
  return new Promise((resolve) => {
    const url = new URL(urlStr);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', e => resolve({ error: e.message }));
    req.end();
  });
}

(async () => {
  console.log('Fetching arkanastudio.xyz...');
  const res = await fetchUrl('https://arkanastudio.xyz/');
  console.log('Status:', res.status);
  console.log('Body preview:\n', res.body ? res.body.substring(0, 1000) : res.error);
})();
