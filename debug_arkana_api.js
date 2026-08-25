const puppeteer = require('puppeteer');

async function debugArkanStudio() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      console.log(`[REQUEST] ${req.method()} ${req.url()} Body: ${req.postData()}`);
    }
  });

  page.on('response', async res => {
    if (res.url().includes('/api/')) {
      try {
        const body = await res.text();
        console.log(`[RESPONSE] ${res.status()} ${res.url()}: ${body}`);
      } catch (e) {}
    }
  });

  console.log('Navigating to https://arkanastudio.xyz/ ...');
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
  await page.type('#customEmailInput', 'cek_status_pro@enchant.id');

  // Click Kirim link aktivasi
  const allBtns = await page.$$('button');
  for (const b of allBtns) {
    const txt = await page.evaluate(el => el.innerText.trim(), b);
    if (txt.includes('Kirim link aktivasi')) {
      await b.click();
      break;
    }
  }

  console.log('Waiting 5s for API response...');
  await new Promise(r => setTimeout(r, 5000));

  await browser.close();
}

debugArkanStudio();
