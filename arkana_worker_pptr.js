/**
 * Arkana Worker - High-Performance Puppeteer Automation Engine
 * Supports:
 *   - auto <email>
 *   - bulk <email1,email2,...> or <JSON_ARRAY>
 *   - send <email>
 *   - verify <magicLink>
 */

const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');

const PORT = process.env.PORT || '3055';
const MAIL_API = `http://127.0.0.1:${PORT}/api/v1/mail/inbox`;

function getChromePath() {
  const linuxPaths = [
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ];
  for (const p of linuxPaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

function fetchInboxLink(email) {
  return new Promise((resolve) => {
    const url = `${MAIL_API}?email=${encodeURIComponent(email)}`;
    const req = http.get(url, { timeout: 3000 }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const messages = parsed.messages || [];
          for (const msg of messages) {
            if (msg.loginLink) return resolve(msg.loginLink);
            for (const l of (msg.links || [])) {
              if (l.includes('firebaseapp') || l.includes('alightcreative')) {
                return resolve(l);
              }
            }
          }
        } catch (e) {}
        resolve(null);
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

async function getBrowser() {
  const execPath = getChromePath();
  return await puppeteer.launch({
    executablePath: execPath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--no-first-run',
      '--no-zygote',
      '--blink-settings=imagesEnabled=false'
    ]
  });
}

async function setupPageStealth(page) {
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36');
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
  });
}

async function ensureStep1(page) {
  const startTime = Date.now();
  
  // Check if stuck on Vercel checkpoint and wait for auto-redirect
  try {
    const title = await page.title();
    if (title.includes('Vercel Security Checkpoint')) {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
    }
  } catch (e) {}

  while (Date.now() - startTime < 20000) {
    const emailInp = await page.$('#customEmailInput');
    if (emailInp) {
      const isVisible = await page.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
      }, emailInp);
      if (isVisible) return true;
    }

    // If on Step 2 (magic input), click cancel/reset
    const magicInp = await page.$('#customMagicLinkInput');
    if (magicInp) {
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const txt = await page.evaluate((el) => el.innerText.toLowerCase(), btn);
        if (txt.includes('batal') || txt.includes('ganti') || txt.includes('mulai dari awal') || txt.includes('kembali')) {
          await btn.click().catch(() => {});
          await new Promise((r) => setTimeout(r, 500));
          break;
        }
      }
    }

    // Click "Email pribadi / manual" tab
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const txt = await page.evaluate((el) => el.innerText.toLowerCase(), btn);
      if (txt.includes('pribadi') || txt.includes('manual')) {
        await btn.click().catch(() => {});
        break;
      }
    }

    try {
      await page.waitForSelector('#customEmailInput', { visible: true, timeout: 2000 });
      return true;
    } catch (e) {}

    await new Promise((r) => setTimeout(r, 400));
  }
  return false;
}

