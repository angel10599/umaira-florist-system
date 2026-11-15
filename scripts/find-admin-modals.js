const fs = require('fs');
const s = fs.readFileSync('admin.html', 'utf8');
const lines = s.split('\n');

lines.forEach((l, i) => {
  if (l.includes('id="admin-') && l.includes('modal"')) {
    console.log(`L${i+1}: ${l.trim().slice(0, 110)}`);
  }
});
