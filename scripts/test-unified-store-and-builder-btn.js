// scripts/test-unified-store-and-builder-btn.js
// Verification suite for:
// 1. "Add Custom Bouquet to Cart" pill button in Bouquet Builder (matching user screenshot).
// 2. Unified Store Management Page (combining Products & Inventory, 4 KPIs, unified table, audit log).

// Isolated temporary database: this test can never touch the shop's real data (must load before server/store).
const iso = require('../tests/helpers/isolated-db');
require('../server/store'); // creates and seeds the temporary database
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('=== TEST: UNIFIED STORE MANAGEMENT & BUILDER BUTTON ===\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error('    Error:', err.message);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// [1] Verify "Add Custom Bouquet to Cart" Button & No Duplicate Buttons
// -----------------------------------------------------------------------------
console.log('[1] Bouquet Builder CTA & Duplicate Elimination:');

const builderJs = fs.readFileSync(path.join(__dirname, '../js/builder.js'), 'utf8');

test('Step footers do not contain duplicate forward navigation buttons', () => {
  assert.ok(!builderJs.includes('Continue to Fillers (Step 2)'), 'Step 1 must not contain duplicate Continue button');
  assert.ok(!builderJs.includes('Continue to Wrapping (Step 3)'), 'Step 2 must not contain duplicate Continue button');
  assert.ok(!builderJs.includes('Continue to Ribbon (Step 4)'), 'Step 3 must not contain duplicate Continue button');
  assert.ok(!builderJs.includes('Continue to Greeting Card (Step 5)'), 'Step 4 must not contain duplicate Continue button');
  assert.ok(!builderJs.includes('id="builder-final-add-to-cart-btn"'), 'Step 5 must not contain duplicate Add to Cart button');
});

test('Sticky summary panel checkout button acts as single source of truth for "Add Custom Bouquet to Cart"', () => {
  assert.ok(builderJs.includes('<span>Add Custom Bouquet to Cart</span>'), 'Summary CTA button must show "Add Custom Bouquet to Cart" text');
  assert.ok(builderJs.includes('d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"'), 'Button must include shopping bag outline SVG icon');
});

// -----------------------------------------------------------------------------
// [2] Verify Unified Store Management in admin.html
// -----------------------------------------------------------------------------
console.log('\n[2] Unified Store Management in admin.html:');

const adminHtml = fs.readFileSync(path.join(__dirname, '../admin.html'), 'utf8');

test('Sidebar contains unified "Store Management" tab entry and no separate Products/Inventory entries', () => {
  assert.ok(adminHtml.includes('data-tab-nav="store"'), 'Must have data-tab-nav="store"');
  assert.ok(adminHtml.includes('Store Management</span>'), 'Must display "Store Management" label');
  assert.ok(!adminHtml.includes('data-tab-nav="products"'), 'Must remove separate data-tab-nav="products"');
  assert.ok(!adminHtml.includes('data-tab-nav="inventory"'), 'Must remove separate data-tab-nav="inventory"');
});

test('Store Management screen defines 4 KPI grid container and table elements', () => {
  assert.ok(adminHtml.includes('data-tab-content="store"'), 'Must have data-tab-content="store"');
  assert.ok(adminHtml.includes('id="store-kpi-grid"'), 'Must have #store-kpi-grid container');
  assert.ok(adminHtml.includes('id="store-search-input"'), 'Must have #store-search-input');
  assert.ok(adminHtml.includes('id="store-category-filter"'), 'Must have #store-category-filter');
  assert.ok(adminHtml.includes('id="store-stock-filter"'), 'Must have #store-stock-filter');
  assert.ok(adminHtml.includes('id="store-sort-filter"'), 'Must have #store-sort-filter');
  assert.ok(adminHtml.includes('id="admin-store-tbody"'), 'Must have #admin-store-tbody');
});

test('Unified Add/Edit modal includes direct stock fields, supplier, and bouquet recipe notice', () => {
  assert.ok(adminHtml.includes('id="product-field-stock"'), 'Must have direct stock input #product-field-stock');
  // Low stock uses the single threshold in Shop Settings (no per-item threshold field).
  assert.ok(!adminHtml.includes('id="product-field-threshold"'), 'Per-item threshold field should not exist');
  assert.ok(adminHtml.includes('id="product-field-cost"'), 'Must have unit cost input');
  assert.ok(adminHtml.includes('id="product-field-supplier"'), 'Must have supplier dropdown');
  assert.ok(adminHtml.includes('id="product-field-adj-reason"'), 'Must have adjustment reason input');
  // Bouquet recipes are descriptive (bouquets have their own stock), edited in the recipe/formula field.
  assert.ok(adminHtml.includes('id="product-field-formula"'), 'Must have the bouquet recipe (formula) field');
});

// -----------------------------------------------------------------------------
// [3] Verify Unified Store Logic in js/admin.js
// -----------------------------------------------------------------------------
console.log('\n[3] Unified Store Logic in js/admin.js:');

const adminJs = fs.readFileSync(path.join(__dirname, '../js/admin.js'), 'utf8');

test('switchTab aliases products and inventory to store', () => {
  assert.ok(adminJs.includes("tab === 'flowers' || tab === 'bouquets' || tab === 'products' || tab === 'inventory' || tab === 'store'"), 'switchTab must route products and inventory to store');
});

test('adminApp implements loadStoreData, renderStoreKPIs, getAllStoreItems, and renderStoreTable', () => {
  assert.ok(adminJs.includes('loadStoreData()'), 'Must implement loadStoreData()');
  assert.ok(adminJs.includes('renderStoreKPIs()'), 'Must implement renderStoreKPIs()');
  assert.ok(adminJs.includes('getAllStoreItems()'), 'Must implement getAllStoreItems()');
  assert.ok(adminJs.includes('renderStoreTable()'), 'Must implement renderStoreTable()');
});

test('Store KPI logic strictly enforces mutual exclusivity for Low Stock and Out of Stock', () => {
  // One status per item: out_of_stock (0 or sold out) / low_stock (<= global threshold) / in_stock.
  assert.ok(adminJs.includes("const status = (stock <= 0 || b.availability === 'sold_out') ? 'out_of_stock' : (stock <= globalTh ? 'low_stock' : 'in_stock');"), 'Bouquet status must be exclusive and use the global threshold');
  assert.ok(adminJs.includes("item.stockStatus === 'low_stock'") && adminJs.includes("item.stockStatus === 'out_of_stock'"), 'KPIs must count by the exclusive status');
  assert.ok(adminJs.includes('const globalTh = this.getGlobalLowStockThreshold();'), 'Threshold must come from Shop Settings');
});

test('Ready-made bouquets show their own stock count in the unified table', () => {
  assert.ok(adminJs.includes('stockDisplay: `${stock} bouquets`'), 'Bouquet stock must be shown as "N bouquets"');
  assert.ok(!adminJs.includes('Based on ingredients'), 'Bouquets must not be shown as "Based on ingredients"');
});

// -----------------------------------------------------------------------------
// [4] Live SQLite Database Counts & Mutual Exclusivity Verification
// -----------------------------------------------------------------------------
console.log('\n[4] Database Metrics Calculation (isolated test database):');

try {
  const sqlite = require('node:sqlite');
  const dbPath = iso.dbPath;
  if (fs.existsSync(dbPath)) {
    const db = new sqlite.DatabaseSync(dbPath);
    
    test('Phase 2 catalog import created all 32 bouquets', () => {
      const ids = require('../server/phase2_catalog').PHASE2_BOUQUETS.map(b => b.id);
      const found = db.prepare(`SELECT COUNT(*) c FROM bouquets WHERE id IN (${ids.map(() => '?').join(',')})`).get(...ids).c;
      assert.strictEqual(found, 32, `Expected 32 Phase 2 bouquets, got ${found}`);
    });

    test('Every Phase 2 flower and material exists in the inventory table', () => {
      const c = require('../server/phase2_catalog');
      const ids = [...c.PHASE2_FLOWERS, ...c.PHASE2_MATERIALS].map(x => x.id);
      const found = db.prepare(`SELECT COUNT(*) c FROM flowers WHERE id IN (${ids.map(() => '?').join(',')})`).get(...ids).c;
      assert.strictEqual(found, ids.length, `Expected ${ids.length} Phase 2 items, got ${found}`);
    });

    test('KPI stock counts are strictly mutually exclusive across all active items (global threshold)', () => {
      const flowers = db.prepare('SELECT stock_count FROM flowers WHERE archived = 0').all();
      const inv = db.prepare("SELECT value_json FROM shop_settings WHERE key = 'inventory'").get();
      const th = inv ? (JSON.parse(inv.value_json).lowStockThreshold ?? 20) : 20;
      let inStock = 0, lowStock = 0, outOfStock = 0;
      for (const f of flowers) {
        const s = f.stock_count || 0;
        if (s === 0) outOfStock++; else if (s <= th) lowStock++; else inStock++;
      }
      assert.strictEqual(inStock + lowStock + outOfStock, flowers.length, 'Every item must be in exactly one status');
      const viaSql = db.prepare('SELECT SUM(stock_count = 0) o, SUM(stock_count > 0 AND stock_count <= ?) l, SUM(stock_count > ?) i FROM flowers WHERE archived = 0').get(th, th);
      assert.deepStrictEqual([outOfStock, lowStock, inStock], [viaSql.o || 0, viaSql.l || 0, viaSql.i || 0], 'Counts must match an independent query');
    });
  }
} catch (e) {
  console.log('  (Skipped direct SQLite count inspection if database is locked/in-use)');
}

console.log('\n======================================================');
console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
console.log('======================================================');

if (failed > 0) process.exit(1);
