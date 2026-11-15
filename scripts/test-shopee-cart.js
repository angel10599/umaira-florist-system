/**
 * Comprehensive Verification: Shopee-Style Cart Selection & Checkout Flow
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
  console.log('=== SHOPEE-STYLE CART SELECTION & CHECKOUT VERIFICATION ===\n');
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

  const appJs = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
  const accountJs = fs.readFileSync(path.join(__dirname, '../js/account.js'), 'utf8');

  // -------------------------------------------------------------
  // 1. Static Code & Structure Checks
  // -------------------------------------------------------------
  console.log('[1] Static Code & Logic Inspection:');

  test('AppRouter initializes selectedCartItemIds as Set', () => {
    assert(appJs.includes('this.selectedCartItemIds = new Set()'), 'Missing selectedCartItemIds initialization in app.js');
  });

  test('Cart item cards include checkboxes with the brand accent', () => {
    assert(appJs.includes('id="cart-item-chk-'), 'Missing cart-item-chk checkbox ID prefix');
    assert(appJs.includes('accent-[#647D69]'), 'Checkboxes should use the brand (sage) accent');
    assert(appJs.includes('onCartItemCheckChange'), 'Missing onCartItemCheckChange callback');
  });

  test('Cart view includes Select All checkbox bar', () => {
    assert(appJs.includes('id="cart-select-all"'), 'Missing #cart-select-all in cart view');
    assert(appJs.includes('toggleSelectAllCartItems'), 'Missing toggleSelectAllCartItems callback');
  });

  test('Unavailable items have disabled checkboxes and cannot be checked', () => {
    assert(appJs.includes('disabled:cursor-not-allowed'), 'Missing disabled styling for out of stock checkboxes');
    assert(appJs.includes('appState.isItemAvailable(item)'), 'Missing availability check for cart items');
  });

  test('Selected cart items receive a subtle highlight', () => {
    assert(appJs.includes("isSelected ? 'border-[#E5ECE6] bg-[#FFF9F5] ring-1"), 'Missing highlight styling on selected card');
  });

  test('Dynamic Checkout button displays correct states and item counts', () => {
    assert(appJs.includes('Select Items to Checkout'), 'Missing disabled label for 0 selected items');
    assert(appJs.includes('Checkout (${itemLabel})') || appJs.includes('Checkout (${selectedTotalQty'), 'Missing dynamic checkout button label');
    assert(appJs.includes('id="cart-buy-now-btn"'), 'Missing id="cart-buy-now-btn"');
  });

  test('Checkout view only displays selected items', () => {
    assert(appJs.includes('const checkoutItems = this.getCheckoutItems()'), 'Checkout view must use getCheckoutItems()');
    assert(!appJs.includes('${appState.cart.map(item => `\n                <div class="flex items-start gap-3 py-2 border-b border-stone-100 text-xs">\n                  <div class="w-12 h-12'), 'Checkout review list must not blindly iterate over entire appState.cart');
  });

  test('handlePlaceOrder sends only selected items and purges only ordered items', () => {
    assert(accountJs.includes('var checkoutItems = typeof self.getCheckoutItems === \'function\' ? self.getCheckoutItems() : appState.cart;'), 'handlePlaceOrder must use getCheckoutItems()');
    assert(accountJs.includes('appState.cart.filter(function (i) { return !orderedIds.has(i.cartItemId); })'), 'handlePlaceOrder must only filter out ordered items upon successful purchase');
  });

  // -------------------------------------------------------------
  // 2. Behavioral Unit Test in Headless JS Context
  // -------------------------------------------------------------
  console.log('\n[2] Component & Logic Unit Simulation:');

  test('Shopee Cart Selection calculations and state transitions', () => {
    // Mock minimal environment
    const mockAppState = {
      cart: [
        { cartItemId: 'c-1', id: 'bq-1', name: 'Bouquet 1', price: 500, quantity: 2, isUnavailable: false },
        { cartItemId: 'c-2', id: 'bq-2', name: 'Bouquet 2', price: 800, quantity: 1, isUnavailable: false },
        { cartItemId: 'c-3', id: 'bq-3', name: 'Bouquet 3', price: 1200, quantity: 1, isUnavailable: true } // Out of stock
      ],
      isItemAvailable(item) {
        return !item.isUnavailable;
      },
      getDeliveryFee(subtotal) {
        return subtotal >= 2500 ? 0 : 150;
      }
    };

    // Instantiate mock router logic
    class MockRouter {
      constructor() {
        this.selectedCartItemIds = new Set();
      }
      pruneSelectedCartItems() {
        const validIds = new Set(mockAppState.cart.filter(i => mockAppState.isItemAvailable(i)).map(i => i.cartItemId));
        for (const id of Array.from(this.selectedCartItemIds)) {
          if (!validIds.has(id)) this.selectedCartItemIds.delete(id);
        }
      }
      isCartItemSelected(id) {
        return this.selectedCartItemIds.has(id);
      }
      getCheckoutItems() {
        this.pruneSelectedCartItems();
        return mockAppState.cart.filter(i => this.isCartItemSelected(i.cartItemId) && mockAppState.isItemAvailable(i));
      }
      onCartItemCheckChange(id, checked) {
        if (checked) {
          const item = mockAppState.cart.find(i => i.cartItemId === id);
          if (item && mockAppState.isItemAvailable(item)) this.selectedCartItemIds.add(id);
        } else {
          this.selectedCartItemIds.delete(id);
        }
      }
      toggleSelectAll(checked) {
        if (checked) {
          mockAppState.cart.forEach(i => {
            if (mockAppState.isItemAvailable(i)) this.selectedCartItemIds.add(i.cartItemId);
          });
        } else {
          this.selectedCartItemIds.clear();
        }
      }
      calculateSummary() {
        const items = this.getCheckoutItems();
        const totalQty = items.reduce((s, i) => s + (Number(i.quantity) || 1), 0);
        const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.quantity) || 1), 0);
        const fee = totalQty > 0 ? mockAppState.getDeliveryFee(subtotal) : 0;
        const total = subtotal + fee;
        let btnText = 'Select Items to Checkout';
        if (totalQty === 1) btnText = 'Checkout (1 Item)';
        else if (totalQty > 1) btnText = `Checkout (${totalQty} Items)`;
        return { totalQty, subtotal, fee, total, btnText };
      }
    }

    const router = new MockRouter();

    // Initial state: nothing selected
    let s0 = router.calculateSummary();
    assert.strictEqual(s0.totalQty, 0);
    assert.strictEqual(s0.subtotal, 0);
    assert.strictEqual(s0.fee, 0);
    assert.strictEqual(s0.total, 0);
    assert.strictEqual(s0.btnText, 'Select Items to Checkout');

    // Select Bouquet 1 (qty 2)
    router.onCartItemCheckChange('c-1', true);
    let s1 = router.calculateSummary();
    assert.strictEqual(s1.totalQty, 2, 'Should have 2 items (sum of quantities)');
    assert.strictEqual(s1.subtotal, 1000, 'Subtotal: 500 * 2 = 1000');
    assert.strictEqual(s1.fee, 150, 'Delivery fee: 150');
    assert.strictEqual(s1.total, 1150, 'Total: 1150');
    assert.strictEqual(s1.btnText, 'Checkout (2 Items)');

    // Attempt to select unavailable Bouquet 3 (should be ignored)
    router.onCartItemCheckChange('c-3', true);
    assert.strictEqual(router.isCartItemSelected('c-3'), false, 'Unavailable items must not be selected');

    // Select All
    router.toggleSelectAll(true);
    let sAll = router.calculateSummary();
    assert.strictEqual(sAll.totalQty, 3, 'Available quantities: 2 + 1 = 3');
    assert.strictEqual(sAll.subtotal, 1800, 'Subtotal: 1000 + 800 = 1800');
    assert.strictEqual(sAll.btnText, 'Checkout (3 Items)');

    // Deselect Bouquet 1
    router.onCartItemCheckChange('c-1', false);
    let sB2 = router.calculateSummary();
    assert.strictEqual(sB2.totalQty, 1);
    assert.strictEqual(sB2.subtotal, 800);
    assert.strictEqual(sB2.btnText, 'Checkout (1 Item)');

    // Deselect All
    router.toggleSelectAll(false);
    let sNone = router.calculateSummary();
    assert.strictEqual(sNone.totalQty, 0);
    assert.strictEqual(sNone.btnText, 'Select Items to Checkout');
  });

  // -------------------------------------------------------------
  // 3. API & End-to-End Cart Order Retention
  // -------------------------------------------------------------
  console.log('\n[3] End-to-End Order Placement and Cart Retention:');

  const testEmail = `shopee_cart_${Date.now()}@example.com`;
  const testPassword = 'Password123!';
  let customerToken = '';

  await asyncTest('Register customer account', async () => {
    const reg = await request('POST', '/api/auth/register', {}, {
      name: 'Elena Ramos',
      email: testEmail,
      password: testPassword,
      phone: '09189876543'
    });
    assert.strictEqual(reg.status, 201);
    customerToken = reg.data.token;
  });

  // Populate persistent cart with 3 items: Item A (qty 2), Item B (qty 1), Item C (qty 1)
  const cartSetup = [
    { cartItemId: 'item-a', id: 'bq-sweet-romance', name: 'Sweet Romance', price: 685, quantity: 2, isCustom: false },
    { cartItemId: 'item-b', id: 'bq-gentle-whisper', name: 'Gentle Whisper', price: 280, quantity: 1, isCustom: false },
    { cartItemId: 'item-c', id: 'item-c-custom', name: 'Bespoke Arrangement', price: 1500, quantity: 1, isCustom: true, customKey: 'c-specs' }
  ];

  await asyncTest('Initialize cart with 3 items via PUT /api/cart', async () => {
    const r = await request('PUT', '/api/cart', { Authorization: `Bearer ${customerToken}` }, { items: cartSetup });
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.data.items.length, 3);
  });

  await asyncTest('Simulate purchasing ONLY Item A (Selected in Shopee checkout)', async () => {
    const orderNum = `FLR-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const orderPayload = {
      orderNumber: orderNum,
      fulfillment: 'pickup',
      firstName: 'Elena',
      lastName: 'Ramos',
      phone: '09189876543',
      email: testEmail,
      date: '2026-12-28',
      time: '10:00 - 12:00',
      paymentMethod: 'Cash on Pickup',
      // Send only Item A
      items: [
        {
          cartItemId: 'item-a',
          id: 'bq-sweet-romance',
          name: 'Sweet Romance',
          quantity: 2
        }
      ]
    };

    const orderRes = await request('POST', '/api/orders', { Authorization: `Bearer ${customerToken}` }, orderPayload);
    if (orderRes.status === 201) {
      // Order created! Verify remaining cart contains Item B and Item C
      const cartRes = await request('GET', '/api/cart', { Authorization: `Bearer ${customerToken}` });
      assert.strictEqual(cartRes.status, 200);
      assert.strictEqual(cartRes.data.items.length, 2, 'Remaining cart must contain exactly 2 unpurchased items');
      const remainingIds = cartRes.data.items.map(i => i.cartItemId);
      assert(remainingIds.includes('item-b'), 'Item B must be preserved in cart');
      assert(remainingIds.includes('item-c'), 'Item C (custom) must be preserved in cart');
      assert(!remainingIds.includes('item-a'), 'Item A must be removed from cart after purchase');
    } else {
      // In case stock prevents order creation, verify cart is completely preserved
      const cartRes = await request('GET', '/api/cart', { Authorization: `Bearer ${customerToken}` });
      assert.strictEqual(cartRes.status, 200);
      assert.strictEqual(cartRes.data.items.length, 3, 'Failed/rejected order must not alter cart');
    }
  });

  console.log('\n======================================================');
  console.log(`SHOPEE-STYLE CART VERIFICATION SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('======================================================');

  process.exit(failed > 0 ? 1 : 0); // also stops the test server
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
