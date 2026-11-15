const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const db = new DatabaseSync(path.join(__dirname, '..', 'data', 'umaira.db'));

const types = db.prepare('SELECT DISTINCT item_type FROM flowers').all();
console.log('Distinct item_type in flowers table:', types);

const sampleByType = {};
types.forEach(t => {
  sampleByType[t.item_type] = db.prepare('SELECT id, name, category, price, stock_count, availability FROM flowers WHERE item_type = ? LIMIT 3').all(t.item_type);
});
console.log('Samples by item_type:\n', JSON.stringify(sampleByType, null, 2));