async function processSingleAccount(context, email) {
  const startTime = Date.now();
  console.log(`[Worker] ⚡ Fast pipeline starting for ${email}...`);
  const page = await context.newPage();
  await setupPageStealth(page);

  let verifyApiResult = null;
  page.on('response', async (res) => {
    if (res.url().includes('verify-link') || res.url().includes('/verify')) {
      try {
        const data = await res.json();
        if (data && (data.state === 'SUCCESS' || data.activatedAt)) {
          verifyApiResult = data;
        }
      } catch (e) {}
    }
  });

  try {
    await page.goto('https://arkanastudio.xyz/', { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});

    const okStep1 = await ensureStep1(page);
    if (!okStep1) {
      throw new Error('Cannot reach Step 1 input form on ArkanStudio');
    }

    // Click and type email
    await page.click('#customEmailInput', { clickCount: 3 });
    await page.type('#customEmailInput', email);

    // Submit button
    const allBtns = await page.$$('button');
    let submitBtn = null;
    for (const b of allBtns) {
      const txt = await page.evaluate((el) => el.innerText.trim(), b);
      if (txt.includes('Kirim link aktivasi') || txt.includes('Kirim')) {
        submitBtn = b;
        break;
      }
    }

    if (submitBtn) {
      await submitBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    // Wait for Step 2
    await page.waitForSelector('#customMagicLinkInput', { timeout: 15000 });

    // Poll inbox with 300ms loop
    let magicLink = null;
    const pollStart = Date.now();
    while (Date.now() - pollStart < 45000) {
      magicLink = await fetchInboxLink(email);
      if (magicLink) break;
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!magicLink) {
      throw new Error('Timeout: email verifikasi tidak masuk ke inbox');
    }

    // Input magic link
    await page.click('#customMagicLinkInput', { clickCount: 3 });
    await page.type('#customMagicLinkInput', magicLink);

    // Click verify
    const step2Btns = await page.$$('button');
    let verifyBtn = null;
    for (const b of step2Btns) {
      const txt = await page.evaluate((el) => el.innerText.trim(), b);
      if (txt.includes('Verifikasi & Aktifkan Lisensi') || txt.includes('Aktifkan') || txt.includes('Verifikasi')) {
        verifyBtn = b;
        break;
      }
    }

    if (verifyBtn) {
      await verifyBtn.click();
    } else {
      await page.keyboard.press('Enter');
    }

    // Wait for activation confirmation
    let success = false;
    let expiresAt = null;
    const vStart = Date.now();

    while (Date.now() - vStart < 25000) {
      if (verifyApiResult && verifyApiResult.state === 'SUCCESS') {
        success = true;
        if (verifyApiResult.expiresAt) {
          expiresAt = new Date(verifyApiResult.expiresAt).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
        }
        break;
      }

      const pageText = await page.evaluate(() => document.body.innerText);
      if (
        pageText.includes('Premium aktif') ||
        pageText.includes('Lisensi Aktif') ||
        pageText.includes('1 Tahun berhasil ditautkan') ||
        pageText.includes('Berhasil')
      ) {
        success = true;
        const m = pageText.match(/(\d{1,2}\s+[A-Za-z]+\s+\d{4})/);
        if (m) expiresAt = m[1];
        break;
      }
      if (pageText.includes('Gagal') || pageText.includes('Kedaluwarsa') || pageText.includes('Error')) {
        throw new Error('Verifikasi ditolak oleh ArkanStudio');
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!success) {
      throw new Error('Timeout konfirmasi aktivasi lisensi dari ArkanStudio');
    }

    const durationSeconds = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));
    const result = {
      success: true,
      email,
      status: 'PREMIUM_ACTIVE',
      expiresAt:
        expiresAt ||
        new Date(Date.now() + 365 * 86400000).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }),
      durationSeconds,
      activationDetail: 'Play Billing Resmi 1 Tahun'
    };

    console.log(`[Worker] ✅ Success: ${email} (${durationSeconds}s)`);
    return result;
  } catch (err) {
    console.error(`[Worker] ❌ Failed for ${email}: ${err.message}`);
    return {
      success: false,
      email,
      error: err.message
    };
  } finally {
    await page.close().catch(() => {});
  }
}

async function handleAuto(email) {
  const browser = await getBrowser();
  try {
    const context = await browser.createBrowserContext();
    const result = await processSingleAccount(context, email);
    console.log(`RESULT_JSON:${JSON.stringify(result)}`);
    return result;
  } finally {
    await browser.close().catch(() => {});
  }
}

