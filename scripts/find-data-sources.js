const fs = require('fs');

const files = ['js/data.js', 'js/state.js', 'js/app.js', 'js/builder.js', 'js/site-update.js', 'js/account.js', 'js/admin.js'];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  const content = fs.readFileSync(f, 'utf8');
  console.log(`\n=== ${f} ===`);
  const apiCalls = [...content.matchAll(/fetch\s*\(\s*['"`]([^'"`]+)['"`]/g)].map(m => m[1]);
  console.log('fetch calls:', [...new Set(apiCalls)]);
  console.log('mentions FLOWER_DATA:', content.includes('FLOWER_DATA'));
});
