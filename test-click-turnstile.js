const puppeteer = require('puppeteer-core');

(async () => {
  const executablePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    args: ['--no-sandbox', '--window-size=800,700']
  });

  const page = await browser.newPage();
  await page.goto('https://amprem.irfanjawa.com/auth', { waitUntil: 'networkidle2' });

  console.log('Waiting for Turnstile iframe...');
  const iframeHandle = await page.waitForSelector('iframe[src*="challenges.cloudflare.com"]', { timeout: 10000 });
  const frame = await iframeHandle.contentFrame();

  if (frame) {
    console.log('Found Turnstile frame, clicking checkbox...');
    try {
      await frame.waitForSelector('input[type="checkbox"], #challenge-stage', { timeout: 5000 });
      await frame.click('input[type="checkbox"], #challenge-stage');
      console.log('Clicked checkbox in frame!');
    } catch (e) {
      console.log('Note on click:', e.message);
    }
  }

  // Wait for token in cf-turnstile-response
  let token = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    token = await page.evaluate(() => {
      const el = document.querySelector('input[name="cf-turnstile-response"]');
      return el && el.value && el.value.length > 50 ? el.value : null;
    });
    if (token) break;
  }

  console.log('✓ Solved Token length:', token ? token.length : 'null');
  await browser.close();
})();
