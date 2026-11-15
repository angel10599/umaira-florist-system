/**
 * UMAIRA FLORIST — FLOWERS & MATERIALS MANAGEMENT TEST SUITE
 * Verifies unified flowers and bouquet materials management, custom builder integration,
 * stock tracking, dynamic pricing, and UI/UX consistency.
 */

// Isolated temporary database: this test can never touch the shop's real data (must load before server/store).
const iso = require('./helpers/isolated-db');
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const app = require('../server.js');
const store = require('../server/store.js');
const rules = require('../js/shop-rules.js');

let pass = 0;
let fail = 0;
const failures = [];

function check(name, cond, extra) {
  if (cond) {
    pass++;
    console.log('  ok   ' + name);
  } else {
    fail++;
    failures.push(name);
    console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + JSON.stringify(extra) : ''));
  }
}

(async () => {
  console.log('\n======================================================');
  console.log('UMAIRA FLORIST — FLOWERS & MATERIALS TEST SUITE');
  console.log('======================================================\n');

  const adminHtml = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
  const adminJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'admin.js'), 'utf8');
  const builderJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'builder.js'), 'utf8');
  const stateJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'state.js'), 'utf8');

  // ---------------------------------------------------------------------------
  // [Area 1] Product Management Tabs & Navigation Structure
  // ---------------------------------------------------------------------------
  console.log('[Area 1] Product Management Tabs & Navigation Structure');

  // Current approved layout: Products, Materials and Categories are managed in one "Store Management" screen
  // (one table filtered by category) instead of separate sub-tabs.
  check('Store Management screen exists', adminHtml.includes('data-tab-content="store"') && adminHtml.includes('id="admin-store-tbody"'));
  const catFilter = (adminHtml.match(/id="store-category-filter"[\s\S]*?<\/select>/) || [''])[0];
  check('Category filter lists every core category (flowers, fillers & foliage, wrapping, ribbons, cards, bouquets)',
    ['Ready-Made Bouquets', 'Fresh Flowers', 'Fillers &amp; Foliage', 'Wrapping Materials', 'Ribbons', 'Greeting Cards']
      .every(c => catFilter.includes(c)), catFilter.length);
  check('Categories are managed from the Store screen (Manage Categories)', adminHtml.includes('openCategoryManageModal()'));
  check('No separate Customization or Materials tab exists',
    !adminHtml.includes('data-prod-tab="customization"') && !adminHtml.includes('data-prod-tab="materials"'));

  // ---------------------------------------------------------------------------
  // [Area 2] Store Management controls and the unified Add Product & Material form
  // ---------------------------------------------------------------------------
  console.log('\n[Area 2] Store Management controls and the unified product form');

  check('Search input #store-search-input exists', adminHtml.includes('id="store-search-input"'));
  check('Store table pagination container (#store-pagination) present', adminHtml.includes('id="store-pagination"'));
  check('Unified form is titled "Add Product & Material"', adminHtml.includes('Add Product &amp; Material'));
  check('Unified form has category, unit of measure, supplier, unit cost, stock and image fields',
    ['product-field-category', 'product-field-uom', 'product-field-supplier', 'product-field-cost', 'product-field-stock', 'product-field-image']
      .every(id => adminHtml.includes(`id="${id}"`)));

  // ---------------------------------------------------------------------------
  // [Area 3] Modal Form Support for Diverse Materials
  // ---------------------------------------------------------------------------
  console.log('\n[Area 3] Modal Form Support for Diverse Materials');

  check('Modal has Item Type select (#flower-field-item-type)',
    adminHtml.includes('id="flower-field-item-type"'));
  check('Modal has Botanical Name input (#flower-field-botanical)',
    adminHtml.includes('id="flower-field-botanical"'));
  check('Modal has Style/Design input (#flower-field-style)',
    adminHtml.includes('id="flower-field-style"'));
  check('Modal has Unit of Measure select (#flower-field-uom)',
    adminHtml.includes('id="flower-field-uom"'));
  check('Unit of Measure options include stems, sheets, rolls, cards, pieces',
    adminHtml.includes('value="stems"') &&
    adminHtml.includes('value="sheets"') &&
    adminHtml.includes('value="rolls"') &&
    adminHtml.includes('value="cards"') &&
    adminHtml.includes('value="pieces"'));
  check('Modal has color picker and text field (#flower-field-color-picker, #flower-field-color)',
    adminHtml.includes('id="flower-field-color-picker"') && adminHtml.includes('id="flower-field-color"'));

  // ---------------------------------------------------------------------------
  // [Area 4] Live Server & Admin API Material CRUD
  // ---------------------------------------------------------------------------
  console.log('\n[Area 4] Live Server & Admin API Material CRUD');

  const server = await app.start(0);
  const base = 'http://127.0.0.1:' + server.address().port;

  async function api(method, urlPath, body = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = 'Bearer ' + token;
      headers['x-admin-token'] = token;
    }
    const res = await fetch(base + urlPath, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });
    let data;
    try { data = await res.json(); } catch (_) { data = null; }
    return { status: res.status, ok: res.ok, data };
  }

  // Login as admin
  const loginRes = await api('POST', '/api/admin/login', { username: 'admin', password: process.env.ADMIN_PASSWORD || 'admin' });
  check('Admin login succeeds', loginRes.ok && !!loginRes.data.token);
  const adminToken = loginRes.data ? loginRes.data.token : null;

  // Verify materials exist in seeded database
  const flowersRes = await api('GET', '/api/admin/flowers', null, adminToken);
  check('GET /api/admin/flowers returns items', flowersRes.ok && Array.isArray(flowersRes.data.flowers));
  
  const allItems = flowersRes.data.flowers || [];
  const flowersOnly = allItems.filter(i => i.itemType === 'flower');
  const fillers = allItems.filter(i => i.itemType === 'filler');
  const foliage = allItems.filter(i => i.itemType === 'foliage');
  const wrappings = allItems.filter(i => i.itemType === 'wrapping');
  const ribbons = allItems.filter(i => i.itemType === 'ribbon');
  const cards = allItems.filter(i => i.itemType === 'card');

  check('Seeded database contains fresh flowers', flowersOnly.length >= 20);
  check('Seeded database contains fillers', fillers.length >= 4);
  check('Seeded database contains greenery/foliage', foliage.length >= 4);
  check('Seeded database contains wrapping papers', wrappings.length >= 5);
  check('Seeded database contains ribbons', ribbons.length >= 5);
  check('Seeded database contains message cards', cards.length >= 4);

  // Test itemType query filter on admin endpoint
  const wrappingFilterRes = await api('GET', '/api/admin/flowers?type=wrapping', null, adminToken);
  check('GET /api/admin/flowers?type=wrapping filters correctly',
    wrappingFilterRes.ok && wrappingFilterRes.data.flowers.every(f => f.itemType === 'wrapping'));

  // Admin Add a new material (e.g. Japanese Chiffon Ribbon)
  const newMaterialPayload = {
    name: 'Champagne Gold Chiffon Ribbon',
    itemType: 'ribbon',
    category: 'Ribbons',
    style: 'Translucent Shimmer Organza',
    color: '#fef08a',
    price: 45,
    stockCount: 30,
    unitOfMeasure: 'rolls',
    availability: 'available',
    unitCost: 18,
    lowStockThreshold: 5,
    description: 'Ethereal golden sheer ribbon for delicate luxury finish.'
  };

  const addMatRes = await api('POST', '/api/admin/flowers', newMaterialPayload, adminToken);
  check('Admin can add new ribbon material', addMatRes.ok && addMatRes.data.flower && addMatRes.data.flower.itemType === 'ribbon');
  const createdRibbonId = addMatRes.data.flower.id;
  check('Material ID assigned appropriate prefix (rbn-)', createdRibbonId.startsWith('rbn-'));

  // Admin Edit Material price and stock
  const editMatRes = await api('PUT', `/api/admin/flowers/${createdRibbonId}`, {
    ...newMaterialPayload,
    price: 55,
    stockCount: 28
  }, adminToken);
  check('Admin can edit material price and stock count',
    editMatRes.ok && editMatRes.data.flower.price === 55 && editMatRes.data.flower.stockCount === 28);

  // ---------------------------------------------------------------------------
  // [Area 5] Storefront Catalog & Builder Integration
  // ---------------------------------------------------------------------------
  console.log('\n[Area 5] Storefront Catalog & Builder Integration');

  // Verify public catalog endpoint
  const catalogRes = await api('GET', '/api/catalog');
  check('GET /api/catalog returns 200', catalogRes.ok);
  check('Public catalog separates flowers and materials cleanly',
    catalogRes.data.flowers.length >= 20 && Array.isArray(catalogRes.data.materials));
  check('Created material is present in public catalog materials',
    catalogRes.data.materials.some(m => m.id === createdRibbonId));

  // Check state.js logic for applying materials to FLOWER_DATA
  // applyCatalog sorts the ACTIVE database materials into fillers, wrappings and ribbons for the builder.
  check('state.js applyCatalog ingests materials into FLOWER_DATA',
    stateJs.includes('activeMaterials.filter(') &&
    stateJs.includes("m.itemType === 'filler'") &&
    stateJs.includes("m.itemType === 'wrapping'") &&
    stateJs.includes("m.itemType === 'ribbon'"));

  // Check builder.js for sold-out validation
  // One customer-facing message for every sold-out component, same wording as the server.
  check('builder.js validates sold out items on Step 2 (fillers & greenery)',
    /fil\.availability === 'sold_out'[\s\S]{0,160}is currently unavailable for purchase/.test(builderJs));
  check('builder.js validates sold out items on Step 3 (wrapping & ribbon)',
    /wrp\.availability === 'sold_out'[\s\S]{0,160}is currently unavailable for purchase/.test(builderJs) &&
    /rbn\.availability === 'sold_out'[\s\S]{0,160}is currently unavailable for purchase/.test(builderJs));

  // ---------------------------------------------------------------------------
  // [Area 6] Custom Bouquet Pricing & Material Inventory Deduction
  // ---------------------------------------------------------------------------
  console.log('\n[Area 6] Custom Bouquet Pricing & Material Inventory Deduction');

  // Register a test customer for placing orders
  const custEmail = `clarissa_${Date.now()}@example.com`;
  const regRes = await api('POST', '/api/auth/register', {
    name: 'Clarissa Reyes',
    email: custEmail,
    password: 'password123',
    phone: '09181234567'
  });
  const verifyRes = regRes.data?.testOtp
    ? await api('POST', '/api/auth/verify-otp', { email: custEmail, otp: regRes.data.testOtp })
    : { status: 0, data: null };
  const customerToken = verifyRes.data?.token;
  check('Customer registered for material checkout test', !!customerToken);

  // Order with custom bouquet using database materials. A fresh catalog starts most items at 0 stock,
  // so stock the chosen components through the admin restock endpoint first (temporary test database).
  const targetFlower = flowersOnly.find(f => f.stockCount >= 10) || flowersOnly[0];
  for (const id of [targetFlower.id, fillers[0].id, wrappings[0].id, cards[0].id]) {
    await api('POST', '/api/admin/inventory/adjust', { flowerId: id, type: 'restock', quantity: 20, reason: 'Test setup' }, adminToken);
  }
  const stockNow = async (id) => (await api('GET', '/api/admin/flowers', null, adminToken)).data.flowers.find(f => f.id === id).stockCount;
  const initialWrapStock = await stockNow(wrappings[0].id);
  const initialRibbonStock = await stockNow(createdRibbonId);
  const initialFlowerStock = await stockNow(targetFlower.id);

  const orderPayload = {
    fulfillment: 'delivery',
    firstName: 'Clarissa',
    lastName: 'Reyes',
    phone: '09181234567',
    email: custEmail,
    address: '50 Bonifacio High St',
    district: '4',
    barangay: 'Barangay 400',
    city: 'Manila',
    date: rules.earliestDate('delivery'),
    time: rules.deliverySlots[0],
    paymentMethod: 'GCash',
    items: [
      {
        name: 'Artisan Bespoke Bouquet',
        isCustom: true,
        quantity: 1,
        // Current builder format: lists of components (fillers with quantities, wrappings, ribbons).
        specs: {
          mainFlowers: [{ id: targetFlower.id, quantity: 3 }],
          fillers: [{ id: fillers[0].id, quantity: 1 }],
          wrappings: [{ id: wrappings[0].id }],
          ribbons: [{ id: createdRibbonId }],
          cardDesign: cards[0].id
        }
      }
    ]
  };

  const orderRes = await api('POST', '/api/orders', orderPayload, customerToken);
  check('Placing custom bouquet order with materials succeeds', orderRes.ok && !!orderRes.data.orderNumber, orderRes.data && orderRes.data.error);
  const placedOrderNum = orderRes.data ? orderRes.data.orderNumber : null;

  // Check inventory deduction for flower stem and materials
  const verifyFlowerRes = await api('GET', '/api/admin/flowers', null, adminToken);
  const updatedFlowers = verifyFlowerRes.data.flowers;
  const updatedFlower = updatedFlowers.find(f => f.id === targetFlower.id);
  const updatedWrap = updatedFlowers.find(f => f.id === wrappings[0].id);
  const updatedRibbon = updatedFlowers.find(f => f.id === createdRibbonId);

  check('Flower stem stock decremented by 3', updatedFlower.stockCount === initialFlowerStock - 3);
  check('Wrapping paper stock decremented by 1 sheet', updatedWrap.stockCount === initialWrapStock - 1);
  check('Ribbon stock decremented by 1 roll', updatedRibbon.stockCount === initialRibbonStock - 1);

  // Sold out material rejection
  // Mark the created ribbon as sold_out
  await api('PUT', `/api/admin/flowers/${createdRibbonId}`, {
    ...newMaterialPayload,
    price: 55,
    stockCount: 0,
    availability: 'sold_out'
  }, adminToken);

  const soldOutOrderRes = await api('POST', '/api/orders', orderPayload, customerToken);
  check('Order with sold out material is rejected',
    !soldOutOrderRes.ok && /out of stock|sold out|unavailable for purchase/i.test(soldOutOrderRes.data.error), soldOutOrderRes.data && soldOutOrderRes.data.error);

  // Deactivate (Archive) material
  const archiveRes = await api('DELETE', `/api/admin/flowers/${createdRibbonId}`, null, adminToken);
  check('Admin can archive material', archiveRes.ok && archiveRes.data.archived === true);

  const postArchiveFlowers = await api('GET', '/api/admin/flowers', null, adminToken);
  check('Archived material is excluded from active flowers & materials list',
    !postArchiveFlowers.data.flowers.some(f => f.id === createdRibbonId));

  // Clean close
  await new Promise(r => server.close(r));

  console.log('\n======================================================');
  console.log(`MATERIALS MANAGEMENT RESULT: ${pass} passed, ${fail} failed`);
  console.log('======================================================\n');

  if (fail > 0) {
    console.error('FAILURES:', failures);
    process.exit(1);
  }
})();
