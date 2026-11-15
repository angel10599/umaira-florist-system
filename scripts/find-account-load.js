const fs = require('fs');
const s = fs.readFileSync('js/account.js', 'utf8');
const lines = s.split('\n');

lines.forEach((l, i) => {
  if (l.includes('loadCatalog') || l.includes('DOMContentLoaded') || l.includes('load')) {
    console.log(`L${i+1}: ${l.trim().slice(0, 110)}`);
  }
});
