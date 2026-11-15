const fs = require('fs');
const s = fs.readFileSync('server/store.js', 'utf8');
const lines = s.split('\n');

lines.forEach((l, i) => {
  if (l.includes('archiveFlower') || l.includes('restoreFlower') || l.includes('archiveBouquet') || l.includes('restoreBouquet') || l.includes('saveBouquet')) {
    console.log(`L${i+1}: ${l.trim().slice(0, 110)}`);
  }
});
