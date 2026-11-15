const store = require('../server/store');

console.log('Flowers in store:', store.getFlowers({ includeArchived: true }).length);
console.log('Flowers itemTypes:', [...new Set(store.getFlowers({ includeArchived: true }).map(f => f.item_type))]);
console.log('Sample flowers:', store.getFlowers().slice(0, 5).map(f => ({ id: f.id, name: f.name, type: f.item_type, cat: f.category, price: f.price, stock: f.stock_count, avail: f.availability })));

console.log('\nBouquets in store:', store.getBouquets({ includeArchived: true }).length);
console.log('Sample bouquets:', store.getBouquets().slice(0, 5).map(b => ({ id: b.id, name: b.name, cat: b.category, price: b.price, avail: b.availability })));

console.log('\nCategories in store:', store.listCategories ? store.listCategories() : 'no listCategories');
console.log('Orders in store:', store.listOrders ? store.listOrders().length : 'no listOrders');
