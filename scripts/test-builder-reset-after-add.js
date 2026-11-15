// scripts/test-builder-reset-after-add.js
// Verification for: Reset Bouquet Builder After Add to Cart

const assert = require('assert');

// Mock localStorage
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; },
  clear: () => { Object.keys(storage).forEach(k => delete storage[k]); }
};

// Mock window and DOM minimal
global.window = {
  confirm: () => true,
  scrollTo: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  appRouter: {
    navigate: (view) => { window._lastNavigatedView = view; }
  }
};
global.document = {
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: (id) => ({
    value: '', // real inputs always have a string value (the builder reads the card message input)
    innerText: '',
    innerHTML: '',
    className: '',
    disabled: false,
    scrollIntoView: () => {},
    classList: { add: () => {}, remove: () => {}, toggle: () => {} }
  })
};
global.showToast = (msg, type) => {
  global._lastToast = { msg, type };
};

// Load state and builder
const FLOWER_DATA = {
  mainFlowers: [
    { id: 'fl-red-rose', name: 'Red Rose', price: 150, stockCount: 20, availability: 'available' },
    { id: 'fl-pink-tulip', name: 'Pink Tulip', price: 160, stockCount: 15, availability: 'available' }
  ],
  featuredBouquets: [],
  allMaterials: [
    { id: 'wrp-korean-matte', name: 'Korean Matte Wrapping Paper', price: 75, itemType: 'wrapping', availability: 'available', style: '["Blush Pink"]' },
    { id: 'fil-babys-breath', name: "Baby's Breath", price: 120, itemType: 'filler', availability: 'available' }
  ]
};
global.FLOWER_DATA = FLOWER_DATA;
global.formatCurrency = (num) => `₱${Number(num || 0).toLocaleString()}`;
global.escapeHtml = (s) => s || '';
global.getFlowerById = (id) => FLOWER_DATA.mainFlowers.find(f => f.id === id);
global.getFillerById = (id) => FLOWER_DATA.allMaterials.find(m => m.id === id);
global.getGreeneryById = (id) => null;
global.getWrappingById = (id) => FLOWER_DATA.allMaterials.find(m => m.id === id);
global.getRibbonById = (id) => null;
global.getCardDesignById = (id) => null;

const fs = require('fs');
const path = require('path');

const stateCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'state.js'), 'utf8');
eval(stateCode);
global.appState = window.appState;
appState.currentUser = { id: 'cust-1', name: 'Test User', email: 'test@example.com' };
appState.customerToken = 'test-token-123';

FLOWER_DATA.mainFlowers.push(
  { id: 'fl-red-rose', name: 'Red Rose', price: 150, stockCount: 20, availability: 'available' },
  { id: 'fl-pink-tulip', name: 'Pink Tulip', price: 160, stockCount: 15, availability: 'available' }
);
FLOWER_DATA.allMaterials.push(
  { id: 'wrp-korean-matte', name: 'Korean Matte Wrapping Paper', price: 75, itemType: 'wrapping', availability: 'available', style: '["Blush Pink"]' },
  { id: 'fil-babys-breath', name: "Baby's Breath", price: 120, itemType: 'filler', availability: 'available' }
);

const builderCode = fs.readFileSync(path.join(__dirname, '..', 'js', 'builder.js'), 'utf8');
eval(builderCode);

