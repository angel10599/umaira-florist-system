const store = require('../server/store');
const fs = require('fs');

console.log('Store VALID_TRANSITIONS:\n', require('../server/store'));
const rules = require('../js/shop-rules.js');
console.log('shop-rules:\n', Object.keys(rules));
