const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Terminology Consistency Across Admin Management System ---');

const htmlPath = path.join(__dirname, '..', 'admin.html');
const jsPath = path.join(__dirname, '..', 'js', 'admin.js');

const htmlContent = fs.readFileSync(htmlPath, 'utf8');
const jsContent = fs.readFileSync(jsPath, 'utf8');

// 1. Orders Management Terminology
console.log('1. Verifying Orders Management Terminology...');
// Date filter should say "Last 7 Days" (not "Past 7 Days")
assert.ok(htmlContent.includes('<option value="week">Last 7 Days</option>'), 'Orders date filter has "Last 7 Days"');
assert.ok(!htmlContent.includes('<option value="week">Past 7 Days</option>'), 'No "Past 7 Days" in date filter');

// Fulfillment filter should say "Store Pickup" (not "Pick Up" or "Pickup Order")
assert.ok(htmlContent.includes('<option value="pickup">Store Pickup</option>'), 'Orders fulfillment filter has "Store Pickup"');
assert.ok(!htmlContent.includes('<option value="pickup">Pick Up</option>'), 'No bare "Pick Up" in filter');

// Status filter should have standard groups
assert.ok(htmlContent.includes('<option value="in_progress">In Progress</option>'), 'Orders status filter has "In Progress"');
assert.ok(!htmlContent.includes('<option value="in_progress">Processing</option>'), 'No "Processing" in status filter');

// Status badges in js/admin.js
assert.ok(jsContent.includes('Pending</span>'), 'js/admin.js renders Pending badge');
assert.ok(jsContent.includes('In Progress</span>'), 'js/admin.js renders In Progress badge');
assert.ok(jsContent.includes('Completed</span>'), 'js/admin.js renders Completed badge');
assert.ok(jsContent.includes('Cancelled</span>'), 'js/admin.js renders Cancelled badge');
assert.ok(jsContent.includes('Store Pickup</span>'), 'js/admin.js renders Store Pickup badge');

// 2. Product Management Terminology
console.log('2. Verifying Product Management Terminology...');
// Pluralized item types in filters & modal
assert.ok(htmlContent.includes('Fresh Flowers'), 'Product type filter includes Fresh Flowers');
assert.ok(htmlContent.includes('Ready-Made Bouquets'), 'Product type filter includes Ready-Made Bouquets');
assert.ok(htmlContent.includes('Fillers &amp; Foliage'), 'Product type filter includes Fillers & Foliage');
assert.ok(htmlContent.includes('Wrapping Materials'), 'Product type filter includes Wrapping Materials');
assert.ok(htmlContent.includes('Ribbons'), 'Product type filter includes Ribbons');
assert.ok(htmlContent.includes('Message Cards'), 'Product type filter includes Message Cards');

// Check itemTypeBadge implementation in js/admin.js
assert.ok(jsContent.includes('Fresh Flowers</span>'), 'itemTypeBadge returns "Fresh Flowers"');
assert.ok(jsContent.includes('Ready-Made Bouquets</span>'), 'itemTypeBadge returns "Ready-Made Bouquets"');
assert.ok(jsContent.includes('Fillers & Foliage</span>'), 'itemTypeBadge returns "Fillers & Foliage"');
assert.ok(jsContent.includes('Wrapping Materials</span>'), 'itemTypeBadge returns "Wrapping Materials"');
assert.ok(jsContent.includes('Ribbons</span>'), 'itemTypeBadge returns "Ribbons"');
assert.ok(jsContent.includes('Message Cards</span>'), 'itemTypeBadge returns "Message Cards"');

// Availability filter & badges
assert.ok(htmlContent.includes('<option value="available">Available</option>'), 'Availability filter has "Available"');
assert.ok(htmlContent.includes('<option value="unavailable">Unavailable</option>'), 'Availability filter has "Unavailable"');
assert.ok(jsContent.includes('availabilityBadge(isAvail)'), 'availabilityBadge method exists');

