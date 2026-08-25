/**
 * Arkana Worker - Puppeteer High-Performance Automation Engine
 * Supports:
 *   - auto <email>       : Send + intercept magic link + verify
 *   - send <email>       : Send magic link to email
 *   - verify <magicLink> : Submit magic link and activate
 */

const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');

const PORT = process.env.PORT || '3001';
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
              if (l.includes('firebaseapp') || l.includes('alightcreative')) {
                return resolve(l);
              }
            }
          }
        } catch (e) {}
        resolve(null);
      });
    }).on('error', () => resolve(null));
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
      '--blink-settings=imagesEnabled=false'
    ]
  });
}

async function ensureStep1(page) {
  const startTime = Date.now();
  while (Date.now() - startTime < 15000) {
    // If #customEmailInput is already visible and rendered
    const emailInp = await page.$('#customEmailInput');
    if (emailInp) {
      const isVisible = await page.evaluate(el => {
        const style = window.getComputedStyle(el);
        return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
      }, emailInp);
      if (isVisible) return true;
    }

    // If at Step 2 (#customMagicLinkInput), click cancel / reset
    const magicInp = await page.$('#customMagicLinkInput');
    if (magicInp) {
      const buttons = await page.$$('button');
      for (const btn of buttons) {
        const txt = await page.evaluate(el => el.innerText.toLowerCase(), btn);
        if (txt.includes('batal') || txt.includes('ganti') || txt.includes('mulai dari awal') || txt.includes('kembali')) {
          await btn.click().catch(() => {});
          await new Promise(r => setTimeout(r, 600));
          break;
        }
      }
    }

    // Click "Email pribadi / manual" tab
    const buttons = await page.$$('button');
    for (const btn of buttons) {
      const txt = await page.evaluate(el => el.innerText.toLowerCase(), btn);
      if (txt.includes('pribadi') || txt.includes('manual')) {
        await btn.click().catch(() => {});
        break;
      }
    }

    try {
      await page.waitForSelector('#customEmailInput', { visible: true, timeout: 2000 });
      return true;
    } catch (e) {}

    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

async function handleAuto(email) {
  console.log(`[Worker] Starting AUTO mode for ${email}...`);
  const browser = await getBrowser();
  try {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    let verifyApiResult = null;
    page.on('response', async res => {
      if (res.url().includes('verify-link') || res.url().includes('/verify')) {
        try {
          const data = await res.json();
          if (data && (data.state === 'SUCCESS' || data.activatedAt)) {
            verifyApiResult = data;
          }
        } catch (e) {}
      }
    });

    await page.goto('https://arkanastudio.xyz/', { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});

    const okStep1 = await ensureStep1(page);
    if (!okStep1) {
      throw new Error('Cannot reach Step 1 input form on ArkanStudio');
    }

    console.log(`[Worker] Step 1: Typing email ${email}...`);
    await page.click('#customEmailInput', { clickCount: 3 });
    await page.type('#customEmailInput', email);

    // Click "Kirim link aktivasi" button
    console.log(`[Worker] Step 1: Submitting email...`);
    const allBtns = await page.$$('button');
    let submitBtn = null;
    for (const b of allBtns) {
      const txt = await page.evaluate(el => el.innerText.trim(), b);
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

    console.log(`[Worker] Step 2: Waiting for magic link input...`);
    await page.waitForSelector('#customMagicLinkInput', { timeout: 15000 });

    console.log(`[Worker] Step 2: Polling inbox for verification link...`);
    let magicLink = null;
    const startTime = Date.now();
    while (Date.now() - startTime < 45000) {
      magicLink = await fetchInboxLink(email);
      if (magicLink) break;
      await new Promise(r => setTimeout(r, 500));
    }

    if (!magicLink) {
      throw new Error('Timeout: email verifikasi tidak masuk ke inbox');
    }

    console.log(`[Worker] Intercepted magic link: ${magicLink.substring(0, 60)}...`);
    console.log(`[Worker] Step 3: Pasting magic link into ArkanStudio...`);

    await page.click('#customMagicLinkInput', { clickCount: 3 });
    await page.type('#customMagicLinkInput', magicLink);

    // Click "Verifikasi & Aktifkan Lisensi" button
    const step2Btns = await page.$$('button');
    let verifyBtn = null;
    for (const b of step2Btns) {
      const txt = await page.evaluate(el => el.innerText.trim(), b);
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

    console.log(`[Worker] Step 3: Waiting for activation confirmation...`);
    let success = false;
    let expiresAt = null;
    const vStart = Date.now();

    while (Date.now() - vStart < 30000) {
      if (verifyApiResult && verifyApiResult.state === 'SUCCESS') {
        success = true;
        if (verifyApiResult.expiresAt) {
          expiresAt = new Date(verifyApiResult.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        }
        break;
      }

      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.includes('Premium aktif') || pageText.includes('Lisensi Aktif') || pageText.includes('1 Tahun berhasil ditautkan')) {
        success = true;
        const m = pageText.match(/(\d{1,2}\s+[A-Za-z]+\s+\d{4})/);
        if (m) expiresAt = m[1];
        break;
      }
      if (pageText.includes('Gagal') || pageText.includes('Kedaluwarsa') || pageText.includes('Error')) {
        throw new Error('Verifikasi ditolak oleh ArkanStudio');
      }
      await new Promise(r => setTimeout(r, 500));
    }

    if (!success) {
      throw new Error('Timeout konfirmasi aktivasi lisensi dari ArkanStudio');
    }

    const result = {
      success: true,
      email,
      status: 'PREMIUM_ACTIVE',
      expiresAt: expiresAt || new Date(Date.now() + 365 * 86400000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      activationDetail: 'Play Billing Resmi 1 Tahun'
    };

    console.log(`RESULT_JSON:${JSON.stringify(result)}`);
    return result;
  } finally {
    await browser.close();
  }
}

async function handleSend(email) {
  console.log(`[Worker] Starting SEND mode for ${email}...`);
  const browser = await getBrowser();
  try {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();
    await page.goto('https://arkanastudio.xyz/', { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});

    const okStep1 = await ensureStep1(page);
    if (!okStep1) {
      throw new Error('Cannot reach Step 1 input form on ArkanStudio');
    }

    console.log(`[Worker] Step 1: Inputting email ${email}...`);
    await page.click('#customEmailInput', { clickCount: 3 });
    await page.type('#customEmailInput', email);

    const allBtns = await page.$$('button');
    for (const b of allBtns) {
      const txt = await page.evaluate(el => el.innerText.trim(), b);
      if (txt.includes('Kirim link aktivasi') || txt.includes('Kirim')) {
        await b.click();
        break;
      }
    }

    console.log(`[Worker] Waiting for Step 2 confirmation...`);
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
    await browser.close();
  }
}

async function handleVerify(magicLink) {
  console.log(`[Worker] Starting VERIFY mode...`);
  const browser = await getBrowser();
  try {
    const context = await browser.createBrowserContext();
    const page = await context.newPage();

    let verifyApiResult = null;
    page.on('response', async res => {
      if (res.url().includes('verify-link') || res.url().includes('/verify')) {
        try {
          const data = await res.json();
          if (data && (data.state === 'SUCCESS' || data.activatedAt)) {
            verifyApiResult = data;
          }
        } catch (e) {}
      }
    });

    await page.goto('https://arkanastudio.xyz/', { waitUntil: 'networkidle2', timeout: 25000 }).catch(() => {});

    let magicInput = await page.$('#customMagicLinkInput');
    if (!magicInput) {
      await ensureStep1(page);
      magicInput = await page.$('#customMagicLinkInput');
    }

    if (!magicInput) {
      throw new Error('Form verifikasi magic link tidak ditemukan di ArkanStudio');
    }

    await page.click('#customMagicLinkInput', { clickCount: 3 });
    await page.type('#customMagicLinkInput', magicLink);

    const step2Btns = await page.$$('button');
    let verifyBtn = null;
    for (const b of step2Btns) {
      const txt = await page.evaluate(el => el.innerText.trim(), b);
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

    let success = false;
    let expiresAt = null;
    const vStart = Date.now();

    while (Date.now() - vStart < 30000) {
      if (verifyApiResult && verifyApiResult.state === 'SUCCESS') {
        success = true;
        if (verifyApiResult.expiresAt) {
          expiresAt = new Date(verifyApiResult.expiresAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
        }
        break;
      }

      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.includes('Premium aktif') || pageText.includes('Lisensi Aktif') || pageText.includes('1 Tahun berhasil ditautkan')) {
        success = true;
        const m = pageText.match(/(\d{1,2}\s+[A-Za-z]+\s+\d{4})/);
        if (m) expiresAt = m[1];
        break;
      }
      if (pageText.includes('Gagal') || pageText.includes('Kedaluwarsa') || pageText.includes('Error')) {
        throw new Error('Verifikasi ditolak oleh ArkanStudio');
      }
      await new Promise(r => setTimeout(r, 500));
    }

    if (!success) {
      throw new Error('Timeout konfirmasi aktivasi lisensi dari ArkanStudio');
    }

    const result = {
      success: true,
      status: 'PREMIUM_ACTIVE',
      expiresAt: expiresAt || new Date(Date.now() + 365 * 86400000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
      activationDetail: 'Play Billing Resmi 1 Tahun'
    };

    console.log(`RESULT_JSON:${JSON.stringify(result)}`);
    return result;
  } finally {
    await browser.close();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'auto';
  const target = args[1] || '';

  try {
    if (mode === 'auto') {
      await handleAuto(target);
    } else if (mode === 'send') {
      await handleSend(target);
    } else if (mode === 'verify') {
      await handleVerify(target);
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
