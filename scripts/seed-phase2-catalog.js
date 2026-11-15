// Script to populate Umaira Florist Phase 2 Bouquet Catalog & Inventory Structure
// Ensures complete idempotency: running multiple times never duplicates records
// and preserves any uploaded images or existing stock counts.

const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const {
  PHASE2_CATEGORIES,
  PHASE2_FLOWERS,
  PHASE2_MATERIALS,
  PHASE2_BOUQUETS
} = require('../server/phase2_catalog');

const dbPath = path.join(__dirname, '..', 'data', 'umaira.db');
const db = new DatabaseSync(dbPath);
const now = () => new Date().toISOString();

console.log('=== UMAIRA FLORIST: PHASE 2 CATALOG INITIALIZATION ===');
console.log('Target database:', dbPath);

// 1. Column migrations helper
function tableCols(tableName) {
  try {
    return db.prepare(`PRAGMA table_info("${tableName}")`).all().map(c => c.name);
  } catch (_) {
    return [];
  }
}
function addCol(table, col, def) {
  if (!tableCols(table).includes(col)) {
    db.exec(`ALTER TABLE "${table}" ADD COLUMN ${col} ${def}`);
    console.log(`  Added column ${col} to ${table}`);
  }
}

addCol('flowers', 'supplier_id', 'TEXT REFERENCES suppliers(id)');
addCol('flowers', 'source', "TEXT DEFAULT 'Unverified / To Be Confirmed'");
addCol('bouquets', 'source', "TEXT DEFAULT 'Unverified / To Be Confirmed'");
addCol('bouquets', 'specs_json', 'TEXT');

// 2. Insert or update Categories
console.log('\n[1/3] Populating Categories...');
const insCat = db.prepare(`
  INSERT INTO categories (id, name, type, description, active, created_at, updated_at)
  VALUES (?, ?, ?, ?, 1, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    type = excluded.type,
    description = excluded.description,
    updated_at = excluded.updated_at
`);

for (const cat of PHASE2_CATEGORIES) {
  insCat.run(cat.id, cat.name, cat.type, cat.description, now(), now());
}
console.log(`  Processed ${PHASE2_CATEGORIES.length} categories.`);

// 3. Insert or update Flowers and Materials
console.log('\n[2/3] Populating Flowers & Materials...');
const insFlower = db.prepare(`
  INSERT INTO flowers (
    id, name, botanical_name, category, price, availability, stock_count,
    description, image, color, item_type, style, archived, unit_cost,
    low_stock_threshold, unit_of_measure, updated_at, supplier_id, source
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    botanical_name = excluded.botanical_name,
    category = excluded.category,
    price = excluded.price,
    description = excluded.description,
    image = CASE WHEN excluded.image != '' THEN excluded.image ELSE flowers.image END,
    color = excluded.color,
    item_type = COALESCE(excluded.item_type, flowers.item_type),
    style = COALESCE(excluded.style, flowers.style),
    unit_cost = excluded.unit_cost,
    low_stock_threshold = excluded.low_stock_threshold,
    unit_of_measure = excluded.unit_of_measure,
    supplier_id = COALESCE(flowers.supplier_id, excluded.supplier_id),
    source = COALESCE(flowers.source, excluded.source),
    updated_at = excluded.updated_at
`);

const allInventory = [...PHASE2_FLOWERS, ...PHASE2_MATERIALS];
for (const item of allInventory) {
  // Check if flower already has stock, preserve it; otherwise start with 0
  const existing = db.prepare('SELECT stock_count, availability, image, source, supplier_id FROM flowers WHERE id = ?').get(item.id);
  const stock = existing ? existing.stock_count : (item.stockCount || 0);
  const avail = existing ? existing.availability : (item.availability || 'sold_out');
  const img = existing && existing.image ? existing.image : (item.image || '');
  const supId = existing && existing.supplier_id ? existing.supplier_id : (item.supplierId || null);
  const src = existing && existing.source ? existing.source : (item.source || 'Unverified / To Be Confirmed');

  insFlower.run(
    item.id, item.name, item.botanicalName || '', item.category, item.price,
    avail, stock, item.description || '', img, item.color || '#f43f5e',
    item.itemType, item.style || '', item.unitCost || 20, item.lowStockThreshold || 5,
    item.unitOfMeasure, now(), supId, src
  );
}
console.log(`  Processed ${allInventory.length} inventory items (flowers + foliage + materials).`);

