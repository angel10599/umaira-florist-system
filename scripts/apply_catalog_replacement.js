// Script to replace catalog with the 40 recommended Philippine florist items
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const {
  PHILIPPINE_CATEGORIES,
  READY_MADE_BOUQUETS,
  ALL_FLOWERS_AND_MATERIALS,
  FILLERS_AND_FOLIAGE,
  WRAPPING_MATERIALS,
  RIBBONS,
  MESSAGE_CARDS,
  FRESH_FLOWERS
} = require('../server/philippines_catalog');

const DB_PATH = path.join(__dirname, '..', 'data', 'umaira.db');
const db = new DatabaseSync(DB_PATH);

console.log('--- APPLYING CATALOG REPLACEMENT ---');

// 1. Transaction to replace bouquets, flowers, and categories
db.exec('BEGIN TRANSACTION');
try {
  const now = new Date().toISOString();

  // 1.1 Replace Categories
  console.log('Updating categories table...');
  const newCatNames = new Set(PHILIPPINE_CATEGORIES.map(c => c.name.toLowerCase()));
  // Delete categories not in official list
  const existingCats = db.prepare('SELECT id, name FROM categories').all();
  for (const c of existingCats) {
    if (!newCatNames.has(c.name.toLowerCase())) {
      db.prepare('DELETE FROM categories WHERE id = ?').run(c.id);
    }
  }
  const insCat = db.prepare(`INSERT INTO categories (id, name, type, description, active, created_at, updated_at)
    VALUES (?,?,?,?,1,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type, description=excluded.description, active=1, updated_at=excluded.updated_at`);
  for (const cat of PHILIPPINE_CATEGORIES) {
    insCat.run(cat.id, cat.name, cat.type, cat.description, now, now);
  }

  // 1.2 Replace Bouquets (10 items)
  console.log('Replacing bouquets with 10 recommended items...');
  db.prepare('DELETE FROM bouquets').run();
  const insBq = db.prepare(`INSERT INTO bouquets (id, name, category, occasion, price, description, image, formula, availability, specs_json, archived, updated_at)
    VALUES (?,?,?,?,?,?,?,?,? ,?,0,?)`);
  for (const b of READY_MADE_BOUQUETS) {
    insBq.run(
      b.id,
      b.name,
      b.category,
      b.occasion,
      b.price,
      b.description,
      b.image || '',
      b.formula || '',
      b.availability || 'available',
      JSON.stringify(b.specs),
      now
    );
  }

  // 1.3 Replace Flowers & Materials (30 items)
  console.log('Replacing flowers & materials with 30 recommended items...');
  const newFlowerIds = new Set(ALL_FLOWERS_AND_MATERIALS.map(f => f.id));
  const referencedFlowers = new Set(
    db.prepare('SELECT DISTINCT flower_id FROM stock_transactions').all().map(r => r.flower_id)
  );

  const existingFlowers = db.prepare('SELECT id FROM flowers').all();
  for (const f of existingFlowers) {
    if (!newFlowerIds.has(f.id)) {
      if (referencedFlowers.has(f.id)) {
        // Soft archive to protect foreign key references in past orders/transactions
        db.prepare('UPDATE flowers SET archived = 1, updated_at = ? WHERE id = ?').run(now, f.id);
      } else {
        // Completely safe to delete
        db.prepare('DELETE FROM flowers WHERE id = ?').run(f.id);
      }
    }
  }

  const insFlower = db.prepare(`INSERT INTO flowers (id, name, botanical_name, category, price, availability, stock_count, description, image, color, item_type, style, archived, unit_cost, low_stock_threshold, unit_of_measure, updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      botanical_name=excluded.botanical_name,
      category=excluded.category,
      price=excluded.price,
      availability=excluded.availability,
      stock_count=excluded.stock_count,
      description=excluded.description,
      color=excluded.color,
      item_type=excluded.item_type,
      style=excluded.style,
      archived=0,
      unit_cost=excluded.unit_cost,
      low_stock_threshold=excluded.low_stock_threshold,
      unit_of_measure=excluded.unit_of_measure,
      updated_at=excluded.updated_at`);

  for (const item of ALL_FLOWERS_AND_MATERIALS) {
    insFlower.run(
      item.id,
      item.name,
      item.botanicalName || '',
      item.category,
      item.price,
      item.availability || 'available',
      item.stockCount,
      item.description,
      '', // Do not upload or generate images yet
      item.color || '#f43f5e',
      item.itemType,
      item.style || '',
      item.unitCost || 20,
      5,
      item.unitOfMeasure,
      now
    );
  }

  db.exec('COMMIT');
  console.log('Database replacement transaction committed successfully!');
} catch (err) {
  db.exec('ROLLBACK');
  console.error('Error during catalog replacement, transaction rolled back:', err);
  process.exit(1);
}

// 2. Verify Resulting Counts
const activeFlowers = db.prepare('SELECT * FROM flowers WHERE archived = 0').all();
const activeBouquets = db.prepare('SELECT * FROM bouquets WHERE archived = 0').all();
const activeCategories = db.prepare('SELECT * FROM categories WHERE active = 1').all();
const totalOrders = db.prepare('SELECT COUNT(*) c FROM orders').get().c;

console.log('Verification:');
console.log(`- Active Flowers & Materials: ${activeFlowers.length} (Target: 30)`);
console.log(`- Active Ready-Made Bouquets: ${activeBouquets.length} (Target: 10)`);
console.log(`- Total Active Catalog Items: ${activeFlowers.length + activeBouquets.length} (Target: 40)`);
console.log(`- Active Categories: ${activeCategories.length} (Target: 6)`);
console.log(`- Preserved Customer Orders: ${totalOrders}`);
