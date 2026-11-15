const { DatabaseSync } = require('node:sqlite');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'umaira.db');
const db = new DatabaseSync(dbPath);

console.log('=== UMAIRA FLORIST DATABASE AUDIT ===');
console.log('Database path:', dbPath);

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
console.log('\n--- Tables & Row Counts ---');
for (const t of tables) {
  const count = db.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get().c;
  console.log(`${t.name.padEnd(25)} : ${count} rows`);
}

console.log('\n--- Admin Users (To Preserve) ---');
try {
  const admins = db.prepare("SELECT username, display_name, role, created_at FROM admin_users").all();
  console.log(admins);
} catch (e) {
  console.log('No admin_users table or error:', e.message);
}

console.log('\n--- Shop Settings (To Preserve) ---');
try {
  const settings = db.prepare("SELECT key, value_json, updated_at FROM shop_settings").all();
  console.log(settings.map(s => ({ key: s.key, updated_at: s.updated_at })));
} catch (e) {
  console.log('No shop_settings table or error:', e.message);
}

console.log('\n--- Predefined Categories (To Preserve / Review) ---');
try {
  const categories = db.prepare("SELECT id, name, type, active FROM categories").all();
  console.log(categories);
} catch (e) {
  console.log('No categories table or error:', e.message);
}

console.log('\n--- Suppliers (Review) ---');
try {
  const suppliers = db.prepare("SELECT id, name, active FROM suppliers").all();
  console.log(suppliers);
} catch (e) {
  console.log('No suppliers table or error:', e.message);
}

console.log('\n--- Flower item_types ---');
try {
  const itemTypes = db.prepare("SELECT item_type, COUNT(*) as count FROM flowers GROUP BY item_type").all();
  console.log(itemTypes);
} catch (e) {
  console.log('Error querying flower item_types:', e.message);
}

db.close();
