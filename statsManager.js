/**
 * Stats & Admin Config Manager for Enchant AM Premium
 * Handles metrics tracking, daily limits, and admin settings.
 */

const fs = require('fs');
const path = require('path');
const emailStore = require('./emailStore');

const STATS_FILE = path.join(__dirname, 'stats.json');
const ADMIN_EMAILS = ['gunturafandy5@gmail.com'];

class StatsManager {
  constructor() {
    this.data = {
      dailyLimitPerUser: 5,
      totalActivations: 3256,
      recentDurations: [18.2, 19.5, 21.0, 17.8, 18.9, 20.4],
      dailyUsage: {}, // "YYYY-MM-DD": { "user@email.com": count }
      history: [],
      bannedIPs: {}, // { [ip]: { ip, userEmail, bannedAt, reason, requestCount } }
      securityLogs: [] // [ { id, timestamp, ip, userEmail, action, reason } ]
    };
    this.ipTracker = new Map(); // ip -> [timestamps]
    this.load();
  }

  getTodayDateKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  load() {
    try {
      if (fs.existsSync(STATS_FILE)) {
        const raw = fs.readFileSync(STATS_FILE, 'utf8');
        const loaded = JSON.parse(raw);
        this.data = {
          ...this.data,
          ...loaded,
          bannedIPs: loaded.bannedIPs || {},
          securityLogs: loaded.securityLogs || []
        };
      }
    } catch (e) {
      console.error('[StatsManager] Error loading stats.json:', e.message);
    }
  }

