// Script to back up existing seed catalog before replacement
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'data', 'umaira.db');
const BACKUP_PATH = path.join(__dirname, '..', 'data', 'seed_catalog_backup.json');

const db = new DatabaseSync(DB_PATH);

const flowers = db.prepare('SELECT * FROM flowers').all();
const bouquets = db.prepare('SELECT * FROM bouquets').all();
const categories = db.prepare('SELECT * FROM categories').all();
const stockTransactions = db.prepare('SELECT * FROM stock_transactions').all();
const ordersCount = db.prepare('SELECT COUNT(*) c FROM orders').get().c;
const orderItemsCount = db.prepare('SELECT COUNT(*) c FROM order_items').get().c;

const backupData = {
  timestamp: new Date().toISOString(),
  description: 'Backup of catalog records before replacement with 40 recommended Philippine florist items',
  counts: {
    flowers: flowers.length,
    bouquets: bouquets.length,
    categories: categories.length,
    stockTransactions: stockTransactions.length,
    orders: ordersCount,
    orderItems: orderItemsCount
  },
  flowers,
  bouquets,
  categories,
  stockTransactions
};

fs.writeFileSync(BACKUP_PATH, JSON.stringify(backupData, null, 2), 'utf8');
console.log(`Backup completed successfully! Saved to ${BACKUP_PATH}`);
console.log(JSON.stringify(backupData.counts, null, 2));
