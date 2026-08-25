/**
 * Arkana Engine - Node.js wrapper for ArkanStudio browser automation
 * Supports: auto mode, manual send, manual verify
 */

const { spawn } = require('child_process');
const path = require('path');
const crypto = require('crypto');
const emailStore = require('./emailStore');

const WORKER = path.join(__dirname, 'arkana_worker_pptr.js');

class ArkanaEngine {
  _log(msg) {
    console.log(`[Arkana ${new Date().toISOString().slice(11,19)}] ${msg}`);
  }

  _runWorker(args, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
      this._log(`Worker: node arkana_worker_pptr.js ${args.join(' ')}`);

      const proc = spawn(process.execPath, [WORKER, ...args], {
        cwd: __dirname,
        env: { ...process.env }
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => {
        const s = d.toString('utf-8');
        stdout += s;
        s.split('\n').filter(l => l.trim() && !l.trim().startsWith('RESULT_JSON:')).forEach(l => this._log(l.trim()));
      });
      proc.stderr.on('data', (d) => { stderr += d.toString('utf-8'); });

      proc.on('close', (code) => {
        // Normalize Windows line endings
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

      setTimeout(() => { proc.kill(); reject(new Error('Timeout')); }, timeoutMs);
    });
  }

  // Auto mode: random or custom @enchant.id email, fully automatic
  async activateAuto(customUsername) {
    let username = '';
    if (customUsername) {
      username = customUsername.toLowerCase().trim().replace(/@enchant\.id$/i, '').replace(/[^a-z0-9_.-]/g, '');
    }
    if (!username) {
      username = 'am' + crypto.randomBytes(4).toString('hex');
    }
    const email = `${username}@enchant.id`;

    this._log(`🚀 Auto mode for: ${email}`);
    emailStore.registerMailbox(username);
    emailStore.clearInbox(email);

    const result = await this._runWorker(['auto', email]);
    result.email = email;
    return result;
  }

  // Manual step 1: send verification email to user's email
  async manualSend(email) {
    this._log(`📧 Manual send: ${email}`);

    // If @enchant.id, register mailbox
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
