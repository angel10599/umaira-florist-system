const c = require('../server/phase2_catalog');

console.log('Categories:', c.PHASE2_CATEGORIES.length);
console.log('Flowers:', c.PHASE2_FLOWERS.length);
console.log('Materials:', c.PHASE2_MATERIALS.length);
console.log('Bouquets:', c.PHASE2_BOUQUETS.length);

const flowerTypes = [
  'Roses', 'Tulips', 'Carnations', 'Gerberas', 'Sunflowers',
  'Lilies', 'Orchids', 'Peonies', 'Hydrangeas', 'Daisies',
  'Chrysanthemums', 'Lisianthus', 'Snapdragons', "Baby's Breath",
  'Eucalyptus', 'Ruscus'
];

console.log('\n--- Checking 16 Flower Types (2 bouquets each) ---');
let ftErrors = 0;
for (const ft of flowerTypes) {
  const matching = c.PHASE2_BOUQUETS.filter(b => b.primaryFlower === ft);
  console.log(`${ft.padEnd(16)}: ${matching.length} bouquets (${matching.map(b => b.name).join(', ')})`);
  if (matching.length !== 2) {
    console.error(`ERROR: Expected 2 bouquets for ${ft}`);
    ftErrors++;
  }
}

// Occasions must come from the shop's official list (js/shop-rules.js OFFICIAL_OCCASIONS).
const occasions = require('../js/shop-rules.js').OFFICIAL_OCCASIONS;

console.log('\n--- Checking occasions (official list only) ---');
let occErrors = 0;
for (const b of c.PHASE2_BOUQUETS) {
  for (const o of (b.occasions || [])) {
    if (!occasions.includes(o)) { console.error(`ERROR: ${b.name} uses an occasion that is not on the official list: ${o}`); occErrors++; }
  }
}
for (const occ of occasions) {
  const matching = c.PHASE2_BOUQUETS.filter(b => (b.occasions || []).includes(occ));
  console.log(`${occ.padEnd(20)}: ${matching.length} bouquets`);
}

console.log('\n--- Checking Price Ranges ---');
console.log('500-1000  :', c.PHASE2_BOUQUETS.filter(b => b.price >= 500 && b.price <= 1000).length);
console.log('1000-2000 :', c.PHASE2_BOUQUETS.filter(b => b.price >= 1000 && b.price <= 2000).length);
console.log('2000-3000 :', c.PHASE2_BOUQUETS.filter(b => b.price >= 2000 && b.price <= 3000).length);
console.log('3000+     :', c.PHASE2_BOUQUETS.filter(b => b.price >= 3000).length);

// Verify all ingredient IDs exist in flowers or materials
const validItemIds = new Set([
  ...c.PHASE2_FLOWERS.map(f => f.id),
  ...c.PHASE2_MATERIALS.map(m => m.id)
]);

console.log('\n--- Checking Ingredient ID validity ---');
let ingErrors = 0;
for (const b of c.PHASE2_BOUQUETS) {
  for (const f of b.specs.mainFlowers) {
    if (!validItemIds.has(f.id)) {
      console.error(`ERROR in bouquet "${b.name}": ingredient flower ID "${f.id}" does not exist in flowers/materials!`);
      ingErrors++;
    }
  }
  for (const m of (b.specs.materials || [])) {
    if (!validItemIds.has(m.id)) {
      console.error(`ERROR in bouquet "${b.name}": ingredient material ID "${m.id}" does not exist in flowers/materials!`);
      ingErrors++;
    }
  }
}

if (ftErrors === 0 && occErrors === 0 && ingErrors === 0) {
  console.log('\n=== ALL PHASE 2 CATALOG INTEGRITY CHECKS PASSED ===');
} else {
  console.error(`\nFAILED with errors: ftErrors=${ftErrors}, occErrors=${occErrors}, ingErrors=${ingErrors}`);
  process.exit(1);
}
