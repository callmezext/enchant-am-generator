const https = require('https');

const accountId = '8dd85180d0eb0a0cc7ae4726f9480468';
const token = 'YOUR_CLOUDFLARE_TOKEN';

function cfRequest(path, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.cloudflare.com',
      path: path,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json',
        'User-Agent': 'Enchant-Setup'
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { resolve(body); }
      });
    });
    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function run() {
  console.log('\nCreating dedicated Turnstile widget for enchant.id...');
  const create = await cfRequest('/client/v4/accounts/' + accountId + '/challenges/widgets', 'POST', {
    name: 'Enchant AM Login',
    domains: ['enchant.id', 'am.enchant.id', 'mail.enchant.id', 'localhost'],
    mode: 'managed'
  });
  console.log('Create result:', JSON.stringify(create, null, 2));
}

run().catch(console.error);
