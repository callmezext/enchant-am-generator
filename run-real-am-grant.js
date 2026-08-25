const GenerateAmPremAkun = require('./amPremEngine');

(async () => {
  console.log('--- Running Full Auto AM Premium Generator ---');
  const engine = new GenerateAmPremAkun({
    solverType: 'theyka',
    theykaUrl: 'http://localhost:5000/turnstile',
    debug: true
  });

  try {
    const result = await engine.runFullWorkflow('admin');
    console.log('RESULT:', JSON.stringify(result, null, 2));
  } catch (e) {
    console.error('Error:', e.message);
  }
})();
