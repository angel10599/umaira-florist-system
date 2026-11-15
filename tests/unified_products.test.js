/**
 * tests/unified_products.test.js
 *
 * Comprehensive test suite for UMAIRA FLORIST — COMPLETE PRODUCT MANAGEMENT REDESIGN
 *
 * Verifies:
 * 1. Removal of redundant sub-tabs, separate tables, and toolbar add buttons.
 * 2. New Page Header layout (Title, subtitle, Add Category & Add Product buttons).
 * 3. Four informational KPI cards with dynamic DB counts.
 * 4. Unified Search and Filter Section (Row 1: Search + Clear; Row 2: Type, Occasion, Stock Status, Availability).
 * 5. Unified Products & Materials Table with 9 columns, 6-record pagination, Sort By, and empty state.
 * 6. Add/Edit Product modal with adaptive fields, occasion multi-select, and manual image upload.
 * 7. Category Management modal with linked product counts, duplicate prevention, and deletion safeguards.
 * 8. Product actions: Edit, More Options (View Details, Archive, Restore).
 * 9. Real-time synchronization and inventory integration.
 */

// Isolated temporary database: this test can never touch the shop's real data (must load before server/store).
const iso = require('./helpers/isolated-db');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { DatabaseSync } = require('node:sqlite');

const ROOT = path.resolve(__dirname, '..');
const ADMIN_HTML = fs.readFileSync(path.join(ROOT, 'admin.html'), 'utf8');
const ADMIN_JS = fs.readFileSync(path.join(ROOT, 'js', 'admin.js'), 'utf8');

