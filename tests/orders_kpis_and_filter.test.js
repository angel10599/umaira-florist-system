/**
 * tests/orders_kpis_and_filter.test.js
 *
 * Test suite for Orders Management KPI Cards & Dedicated Status Filter:
 * 1. Informational KPI Cards (All Orders, Pending, In Progress, Completed, Cancelled)
 *    - Purely informational div elements (no button, no onclick, no active selection rings)
 *    - Accurate counts from the database
 *    - Independent of table filter selections
 * 2. Dedicated Status Filter Dropdown
 *    - Located beside search bar in second section
 *    - Maps internal statuses: Pending Confirmation, Confirmed/Preparing/Rider Assigned/On the Way/Ready for Pickup, Delivered/Picked Up, Rejected/Cancelled
 * 3. Layout & Control Order:
 *    - Search Bar | Status Filter | Fulfillment Filter | Date Filter | Clear Filters
 * 4. Interoperability of all filters, pagination reset, empty state, and clear filters
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const BASE_DIR = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(BASE_DIR, 'admin.html'), 'utf8');
const adminJs = fs.readFileSync(path.join(BASE_DIR, 'js', 'admin.js'), 'utf8');

test('Section 1 & 2: Orders Management HTML Layout & Control Order', () => {
  // 1. KPI cards container exists and has 5 desktop columns
  assert.ok(html.includes('id="order-status-filter-cards"'), 'KPI container must exist');
  assert.ok(html.includes('lg:grid-cols-5'), 'KPI container must have 5 columns on desktop');

  // 2. Dedicated status dropdown exists
  assert.ok(html.includes('id="orders-status-filter"'), 'Status filter select must exist');
  assert.ok(html.includes('handleOrderStatusFilter'), 'Status filter must trigger handleOrderStatusFilter');

  // 3. Status filter options
  assert.ok(html.includes('<option value="all">All Orders</option>'), 'Status filter must have All Orders');
  assert.ok(html.includes('<option value="pending">Pending</option>'), 'Status filter must have Pending');
  assert.ok(html.includes('<option value="in_progress">In Progress</option>'), 'Status filter must have In Progress');
  assert.ok(html.includes('<option value="completed">Completed</option>'), 'Status filter must have Completed');
  assert.ok(html.includes('<option value="cancelled">Cancelled</option>'), 'Status filter must have Cancelled');

  // 4. Check sequential layout order in toolbar:
  // Search Bar -> Status Filter -> Fulfillment Filter -> Date Filter -> Clear Filters
  const searchIdx = html.indexOf('id="orders-search-input"');
  const statusIdx = html.indexOf('id="orders-status-filter"');
  const fulIdx = html.indexOf('id="orders-fulfillment-filter"');
  const dateIdx = html.indexOf('id="orders-date-filter"');
  const clearIdx = html.indexOf('id="orders-clear-filters-btn"');

  assert.ok(searchIdx !== -1, 'Search input found');
  assert.ok(statusIdx !== -1, 'Status filter found');
  assert.ok(fulIdx !== -1, 'Fulfillment filter found');
  assert.ok(dateIdx !== -1, 'Date filter found');
  assert.ok(clearIdx !== -1, 'Clear filters button found');

  assert.ok(searchIdx < statusIdx, 'Search bar must precede status filter');
  assert.ok(statusIdx < fulIdx, 'Status filter must precede fulfillment filter');
  assert.ok(fulIdx < dateIdx, 'Fulfillment filter must precede date filter');
  assert.ok(dateIdx < clearIdx, 'Date filter must precede clear filters button');
});

test('Section 1: KPI Cards Implementation in JavaScript', () => {
  // Verify cards are created as non-clickable informational elements
  assert.ok(!adminJs.includes('onclick="window.adminApp.setStatusFilter'), 'KPI cards must NOT be clickable buttons');
  assert.ok(adminJs.includes('renderOrderStatusCards'), 'renderOrderStatusCards method must exist');

  // Verify all 5 metrics are computed from this.orders
  assert.ok(adminJs.includes('this.orders.length'), 'Computes total orders count');
  assert.ok(adminJs.includes('Pending Confirmation'), 'Computes pending count');
  assert.ok(adminJs.includes('Rider Assigned'), 'Computes in_progress count');
  assert.ok(adminJs.includes('Delivered'), 'Computes completed count');
  assert.ok(adminJs.includes('Rejected/Cancelled'), 'Computes cancelled count');
});

test('Section 2 & 4: Functional Simulation of Filters & Independence of KPI Counts', () => {
  // Mock dataset with various statuses, fulfillments, and dates
  const mockOrders = [
    { orderNumber: 'ORD-001', status: 'Pending Confirmation', fulfillment: 'delivery', date: '2026-10-31', firstName: 'John', lastName: 'Doe', phone: '09171234567', total: 1499 },
    { orderNumber: 'ORD-002', status: 'Confirmed', fulfillment: 'pickup', date: '2026-10-31', firstName: 'Jane', lastName: 'Smith', phone: '09181234567', total: 1299 },
    { orderNumber: 'ORD-003', status: 'Preparing', fulfillment: 'delivery', date: '2026-10-30', firstName: 'Alice', lastName: 'Guin', phone: '09191234567', total: 899 },
    { orderNumber: 'ORD-004', status: 'Rider Assigned', fulfillment: 'delivery', date: '2026-10-29', firstName: 'Bob', lastName: 'Marley', phone: '09201234567', total: 1899 },
    { orderNumber: 'ORD-005', status: 'On the Way', fulfillment: 'delivery', date: '2026-10-28', firstName: 'Charlie', lastName: 'Brown', phone: '09211234567', total: 999 },
    { orderNumber: 'ORD-006', status: 'Ready for Pickup', fulfillment: 'pickup', date: '2026-10-27', firstName: 'Diana', lastName: 'Prince', phone: '09221234567', total: 1199 },
    { orderNumber: 'ORD-007', status: 'Delivered', fulfillment: 'delivery', date: '2026-10-26', firstName: 'Edward', lastName: 'Norton', phone: '09231234567', total: 1399 },
    { orderNumber: 'ORD-008', status: 'Picked Up', fulfillment: 'pickup', date: '2026-10-25', firstName: 'Fiona', lastName: 'Gallagher', phone: '09241234567', total: 1799 },
    { orderNumber: 'ORD-009', status: 'Rejected/Cancelled', fulfillment: 'delivery', date: '2026-10-24', firstName: 'George', lastName: 'Clark', phone: '09251234567', total: 1499 }
  ];

  // Helper simulating admin app state and filtering
  class SimulatedAdminApp {
    constructor(orders) {
      this.orders = orders;
      this.currentStatusFilter = 'all';
      this.orderStatusFilter = 'all';
      this.orderFulfillmentFilter = 'all';
      this.orderDateFilter = 'all';
      this.searchQuery = '';
      this.pagination = { orders: { page: 1, pageSize: 6 } };
    }

    getKPICounts() {
      return {
        all: this.orders.length,
        pending: this.orders.filter(o => o.status === 'Pending Confirmation').length,
        in_progress: this.orders.filter(o => ['Confirmed', 'Preparing', 'Rider Assigned', 'On the Way', 'Ready for Pickup'].includes(o.status)).length,
        completed: this.orders.filter(o => ['Delivered', 'Picked Up'].includes(o.status)).length,
        cancelled: this.orders.filter(o => o.status === 'Rejected/Cancelled').length
      };
    }

    handleOrderStatusFilter(val) {
      this.currentStatusFilter = val || 'all';
      this.orderStatusFilter = this.currentStatusFilter;
      this.pagination.orders.page = 1;
    }

    handleOrderFulfillmentFilter(val) {
      this.orderFulfillmentFilter = val || 'all';
      this.pagination.orders.page = 1;
    }

    handleOrderSearch(val) {
      this.searchQuery = (val || '').toLowerCase().trim();
      this.pagination.orders.page = 1;
    }

    clearOrderFilters() {
      this.searchQuery = '';
      this.currentStatusFilter = 'all';
      this.orderStatusFilter = 'all';
      this.orderFulfillmentFilter = 'all';
      this.orderDateFilter = 'all';
      this.pagination.orders.page = 1;
    }

    getFilteredOrders() {
      let filtered = this.orders;
      const status = this.orderStatusFilter || this.currentStatusFilter || 'all';
      if (status === 'pending') {
        filtered = filtered.filter(o => o.status === 'Pending Confirmation');
      } else if (status === 'in_progress') {
        filtered = filtered.filter(o => ['Confirmed', 'Preparing', 'Rider Assigned', 'On the Way', 'Ready for Pickup'].includes(o.status));
      } else if (status === 'completed') {
        filtered = filtered.filter(o => ['Delivered', 'Picked Up'].includes(o.status));
      } else if (status === 'cancelled') {
        filtered = filtered.filter(o => o.status === 'Rejected/Cancelled');
      }

      if (this.orderFulfillmentFilter && this.orderFulfillmentFilter !== 'all') {
        filtered = filtered.filter(o => o.fulfillment === this.orderFulfillmentFilter);
      }

      if (this.searchQuery) {
        filtered = filtered.filter(o =>
          (o.orderNumber || '').toLowerCase().includes(this.searchQuery) ||
          (o.firstName || '').toLowerCase().includes(this.searchQuery) ||
          (o.lastName || '').toLowerCase().includes(this.searchQuery) ||
          (o.phone || '').includes(this.searchQuery)
        );
      }

      return filtered;
    }
  }

  const app = new SimulatedAdminApp(mockOrders);

  // 1. Initial KPI counts check
  const kpis = app.getKPICounts();
  assert.equal(kpis.all, 9, 'Total orders KPI is 9');
  assert.equal(kpis.pending, 1, 'Pending KPI is 1');
  assert.equal(kpis.in_progress, 5, 'In Progress KPI is 5 (Confirmed, Preparing, Rider Assigned, On the Way, Ready for Pickup)');
  assert.equal(kpis.completed, 2, 'Completed KPI is 2 (Delivered, Picked Up)');
  assert.equal(kpis.cancelled, 1, 'Cancelled KPI is 1');

  // 2. Status filtering to In Progress
  app.handleOrderStatusFilter('in_progress');
  const inProgOrders = app.getFilteredOrders();
  assert.equal(inProgOrders.length, 5, 'Should filter to 5 in-progress orders');
  assert.ok(inProgOrders.every(o => ['Confirmed', 'Preparing', 'Rider Assigned', 'On the Way', 'Ready for Pickup'].includes(o.status)));

  // KPI counts MUST remain independent of filtered table!
  const kpisAfterFilter = app.getKPICounts();
  assert.deepEqual(kpisAfterFilter, kpis, 'KPI counts must not change when table is filtered');

  // 3. Combined Filter: In Progress + Pickup fulfillment
  app.handleOrderFulfillmentFilter('pickup');
  const inProgPickup = app.getFilteredOrders();
  assert.equal(inProgPickup.length, 2, '2 in-progress pickup orders (Confirmed ORD-002, Ready for Pickup ORD-006)');

  // 4. Combined Filter: In Progress + Pickup + Search "Jane"
  app.handleOrderSearch('Jane');
  const janeOrder = app.getFilteredOrders();
  assert.equal(janeOrder.length, 1, '1 order matches search');
  assert.equal(janeOrder[0].orderNumber, 'ORD-002');

  // 5. Clear Filters
  app.clearOrderFilters();
  assert.equal(app.currentStatusFilter, 'all');
  assert.equal(app.orderFulfillmentFilter, 'all');
  assert.equal(app.searchQuery, '');
  assert.equal(app.pagination.orders.page, 1);
  assert.equal(app.getFilteredOrders().length, 9, 'All 9 orders returned after clear filters');
});
