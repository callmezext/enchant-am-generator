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

async function runTest() {
  const email = 'check_premium_test1@enchant.id';
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();

  page.on('request', req => {
    if (req.url().includes('/api/')) {
      console.log(`[REQ] ${req.method()} ${req.url()} | Post: ${req.postData()}`);
    }
  });

  page.on('response', async res => {
    if (res.url().includes('/api/')) {
      try {
        const text = await res.text();
        console.log(`[RES] ${res.status()} ${res.url()} => ${text}`);
      } catch (e) {}
    }
  });

  console.log('1. Loading ArkanStudio...');
  await page.goto('https://arkanastudio.xyz/', { waitUntil: 'networkidle2' });

  // Switch to tab 2
  const tabs = await page.$$('button');
  for (const t of tabs) {
    const txt = await page.evaluate(el => el.innerText.toLowerCase(), t);
    if (txt.includes('pribadi') || txt.includes('manual')) {
      await t.click();
      break;
    }
  }

  await page.waitForSelector('#customEmailInput');
  await page.type('#customEmailInput', email);

  // Click Kirim
  const sendBtns = await page.$$('button');
  for (const b of sendBtns) {
    const txt = await page.evaluate(el => el.innerText.trim(), b);
    if (txt.includes('Kirim link aktivasi')) {
      await b.click();
      break;
    }
  }

  console.log('2. Waiting for Alight Creative email...');
  let link = null;
  const start = Date.now();
  while (Date.now() - start < 35000) {
    link = await fetchInboxLink(email);
    if (link) break;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`3. Got Magic Link: ${link}`);
  if (!link) {
    console.error('Failed to get magic link');
    await browser.close();
    return;
  }

  await page.waitForSelector('#customMagicLinkInput');
  await page.type('#customMagicLinkInput', link);

  // Click Verifikasi & Aktifkan
  const vBtns = await page.$$('button');
  for (const b of vBtns) {
    const txt = await page.evaluate(el => el.innerText.trim(), b);
    if (txt.includes('Verifikasi & Aktifkan Lisensi')) {
      console.log('4. Clicking Verifikasi...');
      await b.click();
      break;
    }
  }

  console.log('5. Waiting 15s for full verification response...');
  await new Promise(r => setTimeout(r, 15000));

  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('=== RESULT SCREEN TEXT ===');
  console.log(pageText);

  await browser.close();
}

runTest();
