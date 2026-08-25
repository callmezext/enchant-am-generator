const puppeteer = require('puppeteer');
const http = require('http');

const PORT = process.env.PORT || '3001';
const MAIL_API = `http://127.0.0.1:${PORT}/api/v1/mail/inbox`;

function fetchInboxLink(email) {
  return new Promise((resolve) => {
    const url = `${MAIL_API}?email=${encodeURIComponent(email)}`;
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const messages = parsed.messages || [];
          for (const msg of messages) {
            if (msg.loginLink) return resolve(msg.loginLink);
            for (const l of (msg.links || [])) {
              if (l.includes('firebaseapp') || l.includes('alightcreative')) return resolve(l);
            }
          }
        } catch (e) {}
        resolve(null);
      });
    }).on('error', () => resolve(null));
  });
}

async function fullDebugFlow() {
  const email = 'pro_verify_inspect1@enchant.id';
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      console.log(`[HTTP REQUEST] ${req.method()} ${req.url()} Body: ${req.postData()}`);
    }
  });

  page.on('response', async res => {
    if (res.url().includes('/api/')) {
      try {
        const body = await res.text();
        console.log(`[HTTP RESPONSE] ${res.status()} ${res.url()}: ${body}`);
      } catch (e) {}
    }
  });

  console.log(`1. Navigating to ArkanStudio for ${email}...`);
  await page.goto('https://arkanastudio.xyz/', { waitUntil: 'domcontentloaded' });

  // Click manual tab
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const txt = await page.evaluate(el => el.innerText.toLowerCase(), btn);
    if (txt.includes('pribadi') || txt.includes('manual')) {
      await btn.click();
      break;
    }
  }

  await page.waitForSelector('#customEmailInput', { timeout: 5000 });
  await page.type('#customEmailInput', email);

  // Click Kirim link aktivasi
  const allBtns = await page.$$('button');
  for (const b of allBtns) {
    const txt = await page.evaluate(el => el.innerText.trim(), b);
    if (txt.includes('Kirim link aktivasi')) {
      await b.click();
      break;
    }
  }

  console.log('2. Waiting for magic link from Alight Creative in inbox...');
  let link = null;
  const start = Date.now();
  while (Date.now() - start < 35000) {
    link = await fetchInboxLink(email);
    if (link) break;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`3. Intercepted link: ${link}`);
  if (!link) {
    console.error('No magic link received!');
    await browser.close();
    return;
  }

  await page.waitForSelector('#customMagicLinkInput', { timeout: 5000 });
  await page.type('#customMagicLinkInput', link);

  // Click Verifikasi & Aktifkan Lisensi
  const verifyBtns = await page.$$('button');
  for (const b of verifyBtns) {
    const txt = await page.evaluate(el => el.innerText.trim(), b);
    if (txt.includes('Verifikasi & Aktifkan Lisensi')) {
      console.log('4. Clicking "Verifikasi & Aktifkan Lisensi"...');
      await b.click();
      break;
    }
  }

  console.log('5. Waiting 10s for verify API response...');
  await new Promise(r => setTimeout(r, 10000));

  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('=== FINAL PAGE TEXT ===');
  console.log(pageText.substring(0, 800));

  await browser.close();
}

fullDebugFlow();