  save() {
    try {
      fs.writeFileSync(STATS_FILE, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('[StatsManager] Error saving stats.json:', e.message);
    }
  }

  isAdmin(email) {
    if (!email) return false;
    return ADMIN_EMAILS.includes(email.trim().toLowerCase());
  }

  // ===== IP SPAM DETECTION & AUTO-BAN =====
  isIpBanned(ip) {
    if (!ip) return false;
    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    return !!(this.data.bannedIPs && this.data.bannedIPs[cleanIp]);
  }

  getBannedInfo(ip) {
    if (!ip) return null;
    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    return this.data.bannedIPs ? this.data.bannedIPs[cleanIp] : null;
  }

  trackAndCheckIpSpam(ip, userEmail = 'guest', action = 'request') {
    if (!ip) return { allowed: true };
    const cleanIp = ip.replace(/^::ffff:/, '').trim();

    // Whitelist localhost/internal if admin
    if (this.isAdmin(userEmail) && (cleanIp === '127.0.0.1' || cleanIp === '::1')) {
      return { allowed: true };
    }

    if (this.isIpBanned(cleanIp)) {
      const ban = this.getBannedInfo(cleanIp);
      return {
        allowed: false,
        banned: true,
        reason: ban ? ban.reason : 'IP Anda telah diblokir karena terdeteksi melakukan spam.'
      };
    }

    const now = Date.now();
    if (!this.ipTracker.has(cleanIp)) {
      this.ipTracker.set(cleanIp, []);
    }
    const timestamps = this.ipTracker.get(cleanIp);
    // Keep requests within last 20 seconds
    const windowStart = now - 20000;
    const validTimestamps = timestamps.filter(t => t > windowStart);
    validTimestamps.push(now);
    this.ipTracker.set(cleanIp, validTimestamps);

    // Heuristics: More than 8 actions in 20 seconds -> AUTO BAN!
    if (validTimestamps.length >= 8) {
      this.autoBanIp(cleanIp, userEmail, action, validTimestamps.length);
      return {
        allowed: false,
        banned: true,
        reason: `IP ${cleanIp} diblokir otomatis oleh sistem karena aktivitas spam berlebih (${validTimestamps.length} request / 20 detik).`
      };
    }

    return { allowed: true, requestCount: validTimestamps.length };
  }

  autoBanIp(ip, userEmail, action, count) {
    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    if (!this.data.bannedIPs) this.data.bannedIPs = {};

    const reason = `Spam Terdeteksi: ${count}x ${action} dalam 20 detik`;
    const banRecord = {
      ip: cleanIp,
      userEmail: userEmail || 'guest',
      bannedAt: new Date().toISOString(),
      reason,
      requestCount: count
    };

    this.data.bannedIPs[cleanIp] = banRecord;

    this.logSecurityIncident({
      ip: cleanIp,
      userEmail: userEmail || 'guest',
      action: action || 'spam_detection',
      reason: `AUTO-BAN: ${reason}`,
      severity: 'HIGH'
    });

    this.save();
    console.warn(`[SECURITY AUTO-BAN] IP ${cleanIp} (Account: ${userEmail}) BANNED due to spam!`);
  }

  banIpManual({ adminEmail, ip, userEmail, reason }) {
    if (!this.isAdmin(adminEmail)) throw new Error('Akses ditolak: Hanya Owner yang dapat memblokir IP!');
    if (!ip) throw new Error('Alamat IP wajib diisi!');

    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    if (!this.data.bannedIPs) this.data.bannedIPs = {};

    this.data.bannedIPs[cleanIp] = {
      ip: cleanIp,
      userEmail: userEmail || 'manual_ban',
      bannedAt: new Date().toISOString(),
      reason: reason || 'Diblokir manual oleh Owner',
      requestCount: 0
    };

    this.logSecurityIncident({
      ip: cleanIp,
      userEmail: userEmail || 'manual_ban',
      action: 'manual_ban',
      reason: `Manual Ban oleh ${adminEmail}: ${reason || 'Blokir IP'}`,
      severity: 'CRITICAL'
    });

    this.save();
    return { success: true, banned: true, ip: cleanIp };
  }

  unbanIp({ adminEmail, ip }) {
    if (!this.isAdmin(adminEmail)) throw new Error('Akses ditolak: Hanya Owner yang dapat membuka blokir IP!');
    if (!ip) throw new Error('Alamat IP wajib diisi!');

    const cleanIp = ip.replace(/^::ffff:/, '').trim();
    if (this.data.bannedIPs && this.data.bannedIPs[cleanIp]) {
      delete this.data.bannedIPs[cleanIp];
    }
    if (this.ipTracker.has(cleanIp)) {
      this.ipTracker.delete(cleanIp);
    }

    this.logSecurityIncident({
      ip: cleanIp,
      userEmail: 'admin_action',
      action: 'unban',
      reason: `Dibuka blokirnya oleh Owner (${adminEmail})`,
      severity: 'INFO'
    });

    this.save();
    return { success: true, unbanned: true, ip: cleanIp };
  }

  logSecurityIncident({ ip, userEmail, action, reason, severity = 'MEDIUM' }) {
    if (!this.data.securityLogs) this.data.securityLogs = [];
    this.data.securityLogs.unshift({
      id: 'sec_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      ip: (ip || 'unknown').replace(/^::ffff:/, ''),
      userEmail: userEmail || 'guest',
      action,
      reason,
      severity
    });

    if (this.data.securityLogs.length > 100) {
      this.data.securityLogs.pop();
    }
  }

  getSecurityData(adminEmail) {
    if (!this.isAdmin(adminEmail)) throw new Error('Akses ditolak!');
    return {
      bannedIPs: Object.values(this.data.bannedIPs || {}),
      securityLogs: (this.data.securityLogs || []).slice(0, 50)
    };
  }

  getStats(userEmail = '') {
    const todayKey = this.getTodayDateKey();
    const todayUsageMap = this.data.dailyUsage[todayKey] || {};
    
    // Count activations today across all users from real database records
    let todayCount = 0;
    Object.values(todayUsageMap).forEach(cnt => { todayCount += (Number(cnt) || 0); });

    // Calculate Average Duration from recent successful activations
    const durations = (this.data.recentDurations && this.data.recentDurations.length) ? this.data.recentDurations : [19.5];
    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

    // Total Mailboxes from real emailStore registry
    const totalMailboxes = (emailStore && emailStore.mailboxes) ? emailStore.mailboxes.size : 0;

    const userCount = userEmail ? (todayUsageMap[userEmail.toLowerCase().trim()] || 0) : 0;
    const isAdm = this.isAdmin(userEmail);
    const limit = this.data.dailyLimitPerUser || 5;

    const bannedList = isAdm ? Object.values(this.data.bannedIPs || {}) : [];
    const secLogs = isAdm ? (this.data.securityLogs || []).slice(0, 30) : [];

    return {
      todayActivations: todayCount,
      totalActivations: Number(this.data.totalActivations) || 3256,
      totalMailboxes: totalMailboxes,
      avgProcessingSeconds: parseFloat(avgDuration.toFixed(1)),
      dailyLimitPerUser: limit,
      userUsageToday: userCount,
      userRemaining: isAdm ? 999999 : Math.max(0, limit - userCount),
      isAdmin: isAdm,
      bannedCount: Object.keys(this.data.bannedIPs || {}).length,
      bannedIPs: bannedList,
      securityLogs: secLogs
    };
  }

  canUserGenerate(userEmail) {
    if (!userEmail) return { allowed: true, remaining: 5, limit: 5 };
    const email = userEmail.toLowerCase().trim();
    if (this.isAdmin(email)) {
      return { allowed: true, remaining: 999999, limit: 999999, isAdmin: true };
    }

    const todayKey = this.getTodayDateKey();
    if (!this.data.dailyUsage[todayKey]) this.data.dailyUsage[todayKey] = {};
    
    const count = this.data.dailyUsage[todayKey][email] || 0;
    const limit = this.data.dailyLimitPerUser || 5;

    if (count >= limit) {
      return {
        allowed: false,
        error: `Batas harian kamu (${limit}x generate/hari) telah tercapai. Coba lagi besok atau hubungi Admin.`,
        remaining: 0,
        limit
      };
    }

    return {
      allowed: true,
      remaining: limit - count,
      limit
    };
  }

  recordActivation({ userEmail, targetEmail, mode, durationSeconds }) {
    const todayKey = this.getTodayDateKey();
    if (!this.data.dailyUsage[todayKey]) this.data.dailyUsage[todayKey] = {};
    
    if (userEmail) {
      const uEmail = userEmail.toLowerCase().trim();
      this.data.dailyUsage[todayKey][uEmail] = (this.data.dailyUsage[todayKey][uEmail] || 0) + 1;
    }

    this.data.totalActivations = (this.data.totalActivations || 12848) + 1;

    if (durationSeconds && durationSeconds > 0) {
      if (!this.data.recentDurations) this.data.recentDurations = [];
      this.data.recentDurations.push(parseFloat(durationSeconds.toFixed(1)));
      if (this.data.recentDurations.length > 20) this.data.recentDurations.shift();
    }

    if (!this.data.history) this.data.history = [];
    this.data.history.unshift({
      timestamp: new Date().toISOString(),
      userEmail: userEmail || 'guest',
      targetEmail,
      mode: mode || 'auto',
      durationSeconds: durationSeconds ? parseFloat(durationSeconds.toFixed(1)) : 18.0
    });
    if (this.data.history.length > 50) this.data.history.pop();

    this.save();
  }

  updateSettings({ adminEmail, dailyLimitPerUser, totalActivationsReset }) {
    if (!this.isAdmin(adminEmail)) {
      throw new Error('Akses ditolak: Hanya Owner / Admin yang dapat mengubah pengaturan!');
    }

    if (typeof dailyLimitPerUser === 'number' && dailyLimitPerUser > 0) {
      this.data.dailyLimitPerUser = dailyLimitPerUser;
    }

    if (typeof totalActivationsReset === 'number' && totalActivationsReset >= 0) {
      this.data.totalActivations = totalActivationsReset;
    }

    this.save();
    return this.getStats(adminEmail);
  }
}

module.exports = new StatsManager();
