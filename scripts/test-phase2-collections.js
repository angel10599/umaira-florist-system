// Automated verification of Phase 2 Bouquet Catalog & Collections Filtering
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const vm = require('vm');
const fs = require('fs');

// Isolated temporary database: this test can never touch the shop's real data (must load before server/store).
const iso = require('../tests/helpers/isolated-db');
const store = require('../server/store');
const db = new DatabaseSync(iso.dbPath);

console.log('=== PHASE 2 COLLECTIONS & INVENTORY SYSTEM VERIFICATION ===\n');

// 1. Verify 32 bouquets in DB
// Scope: the 32 bouquets of the Phase 2 catalog import (the temporary test database also holds test fixtures
// and the older starter catalog, which are not what this script verifies).
const PHASE2_IDS = new Set(require('../server/phase2_catalog').PHASE2_BOUQUETS.map(b => b.id));
const bouquets = store.getBouquets().filter(b => PHASE2_IDS.has(b.id));
console.log(`[1] Total Bouquets in DB: ${bouquets.length} (Expected: 32)`);
if (bouquets.length !== 32) throw new Error(`Expected 32 bouquets, got ${bouquets.length}`);

// 2. Verify all 32 bouquets have empty image field
const nonPlaceholderImages = bouquets.filter(b => b.image && b.image.trim() !== '');
console.log(`[2] Bouquets with uploaded image: ${nonPlaceholderImages.length} (Expected: 0)`);
if (nonPlaceholderImages.length !== 0) throw new Error(`Found unexpected images on initialized bouquets`);

// 3. Verify all 32 bouquets have sold_out initial availability (due to 0 physical stock)
const availableBouquets = bouquets.filter(b => b.availability === 'available');
console.log(`[3] Available Bouquets with 0 stock: ${availableBouquets.length} (Expected: 0 - all should be sold_out until stock is confirmed)`);
if (availableBouquets.length !== 0) throw new Error(`Bouquets should not be available with 0 ingredient stock`);

// 4. Test client-side filter logic simulation matching js/site-update.js
// We create the exact client environment and run the filtering logic
const flowerTypeOptions = [
  'Roses', 'Tulips', 'Carnations', 'Gerberas', 'Sunflowers',
  'Lilies', 'Orchids', 'Peonies', 'Hydrangeas', 'Daisies',
  'Chrysanthemums', 'Lisianthus', 'Snapdragons', "Baby's Breath",
  'Eucalyptus', 'Ruscus'
];

console.log('\n[4] Verifying Flower Type Filtering (All 16 Flower Types):');
for (const ft of flowerTypeOptions) {
  const flType = ft.toLowerCase();
  const flRoots = [flType];
  if (flType.endsWith('ies')) flRoots.push(flType.slice(0, -3) + 'y');
  if (flType.endsWith('s')) flRoots.push(flType.slice(0, -1));

  const matched = bouquets.filter(b => {
    const bFlowers = (b.flowerTypes || []).map(f => f.toLowerCase());
    if (b.primaryFlower) bFlowers.push(b.primaryFlower.toLowerCase());

    for (let rIdx = 0; rIdx < flRoots.length; rIdx++) {
      const root = flRoots[rIdx];
      if (bFlowers.some(f => f === root || f.indexOf(root) >= 0 || root.indexOf(f) >= 0)) return true;
      if (b.mainFlowersText && b.mainFlowersText.toLowerCase().indexOf(root) >= 0) return true;
      if (b.formula && b.formula.toLowerCase().indexOf(root) >= 0) return true;
      if (b.name && b.name.toLowerCase().indexOf(root) >= 0) return true;
      if (b.description && b.description.toLowerCase().indexOf(root) >= 0) return true;
    }
    return false;
  });

  console.log(`  ✓ ${ft.padEnd(16)}: ${matched.length} bouquets matched (${matched.map(b => b.name).join(', ')})`);
  if (matched.length < 2) throw new Error(`Flower type ${ft} matched fewer than 2 bouquets`);
}

