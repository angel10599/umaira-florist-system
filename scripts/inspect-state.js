const fs = require('fs');
const lines = fs.readFileSync('js/state.js', 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('catalog') || l.includes('FLOWER_DATA') || l.includes('fetch')) {
    console.log(`L${i+1}: ${l.trim().slice(0, 110)}`);
  }
});
