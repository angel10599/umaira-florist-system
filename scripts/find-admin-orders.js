const fs = require('fs');
const s = fs.readFileSync('js/admin.js', 'utf8');
const lines = s.split('\n');

lines.forEach((l, i) => {
  if (l.includes('renderOrdersTable') || l.includes('statusBadge') || (l.includes('status') && l.includes('Confirmed'))) {
    console.log(`L${i+1}: ${l.trim().slice(0, 110)}`);
  }
});
