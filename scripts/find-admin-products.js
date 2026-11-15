const fs = require('fs');
const s = fs.readFileSync('js/admin.js', 'utf8');
const lines = s.split('\n');

lines.forEach((l, i) => {
  if (l.includes('saveFlower') || l.includes('saveBouquet') || l.includes('/api/admin/flowers') || l.includes('/api/admin/bouquets') || l.includes('renderProducts') || l.includes('product-modal')) {
    console.log(`L${i+1}: ${l.trim().slice(0, 110)}`);
  }
});
