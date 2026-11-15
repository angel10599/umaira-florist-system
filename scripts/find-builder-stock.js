const fs = require('fs');
const s = fs.readFileSync('js/builder.js', 'utf8');
const lines = s.split('\n');

lines.forEach((l, i) => {
  if (l.includes('updateMainFlowerQty') || l.includes('stockCount') || l.includes('stock')) {
    console.log(`L${i+1}: ${l.trim().slice(0, 110)}`);
  }
});
