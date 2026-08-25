const puppeteer = require('puppeteer');

async function test() {
  console.log('1. Launching Puppeteer with /usr/bin/google-chrome-stable...');
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--blink-settings=imagesEnabled=false'
    ]
  });

  try {
    console.log('2. Opening https://arkanastudio.xyz/ ...');
    const page = await browser.newPage();
    await page.goto('https://arkanastudio.xyz/', { waitUntil: 'networkidle2', timeout: 25000 });
    
    console.log('3. Page Title:', await page.title());
    console.log('4. Page URL:', page.url());

    const emailInput = await page.$('#customEmailInput');
    if (emailInput) {
      console.log('5. [SUCCESS] Found #customEmailInput in Puppeteer!');
      await page.type('#customEmailInput', 'test_puppeteer@enchant.id');
      console.log('6. Typed email successfully!');
    } else {
      console.log('5. [FAIL] #customEmailInput not found');
    }
  } catch (err) {
    console.error('Puppeteer Error:', err.message);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

test();
