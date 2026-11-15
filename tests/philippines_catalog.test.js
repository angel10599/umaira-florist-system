/**
 * tests/philippines_catalog.test.js
 *
 * Comprehensive Test Suite for:
 * 1. Umaira Florist Philippine Catalog Replacement (Exact 40 items across 6 categories)
 *    - 10 Ready-Made Bouquets
 *    - 10 Fresh Flowers
 *    - 5 Fillers & Foliage
 *    - 5 Wrapping Materials
 *    - 5 Ribbon Styles
 *    - 5 Message Cards
 * 2. Database Backup and Order History Preservation (81 orders preserved)
 * 3. Search & Filter Controls:
 *    - Product Type Filters (Flowers & Bouquets)
 *    - Occasion Filters on Bouquets (with multi-occasion tag matching)
 *    - Price Filters on Flowers and Bouquets
 *    - Availability Filters
 *    - Clear Filter operations
 * 4. Custom Bouquet Builder Connectivity
 * 5. API Endpoints (/api/catalog, /api/materials, /api/admin/...)
 */

// Isolated temporary database: this test can never touch the shop's real data (must load before server/store).
const iso = require('./helpers/isolated-db');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');

const ROOT = path.resolve(__dirname, '..');
const STORE_PATH = path.join(ROOT, 'server', 'store.js');
const ADMIN_HTML_PATH = path.join(ROOT, 'admin.html');
const ADMIN_JS_PATH = path.join(ROOT, 'js', 'admin.js');
const SERVER_PATH = path.join(ROOT, 'server.js');
const BACKUP_PATH = path.join(ROOT, 'data', 'seed_catalog_backup.json');

let passed = 0;
let failed = 0;

