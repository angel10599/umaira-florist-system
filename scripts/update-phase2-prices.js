// scripts/update-phase2-prices.js
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/umaira.db');
const bouquets = db.prepare('SELECT id, price FROM bouquets').all();
const bMap = {};
bouquets.forEach(b => { bMap[b.id] = b.price; });

let code = fs.readFileSync('server/phase2_catalog.js', 'utf8');
let count = 0;
for (const [id, price] of Object.entries(bMap)) {
  const re = new RegExp(`(id:\\s*'${id}'[\\s\\S]*?price:\\s*)\\d+`);
  if (re.test(code)) {
    code = code.replace(re, `$1${price}`);
    count++;
  }
}
fs.writeFileSync('server/phase2_catalog.js', code, 'utf8');
console.log('Updated prices for bouquets in phase2_catalog.js:', count);
