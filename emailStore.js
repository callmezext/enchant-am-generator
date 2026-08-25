/**
 * Enchant Temp Mail - Store with Mailbox Registry Persistence
 * By Zx
 */

const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REGISTRY_FILE = path.join(__dirname, 'mailboxes.json');
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

class EmailStore extends EventEmitter {
  constructor() {
    super();
    this.inboxes = new Map(); // normalized key -> Array of messages
    this.messageIndex = new Map(); // message id -> message object
    this.mailboxes = new Set(); // Set of registered normalized usernames

    this.loadFromDisk();
  }

  loadFromDisk() {
    try {
      if (fs.existsSync(REGISTRY_FILE)) {
        const list = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
        if (Array.isArray(list)) {
          list.forEach(u => this.mailboxes.add(u.toLowerCase()));
        }
      }
      if (fs.existsSync(MESSAGES_FILE)) {
        const msgs = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8'));
        if (Array.isArray(msgs)) {
          msgs.forEach(m => {
            const key = this.normalizeKey(m.to);
            if (!this.inboxes.has(key)) this.inboxes.set(key, []);
            this.inboxes.get(key).push(m);
            this.messageIndex.set(m.id, m);
          });
        }
      }
    } catch (e) {
      console.error('[EmailStore] Error loading disk data:', e.message);
    }
  }

  saveToDisk() {
    try {
      fs.writeFileSync(REGISTRY_FILE, JSON.stringify([...this.mailboxes], null, 2), 'utf8');
      const allMsgs = [...this.messageIndex.values()];
      fs.writeFileSync(MESSAGES_FILE, JSON.stringify(allMsgs, null, 2), 'utf8');
    } catch (e) {
      console.error('[EmailStore] Error saving disk data:', e.message);
    }
  }

  normalizeKey(emailOrUser) {
    if (!emailOrUser) return '';
    let norm = emailOrUser.trim().toLowerCase();
    if (norm.endsWith('@enchant.id') || norm.endsWith('@mail.enchant.id')) {
      return norm.split('@')[0];
    }
    if (norm.startsWith('@')) {
      norm = norm.slice(1);
    }
    return norm;
  }

  // Register a mailbox
  registerMailbox(emailOrUser) {
    const key = this.normalizeKey(emailOrUser);
    if (!key) return null;
    this.mailboxes.add(key);
    if (!this.inboxes.has(key)) {
      this.inboxes.set(key, []);
    }
    this.saveToDisk();
    return {
      username: key,
      email: `${key}@enchant.id`,
      createdAt: new Date().toISOString()
    };
  }

  // Check if mailbox exists
  isMailboxRegistered(emailOrUser) {
    const key = this.normalizeKey(emailOrUser);
    return this.mailboxes.has(key);
  }

  // List all registered mailboxes
  listMailboxes() {
    return [...this.mailboxes].map(key => ({
      username: key,
      email: `${key}@enchant.id`,
      messageCount: (this.inboxes.get(key) || []).length
    }));
  }

  getOrCreateInbox(emailOrUser) {
    const key = this.normalizeKey(emailOrUser);
    if (!this.inboxes.has(key)) {
      this.inboxes.set(key, []);
    }
    return this.inboxes.get(key);
  }

  getMessages(emailOrUser) {
    return this.getOrCreateInbox(emailOrUser);
  }

  getMessageById(messageId) {
    return this.messageIndex.get(messageId) || null;
  }

  deleteMessage(messageId) {
    const msg = this.messageIndex.get(messageId);
    if (!msg) return false;

    const key = this.normalizeKey(msg.to);
    const inbox = this.inboxes.get(key);
    if (inbox) {
      const idx = inbox.findIndex(m => m.id === messageId);
      if (idx !== -1) inbox.splice(idx, 1);
    }
    this.messageIndex.delete(messageId);
    this.saveToDisk();
    this.emit(`delete:${key}`, { id: messageId });
    return true;
  }

  clearInbox(emailOrUser) {
    const key = this.normalizeKey(emailOrUser);
    const inbox = this.inboxes.get(key) || [];
    inbox.forEach(m => this.messageIndex.delete(m.id));
    this.inboxes.set(key, []);
    this.saveToDisk();
    this.emit(`clear:${key}`);
    return true;
  }

