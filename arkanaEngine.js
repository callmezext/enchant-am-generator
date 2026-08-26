/**
 * Arkana Engine - Node.js wrapper for ArkanStudio browser automation
 * Supports: auto mode, bulk mode, manual send, manual verify
 */

const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const emailStore = require('./emailStore');

const WORKER = path.join(__dirname, 'arkana_worker_pptr.js');

class ArkanaEngine {
  _log(msg) {
    console.log(`[Arkana ${new Date().toISOString().slice(11, 19)}] ${msg}`);
  }

  _runWorker(args, timeoutMs = 180000, onProgress = null) {
    return new Promise((resolve, reject) => {
      this._log(`Worker: node arkana_worker_pptr.js ${args[0]} [${args.slice(1).join(' ').substring(0, 80)}...]`);

      const proc = spawn(process.execPath, [WORKER, ...args], {
        cwd: __dirname,
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => {
        const s = d.toString('utf-8');
        stdout += s;
        s.split('\n').forEach((rawLine) => {
          const l = rawLine.trim();
          if (!l) return;
          if (l.startsWith('PROGRESS_JSON:') && onProgress) {
            try {
              const progressData = JSON.parse(l.replace('PROGRESS_JSON:', '').trim());
              onProgress(progressData);
            } catch (e) {}
          } else if (!l.startsWith('RESULT_JSON:')) {
            this._log(l);
          }
        });
      });

      proc.stderr.on('data', (d) => {
        stderr += d.toString('utf-8');
      });

      proc.on('close', (code) => {
        const clean = stdout.replace(/\r/g, '');
        const match = clean.match(/RESULT_JSON:(.+)/);
        if (match) {
          try {
            resolve(JSON.parse(match[1].trim()));
          } catch (e) {
            this._log(`Parse error: ${e.message}, raw: ${match[1].substring(0, 200)}`);
            reject(new Error('Failed to parse worker result'));
          }
        } else if (code !== 0) {
          this._log(`Worker stderr: ${stderr.substring(0, 300)}`);
          reject(new Error(stderr || `Worker exited with code ${code}`));
        } else {
          this._log(`No RESULT_JSON found in stdout (${clean.length} chars)`);
          reject(new Error('No result from worker'));
        }
      });

      setTimeout(() => {
        proc.kill();
        reject(new Error('Timeout'));
      }, timeoutMs);
    });
  }

  // Auto mode: single account
  async activateAuto(customUsername) {
    let username = '';
    if (customUsername) {
      username = customUsername.toLowerCase().trim().replace(/@enchant\.id$/i, '').replace(/[^a-z0-9_.-]/g, '');
    }
    if (!username) {
      username = 'am' + crypto.randomBytes(4).toString('hex');
    }
    const email = `${username}@enchant.id`;

    this._log(`🚀 Auto single mode for: ${email}`);
    emailStore.registerMailbox(username);
    emailStore.clearInbox(email);

    const result = await this._runWorker(['auto', email]);
    result.email = email;
    return result;
  }

  // Bulk mode: multiple accounts with parallel concurrency
  async activateBulk(options = {}, onProgress = null) {
    const count = Math.min(Math.max(parseInt(options.count || '5', 10), 1), 25);
    const rawPrefix = (options.prefix || 'am').toLowerCase().trim().replace(/[^a-z0-9_.-]/g, '');
    const prefix = rawPrefix ? rawPrefix.replace(/_+$/, '') + '_' : 'am_';
    const concurrency = Math.min(Math.max(parseInt(options.concurrency || '3', 10), 1), 5);

    const emails = [];
    for (let i = 0; i < count; i++) {
      const uniqueSuffix = crypto.randomBytes(3).toString('hex') + (i + 1);
      const username = `${prefix}${uniqueSuffix}`;
      const email = `${username}@enchant.id`;
      emailStore.registerMailbox(username);
      emailStore.clearInbox(email);
      emails.push(email);
    }

    this._log(`🚀 Bulk mode: Generating ${count} accounts with concurrency ${concurrency}...`);
    const timeoutMs = Math.max(count * 30000, 180000);
    const result = await this._runWorker(['bulk', JSON.stringify(emails), concurrency.toString()], timeoutMs, onProgress);
    return result;
  }

  // Manual step 1: send verification email
  async manualSend(email) {
    this._log(`📧 Manual send: ${email}`);
    if (email.endsWith('@enchant.id')) {
      const key = emailStore.normalizeKey(email);
      emailStore.registerMailbox(key);
      emailStore.clearInbox(email);
    }
    return await this._runWorker(['send', email]);
  }

  // Manual step 2: verify with magic link
  async manualVerify(magicLink) {
    this._log(`🔗 Manual verify...`);
    return await this._runWorker(['verify', magicLink]);
  }
}

module.exports = new ArkanaEngine();
