const fs = require('fs');
const s = fs.readFileSync('server/store.js', 'utf8');
const lines = s.split('\n');

lines.forEach((l, i) => {
  if (l.includes('placeOrder(') || l.includes('function placeOrder')) {
    console.log(`L${i+1}: ${l.trim().slice(0, 110)}`);
  }
});
