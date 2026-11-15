const fs = require('fs');
const s = fs.readFileSync('js/admin.js', 'utf8');
const lines = s.split('\n');

lines.forEach((l, i) => {
  if (l.includes('editBouquet') || l.includes('editFlower') || (l.includes('openProductModal') && i > 2200 && i < 2400)) {
    console.log(`L${i+1}: ${l.trim().slice(0, 110)}`);
  }
});
