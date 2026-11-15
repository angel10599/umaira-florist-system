const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const BASE_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(BASE_DIR, 'data');
const DB_PATH = path.join(DATA_DIR, 'umaira.db');
const UPLOADS_DIR = path.join(BASE_DIR, 'assets', 'uploads');
const BACKUPS_DIR = path.join(BASE_DIR, 'backups');

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupFolder = path.join(BACKUPS_DIR, `umaira_backup_pre_cleanup_${timestamp}`);

fs.mkdirSync(backupFolder, { recursive: true });

console.log('=== UMAIRA FLORIST DATABASE BACKUP & CLEANUP ===');
console.log('Timestamp:', timestamp);
console.log('Backup destination:', backupFolder);

// Step 1: Checkpoint WAL
console.log('\n[1/5] Checkpointing SQLite WAL...');
const dbPre = new DatabaseSync(DB_PATH);
try {
  dbPre.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  console.log('WAL checkpoint complete.');
} catch (e) {
  console.warn('WAL checkpoint warning:', e.message);
}

// Step 2: Export full table JSON dumps and binary db file
console.log('\n[2/5] Creating complete backup (DB file, WAL, SHM, and JSON dump)...');
const tables = dbPre.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
const fullExport = {};
for (const t of tables) {
  const rows = dbPre.prepare(`SELECT * FROM "${t.name}"`).all();
  fullExport[t.name] = rows;
  console.log(`  Backed up table ${t.name}: ${rows.length} rows`);
}
fs.writeFileSync(path.join(backupFolder, 'full_database_dump.json'), JSON.stringify(fullExport, null, 2), 'utf8');

// Copy DB files
fs.copyFileSync(DB_PATH, path.join(backupFolder, 'umaira.db'));
if (fs.existsSync(DB_PATH + '-wal')) {
  try { fs.copyFileSync(DB_PATH + '-wal', path.join(backupFolder, 'umaira.db-wal')); } catch (_) {}
}
if (fs.existsSync(DB_PATH + '-shm')) {
  try { fs.copyFileSync(DB_PATH + '-shm', path.join(backupFolder, 'umaira.db-shm')); } catch (_) {}
}

// Backup uploads
const uploadsBackupDir = path.join(backupFolder, 'uploads');
fs.mkdirSync(uploadsBackupDir, { recursive: true });
if (fs.existsSync(UPLOADS_DIR)) {
  const uploadFiles = fs.readdirSync(UPLOADS_DIR);
  let copiedCount = 0;
  for (const f of uploadFiles) {
    if (f !== '.gitkeep') {
      fs.copyFileSync(path.join(UPLOADS_DIR, f), path.join(uploadsBackupDir, f));
      copiedCount++;
    }
  }
  console.log(`  Backed up ${copiedCount} files from assets/uploads/`);
}

dbPre.close();
console.log('Backup successfully created at:', backupFolder);

// Step 3: Execute cleanup inside a transaction
console.log('\n[3/5] Executing database reset transaction...');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON;');

try {
  db.exec('BEGIN TRANSACTION;');

  // 1. Clear customer order items and inventory stock transactions (child tables)
  const delOrderItems = db.prepare('DELETE FROM order_items').run();
  console.log(`  Deleted ${delOrderItems.changes} rows from order_items`);

  const delStockTrans = db.prepare('DELETE FROM stock_transactions').run();
  console.log(`  Deleted ${delStockTrans.changes} rows from stock_transactions`);

  // 2. Clear customer orders & delivery records
  const delOrders = db.prepare('DELETE FROM orders').run();
  console.log(`  Deleted ${delOrders.changes} rows from orders`);

  // 3. Clear customer sessions, carts, and password resets
  const delCustomerSessions = db.prepare('DELETE FROM customer_sessions').run();
  console.log(`  Deleted ${delCustomerSessions.changes} rows from customer_sessions`);

  const delCarts = db.prepare('DELETE FROM carts').run();
  console.log(`  Deleted ${delCarts.changes} rows from carts`);

  const delResets = db.prepare('DELETE FROM password_resets').run();
  console.log(`  Deleted ${delResets.changes} rows from password_resets`);

  // 4. Clear all notifications (customer & admin order notifications)
  const delNotifs = db.prepare('DELETE FROM notifications').run();
  console.log(`  Deleted ${delNotifs.changes} rows from notifications`);

  // 5. Clear all flowers, materials, supplies, and bouquet products
  const delBouquets = db.prepare('DELETE FROM bouquets').run();
  console.log(`  Deleted ${delBouquets.changes} rows from bouquets`);

  const delFlowers = db.prepare('DELETE FROM flowers').run();
  console.log(`  Deleted ${delFlowers.changes} rows from flowers`);

  // 6. Clear customer accounts (users where role = 'customer')
  const delUsers = db.prepare("DELETE FROM users WHERE role = 'customer'").run();
  console.log(`  Deleted ${delUsers.changes} customer accounts from users`);

  // 7. Clear admin sessions to force clean session state
  const delAdminSessions = db.prepare('DELETE FROM admin_sessions').run();
  console.log(`  Deleted ${delAdminSessions.changes} rows from admin_sessions`);

  // 8. Record catalog_reset flag in shop_settings
  const setReset = db.prepare(`
    INSERT INTO shop_settings (key, value_json, updated_at)
    VALUES ('catalog_reset', ?, ?)
    ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
  `);
  setReset.run(JSON.stringify({ reset: true, resetAt: new Date().toISOString() }), new Date().toISOString());
  console.log('  Recorded catalog_reset flag in shop_settings');

  db.exec('COMMIT;');
  console.log('Transaction committed successfully.');
} catch (err) {
  db.exec('ROLLBACK;');
  console.error('ERROR during reset transaction, rolled back:', err);
  db.close();
  process.exit(1);
}

// Step 4: Clean uploads folder (preserve .gitkeep)
console.log('\n[4/5] Cleaning operational upload files...');
if (fs.existsSync(UPLOADS_DIR)) {
  const uploadFiles = fs.readdirSync(UPLOADS_DIR);
  let removedCount = 0;
  for (const f of uploadFiles) {
    if (f !== '.gitkeep') {
      try {
        fs.unlinkSync(path.join(UPLOADS_DIR, f));
        removedCount++;
      } catch (_) {}
    }
  }
  console.log(`  Cleaned ${removedCount} test/operational files from assets/uploads/`);
}

// Step 5: Verification & Integrity Check
console.log('\n[5/5] Verifying database integrity and preserved records...');
const fkCheck = db.prepare('PRAGMA foreign_key_check;').all();
console.log('Foreign key check (empty = perfect):', fkCheck);

const integrityCheck = db.prepare('PRAGMA integrity_check;').all();
console.log('Integrity check:', integrityCheck);

console.log('\n--- Final Table Row Counts ---');
const allTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
for (const t of allTables) {
  const c = db.prepare(`SELECT COUNT(*) as count FROM "${t.name}"`).get().count;
  console.log(`  ${t.name.padEnd(25)} : ${c} rows`);
}

console.log('\n--- Preserved Admin Users ---');
console.log(db.prepare('SELECT username, display_name, role, created_at FROM admin_users').all());

console.log('\n--- Preserved Categories ---');
console.log(db.prepare('SELECT id, name, type, active FROM categories').all());

console.log('\n--- Preserved Suppliers ---');
console.log(db.prepare('SELECT id, name, active FROM suppliers').all());

console.log('\n--- Preserved Shop Settings ---');
console.log(db.prepare('SELECT key, updated_at FROM shop_settings').all());

db.close();
console.log('\n=== RESET COMPLETE SUCCESSFULLY ===');
