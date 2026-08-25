const puppeteer = require('puppeteer-core');
const fs = require('fs');

(async () => {
  const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    args: ['--no-sandbox', '--window-size=1000,800']
  });

  const page = await browser.newPage();
  await page.goto('https://amprem.irfanjawa.com/auth', { waitUntil: 'networkidle2' });

  // Print all input elements and forms
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({
      name: i.name,
      id: i.id,
      type: i.type,
      value: i.value ? i.value.substring(0, 30) + '...' : ''
    }));
  });
  console.log('Inputs on page:', inputs);

  // Wait 6 seconds for turnstile to auto-solve
  await new Promise(r => setTimeout(r, 6000));

  const inputsAfter = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input')).map(i => ({
      name: i.name,
      id: i.id,
      type: i.type,
      valLen: i.value.length,
      val: i.value.substring(0, 30) + '...'
    }));
  });
  console.log('Inputs after 6s:', inputsAfter);

  await browser.close();
})();
