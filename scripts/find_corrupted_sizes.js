const fs = require('fs');

const html = fs.readFileSync('admin.html', 'utf8');
const js = fs.readFileSync('js/admin.js', 'utf8');

console.log('=== HTML MATCHES ===');
html.split('\n').forEach((l, idx) => {
  if (l.match(/text-\[#[0-9a-zA-Z]+\]xl/)) {
    console.log(`HTML:${idx+1}: ${l.trim()}`);
  }
});

console.log('\n=== JS MATCHES ===');
js.split('\n').forEach((l, idx) => {
  if (l.match(/text-\[#[0-9a-zA-Z]+\]xl/)) {
    console.log(`JS:${idx+1}: ${l.trim()}`);
  }
});
