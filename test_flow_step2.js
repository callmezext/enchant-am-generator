const puppeteer = require('puppeteer');

async function testFlow() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.goto('https://arkanastudio.xyz/', { waitUntil: 'networkidle2' });

  // 1. Click Tab 2
  console.log('1. Switching to Tab 2...');
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const txt = await page.evaluate(el => el.innerText.toLowerCase(), btn);
    if (txt.includes('pribadi') || txt.includes('manual')) {
      await btn.click();
      break;
    }
  }

  await page.waitForSelector('#customEmailInput', { timeout: 5000 });
  console.log('2. Typing email...');
  await page.type('#customEmailInput', 'flowtest999@enchant.id');

  console.log('3. Clicking "Kirim link aktivasi"...');
  const allBtns = await page.$$('button');
  for (const b of allBtns) {
    const txt = await page.evaluate(el => el.innerText.trim(), b);
    if (txt.includes('Kirim link aktivasi') || txt.includes('Kirim')) {
      await b.click();
      console.log(`Clicked button: "${txt}"`);
      break;
    }
  }

  console.log('4. Waiting 4 seconds...');
  await new Promise(r => setTimeout(r, 4000));

  const step2Info = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, textarea')).map(el => ({
      id: el.id,
      name: el.name,
      type: el.type,
      placeholder: el.placeholder
    }));

    const btns = Array.from(document.querySelectorAll('button')).map(el => el.innerText.trim());
    return { inputs, btns, bodyText: document.body.innerText.substring(0, 400) };
  });

  console.log('=== STEP 2 DOM ===');
  console.log(JSON.stringify(step2Info, null, 2));

  await browser.close();
}

testFlow();
