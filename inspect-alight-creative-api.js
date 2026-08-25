const https = require('https');

// Token of admin@enchant.id
const idToken = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjZhYzkwNDdmNjcxMmZjZDVjZjY3YTMzMDc5NDFkOWZhNDIyODM5NTUiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vYWxpZ2h0LWNyZWF0aXZlIiwiYXVkIjoiYWxpZ2h0LWNyZWF0aXZlIiwiYXV0aF90aW1lIjoxNzg3MzEwNzk0LCJ1c2VyX2lkIjoicXlsT2g1M28wQVdsR01MdVVaNkJNODNYNU92MiIsInN1YiI6InF5bE9oNTNvMEFXbEdNTHVVWjZCTTgzWDVPdjIiLCJpYXQiOjE3ODczMTA3OTQsImV4cCI6MTc4NzMxNDM5NCwiZW1haWwiOiJidWRpQGVuY2hhbnQuaWQiLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJidWRpQGVuY2hhbnQuaWQiXX0sInNpZ25faW5fcHJvdmlkZXIiOiJwYXNzd29yZCJ9fQ.i2cYbWtXDKoV8OWGe9jiUYHn3xO1IT9hSqNRT0u0vq__htze2vaBWTluBK7dg5k7euD2_MlfTQnFs7-m1BNXQ_oFZVuOkXX5nfOpOY_9Nfatyw-VzV2vM9Et3AJfM-K_tFULXB01b3gin9SJ0PK0rdLntIBD6C3WGdgVDGYIxjfnuTnF6bAZG_9sZogCo-QnvMHjpSQZfjQT9Jho_Ub94jHgtoIDI4GC3nwENHHf2AvOk2Wt48aBjTliJdtZfy92469enV53t6I3sRIcixB0twVP7PCRNyOSdhQe6pMEm4WEmZjFZZxV-mxjmmdLds6OR5a9MvuktZJ1-gDfMYcHow";

function callAmApi(host, path, body = null) {
  return new Promise((resolve) => {
    const payload = body ? JSON.stringify(body) : null;
    const r = https.request({
      hostname: host,
      path: path,
      method: body ? 'POST' : 'GET',
      headers: {
        'Authorization': `Bearer ${idToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Alight Motion/5.0.260.1002344 (Android; en)',
        ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    r.on('error', e => resolve({ error: e.message }));
    if (payload) r.write(payload);
    r.end();
  });
}

(async () => {
  console.log('Testing Alight Creative endpoints...');
  const e1 = await callAmApi('us-central1-alight-creative.cloudfunctions.net', '/getAccountDetails');
  console.log('getAccountDetails:', e1);

  const e2 = await callAmApi('us-central1-alight-creative.cloudfunctions.net', '/getSubscriptionDetails');
  console.log('getSubscriptionDetails:', e2);
})();
