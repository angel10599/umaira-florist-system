// Phase 3: Build Your Own Bouquet Verification Script
// Isolated temporary database: this test can never touch the shop's real data (must load before server/store).
const iso = require('../tests/helpers/isolated-db');
const store = require('../server/store');
const pricing = require('../server/pricing');
const fs = require('fs');
const path = require('path');

console.log('=== PHASE 3 BUILD YOUR OWN BOUQUET VERIFICATION ===\n');

let pass = 0;
let fail = 0;
function check(label, cond, extra) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${label}`);
  } else {
    fail++;
    console.error(`  ✗ FAIL: ${label}`, extra !== undefined ? extra : '');
  }
}

// 1. Verify 13 Main Flower Types
console.log('[1] Verifying 13 Main Flower Options:');
const flowers = store.getFlowers({ itemType: 'flower' });
const requiredFlowerTypes = [
  'Roses', 'Tulips', 'Carnations', 'Gerberas', 'Sunflowers',
  'Lilies', 'Orchids', 'Peonies', 'Hydrangeas', 'Daisies',
  'Chrysanthemums', 'Lisianthus', 'Snapdragons'
];

requiredFlowerTypes.forEach(ft => {
  const norm = ft.toLowerCase().replace(/ies$/, 'y').replace(/s$/, '');
  const matches = flowers.filter(f => f.name.toLowerCase().includes(norm));
  check(`Flower Type: ${ft}`, matches.length > 0, { matched: matches.map(m => m.name) });
});

// 2. Verify 10 Fillers & Greenery
console.log('\n[2] Verifying 10 Fillers & Greenery Options:');
const requiredFillers = [
  { id: 'fil-babys-breath', name: "Baby's Breath" },
  { id: 'fol-eucalyptus', name: 'Eucalyptus' },
  { id: 'fol-ruscus', name: 'Ruscus' },
  { id: 'fil-waxflower', name: 'Waxflower' },
  { id: 'fil-statice', name: 'Statice' },
  { id: 'fil-solidago', name: 'Solidago' },
  { id: 'fil-queen-annes-lace', name: "Queen Anne's Lace" },
  { id: 'fol-leatherleaf-fern', name: 'Leatherleaf Fern' },
  { id: 'fol-italian-ruscus', name: 'Italian Ruscus' },
  { id: 'fol-silver-dollar-eucalyptus', name: 'Silver Dollar Eucalyptus' }
];

requiredFillers.forEach(rf => {
  const item = store.getFlower(rf.id);
  check(`Filler/Greenery: ${rf.name} (${rf.id})`, item && item.name.includes(rf.name.split(' ')[0]) && (item.itemType === 'filler' || item.itemType === 'foliage'));
});

// 3. Verify 10 Wrapping Options
console.log('\n[3] Verifying 10 Wrapping Options:');
const requiredWrappings = [
  { id: 'wrp-korean-matte', name: 'Korean Matte Wrapping Paper' },
  { id: 'wrp-korean-waterproof', name: 'Korean Waterproof Wrapping Paper' },
  { id: 'wrp-kraft', name: 'Kraft Paper' },
  { id: 'wrp-premium-tissue', name: 'Premium Tissue Paper' },
  { id: 'wrp-floral-mesh', name: 'Floral Mesh Wrapping' },
  { id: 'wrp-frosted', name: 'Frosted Translucent Wrapping' },
  { id: 'wrp-clear-cellophane', name: 'Clear Cellophane Wrapping' },
  { id: 'wrp-pearlescent', name: 'Pearlescent Wrapping Paper' },
  { id: 'wrp-non-woven', name: 'Non-Woven Floral Wrapping' },
  { id: 'wrp-premium-textured', name: 'Premium Textured Wrapping Paper' }
];

requiredWrappings.forEach(rw => {
  const item = store.getFlower(rw.id);
  let hasColors = false;
  if (item && item.style) {
    try {
      const parsed = JSON.parse(item.style);
      hasColors = Array.isArray(parsed) && parsed.length > 0;
    } catch (_) {}
  }
  check(`Wrapping: ${rw.name} (${rw.id}) with color palette`, item && item.itemType === 'wrapping' && hasColors);
});

// 4. Verify 5 Ribbon Types
console.log('\n[4] Verifying 5 Ribbon Types:');
const requiredRibbons = [
  { id: 'rbn-satin', name: 'Satin Ribbon' },
  { id: 'rbn-organza', name: 'Organza Ribbon' },
  { id: 'rbn-grosgrain', name: 'Grosgrain Ribbon' },
  { id: 'rbn-velvet', name: 'Velvet Ribbon' },
  { id: 'rbn-chiffon', name: 'Sheer Chiffon Ribbon' }
];

requiredRibbons.forEach(rr => {
  const item = store.getFlower(rr.id);
  let hasColors = false;
  if (item && item.style) {
    try {
      const parsed = JSON.parse(item.style);
      hasColors = Array.isArray(parsed) && parsed.length > 0;
    } catch (_) {}
  }
  check(`Ribbon: ${rr.name} (${rr.id}) with color palette`, item && item.itemType === 'ribbon' && hasColors);
});

// 5. Verify 5 Greeting Card Designs
console.log('\n[5] Verifying 5 Greeting Card Designs:');
const requiredCards = [
  { id: 'crd-classic-floral', name: 'Classic Floral Card' },
  { id: 'crd-minimalist-ivory', name: 'Minimalist Ivory Card' },
  { id: 'crd-romantic-blush', name: 'Romantic Blush Card' },
  { id: 'crd-elegant-botanical', name: 'Elegant Botanical Card' },
  { id: 'crd-premium-plum', name: 'Premium Plum Card' }
];

requiredCards.forEach(rc => {
  const item = store.getFlower(rc.id);
  check(`Greeting Card: ${rc.name} (${rc.id})`, item && item.itemType === 'card' && item.price >= 0);
});

// 6. Test Pricing Engine & Selection Rules
console.log('\n[6] Testing Pricing Engine & Selection Rules:');

// Create test mock store with available inventory for rule testing
const mockStore = {
  getFlower: (id) => {
    const real = store.getFlower(id);
    if (!real) return null;
    return { ...real, availability: 'available', stockCount: 100 };
  }
};

// Rule: 0 flowers rejected
let priced = pricing.priceCartItems([{ isCustom: true, specs: { mainFlowers: [], wrapping: 'wrp-kraft' }, quantity: 1 }], mockStore);
check('Rule: At least 1 flower required', priced.error === 'A custom bouquet needs at least one flower.');

// Rule: Max 3 fillers enforced
priced = pricing.priceCartItems([{
  isCustom: true,
  specs: {
    mainFlowers: [{ id: 'fl-red-rose', quantity: 3 }],
    fillers: [{ id: 'fil-babys-breath' }, { id: 'fol-eucalyptus' }, { id: 'fol-ruscus' }, { id: 'fil-waxflower' }],
    wrapping: 'wrp-kraft'
  },
  quantity: 1
}], mockStore);
check('Rule: Max 3 fillers enforced', priced.error === 'You may select up to 3 filler & greenery types.');

// Rule: Wrapping required
priced = pricing.priceCartItems([{
  isCustom: true,
  specs: {
    mainFlowers: [{ id: 'fl-red-rose', quantity: 3 }],
    wrappings: []
  },
  quantity: 1
}], mockStore);
check('Rule: At least 1 wrapping required', priced.error === 'Please select at least 1 wrapping option.');

// Rule: Max 3 wrappings enforced
priced = pricing.priceCartItems([{
  isCustom: true,
  specs: {
    mainFlowers: [{ id: 'fl-red-rose', quantity: 3 }],
    wrappings: ['wrp-korean-matte', 'wrp-kraft', 'wrp-frosted', 'wrp-black-film']
  },
  quantity: 1
}], mockStore);
check('Rule: Max 3 wrappings enforced', priced.error === 'You may select up to 3 wrapping types.');

// Rule: Max 2 ribbons enforced
priced = pricing.priceCartItems([{
  isCustom: true,
  specs: {
    mainFlowers: [{ id: 'fl-red-rose', quantity: 3 }],
    wrapping: 'wrp-kraft',
    ribbons: ['rbn-satin', 'rbn-organza', 'rbn-velvet']
  },
  quantity: 1
}], mockStore);
check('Rule: Max 2 ribbons enforced', priced.error === 'You may select up to 2 ribbon types.');

// Valid complete custom bouquet pricing calculation
priced = pricing.priceCartItems([{
  isCustom: true,
  name: 'Romantic Elegance Custom',
  specs: {
    mainFlowers: [{ id: 'fl-red-rose', quantity: 6 }, { id: 'fl-pink-rose', quantity: 6 }],
    fillers: [{ id: 'fil-babys-breath', quantity: 1 }, { id: 'fol-eucalyptus', quantity: 1 }],
    wrappings: [{ id: 'wrp-korean-matte', color: 'Blush Pink' }, { id: 'wrp-frosted', color: 'Opal White' }],
    ribbons: [{ id: 'rbn-satin', color: 'Rose Pink' }],
    cardDesign: 'crd-romantic-blush',
    cardMessage: 'Happy Anniversary my love!'
  },
  quantity: 1
}], mockStore);

// 6 * 120 + 6 * 110 + 80 + 60 + 75 + 85 + 45 + 35 = 720 + 660 + 80 + 60 + 75 + 85 + 45 + 35 = 1760
check('Valid custom bouquet successfully priced with all 5 layers', !priced.error && priced.subtotal === 1760, { subtotal: priced.subtotal, error: priced.error });
check('Stock needs computed for all items in 5 layers', priced.stockNeeds && priced.stockNeeds['fl-red-rose'] === 6 && priced.stockNeeds['wrp-korean-matte'] === 1 && priced.stockNeeds['crd-romantic-blush'] === 1);

// Test Admin-Configured Min/Max Stems & Arrangement Service Fee
const configuredStore = {
  getFlower: mockStore.getFlower,
  getSetting: (k) => {
    if (k === 'custom_builder') return { minStems: 5, maxStems: 20, serviceFee: 150 };
    return null;
  }
};

let testCfg = pricing.priceCartItems([{
  isCustom: true,
  specs: { mainFlowers: [{ id: 'fl-red-rose', quantity: 3 }], wrapping: 'wrp-kraft' },
  quantity: 1
}], configuredStore);
check('Admin Rule: Minimum 5 stems required when configured', testCfg.error === 'A custom bouquet needs at least 5 flower stems.');

testCfg = pricing.priceCartItems([{
  isCustom: true,
  specs: { mainFlowers: [{ id: 'fl-red-rose', quantity: 25 }], wrapping: 'wrp-kraft' },
  quantity: 1
}], configuredStore);
check('Admin Rule: Maximum 20 stems enforced when configured', testCfg.error === 'A custom bouquet cannot exceed 20 flower stems.');

testCfg = pricing.priceCartItems([{
  isCustom: true,
  specs: { mainFlowers: [{ id: 'fl-red-rose', quantity: 10 }], wrapping: 'wrp-kraft' },
  quantity: 1
}], configuredStore);
// Approved rule: no Arrangement/Assembly Fee. A leftover serviceFee value in settings must be ignored.
// The total is exactly the stems plus the wrapping (no extra line).
const kraftPrice = configuredStore.getFlower('wrp-kraft').price;
const rosePrice = configuredStore.getFlower('fl-red-rose').price;
check('Admin Rule: no arrangement fee is charged, even when a fee value is configured', !testCfg.error && testCfg.subtotal === 10 * rosePrice + kraftPrice, { subtotal: testCfg.subtotal, expected: 10 * rosePrice + kraftPrice });
check('Admin Rule: no fee line item is recorded', !testCfg.rows.some(r => /fee/i.test(r.type || '') || /fee/i.test(r.name || '')));

console.log(`\n======================================================`);
console.log(`PHASE 3 VERIFICATION SUMMARY: ${pass} passed, ${fail} failed`);
console.log(`======================================================\n`);

process.exit(fail ? 1 : 0);