// 4. Insert or update 32 Unique Bouquets
console.log('\n[3/3] Populating 32 Unique Bouquets...');
const insBouquet = db.prepare(`
  INSERT INTO bouquets (
    id, name, category, occasion, price, description, image, formula,
    availability, specs_json, archived, updated_at, source
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    name = excluded.name,
    category = excluded.category,
    occasion = excluded.occasion,
    price = excluded.price,
    description = excluded.description,
    image = CASE WHEN excluded.image != '' THEN excluded.image ELSE bouquets.image END,
    formula = excluded.formula,
    specs_json = excluded.specs_json,
    source = COALESCE(bouquets.source, excluded.source),
    updated_at = excluded.updated_at
`);

for (const b of PHASE2_BOUQUETS) {
  const existing = db.prepare('SELECT image, availability, source, price FROM bouquets WHERE id = ?').get(b.id);
  const img = existing && existing.image ? existing.image : (b.image || '');
  const avail = existing ? existing.availability : (b.availability || 'sold_out');
  const src = existing && existing.source ? existing.source : (b.source || 'Unverified / To Be Confirmed');
  const specsJson = b.specs ? JSON.stringify(b.specs) : null;

  insBouquet.run(
    b.id, b.name, b.category, b.occasion, b.price, b.description || '',
    img, b.formula || '', avail, specsJson, now(), src
  );
}
console.log(`  Processed ${PHASE2_BOUQUETS.length} bouquets.`);

// 5. Update shop_settings to mark Phase 2 initialized
const insSetting = db.prepare(`
  INSERT INTO shop_settings (key, value_json, updated_at)
  VALUES ('phase2_catalog', ?, ?)
  ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
`);
insSetting.run(JSON.stringify({ initialized: true, bouquets: 32, initialized_at: now() }), now());

// 6. Verification
console.log('\n--- VERIFICATION OF DATABASE RECORD COUNTS ---');
const bouquetCount = db.prepare('SELECT COUNT(*) c FROM bouquets').get().c;
const flowerCount = db.prepare("SELECT COUNT(*) c FROM flowers WHERE item_type = 'flower'").get().c;
const foliageCount = db.prepare("SELECT COUNT(*) c FROM flowers WHERE item_type = 'foliage'").get().c;
const fillerCount = db.prepare("SELECT COUNT(*) c FROM flowers WHERE item_type = 'filler'").get().c;
const materialCount = db.prepare("SELECT COUNT(*) c FROM flowers WHERE item_type NOT IN ('flower', 'foliage', 'filler')").get().c;
const totalFlowerRows = db.prepare('SELECT COUNT(*) c FROM flowers').get().c;
const categoryCount = db.prepare('SELECT COUNT(*) c FROM categories').get().c;

console.log(`Total Bouquets           : ${bouquetCount} (expected: 32)`);
console.log(`Blooming Flowers         : ${flowerCount}`);
console.log(`Foliage (Eucalyptus/Ruscus): ${foliageCount}`);
console.log(`Fillers (Baby's Breath)  : ${fillerCount}`);
console.log(`Materials & Supplies     : ${materialCount}`);
console.log(`Total Inventory Rows     : ${totalFlowerRows}`);
console.log(`Total Categories         : ${categoryCount}`);

db.close();
console.log('\n=== PHASE 2 CATALOG INITIALIZATION COMPLETE ===');
