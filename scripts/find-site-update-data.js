const fs = require('fs');
const s = fs.readFileSync('js/site-update.js', 'utf8');
const lines = s.split('\n');

lines.forEach((l, i) => {
  if (l.includes('featuredBouquets') || l.includes('mainFlowers') || l.includes('FLOWER_DATA')) {
    console.log(`L${i+1}: ${l.trim().slice(0, 110)}`);
  }
});
