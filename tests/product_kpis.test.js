/**
 * tests/product_kpis.test.js
 *
 * Verifies the 4 Product Management KPI Cards:
 * 1. Total Products
 * 2. Fresh Flowers
 * 3. Ready-Made Bouquets
 * 4. Bouquet Materials
 *
 * Tests structure, responsive layout, dynamic calculation from DB, and live update behavior.
 */

// Isolated temporary database: this test can never touch the shop's real data (must load before server/store).
const iso = require('./helpers/isolated-db');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ADMIN_HTML_PATH = path.join(ROOT, 'admin.html');
const ADMIN_JS_PATH = path.join(ROOT, 'js', 'admin.js');
const STORE_PATH = path.join(ROOT, 'server', 'store.js');

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
console.log('UMAIRA FLORIST — PRODUCT MANAGEMENT KPI CARDS TEST');
console.log('======================================================\n');

// ---------------------------------------------------------------------------
// [Area 1] Admin HTML Structure & Responsive Grid Container
// ---------------------------------------------------------------------------
console.log('[Area 1] Admin HTML Structure & Responsive Grid');

const adminHtml = fs.readFileSync(ADMIN_HTML_PATH, 'utf8');

check('Product KPI grid container #products-kpi-grid exists in admin.html', () => {
  assert(adminHtml.includes('id="products-kpi-grid"'), 'Missing #products-kpi-grid');
});

check('Store KPI grid is positioned inside data-tab-content="store", before the filters', () => {
  const m = adminHtml.match(/<div data-tab-content="store"[\s\S]*?id="store-kpi-grid"[\s\S]*?id="store-filter-container"/);
  assert(m, 'Store KPI grid must be located inside the Store screen before filters');
});

check('Product KPI grid specifies responsive layout with 4 columns on desktop', () => {
  assert(adminHtml.includes('id="products-kpi-grid"'), 'Missing id="products-kpi-grid"');
  assert(adminHtml.includes('grid-cols-1'), 'Missing 1-col mobile class');
  assert(adminHtml.includes('sm:grid-cols-2'), 'Missing 2-col tablet class');
  assert(adminHtml.includes('lg:grid-cols-4'), 'Missing 4-col desktop class for 1 row');
});

check('Unified Store Management layout replaces the 3 product subtabs', () => {
  assert(adminHtml.includes('id="store-filter-container"'), 'Missing #store-filter-container');
  assert(adminHtml.includes('id="admin-store-tbody"'), 'Missing #admin-store-tbody');
  assert(!adminHtml.includes('id="products-subtab-nav"'), 'Old subtab nav should be removed');
});

// ---------------------------------------------------------------------------
// [Area 2] JavaScript renderProductKPIs Implementation in admin.js
// ---------------------------------------------------------------------------
console.log('\n[Area 2] JavaScript renderProductKPIs Method & Calling Hooks');

const adminJs = fs.readFileSync(ADMIN_JS_PATH, 'utf8');

check('admin.js implements renderProductKPIs method', () => {
  assert(adminJs.includes('renderProductKPIs('), 'Missing renderProductKPIs definition');
});

check('renderProductKPIs defines cards for all four required metrics', () => {
  assert(adminJs.includes('Total Products'), 'Missing Total Products KPI card label');
  assert(adminJs.includes('Fresh Flowers'), 'Missing Fresh Flowers KPI card label');
  assert(adminJs.includes('Ready-Made Bouquets'), 'Missing Ready-Made Bouquets KPI card label');
  assert(adminJs.includes('Bouquet Materials'), 'Missing Bouquet Materials KPI card label');
});

