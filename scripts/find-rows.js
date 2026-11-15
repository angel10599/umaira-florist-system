const fs = require('fs');
const s = fs.readFileSync('server/store.js', 'utf8');
const lines = s.split('\n');

lines.forEach((l, i) => {
  if (l.includes('flowerRow') || l.includes('bouquetRow') || l.includes('orderRow')) {
    console.log(`L${i+1}: ${l.trim().slice(0, 110)}`);
  }
});
