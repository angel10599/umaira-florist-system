// scripts/standardize-categories.js
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/umaira.db');

console.log('--- Checking & Standardizing Categories ---');

// 1. Update categories table
db.prepare(`UPDATE categories SET name = 'Greeting Cards', description = 'Artisanal sentiment cards for birthdays, anniversaries, graduations, and custom messages.' WHERE id = 'cat-message-cards' OR name = 'Message Cards'`).run();
db.prepare(`UPDATE categories SET name = 'Fillers & Foliage' WHERE name = 'Fillers & Greenery'`).run();
db.prepare(`UPDATE categories SET name = 'Wrapping Materials' WHERE name = 'Wrapping'`).run();

// 2. Update flowers table
const updateFlowersCards = db.prepare(`UPDATE flowers SET category = 'Greeting Cards' WHERE category = 'Message Cards' OR category = 'Message Card' OR item_type = 'card'`).run();
console.log('Updated Greeting Cards in flowers table:', updateFlowersCards.changes);

const updateFlowersWrapping = db.prepare(`UPDATE flowers SET category = 'Wrapping Materials' WHERE category = 'Wrapping' OR (item_type = 'wrapping' AND category != 'Wrapping Materials')`).run();
console.log('Updated Wrapping Materials in flowers table:', updateFlowersWrapping.changes);

const updateFlowersFillers = db.prepare(`UPDATE flowers SET category = 'Fillers & Foliage' WHERE category = 'Fillers & Greenery' OR ((item_type = 'filler' OR item_type = 'foliage') AND category NOT IN ('Fillers & Foliage', 'Other Materials'))`).run();
console.log('Updated Fillers & Foliage in flowers table:', updateFlowersFillers.changes);

const updateFlowersStems = db.prepare(`UPDATE flowers SET category = 'Fresh Flowers' WHERE item_type = 'flower' AND category NOT IN ('Fresh Flowers')`).run();
console.log('Updated Fresh Flowers in flowers table:', updateFlowersStems.changes);

const updateBouquets = db.prepare(`UPDATE bouquets SET category = 'Ready-Made Bouquets' WHERE category != 'Ready-Made Bouquets' OR category IS NULL OR category = ''`).run();
console.log('Updated Ready-Made Bouquets in bouquets table:', updateBouquets.changes);

console.log('\n--- Final Category Breakdown in DB ---');
const flowers = db.prepare(`SELECT category, count(*) as count FROM flowers WHERE archived = 0 GROUP BY category`).all();
console.log('Active flowers by category:', flowers);

const flowersArchived = db.prepare(`SELECT category, count(*) as count FROM flowers WHERE archived = 1 GROUP BY category`).all();
console.log('Archived flowers by category:', flowersArchived);

const bouquets = db.prepare(`SELECT category, count(*) as count FROM bouquets WHERE archived = 0 GROUP BY category`).all();
console.log('Active bouquets by category:', bouquets);

const categories = db.prepare(`SELECT id, name, type FROM categories`).all();
console.log('Categories table:', categories);