function runTests() {
  console.log('=== TEST: RESET BOUQUET BUILDER AFTER ADD TO CART ===\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  // 1. Initial State
  test('Initial builder state is empty and at step 1', () => {
    appState.resetBuilder();
    assert.strictEqual(window.builderCtrl.currentStep, 1);
    const state = appState.builderState;
    assert.strictEqual(state.mainFlowers.length, 0, 'mainFlowers should be empty');
    assert.strictEqual(state.fillers.length, 0, 'fillers should be empty');
    assert.strictEqual(state.wrappings.length, 0, 'wrappings should be empty');
  });

  // 2. Build first custom bouquet
  test('Customize bouquet with flowers and wrapping', () => {
    window.builderCtrl.updateMainFlowerQty('fl-red-rose', 6);
    assert.strictEqual(window.builderCtrl.getTotalMainStems(), 6);

    window.builderCtrl.goToStep(3);
    window.builderCtrl.toggleWrapping('wrp-korean-matte');
    const wrappings = window.builderCtrl.getSelectedWrappings();
    assert.strictEqual(wrappings.length, 1);
    assert.strictEqual(wrappings[0], 'wrp-korean-matte');
  });

  // 3. Add to Cart succeeds and resets builder
  test('Add to Cart adds item to cart, triggers toast, resets builder, and does NOT redirect away', () => {
    window._lastNavigatedView = null;
    global._lastToast = null;

    window.builderCtrl.addCustomBouquetToCart();

    // Verify cart has the bouquet
    assert.strictEqual(appState.cart.length, 1, 'Cart should contain 1 item');
    const item1 = appState.cart[0];
    assert.strictEqual(item1.isCustom, true);
    assert.strictEqual(item1.price, 6 * 150 + 75); // 975
    assert.strictEqual(item1.specs.mainFlowers.length, 1);
    assert.strictEqual(item1.specs.mainFlowers[0].id, 'fl-red-rose');
    assert.strictEqual(item1.specs.mainFlowers[0].quantity, 6);
    assert.strictEqual(item1.specs.wrappings[0].id, 'wrp-korean-matte');

    // Verify success toast shown
    assert(global._lastToast, 'Toast should be displayed');
    assert.strictEqual(global._lastToast.type, 'success');

    // Verify builder state is cleared
    const state = appState.builderState;
    assert.strictEqual(state.mainFlowers.length, 0, 'Builder mainFlowers should be cleared');
    assert.strictEqual(state.fillers.length, 0, 'Builder fillers should be cleared');
    assert.strictEqual(state.wrappings.length, 0, 'Builder wrappings should be cleared');
    assert.strictEqual(state.cardDesign, '', 'Card design should be reset');
    assert.strictEqual(state.cardMessage, '', 'Card message should be reset');

    // Verify current step is reset to 1
    assert.strictEqual(window.builderCtrl.currentStep, 1, 'Builder should be reset to Step 1');

    // Verify customer is NOT redirected away from the builder
    assert.strictEqual(window._lastNavigatedView, null, 'Should not redirect to cart');
  });

  // 4. Create second custom bouquet immediately
  test('Customer can immediately build a second custom bouquet and add to cart', () => {
    window.builderCtrl.updateMainFlowerQty('fl-pink-tulip', 5);
    assert.strictEqual(window.builderCtrl.getTotalMainStems(), 5);

    window.builderCtrl.goToStep(3);
    window.builderCtrl.toggleWrapping('wrp-korean-matte');

    window.builderCtrl.addCustomBouquetToCart();

    // Cart now has 2 distinct bouquets
    assert.strictEqual(appState.cart.length, 2, 'Cart should now contain 2 custom bouquets');
    const item2 = appState.cart[1];
    assert.strictEqual(item2.specs.mainFlowers[0].id, 'fl-pink-tulip');
    assert.strictEqual(item2.specs.mainFlowers[0].quantity, 5);

    // First bouquet remains untouched in cart
    const item1 = appState.cart[0];
    assert.strictEqual(item1.specs.mainFlowers[0].id, 'fl-red-rose');
    assert.strictEqual(item1.specs.mainFlowers[0].quantity, 6);

    // Builder reset again to Step 1
    assert.strictEqual(window.builderCtrl.currentStep, 1);
    assert.strictEqual(appState.builderState.mainFlowers.length, 0);
  });

  // 5. Validation failure does NOT reset builder
  test('Validation failure retains all selections so customer can fix and retry', () => {
    // Select 3 tulips
    window.builderCtrl.updateMainFlowerQty('fl-pink-tulip', 3);
    // But no wrapping selected (wrappings empty)
    appState.setBuilderState({ wrappings: [] });

    window.builderCtrl.addCustomBouquetToCart();

    // Still only 2 items in cart (addition rejected)
    assert.strictEqual(appState.cart.length, 2);
    // Selections were NOT wiped
    assert.strictEqual(appState.builderState.mainFlowers.length, 1);
    assert.strictEqual(appState.builderState.mainFlowers[0].quantity, 3);
  });

  console.log(`\n======================================================`);
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log(`======================================================`);

  if (failed > 0) process.exit(1);
}

runTests();
