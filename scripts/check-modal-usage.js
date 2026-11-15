const fs = require('fs');

function checkUsage(f) {
  const content = fs.readFileSync(f, 'utf8');
  console.log(`\n=== ${f} ===`);
  ['openProductModal', 'openBouquetModal', 'openFlowerModal'].forEach(m => {
    const matches = content.match(new RegExp(m, 'g')) || [];
    console.log(`${m}: ${matches.length} times`);
  });
}

checkUsage('js/admin.js');
checkUsage('admin.html');
