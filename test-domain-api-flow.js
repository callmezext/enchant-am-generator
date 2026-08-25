const https = require('https');
const http = require('http');
const emailStore = require('./emailStore');
const GenerateAmPremAkun = require('./amPremEngine');

(async () => {
  const targetEmail = 'vipuser@enchant.id';
  console.log(`=== Testing Auto AM Premium via Domain API: ${targetEmail} ===`);

  // Ensure mailbox is registered in our domain store
  emailStore.registerMailbox(targetEmail);

  const engine = new GenerateAmPremAkun({ debug: true });

  console.log('1. Triggering Firebase Auth Email to', targetEmail);
  const ok = await engine.triggerAMLogin(targetEmail);
  console.log('Trigger result:', ok);

  console.log('2. Waiting for incoming email in our enchant.id API inbox...');
  let magicLink = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const msgs = emailStore.getMessages(targetEmail);
    console.log(`Polling inbox (attempt #${i+1}): ${msgs.length} messages found`);
    if (msgs.length > 0) {
      const msg = msgs[0];
      console.log('Email received from:', msg.from, 'Subject:', msg.subject);
      magicLink = msg.magicLink || (msg.links && msg.links[0]);
      if (magicLink) {
        console.log('✓ Magic link automatically intercepted from enchant.id inbox:', magicLink);
        break;
      }
    }
  }

  if (magicLink) {
    const oobCode = engine._extractOobCode(magicLink);
    console.log('Extracted oobCode:', oobCode);
    if (oobCode) {
      const tokens = await engine.getFirebaseTokens(targetEmail, oobCode);
      console.log('Firebase Tokens:', tokens);
    }
  }
})();
