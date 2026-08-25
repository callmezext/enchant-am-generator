const fs = require('fs');
const path = require('path');

console.log('=== Checking Environment Variables ===');
for (const key of Object.keys(process.env)) {
  if (key.toLowerCase().includes('cloudflare') || key.toLowerCase().includes('cf_')) {
    console.log(`${key}: ${process.env[key].substring(0, 5)}...`);
  }
}

console.log('\n=== Checking .cloudflared directory ===');
const cfDir = 'C:\\Users\\LENOVO\\.cloudflared';
if (fs.existsSync(cfDir)) {
  const files = fs.readdirSync(cfDir);
  console.log('Files in .cloudflared:', files);
  
  // Check cert.pem
  const certPath = path.join(cfDir, 'cert.pem');
  if (fs.existsSync(certPath)) {
    const certContent = fs.readFileSync(certPath, 'utf8');
    console.log('cert.pem exists, length:', certContent.length);
  }
}
