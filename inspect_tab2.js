const puppeteer = require('puppeteer');

async function inspectTab2() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.goto('https://arkanastudio.xyz/', { waitUntil: 'networkidle2' });

  // Click tab 2
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const txt = await page.evaluate(el => el.innerText.toLowerCase(), btn);
    if (txt.includes('pribadi') || txt.includes('manual')) {
      await btn.click();
      break;
    }
  }

  await new Promise(r => setTimeout(r, 1000));

  const info = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, textarea')).map(el => ({
      id: el.id,
      name: el.name,
      type: el.type,
      placeholder: el.placeholder
    }));

    const buttons = Array.from(document.querySelectorAll('button')).map((el, idx) => ({
      index: idx,
      id: el.id,
      text: el.innerText.trim(),
      className: el.className
    }));

    return { inputs, buttons };
  });

  console.log('=== TAB 2 ELEMENTS ===');
  console.log(JSON.stringify(info, null, 2));

  await browser.close();
}

inspectTab2();
