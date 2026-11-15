const fs = require('fs');

global.window = global;
global.window.addEventListener = () => {};
const elements = {};
global.document = {
  addEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: (id) => {
    if (!elements[id]) {
      elements[id] = {
        id,
        innerText: '',
        innerHTML: '',
        addEventListener: () => {},
        classList: {
          add: () => {},
          remove: () => {},
          contains: () => false
        }
      };
    }
    return elements[id];
  }
};
global.localStorage = { getItem: () => null, setItem: () => {} };

eval(fs.readFileSync('js/admin-payments.js', 'utf8'));
eval(fs.readFileSync('js/admin-pickup.js', 'utf8'));
eval(fs.readFileSync('js/shop-rules.js', 'utf8'));
eval(fs.readFileSync('js/admin.js', 'utf8') + '; global.AdminApp = AdminApp;');
const admin = new AdminApp();
admin.orders = [
  {
    orderNumber: 'FLR-TEST-001',
    customerName: 'Juan Dela Cruz',
    phone: '09171234567',
    email: 'juan@example.com',
    address: { street: '123 Sampaguita St', barangay: 'San Antonio', district: 1, city: 'Manila' },
    total: 2500,
    status: 'pending_confirmation',
    fulfillment: 'delivery',
    createdAt: new Date().toISOString()
  }
];

// Test openOrderCustomerProfile
console.log('Testing openOrderCustomerProfile...');
admin.openOrderCustomerProfile('FLR-TEST-001');

const modalContent = global.document.getElementById('cust-modal-content').innerHTML;
if (!modalContent.includes('Juan Dela Cruz')) throw new Error('Missing customer name');
if (!modalContent.includes('09171234567')) throw new Error('Missing phone number');
if (!modalContent.includes('juan@example.com')) throw new Error('Missing email');
if (!modalContent.includes('123 Sampaguita St')) throw new Error('Missing address');
if (modalContent.includes('Total Spent') || modalContent.includes('Order History') || modalContent.includes('Sign-in Provider')) {
  throw new Error('Unrelated fields leaked into customer modal');
}
console.log('OK: openOrderCustomerProfile contains only the exact 4 required fields');

// Test renderOrdersActionButtons
const orderActionHtml = admin.renderOrdersActionButtons(admin.orders[0]);
if (!orderActionHtml.includes('openOrderDetail')) throw new Error('Eye icon missing openOrderDetail');
if (!orderActionHtml.includes('Customer Profile')) throw new Error('Dropdown missing Customer Profile');
if (!orderActionHtml.includes('Copy Order Number')) throw new Error('Dropdown missing Copy Order Number');
if (orderActionHtml.includes('View Full Details')) throw new Error('Redundant View Full Details must be removed');
console.log('OK: renderOrdersActionButtons verified');

// Test renderStoreActionButtons
const dummyItem = { id: 'fl-1', name: 'Red Rose', archived: 0 };
const storeActionHtml = admin.renderStoreActionButtons(dummyItem);
if (!storeActionHtml.includes('viewProductDetails')) throw new Error('Store actions missing Eye icon');
if (!storeActionHtml.includes('Edit Inventory Info')) throw new Error('Store actions missing Edit Inventory Info');
if (!storeActionHtml.includes('Archive Item')) throw new Error('Store actions missing Archive Item');
// Dropdown menu should not contain duplicate View Details button
const storeDropdownHtml = storeActionHtml.slice(storeActionHtml.indexOf('ui-action-menu'));
if (storeDropdownHtml.includes('>View Item Details<') || storeDropdownHtml.includes('>View Details<')) {
  throw new Error('Store dropdown contains redundant View Details');
}
if (storeDropdownHtml.includes('Adjust Stock Level')) throw new Error('Store actions contains redundant Adjust Stock Level');
console.log('OK: renderStoreActionButtons verified');

// Test renderSuppliersActionButtons
const dummySupplier = { id: 'sup-1', name: 'Highland Farms', active: true, phone: '09181112222', email: 'sup@example.com' };
const supActionHtml = admin.renderSuppliersActionButtons(dummySupplier);
if (!supActionHtml.includes('viewSupplierDetails')) throw new Error('Supplier actions missing Eye icon');
if (!supActionHtml.includes('Edit Supplier Details')) throw new Error('Supplier actions missing Edit Supplier Details');
if (!supActionHtml.includes('Deactivate Supplier')) throw new Error('Supplier actions missing Deactivate Supplier');
if (!supActionHtml.includes('Copy Contact Info')) throw new Error('Supplier actions missing Copy Contact Info');
const supDropdownHtml = supActionHtml.slice(supActionHtml.indexOf('ui-action-menu'));
if (supDropdownHtml.includes('>View Full Profile<')) throw new Error('Supplier dropdown contains redundant View Full Profile');
console.log('OK: renderSuppliersActionButtons verified');

// Test renderReportsTransactionActionButtons
const rptActionHtml = admin.renderReportsTransactionActionButtons(admin.orders[0]);
if (!rptActionHtml.includes('openOrderDetail')) throw new Error('Report actions missing Eye icon');
if (!rptActionHtml.includes('Customer Profile')) throw new Error('Report actions missing Customer Profile');
if (!rptActionHtml.includes('Copy Order Number')) throw new Error('Report actions missing Copy Order Number');
if (rptActionHtml.includes('View Full Details')) throw new Error('Report actions contains redundant View Full Details');
console.log('OK: renderReportsTransactionActionButtons verified');

console.log('ALL ADMIN ACTION TESTS PASSED!');
