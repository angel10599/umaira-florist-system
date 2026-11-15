const fs = require('fs');

const files = ['js/app.js', 'js/site-update.js', 'js/builder.js', 'js/account.js', 'js/state.js'];

files.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('catalog_change') || l.includes('catalog:updated')) {
      console.log(`${f} L${i+1}: ${l.trim().slice(0, 100)}`);
    }
  });
});