async function handleBulk(emailsInput, concurrency = 3) {
  let emails = [];
  try {
    if (emailsInput.startsWith('[')) {
      emails = JSON.parse(emailsInput);
    } else {
      emails = emailsInput.split(',').map((e) => e.trim()).filter(Boolean);
    }
  } catch (e) {
    emails = emailsInput.split(',').map((e) => e.trim()).filter(Boolean);
  }

  console.log(`[Worker] 🚀 Bulk Generation starting for ${emails.length} accounts (Concurrency: ${concurrency})...`);
  const browser = await getBrowser();
  const results = [];
  let completedCount = 0;

  try {
    const context = await browser.createBrowserContext();

    const queue = [...emails];
    const workers = [];

    async function workerRunner(workerId) {
      while (queue.length > 0) {
        const email = queue.shift();
        if (!email) break;
        console.log(`[Worker #${workerId}] Processing ${email} (${completedCount + 1}/${emails.length})...`);
        const res = await processSingleAccount(context, email);
        results.push(res);
        completedCount++;
        console.log(
          `PROGRESS_JSON:${JSON.stringify({
            completed: completedCount,
            total: emails.length,
            latest: res
          })}`
        );
      }
    }

    const actualConcurrency = Math.min(concurrency, emails.length, 5);
    for (let i = 1; i <= actualConcurrency; i++) {
      workers.push(workerRunner(i));
    }

    await Promise.all(workers);

    const successful = results.filter((r) => r.success).length;
    const summary = {
      success: true,
      totalRequested: emails.length,
      totalSuccess: successful,
      totalFailed: emails.length - successful,
      results
    };

    console.log(`RESULT_JSON:${JSON.stringify(summary)}`);
    return summary;
  } finally {
    await browser.close().catch(() => {});
  }
}

async function handleSend(email) {
  console.log(`[Worker] Starting SEND mode for ${email}...`);
  const browser = await getBrowser();
  try {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await setupPageStealth(page);
    await page.goto('https://arkanastudio.xyz/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});

    try {
      const title = await page.title();
      if (title.includes('Vercel Security Checkpoint')) {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      }
    } catch (e) {}

    // Method 1: Fast in-browser API execution
    const genResult = await page.evaluate(async (amEmail) => {
      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amEmail })
        });
        return { status: res.status, data: await res.json() };
      } catch (e) {
        return { error: e.message };
      }
    }, email);

    if (genResult.data && genResult.data.id) {
      const result = {
        success: true,
        email,
        jobId: genResult.data.id,
        message: `Link verifikasi berhasil dikirim ke ${email}!`
      };
      console.log(`RESULT_JSON:${JSON.stringify(result)}`);
      return result;
    }

    // Method 2: DOM UI interaction fallback
    const okStep1 = await ensureStep1(page);
    if (!okStep1) {
      throw new Error(genResult.data?.error || 'Cannot reach Step 1 input form on ArkanStudio');
    }

    await page.click('#customEmailInput', { clickCount: 3 });
    await page.type('#customEmailInput', email);

    const allBtns = await page.$$('button');
    for (const b of allBtns) {
      const txt = await page.evaluate((el) => el.innerText.trim(), b);
      if (txt.includes('Kirim link aktivasi') || txt.includes('Kirim')) {
        await b.click();
        break;
      }
    }

    await page.waitForSelector('#customMagicLinkInput', { timeout: 15000 });

    const result = {
      success: true,
      email,
      jobId: 'job_' + Date.now(),
      message: `Link verifikasi berhasil dikirim ke ${email}!`
    };

    console.log(`RESULT_JSON:${JSON.stringify(result)}`);
    return result;
  } finally {
    await browser.close().catch(() => {});
  }
}

