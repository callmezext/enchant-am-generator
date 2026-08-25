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

async function runCleanContextTest() {
  const email = 'pro_test_cleansession@enchant.id';
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  // Use clean isolated incognito context
  const context = await browser.createBrowserContext();
  const page = await context.newPage();

  page.on('response', async res => {
    if (res.url().includes('/api/jobs') || res.url().includes('/api/generate') || res.url().includes('/api/verify') || res.url().includes('/api/stream')) {
      try {
        const text = await res.text();
        console.log(`[API RESPONSE] ${res.status()} ${res.url()}: ${text}`);
      } catch (e) {}
    }
  });

  console.log('1. Loading ArkanStudio with clean context...');
  await page.goto('https://arkanastudio.xyz/', { waitUntil: 'domcontentloaded' });

  // Click manual tab
  const tabs = await page.$$('button');
  for (const t of tabs) {
    const txt = await page.evaluate(el => el.innerText.toLowerCase(), t);
    if (txt.includes('pribadi') || txt.includes('manual')) {
      await t.click();
      break;
    }
  }

  await page.waitForSelector('#customEmailInput', { timeout: 5000 });
  console.log(`2. Typing email: ${email}...`);
  await page.type('#customEmailInput', email);

  // Click Kirim link aktivasi
  const sendBtns = await page.$$('button');
  for (const b of sendBtns) {
    const txt = await page.evaluate(el => el.innerText.trim(), b);
    if (txt.includes('Kirim link aktivasi')) {
      await b.click();
      break;
    }
  }

  console.log('3. Waiting for Alight Creative magic link in inbox...');
  let link = null;
  const start = Date.now();
  while (Date.now() - start < 35000) {
    link = await fetchInboxLink(email);
    if (link) break;
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`4. Intercepted Magic Link: ${link}`);
  if (!link) {
    console.error('Failed to get magic link');
    await browser.close();
    return;
  }

  await page.waitForSelector('#customMagicLinkInput', { timeout: 8000 });
  await page.type('#customMagicLinkInput', link);

  // Click Verifikasi & Aktifkan Lisensi
  const vBtns = await page.$$('button');
  for (const b of vBtns) {
    const txt = await page.evaluate(el => el.innerText.trim(), b);
    if (txt.includes('Verifikasi & Aktifkan Lisensi')) {
      console.log('5. Clicking "Verifikasi & Aktifkan Lisensi"...');
      await b.click();
      break;
    }
  }

  console.log('6. Waiting 15s for full verification response...');
  await new Promise(r => setTimeout(r, 15000));

  const pageText = await page.evaluate(() => document.body.innerText);
  console.log('=== RESULT SCREEN TEXT ===');
  console.log(pageText.substring(0, 1000));

  await browser.close();
}

runCleanContextTest();
