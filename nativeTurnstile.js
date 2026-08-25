const puppeteer = require('puppeteer-core');
const fs = require('fs');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

function getExecutablePath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function solveTurnstileNative(url = 'https://amprem.irfanjawa.com/auth') {
  const executablePath = getExecutablePath();
  if (!executablePath) throw new Error('Browser Chrome/Edge tidak ditemukan.');

  const browser = await puppeteer.launch({
    executablePath,
    headless: false, // Headless false or 'new' solves Turnstile effortlessly
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=600,600'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    let token = null;
    const start = Date.now();

    while (Date.now() - start < 15000) {
      token = await page.evaluate(() => {
        const inp = document.querySelector('input[name="cf-turnstile-response"]');
        if (inp && inp.value && inp.value.length > 50) return inp.value;
        const allInputs = document.querySelectorAll('input[type="hidden"]');
        for (const el of allInputs) {
          if (el.value && el.value.length > 100 && !el.value.startsWith('{')) return el.value;
        }
        return null;
      });

      if (token) break;
      await new Promise(r => setTimeout(r, 600));
    }

    if (!token) {
      // Fallback: check all frame inputs
      for (const frame of page.frames()) {
        try {
          const val = await frame.evaluate(() => {
            const el = document.querySelector('input[name="cf-turnstile-response"]');
            return el ? el.value : null;
          });
          if (val && val.length > 50) { token = val; break; }
        } catch {}
      }
    }

    if (!token) throw new Error('Turnstile solve timeout.');
    return token;
  } finally {
    await browser.close();
  }
}

module.exports = { solveTurnstileNative };

if (require.main === module) {
  (async () => {
    console.log('Testing Native Turnstile Solver...');
    const t = await solveTurnstileNative();
    console.log('✓ Turnstile Solved Successfully! Token length:', t.length);
    console.log('Token snippet:', t.substring(0, 45) + '...');
  })();
}
