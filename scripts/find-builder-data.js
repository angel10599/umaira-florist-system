const fs = require('fs');
const s = fs.readFileSync('js/builder.js', 'utf8');
const lines = s.split('\n');

lines.forEach((l, i) => {
  if (l.includes('FLOWER_DATA') || l.includes('mainFlowers') || l.includes('fillerFlowers') || l.includes('wrappingOptions')) {
    console.log(`L${i+1}: ${l.trim().slice(0, 110)}`);
  }
});
