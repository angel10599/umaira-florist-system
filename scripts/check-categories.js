const store = require('../server/store');
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const db = new DatabaseSync(path.join(__dirname, '..', 'data', 'umaira.db'));

const catsFromDb = db.prepare('SELECT * FROM categories').all();
console.log('Categories table in DB:', catsFromDb);

const distinctFlowerCats = db.prepare('SELECT DISTINCT category FROM flowers').all();
console.log('Distinct categories in flowers table:', distinctFlowerCats);

const distinctBouquetCats = db.prepare('SELECT DISTINCT category FROM bouquets').all();
console.log('Distinct categories in bouquets table:', distinctBouquetCats);

const distinctBouquetOccasions = db.prepare('SELECT DISTINCT occasion FROM bouquets').all();
console.log('Distinct occasions in bouquets table:', distinctBouquetOccasions);
