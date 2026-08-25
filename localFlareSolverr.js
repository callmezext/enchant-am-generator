/**
 * Built-in FlareSolverr Compatible Server on Port 8191
 * Powered by local Chrome & Puppeteer-Core
 */

const http = require('http');
const puppeteer = require('puppeteer-core');
const fs = require('fs');

const CHROME_PATHS = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];

function getChromePath() {
  for (const p of CHROME_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

async function solveUrl(targetUrl, timeoutMs = 45000) {
  const executablePath = getChromePath();
  if (!executablePath) throw new Error('Chrome/Edge executable not found.');

  const browser = await puppeteer.launch({
    executablePath,
    headless: false,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--window-size=900,700'
    ]
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36');
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: timeoutMs });

    let token = null;
    const start = Date.now();

    while (Date.now() - start < timeoutMs) {
      token = await page.evaluate(() => {
        const inp = document.querySelector('input[name="cf-turnstile-response"]') ||
                      document.querySelector('[name="turnstile-token"]') ||
                      document.querySelector('input[name="turnstileToken"]');
        if (inp && inp.value && inp.value.length > 50) return inp.value;

        // Check window callbacks
        if (window.turnstileToken && window.turnstileToken.length > 50) return window.turnstileToken;
        return null;
      });

      if (token) break;
      await new Promise(r => setTimeout(r, 800));
    }

    const html = await page.content();
    const cookies = await page.cookies();
    const userAgent = await page.evaluate(() => navigator.userAgent);

    return {
      token,
      html,
      cookies,
      userAgent
    };
  } finally {
    await browser.close();
  }
}

function startFlareSolverrServer(port = 8191) {
  const server = http.createServer(async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      return res.end();
    }

    if (req.url === '/' || req.url === '/v1') {
      if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({
          msg: 'FlareSolverr is ready!',
          version: 'v3.3.21-builtin',
          userAgent: 'Mozilla/5.0'
        }));
      }

      if (req.method === 'POST') {
        let bodyStr = '';
        req.on('data', chunk => bodyStr += chunk);
        req.on('end', async () => {
          try {
            const body = JSON.parse(bodyStr || '{}');
            const targetUrl = body.url;
            if (!targetUrl) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ status: 'error', message: 'Parameter "url" wajib diisi.' }));
            }

            console.log(`[FlareSolverr] Memproses request: ${targetUrl}...`);
            const result = await solveUrl(targetUrl, body.maxTimeout || 45000);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              status: 'ok',
              message: 'Challenge solved successfully',
              startTimestamp: Date.now(),
              endTimestamp: Date.now(),
              version: 'v3.3.21-builtin',
              solution: {
                url: targetUrl,
                status: 200,
                headers: {},
                response: result.html,
                cookies: result.cookies,
                userAgent: result.userAgent,
                token: result.token
              }
            }));
          } catch (err) {
            console.error('[FlareSolverr Error]:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
              status: 'error',
              message: `FlareSolverr Error: ${err.message}`
            }));
          }
        });
        return;
      }
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => {
    console.log(`[FlareSolverr] Built-in FlareSolverr Server aktif di http://localhost:${port}/v1`);
  });

  server.on('error', (err) => {
    console.log(`[FlareSolverr] Port ${port} info: ${err.message}`);
  });

  return server;
}

module.exports = { startFlareSolverrServer, solveUrl };

if (require.main === module) {
  startFlareSolverrServer(8191);
}