  extractOtp(text, html) {
    const content = (text || '') + ' ' + (html || '');
    // Explicit OTP keywords only so timestamps/years like 2026 are never mistaken for OTP
    const explicitMatch = content.match(/(?:otp|verification code|kode verifikasi|kode otp|security code|pin code)\s*(?:is|:|\s)\s*([0-9]{4,8})/i)
      || content.match(/(?:kode|code)\s*(?:is|:)\s*([A-Za-z0-9]{4,8})/i);
    return explicitMatch ? explicitMatch[1] : null;
  }

  extractLoginLink(text, html) {
    const content = (text || '') + ' ' + (html || '');
    const urlMatches = content.match(/https?:\/\/[^\s"'<>]+/gi) || [];
    if (!urlMatches.length) return null;

    // Highest priority: Alight Creative magic link or Firebase Auth sign-in link
    const magicLink = urlMatches.find(u => 
      u.includes('alight-creative.firebaseapp.com') ||
      u.includes('/auth/links') ||
      (u.includes('apiKey=') && u.includes('mode=signIn')) ||
      u.includes('continueUrl=')
    );
    if (magicLink) return magicLink.replace(/[.,;)]+$/, '');

    // Second priority: Any authentication, verification, or login URL
    const verifyLink = urlMatches.find(u => 
      u.toLowerCase().includes('verify') || 
      u.toLowerCase().includes('login') || 
      u.toLowerCase().includes('signin') || 
      u.toLowerCase().includes('auth') ||
      u.toLowerCase().includes('token=')
    );
    if (verifyLink) return verifyLink.replace(/[.,;)]+$/, '');

    return urlMatches[0] ? urlMatches[0].replace(/[.,;)]+$/, '') : null;
  }

  extractLinks(text, html) {
    const content = (text || '') + ' ' + (html || '');
    const urlMatches = content.match(/https?:\/\/[^\s"'<>]+/gi) || [];
    return [...new Set(urlMatches.map(u => u.replace(/[.,;)]+$/, '')))];
  }

  addMessage(recipientOrMsg, maybeMessageData) {
    let recipient, messageData;
    if (typeof recipientOrMsg === 'object' && !maybeMessageData) {
      messageData = recipientOrMsg;
      recipient = messageData.to || messageData.recipient || '';
    } else {
      recipient = recipientOrMsg;
      messageData = maybeMessageData || {};
    }

    const key = this.normalizeKey(recipient);
    // Auto register mailbox when receiving external email
    this.mailboxes.add(key);

    const inbox = this.getOrCreateInbox(key);

    const text = messageData.text || '';
    const html = messageData.html || '';
    const id = messageData.id || crypto.randomBytes(8).toString('hex');
    const links = messageData.links || this.extractLinks(text, html);
    const otp = messageData.otp || this.extractOtp(text, html);
    const loginLink = messageData.loginLink || this.extractLoginLink(text, html);

    const msg = {
      id,
      from: messageData.from || 'unknown@sender.com',
      to: recipient.includes('@') ? recipient : `${recipient}@enchant.id`,
      subject: messageData.subject || '(Tanpa Subjek)',
      text,
      html,
      otp,
      loginLink,
      links,
      raw: messageData.raw || null,
      size: (text.length + html.length) || 0,
      receivedAt: messageData.receivedAt || new Date().toISOString()
    };

    inbox.unshift(msg);
    if (inbox.length > 100) {
      const removed = inbox.pop();
      this.messageIndex.delete(removed.id);
    }
    this.messageIndex.set(msg.id, msg);

    this.saveToDisk();

    console.log(`[EmailStore] 📬 Email baru untuk [${key}] (${msg.to}) dari <${msg.from}>: "${msg.subject}"`);

    this.emit('message', { email: key, message: msg });
    this.emit(`message:${key}`, msg);

    // Auto-forward to paired WhatsApp users
    try {
      const waBotService = require('./waBotService');
      waBotService.forwardEmailNotification({
        mailboxKey: key,
        from: msg.from,
        to: msg.to,
        subject: msg.subject,
        text: msg.text,
        html: msg.html,
        otp: msg.otp,
        loginLink: msg.loginLink
      }).catch(e => console.error('[WABot Forward Error]:', e.message));
    } catch (e) {}

    return msg;
  }
}

module.exports = new EmailStore();
