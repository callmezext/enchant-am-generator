/**
 * Robust SMTP Server & Webhook Email Receiver
 */

const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');
const emailStore = require('./emailStore');

class SMTPOperator {
  constructor() {
    this.server = null;
  }

  start(port = 2525) {
    try {
      this.server = new SMTPServer({
        authOptional: true,
        disabledCommands: ['AUTH'],
        onData: (stream, session, callback) => {
          simpleParser(stream, {}, (err, parsed) => {
            if (err) {
              console.error('[SMTP] Error parsing email:', err.message);
              return callback(err);
            }

            const recipients = session.envelope.rcptTo.map(r => r.address);
            const from = session.envelope.mailFrom ? session.envelope.mailFrom.address : (parsed.from?.text || 'unknown');

            for (const rcpt of recipients) {
              emailStore.addMessage(rcpt, {
                from: from,
                subject: parsed.subject || '',
                text: parsed.text || '',
                html: parsed.html || parsed.textAsHtml || ''
              });
            }

            callback();
          });
        }
      });

      this.server.listen(port, () => {
        console.log(`[SMTP] Server email aktif di port ${port}`);
      });

      this.server.on('error', (err) => {
        console.log(`[SMTP] Info: Port ${port} (${err.message})`);
      });
    } catch (e) {
      console.log('[SMTP] Note:', e.message);
    }
  }

  // Handle incoming HTTP Webhook (Cloudflare Email Worker, SendGrid, Mailgun, Brevo, raw MIME)
  async handleWebhook(body, headers = {}) {
    let to = '';
    let from = 'noreply@alightmotion.com';
    let subject = '';
    let text = '';
    let html = '';

    // Case 1: Body is a raw string/buffer
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      const parsed = await simpleParser(body);
      to = parsed.to ? (Array.isArray(parsed.to) ? parsed.to[0].text : parsed.to.text) : '';
      from = parsed.from ? parsed.from.text : from;
      subject = parsed.subject || '';
      text = parsed.text || '';
      html = parsed.html || '';
    } 
    // Case 2: Body is JSON object
    else if (typeof body === 'object' && body !== null) {
      to = body.to || body.recipient || headers['x-recipient'] || '';
      from = body.from || body.sender || headers['x-sender'] || from;
      subject = body.subject || '';
      text = body.text || body.body || body['body-plain'] || '';
      html = body.html || body['body-html'] || '';

      // If Cloudflare Worker sent raw MIME inside JSON { to, from, raw }
      if (body.raw) {
        try {
          const parsed = await simpleParser(body.raw);
          if (!to && parsed.to) {
            to = Array.isArray(parsed.to) ? parsed.to[0].text : parsed.to.text;
          }
          if (!subject && parsed.subject) subject = parsed.subject;
          if (!text && parsed.text) text = parsed.text;
          if (!html && parsed.html) html = parsed.html;
          if (from === 'noreply@alightmotion.com' && parsed.from) from = parsed.from.text;
        } catch (e) {
          console.error('[Webhook] Error parsing raw MIME in JSON:', e.message);
          text = text || body.raw;
        }
      }

      // Check envelope
      if (!to && body.envelope) {
        try {
          const env = typeof body.envelope === 'string' ? JSON.parse(body.envelope) : body.envelope;
          to = env.to ? (Array.isArray(env.to) ? env.to[0] : env.to) : '';
        } catch {}
      }
    }

    // Clean 'to' address (e.g. "Andi <andi@enchant.id>" -> "andi@enchant.id")
    if (to) {
      const match = to.match(/<([^>]+)>/);
      if (match) to = match[1];
      to = to.trim().toLowerCase();
    }

    if (!to) {
      // Fallback: Check headers
      to = headers['x-to'] || headers['x-recipient'] || 'default@enchant.id';
    }

    return emailStore.addMessage(to, { from, subject, text, html });
  }
}

module.exports = new SMTPOperator();