check('Store KPI cards output SVG icons in styled icon boxes', () => {
  const s = adminJs.replace(/\r\n/g, '\n'); const i = s.indexOf('renderStoreKPIs() {'); assert(i > 0, 'Missing renderStoreKPIs');
  const body = s.slice(i, s.indexOf('\n  }\n', i));
  assert((body.match(/<svg/g) || []).length >= 4, 'Each KPI card needs an icon');
  // Phase 1: every KPI card is rendered by the shared kpiCardHTML component, which puts the icon in a centred box.
  assert((body.match(/this\.kpiCardHTML\(/g) || []).length >= 4, 'Each KPI card must use the shared kpiCardHTML component');
  const h = s.indexOf('  kpiCardHTML('); const helper = s.slice(h, s.indexOf('\n  }\n', h));
  assert(/class="kpi-card__icon[^"]*"[^>]*>\$\{iconSvg\}/.test(helper), 'Each icon must sit in a centred icon box');
  assert(/\.kpi-card__icon\s*\{[^}]*justify-content:\s*center/.test(adminHtml), 'Icon box must centre the icon');
});

check('loadFlowers invokes renderProductKPIs', () => {
  const loadFlowersMatch = adminJs.match(/async loadFlowers\(\)\s*\{[\s\S]*?this\.renderProductKPIs\(\);/);
  assert(loadFlowersMatch, 'loadFlowers must call renderProductKPIs');
});

check('loadBouquets invokes renderProductKPIs', () => {
  const loadBouquetsMatch = adminJs.match(/async loadBouquets\(\)\s*\{[\s\S]*?this\.renderProductKPIs\(\);/);
  assert(loadBouquetsMatch, 'loadBouquets must call renderProductKPIs');
});

check('switchProductTab invokes renderProductKPIs', () => {
  const switchTabMatch = adminJs.match(/switchProductTab\(subtab\)\s*\{[\s\S]*?this\.renderProductKPIs\(\);/);
  assert(switchTabMatch, 'switchProductTab must call renderProductKPIs');
});

// ---------------------------------------------------------------------------
// [Area 3] Live Calculation & Database Consistency
// ---------------------------------------------------------------------------
console.log('\n[Area 3] Dynamic DB Calculation & Live CRUD Updates');

const app = require('../server.js');

(async () => {
  let server;
  try {
    server = await app.start(0);
    const port = server.address().port;
    const base = `http://127.0.0.1:${port}`;

    async function api(method, urlPath, body = null, token = null) {
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers['x-admin-token'] = token;
      }
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
    assert(loginRes.ok, 'Admin login failed: ' + JSON.stringify(loginRes.data));
    const adminToken = loginRes.data.token;

    // 2. Fetch live data
    const flowersRes = await api('GET', '/api/admin/flowers', null, adminToken);
    const bouquetsRes = await api('GET', '/api/admin/bouquets', null, adminToken);
    assert(flowersRes.ok && Array.isArray(flowersRes.data.flowers), 'Failed to fetch flowers');
    assert(bouquetsRes.ok && Array.isArray(bouquetsRes.data.bouquets), 'Failed to fetch bouquets');

    const flowers = flowersRes.data.flowers;
    const bouquets = bouquetsRes.data.bouquets;

    const freshFlowersCount = flowers.filter(f => (f.itemType || 'flower') === 'flower').length;
    const bouquetMaterialsCount = flowers.filter(f => f.itemType && f.itemType !== 'flower').length;
    const readyMadeBouquetsCount = bouquets.length;
    const totalProductsCount = flowers.length + bouquets.length;

    await acheck('DB contains valid counts for all 4 metrics', async () => {
      assert(totalProductsCount > 0, 'Total products must be > 0');
      assert(freshFlowersCount >= 10, 'Fresh flowers should be at least 10');
      assert(readyMadeBouquetsCount >= 10, 'Ready-made bouquets should be at least 10');
      assert(bouquetMaterialsCount >= 20, 'Bouquet materials should be at least 20');
      assert.equal(totalProductsCount, freshFlowersCount + readyMadeBouquetsCount + bouquetMaterialsCount);
    });

    // 3. Test dynamic update on adding a new material
    let addedMaterialId = null;
    await acheck('Adding new bouquet material increments bouquet materials and total products', async () => {
      const addRes = await api('POST', '/api/admin/flowers', {
        name: 'Test Metallic Gold Cord Ribbon',
        category: 'Ribbons',
        itemType: 'ribbon',
        price: 35,
        stockCount: 50,
        unitOfMeasure: 'rolls',
        description: 'Metallic cord for bouquets'
      }, adminToken);

      assert(addRes.ok && addRes.data.flower, 'Add material failed');
      addedMaterialId = addRes.data.flower.id;

      const updatedFlowersRes = await api('GET', '/api/admin/flowers', null, adminToken);
      const updatedFlowers = updatedFlowersRes.data.flowers;
      const newMaterialsCount = updatedFlowers.filter(f => f.itemType && f.itemType !== 'flower').length;
      const newTotal = updatedFlowers.length + bouquets.length;

      assert.equal(newMaterialsCount, bouquetMaterialsCount + 1, 'Bouquet materials count should increment by 1');
      assert.equal(newTotal, totalProductsCount + 1, 'Total products count should increment by 1');
    });

    // 4. Test dynamic update on archiving material
    await acheck('Archiving bouquet material decrements bouquet materials and total products', async () => {
      assert(addedMaterialId, 'addedMaterialId missing');
      const delRes = await api('DELETE', `/api/admin/flowers/${addedMaterialId}`, null, adminToken);
      assert(delRes.ok, 'Archive material failed');

      const revertedFlowersRes = await api('GET', '/api/admin/flowers', null, adminToken);
      const revertedFlowers = revertedFlowersRes.data.flowers;
      const revertedMaterialsCount = revertedFlowers.filter(f => f.itemType && f.itemType !== 'flower').length;
      const revertedTotal = revertedFlowers.length + bouquets.length;

      assert.equal(revertedMaterialsCount, bouquetMaterialsCount, 'Materials count should revert');
      assert.equal(revertedTotal, totalProductsCount, 'Total products count should revert');
    });

    // 5. Test dynamic update on adding a ready-made bouquet
    let addedBouquetId = null;
    await acheck('Adding new ready-made bouquet increments ready-made bouquets and total products', async () => {
      const addBqRes = await api('POST', '/api/admin/bouquets', {
        name: 'Test Sunset Radiance Bouquet',
        category: 'Ready-Made Bouquets',
        occasion: 'Celebration',
        price: 1599,
        formula: 'Sunflowers, Gerberas, Korean Wrap',
        description: 'Vibrant sunset tones'
      }, adminToken);

      assert(addBqRes.ok && addBqRes.data.bouquet, 'Add bouquet failed');
      addedBouquetId = addBqRes.data.bouquet.id;

      const updatedBqRes = await api('GET', '/api/admin/bouquets', null, adminToken);
      const updatedBouquets = updatedBqRes.data.bouquets;
      const newBouquetCount = updatedBouquets.length;
      const newTotal = flowers.length + updatedBouquets.length;

      assert.equal(newBouquetCount, readyMadeBouquetsCount + 1, 'Ready-made bouquets count should increment by 1');
      assert.equal(newTotal, totalProductsCount + 1, 'Total products count should increment by 1');
    });

    // 6. Test dynamic update on archiving ready-made bouquet
    await acheck('Archiving ready-made bouquet decrements bouquets and total products', async () => {
      assert(addedBouquetId, 'addedBouquetId missing');
      const delBqRes = await api('DELETE', `/api/admin/bouquets/${addedBouquetId}`, null, adminToken);
      assert(delBqRes.ok, 'Archive bouquet failed');

      const revertedBqRes = await api('GET', '/api/admin/bouquets', null, adminToken);
      const revertedBouquets = revertedBqRes.data.bouquets;
      const revertedBouquetCount = revertedBouquets.length;
      const revertedTotal = flowers.length + revertedBouquets.length;

      assert.equal(revertedBouquetCount, readyMadeBouquetsCount, 'Bouquets count should revert');
      assert.equal(revertedTotal, totalProductsCount, 'Total products count should revert');
    });

    // Clean close
    server.close();

  } catch (err) {
    console.error('Fatal error during KPI tests:', err);
    fail++;
  }

  console.log('\n======================================================');
  console.log(`PRODUCT MANAGEMENT KPI RESULT: ${pass} passed, ${fail} failed`);
  console.log('======================================================');

  process.exitCode = fail > 0 ? 1 : 0;
})();
