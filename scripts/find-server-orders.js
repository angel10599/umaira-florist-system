const fs = require('fs');
const s = fs.readFileSync('server.js', 'utf8');
const lines = s.split('\n');

lines.forEach((l, i) => {
  if (l.includes('/orders') || l.includes('handleCreateOrder')) {
    console.log(`L${i+1}: ${l.trim().slice(0, 110)}`);
  }
});