// 3. Inventory Management Terminology
console.log('3. Verifying Inventory Management Terminology...');
// Stock status filter & badges
// Store Management stock filter (values in_stock / low_stock / out_of_stock); wording is what must stay consistent.
const stockFilter = (htmlContent.match(/id="store-stock-filter"[\s\S]*?<\/select>/) || [''])[0];
assert.ok(/value="in_stock">In Stock/.test(stockFilter), 'Inventory filter has "In Stock"');
assert.ok(/value="low_stock">Low Stock/.test(stockFilter), 'Inventory filter has "Low Stock"');
assert.ok(/value="out_of_stock">Out of Stock/.test(stockFilter), 'Inventory filter has "Out of Stock"');

// Stock status badges
assert.ok(jsContent.includes('stockStatusBadge('), 'stockStatusBadge helper exists');
assert.ok(jsContent.includes('>In Stock</span>'), 'stockStatusBadge returns "In Stock"');
assert.ok(jsContent.includes('>Low Stock</span>'), 'stockStatusBadge returns "Low Stock"');
assert.ok(jsContent.includes('>Out of Stock</span>'), 'stockStatusBadge returns "Out of Stock"');

// 4. Movement History Terminology
console.log('4. Verifying Movement History Terminology...');
assert.ok(htmlContent.includes('<option value="restock">Stock In (+)</option>'), 'History filter has Stock In (+)');
assert.ok(htmlContent.includes('<option value="deduct">Stock Out (-)</option>'), 'History filter has Stock Out (-)');
assert.ok(htmlContent.includes('<option value="correction">Adjustment (=)</option>'), 'History filter has Adjustment (=)');
assert.ok(htmlContent.includes('<option value="order_fulfillment">Order Deduction</option>'), 'History filter has Order Deduction');
assert.ok(htmlContent.includes('<option value="order_restoration">Order Restoration</option>'), 'History filter has Order Restoration');

// movementTypeBadge in js/admin.js
assert.ok(jsContent.includes('movementTypeBadge(type)'), 'movementTypeBadge method exists');
assert.ok(jsContent.includes('>Stock In (+)</span>'), 'movementTypeBadge returns Stock In (+)');
assert.ok(jsContent.includes('>Stock Out (-)</span>'), 'movementTypeBadge returns Stock Out (-)');
assert.ok(jsContent.includes('>Adjustment (=)</span>'), 'movementTypeBadge returns Adjustment (=)');
assert.ok(jsContent.includes('>Order Deduction</span>'), 'movementTypeBadge returns Order Deduction');
assert.ok(jsContent.includes('>Order Restoration</span>'), 'movementTypeBadge returns Order Restoration');

// 5. Suppliers Terminology
console.log('5. Verifying Suppliers Terminology...');
assert.ok(htmlContent.includes('<option value="active">Active</option>'), 'Supplier filter has "Active"');
assert.ok(htmlContent.includes('<option value="inactive">Inactive</option>'), 'Supplier filter has "Inactive"');
assert.ok(jsContent.includes('supplierStatusBadge(isActive)'), 'supplierStatusBadge helper exists');

// 6. Customers Terminology
console.log('6. Verifying Customers Terminology...');
assert.ok(htmlContent.includes('<option value="google">Google</option>'), 'Customer filter has "Google"');
assert.ok(htmlContent.includes('<option value="email">Email</option>'), 'Customer filter has "Email"');
assert.ok(jsContent.includes('customerAuthBadge(isGoogle)'), 'customerAuthBadge helper exists');

// 7. Reports Terminology
console.log('7. Verifying Reports Terminology...');
// Donut chart status segments
assert.ok(jsContent.includes("label: 'Pending'"), 'Reports donut has Pending');
assert.ok(jsContent.includes("label: 'In Progress'"), 'Reports donut has In Progress');
assert.ok(jsContent.includes("label: 'Completed'"), 'Reports donut has Completed');
assert.ok(jsContent.includes("label: 'Cancelled'"), 'Reports donut has Cancelled');

// Transactions table fulfillment
// Fulfilment wording in admin order lists: "Delivery" / "Store Pickup" (either order of the ternary).
assert.ok(/'Store Pickup' : 'Delivery'|'Delivery' : 'Store Pickup'/.test(jsContent), 'Admin order lists use Store Pickup / Delivery');

// Reports inventory health badges
assert.ok(jsContent.includes("isOut ? 'Out of Stock' : 'Low Stock'"), 'Reports inventory alerts use Out of Stock / Low Stock');

console.log('ALL TERMINOLOGY CONSISTENCY CHECKS PASSED SUCCESSFULLY!');
