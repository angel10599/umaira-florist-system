const store = require('../server/store');
const bouquets = store.getBouquets({ includeArchived: true, raw: true });

console.log(bouquets.map(b => ({ id: b.id, name: b.name, formula: b.formula, recipe: store.getBouquetRecipe(b.id) })));
