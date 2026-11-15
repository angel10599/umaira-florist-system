const store = require('../server/store');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const db = new DatabaseSync(path.join(__dirname, '..', 'data', 'umaira.db'));

const dbFlowers = db.prepare('SELECT id, name, category, price, stock_count, availability, archived FROM flowers').all();
const dbBouquets = db.prepare('SELECT id, name, category, price, availability, archived FROM bouquets').all();

console.log(`DB has ${dbFlowers.length} flowers/materials (${dbFlowers.filter(f => !f.archived).length} active)`);
console.log(`DB has ${dbBouquets.length} bouquets (${dbBouquets.filter(b => !b.archived).length} active)`);

const vm = require('vm');
const fs = require('fs');
const ctx = vm.createContext({ window: {}, console });
vm.runInContext(fs.readFileSync('js/data.js', 'utf8'), ctx);
const fileData = vm.runInContext('FLOWER_DATA', ctx);

console.log(`js/data.js has ${fileData.mainFlowers.length} mainFlowers, ${fileData.featuredBouquets.length} featuredBouquets`);
console.log(`js/data.js materials: ${fileData.fillerFlowers.length} fillers, ${fileData.greenery.length} greenery, ${fileData.wrappingOptions.length} wrappings, ${fileData.ribbonOptions.length} ribbons, ${fileData.cardDesigns.length} cards`);
