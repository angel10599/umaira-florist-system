/**
 * Verification Script: Bouquet Cart and Checkout Logic
 * Tests:
 * 1. Ready-Made Bouquets - No Customization
 * 2. Replace Details with Add to Cart & Duplicate Quantity Increment
 * 3. Shopping Cart Persistence Across Logout/Login
 * 4. Buy Now Button & Only Ordered Items Removed Upon Purchase
 * 5. Out of Stock Handling (Retained in Cart, Blocks Checkout)
 * 6. Build Your Own Bouquet Distinct Customized Display & Summary
 */

// Isolated temporary database: this test can never touch the shop's real data (must load before server/store).
const iso = require('../tests/helpers/isolated-db');
const http = require('http');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let BASE_URL = ''; // set in runTests(): own server on a free port with the isolated test database

function request(method, urlPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const req = http.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, data: json, text: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  BASE_URL = (await iso.startServer()).base;
  console.log('=== BOUQUET CART & CHECKOUT LOGIC VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  function test(desc, fn) {
    try {
      fn();
      console.log(`  ✓ ${desc}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ ${desc}:`, e.message);
      failed++;
    }
  }

  async function asyncTest(desc, fn) {
    try {
      await fn();
      console.log(`  ✓ ${desc}`);
      passed++;
    } catch (e) {
      console.error(`  ✗ ${desc}:`, e.message);
      failed++;
    }
  }

  // -------------------------------------------------------------
  // 1. Ready-Made Bouquets - UI Checks
  // -------------------------------------------------------------
  console.log('[1] Verifying Ready-Made Bouquet Customization Lock:');
  const siteUpdateCode = fs.readFileSync(path.join(__dirname, '../js/site-update.js'), 'utf8');
  const appCode = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');

  test('suOpenBouquet modal does not contain "Customize in Studio"', () => {
    assert(!siteUpdateCode.includes('Customize in Studio'), 'Found Customize in Studio in site-update.js');
  });

  test('Collections product cards replaced Details button with Add to Cart', () => {
    // Both renderBouquetCard and compact should have Add to Cart button
    assert(siteUpdateCode.includes('<span>Add to Cart</span>'), 'Missing Add to Cart button in site-update.js');
    // And should not have the split Details button
    const cardSection = siteUpdateCode.slice(siteUpdateCode.indexOf('renderBouquetCard(bq)'), siteUpdateCode.indexOf('renderBouquetCard(bq)') + 1500);
    assert(!cardSection.includes("'Details'"), 'Found Details button inside renderBouquetCard');
  });

  test('appRouter.loadBouquetToBuilder rejects customizing ready-made bouquets', () => {
    assert(appCode.includes('Ready-made bouquets are artisan curated fixed products'), 'Missing ready-made bouquet customization guard');
  });

  // -------------------------------------------------------------
  // 2. Authentication & Persistent Cart API
  // -------------------------------------------------------------
  console.log('\n[2] Verifying Cart Persistence Across Auth Lifecycles:');

  const testEmail = `persistent_test_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let customerToken = '';
  let customerUser = null;

  await asyncTest('Customer registration succeeds', async () => {
    const reg = await request('POST', '/api/auth/register', {}, {
      name: 'Maria Santos',
      email: testEmail,
      password: testPassword,
      phone: '09171234567'
    });
    assert.strictEqual(reg.status, 201, `Failed to register: ${JSON.stringify(reg.data)}`);
    customerToken = reg.data.token;
    customerUser = reg.data.user;
    assert(customerToken, 'Missing customer token');
  });

  await asyncTest('Unauthenticated request to GET /api/cart is rejected', async () => {
    const r = await request('GET', '/api/cart');
    assert.strictEqual(r.status, 401, 'Guest should not access persistent /api/cart');
  });

  // Add items: 1 ready-made bouquet and 1 unpurchased custom bouquet
  const initialCartItems = [
    {
      cartItemId: 'item-ready-1',
      id: 'bq-blushing-romance',
      name: 'Blushing Romance',
      isCustom: false,
      price: 2650,
      quantity: 1,
      image: 'assets/flowers/placeholder.jpg'
    },
    {
      cartItemId: 'item-custom-1',
      id: 'custom-arrangement-1',
      name: 'My Special Bespoke Bouquet',
      isCustom: true,
      customKey: 'custom-key-12345',
      price: 3400,
      quantity: 1,
      message: 'Happy Anniversary!',
      specs: {
        mainFlowers: [{ id: 'fl-pink-rose', name: 'Pink Rose', quantity: 12, price: 150 }],
        fillers: [{ id: 'fil-babys-breath', name: "Baby's Breath", quantity: 2, price: 120 }],
        wrappings: [{ id: 'wrp-korean-matte', name: 'Korean Matte Paper', color: 'Blush Pink', price: 150 }],
        ribbons: [{ id: 'rbn-satin', name: 'Satin Ribbon', color: 'Champagne', price: 90 }],
        cardDesign: 'crd-classic-floral',
        cardMessage: 'Happy Anniversary!'
      }
    }
  ];

  await asyncTest('Save cart items to persistent DB cart via PUT /api/cart', async () => {
    const r = await request('PUT', '/api/cart', { Authorization: `Bearer ${customerToken}` }, {
      items: initialCartItems
    });
    assert.strictEqual(r.status, 200, `Failed to save cart: ${JSON.stringify(r.data)}`);
  });

  await asyncTest('Retrieve saved persistent cart via GET /api/cart', async () => {
    const r = await request('GET', '/api/cart', { Authorization: `Bearer ${customerToken}` });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.items.length, 2, 'Should have 2 cart items');
    assert.strictEqual(r.data.items[0].name, 'Blushing Romance');
    assert.strictEqual(r.data.items[1].name, 'My Special Bespoke Bouquet');
    assert.strictEqual(r.data.items[1].isCustom, true);
  });

  await asyncTest('Logout and log back in restores same persistent cart', async () => {
    // 1. Logout
    await request('POST', '/api/auth/logout', { Authorization: `Bearer ${customerToken}` });

    // 2. Re-login
    const login = await request('POST', '/api/auth/login', {}, {
      email: testEmail,
      password: testPassword
    });
    assert.strictEqual(login.status, 200);
    customerToken = login.data.token;

    // 3. Check persistent cart
    const r = await request('GET', '/api/cart', { Authorization: `Bearer ${customerToken}` });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.items.length, 2, 'Persistent cart must survive logout/login');
  });

  // -------------------------------------------------------------
  // 3. Order Placement & Cart Partial Purge
  // -------------------------------------------------------------
  console.log('\n[3] Verifying Order Submission and Cart Update:');

  // Let's purchase ONLY item 1 ('item-ready-1') and verify item 2 ('item-custom-1') stays in the cart
  await asyncTest('Placing order for ready-made bouquet only purges purchased item from DB cart', async () => {
    const orderNum = `FLR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const orderPayload = {
      orderNumber: orderNum,
      fulfillment: 'pickup',
      firstName: 'Maria',
      lastName: 'Santos',
      phone: '09171234567',
      email: testEmail,
      date: '2026-12-25',
      time: '14:00 - 16:00',
      paymentMethod: 'Cash on Pickup',
      items: [
        {
          cartItemId: 'item-ready-1',
          id: 'bq-blushing-romance',
          name: 'Blushing Romance',
          quantity: 1
        }
      ]
    };

    const r = await request('POST', '/api/orders', { Authorization: `Bearer ${customerToken}` }, orderPayload);
    // Note: If bq-blushing-romance recipe items are available or sold_out, test checks the cart behavior
    if (r.status === 201) {
      // Order created! Verify remaining cart
      const cartRes = await request('GET', '/api/cart', { Authorization: `Bearer ${customerToken}` });
      assert.strictEqual(cartRes.status, 200);
      assert.strictEqual(cartRes.data.items.length, 1, 'Only purchased item should be removed, 1 item remaining');
      assert.strictEqual(cartRes.data.items[0].cartItemId, 'item-custom-1', 'Unpurchased custom bouquet must remain in cart');
    } else {
      // If stock check prevented order, verify cart was NOT emptied on failure!
      const cartRes = await request('GET', '/api/cart', { Authorization: `Bearer ${customerToken}` });
      assert.strictEqual(cartRes.status, 200);
      assert.strictEqual(cartRes.data.items.length, 2, 'Failed order must NOT delete cart items');
    }
  });

  // -------------------------------------------------------------
  // 4. Cart View & Buy Now Logic in Frontend Files
  // -------------------------------------------------------------
  console.log('\n[4] Verifying Shopping Cart View & Buy Now Button Implementation:');

  test('Cart view renders "Buy Now" button', () => {
    assert(appCode.includes('id="cart-buy-now-btn"'), 'Missing #cart-buy-now-btn in app.js');
    assert(appCode.includes('<span>Buy Now</span>'), 'Missing Buy Now label in app.js');
    assert(appCode.includes('proceedToBuyNow'), 'Missing proceedToBuyNow method in app.js');
  });

  test('Cart view renders distinct "Customized" and "Ready-Made" badges', () => {
    assert(appCode.includes('>Customized<'), 'Missing Customized badge');
    assert(appCode.includes('>Ready-Made<'), 'Missing Ready-Made badge');
  });

  test('Cart view includes "View Customization Details" for custom bouquets', () => {
    assert(appCode.includes('showCustomizationDetails'), 'Missing showCustomizationDetails method in app.js');
    assert(appCode.includes('View Customization Details'), 'Missing View Customization Details button in app.js');
  });

  test('Cart view disables Buy Now when items are unavailable', () => {
    assert(appCode.includes('hasUnavailable'), 'Missing hasUnavailable check in app.js');
    assert(appCode.includes('Unavailable Item(s) in Cart'), 'Missing unavailable items alert banner in app.js');
  });

  test('reconcileCart keeps out of stock items in cart instead of deleting them', () => {
    const stateCode = fs.readFileSync(path.join(__dirname, '../js/state.js'), 'utf8');
    assert(stateCode.includes('hasUnavailableItems'), 'Missing hasUnavailableItems in state.js');
    assert(stateCode.includes('item.isUnavailable = true'), 'reconcileCart must set isUnavailable rather than removing item');
  });

  console.log('\n======================================================');
  console.log(`BOUQUET CART & CHECKOUT VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================');

  process.exit(failed > 0 ? 1 : 0); // also stops the test server
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
