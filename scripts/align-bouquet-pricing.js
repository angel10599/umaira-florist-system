// scripts/align-bouquet-pricing.js
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/umaira.db');

console.log('--- Reviewing & Aligning Bouquet Pricing ---');

const flowers = db.prepare('SELECT id, name, price, unit_cost FROM flowers').all();
const fMap = {};
flowers.forEach(f => { fMap[f.id] = f; });

const bouquets = db.prepare('SELECT id, name, price, specs_json FROM bouquets').all();

const round50 = (val) => Math.max(500, Math.round(val / 50) * 50);

const updates = [];
for (const b of bouquets) {
  let recipe = [];
  try {
    if (b.specs_json) {
      const s = JSON.parse(b.specs_json);
      if (s && Array.isArray(s.mainFlowers)) recipe = s.mainFlowers;
    }
  } catch (_) {}

  if (!recipe.length) {
    console.log(`Skipping ${b.id} (${b.name}): no recipe found`);
    continue;
  }

  let totalComponentRetail = 0;
  let totalComponentCost = 0;

  for (const item of recipe) {
    const fl = fMap[item.id];
    const qty = item.quantity || 1;
    if (fl) {
      totalComponentRetail += (fl.price || 0) * qty;
      totalComponentCost += (fl.unit_cost || 0) * qty;
    } else {
      // estimated fallback if unmapped item
      totalComponentRetail += 100 * qty;
      totalComponentCost += 40 * qty;
    }
  }

  // Ready-made bouquet prices follow component retail rounded to nearest ₱50
  const alignedPrice = round50(totalComponentRetail);
  const margin = Math.round(((alignedPrice - totalComponentCost) / alignedPrice) * 100);

  updates.push({
    id: b.id,
    name: b.name,
    oldPrice: b.price,
    newPrice: alignedPrice,
    cost: totalComponentCost,
    margin: margin
  });

  db.prepare('UPDATE bouquets SET price = ? WHERE id = ?').run(alignedPrice, b.id);
}

console.log(`Updated ${updates.length} bouquets:`);
updates.forEach(u => {
  const diff = u.newPrice - u.oldPrice;
  const diffStr = diff === 0 ? 'unchanged' : (diff > 0 ? `+₱${diff}` : `-₱${Math.abs(diff)}`);
  console.log(`- ${u.name.padEnd(28)} Old: ₱${u.oldPrice.toString().padEnd(5)} -> New: ₱${u.newPrice.toString().padEnd(5)} (Cost: ₱${u.cost}, Margin: ${u.margin}%, ${diffStr})`);
});
