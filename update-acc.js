const fs = require('fs');

const activeCookies = [
  ["connect.sid", "s%3A_eZ7K9Z0dJ9_3zM8pL5kR7wT.abcdef1234567890"]
];

const accs = JSON.parse(fs.readFileSync('accounts.json', 'utf8'));
accs[0].adPoints = 12;
accs[0].stage = 'select_email';
accs[0].adsCompleted = 5;
fs.writeFileSync('accounts.json', JSON.stringify(accs, null, 2), 'utf8');
console.log('Updated accounts.json with active points!');