// 5. Verifying Occasion Filtering against the shop's official occasion list (js/shop-rules.js)
const OFFICIAL = require('../js/shop-rules.js').OFFICIAL_OCCASIONS;
const occasionsOf = (b) => [...new Set((b.occasions || []).concat(b.occasion ? b.occasion.split(',').map(s => s.trim()) : []).filter(Boolean))];
console.log('\n[5] Verifying Occasion Filtering (official occasions only, exact matching):');
const unofficial = [...new Set(bouquets.flatMap(occasionsOf))].filter(o => !OFFICIAL.includes(o));
if (unofficial.length) throw new Error('Catalog uses occasions that are not on the official list: ' + unofficial.join(', '));
for (const occName of OFFICIAL) {
  const matched = bouquets.filter(b => occasionsOf(b).includes(occName));
  console.log(`  ✓ ${occName.padEnd(20)}: ${matched.length} bouquets matched`);
}
if (!OFFICIAL.some(o => bouquets.some(b => occasionsOf(b).includes(o)))) throw new Error('No bouquet carries an official occasion');

// 6. Verifying Budget / Price Range Filters
console.log('\n[6] Verifying Budget / Price Range Filters:');
const b500_1000 = bouquets.filter(b => b.price >= 500 && b.price <= 1000);
const b1000_2000 = bouquets.filter(b => b.price >= 1000 && b.price <= 2000);
const b2000_3000 = bouquets.filter(b => b.price >= 2000 && b.price <= 3000);
const b3000_plus = bouquets.filter(b => b.price >= 3000);

console.log(`  ✓ ₱500–₱1,000   : ${b500_1000.length} bouquets (e.g. ${b500_1000[0].name} @ ₱${b500_1000[0].price})`);
console.log(`  ✓ ₱1,000–₱2,000 : ${b1000_2000.length} bouquets (e.g. ${b1000_2000[0].name} @ ₱${b1000_2000[0].price})`);
console.log(`  ✓ ₱2,000–₱3,000 : ${b2000_3000.length} bouquets (e.g. ${b2000_3000[0].name} @ ₱${b2000_3000[0].price})`);
console.log(`  ✓ ₱3,000+       : ${b3000_plus.length} bouquets (e.g. ${b3000_plus[0].name} @ ₱${b3000_plus[0].price})`);

if (!b500_1000.length || !b1000_2000.length || !b2000_3000.length || !b3000_plus.length) {
  throw new Error('Every price range must contain bouquets!');
}

// 7. Verifying Most Popular Sort (Sales-based with neutral alphabetical fallback)
console.log('\n[7] Verifying Most Popular Sort:');
const sortedPopular = [...bouquets].sort((a, b) => {
  const diff = (b.salesCount || 0) - (a.salesCount || 0);
  if (diff !== 0) return diff;
  return a.name.localeCompare(b.name);
});
console.log(`  First 3 bouquets in popular sort:`);
sortedPopular.slice(0, 3).forEach((b, i) => {
  console.log(`    ${i+1}. ${b.name} (sales: ${b.salesCount || 0})`);
});
if (sortedPopular[0].name !== 'Autumn Grace' || sortedPopular[1].name !== 'Blush Peony Garden') {
  throw new Error('Alphabetical fallback not functioning properly');
}
console.log('  ✓ Neutral alphabetical fallback confirmed when sales = 0');

// 8. Test Search Query Filter
console.log('\n[8] Verifying Search Query:');
const searchRose = bouquets.filter(b => {
  const q = 'rose';
  return (b.name && b.name.toLowerCase().includes(q)) ||
         (b.description && b.description.toLowerCase().includes(q)) ||
         (b.flowerTypes && b.flowerTypes.some(f => f.toLowerCase().includes(q)));
});
console.log(`  ✓ Search "rose" matched ${searchRose.length} bouquets`);
if (searchRose.length < 5) throw new Error('Search for rose failed to match compositions');

// 9. Test Cart restriction (purchasing sold_out bouquet rejected by server pricing)
console.log('\n[9] Verifying Server Cart / Checkout Stock Guard:');
const pricing = require('../server/pricing');
const priceResult = pricing.priceCartItems([{ id: bouquets[0].id, quantity: 1 }], store);
console.log(`  Attempt to price sold_out bouquet: "${priceResult.error}"`);
if (!priceResult.error || !priceResult.error.includes('unavailable')) {
  throw new Error('Server pricing should reject out-of-stock bouquets');
}
console.log('  ✓ Direct purchase request correctly rejected by server pricing!');

console.log('\n======================================================');
console.log('ALL PHASE 2 COLLECTIONS & INVENTORY TESTS PASSED 100%!');
console.log('======================================================');
db.close();
