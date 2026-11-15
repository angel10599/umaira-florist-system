const fs = require('fs');
const s = fs.readFileSync('js/app.js', 'utf8');
const lines = s.split('\n');

lines.forEach((l, i) => {
  if (l.includes('init()') || l.includes('loadCatalog') || l.includes('window.addEventListener(\'DOMContentLoaded\'') || l.includes('window.addEventListener(\'load\'')) {
    console.log(`L${i+1}: ${l.trim().slice(0, 110)}`);
  }
});