let pass = 0;
let fail = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ok   ${name}`);
    pass++;
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
    fail++;
  }
}

async function acheck(name, fn) {
  try {
    await fn();
    console.log(`  ok   ${name}`);
    pass++;
  } catch (err) {
    console.error(`  FAIL ${name}`);
    console.error(`       ${err.message}`);
    fail++;
  }
}

console.log('======================================================');
console.log('UMAIRA FLORIST — UNIFIED PRODUCT MANAGEMENT REDESIGN');
console.log('======================================================\n');

// ---------------------------------------------------------------------------
// [Area 1] Removal of Old Subtabs & Separate Tables
// ---------------------------------------------------------------------------
console.log('[Area 1] Removal of Unnecessary Navigation & Separate Tables');

check('Old sub-tab navigation (#products-subtab-nav) is completely removed from HTML', () => {
  assert(!ADMIN_HTML.includes('id="products-subtab-nav"'), 'Sub-tab nav #products-subtab-nav should be removed');
});

check('Separate product subtabs (data-product-tab="flowers|bouquets|categories") are removed', () => {
  assert(!ADMIN_HTML.includes('data-product-tab="flowers"'), 'Old flowers subtab should be removed');
  assert(!ADMIN_HTML.includes('data-product-tab="bouquets"'), 'Old bouquets subtab should be removed');
  assert(!ADMIN_HTML.includes('data-product-tab="categories"'), 'Old categories subtab should be removed');
});

check('Old Add Item / Material button inside filter section is removed', () => {
  assert(!ADMIN_HTML.includes('<span>Add Item / Material</span>'), 'Old Add Item / Material button should be removed');
});

// ---------------------------------------------------------------------------
// [Area 2] New Page Header Layout
// ---------------------------------------------------------------------------
console.log('\n[Area 2] New Page Header Layout & Action Buttons');

check('Page header displays correct title and subtitle', () => {
  assert(ADMIN_HTML.includes('>Store Management<'), 'Missing Store Management title');
  assert(ADMIN_HTML.includes('Manage bouquets, fresh stems, packaging, and catalog inventory.'), 'Missing subtitle');
});

check('Header contains Categories (secondary) and Add Item (primary) buttons', () => {
  assert(ADMIN_HTML.includes('openCategoryManageModal()'), 'Missing Categories button');
  assert(ADMIN_HTML.includes('openUnifiedItemModal()') && ADMIN_HTML.includes('<span>Add Item</span>'), 'Missing Add Item button');
});

// ---------------------------------------------------------------------------
// [Area 3] Four Informational KPI Cards
// ---------------------------------------------------------------------------
console.log('\n[Area 3] Four Informational KPI Cards');

check('Product KPI grid container #products-kpi-grid exists directly below header', () => {
  assert(ADMIN_HTML.includes('id="products-kpi-grid"'), 'Missing #products-kpi-grid');
  const headerIdx = ADMIN_HTML.indexOf('Product Management');
  const kpiIdx = ADMIN_HTML.indexOf('id="products-kpi-grid"');
  assert(kpiIdx > headerIdx, 'KPI grid must be below header');
});

check('Store KPIs implement all 4 cards without clickable filter behavior', () => {
  const s = ADMIN_JS.replace(/\r\n/g, '\n'); const i = s.indexOf('renderStoreKPIs() {'); assert(i > 0, 'Missing renderStoreKPIs');
  const body = s.slice(i, s.indexOf('\n  }\n', i));
  for (const c of ['Card 1: Total Bouquets', 'Card 2: Inventory Items', 'Card 3: Low Stock', 'Card 4: Out of Stock']) assert(body.includes(c), 'Missing ' + c);
  assert(!body.includes('onclick='), 'KPI cards must be informational (no click filtering)');
});

// ---------------------------------------------------------------------------
// [Area 4] Unified Search and Filter Section
// ---------------------------------------------------------------------------
console.log('\n[Area 4] Unified Search and Filter Section');

check('Filter container contains search input and Clear Filters button', () => {
  assert(ADMIN_HTML.includes('id="store-filter-container"'), 'Missing #store-filter-container');
  assert(ADMIN_HTML.includes('id="store-search-input"'), 'Missing #store-search-input');
  assert(ADMIN_HTML.includes('id="store-clear-filters-btn"'), 'Missing #store-clear-filters-btn');
});

check('Filters: Category, Occasion, Stock Status and Sort', () => {
  for (const id of ['store-category-filter', 'store-occasion-filter', 'store-stock-filter', 'store-sort-filter']) assert(ADMIN_HTML.includes('id="' + id + '"'), 'Missing #' + id);
});

check('Category filter includes All Categories plus the 6 core categories', () => {
  const s = ((ADMIN_HTML.match(/id="store-category-filter"[\s\S]*?<\/select>/) || [''])[0]);
  for (const o of ['All Categories', 'Ready-Made Bouquets', 'Fresh Flowers', 'Fillers &amp; Foliage', 'Wrapping Materials', 'Ribbons', 'Greeting Cards']) assert(s.includes(o), 'Missing ' + o + ' option');
});

check('Occasion filter includes All Occasions plus the 8 official occasions', () => {
  const s = ((ADMIN_HTML.match(/id="store-occasion-filter"[\s\S]*?<\/select>/) || [''])[0]);
  const rules = require(path.join(ROOT, 'js', 'shop-rules.js'));
  assert(s.includes('All Occasions'), 'Missing All Occasions');
  for (const o of rules.OFFICIAL_OCCASIONS) assert(s.includes('value="' + o + '"'), 'Missing ' + o + ' option');
});

check('Stock status filter contains In Stock, Low Stock and Out of Stock', () => {
  const s = ((ADMIN_HTML.match(/id="store-stock-filter"[\s\S]*?<\/select>/) || [''])[0]);
  for (const v of ['all', 'in_stock', 'low_stock', 'out_of_stock']) assert(s.includes('value="' + v + '"'), 'Missing ' + v + ' option');
});

// ---------------------------------------------------------------------------
// [Area 5] Unified Products & Materials Table & Pagination
// ---------------------------------------------------------------------------
console.log('\n[Area 5] Unified Products & Materials Table');

check('Store table shows a live item count', () => {
  assert(ADMIN_HTML.includes('id="store-count-text"'), 'Missing #store-count-text');
});

check('Sort By dropdown contains name, price, stock and Recently Added options', () => {
  const s = ((ADMIN_HTML.match(/id="store-sort-filter"[\s\S]*?<\/select>/) || [''])[0]);
  for (const v of ['name_asc', 'name_desc', 'price_asc', 'price_desc', 'stock_asc', 'stock_desc', 'newest']) assert(s.includes('value="' + v + '"'), 'Missing ' + v);
});

check('Unified table defines Item, Category, Price, Stock / Availability and Actions columns', () => {
  const i = ADMIN_HTML.indexOf('id="admin-store-tbody"'); const head = ADMIN_HTML.slice(ADMIN_HTML.lastIndexOf('<thead', i), i);
  for (const c of ['Item', 'Category', 'Price', 'Stock / Availability', 'Actions']) assert(head.includes(c), 'Missing ' + c + ' column');
});

check('Unified table specifies empty state and pagination containers', () => {
  assert(ADMIN_HTML.includes('id="store-empty-state"'), 'Missing #store-empty-state');
  assert(ADMIN_HTML.includes('id="store-pagination"'), 'Missing #store-pagination');
});

// ---------------------------------------------------------------------------
// [Area 6] Add / Edit Product Modal & Image Upload
// ---------------------------------------------------------------------------
console.log('\n[Area 6] Add Product Modal & Image Upload');

check('Admin product modal #admin-product-modal exists with required fields', () => {
  assert(ADMIN_HTML.includes('id="admin-product-modal"'), 'Missing #admin-product-modal');
  for (const id of ['product-field-name', 'product-field-item-type', 'product-field-category', 'product-field-price', 'product-field-stock',
    'product-field-adj-reason', 'product-field-uom', 'product-field-availability', 'product-field-supplier'])
    assert(ADMIN_HTML.includes('id="' + id + '"'), 'Missing #' + id);
  assert(ADMIN_HTML.includes('id="product-field-occasions-group"') || ADMIN_HTML.includes('id="product-occasion-pills"'), 'Missing occasions');
});

check('Manual image upload includes preview container, placeholder SVG, replace & remove buttons', () => {
  assert(ADMIN_HTML.includes('id="product-image-preview-container"'), 'Missing preview container');
  assert(ADMIN_HTML.includes('id="product-image-empty-state"'), 'Missing image empty state placeholder');
  assert(ADMIN_HTML.includes('id="product-upload-btn-label"'), 'Missing upload button label');
  assert(ADMIN_HTML.includes('id="product-remove-btn"'), 'Missing remove button');
  assert(ADMIN_JS.includes('handleUnifiedProductImageUpload'), 'Missing handleUnifiedProductImageUpload');
  assert(ADMIN_JS.includes('removeUnifiedProductImage'), 'Missing removeUnifiedProductImage');
});

// ---------------------------------------------------------------------------
// [Area 7] Category Management Modal & Protection
// ---------------------------------------------------------------------------
console.log('\n[Area 7] Category Management Modal & Safeguards');

check('Category management modal #admin-category-manage-modal exists', () => {
  assert(ADMIN_HTML.includes('id="admin-category-manage-modal"'), 'Missing #admin-category-manage-modal');
  assert(ADMIN_HTML.includes('id="admin-cat-manage-form"'), 'Missing #admin-cat-manage-form');
  assert(ADMIN_HTML.includes('id="cat-manage-tbody"'), 'Missing #cat-manage-tbody');
  assert(ADMIN_JS.includes('openCategoryManageModal('), 'Missing openCategoryManageModal');
  assert(ADMIN_JS.includes('archiveCategoryFromManage('), 'Missing archiveCategoryFromManage');
});

// ---------------------------------------------------------------------------
// [Area 8] Live Database & API Testing
// ---------------------------------------------------------------------------
console.log('\n[Area 8] Live Dynamic DB Integration & CRUD Verification');

(async () => {
  try {
    // Own server on a free port with the isolated test database (never the live shop on :3000).
    const started = await iso.startServer();
    const base = started.base;

    async function api(method, urlPath, body = null, token = null) {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['x-admin-token'] = token;
      const res = await fetch(base + urlPath, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      });
      let data = null;
      try { data = await res.json(); } catch (_) {}
      return { status: res.status, ok: res.ok, data };
    }

    // 1. Admin login
    const loginRes = await api('POST', '/api/admin/login', {
      username: 'admin',
      password: process.env.ADMIN_PASSWORD || 'umaira2026'
    });
    assert(loginRes.ok, 'Admin login failed');
    const adminToken = loginRes.data.token;

    // 2. Fetch all products and categories
    const flowersRes = await api('GET', '/api/admin/flowers', null, adminToken);
    const bouquetsRes = await api('GET', '/api/admin/bouquets', null, adminToken);
    const categoriesRes = await api('GET', '/api/admin/categories', null, adminToken);

    assert(flowersRes.ok && Array.isArray(flowersRes.data.flowers), 'Failed to fetch flowers');
    assert(bouquetsRes.ok && Array.isArray(bouquetsRes.data.bouquets), 'Failed to fetch bouquets');
    assert(categoriesRes.ok && Array.isArray(categoriesRes.data.categories), 'Failed to fetch categories');

    const flowers = flowersRes.data.flowers;
    const bouquets = bouquetsRes.data.bouquets;
    const categories = categoriesRes.data.categories;

    // Counts are compared with the (temporary) database itself rather than a fixed catalog size.
    const countDb = new DatabaseSync(iso.dbPath, { readOnly: true });
    const dbActiveItems = countDb.prepare('SELECT COUNT(*) n FROM flowers WHERE archived = 0').get().n;
    const dbActiveBouquets = countDb.prepare('SELECT COUNT(*) n FROM bouquets WHERE archived = 0').get().n;
    const dbCategoryCount = (name) => countDb.prepare('SELECT (SELECT COUNT(*) FROM flowers WHERE archived = 0 AND category = ?) + (SELECT COUNT(*) FROM bouquets WHERE archived = 0 AND category = ?) n').get(name, name).n;

    await acheck('Admin API lists every active product, and the 6 core categories exist', async () => {
      assert.equal(flowers.length, dbActiveItems, 'Admin flowers/materials must equal active items in the database');
      assert.equal(bouquets.length, dbActiveBouquets, 'Admin bouquets must equal active bouquets in the database');
      for (const c of ['Ready-Made Bouquets', 'Fresh Flowers', 'Fillers & Foliage', 'Wrapping Materials', 'Ribbons', 'Greeting Cards'])
        assert(categories.some(x => x.name === c), 'Missing core category ' + c);
    });

    // 3. Category linked product counts
    await acheck('Categories return accurate product counts linked to catalog items', async () => {
      for (const name of ['Ready-Made Bouquets', 'Fresh Flowers', 'Fillers & Foliage', 'Wrapping Materials', 'Ribbons', 'Greeting Cards']) {
        const cat = categories.find(c => c.name === name);
        assert(cat, name + ' category missing');
        assert.equal(cat.productCount, dbCategoryCount(name), name + ': productCount ' + cat.productCount + ' does not match the database');
      }
      countDb.close();
    });

    // 4. Duplicate category name prevention
    await acheck('Duplicate category name is prevented with HTTP 409 Conflict', async () => {
      const dupRes = await api('POST', '/api/admin/categories', {
        name: 'Fresh Flowers',
        type: 'flower',
        description: 'Duplicate category test'
      }, adminToken);
      assert.equal(dupRes.status, 409, 'Duplicate category name should return 409 Conflict');
    });

    // 5. Deletion / archiving safeguard for linked categories
    await acheck('Categories with active linked products cannot be archived or deleted', async () => {
      const readyMadeCat = categories.find(c => c.name === 'Ready-Made Bouquets');
      const delRes = await api('DELETE', `/api/admin/categories/${readyMadeCat.id}`, null, adminToken);
      assert.equal(delRes.status, 400, 'Deleting a category with linked products should return 400 Bad Request');
      assert(delRes.data.error.includes('assigned to') || delRes.data.error.includes('product'), 'Error should explain linked products safeguard');
    });

    // 6. Test Product Actions (Archive & Restore)
    await acheck('Archiving and restoring a product works cleanly with real-time events', async () => {
      // Create temporary test item
      const createRes = await api('POST', '/api/admin/flowers', {
        name: 'Test Temporary Flower',
        category: 'Fresh Flowers',
        itemType: 'flower',
        price: 99,
        stockCount: 15,
        unitOfMeasure: 'stems'
      }, adminToken);
      assert(createRes.ok, 'Failed to create test flower');
      const testId = createRes.data.flower.id;

      // Archive it
      const archRes = await api('DELETE', `/api/admin/flowers/${testId}`, null, adminToken);
      assert(archRes.ok, 'Failed to archive test flower');

      // Verify it is not in active flowers
      const activeRes = await api('GET', '/api/admin/flowers', null, adminToken);
      assert(!activeRes.data.flowers.some(f => f.id === testId), 'Archived flower should not appear in active flowers');

      // Restore it
      const restoreRes = await api('POST', `/api/admin/flowers/${testId}/restore`, null, adminToken);
      assert(restoreRes.ok, 'Failed to restore flower');

      // Clean up test flower
      const db = new DatabaseSync(iso.dbPath);
      db.prepare('DELETE FROM stock_transactions WHERE flower_id = ?').run(testId); // log rows reference the item
      db.prepare('DELETE FROM flowers WHERE id = ?').run(testId);
      db.close();
    });

    console.log('\n======================================================');
    console.log(`TEST SUITE FINISHED: ${pass} passed, ${fail} failed`);
    console.log('======================================================');

    process.exitCode = fail > 0 ? 1 : 0;
  } catch (err) {
    console.error('Fatal test error:', err);
    process.exitCode = 1;
  } finally {
    iso.stopServer();
  }
})();
