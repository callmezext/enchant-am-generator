const puppeteer = require('puppeteer');

async function inspect() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.goto('https://arkanastudio.xyz/', { waitUntil: 'networkidle2' });

  const info = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input, textarea')).map(el => ({
      id: el.id,
      name: el.name,
      type: el.type,
      placeholder: el.placeholder,
      value: el.value,
      visible: el.offsetParent !== null
    }));

    const buttons = Array.from(document.querySelectorAll('button')).map(el => ({
      id: el.id,
      text: el.innerText.trim(),
      className: el.className
    }));

    return { inputs, buttons, bodyText: document.body.innerText.substring(0, 500) };
  });

  console.log('=== PAGE ELEMENTS ===');
  console.log(JSON.stringify(info, null, 2));

  await browser.close();
}

inspect();