async function handleVerify(magicLink, maybeJobId = '', maybeEmail = '') {
  console.log(`[Worker] Starting VERIFY mode (JobId: ${maybeJobId ? maybeJobId.substring(0, 20) + '...' : 'none'})...`);
  const browser = await getBrowser();
  try {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await setupPageStealth(page);
    await page.goto('https://arkanastudio.xyz/', { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => {});

    try {
      const title = await page.title();
      if (title.includes('Vercel Security Checkpoint')) {
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {});
      }
    } catch (e) {}

    // Method 1: Direct API verify if jobId is present
    if (maybeJobId && maybeJobId.startsWith('job_v1:')) {
      const verifyResult = await page.evaluate(async (jId, link) => {
        try {
          const res = await fetch('/api/generate/' + jId + '/verify-link', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ link })
          });
          return { status: res.status, data: await res.json() };
        } catch (e) {
          return { error: e.message };
        }
      }, maybeJobId, magicLink);

      if (verifyResult.data && (verifyResult.data.state === 'SUCCESS' || verifyResult.data.activatedAt)) {
        let exp = '1 Tahun Aktif';
        if (verifyResult.data.expiresAt) {
          exp = new Date(verifyResult.data.expiresAt).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
          });
        }
        const result = {
          success: true,
          email: verifyResult.data.amEmail || maybeEmail,
          status: 'PREMIUM_ACTIVE',
          expiresAt: exp,
          activationDetail: 'Play Billing Resmi 1 Tahun'
        };
        console.log(`RESULT_JSON:${JSON.stringify(result)}`);
        return result;
      }
    }

    // Method 2: DOM UI fallback
    const okStep1 = await ensureStep1(page);
    if (maybeEmail) {
      await page.click('#customEmailInput', { clickCount: 3 });
      await page.type('#customEmailInput', maybeEmail);
      const allBtns = await page.$$('button');
      for (const b of allBtns) {
        const txt = await page.evaluate((el) => el.innerText.trim(), b);
        if (txt.includes('Kirim link aktivasi') || txt.includes('Kirim')) {
          await b.click();
          break;
        }
      }
      await page.waitForSelector('#customMagicLinkInput', { timeout: 15000 }).catch(() => {});
    }

    let magicInput = await page.$('#customMagicLinkInput');
    if (!magicInput) {
      const inputs = await page.$$('input');
      if (inputs.length > 0) magicInput = inputs[0];
    }

    if (!magicInput) {
      throw new Error('Form verifikasi magic link tidak ditemukan di ArkanStudio');
    }

    await magicInput.click({ clickCount: 3 });
    await magicInput.type(magicLink);

    const step2Btns = await page.$$('button');
    for (const b of step2Btns) {
      const txt = await page.evaluate((el) => el.innerText.trim(), b);
      if (txt.includes('Verifikasi & Aktifkan Lisensi') || txt.includes('Aktifkan') || txt.includes('Verifikasi')) {
        await b.click();
        break;
      }
    }

    let success = false;
    let expiresAt = null;
    const vStart = Date.now();

    while (Date.now() - vStart < 25000) {
      const pageText = await page.evaluate(() => document.body.innerText);
      if (
        pageText.includes('Premium aktif') ||
        pageText.includes('Lisensi Aktif') ||
        pageText.includes('1 Tahun berhasil ditautkan') ||
        pageText.includes('Berhasil')
      ) {
        success = true;
        const m = pageText.match(/(\d{1,2}\s+[A-Za-z]+\s+\d{4})/);
        if (m) expiresAt = m[1];
        break;
      }
      if (pageText.includes('Gagal') || pageText.includes('Kedaluwarsa') || pageText.includes('Error')) {
        throw new Error('Verifikasi ditolak oleh ArkanStudio');
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!success) {
      throw new Error('Timeout konfirmasi aktivasi lisensi dari ArkanStudio');
    }

    const result = {
      success: true,
      email: maybeEmail,
      status: 'PREMIUM_ACTIVE',
      expiresAt:
        expiresAt ||
        new Date(Date.now() + 365 * 86400000).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }),
      activationDetail: 'Play Billing Resmi 1 Tahun'
    };

    console.log(`RESULT_JSON:${JSON.stringify(result)}`);
    return result;
  } finally {
    await browser.close().catch(() => {});
  }
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'auto';
  const target = args[1] || '';
  const extraArg = args[2] || '';
  const extraArg2 = args[3] || '';

  try {
    if (mode === 'auto') {
      await handleAuto(target);
    } else if (mode === 'bulk') {
      const concurrency = parseInt(extraArg || '3', 10);
      await handleBulk(target, concurrency);
    } else if (mode === 'send') {
      await handleSend(target);
    } else if (mode === 'verify') {
      await handleVerify(target, extraArg, extraArg2);
    } else {
      console.log(`RESULT_JSON:{"success":false,"error":"Mode ${mode} not implemented"}`);
    }
  } catch (err) {
    console.error(`[Worker Error]: ${err.message}`);
    console.log(`RESULT_JSON:{"success":false,"error":"${err.message.replace(/"/g, "'")}"}`);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
