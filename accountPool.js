/**
 * Account Pool & Continuous Background Ad Farmer
 * Pre-farms and maintains a stock of generator accounts with FULL ad points (5/5)
 * By Zx
 */

const fs = require('fs');
const path = require('path');
const GenerateAmPremAkun = require('./coreEngine');

const ACCOUNTS_FILE = path.join(__dirname, 'accounts.json');

class AccountPool {
  constructor(opts = {}) {
    this.targetReadyAccounts = opts.targetReadyAccounts || 3;
    this.accounts = [];
    this.isFarming = false;
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(ACCOUNTS_FILE)) {
        this.accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
      }
    } catch (e) {
      console.error('[AccountPool] Error load accounts:', e.message);
      this.accounts = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(this.accounts, null, 2), 'utf8');
    } catch (e) {
      console.error('[AccountPool] Error save accounts:', e.message);
    }
  }

  // Get account that already has FULL ad points (5/5)
  getReadyAccount() {
    this.load();
    const readyIdx = this.accounts.findIndex(a => 
      (a.adsCompleted >= 5 || a.adPoints >= 1) && 
      a.cookies && a.cookies.length > 0 && 
      a.isReady === true
    );

    if (readyIdx !== -1) {
      const acc = this.accounts[readyIdx];
      console.log(`[AccountPool] 🎯 Menggunakan akun siap pakai (Poin Iklan Penuh): ${acc.email}`);
      // Mark as used so another request gets another ready account
      acc.isReady = false;
      this.save();
      // Trigger background farmer to replenish
      this.maintainPool().catch(() => {});
      return acc;
    }

    console.log('[AccountPool] ⚠️ Tidak ada akun siap di pool, menggunakan akun pertama...');
    return this.accounts[0] || null;
  }

  upsert(accData) {
    this.load();
    const idx = this.accounts.findIndex(a => a.email === accData.email);
    if (idx >= 0) {
      this.accounts[idx] = { ...this.accounts[idx], ...accData, updatedAt: new Date().toISOString() };
    } else {
      this.accounts.unshift({ ...accData, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }
    this.save();
  }

  // Start background auto-farmer loop
  startBackgroundFarmer() {
    console.log('[AccountPool] 🌾 Background Ad Farmer diaktifkan.');
    setInterval(() => {
      this.maintainPool().catch(err => console.error('[Pool Farmer] Error:', err.message));
    }, 45000); // Check pool every 45s

    setTimeout(() => {
      this.maintainPool().catch(err => console.error('[Pool Farmer] Error:', err.message));
    }, 3000);
  }

  async maintainPool() {
    if (this.isFarming) return;
    this.load();

    const readyCount = this.accounts.filter(a => a.isReady === true && a.cookies && a.cookies.length > 0).length;
    if (readyCount >= this.targetReadyAccounts) {
      return; // Stock is full
    }

    this.isFarming = true;
    console.log(`[Pool Farmer] 🌾 Stok akun berpoin: ${readyCount}/${this.targetReadyAccounts}. Memulai farming iklan di background...`);

    try {
      const engine = new GenerateAmPremAkun({ debug: false });
      await engine.register();
      await engine.login();

      console.log(`[Pool Farmer] 📺 Mengumpulkan 5 iklan penuh di background untuk ${engine.credentials.email}...`);

      // Watch 5 ads in the background
      for (let i = 1; i <= 5; i++) {
        await engine._post('/api/ads/record', { source: 'generator-v2' }, { allowFail: true, silent: true });
        await engine._post('/api/ads/record', {}, { allowFail: true, silent: true });
        if (i < 5) await engine._sleep(15500);
      }

      this.upsert({
        email: engine.credentials.email,
        password: engine.credentials.password,
        adPoints: 10,
        adsCompleted: 5,
        isReady: true,
        cookies: [...engine.cookies.entries()],
        stage: 'ready'
      });

      console.log(`[Pool Farmer] ✅ Sukses farming 1 akun dengan POIN PENUH! (${engine.credentials.email})`);
    } catch (e) {
      console.error(`[Pool Farmer] ⚠️ Gagal farming akun: ${e.message}`);
    } finally {
      this.isFarming = false;
    }
  }
}

module.exports = new AccountPool();