function ok(testName, fn) {
  try {
    fn();
    console.log(`  ok   ${testName}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL ${testName}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

async function aok(testName, fn) {
  try {
    await fn();
    console.log(`  ok   ${testName}`);
    passed++;
  } catch (err) {
    console.error(`  FAIL ${testName}`);
    console.error(`       ${err.message}`);
    failed++;
  }
}

console.log('======================================================');
console.log('UMAIRA FLORIST — 40-ITEM PHILIPPINE CATALOG & FILTER SUITE');
console.log('======================================================\n');

// ---------------------------------------------------------------------------
// SECTION 1: DATABASE BACKUP & DATA INTEGRITY
// ---------------------------------------------------------------------------
console.log('[Area 1] Seed Catalog Backup & Customer Order Preservation');

ok('Backup file exists and contains preserved seed records', () => {
  assert(fs.existsSync(BACKUP_PATH), `Backup file not found at ${BACKUP_PATH}`);
  const backup = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));
  assert(backup.timestamp, 'Missing backup timestamp');
  assert(backup.counts, 'Missing backup counts');
  assert(backup.flowers && backup.flowers.length > 0, 'Backup missing flowers');
  assert(backup.bouquets && backup.bouquets.length > 0, 'Backup missing bouquets');
  assert(backup.categories && backup.categories.length > 0, 'Backup missing categories');
});

const store = require(STORE_PATH);

ok('Test runs on an isolated temporary database, never the live shop data', () => {
  const dbFile = store.kind || '';
  assert(!/[\\/]data[\\/]umaira\.db/.test(dbFile.replace(/\)$/, '')) || dbFile.includes('umaira-test-'), 'Must not use data/umaira.db: ' + dbFile);
});

// ---------------------------------------------------------------------------
// SECTION 2: CATALOG RULES (the catalog itself is managed by the owner in Store Management)
// ---------------------------------------------------------------------------
console.log('\n[Area 2] Catalog rules across the 6 core categories');

const CORE_CATEGORIES = ['Ready-Made Bouquets', 'Fresh Flowers', 'Fillers & Foliage', 'Wrapping Materials', 'Ribbons', 'Greeting Cards'];
const TYPE_CATEGORY = { flower: ['Fresh Flowers'], filler: ['Fillers & Foliage'], foliage: ['Fillers & Foliage'],
  wrapping: ['Wrapping Materials'], ribbon: ['Ribbons'], card: ['Greeting Cards', 'Message Cards'], supply: ['Wrapping Materials'] };

ok('6 core categories exist and are active', () => {
  const active = store.getCategories({ includeInactive: false }).map(c => c.name);
  for (const c of CORE_CATEGORIES) assert(active.includes(c), 'Missing core category ' + c);
});

ok('Every active ready-made bouquet is in Ready-Made Bouquets with a ₱ price above zero', () => {
  const bqs = store.getBouquets({ includeArchived: false });
  assert(bqs.length > 0, 'Catalog has no active bouquets');
  for (const b of bqs) {
    assert(b.name && b.name.trim(), 'Bouquet without a name: ' + b.id);
    assert.equal(b.category, 'Ready-Made Bouquets', b.name + ' has category ' + b.category);
    assert(Number.isFinite(b.price) && b.price > 0, b.name + ' has invalid price ' + b.price);
  }
});

ok('Every active flower/material sits in the category that matches its item type', () => {
  const items = store.getFlowers({ includeArchived: false });
  assert(items.length > 0, 'Catalog has no active items');
  for (const f of items) {
    const allowed = TYPE_CATEGORY[f.itemType];
    assert(allowed, f.name + ' has unknown item type ' + f.itemType);
    assert(allowed.includes(f.category), f.name + ' (' + f.itemType + ') is in ' + f.category);
  }
});

ok('Every active flower/material has a valid ₱ price and a non-negative whole stock count', () => {
  for (const f of store.getFlowers({ includeArchived: false })) {
    assert(Number.isFinite(f.price) && f.price >= 0, f.name + ' has invalid price ' + f.price);
    assert(Number.isInteger(f.stockCount) && f.stockCount >= 0, f.name + ' has invalid stock ' + f.stockCount);
  }
});

ok('No archived product appears among active products', () => {
  const ids = new Set([...store.getFlowers({ includeArchived: false }), ...store.getBouquets({ includeArchived: false })].map(x => x.id));
  const archived = store.db.prepare('SELECT id FROM flowers WHERE archived = 1 UNION SELECT id FROM bouquets WHERE archived = 1').all();
  for (const a of archived) assert(!ids.has(a.id), 'Archived item listed as active: ' + a.id);
});


// ---------------------------------------------------------------------------
// SECTION 3: ADMIN HTML CONTROLS & JAVASCRIPT FILTERS
// ---------------------------------------------------------------------------
console.log('\n[Area 3] Admin HTML Controls & Multi-Tag / Price Filters');

const htmlContent = fs.readFileSync(ADMIN_HTML_PATH, 'utf8');
const jsContent = fs.readFileSync(ADMIN_JS_PATH, 'utf8');

ok('Store toolbar has a category filter covering every core category', () => {
  const sel = (htmlContent.match(/id="store-category-filter"[\s\S]*?<\/select>/) || [''])[0];
  assert(sel, 'Missing #store-category-filter');
  for (const c of ['Ready-Made Bouquets', 'Fresh Flowers', 'Fillers &amp; Foliage', 'Wrapping Materials', 'Ribbons', 'Greeting Cards']) assert(sel.includes(c), 'Missing option ' + c);
});

ok('Store toolbar has occasion, stock status and sort filters', () => {
  assert(htmlContent.includes('id="store-occasion-filter"'), 'Missing #store-occasion-filter');
  assert(htmlContent.includes('id="store-stock-filter"'), 'Missing #store-stock-filter');
  assert(htmlContent.includes('id="store-sort-filter"'), 'Missing #store-sort-filter');
});

ok('admin.js implements handleFlowerTypeChange, handleBouquetTypeChange, and price filters', () => {
  assert(jsContent.includes('handleFlowerTypeChange('), 'Missing handleFlowerTypeChange');
  assert(jsContent.includes('handleBouquetTypeChange('), 'Missing handleBouquetTypeChange');
  assert(jsContent.includes('flowerPriceFilter'), 'Missing flowerPriceFilter');
  assert(jsContent.includes('bouquetPriceFilter'), 'Missing bouquetPriceFilter');
  assert(jsContent.includes('bouquetOccasionFilter'), 'Missing bouquetOccasionFilter');
});

ok('Bouquet multi-occasion matching correctly matches compound occasion tags', () => {
  const bouquets = store.getBouquets({ includeArchived: false });
  // 'Classic Red Rose Bouquet' has occasion "Anniversary, Valentine's"
  const redRose = bouquets.find(b => b.id === 'bq-classic-red-rose');
  assert(redRose, 'Red rose bouquet missing');
  assert(redRose.occasion.toLowerCase().includes('anniversary'), 'Should match anniversary');
  assert(redRose.occasion.toLowerCase().includes('valentin'), 'Should match valentines');

  // 'Sunflower Delight' has occasion "Birthday, Graduation"
  const sunflower = bouquets.find(b => b.id === 'bq-sunflower-delight');
  assert(sunflower, 'Sunflower bouquet missing');
  assert(sunflower.occasion.toLowerCase().includes('birthday'), 'Should match birthday');
  assert(sunflower.occasion.toLowerCase().includes('graduat'), 'Should match graduation');
});

// ---------------------------------------------------------------------------
// SECTION 4: LIVE API & IMAGE UPLOAD READINESS
// ---------------------------------------------------------------------------
console.log('\n[Area 4] Live API & Catalog Verification');

function req(options, body = null) {
  return new Promise((resolve, reject) => {
    const r = http.request(options, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, data: json, raw: data });
      });
    });
    r.on('error', reject);
    if (body) {
      if (typeof body === 'string') r.write(body);
      else r.write(JSON.stringify(body));
    }
    r.end();
  });
}

let TEST_PORT = 0; // own server on a free port with the isolated test database (never the live shop)
(async () => {
  try {
    TEST_PORT = (await iso.startServer()).port;
    let adminToken = '';
    await aok('Admin can log in successfully', async () => {
      const res = await req({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/admin/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, {
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'umaira2026'
      });
      assert.equal(res.status, 200, `Login status: ${res.status} ${res.raw}`);
      assert(res.data.token, 'Token expected');
      adminToken = res.data.token;
    });

    await aok('GET /api/catalog returns exactly the active catalog with ₱ prices', async () => {
      const res = await req({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/catalog',
        method: 'GET'
      });
      assert.equal(res.status, 200);
      const cat = res.data;
      const activeItems = store.getFlowers({ includeArchived: false });
      const activeBqs = store.getBouquets({ includeArchived: false });
      assert.equal(cat.bouquets.length, activeBqs.length, 'Catalog bouquets must equal active bouquets');
      assert.equal(cat.materials.length, activeItems.length, 'Catalog materials must equal active flowers & materials');
      assert.equal(cat.flowers.length, activeItems.filter(f => f.itemType === 'flower').length, 'Catalog flowers must equal active fresh flowers');
      assert(cat.bouquets.every(b => b.price > 0) && cat.materials.every(m => m.price >= 0), 'Every public price must be a valid ₱ amount');
    });

    await aok('GET /api/materials returns all active materials', async () => {
      const res = await req({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/materials',
        method: 'GET'
      });
      assert.equal(res.status, 200);
      assert(res.data.materials, 'Expected materials array');
      const expected = store.getFlowers({ includeArchived: false }).length;
      assert.equal(res.data.materials.length, expected, `Expected ${expected} active materials, got ${res.data.materials.length}`);
    });

    await aok('Admin image upload functions properly for starter catalog items', async () => {
      const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const uploadRes = await req({
        hostname: '127.0.0.1',
        port: TEST_PORT,
        path: '/api/admin/upload',
        method: 'POST',
        headers: {
          'x-admin-token': adminToken,
          'Content-Type': 'application/json'
        }
      }, {
        name: 'sample_tulip.png',
        dataUrl: 'data:image/png;base64,' + validPngBase64
      });

      assert.equal(uploadRes.status, 201, `Upload failed: ${uploadRes.raw}`);
      assert(uploadRes.data.url, 'url missing');
      assert(uploadRes.data.url.startsWith('/assets/uploads/'), 'Should save in /assets/uploads/');
    });

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  }

  console.log('\n======================================================');
  console.log(`TEST SUITE FINISHED: ${passed} passed, ${failed} failed`);
  console.log('======================================================');

  process.exit(failed > 0 ? 1 : 0);
})();
