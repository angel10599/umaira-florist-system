/**
 * UMAIRA FLORIST - Admin Management Console Controller
 * Comprehensive dashboard, orders, products, inventory, suppliers, and shop settings management.
 */

function esc(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const peso = (n) => '₱' + (Number(n) || 0).toLocaleString();
const formatCurrency = peso;
if (typeof window !== 'undefined') window.formatCurrency = peso;
const ROWS_PER_PAGE = 6;

// =========================================================================
// CENTRALIZED TERMINOLOGY & STATUS MAPPINGS (Single Source of Truth)
// =========================================================================
const TERMINOLOGY = {
  // Order Status Groups
  orderStatus: {
    pending: { label: 'Pending', badgeClass: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]' },
    in_progress: { label: 'In Progress', badgeClass: 'bg-[#EEF2FF] text-[#3730A3] border-[#E0E7FF]' },
    completed: { label: 'Completed', badgeClass: 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]' },
    cancelled: { label: 'Cancelled', badgeClass: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]' }
  },

  // Fulfillment Methods
  fulfillment: {
    delivery: { label: 'Delivery' },
    pickup: { label: 'Store Pickup' }
  },

  // Product Types
  productType: {
    flower: { label: 'Fresh Flowers', badgeClass: 'bg-[#EBF1EC] text-[#647D69] border-[#E5ECE6]' },
    bouquet: { label: 'Ready-Made Bouquets', badgeClass: 'bg-[#EBF1EC] text-[#647D69] border-[#E5ECE6]' },
    filler: { label: 'Fillers & Foliage', badgeClass: 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]' },
    foliage: { label: 'Fillers & Foliage', badgeClass: 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]' },
    fillers_foliage: { label: 'Fillers & Foliage', badgeClass: 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]' },
    wrapping: { label: 'Wrapping Materials', badgeClass: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]' },
    ribbon: { label: 'Ribbons', badgeClass: 'bg-[#EDE9FE] text-[#5B21B6] border-[#DDD6FE]' },
    card: { label: 'Message Cards', badgeClass: 'bg-[#E0F2FE] text-[#075985] border-[#BAE6FD]' },
    accessory: { label: 'Accessories', badgeClass: 'bg-stone-100 text-stone-700 border-stone-200' }
  },

  // Stock Statuses
  stockStatus: {
    available: { label: 'In Stock', badgeClass: 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]' },
    limited: { label: 'Low Stock', badgeClass: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]' },
    sold_out: { label: 'Out of Stock', badgeClass: 'bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]' }
  },

  // Stock Movement Types
  movementType: {
    restock: { label: 'Stock In (+)', badgeClass: 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]' },
    deduct: { label: 'Stock Out (-)', badgeClass: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]' },
    correction: { label: 'Adjustment (=)', badgeClass: 'bg-[#E0F2FE] text-[#0369A1] border-[#BAE6FD]' },
    order_fulfillment: { label: 'Order Deduction', badgeClass: 'bg-stone-100 text-stone-700 border-stone-200' },
    order_restoration: { label: 'Order Restoration', badgeClass: 'bg-[#F3E8FF] text-[#6B21A8] border-[#E9D5FF]' }
  },

  // Storefront Availability
  availability: {
    available: { label: 'Available', badgeClass: 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]' },
    unavailable: { label: 'Unavailable', badgeClass: 'bg-stone-100 text-stone-600 border-stone-200' }
  },

  // Supplier Status
  supplierStatus: {
    active: { label: 'Active', badgeClass: 'bg-[#DCFCE7] text-[#166534] border-[#BBF7D0]' },
    inactive: { label: 'Inactive', badgeClass: 'bg-stone-100 text-stone-600 border-stone-200' }
  }
};

// Order status groups shared with the server (js/shop-rules.js), so the Orders cards, filters and the
// server's totals always agree (e.g. "Delivered — Confirmed" counts as completed everywhere).
const ADMIN_ACTIVE_STATUSES = () => (window.SHOP_RULES && window.SHOP_RULES.ACTIVE_ORDER_STATUSES) || ['Confirmed', 'Preparing', 'Rider Assigned', 'On the Way', 'Out for Delivery', 'Delivery Attempt Failed', 'Ready for Pickup', 'Awaiting Customer Confirmation', 'Pickup Disputed', 'Delivered — Awaiting Confirmation', 'Delivery Disputed'];
const ADMIN_DONE_STATUSES = () => (window.SHOP_RULES && window.SHOP_RULES.DONE_ORDER_STATUSES) || ['Delivered — Confirmed', 'Delivered', 'Picked Up'];

class AdminApp {
  // Confirmation wrapper using UI.confirm modal dialog
  async confirmAction(opts, request, onDone) {
    if (!window.UI || typeof window.UI.confirm !== 'function') {
      const res = await request();
      if (res && res.ok && onDone) onDone();
      return true;
    }
    const done = await window.UI.confirm({
      ...opts,
      onConfirm: async (val, checked) => {
        const res = await request(val, checked);
        return res.ok ? { ok: true } : { ok: false, error: (res.data && res.data.error) || res.error || 'The request failed. Nothing was changed.' };
      }
    });
    if (done && onDone) onDone();
    return done;
  }

  constructor() {
    this.token = sessionStorage.getItem('umaira_admin_token') || localStorage.getItem('umaira_admin_token') || '';
    this.currentTab = 'dashboard';
    this.currentProductTab = 'flowers';
    this.currentInventoryTab = 'overview';
    this.currentStatusFilter = 'all';

    this.orders = [];
    this.flowers = [];
    this.bouquets = [];
    this.categories = [];
    this.suppliers = [];
    this.stockTransactions = [];
    this.stats = {};
    this.inventorySummary = {};
    this.shopSettings = {};

    this.customers = [];
    this.customerSearch = '';
    this.customerFilter = 'all';
    this.customerSort = 'newest';

    this.searchQuery = '';
    this.orderFulfillmentFilter = 'all';
    this.orderDateFilter = 'all';
    this.orderCustomStart = '';
    this.orderCustomEnd = '';
    this.flowerSearch = '';
    this.flowerCategory = 'all';
    this.flowerItemType = 'all';
    this.flowerStatusFilter = 'all';
    this.bouquetSearch = '';
    this.bouquetCategory = 'all';
    this.bouquetStatusFilter = 'all';
    this.categorySearch = '';
    this.categoryTypeFilter = 'all';
    this.categoryStatusFilter = 'all';

    // Unified Product Management Filter & Sort State
    this.productSearch = '';
    this.productTypeFilter = 'all';
    this.productOccasionFilter = 'all';
    this.productStockStatusFilter = 'all';
    this.productAvailabilityFilter = 'all';
    this.productSort = 'name_asc';
    this.editingCategoryId = null;

    // Dashboard Business Analytics State
    this.dashboardRange = 'last7days';
    this.dashboardStartDate = '';
    this.dashboardEndDate = '';
    this.dashboardAnalytics = null;
    this.dashboardSalesChart = null;
    this.dashboardDistributionChart = null;

    this.inventorySearch = '';
    this.inventoryStatus = 'all';
    this.inventoryTypeFilter = 'all';
    this.historySearch = '';
    this.historyType = 'all';
    this.historyDateFilter = 'all';
    this.historyCustomStart = '';
    this.historyCustomEnd = '';
    this.supplierSearch = '';
    this.supplierStatus = 'all';
    this.supplierOrigin = 'all';
    this.supplierCategory = 'all';

    // Standardized table pagination (6 records per page across all tables)
    this.pagination = {
      store: { page: 1, pageSize: ROWS_PER_PAGE },
      orders: { page: 1, pageSize: ROWS_PER_PAGE },
      products: { page: 1, pageSize: ROWS_PER_PAGE },
      flowers: { page: 1, pageSize: ROWS_PER_PAGE },
      bouquets: { page: 1, pageSize: ROWS_PER_PAGE },
      categories: { page: 1, pageSize: ROWS_PER_PAGE },
      inventory: { page: 1, pageSize: ROWS_PER_PAGE },
      history: { page: 1, pageSize: ROWS_PER_PAGE },
      suppliers: { page: 1, pageSize: ROWS_PER_PAGE },
      customers: { page: 1, pageSize: ROWS_PER_PAGE },
      reportsProducts: { page: 1, pageSize: ROWS_PER_PAGE },
      reportsInventory: { page: 1, pageSize: ROWS_PER_PAGE },
      reportsTransactions: { page: 1, pageSize: ROWS_PER_PAGE },
      reportsStock: { page: 1, pageSize: ROWS_PER_PAGE }
    };

    // Reports filters & state
    this.reportsRange = 'last7days';
    this.reportsStartDate = '';
    this.reportsEndDate = '';
    this.currentReportType = 'all';
    this.reportsInventoryFilter = 'all';
    this.reportsInventoryCategory = 'all';
    this.reportsStockSearch = '';
    this.reportsStockCategory = 'all';
    this.reportsStockType = 'all';

    // Store management filters
    this.storeSearchQuery = '';
    this.storeCategoryFilter = 'all';
    this.storeOccasionFilter = 'all';
    this.storeStockFilter = 'all';
    this.storeSortFilter = 'name_asc';

    // Reports overview state
    this.reportsData = null;
    this.reportsRange = 'last7days';
    this.reportsStartDate = '';
    this.reportsEndDate = '';
    this.reportsSalesChart = null;
    this.reportsDistributionChart = null;
    this.reportsBestsellersChart = null;
    this.currentPreviewDoc = null;
    this.currentDetailOrderNumber = null;
    this.eventSource = null;

    this.init();
  }

  changePage(tableKey, newPage) {
    const pag = this.pagination[tableKey];
    if (!pag) return;
    pag.page = newPage;
    switch (tableKey) {
      case 'store': this.renderStoreTable(); break;
      case 'orders': this.renderOrdersTable(); break;
      case 'products': this.renderProductsTable(); break;
      case 'flowers': this.renderFlowersTable(); break;
      case 'bouquets': this.renderBouquetsTable(); break;
      case 'categories': this.renderCategoriesTable(); break;
      case 'inventory': this.renderInventoryTable(); break;
      case 'history': this.renderStockHistoryTable(); break;
      case 'suppliers': this.renderSuppliersTable(); break;
      case 'customers': this.renderCustomersTable(); break;
      case 'reportsProducts': this.renderReportsProductsTable(); break;
      case 'reportsInventory': this.renderReportsInventoryTable(); break;
      case 'reportsTransactions': this.renderReportsTransactionsTable(); break;
      case 'reportsStock': this.renderReportsStockTable(); break;
    }
  }

  renderPagination(tableKey, totalRecords) {
    const container = document.getElementById(`${tableKey}-pagination`);
    if (!container) return;

    const pag = this.pagination[tableKey] || { page: 1, pageSize: ROWS_PER_PAGE };
    const pageSize = pag.pageSize || ROWS_PER_PAGE;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

    // Clamping to valid range
    if (pag.page > totalPages) pag.page = totalPages;
    if (pag.page < 1) pag.page = 1;

    if (totalRecords === 0) {
      container.innerHTML = '';
      container.classList.add('hidden');
      return;
    }
    container.classList.remove('hidden');

    const startRecord = (pag.page - 1) * pageSize + 1;
    const endRecord = Math.min(pag.page * pageSize, totalRecords);
    const isFirst = pag.page <= 1;
    const isLast = pag.page >= totalPages;

    // Rule: Hide unnecessary pagination buttons when there are 6 or fewer records (single page)
    if (totalPages <= 1) {
      container.innerHTML = `
        <div class="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#6E6864]">
          <div class="font-medium select-none">
            Showing <span class="font-mono font-bold text-[#302C2A]">${startRecord}–${endRecord}</span> of <span class="font-mono font-bold text-[#302C2A]">${totalRecords}</span> records
          </div>
          <span class="font-mono text-[11px] text-[#A68A80]">Page 1 of 1</span>
        </div>
      `;
      return;
    }

    const pagesToShow = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pagesToShow.push(i);
    } else {
      pagesToShow.push(1);
      if (pag.page > 3) pagesToShow.push('...');
      const start = Math.max(2, pag.page - 1);
      const end = Math.min(totalPages - 1, pag.page + 1);
      for (let i = start; i <= end; i++) pagesToShow.push(i);
      if (pag.page < totalPages - 2) pagesToShow.push('...');
      pagesToShow.push(totalPages);
    }

    const pageButtonsHtml = pagesToShow.map(p => {
      if (p === '...') {
        return `<span class="px-2 py-1 text-xs text-[#A68A80] select-none">…</span>`;
      }
      const isActive = p === pag.page;
      if (isActive) {
        return `<button type="button" aria-current="page" class="w-8 h-8 rounded-lg text-xs font-bold bg-[#647D69] text-white shadow-xs focus:ring-2 focus:ring-[#647D69] focus:outline-none transition btn-tactile">${p}</button>`;
      }
      return `<button type="button" onclick="window.adminApp.changePage('${tableKey}', ${p})" class="w-8 h-8 rounded-lg text-xs font-semibold text-[#6E6864] hover:bg-[#EBF1EC] hover:text-[#302C2A] hover:border-[#E5ECE6] border border-[#E5ECE6] bg-[#FFFFFF] focus:ring-2 focus:ring-[#647D69] focus:outline-none transition btn-tactile">${p}</button>`;
    }).join('');

    container.innerHTML = `
      <div class="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div class="text-[#6E6864] font-medium select-none flex items-center gap-2">
          <span>Showing <span class="font-mono font-bold text-[#302C2A]">${startRecord}–${endRecord}</span> of <span class="font-mono font-bold text-[#302C2A]">${totalRecords}</span> records</span>
          <span class="text-[#A68A80]">•</span>
          <span class="font-mono text-[11px] text-[#6E6864]">Page ${pag.page} of ${totalPages}</span>
        </div>
        <div class="flex items-center gap-1.5" role="navigation" aria-label="Pagination">
          <button type="button" onclick="window.adminApp.changePage('${tableKey}', ${pag.page - 1})" ${isFirst ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E5ECE6] ${isFirst ? 'opacity-40 cursor-not-allowed text-[#A68A80] bg-[#FFF9F5]' : 'text-[#6E6864] hover:bg-[#EBF1EC] hover:text-[#302C2A] hover:border-[#E5ECE6] bg-[#FFFFFF] shadow-2xs btn-tactile'} focus:ring-2 focus:ring-[#647D69] focus:outline-none transition flex items-center gap-1">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            <span>Prev</span>
          </button>
          <div class="flex items-center gap-1">
            ${pageButtonsHtml}
          </div>
          <button type="button" onclick="window.adminApp.changePage('${tableKey}', ${pag.page + 1})" ${isLast ? 'disabled' : ''} class="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#E5ECE6] ${isLast ? 'opacity-40 cursor-not-allowed text-[#A68A80] bg-[#FFF9F5]' : 'text-[#6E6864] hover:bg-[#EBF1EC] hover:text-[#302C2A] hover:border-[#E5ECE6] bg-[#FFFFFF] shadow-2xs btn-tactile'} focus:ring-2 focus:ring-[#647D69] focus:outline-none transition flex items-center gap-1">
            <span>Next</span>
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
          </button>
        </div>
      </div>
    `;
  }

  init() {
    this.setupGlobalTopBar();
    if (this.token) {
      this.showDashboard();
      this.refreshAll();
      this.setupRealtimeSync();
    } else {
      this.showLogin();
    }
    window.addEventListener('beforeunload', () => this.teardownRealtimeSync());
  }

  showLogin() {
    document.getElementById('admin-login-screen')?.classList.remove('hidden');
    document.getElementById('admin-dashboard-screen')?.classList.add('hidden');
  }

  showDashboard() {
    document.getElementById('admin-login-screen')?.classList.add('hidden');
    document.getElementById('admin-dashboard-screen')?.classList.remove('hidden');
    const user = sessionStorage.getItem('umaira_admin_user') || 'Administrator';
    const userDisplay = document.getElementById('admin-user-display');
    if (userDisplay) userDisplay.innerText = user;
    const welcomeName = document.getElementById('dashboard-welcome-name');
    if (welcomeName) welcomeName.innerText = (user === 'admin') ? 'Admin Staff' : user;
    this.fetchAdminProfile();
    this.startLiveClock();
    this.updateNotificationBadge();
  }

  // =========================================================================
  // TOP BAR & NOTIFICATIONS CONTROLLER
  // =========================================================================
  setupGlobalTopBar() {
    if (this._topBarListenersSet) return;
    this._topBarListenersSet = true;

    // Document click: close dropdowns when clicking outside
    document.addEventListener('click', (e) => {
      const searchContainer = document.getElementById('topbar-search-container');
      if (searchContainer && !searchContainer.contains(e.target)) {
        this.closeGlobalSearchResults();
      }
      const notifsContainer = document.getElementById('topbar-notifications-container');
      if (notifsContainer && !notifsContainer.contains(e.target)) {
        this.closeNotificationsPopover();
      }
      if (!e.target.closest('[data-options-menu]')) {
        this.closeAllTableOptionMenus();
      }
    });

    // Keyboard shortcuts: Escape to dismiss, Ctrl/Cmd+K or '/' to focus search
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeGlobalSearchResults();
        this.closeNotificationsPopover();
        this.closeAllTableOptionMenus();
        this.closeTopModal();
      }
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !isInput)) {
        const searchInput = document.getElementById('topbar-search-input');
        if (searchInput && document.activeElement !== searchInput) {
          e.preventDefault();
          searchInput.focus();
          searchInput.select();
        }
      }
    });

    // Live preview updates for centralized threshold inputs
    const modalInput = document.getElementById('modal-threshold-input');
    if (modalInput) {
      modalInput.addEventListener('input', (e) => {
        const p = document.getElementById('modal-threshold-preview');
        if (p) p.textContent = e.target.value || '20';
      });
    }
    const settingInput = document.getElementById('setting-inventory-low-stock');
    if (settingInput) {
      settingInput.addEventListener('input', (e) => {
        this.previewThresholdChange(e.target.value);
      });
    }
  }

  // The one KPI card used on every admin page: title + icon (top-right), main value, one-line description.
  // `tone` picks the icon colours (neutral | sage | amber | sky | rose); `onClick` makes the whole card a link.
  // iconBg/iconColor are still accepted from older callers and mapped onto a tone.
  kpiCardHTML({ id = '', label, value, subtext = '', tone = '', iconBg = '', iconColor = '', iconSvg = '', extraClasses = '', onClick = '', title = '', valueId = '', descId = '' }) {
    const toneOf = () => {
      const s = `${iconBg} ${iconColor}`;
      if (/FEF3C7|D97706|92400E|amber/i.test(s)) return 'amber';
      if (/EFF6FF|E0F2FE|2563EB|0369A1|3730A3|EEF2FF|sky|blue/i.test(s)) return 'sky';
      if (/FFF1F2|FEE2E2|FFE4E6|E11D48|991B1B|BE123C|rose|red/i.test(s)) return 'rose';
      if (/EBF1EC|DCFCE7|166534|647D69|4A6B53|344F3B|emerald|green/i.test(s)) return 'sage';
      return 'neutral';
    };
    const t = tone || toneOf();
    const link = onClick ? ` kpi-card--link" role="button" tabindex="0" onclick="${onClick}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click();}"` : '"';
    return `
      <div class="kpi-card ${extraClasses}${link} ${id ? `id="${id}"` : ''} ${title ? `title="${title}"` : ''}>
        <div class="kpi-card__head">
          <span class="kpi-card__label">${label}</span>
          <span class="kpi-card__icon kpi-tone-${t}" aria-hidden="true">${iconSvg}</span>
        </div>
        <div class="kpi-card__body">
          <div class="kpi-card__value"${valueId ? ` id="${valueId}"` : ''}>${value}</div>
          <p class="kpi-card__desc"${descId ? ` id="${descId}"` : ''}>${subtext || '&nbsp;'}</p>
        </div>
      </div>
    `;
  }

  closeTopModal() {
    const modalMap = [
      { id: 'admin-account-modal', fn: () => this.closeAccountModal() },
      { id: 'admin-pdf-preview-modal', fn: () => this.closePDFPreviewModal() },
      { id: 'admin-customer-modal', fn: () => this.closeCustomerModal() },
      { id: 'admin-customers-directory-modal', fn: () => this.closeCustomerDirectoryModal() },
      { id: 'admin-report-modal', fn: () => this.closeGenerateReportModal() },
      { id: 'admin-category-modal', fn: () => this.closeCategoryModal() },
      { id: 'admin-supplier-modal', fn: () => this.closeSupplierModal() },
      { id: 'admin-stock-modal', fn: () => this.closeStockAdjustModal() },
      { id: 'admin-bouquet-modal', fn: () => this.closeBouquetModal() },
      { id: 'admin-flower-modal', fn: () => this.closeFlowerModal() },
      { id: 'admin-product-view-modal', fn: () => this.closeProductViewModal() },
      { id: 'admin-stock-history-modal', fn: () => this.closeStockHistoryModal() },
      { id: 'admin-category-manage-modal', fn: () => this.closeCategoryManageModal() },
      { id: 'admin-product-modal', fn: () => this.closeProductModal() },
      { id: 'admin-order-modal', fn: () => this.closeOrderModal() }
    ];
    for (const m of modalMap) {
      const el = document.getElementById(m.id);
      if (el && !el.classList.contains('hidden')) {
        m.fn();
        return true;
      }
    }
    return false;
  }

  startLiveClock() {
    if (this._clockTimer) clearInterval(this._clockTimer);
    const tick = () => {
      const now = new Date();
      const timeEl = document.getElementById('topbar-live-time');
      const dateEl = document.getElementById('topbar-live-date');
      if (!timeEl && !dateEl) return;
      try {
        const timeStr = now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Manila',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        const dateStr = now.toLocaleDateString('en-US', {
          timeZone: 'Asia/Manila',
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        });
        if (timeEl) timeEl.textContent = timeStr;
        if (dateEl) dateEl.textContent = dateStr;
      } catch (_) {
        if (timeEl) timeEl.textContent = now.toTimeString().slice(0, 8);
      }
    };
    tick();
    this._clockTimer = setInterval(tick, 1000);
  }

  async loadAdminNotifications() {
    try {
      const res = await this.apiRequest('/api/admin/notifications');
      // apiRequest returns { ok, status, data }: the list is in data.notifications (it was read from the
      // wrong place, so stored alerts — new orders, disputes, payment proofs — never reached the bell).
      const list = res && ((res.data && res.data.notifications) || res.notifications);
      if (Array.isArray(list)) {
        this.dbNotifications = list;
      }
    } catch (_) {}
  }

  getNotifications() {
    const list = [];

    // 1. Database persistent notifications (new orders, delivery confirmations, disputes)
    for (const n of (this.dbNotifications || []).filter(x => !x.isRead)) { // read alerts leave the bell
      const isDisputed = n.type === 'delivery_disputed';
      const isConfirmed = n.type === 'delivery_confirmed';
      const isNewOrder = n.type === 'order_new';

      let badgeClass = 'bg-[#EBF1EC] text-[#647D69] border-[#E5ECE6]';
      let badge = 'Notice';
      if (isDisputed) {
        badgeClass = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
        badge = 'Disputed';
      } else if (isConfirmed) {
        badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
        badge = 'Confirmed';
      } else if (isNewOrder) {
        badgeClass = 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A] font-bold';
        badge = 'New Order';
      }

      list.push({
        id: `db-${n.id}`,
        dbId: n.id,
        isRead: n.isRead,
        type: isDisputed ? 'dispute' : (isNewOrder ? 'order' : 'status'),
        title: n.title,
        subtitle: n.message,
        time: n.createdAt ? new Date(n.createdAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : '',
        badge: badge,
        badgeClass: badgeClass,
        target: n.orderNumber,
        action: async () => {
          if (!n.isRead) {
            try { await this.apiRequest(`/api/admin/notifications/${n.id}/read`, 'POST'); } catch (_) {}
          }
          if (n.orderNumber) this.jumpToOrder(n.orderNumber);
          await this.loadAdminNotifications();
          this.updateNotificationBadge();
        }
      });
    }

    // 2. Pending orders (if not already covered)
    const pendingOrders = (this.orders || []).filter(o => o.status === 'Pending Confirmation');
    for (const o of pendingOrders) {
      if (!list.some(item => item.target === o.orderNumber && item.type === 'order')) {
        list.push({
          id: `order-${o.orderNumber}`,
          type: 'order',
          title: `Pending Order ${o.orderNumber}`,
          subtitle: `${o.customerName || o.recipientName || 'Customer'} • ${peso(o.total || 0)}`,
          time: o.createdAt ? new Date(o.createdAt).toLocaleTimeString('en-US', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit' }) : 'Pending',
          badge: 'Needs Review',
          badgeClass: 'bg-[#FEF3C7] text-[#B45309] border-[#FDE68A]',
          target: o.orderNumber,
          action: () => this.jumpToOrder(o.orderNumber)
        });
      }
    }

    // 3. Consolidated stock alerts (Centralized low-stock and depleted summaries)
    const globalTh = this.getGlobalLowStockThreshold();
    const flowers = this.flowers || [];

    const lowStockFlowers = flowers.filter(f => {
      const sc = f.stockCount != null ? Number(f.stockCount) : 0;
      return sc > 0 && sc <= globalTh;
    });

    const outOfStockFlowers = flowers.filter(f => {
      const sc = f.stockCount != null ? Number(f.stockCount) : 0;
      return sc <= 0 || f.availability === 'sold_out';
    });

    if (lowStockFlowers.length > 0) {
      const names = lowStockFlowers.slice(0, 3).map(f => f.name).join(', ');
      const more = lowStockFlowers.length > 3 ? ` +${lowStockFlowers.length - 3} more` : '';
      list.push({
        id: 'summary-low-stock',
        type: 'stock',
        title: `Low Stock Alert (${lowStockFlowers.length} item${lowStockFlowers.length === 1 ? '' : 's'})`,
        subtitle: `${lowStockFlowers.length} flower${lowStockFlowers.length === 1 ? '' : 's'} with 1–${globalTh} stems: ${names}${more}`,
        time: 'Inventory alert',
        badge: `${lowStockFlowers.length} Low`,
        badgeClass: 'bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]',
        target: 'low_stock',
        action: () => this.jumpToStoreStockStatus('low_stock')
      });
    }

    if (outOfStockFlowers.length > 0) {
      const names = outOfStockFlowers.slice(0, 3).map(f => f.name).join(', ');
      const more = outOfStockFlowers.length > 3 ? ` +${outOfStockFlowers.length - 3} more` : '';
      list.push({
        id: 'summary-out-of-stock',
        type: 'stock',
        title: `Out of Stock Alert (${outOfStockFlowers.length} item${outOfStockFlowers.length === 1 ? '' : 's'})`,
        subtitle: `${outOfStockFlowers.length} item${outOfStockFlowers.length === 1 ? '' : 's'} depleted (0 stems): ${names}${more}`,
        time: 'Depleted alert',
        badge: `${outOfStockFlowers.length} Depleted`,
        badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
        target: 'out_of_stock',
        action: () => this.jumpToStoreStockStatus('out_of_stock')
      });
    }

    return list;
  }

  async markAllNotificationsRead() {
    try {
      await this.apiRequest('/api/admin/notifications/read-all', 'POST');
      await this.loadAdminNotifications();
      this.updateNotificationBadge();
      this.renderNotificationsPopover();
      this.toast('All notifications marked as read.', 'success');
    } catch (_) {}
  }

  updateNotificationBadge() {
    const notifs = this.getNotifications();
    const badge = document.getElementById('topbar-notif-badge');
    const bellBtn = document.getElementById('topbar-bell-btn');
    if (!badge) return;

    if (notifs.length > 0) {
      badge.textContent = notifs.length > 99 ? '99+' : String(notifs.length);
      badge.classList.remove('hidden');
      if (bellBtn) bellBtn.setAttribute('title', `${notifs.length} pending alert${notifs.length === 1 ? '' : 's'}`);
    } else {
      badge.classList.add('hidden');
      if (bellBtn) bellBtn.setAttribute('title', 'No unread notifications');
    }

    const dropdown = document.getElementById('topbar-notifications-dropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
      this.renderNotificationsPopover();
    }
  }

  toggleNotificationsPopover() {
    const dropdown = document.getElementById('topbar-notifications-dropdown');
    const bellBtn = document.getElementById('topbar-bell-btn');
    if (!dropdown) return;

    const isHidden = dropdown.classList.contains('hidden');
    if (isHidden) {
      this.closeGlobalSearchResults();
      this.renderNotificationsPopover();
      dropdown.classList.remove('hidden');
      if (bellBtn) bellBtn.setAttribute('aria-expanded', 'true');
    } else {
      this.closeNotificationsPopover();
    }
  }

  closeNotificationsPopover() {
    const dropdown = document.getElementById('topbar-notifications-dropdown');
    const bellBtn = document.getElementById('topbar-bell-btn');
    if (dropdown) dropdown.classList.add('hidden');
    if (bellBtn) bellBtn.setAttribute('aria-expanded', 'false');
  }

  renderNotificationsPopover() {
    const dropdown = document.getElementById('topbar-notifications-dropdown');
    if (!dropdown) return;

    const notifs = this.getNotifications();
    const count = notifs.length;

    let html = `
      <div class="flex items-center justify-between pb-3 mb-2 border-b border-[#E5ECE6]">
        <div class="flex items-center gap-2">
          <span class="font-serif font-bold text-xs text-[#302C2A]">Notifications</span>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${count > 0 ? 'bg-[#EBF1EC] text-[#647D69] border border-[#E5ECE6]' : 'bg-[#FFF9F5] text-[#6E6864] border border-[#E5ECE6]'} font-mono">${count} alert${count === 1 ? '' : 's'}</span>
        </div>
        <div class="flex items-center gap-3">
          <button type="button" onclick="window.adminApp.markAllNotificationsRead()" class="text-[11px] font-semibold text-[#6E6864] hover:text-[#647D69] hover:underline btn-tactile">
            Mark all read
          </button>
          <button type="button" onclick="window.adminApp.refreshAll()" class="text-[11px] font-semibold text-[#647D69] hover:underline flex items-center gap-1 btn-tactile">
            <svg class="w-3 h-3 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
            Refresh
          </button>
        </div>
      </div>
    `;

    if (count === 0) {
      html += `
        <div class="py-7 px-4 text-center">
          <div class="w-10 h-10 rounded-full bg-[#FFF9F5] text-[#6E6864] flex items-center justify-center mx-auto mb-2 border border-[#E5ECE6]">
            <svg class="w-5 h-5 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
          <p class="text-xs font-semibold text-[#302C2A]">All caught up!</p>
          <p class="text-[11px] text-[#6E6864] mt-0.5">No pending orders or low-stock alerts right now.</p>
        </div>
      `;
    } else {
      html += `<div class="space-y-1.5 max-h-[320px] overflow-y-auto pr-1 sidebar-nav-scroll">`;
      for (const item of notifs) {
        const isOrder = item.type === 'order';
        const iconSvg = isOrder
          ? `<svg class="w-4 h-4 text-[#B45309] stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`
          : `<svg class="w-4 h-4 text-[#647D69] stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>`;
        const iconBg = isOrder ? 'bg-[#FEF3C7] border-[#FDE68A]' : 'bg-[#EBF1EC] border-[#E5ECE6]';

        html += `
          <button
            type="button"
            onclick="window.adminApp.handleNotificationClick('${item.id}')"
            class="w-full text-left p-2.5 rounded-xl hover:bg-[#FFF9F5] transition flex items-start gap-3 border border-transparent hover:border-[#E5ECE6] btn-tactile group"
          >
            <div class="w-7 h-7 rounded-lg ${iconBg} border flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
              ${iconSvg}
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center justify-between gap-1 mb-0.5">
                <span class="text-xs font-bold text-[#302C2A] group-hover:text-[#647D69] transition truncate">${esc(item.title)}</span>
                <span class="text-[9px] px-1.5 py-0.2 rounded-full border font-bold shrink-0 ${item.badgeClass}">${esc(item.badge)}</span>
              </div>
              <p class="text-[11px] text-[#6E6864] truncate">${esc(item.subtitle)}</p>
              <span class="text-[10px] text-[#A68A80] block mt-0.5 font-mono">${esc(item.time)}</span>
            </div>
          </button>
        `;
      }
      html += `</div>`;
    }

    dropdown.innerHTML = html;
  }

  handleNotificationClick(id) {
    const notifs = this.getNotifications();
    const target = notifs.find(n => n.id === id);
    if (target && typeof target.action === 'function') {
      target.action();
    }
    this.closeNotificationsPopover();
  }

  jumpToOrder(orderNum) {
    this.closeNotificationsPopover();
    this.closeGlobalSearchResults();
    this.switchTab('orders');
    setTimeout(() => {
      this.openOrderDetail(orderNum);
    }, 50);
  }

  jumpToInventory(flowerId) {
    this.closeNotificationsPopover();
    this.closeGlobalSearchResults();
    this.switchTab('inventory');
    setTimeout(() => {
      this.openStockAdjustModal(flowerId);
    }, 50);
  }

  jumpToStoreStockStatus(status) {
    this.closeNotificationsPopover();
    this.closeGlobalSearchResults();
    this.switchTab('store');
    const select = document.getElementById('store-stock-filter');
    if (select) {
      select.value = status;
      this.handleStoreStockFilter(status);
    }
  }

  // =========================================================================
  // UNIVERSAL SEARCH CONTROLLER
  // =========================================================================
  handleGlobalSearch(query) {
    const q = (query || '').trim();
    const clearBtn = document.getElementById('topbar-search-clear');
    if (clearBtn) clearBtn.classList.toggle('hidden', !q);

    if (!q) {
      this.closeGlobalSearchResults();
      return;
    }

    this.renderGlobalSearchResults(q);
  }

  showGlobalSearchResults() {
    const input = document.getElementById('topbar-search-input');
    const q = (input?.value || '').trim();
    if (q) {
      this.renderGlobalSearchResults(q);
    }
  }

  clearGlobalSearch() {
    const input = document.getElementById('topbar-search-input');
    if (input) {
      input.value = '';
      input.focus();
    }
    const clearBtn = document.getElementById('topbar-search-clear');
    if (clearBtn) clearBtn.classList.add('hidden');
    this.closeGlobalSearchResults();
  }

  closeGlobalSearchResults() {
    const resBox = document.getElementById('topbar-search-results');
    if (resBox) resBox.classList.add('hidden');
  }

  renderGlobalSearchResults(query) {
    const resBox = document.getElementById('topbar-search-results');
    if (!resBox) return;

    this.closeNotificationsPopover();
    const q = query.toLowerCase();

    if (q.length < 2) {
      resBox.innerHTML = `
        <div class="p-4 text-center text-xs text-[#6E6864]">
          Type at least 2 characters to search orders, products, or suppliers.
        </div>
      `;
      resBox.classList.remove('hidden');
      return;
    }

    const matchedOrders = (this.orders || []).filter(o =>
      (o.orderNumber || '').toLowerCase().includes(q) ||
      (o.customerName || '').toLowerCase().includes(q) ||
      (o.recipientName || '').toLowerCase().includes(q) ||
      (o.recipientPhone || '').includes(q) ||
      (o.status || '').toLowerCase().includes(q)
    ).slice(0, 4);

    const matchedFlowers = (this.flowers || []).filter(f =>
      (f.name || '').toLowerCase().includes(q) ||
      (f.botanicalName || '').toLowerCase().includes(q) ||
      (f.category || '').toLowerCase().includes(q)
    ).slice(0, 4);

    const matchedBouquets = (this.bouquets || []).filter(b =>
      (b.name || '').toLowerCase().includes(q) ||
      (b.category || '').toLowerCase().includes(q) ||
      (b.formula || '').toLowerCase().includes(q)
    ).slice(0, 4);

    const matchedSuppliers = (this.suppliers || []).filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.contactPerson || '').toLowerCase().includes(q) ||
      (s.phone || '').includes(q)
    ).slice(0, 4);

    const totalMatches = matchedOrders.length + matchedFlowers.length + matchedBouquets.length + matchedSuppliers.length;

    if (totalMatches === 0) {
      resBox.innerHTML = `
        <div class="py-6 px-4 text-center">
          <div class="w-8 h-8 rounded-full bg-[#FFF9F5] text-[#6E6864] flex items-center justify-center mx-auto mb-2 border border-[#E5ECE6]">
            <svg class="w-4 h-4 stroke-[1.8]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="8"/><path stroke-linecap="round" stroke-linejoin="round" d="m21 21-4.3-4.3"/>
            </svg>
          </div>
          <p class="text-xs font-semibold text-[#302C2A]">No results found</p>
          <p class="text-[11px] text-[#6E6864] mt-0.5">No orders, products, or suppliers matched "${esc(query)}".</p>
        </div>
      `;
      resBox.classList.remove('hidden');
      return;
    }

    let html = `<div class="space-y-3">`;

    if (matchedOrders.length > 0) {
      html += `
        <div>
          <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#6E6864] px-2 mb-1">
            <span>Orders (${matchedOrders.length})</span>
            <span class="text-[#647D69] font-medium">Orders Tab</span>
          </div>
          <div class="space-y-1">
      `;
      for (const o of matchedOrders) {
        html += `
          <button
            type="button"
            onclick="window.adminApp.jumpToOrder('${esc(o.orderNumber)}')"
            class="w-full text-left p-2 rounded-xl hover:bg-[#FFF9F5] transition flex items-center justify-between gap-2 border border-transparent hover:border-[#E5ECE6] btn-tactile group"
          >
            <div class="min-w-0">
              <span class="text-xs font-bold text-[#302C2A] group-hover:text-[#647D69] font-mono">${esc(o.orderNumber)}</span>
              <span class="text-[11px] text-[#6E6864] block truncate">${esc(o.customerName || o.recipientName || 'Guest')} • ${esc(o.status)}</span>
            </div>
            <span class="text-xs font-semibold text-[#302C2A] font-mono shrink-0">${peso(o.total || 0)}</span>
          </button>
        `;
      }
      html += `</div></div>`;
    }

    if (matchedFlowers.length > 0) {
      html += `
        <div>
          <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#6E6864] px-2 mb-1">
            <span>Fresh Flowers (${matchedFlowers.length})</span>
            <span class="text-[#647D69] font-medium">Products Tab</span>
          </div>
          <div class="space-y-1">
      `;
      for (const f of matchedFlowers) {
        html += `
          <button
            type="button"
            onclick="window.adminApp.jumpToFlower('${esc(f.id)}', '${esc(f.name)}')"
            class="w-full text-left p-2 rounded-xl hover:bg-[#FFF9F5] transition flex items-center justify-between gap-2 border border-transparent hover:border-[#E5ECE6] btn-tactile group"
          >
            <div class="min-w-0">
              <span class="text-xs font-bold text-[#302C2A] group-hover:text-[#647D69]">${esc(f.name)}</span>
              <span class="text-[11px] text-[#6E6864] block truncate">${esc(f.category || 'Flower')} • ${f.stockCount} stems available</span>
            </div>
            <span class="text-xs font-semibold text-[#302C2A] font-mono shrink-0">${peso(f.price || 0)}</span>
          </button>
        `;
      }
      html += `</div></div>`;
    }

    if (matchedBouquets.length > 0) {
      html += `
        <div>
          <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#6E6864] px-2 mb-1">
            <span>Ready-Made Bouquets (${matchedBouquets.length})</span>
            <span class="text-[#647D69] font-medium">Products Tab</span>
          </div>
          <div class="space-y-1">
      `;
      for (const b of matchedBouquets) {
        html += `
          <button
            type="button"
            onclick="window.adminApp.jumpToBouquet('${esc(b.id)}', '${esc(b.name)}')"
            class="w-full text-left p-2 rounded-xl hover:bg-[#FFF9F5] transition flex items-center justify-between gap-2 border border-transparent hover:border-[#E5ECE6] btn-tactile group"
          >
            <div class="min-w-0">
              <span class="text-xs font-bold text-[#302C2A] group-hover:text-[#647D69]">${esc(b.name)}</span>
              <span class="text-[11px] text-[#6E6864] block truncate">${esc(b.category || 'Bouquet')}</span>
            </div>
            <span class="text-xs font-semibold text-[#302C2A] font-mono shrink-0">${peso(b.price || 0)}</span>
          </button>
        `;
      }
      html += `</div></div>`;
    }

    if (matchedSuppliers.length > 0) {
      html += `
        <div>
          <div class="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-[#6E6864] px-2 mb-1">
            <span>Suppliers (${matchedSuppliers.length})</span>
            <span class="text-[#647D69] font-medium">Suppliers Tab</span>
          </div>
          <div class="space-y-1">
      `;
      for (const s of matchedSuppliers) {
        html += `
          <button
            type="button"
            onclick="window.adminApp.jumpToSupplier('${esc(s.id)}', '${esc(s.name)}')"
            class="w-full text-left p-2 rounded-xl hover:bg-[#FFF9F5] transition flex items-center justify-between gap-2 border border-transparent hover:border-[#E5ECE6] btn-tactile group"
          >
            <div class="min-w-0">
              <span class="text-xs font-bold text-[#302C2A] group-hover:text-[#647D69]">${esc(s.name)}</span>
              <span class="text-[11px] text-[#6E6864] block truncate">${esc(s.contactPerson || 'Contact')} • ${esc(s.phone || '')}</span>
            </div>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${s.active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-stone-100 text-stone-600'} shrink-0">${s.active ? 'Active' : 'Inactive'}</span>
          </button>
        `;
      }
      html += `</div></div>`;
    }

    html += `</div>`;
    resBox.innerHTML = html;
    resBox.classList.remove('hidden');
  }

  jumpToFlower(flowerId, flowerName) {
    this.closeGlobalSearchResults();
    this.switchTab('products');
    this.switchProductTab('flowers');
    const typeSelect = document.getElementById('flowers-type-filter');
    if (typeSelect) typeSelect.value = 'all';
    this.flowerItemType = 'all';
    const catSelect = document.getElementById('flowers-category-filter');
    if (catSelect) catSelect.value = 'all';
    this.flowerCategory = 'all';
    const searchInput = document.getElementById('flowers-search-input');
    if (searchInput) {
      searchInput.value = flowerName;
      this.handleFlowerSearch(flowerName);
    }
  }

  jumpToBouquet(bouquetId, bouquetName) {
    this.closeGlobalSearchResults();
    this.switchTab('products');
    this.switchProductTab('bouquets');
    const searchInput = document.getElementById('bouquets-search-input');
    if (searchInput) {
      searchInput.value = bouquetName;
      this.handleBouquetSearch(bouquetName);
    }
  }

  jumpToSupplier(supplierId, supplierName) {
    this.closeGlobalSearchResults();
    this.switchTab('suppliers');
    const searchInput = document.getElementById('suppliers-search-input');
    if (searchInput) {
      searchInput.value = supplierName;
      this.handleSupplierSearch(supplierName);
    }
  }

  toast(msg, type = 'info') {
    const container = document.getElementById('admin-toast-container');
    if (!container) return;
    const el = document.createElement('div');
    const bg = type === 'error' ? 'bg-red-900' : (type === 'success' ? 'bg-emerald-900' : 'bg-charcoal-900');
    el.className = `p-3.5 rounded-xl text-white text-xs font-semibold shadow-xl border border-white/10 ${bg} transition transform duration-300 pointer-events-auto flex items-center gap-2`;
    el.innerHTML = `<span>${esc(msg)}</span>`;
    container.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 300);
    }, 3500);
  }

  async apiRequest(endpoint, method = 'GET', body = null) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.token}`,
      'x-admin-token': this.token
    };
    try {
      const res = await fetch(endpoint, {
        method,
        headers,
        body: body ? JSON.stringify(body) : null
      });
      if (res.status === 401) {
        this.handleLogout();
        this.toast('Session expired or unauthorized. Please sign in.', 'error');
        return { ok: false, error: 'Unauthorized' };
      }
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, error: 'Could not connect to server.' };
    }
  }

  // --- Auth ---
  fillDefaultCredentials() {
    const userField = document.getElementById('admin-username');
    const passField = document.getElementById('admin-password');
    if (userField) userField.value = 'admin';
    if (passField) passField.value = 'umaira2026';
    const errAlert = document.getElementById('login-error-alert');
    if (errAlert) errAlert.classList.add('hidden');
  }

  async handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('admin-username')?.value.trim();
    const password = document.getElementById('admin-password')?.value.trim();
    const errAlert = document.getElementById('login-error-alert');
    const btn = document.getElementById('admin-login-btn');

    if (errAlert) errAlert.classList.add('hidden');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'Verifying credentials...';
    }

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (errAlert) {
          errAlert.innerText = data.error || 'Authentication failed.';
          errAlert.classList.remove('hidden');
        }
        return;
      }

      this.token = data.token;
      sessionStorage.setItem('umaira_admin_token', this.token);
      localStorage.setItem('umaira_admin_token', this.token);
      if (data.admin) {
        this.adminProfile = data.admin;
        sessionStorage.setItem('umaira_admin_user', data.admin.displayName || data.admin.username);
        localStorage.setItem('umaira_admin_user', data.admin.displayName || data.admin.username);
      } else {
        sessionStorage.setItem('umaira_admin_user', data.username || username);
        localStorage.setItem('umaira_admin_user', data.username || username);
      }
      this.showDashboard();
      this.renderSidebarProfile();
      this.refreshAll();
      this.setupRealtimeSync();
      const friendlyName = this.adminProfile?.displayName || data.username || username;
      this.toast(`Welcome back, ${friendlyName}.`, 'success');
    } catch (err) {
      if (errAlert) {
        errAlert.innerText = 'Could not connect to server.';
        errAlert.classList.remove('hidden');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'Sign In to Console';
      }
    }
  }

  togglePasswordVisibility() {
    const input = document.getElementById('admin-password');
    const eyeIcon = document.getElementById('password-eye-icon');
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (eyeIcon) {
        eyeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>';
      }
    } else {
      input.type = 'password';
      if (eyeIcon) {
        eyeIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>';
      }
    }
  }

  handleLogout() {
    this.confirmAction({
      title: 'Sign out of the admin console?',
      message: 'You will need your staff username and password to access the dispatch console again.',
      confirmLabel: 'Sign out',
      cancelLabel: 'Stay signed in'
    }, async () => {
      if (this.token) {
        try {
          await fetch('/api/admin/logout', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${this.token}`, 'x-admin-token': this.token }
          });
        } catch (_) {}
      }
      return { ok: true };
    }, () => {
      this.teardownRealtimeSync();
      this.closeAccountModal();
      this.adminProfile = null;
      this.token = '';
      sessionStorage.removeItem('umaira_admin_token');
      sessionStorage.removeItem('umaira_admin_user');
      localStorage.removeItem('umaira_admin_token');
      localStorage.removeItem('umaira_admin_user');
      this.showLogin();
      this.toast('Signed out successfully.');
    });
  }

  // =========================================================================
  // REAL-TIME SYNCHRONIZATION (Server-Sent Events)
  // =========================================================================
  setupRealtimeSync() {
    if (!this.token) return;
    if (this.eventSource) {
      try { this.eventSource.close(); } catch (_) {}
      this.eventSource = null;
    }

    try {
      const es = new EventSource(`/api/admin/events?token=${encodeURIComponent(this.token)}`);
      this.eventSource = es;

      es.addEventListener('order:created', (e) => {
        try {
          const data = JSON.parse(e.data || '{}');
          this.syncOnOrderEvent(data, 'created');
          this.loadAdminNotifications();
        } catch (_) {}
      });

      es.addEventListener('notification:created', (e) => {
        try {
          this.loadAdminNotifications();
          this.updateNotificationBadge();
        } catch (_) {}
      });

      es.addEventListener('order:status', (e) => {
        try {
          const data = JSON.parse(e.data || '{}');
          this.syncOnOrderEvent(data, 'status');
        } catch (_) {}
      });

      es.addEventListener('inventory:updated', (e) => {
        try {
          const data = JSON.parse(e.data || '{}');
          this.syncOnInventoryEvent(data);
        } catch (_) {}
      });

      es.addEventListener('catalog:updated', (e) => {
        try {
          const data = JSON.parse(e.data || '{}');
          this.syncOnCatalogEvent(data);
        } catch (_) {}
      });

      es.addEventListener('suppliers:updated', () => {
        if (typeof this.loadSuppliers === 'function') this.loadSuppliers();
      });

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          this.eventSource = null;
        }
      };
    } catch (err) {
      console.warn('Real-time sync setup warning:', err);
    }
  }

  teardownRealtimeSync() {
    if (this.eventSource) {
      try { this.eventSource.close(); } catch (_) {}
      this.eventSource = null;
    }
  }

  async syncOnOrderEvent(data, type) {
    // 1. Reload orders while preserving filters, selected status card, and pagination
    await this.loadOrders();

    // 2. Refresh dashboard metrics and recent orders
    if (typeof this.loadDashboardStats === 'function') {
      this.loadDashboardStats();
    }

    // 3. Refresh reports if currently viewing reports tab
    if (this.currentTab === 'reports' && typeof this.loadReportsData === 'function') {
      this.loadReportsData();
    }

    // 4. If current detail modal is viewing this order, refresh details view in place
    if (this.currentDetailOrderNumber) {
      const targetNum = (data && (data.orderNumber || (data.order && data.order.orderNumber))) || null;
      if (targetNum === this.currentDetailOrderNumber) {
        this.openOrderDetail(this.currentDetailOrderNumber);
      }
    }

    // 5. Orders change stock, so sync inventory and store management in background
    if (typeof this.loadInventory === 'function') {
      this.loadInventory();
    }
    if (typeof this.loadStoreData === 'function') {
      await this.loadStoreData();
      if (typeof this.renderStoreKPIs === 'function') this.renderStoreKPIs();
      if (typeof this.renderStoreTable === 'function') this.renderStoreTable();
    }
    this.updateNotificationBadge();
    this.renderNotificationsPopover();
  }

  async syncOnInventoryEvent() {
    if (typeof this.loadSettings === 'function') {
      await this.loadSettings();
    }
    if (typeof this.loadInventory === 'function') {
      await this.loadInventory();
    }
    if (typeof this.loadStoreData === 'function') {
      await this.loadStoreData();
    }
    if (typeof this.renderStoreKPIs === 'function') {
      this.renderStoreKPIs();
    }
    if (typeof this.renderStoreTable === 'function') {
      this.renderStoreTable();
    }
    if (typeof this.renderInventoryKPIs === 'function') {
      this.renderInventoryKPIs();
    }
    if (typeof this.renderInventorySummaryCards === 'function') {
      this.renderInventorySummaryCards();
    }
    if (typeof this.loadDashboardStats === 'function') {
      this.loadDashboardStats();
    }
    if (typeof this.updateThresholdDisplays === 'function') {
      this.updateThresholdDisplays();
    }
    this.updateNotificationBadge();
    this.renderNotificationsPopover();
  }

  async syncOnCatalogEvent() {
    if (typeof this.loadFlowers === 'function') await this.loadFlowers();
    if (typeof this.loadBouquets === 'function') await this.loadBouquets();
    if (typeof this.renderProductKPIs === 'function') this.renderProductKPIs();
  }

  // --- Mobile Drawer ---
  toggleMobileSidebar() {
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;
    const isClosed = sidebar.classList.contains('-translate-x-full');
    if (isClosed) {
      sidebar.classList.remove('-translate-x-full');
      backdrop.classList.remove('hidden');
    } else {
      sidebar.classList.add('-translate-x-full');
      backdrop.classList.add('hidden');
    }
  }

  closeMobileSidebar() {
    const sidebar = document.getElementById('admin-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.add('-translate-x-full');
    if (backdrop) backdrop.classList.add('hidden');
  }

  // --- Primary Navigation (6 Items) ---
  switchTab(tab) {
    this.closeMobileSidebar();

    // Backward-compatibility aliasing for tests & callers
    let target = tab;
    let subProduct = null;
    if (tab === 'flowers' || tab === 'bouquets' || tab === 'products' || tab === 'inventory' || tab === 'store') {
      target = 'store';
      if (tab === 'flowers' || tab === 'bouquets') subProduct = tab;
    }
    else if (tab === 'categories') {
      target = 'store';
      this.openCategoryManageModal();
    }
    else if (tab === 'customers') {
      this.openCustomerDirectoryModal();
      return;
    }

    this.currentTab = target;

    // Update Sidebar Navigation Button Styles (Pill-Shaped Capsules in Warm Ivory)
    document.querySelectorAll('[data-tab-nav]').forEach(btn => {
      const isTarget = btn.getAttribute('data-tab-nav') === target;
      if (isTarget) {
        btn.className = 'w-full flex items-center justify-between px-3.5 py-2.5 rounded-full bg-[#4A6B53] text-white border border-[#583E4B] shadow-xs transition-all duration-150 text-left group btn-tactile font-bold';
        const label = btn.querySelector('span.truncate');
        if (label) label.className = 'text-xs font-bold truncate text-white';
        const svg = btn.querySelector('svg');
        if (svg) {
          svg.setAttribute('class', 'w-[18px] h-[18px] text-[#F9A8D4] shrink-0 stroke-[2]');
        }
      } else {
        btn.className = 'w-full flex items-center justify-between px-3.5 py-2.5 rounded-full border border-transparent hover:bg-white/10 text-[#D6C7CC] hover:text-white transition-all duration-150 text-left group btn-tactile font-medium';
        const label = btn.querySelector('span.truncate');
        if (label) label.className = 'text-xs font-medium truncate';
        const svg = btn.querySelector('svg');
        if (svg) {
          svg.setAttribute('class', 'w-[18px] h-[18px] text-[#D6C7CC] group-hover:text-white shrink-0 stroke-[1.8]');
        }
      }
    });

    // Update Active Content Screen
    document.querySelectorAll('[data-tab-content]').forEach(section => {
      if (section.getAttribute('data-tab-content') === target) {
        section.classList.add('active');
      } else {
        section.classList.remove('active');
      }
    });

    // Reset main content scroll position to top
    const mainScroll = document.getElementById('admin-main-scroll') || document.querySelector('main');
    if (mainScroll) mainScroll.scrollTop = 0;

    // Handle Sub-tab Activation if specified
    if (target === 'products' && subProduct) {
      this.switchProductTab(subProduct);
    }

    // Refresh context-specific data
    if (target === 'dashboard') {
      this.loadStats();
      this.loadOrders();
    } else if (target === 'orders') {
      this.loadOrders();
    } else if (target === 'store' || target === 'products' || target === 'inventory') {
      this.loadStoreData();
      this.loadProducts();
      this.loadInventory();
    } else if (target === 'suppliers') {
      this.loadSuppliers();
    } else if (target === 'reports') {
      this.loadReportsData();
    } else if (target === 'settings') {
      this.loadSettings();
    } else if (target === 'decorations') {
      this.loadDecorationLibrary();
    }
  }

  // --- Sub-tab Switching ---
  switchProductTab(subtab) {
    this.currentProductTab = subtab;
    if (subtab === 'bouquets') {
      this.productTypeFilter = 'bouquet';
      const sel = document.getElementById('products-type-filter');
      if (sel) sel.value = 'bouquet';
      this.renderProductsTable();
    } else if (subtab === 'categories') {
      this.openCategoryManageModal();
    } else if (subtab === 'flowers') {
      this.productTypeFilter = 'flower';
      const sel = document.getElementById('products-type-filter');
      if (sel) sel.value = 'flower';
      this.renderProductsTable();
    }
    this.renderProductKPIs();
  }

  switchInventoryTab(subtab) {
    this.currentInventoryTab = subtab;
    if (subtab === 'history') {
      this.openStockHistoryModal();
    } else {
      this.loadInventory();
    }
    this.renderInventorySummaryCards();
  }

  refreshAll() {
    this.loadStats();
    this.loadOrders();
    this.loadProducts();
    this.loadSuppliers();
    this.loadInventory();
    this.loadReportsData();
    this.loadSettings();
    this.loadCustomers();
    this.loadAdminNotifications();
    this.updateNotificationBadge();
  }

  // =========================================================================
  // SCREEN 1: DASHBOARD & BUSINESS ANALYTICS
  // =========================================================================
  // Called by the live order/inventory sync so the dashboard stays current without a Refresh button.
  loadDashboardStats() {
    if (this.currentTab === 'dashboard') return this.loadStats();
  }

  async loadStats() {
    const res = await this.apiRequest('/api/admin/stats');
    if (res.ok) {
      this.stats = res.data;
    }
    await this.loadDashboardAnalytics();
    this.updateNotificationBadge();
  }

  handleDashboardDateRangeChange(range) {
    const customBox = document.getElementById('dashboard-custom-range-box');
    this.dashboardRange = range;
    if (range === 'custom') {
      if (customBox) customBox.classList.remove('hidden');
      const startEl = document.getElementById('dashboard-start-date');
      const endEl = document.getElementById('dashboard-end-date');
      if (startEl && !startEl.value) {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startEl.value = d.toISOString().split('T')[0];
      }
      if (endEl && !endEl.value) {
        endEl.value = new Date().toISOString().split('T')[0];
      }
    } else {
      if (customBox) customBox.classList.add('hidden');
      this.dashboardStartDate = '';
      this.dashboardEndDate = '';
      this.loadDashboardAnalytics();
    }
  }

  handleDashboardCustomDateChange() {
    const startEl = document.getElementById('dashboard-start-date');
    const endEl = document.getElementById('dashboard-end-date');
    if (startEl && endEl && startEl.value && endEl.value) {
      this.applyDashboardCustomRange();
    }
  }

  applyDashboardCustomRange() {
    const startEl = document.getElementById('dashboard-start-date');
    const endEl = document.getElementById('dashboard-end-date');
    if (!startEl || !endEl || !startEl.value || !endEl.value) {
      window.UI && window.UI.toast ? window.UI.toast('Please select both start and end dates', 'error') : alert('Please select both start and end dates');
      return;
    }
    if (startEl.value > endEl.value) {
      window.UI && window.UI.toast ? window.UI.toast('Start date cannot be after end date', 'error') : alert('Start date cannot be after end date');
      return;
    }
    this.dashboardRange = 'custom';
    this.dashboardStartDate = startEl.value;
    this.dashboardEndDate = endEl.value;
    this.loadDashboardAnalytics();
  }

  async refreshDashboardAnalytics() {
    const icon = document.getElementById('dashboard-refresh-icon');
    if (icon) icon.classList.add('animate-spin');
    try {
      await this.loadDashboardAnalytics();
      if (window.UI && window.UI.toast) {
        window.UI.toast('Dashboard overview updated', 'success');
      }
    } finally {
      if (icon) setTimeout(() => icon.classList.remove('animate-spin'), 400);
    }
  }

  navigateToPendingOrders() {
    this.switchTab('orders');
    this.setStatusFilter('pending');
  }

  navigateToLowStock() {
    this.switchTab('store');
    const stockFilter = document.getElementById('store-stock-filter');
    if (stockFilter) stockFilter.value = 'low_stock';
    this.handleStoreStockFilter('low_stock');
  }

  navigateToOutOfStock() {
    this.switchTab('store');
    const stockFilter = document.getElementById('store-stock-filter');
    if (stockFilter) stockFilter.value = 'out_of_stock';
    this.handleStoreStockFilter('out_of_stock');
  }

  async loadDashboardAnalytics() {
    let url = `/api/admin/dashboard/analytics?range=${encodeURIComponent(this.dashboardRange || 'last7days')}`;
    if (this.dashboardRange === 'custom') {
      if (this.dashboardStartDate) url += `&startDate=${encodeURIComponent(this.dashboardStartDate)}`;
      if (this.dashboardEndDate) url += `&endDate=${encodeURIComponent(this.dashboardEndDate)}`;
    }

    const res = await this.apiRequest(url);
    if (!res.ok) return;

    const data = res.data;
    this.dashboardAnalytics = data;

    this.renderDashboardKPIs(data.kpis || {});
    this.renderDashboardSalesChart(data.trend || {}, data.kpis || {});
    this.renderDashboardDistributionChart(data.orderDistribution || {});
    this.renderDashboardTopBouquets(data.topBouquets || []);
    this.renderDashboardInventoryOverview(data.inventoryOverview || {});
    this.renderDashboardRecentOrders(data.recentOrders || []);

    const pendingBadge = document.getElementById('sidebar-pending-badge');
    if (pendingBadge) {
      const pCount = (data.kpis && data.kpis.pendingOrders) || 0;
      pendingBadge.innerText = pCount;
      if (pCount > 0) pendingBadge.classList.remove('hidden');
      else pendingBadge.classList.add('hidden');
    }
  }

  renderDashboardKPIs(kpis = {}) {
    const container = document.getElementById('admin-stats-grid');
    if (!container) return;

    const salesToday = Number(kpis.salesToday) || 0;
    const pending = Number(kpis.pendingOrders) || 0;
    const activeOrders = Number(kpis.activeOrders) || 0;
    const lowStock = Number(kpis.lowStockItems) || 0;
    const threshold = Number(kpis.threshold) || 20;

    container.innerHTML = [
      // Card 1: Sales Today
      this.kpiCardHTML({
        label: 'Sales Today', value: peso(salesToday), subtext: 'Qualifying revenue earned today', tone: 'sage',
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>'
      }),
      // Card 2: Pending Orders (opens the pending orders list)
      this.kpiCardHTML({
        label: 'Pending Orders', value: pending, subtext: pending > 0 ? 'Awaiting confirmation — review now' : 'All orders up to date', tone: 'amber',
        onClick: 'window.adminApp.navigateToPendingOrders()', title: 'View pending orders',
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
      }),
      // Card 3: Active Orders (opens Orders)
      this.kpiCardHTML({
        label: 'Active Orders', value: activeOrders, subtext: 'Confirmed, preparing & in transit', tone: 'sky',
        onClick: "window.adminApp.switchTab('orders')", title: 'View ongoing orders',
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>'
      }),
      // Card 4: Low-Stock Items (opens low-stock items in Store Management)
      this.kpiCardHTML({
        label: 'Low-Stock Items', value: lowStock, subtext: `At or below ${threshold} units`, tone: 'rose',
        onClick: 'window.adminApp.navigateToLowStock()', title: 'View low-stock items',
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>'
      })
    ].join('');
  }


  renderDashboardSalesChart(trend = {}, kpis = {}) {
    const canvas = document.getElementById('dashboard-sales-chart');
    const emptyEl = document.getElementById('dashboard-sales-empty');
    const badgeEl = document.getElementById('dashboard-trend-total-badge');

    if (badgeEl) {
      badgeEl.innerText = peso(kpis.totalRevenue || 0);
    }

    if (!canvas || !window.Chart) return;

    if (this.dashboardSalesChart) {
      this.dashboardSalesChart.destroy();
      this.dashboardSalesChart = null;
    }

    let labels = [];
    let revenue = [];
    let orders = [];

    if (Array.isArray(trend)) {
      labels = trend.map(t => t.label);
      revenue = trend.map(t => t.revenue);
      orders = trend.map(t => t.orders);
    } else if (trend && typeof trend === 'object') {
      labels = trend.labels || (trend.points ? trend.points.map(t => t.label) : []);
      revenue = trend.revenue || (trend.points ? trend.points.map(t => t.revenue) : []);
      orders = trend.orders || (trend.points ? trend.points.map(t => t.orders) : []);
    }
    const hasData = revenue.some(r => r > 0) || orders.some(o => o > 0);

    if (emptyEl) {
      if (hasData) emptyEl.classList.add('hidden');
      else emptyEl.classList.remove('hidden');
    }

    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 240);
    gradient.addColorStop(0, 'rgba(100, 125, 105, 0.28)');
    gradient.addColorStop(1, 'rgba(100, 125, 105, 0.00)');

    this.dashboardSalesChart = new window.Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Revenue (₱)',
            data: revenue,
            borderColor: '#647D69',
            backgroundColor: gradient,
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#647D69',
            pointRadius: labels.length > 20 ? 2 : 4,
            pointHoverRadius: 6,
            yAxisID: 'y'
          },
          {
            label: 'Orders',
            data: orders,
            backgroundColor: 'rgba(183, 110, 121, 0.40)',
            borderColor: '#B76E79',
            borderWidth: 1,
            borderRadius: 4,
            type: 'bar',
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'top',
            align: 'end',
            labels: {
              boxWidth: 12,
              font: { family: 'Plus Jakarta Sans', size: 10, weight: '600' },
              color: '#6E6864',
              usePointStyle: true
            }
          },
          tooltip: {
            backgroundColor: '#302C2A',
            titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' },
            bodyFont: { family: 'Plus Jakarta Sans', size: 11 },
            padding: 10,
            cornerRadius: 8,
            callbacks: {
              label: function (context) {
                if (context.dataset.label.includes('Revenue')) {
                  return `Revenue: ₱${Number(context.raw || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
                }
                return `Orders: ${context.raw}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              font: { family: 'Plus Jakarta Sans', size: 10 },
              color: '#6E6864',
              maxRotation: 45,
              autoSkip: true,
              maxTicksLimit: 12
            }
          },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            grid: { color: '#FDF2F8' },
            ticks: {
              font: { family: 'Plus Jakarta Sans', size: 10 },
              color: '#6E6864',
              callback: (val) => `₱${val >= 1000 ? (+(val / 1000).toFixed(1)).toLocaleString() + 'k' : val}` // 1 decimal: 1.2k/1.4k must not all read "₱1k"
            }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            grid: { drawOnChartArea: false },
            ticks: {
              font: { family: 'Plus Jakarta Sans', size: 10 },
              color: '#DB2777',
              stepSize: 1,
              precision: 0
            }
          }
        }
      }
    });
  }

  renderDashboardDistributionChart(dist = {}) {
    const canvas = document.getElementById('dashboard-distribution-chart');
    const totalEl = document.getElementById('dashboard-distribution-total-count');
    const emptyEl = document.getElementById('dashboard-distribution-empty');
    const legendEl = document.getElementById('dashboard-distribution-legend');

    const total = Number(dist.totalOrders) || 0;
    if (totalEl) totalEl.innerText = total;

    if (!canvas || !window.Chart) return;

    if (this.dashboardDistributionChart) {
      this.dashboardDistributionChart.destroy();
      this.dashboardDistributionChart = null;
    }

    const segments = dist.segments || [];
    const hasOrders = total > 0;

    if (emptyEl) {
      if (hasOrders) emptyEl.classList.add('hidden');
      else emptyEl.classList.remove('hidden');
    }

    const chartData = hasOrders
      ? segments.map(s => s.count)
      : [1];
    const chartColors = hasOrders
      ? segments.map(s => s.color)
      : ['#E5ECE6'];

    this.dashboardDistributionChart = new window.Chart(canvas, {
      type: 'doughnut',
      data: {
        labels: hasOrders ? segments.map(s => s.label) : ['No Orders'],
        datasets: [{
          data: chartData,
          backgroundColor: chartColors,
          borderColor: '#FFFFFF',
          borderWidth: 2,
          hoverOffset: hasOrders ? 4 : 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: hasOrders,
            backgroundColor: '#302C2A',
            padding: 9,
            cornerRadius: 8,
            callbacks: {
              label: function (ctx) {
                const val = ctx.raw || 0;
                const pct = total > 0 ? Math.round((val / total) * 100) : 0;
                return `${ctx.label}: ${val} (${pct}%)`;
              }
            }
          }
        }
      }
    });

    if (legendEl) {
      legendEl.innerHTML = segments.map(s => `
        <div class="flex items-center justify-between p-1.5 rounded-lg bg-[#FFF9F5] border border-[#E5ECE6]/60 text-xs">
          <div class="flex items-center gap-1.5 truncate">
            <span class="w-2 h-2 rounded-full shrink-0" style="background-color: ${s.color};"></span>
            <span class="truncate text-[11px] text-[#302C2A] font-medium">${esc(s.label)}</span>
          </div>
          <span class="font-mono text-[11px] font-bold text-[#302C2A] shrink-0 ml-1">${s.count}</span>
        </div>
      `).join('');
    }
  }

  renderDashboardTopBouquets(topBouquets = []) {
    const container = document.getElementById('dashboard-bestsellers-list');
    if (!container) return;

    if (!topBouquets || topBouquets.length === 0) {
      container.innerHTML = `
        <div class="py-10 px-4 text-center text-[#6E6864] italic text-xs bg-[#FFF9F5] rounded-xl border border-dashed border-[#E5ECE6]">
          No bouquet sales recorded for this period.
        </div>
      `;
      return;
    }

    const maxUnits = Math.max(...topBouquets.map(b => Number(b.unitsSold || b.quantity) || 0), 1);

    container.innerHTML = topBouquets.slice(0, 5).map((b, idx) => {
      const qty = Number(b.unitsSold || b.quantity) || 0;
      const pct = Math.round((qty / maxUnits) * 100);
      const img = b.image || '';
      const priceEach = Number(b.price) || (qty > 0 ? (Number(b.revenue) || 0) / qty : 0);
      return `
        <div class="p-2.5 rounded-xl bg-[#FFF9F5] border border-[#E5ECE6] hover:border-[#647D69]/40 transition space-y-2">
          <div class="flex items-center justify-between gap-2.5">
            <div class="flex items-center gap-2 min-w-0 flex-1">
              <span class="font-mono font-bold text-xs text-[#6E6864] w-4 shrink-0">#${idx + 1}</span>
              <div class="w-9 h-9 rounded-lg bg-[#EBF1EC] border border-[#E5ECE6] flex items-center justify-center shrink-0 overflow-hidden">
                ${img ? `<img src="${esc(img)}" alt="${esc(b.name)}" class="w-full h-full object-cover" onerror="this.style.display='none'">` : `<svg class="w-4 h-4 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9"/></svg>`}
              </div>
              <div class="min-w-0 flex-1">
                <h4 class="font-serif font-bold text-xs text-[#302C2A] truncate" title="${esc(b.name)}">${esc(b.name)}</h4>
                <p class="text-[10px] text-[#6E6864] truncate">${peso(priceEach)} each</p>
              </div>
            </div>
            <div class="text-right shrink-0">
              <span class="font-mono font-bold text-xs text-[#647D69]">${qty} sold</span>
              <span class="block text-[10px] text-[#6E6864] font-mono">${peso(b.revenue || (qty * priceEach))}</span>
            </div>
          </div>
          <div class="w-full bg-[#EBF1EC] rounded-full h-1.5 overflow-hidden">
            <div class="bg-gradient-to-r from-[#B76E79] to-[#647D69] h-1.5 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  renderDashboardInventoryOverview(inv = {}) {
    const inStockEl = document.getElementById('dashboard-inventory-instock-count');
    const lowStockEl = document.getElementById('dashboard-inventory-lowstock-count');
    const outStockEl = document.getElementById('dashboard-inventory-outofstock-count');
    const thresholdNote = document.getElementById('dashboard-inventory-threshold-note');
    const alertsContainer = document.getElementById('dashboard-stock-alerts-list');

    if (inStockEl) inStockEl.innerText = inv.inStock ?? 0;
    if (lowStockEl) lowStockEl.innerText = inv.lowStock ?? 0;
    if (outStockEl) outStockEl.innerText = inv.outOfStock ?? 0;
    if (thresholdNote) thresholdNote.innerText = inv.threshold ?? 20;

    if (alertsContainer) {
      const items = inv.alertItems || [];
      if (!items.length) {
        alertsContainer.innerHTML = `
          <div class="p-6 text-center text-xs text-[#6E6864] italic bg-[#FFF9F5] rounded-xl border border-[#E5ECE6]/60">
            All inventory items are currently healthy and above alert threshold.
          </div>
        `;
      } else {
        alertsContainer.innerHTML = items.slice(0, 10).map(item => {
          const isOut = item.status === 'out_of_stock' || (item.stockCount || 0) <= 0;
          return `
            <div class="flex items-center justify-between p-2.5 rounded-xl bg-[#FFF9F5] border border-[#E5ECE6]/80 hover:border-[#647D69]/40 transition">
              <div class="min-w-0 pr-2">
                <span class="font-medium text-[#302C2A] text-xs block truncate" title="${esc(item.name)}">${esc(item.name)}</span>
                <span class="text-[10px] text-[#6E6864] block">${esc(item.category || 'Item')}</span>
              </div>
              <div class="text-right shrink-0">
                <span class="font-mono font-bold text-xs ${isOut ? 'text-rose-700' : 'text-amber-800'}">${item.stockCount || 0} ${esc(item.unitOfMeasure || 'units')}</span>
                <span class="block text-[9px] uppercase font-bold ${isOut ? 'text-rose-600' : 'text-amber-700'}">${isOut ? 'Out of Stock' : 'Low Stock'}</span>
              </div>
            </div>
          `;
        }).join('');
      }
    }
  }

  navigateToPendingOrders() {
    this.switchTab('orders');
    const statusFilter = document.getElementById('orders-status-filter');
    if (statusFilter) {
      statusFilter.value = 'pending';
      this.handleOrderStatusFilter('pending');
    }
  }

  navigateToLowStock() {
    this.switchTab('store');
    const stockFilter = document.getElementById('store-stock-filter');
    if (stockFilter) {
      stockFilter.value = 'low';
      this.handleStoreStockFilter('low');
    }
  }

  renderDashboardRecentOrders(ordersList) {
    const tbody = document.getElementById('dashboard-recent-orders-tbody');
    if (!tbody) return;

    const list = Array.isArray(ordersList) ? ordersList : (this.orders ? this.orders.slice(0, 5) : []);
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-[#6E6864] italic text-xs">No recent customer orders found.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.slice(0, 5).map(o => `
      <tr class="hover:bg-[#FFF9F5] transition-colors duration-150">
        <td class="py-2.5 px-3 font-mono font-bold text-[#333038]">${esc(o.orderNumber)}</td>
        <td class="py-2.5 px-3 font-medium text-[#333038]">${esc(o.customerName || (o.firstName + ' ' + (o.lastName || '')).trim())}</td>
        <td class="py-2.5 px-3 text-[#6E6864] text-[11px]">${esc(o.dateFormatted || o.date || '—')}</td>
        <td class="py-2.5 px-3 font-mono font-bold text-[#333038] text-right tabular-nums">${peso(o.total)}</td>
        <td class="py-2.5 px-3">${this.tableOrderStatusText(o.status)}</td>
        <td class="py-2.5 px-3 text-right whitespace-nowrap">
          ${this.renderOrdersActionButtons(o, 'recent-')}
        </td>
      </tr>
    `).join('');
  }

  renderDashboardSecondary(s) {
    // Retained for backward-compatibility
  }

  renderDashboardStockAlerts(alerts) {
    // Retained for backward-compatibility
  }

  // =========================================================================
  // SCREEN 2: ORDERS MANAGEMENT
  // =========================================================================
  async loadOrders() {
    const res = await this.apiRequest('/api/admin/orders?limit=300');
    if (!res.ok) return;
    this.orders = res.data.orders || [];
    this.renderFilterChips();
    this.renderOrdersTable();
    this.renderDashboardRecentOrders();

    const pending = this.orders.filter(o => o.status === 'Pending Confirmation').length;
    const badge = document.getElementById('sidebar-pending-badge');
    if (badge) {
      badge.innerText = pending;
      if (pending > 0) badge.classList.remove('hidden');
      else badge.classList.add('hidden');
    }
    this.updateNotificationBadge();
  }

  renderOrderStatusCards() {
    const container = document.getElementById('order-status-filter-cards') || document.getElementById('order-status-filter-chips');
    if (!container) return;

    const allCount = this.orders.length;
    const pendingCount = this.orders.filter(o => o.status === 'Pending Confirmation').length;
    const inProgressCount = this.orders.filter(o => ADMIN_ACTIVE_STATUSES().includes(o.status)).length;
    const completedCount = this.orders.filter(o => ADMIN_DONE_STATUSES().includes(o.status)).length;
    const cancelledCount = this.orders.filter(o => o.status === 'Rejected/Cancelled').length;

    container.innerHTML = [
      this.kpiCardHTML({
        id: 'order-kpi-all',
        label: 'All Orders',
        value: allCount,
        subtext: 'All atelier orders',
        iconBg: 'bg-[#EBF1EC]',
        iconColor: 'text-[#647D69]',
        iconSvg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>'
      }),
      this.kpiCardHTML({
        id: 'order-kpi-pending',
        label: 'Pending',
        value: pendingCount,
        subtext: 'Awaiting confirmation',
        iconBg: 'bg-[#FEF3C7]',
        iconColor: 'text-[#D97706]',
        iconSvg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'
      }),
      this.kpiCardHTML({
        id: 'order-kpi-in_progress',
        label: 'In Progress',
        value: inProgressCount,
        subtext: 'Atelier & transit',
        iconBg: 'bg-[#E0F2FE]',
        iconColor: 'text-[#0284C7]',
        iconSvg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>'
      }),
      this.kpiCardHTML({
        id: 'order-kpi-completed',
        label: 'Completed',
        value: completedCount,
        subtext: 'Delivered & picked up',
        iconBg: 'bg-[#DCFCE7]',
        iconColor: 'text-[#166534]',
        iconSvg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>'
      }),
      this.kpiCardHTML({
        id: 'order-kpi-cancelled',
        label: 'Cancelled',
        value: cancelledCount,
        subtext: 'Declined or voided',
        iconBg: 'bg-[#FEE2E2]',
        iconColor: 'text-[#DC2626]',
        iconSvg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>'
      })
    ].join('');
  }

  renderFilterChips() {
    this.renderOrderStatusCards();
  }

  handleOrderStatusFilter(val) {
    this.currentStatusFilter = val || 'all';
    this.orderStatusFilter = this.currentStatusFilter;
    this.pagination.orders.page = 1;
    this.renderOrdersTable();
  }

  setStatusFilter(filter) {
    this.currentStatusFilter = filter || 'all';
    this.orderStatusFilter = this.currentStatusFilter;
    const statusSelect = document.getElementById('orders-status-filter');
    if (statusSelect) statusSelect.value = this.currentStatusFilter;
    this.pagination.orders.page = 1;
    this.renderOrdersTable();
  }

  handleOrderSearch(val) {
    this.searchQuery = (val || '').toLowerCase().trim();
    this.pagination.orders.page = 1;
    this.renderOrdersTable();
  }

  handleOrderFulfillmentFilter(val) {
    this.orderFulfillmentFilter = val || 'all';
    this.pagination.orders.page = 1;
    this.renderOrdersTable();
  }

  handleOrderDateFilter(val) {
    this.orderDateFilter = val || 'all';
    const customBox = document.getElementById('orders-custom-date-box');
    if (customBox) {
      if (this.orderDateFilter === 'custom') {
        customBox.classList.remove('hidden');
        const startEl = document.getElementById('orders-custom-start');
        const endEl = document.getElementById('orders-custom-end');
        if (startEl && !startEl.value) {
          const d = new Date();
          d.setDate(d.getDate() - 7);
          startEl.value = d.toISOString().slice(0, 10);
        }
        if (endEl && !endEl.value) {
          endEl.value = new Date().toISOString().slice(0, 10);
        }
        this.orderCustomStart = startEl ? startEl.value : '';
        this.orderCustomEnd = endEl ? endEl.value : '';
      } else {
        customBox.classList.add('hidden');
      }
    }
    this.pagination.orders.page = 1;
    this.renderOrdersTable();
  }

  handleOrderCustomDateChange() {
    this.orderCustomStart = document.getElementById('orders-custom-start')?.value || '';
    this.orderCustomEnd = document.getElementById('orders-custom-end')?.value || '';
    this.pagination.orders.page = 1;
    this.renderOrdersTable();
  }

  clearOrderFilters() {
    this.searchQuery = '';
    this.currentStatusFilter = 'all';
    this.orderStatusFilter = 'all';
    this.orderFulfillmentFilter = 'all';
    this.orderDateFilter = 'all';
    this.orderCustomStart = '';
    this.orderCustomEnd = '';
    this.pagination.orders.page = 1;

    const searchInput = document.getElementById('orders-search-input');
    if (searchInput) searchInput.value = '';
    const statusSelect = document.getElementById('orders-status-filter');
    if (statusSelect) statusSelect.value = 'all';
    const fulSelect = document.getElementById('orders-fulfillment-filter');
    if (fulSelect) fulSelect.value = 'all';
    const dateSelect = document.getElementById('orders-date-filter');
    if (dateSelect) dateSelect.value = 'all';
    const customBox = document.getElementById('orders-custom-date-box');
    if (customBox) customBox.classList.add('hidden');
    const startEl = document.getElementById('orders-custom-start');
    if (startEl) startEl.value = '';
    const endEl = document.getElementById('orders-custom-end');
    if (endEl) endEl.value = '';

    this.renderOrdersTable();
  }

  statusBadge(status, order) {
    const s = String(status || '').trim();
    const how = order && order.customerConfirmationStatus;
    if (s === 'Delivery Attempt Failed') {
      return `
        <div class="inline-flex flex-col items-start">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFEDD5] text-[#9A3412] border border-[#FED7AA] whitespace-nowrap">Delivery Failed</span>
          <span class="text-[10px] text-orange-800 mt-0.5 font-semibold">Re-attempt or cancel</span>
        </div>
      `;
    }
    if ((s === 'Delivered — Confirmed' || s === 'Picked Up') && (how === 'auto' || how === 'resolved')) {
      return `
        <div class="inline-flex flex-col items-start">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0] whitespace-nowrap">Completed</span>
          <span class="text-[10px] text-[#6E6864] mt-0.5 font-normal">${how === 'auto' ? 'Auto-confirmed (no response)' : 'Resolved by shop'}</span>
        </div>
      `;
    }
    if (s === 'Pending Confirmation') {
      return `
        <div class="inline-flex flex-col items-start">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] whitespace-nowrap">Pending</span>
          <span class="text-[10px] text-[#6E6864] mt-0.5 font-normal">Awaiting Confirmation</span>
        </div>
      `;
    }
    if (s === 'Delivered — Awaiting Confirmation') {
      return `
        <div class="inline-flex flex-col items-start">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] whitespace-nowrap">Delivered (Awaiting Conf.)</span>
          <span class="text-[10px] text-amber-700 mt-0.5 font-normal">Customer review pending</span>
        </div>
      `;
    }
    if (s === 'Delivered — Confirmed') {
      return `
        <div class="inline-flex flex-col items-start">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0] whitespace-nowrap">Confirmed Delivered</span>
          <span class="text-[10px] text-emerald-700 mt-0.5 font-normal">Customer confirmed receipt</span>
        </div>
      `;
    }
    if (s === 'Awaiting Customer Confirmation') {
      return `
        <div class="inline-flex flex-col items-start">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] whitespace-nowrap">Handed Over (Awaiting Conf.)</span>
          <span class="text-[10px] text-amber-700 mt-0.5 font-normal">Customer confirmation pending</span>
        </div>
      `;
    }
    if (s === 'Pickup Disputed') {
      return `
        <div class="inline-flex flex-col items-start">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] whitespace-nowrap">Pickup Disputed</span>
          <span class="text-[10px] text-rose-700 mt-0.5 font-bold">Investigation Required</span>
        </div>
      `;
    }
    if (s === 'Delivery Disputed') {
      return `
        <div class="inline-flex flex-col items-start">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] whitespace-nowrap animate-pulse">Delivery Disputed</span>
          <span class="text-[10px] text-rose-700 mt-0.5 font-bold">Investigation Required</span>
        </div>
      `;
    }
    if (s === 'Confirmed' || s === 'Preparing' || s === 'Rider Assigned' || s === 'On the Way' || s === 'Ready for Pickup' || s === 'Out for Delivery') {
      return `
        <div class="inline-flex flex-col items-start">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF2FF] text-[#3730A3] border border-[#E0E7FF] whitespace-nowrap">In Progress</span>
          <span class="text-[10px] text-[#6E6864] mt-0.5 font-normal">${esc(s)}</span>
        </div>
      `;
    }
    if (s === 'Delivered' || s === 'Picked Up') {
      return `
        <div class="inline-flex flex-col items-start">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0] whitespace-nowrap">Completed</span>
          <span class="text-[10px] text-[#6E6864] mt-0.5 font-normal">${esc(s)}</span>
        </div>
      `;
    }
    if (s === 'Rejected/Cancelled' || s.toLowerCase().includes('cancel')) {
      return `
        <div class="inline-flex flex-col items-start">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA] whitespace-nowrap">Cancelled</span>
        </div>
      `;
    }
    return `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-stone-100 text-stone-700 whitespace-nowrap">${esc(s)}</span>`;
  }

  tableOrderStatusText(status) {
    const s = String(status || '').trim();
    if (s === 'Pending Confirmation') {
      return '<span class="text-amber-800 font-semibold text-xs">Pending</span>';
    }
    if (s === 'Delivered — Awaiting Confirmation' || s === 'Awaiting Customer Confirmation') {
      return '<span class="text-amber-800 font-semibold text-xs">Awaiting Conf.</span>';
    }
    if (s === 'Pickup Disputed' || s === 'Delivery Disputed') {
      return '<span class="text-rose-700 font-semibold text-xs">' + esc(s) + '</span>';
    }
    if (s === 'Delivered — Confirmed' || s === 'Delivered' || s === 'Picked Up') {
      return '<span class="text-emerald-700 font-semibold text-xs">Completed</span>';
    }
    if (s === 'Confirmed' || s === 'Preparing' || s === 'Ready for Pickup') {
      return '<span class="text-[#344F3B] font-semibold text-xs">' + esc(s) + '</span>';
    }
    if (s === 'Rider Assigned' || s === 'On the Way' || s === 'Out for Delivery') {
      return '<span class="text-sky-800 font-semibold text-xs">' + esc(s) + '</span>';
    }
    if (s === 'Delivery Attempt Failed') {
      return '<span class="text-orange-800 font-semibold text-xs">Delivery Failed</span>';
    }
    if (s.toLowerCase().includes('cancel') || s.toLowerCase().includes('reject')) {
      return '<span class="text-rose-700 font-semibold text-xs">Cancelled</span>';
    }
    return '<span class="text-[#302C2A] font-medium text-xs">' + esc(s) + '</span>';
  }

  fulfillmentBadge(fulfillment, district = null) {
    const isDelivery = String(fulfillment || 'delivery').toLowerCase() === 'delivery';
    if (isDelivery) {
      return `<span class="status-text status-text--neutral">Delivery</span>${district ? `<span class="status-text__sub">District ${esc(district)}</span>` : ''}`;
    }
    return '<span class="status-text status-text--neutral">Store Pickup</span><span class="status-text__sub">BGC Counter</span>';
  }


  stockStatusBadge(stock, threshold = null, availability = null) {
    const s = Number(stock) || 0;
    const thresh = threshold != null ? Number(threshold) : this.getGlobalLowStockThreshold();
    const isSoldOut = s <= 0 || availability === 'sold_out';
    const isLow = s > 0 && s <= thresh;
    if (isSoldOut) return '<span class="status-text status-text--danger">Out of Stock</span>';
    if (isLow) return '<span class="status-text status-text--warning">Low Stock</span>';
    return '<span class="status-text status-text--success">In Stock</span>';
  }


  availabilityBadge(isAvail) {
    return isAvail ? '<span class="status-text status-text--success">Available</span>' : '<span class="status-text status-text--muted">Unavailable</span>';
  }


  supplierStatusBadge(isActive) {
    return isActive ? '<span class="status-text status-text--success">Active</span>' : '<span class="status-text status-text--muted">Inactive</span>';
  }


  customerAuthBadge(isGoogle) {
    return isGoogle ? '<span class="status-text status-text--neutral">Google</span>' : '<span class="status-text status-text--neutral">Email</span>';
  }


  renderOrdersTable() {
    const tbody = document.getElementById('admin-orders-tbody');
    const emptyState = document.getElementById('orders-empty-state');
    if (!tbody) return;

    // Clear Filters only while a search or filter is applied
    const ordersClearBtn = document.getElementById('orders-clear-filters-btn');
    if (ordersClearBtn) {
      const st = this.orderStatusFilter || this.currentStatusFilter || 'all';
      const active = Boolean(this.searchQuery) || st !== 'all' || (this.orderFulfillmentFilter || 'all') !== 'all' || (this.orderDateFilter || 'all') !== 'all';
      ordersClearBtn.classList.toggle('filters-clear-hidden', !active);
    }

    let filtered = this.orders;

    // Status Filter Grouping (Pending, In Progress, Completed, Cancelled)
    const status = this.orderStatusFilter || this.currentStatusFilter || 'all';
    if (status === 'pending') {
      filtered = filtered.filter(o => o.status === 'Pending Confirmation');
    } else if (status === 'in_progress') {
      filtered = filtered.filter(o => ADMIN_ACTIVE_STATUSES().includes(o.status));
    } else if (status === 'completed') {
      filtered = filtered.filter(o => ADMIN_DONE_STATUSES().includes(o.status));
    } else if (status === 'cancelled') {
      filtered = filtered.filter(o => o.status === 'Rejected/Cancelled');
    } else if (status === 'payment_review') {
      filtered = filtered.filter(o => o.paymentStatus === 'Pending Verification');
    } else if (status === 'unpaid') {
      filtered = filtered.filter(o => o.paymentStatus !== 'Paid' && o.status !== 'Rejected/Cancelled');
    }

    // Fulfillment Filter
    if (this.orderFulfillmentFilter && this.orderFulfillmentFilter !== 'all') {
      filtered = filtered.filter(o => o.fulfillment === this.orderFulfillmentFilter);
    }

    // Date Filter
    if (this.orderDateFilter && this.orderDateFilter !== 'all') {
      const now = new Date();
      const tz = (this.shopSettings?.store?.timezone) || 'Asia/Manila';
      let todayStr = '';
      try {
        todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now);
      } catch (_) {
        todayStr = now.toISOString().slice(0, 10);
      }
      filtered = filtered.filter(o => {
        let orderDateStr = '';
        try {
          const raw = o.createdAt || o.created_at || o.date;
          if (raw) {
            orderDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(raw));
          }
        } catch (_) {
          orderDateStr = (o.date || (o.createdAt ? o.createdAt.slice(0, 10) : ''));
        }
        if (!orderDateStr && o.date) orderDateStr = String(o.date).slice(0, 10);
        const orderTs = new Date(o.createdAt || o.date || 0).getTime();
        if (this.orderDateFilter === 'today') {
          return orderDateStr === todayStr || (o.createdAt && o.createdAt.slice(0, 10) === todayStr);
        } else if (this.orderDateFilter === 'week') {
          return Date.now() - orderTs <= 7 * 864e5;
        } else if (this.orderDateFilter === 'month') {
          const d = new Date(o.createdAt || o.date || 0);
          return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        } else if (this.orderDateFilter === 'custom') {
          if (this.orderCustomStart && orderDateStr < this.orderCustomStart) return false;
          if (this.orderCustomEnd && orderDateStr > this.orderCustomEnd) return false;
          return true;
        }
        return true;
      });
    }

    // Search Query
    if (this.searchQuery) {
      filtered = filtered.filter(o =>
        (o.orderNumber || '').toLowerCase().includes(this.searchQuery) ||
        (o.firstName || '').toLowerCase().includes(this.searchQuery) ||
        (o.lastName || '').toLowerCase().includes(this.searchQuery) ||
        (o.phone || '').includes(this.searchQuery) ||
        (o.address || '').toLowerCase().includes(this.searchQuery)
      );
    }

    if (!filtered.length) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      this.renderPagination('orders', 0);
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    const totalRecords = filtered.length;
    const pag = this.pagination.orders;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pag.pageSize));
    if (pag.page > totalPages) pag.page = totalPages;
    if (pag.page < 1) pag.page = 1;

    const start = (pag.page - 1) * pag.pageSize;
    const sliced = filtered.slice(start, start + pag.pageSize);

    tbody.innerHTML = sliced.map(o => {
      const isDelivery = o.fulfillment === 'delivery';
      const itemCount = (o.items || []).reduce((acc, i) => acc + (Number(i.quantity) || 1), 0);
      const itemsSummary = (o.items || []).map(i => `${i.quantity}× ${i.name}`).join(', ');

      return `
        <tr class="hover:bg-[#EBF1EC] transition-colors duration-150">
          <td class="py-3 px-4 font-mono font-bold text-[#302C2A]">${esc(o.orderNumber)}</td>
          <td class="py-3 px-4">
            <button type="button" onclick="window.adminApp.openOrderCustomerProfile('${esc(o.orderNumber)}')" class="font-bold text-[#302C2A] hover:text-[#647D69] hover:underline text-left block leading-snug">
              ${esc(o.firstName)} ${esc(o.lastName)}
            </button>
          </td>
          <td class="py-3 px-4">
            <div class="font-medium text-[#302C2A] text-xs">${isDelivery ? 'Delivery' : 'Store Pickup'}</div>
            ${o.district ? `<div class="text-[11px] text-[#6E6864]">District ${esc(o.district)}</div>` : (!isDelivery ? '<div class="text-[11px] text-[#6E6864]">BGC Counter</div>' : '')}
          </td>
          <td class="py-3 px-4">
            <span class="text-[#302C2A] font-medium">${esc(o.date)}</span>
            <span class="block text-[11px] text-[#6E6864]">${esc(o.time)}</span>
          </td>
          <td class="py-3 px-4 max-w-xs">
            <div class="font-medium text-[#302C2A] text-xs">${itemCount} ${itemCount === 1 ? 'item' : 'items'}</div>
            <p class="text-[#6E6864] text-[11px] truncate max-w-[180px] mt-0.5" title="${esc(itemsSummary)}">${esc(itemsSummary || '—')}</p>
          </td>
          <td class="py-3 px-4 font-mono font-bold text-[#302C2A] text-right tabular-nums">${peso(o.total)}</td>
          <td class="py-3 px-4">${this.tableOrderStatusText(o.status)}${typeof this.paymentStatusPill === 'function' ? this.paymentStatusPill(o) : ''}</td>
          <td class="py-3 px-4 text-right whitespace-nowrap">
            ${this.renderOrdersActionButtons(o)}
          </td>
        </tr>
      `;
    }).join('');

    this.renderPagination('orders', totalRecords);
  }

  // A custom bouquet is saved as one row per component (same rule as the server reports and customer pages).
  isCustomComponentItem(i) {
    if (!i || !i.bouquetName || i.type === 'ready_bouquet') return false;
    if (['filler', 'greenery', 'foliage', 'wrapping', 'ribbon', 'card'].includes(i.type)) return true;
    return i.type === 'flower' && i.bouquetName !== i.name;
  }

  orderItemTypeLabel(type) {
    return ({ ready_bouquet: 'Ready-Made Bouquet', flower: 'Fresh Flower', filler: 'Filler & Foliage', foliage: 'Filler & Foliage',
      greenery: 'Filler & Foliage', wrapping: 'Wrapping', ribbon: 'Ribbon', card: 'Greeting Card' })[type] || type || '';
  }

  // Greeting-card / bouquet messages the florist must write. These live on the order lines (one per bouquet).
  orderCardMessagesHTML(order) {
    const seen = new Set();
    const msgs = [];
    for (const i of (order.items || [])) {
      const msg = String(i.cardMessage || '').trim();
      if (!msg) continue;
      const label = this.isCustomComponentItem(i) ? `Custom bouquet: ${i.bouquetName}` : (i.name || 'Item');
      const key = label + '|' + msg;
      if (seen.has(key)) continue;
      seen.add(key);
      msgs.push({ label, msg });
    }
    if (!msgs.length) return '';
    return `
      <div class="p-3.5 rounded-xl bg-[#FFF9F5] border border-[#E5ECE6] text-[#302C2A] space-y-2">
        <strong class="font-serif block text-xs">Greeting Card Message${msgs.length > 1 ? 's' : ''} to Write:</strong>
        ${msgs.map(m => `<div><span class="block text-[10px] font-bold uppercase tracking-wider text-[#6E6864]">${esc(m.label)}</span><p class="italic font-serif text-xs">"${esc(m.msg)}"</p></div>`).join('')}
      </div>`;
  }

  // --- Order Details Modal ---
  openOrderDetail(orderNum) {
    const order = this.orders.find(o => o.orderNumber === orderNum);
    if (!order) return;
    this.currentDetailOrderNumber = orderNum;

    const modal = document.getElementById('admin-order-modal');
    const content = document.getElementById('admin-order-modal-content');
    if (!modal || !content) return;

    const isDelivery = order.fulfillment === 'delivery';
    const isPending = order.status === 'Pending Confirmation';
    const isDelivered = ADMIN_DONE_STATUSES().includes(order.status);
    const isCancelled = order.status === 'Rejected/Cancelled';
    const canConfirm = this.canConfirmOrder(order);
    const gateConfirmMsg = this.getOrderPaymentGateMessage(order, 'confirming');
    const gatePrepMsg = this.getOrderPaymentGateMessage(order, 'starting preparation for');

    content.innerHTML = `
      <div class="space-y-6 text-xs text-[#302C2A]">
        <!-- Order Header -->
        <div class="border-b border-[#E5ECE6] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span class="font-mono text-[11px] font-bold text-burgundy-700">Order Reference</span>
            <h2 class="font-serif font-bold text-2xl text-[#302C2A]">${esc(order.orderNumber)}</h2>
            <p class="text-[11px] text-[#6E6864]">Placed on ${new Date(order.createdAt || Date.now()).toLocaleString()}</p>
          </div>
          <div class="flex items-center gap-2">
            ${this.statusBadge(order.status, order)}
          </div>
        </div>

        <!-- Order Information Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Customer & Contact Info -->
          <div class="p-4 rounded-2xl bg-[#FFF9F5] border border-[#E5ECE6] space-y-2">
            <span class="font-bold text-[#6E6864] text-[10px] uppercase tracking-wider block">Recipient Contact</span>
            <p class="font-bold text-[#302C2A] text-sm">${esc(order.firstName)} ${esc(order.lastName)}</p>
            <p class="font-mono text-[#302C2A]">${esc(order.phone)}</p>
            <p class="text-[#6E6864]">${esc(order.email)}</p>
          </div>

          <!-- Schedule & Fulfillment -->
          <div class="p-4 rounded-2xl bg-[#FFF9F5] border border-[#E5ECE6] space-y-2">
            <span class="font-bold text-[#6E6864] text-[10px] uppercase tracking-wider block">Fulfillment Schedule</span>
            <p class="font-bold text-[#302C2A] flex items-center gap-1.5">
              ${isDelivery ? `
                <span>Manila Delivery</span>
              ` : `
                <span>Store Pickup</span>
              `}
            </p>
            <p class="text-[#302C2A]"><strong>Target Date:</strong> ${esc(order.date)} (${esc(order.time)})</p>
            ${isDelivery ? `
              <p class="text-[#302C2A]"><strong>Address:</strong> ${esc(order.address || '')}${order.barangay ? ', ' + esc(order.barangay) : ''}, ${esc(order.city || 'Manila')}${order.district ? ` (District ${esc(order.district)})` : ''}</p>
              ${order.notes ? `<p class="italic text-[#6E6864] text-[11px]">Rider Notes: "${esc(order.notes)}"</p>` : ''}
            ` : `
              <p class="text-[#6E6864]">Pickup Counter: <span>${esc(this.shopSettings?.pickup?.address || this.shopSettings?.store?.address || '128 Rosa Street, BGC, Taguig')}</span></p>
            `}
          </div>
        </div>

        ${order.giftMessage ? `
          <div class="p-3.5 rounded-xl bg-[#FFF0E8] border border-[#F5D2C1] text-[#4A0E1C]">
            <strong class="font-serif block text-xs mb-1">${isDelivery ? 'Delivery Instructions (from customer):' : 'Order Instructions (from customer):'}</strong>
            <p class="italic font-serif text-xs">"${esc(order.giftMessage)}"</p>
          </div>
        ` : ''}
        ${this.orderCardMessagesHTML(order)}

        <!-- Items Table -->
        <div class="border border-[#E5ECE6] rounded-2xl overflow-hidden bg-[#FFFFFF]">
          <table class="admin-data-table w-full text-left text-xs">
            <thead class="bg-[#FFF9F5] border-b border-[#E5ECE6] text-[#6E6864] text-[10px] uppercase font-bold">
              <tr>
                <th class="py-2.5 px-4">Item</th>
                <th class="py-2.5 px-4">Type</th>
                <th class="py-2.5 px-4">Quantity</th>
                <th class="py-2.5 px-4">Unit Price</th>
                <th class="py-2.5 px-4 text-right">Line Total</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[#E5ECE6]">
              ${(order.items || []).map(i => `
                <tr class="hover:bg-[#EBF1EC] transition-colors duration-150">
                  <td class="py-3 px-4 font-bold text-[#302C2A]">${esc(i.name)}${this.isCustomComponentItem(i) ? `<span class="block text-[10px] font-semibold text-[#647D69]">Part of custom bouquet: ${esc(i.bouquetName)}</span>` : ''}</td>
                  <td class="py-3 px-4 text-[#6E6864] text-[11px]">${esc(this.orderItemTypeLabel(i.type))}</td>
                  <td class="py-3 px-4 font-mono tabular-nums text-[#302C2A]">${i.quantity}</td>
                  <td class="py-3 px-4 font-mono tabular-nums text-[#302C2A]">${peso(i.unitPrice)}</td>
                  <td class="py-3 px-4 font-mono font-bold text-[#302C2A] text-right tabular-nums">${peso(i.lineTotal)}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot class="bg-[#FFF9F5] border-t border-[#E5ECE6] text-xs font-semibold">
              <tr>
                <td colspan="4" class="py-2 px-4 text-right text-[#6E6864]">Subtotal:</td>
                <td class="py-2 px-4 font-mono text-right tabular-nums text-[#302C2A]">${peso(order.subtotal)}</td>
              </tr>
              <tr>
                <td colspan="4" class="py-1 px-4 text-right text-[#6E6864]">Delivery Fee:</td>
                <td class="py-1 px-4 font-mono text-right tabular-nums text-[#302C2A]">${peso(order.deliveryFee)}</td>
              </tr>
              <tr class="font-bold text-[#302C2A] text-sm">
                <td colspan="4" class="py-2.5 px-4 text-right">Total:</td>
                <td class="py-2.5 px-4 font-mono text-right text-[#647D69] tabular-nums">${peso(order.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <!-- Grab Courier Tracking Link (if delivery) -->
        ${isDelivery && !isCancelled ? `
          <div class="p-4 rounded-2xl bg-[#FFF9F5] border border-[#E5ECE6] space-y-2">
            <span class="font-bold text-[#302C2A] block text-xs">Grab Courier Live Tracking Reference</span>
            <div class="flex gap-2">
              <input type="url" id="order-grab-tracking-input" value="${esc(order.grabTrackingUrl || '')}" placeholder="https://grab.com/tracking/..." class="flex-1 px-3 py-1.5 text-xs bg-[#FFFFFF] border border-[#E5ECE6] rounded-xl focus:ring-2 focus:ring-burgundy-700 text-[#302C2A] font-mono">
              <button type="button" onclick="window.adminApp.saveGrabLink('${esc(order.orderNumber)}')" class="btn-tactile px-4 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-900 text-white font-medium text-xs transition">
                Save Tracking Link
              </button>
            </div>
            ${order.grabTrackingUrl ? `<a href="${esc(order.grabTrackingUrl)}" target="_blank" class="text-[11px] font-bold text-burgundy-700 hover:underline block pt-1">Open verified courier tracking page ↗</a>` : ''}
          </div>
        ` : ''}

        <!-- Proof of Delivery (POD) & Customer Confirmation Section -->
        ${order.podPhotoUrl ? `
          <div class="p-4 rounded-2xl bg-[#FFF9F5] border border-[#E5ECE6] space-y-3">
            <div class="flex items-center justify-between border-b border-[#E5ECE6] pb-2.5">
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full bg-[#647D69]"></span>
                <span class="font-bold text-[#302C2A] text-xs">Proof of Delivery (POD)</span>
              </div>
              <span class="text-[11px] text-[#6E6864]">Delivered ${new Date(order.podDeliveredAt || Date.now()).toLocaleString()}</span>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
              <div class="relative group cursor-pointer overflow-hidden rounded-xl border border-[#E5ECE6] bg-stone-100 aspect-4/3" onclick="window.adminApp.openPodLightbox('${esc(order.podPhotoUrl)}', 'Order #${esc(order.orderNumber)} POD Photo', 'Recorded handover by ${esc(order.podAdmin || 'Admin')}')">
                <img src="${esc(order.podPhotoUrl)}" alt="POD" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                <div class="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-[11px] font-bold gap-1">
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg>
                  <span>Enlarge</span>
                </div>
              </div>
              <div class="sm:col-span-2 space-y-2">
                <p class="text-xs text-[#302C2A]"><strong>Responsible Admin:</strong> <span class="text-[#6E6864]">${esc(order.podAdmin || 'Admin')}</span></p>
                ${order.podNotes ? `<p class="text-xs text-[#302C2A]"><strong>Delivery Notes:</strong> <span class="text-[#6E6864]">${esc(order.podNotes)}</span></p>` : ''}

                <!-- Customer Confirmation State -->
                <div class="pt-2">
                  <span class="font-bold text-[10px] text-[#6E6864] uppercase tracking-wider block mb-1">Customer Receipt Confirmation</span>
                  ${order.customerConfirmationStatus === 'confirmed' ? `
                    <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                      <svg class="w-4 h-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>
                      <div>
                        <strong>Customer Confirmed Receipt</strong>
                        <div class="text-[11px] text-emerald-700">Confirmed on ${new Date(order.customerConfirmedAt || Date.now()).toLocaleString()}</div>
                      </div>
                    </div>
                  ` : order.customerConfirmationStatus === 'disputed' ? `
                    <div class="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-1.5 font-bold text-rose-800">
                          <svg class="w-4 h-4 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                          <span>Customer Reported NOT Received / Disputed</span>
                        </div>
                        <button type="button" onclick="window.adminApp.openResolveDisputeModal('${esc(order.orderNumber)}')" class="btn-tactile px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-xs transition">
                          Resolve Dispute
                        </button>
                      </div>
                      <p class="text-[11px] text-rose-800"><strong>Customer's Reason:</strong> ${esc(order.customerDisputeReason || 'No reason provided')}</p>
                      ${order.customerDisputePhotoUrl ? `
                        <div class="flex items-center gap-2 pt-1">
                          <span class="text-[11px] text-[#6E6864]">Customer's Photo:</span>
                          <button type="button" onclick="window.adminApp.openPodLightbox('${esc(order.customerDisputePhotoUrl)}', 'Customer Dispute Photo', 'Reported issue evidence')" class="text-[11px] font-bold text-burgundy-700 hover:underline">View Photo</button>
                        </div>
                      ` : ''}
                    </div>
                  ` : order.customerConfirmationStatus === 'auto' ? `
                    <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                      <strong>Confirmed Automatically</strong>
                      <div class="text-[11px] text-emerald-700">The customer did not answer within the deadline · ${new Date(order.customerConfirmedAt || Date.now()).toLocaleString()}</div>
                    </div>
                  ` : order.customerConfirmationStatus === 'resolved' ? `
                    <div class="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1">
                      <div class="font-bold text-emerald-800">Dispute Resolved by Admin</div>
                      <p class="text-[11px] text-emerald-700"><strong>Notes:</strong> ${esc(order.disputeResolutionNotes || 'Resolved')} (${new Date(order.disputeResolvedAt || Date.now()).toLocaleString()})</p>
                    </div>
                  ` : `
                    <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                      <span class="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                      <span>Awaiting customer receipt verification. Customer has been notified.</span>
                    </div>
                  `}
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        ${typeof this.pickupConfirmationHTML === 'function' ? this.pickupConfirmationHTML(order) : ''}

        ${order.rejectReason ? `
          <div class="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs">
            <strong>Cancellation Notice:</strong> ${esc(order.rejectReason)}
          </div>
        ` : ''}

        <!-- Order Workflow Actions -->
        <div class="pt-4 border-t border-[#E5ECE6] flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap items-center gap-2">
            ${isPending ? `
              ${canConfirm ? `
                <button type="button" onclick="window.adminApp.confirmOrder('${esc(order.orderNumber)}')" class="btn-tactile py-2.5 px-5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-serif font-bold text-xs shadow-xs transition">
                  Confirm Order
                </button>
              ` : `
                <button type="button" disabled title="${esc(gateConfirmMsg)}" class="btn-tactile py-2.5 px-5 rounded-xl bg-emerald-800/40 text-white/70 font-serif font-bold text-xs shadow-xs cursor-not-allowed opacity-60">
                  Confirm Order (Verify Payment First)
                </button>
              `}
              <button type="button" onclick="window.adminApp.rejectOrderPrompt('${esc(order.orderNumber)}')" class="btn-tactile py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-serif font-bold text-xs transition border border-red-200">
                Cancel order
              </button>
            ` : ''}

            ${order.status === 'Confirmed' ? `
              ${canConfirm ? `
                <button type="button" onclick="window.adminApp.updateStatus('${esc(order.orderNumber)}', 'Preparing')" class="btn-tactile py-2.5 px-4 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white font-serif font-bold text-xs shadow-xs transition">
                  Start Preparation
                </button>
              ` : `
                <button type="button" disabled title="${esc(gatePrepMsg)}" class="btn-tactile py-2.5 px-4 rounded-xl bg-[#647D69]/40 text-white/70 font-serif font-bold text-xs shadow-xs cursor-not-allowed opacity-60">
                  Start Preparation (Verify Payment First)
                </button>
              `}
              <button type="button" onclick="window.adminApp.rejectOrderPrompt('${esc(order.orderNumber)}')" class="btn-tactile py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-serif font-bold text-xs transition border border-red-200">
                Cancel order
              </button>
            ` : ''}

            ${((isPending || order.status === 'Confirmed') && !canConfirm) ? `
              <div class="w-full my-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <svg class="w-4 h-4 text-amber-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                  <span><strong>Payment verification required:</strong> ${esc(gateConfirmMsg)}</span>
                </div>
                ${order.paymentKind === 'online' ? `
                  <button type="button" onclick="window.adminApp.openPaymentReview('${esc(order.orderNumber)}')" class="px-3 py-1 rounded-lg bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs shadow-xs transition">
                    Review Payment
                  </button>
                ` : (order.paymentMethod === 'Cash on Pickup' ? `
                  <button type="button" onclick="window.adminApp.openCashConfirm('${esc(order.orderNumber)}')" class="px-3 py-1 rounded-lg bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition">
                    Confirm Cash Received
                  </button>
                ` : '')}
              </div>
            ` : ''}

            ${order.status === 'Preparing' ? (isDelivery ? `
              <button type="button" onclick="window.adminApp.updateStatus('${esc(order.orderNumber)}', 'Rider Assigned')" class="btn-tactile py-2.5 px-4 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white font-serif font-bold text-xs shadow-xs transition">
                Assign Grab Rider
              </button>
              <button type="button" onclick="window.adminApp.rejectOrderPrompt('${esc(order.orderNumber)}')" class="btn-tactile py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-serif font-bold text-xs transition border border-red-200">
                Cancel order
              </button>
            ` : `
              <button type="button" onclick="window.adminApp.updateStatus('${esc(order.orderNumber)}', 'Ready for Pickup')" class="btn-tactile py-2.5 px-4 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white font-serif font-bold text-xs shadow-xs transition">
                Mark Ready for Pickup
              </button>
              <button type="button" onclick="window.adminApp.rejectOrderPrompt('${esc(order.orderNumber)}')" class="btn-tactile py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-serif font-bold text-xs transition border border-red-200">
                Cancel order
              </button>
            `) : ''}

            ${order.status === 'Rider Assigned' ? `
              <button type="button" onclick="window.adminApp.updateStatus('${esc(order.orderNumber)}', 'On the Way')" class="btn-tactile py-2.5 px-4 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-serif font-bold text-xs shadow-xs transition">
                Dispatch / On the Way
              </button>
              <button type="button" onclick="window.adminApp.openPodModal('${esc(order.orderNumber)}')" class="btn-tactile py-2.5 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-serif font-bold text-xs shadow-xs transition flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span>Upload POD &amp; Mark Delivered</span>
              </button>
              <button type="button" onclick="window.adminApp.rejectOrderPrompt('${esc(order.orderNumber)}')" class="btn-tactile py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-serif font-bold text-xs transition border border-red-200">
                Cancel order
              </button>
            ` : ''}

            ${(order.status === 'On the Way' || order.status === 'Out for Delivery') ? `
              <button type="button" onclick="window.adminApp.openPodModal('${esc(order.orderNumber)}')" class="btn-tactile py-2.5 px-5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-serif font-bold text-xs shadow-xs transition flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                <span>Upload POD &amp; Mark Delivered</span>
              </button>
              <button type="button" onclick="window.adminApp.markDeliveryFailedPrompt('${esc(order.orderNumber)}')" class="btn-tactile py-2.5 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-serif font-bold text-xs transition border border-amber-200">
                Delivery Attempt Failed
              </button>
            ` : ''}

            ${order.status === 'Delivery Attempt Failed' ? `
              <button type="button" onclick="window.adminApp.updateStatus('${esc(order.orderNumber)}', 'Out for Delivery')" class="btn-tactile py-2.5 px-5 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-serif font-bold text-xs shadow-xs transition">
                Re-attempt Delivery
              </button>
              <button type="button" onclick="window.adminApp.rejectOrderPrompt('${esc(order.orderNumber)}')" class="btn-tactile py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 font-serif font-bold text-xs transition border border-red-200">
                Cancel order
              </button>
            ` : ''}

            ${order.status === 'Delivery Disputed' ? `
              <button type="button" onclick="window.adminApp.openResolveDisputeModal('${esc(order.orderNumber)}')" class="btn-tactile py-2.5 px-5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-serif font-bold text-xs shadow-xs transition">
                Investigate &amp; Resolve Dispute
              </button>
            ` : ''}

            ${order.status === 'Ready for Pickup' ? `
              <button type="button" onclick="window.adminApp.confirmPickupHandover('${esc(order.orderNumber)}')" class="btn-tactile py-2.5 px-5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-serif font-bold text-xs shadow-xs transition">
                Confirm Pickup
              </button>
            ` : ''}

            ${order.status === 'Pickup Disputed' ? `
              <button type="button" onclick="window.adminApp.openResolveDisputeModal('${esc(order.orderNumber)}')" class="btn-tactile py-2.5 px-5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-serif font-bold text-xs shadow-xs transition">
                Investigate &amp; Resolve Pickup Issue
              </button>
            ` : ''}
          </div>

          <button type="button" onclick="window.adminApp.closeOrderModal()" class="btn-tactile py-2 px-4 rounded-xl bg-[#EBF1EC] hover:bg-[#EBF1EC] text-[#6E6864] hover:text-[#647D69] hover:border-[#E5ECE6] border border-[#E5ECE6] font-serif font-bold text-xs transition">
            Close
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  closeOrderModal() {
    this.currentDetailOrderNumber = null;
    document.getElementById('admin-order-modal')?.classList.add('hidden');
  }

  // --- Proof of Delivery (POD) Handlers ---
  openPodModal(orderNum) {
    this.closeOrderModal();
    const modal = document.getElementById('admin-pod-modal');
    const orderInput = document.getElementById('pod-modal-order-number');
    const orderDisplay = document.getElementById('pod-modal-order-display');
    if (orderInput) orderInput.value = orderNum;
    if (orderDisplay) orderDisplay.textContent = orderNum;
    this.clearPodPhoto();
    const notes = document.getElementById('admin-pod-notes');
    if (notes) notes.value = '';
    if (modal) modal.classList.remove('hidden');
  }

  closePodModal() {
    const modal = document.getElementById('admin-pod-modal');
    if (modal) modal.classList.add('hidden');
    this.clearPodPhoto();
    if (this.currentDetailOrderNumber) {
      this.openOrderDetail(this.currentDetailOrderNumber);
    }
  }

  handlePodFileSelected(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      this.toast('Photo file must be 5MB or less.', 'error');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      this.podPhotoDataUrl = e.target.result;
      const preview = document.getElementById('admin-pod-preview-img');
      const wrap = document.getElementById('admin-pod-preview-wrap');
      const name = document.getElementById('admin-pod-file-name');
      if (preview) preview.src = this.podPhotoDataUrl;
      if (wrap) wrap.classList.remove('hidden');
      if (name) name.textContent = file.name;
    };
    reader.readAsDataURL(file);
  }

  clearPodPhoto() {
    this.podPhotoDataUrl = null;
    const input = document.getElementById('admin-pod-file-input');
    if (input) input.value = '';
    const wrap = document.getElementById('admin-pod-preview-wrap');
    if (wrap) wrap.classList.add('hidden');
    const name = document.getElementById('admin-pod-file-name');
    if (name) name.textContent = 'No file selected';
  }

  async submitProofOfDelivery(event) {
    if (event && event.preventDefault) event.preventDefault();
    const orderNum = document.getElementById('pod-modal-order-number').value;
    if (!orderNum) return;
    if (!this.podPhotoDataUrl) {
      this.toast('Please select or upload a proof of delivery photo.', 'warning');
      return;
    }
    const notes = (document.getElementById('admin-pod-notes')?.value || '').trim();
    const btn = document.getElementById('admin-pod-submit-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Uploading & Verifying…'; }

    try {
      // 1. Upload photo to server storage
      const upRes = await this.apiRequest('/api/admin/upload', 'POST', { dataUrl: this.podPhotoDataUrl, folder: 'pod' });
      // apiRequest returns { ok, status, data }: the uploaded file's URL is in data.url.
      const photoUrl = upRes.ok && upRes.data ? upRes.data.url : '';
      if (!photoUrl) {
        this.toast((upRes.data && upRes.data.error) || upRes.error || 'Failed to upload photo evidence.', 'error');
        return;
      }

      // 2. Submit POD and update order
      const podRes = await this.apiRequest(`/api/admin/orders/${encodeURIComponent(orderNum)}/pod`, 'POST', {
        photoUrl,
        notes,
        deliveredAt: new Date().toISOString(),
        // Cash on Delivery: the courier collected the cash (recorded in payment history; payment stays Unpaid).
        codCashCollected: !!document.getElementById('pod-cod-collected')?.checked
      });

      if (podRes.ok) {
        this.toast(`Order ${orderNum} marked delivered with photo proof. Customer notified!`, 'success');
        document.getElementById('admin-pod-modal')?.classList.add('hidden');
        await this.loadOrders();
        await this.loadStats();
        await this.loadAdminNotifications();
        this.openOrderDetail(orderNum);
      } else {
        this.toast((podRes.data && podRes.data.error) || podRes.error || 'Failed to record proof of delivery.', 'error');
      }
    } catch (err) {
      this.toast('An error occurred submitting proof of delivery.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Submit Proof & Mark Delivered'; }
    }
  }

  // --- Dispute Resolution Handlers ---
  openResolveDisputeModal(orderNum) {
    const order = this.orders.find(o => o.orderNumber === orderNum);
    if (!order) return;
    const modal = document.getElementById('admin-resolve-dispute-modal');
    const orderInput = document.getElementById('resolve-dispute-order-number');
    const infoCard = document.getElementById('resolve-dispute-info-card');
    if (orderInput) orderInput.value = orderNum;
    if (infoCard) {
      infoCard.innerHTML = `
        <div class="flex items-center justify-between">
          <span class="font-mono font-bold text-rose-800 text-sm">Order #${esc(order.orderNumber)}</span>
          <span class="text-[10px] text-rose-600 font-semibold">Reported: ${new Date(order.updatedAt || Date.now()).toLocaleString()}</span>
        </div>
        <p class="text-xs text-rose-900 mt-1"><strong>Customer Dispute Reason:</strong> ${esc(order.customerDisputeReason || 'Customer reported order was not received.')}</p>
        ${order.customerDisputePhotoUrl ? `
          <div class="flex items-center gap-2 pt-1">
            <span class="text-[11px] text-[#6E6864]">Customer Photo:</span>
            <button type="button" onclick="window.adminApp.openPodLightbox('${esc(order.customerDisputePhotoUrl)}', 'Customer Dispute Evidence', 'Uploaded by customer')" class="text-[11px] font-bold text-burgundy-700 hover:underline">View Evidence</button>
          </div>
        ` : ''}
      `;
    }
    const notes = document.getElementById('resolve-dispute-notes');
    if (notes) notes.value = '';
    if (modal) modal.classList.remove('hidden');
  }

  closeResolveDisputeModal() {
    document.getElementById('admin-resolve-dispute-modal')?.classList.add('hidden');
  }

  async submitDisputeResolution(event) {
    if (event && event.preventDefault) event.preventDefault();
    const orderNum = document.getElementById('resolve-dispute-order-number').value;
    const finalStatus = document.getElementById('resolve-dispute-status')?.value || 'Delivered — Confirmed';
    const notes = (document.getElementById('resolve-dispute-notes')?.value || '').trim();
    if (!notes) {
      this.toast('Please enter investigation and resolution notes.', 'warning');
      return;
    }
    const btn = document.getElementById('admin-resolve-dispute-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

    try {
      const res = await this.apiRequest(`/api/admin/orders/${encodeURIComponent(orderNum)}/resolve-dispute`, 'POST', {
        notes,
        finalStatus
      });
      if (res.ok) {
        this.toast(`Dispute on Order ${orderNum} has been resolved.`, 'success');
        this.closeResolveDisputeModal();
        await this.loadOrders();
        await this.loadStats();
        await this.loadAdminNotifications();
        this.openOrderDetail(orderNum);
      } else {
        this.toast(res.error || 'Failed to resolve dispute.', 'error');
      }
    } catch (err) {
      this.toast('An error occurred resolving dispute.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Resolution'; }
    }
  }

  // --- Lightbox Handlers ---
  openPodLightbox(url, title, caption) {
    const modal = document.getElementById('admin-pod-lightbox');
    const img = document.getElementById('admin-lightbox-img');
    const tit = document.getElementById('admin-lightbox-title');
    const cap = document.getElementById('admin-lightbox-caption');
    if (!modal || !img) return;
    img.src = url;
    if (tit) tit.textContent = title || 'Photo';
    if (cap) cap.textContent = caption || '';
    modal.classList.remove('hidden');
  }

  closePodLightbox() {
    document.getElementById('admin-pod-lightbox')?.classList.add('hidden');
  }

  // Payment gates come from js/shop-rules.js (the server enforces the same rule):
  //  GCash — Paid before Confirmed / Preparing; Cash on Pickup — Paid before Picked Up; Cash on Delivery — never blocked.
  paymentGate(o, newStatus) {
    if (!o || !window.SHOP_RULES || typeof window.SHOP_RULES.paymentBlocksStatus !== 'function') return '';
    return window.SHOP_RULES.paymentBlocksStatus(o.paymentMethod, o.paymentStatus, newStatus) || '';
  }

  canConfirmOrder(o) {
    return !!o && !this.paymentGate(o, 'Confirmed');
  }

  getOrderPaymentGateMessage(o, actionLabel = 'confirming', newStatus) {
    return this.paymentGate(o, newStatus || (/prepar/i.test(actionLabel) ? 'Preparing' : 'Confirmed'));
  }

  confirmOrder(orderNum) {
    const o = (this.orders || []).find(x => x.orderNumber === orderNum);
    if (o && !this.canConfirmOrder(o)) {
      const msg = this.getOrderPaymentGateMessage(o, 'confirming');
      this.toast(msg, 'error');
      return;
    }
    this.confirmAction({
      title: 'Confirm this order?',
      message: `Confirming order ${orderNum} commits the reservation and moves it to Preparing.`,
      confirmLabel: 'Confirm Order'
    }, () => this.apiRequest(`/api/admin/orders/${encodeURIComponent(orderNum)}/confirm`, 'POST'), () => {
      this.toast(`Order ${orderNum} confirmed successfully.`, 'success');
      this.loadOrders();
      this.loadStats();
      this.openOrderDetail(orderNum);
    });
  }

  rejectOrderPrompt(orderNum) {
    // Before preparation the stems are untouched and always go back to stock. Once the bouquet is being made
    // they are usually used, so the admin decides (default: not returned).
    const o = (this.orders || []).find(x => x.orderNumber === orderNum);
    const autoRestock = !o || ['Pending Confirmation', 'Confirmed'].includes(o.status);
    let restocked = autoRestock;
    this.confirmAction({
      title: 'Cancel this order?',
      message: autoRestock
        ? 'Cancelling returns the reserved flower stock to available inventory. This action cannot be undone.'
        : 'This order is already being prepared or has left the shop. This action cannot be undone.',
      confirmLabel: 'Cancel order',
      destructive: true,
      input: {
        type: 'textarea',
        label: 'Reason for cancellation (required):',
        placeholder: 'e.g. Out of stock for selected date, customer requested cancellation...',
        required: true
      },
      checkbox: autoRestock ? undefined : {
        label: 'Return the flowers to stock',
        hint: 'Tick only if the stems were not used (e.g. the bouquet was never made).',
        checked: false
      }
    }, (val, checked) => {
      restocked = autoRestock || checked === true;
      return this.apiRequest(`/api/admin/orders/${encodeURIComponent(orderNum)}/reject`, 'POST', { reason: val, restoreStock: checked === true });
    }, () => {
      this.toast(`Order ${orderNum} cancelled${restocked ? ' and flower stock restored' : ' (stock not returned)'}.`, 'info');
      this.loadOrders();
      this.loadStats();
      this.openOrderDetail(orderNum);
    });
  }

  markDeliveredPrompt(orderNum) {
    this.openPodModal(orderNum);
  }

  async updateStatus(orderNum, newStatus) {
    {
      const o = (this.orders || []).find(x => x.orderNumber === orderNum);
      const msg = o && o.status !== newStatus ? this.paymentGate(o, newStatus) : '';
      if (msg) { this.toast(msg, 'error'); return; }
    }
    const res = await this.apiRequest(`/api/admin/orders/${encodeURIComponent(orderNum)}/status`, 'POST', { status: newStatus });
    if (!res.ok) {
      this.toast((res.data && res.data.error) || res.error || 'Could not update order status.', 'error');
      return;
    }
    this.toast(`Order ${orderNum} advanced to ${newStatus}.`, 'success');
    this.loadOrders();
    this.loadStats();
    this.openOrderDetail(orderNum);
  }

  async saveGrabLink(orderNum) {
    const input = document.getElementById('order-grab-tracking-input');
    const url = (input ? input.value : '').trim();
    if (url && !/^https:\/\//.test(url)) {
      this.toast('Courier tracking link must start with https://', 'error');
      return;
    }
    const res = await this.apiRequest(`/api/admin/orders/${encodeURIComponent(orderNum)}/status`, 'POST', {
      status: this.orders.find(o => o.orderNumber === orderNum)?.status || 'Rider Assigned',
      grabTrackingUrl: url
    });
    if (!res.ok) {
      this.toast(res.error || 'Failed to update courier tracking link.', 'error');
      return;
    }
    this.toast('Courier tracking link saved.', 'success');
    this.loadOrders();
    this.openOrderDetail(orderNum);
  }

  // =========================================================================
  // UNIFIED STORE MANAGEMENT (PRODUCTS & INVENTORY)
  // =========================================================================

  async loadStoreData() {
    await Promise.all([
      this.fetchFlowersData(),
      this.fetchBouquetsData(),
      this.fetchCategoriesData(),
      this.loadSuppliers ? this.loadSuppliers() : Promise.resolve()
    ]);
    this.populateStoreCategoryFilter();
    this.populateProductCategoryDropdowns();
    this.renderStoreKPIs();
    this.renderStoreTable();
    this.updateNotificationBadge();
  }

  renderStoreKPIs() {
    const kpiGrid = document.getElementById('store-kpi-grid');
    const bouquetsList = this.bouquets || [];
    const flowersList = this.flowers || [];

    const globalTh = this.getGlobalLowStockThreshold();

    // KPI 1 — Total Bouquets: Total ready-made bouquets in catalog
    const totalBouquets = bouquetsList.length;

    // KPI 2 — Total Inventory Items: Total unique raw inventory items in flowers table
    const totalInventory = flowersList.length;

    // KPI 3 & 4 — Low Stock & Out of Stock across all inventory items (both bouquets & materials)
    const allStoreItems = this.getAllStoreItems();
    const lowStock = allStoreItems.filter(item => item.stockStatus === 'low_stock').length;
    const outOfStock = allStoreItems.filter(item => item.stockStatus === 'out_of_stock').length;

    // Update sidebar warning badge
    const storeBadge = document.getElementById('sidebar-store-warning-badge');
    if (storeBadge) {
      const alertTotal = lowStock + outOfStock;
      if (alertTotal > 0) {
        storeBadge.innerText = alertTotal;
        storeBadge.classList.remove('hidden');
      } else {
        storeBadge.classList.add('hidden');
      }
    }

    if (!kpiGrid) return;
    // Informational cards (not clickable), same component as every other admin page.
    kpiGrid.innerHTML = [
      // Card 1: Total Bouquets
      this.kpiCardHTML({ label: 'Total Bouquets', value: totalBouquets, subtext: 'Ready-made bouquets in the catalog', tone: 'sage',
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9z"/><path d="M12 3v9"/></svg>' }),
      // Card 2: Inventory Items
      this.kpiCardHTML({ label: 'Inventory Items', value: totalInventory, subtext: 'Stems, fillers & wrapping materials', tone: 'neutral',
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>' }),
      // Card 3: Low Stock
      this.kpiCardHTML({ label: 'Low Stock', value: lowStock, subtext: lowStock > 0 ? 'At or below the stock threshold' : 'No items running low', tone: lowStock > 0 ? 'amber' : 'neutral',
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>' }),
      // Card 4: Out of Stock
      this.kpiCardHTML({ label: 'Out of Stock', value: outOfStock, subtext: outOfStock > 0 ? 'Need restocking before they can sell' : 'Everything is in stock', tone: outOfStock > 0 ? 'rose' : 'neutral',
        iconSvg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>' })
    ].join('');
  }

  getAllStoreItems() {
    const list = [];
    const globalTh = this.getGlobalLowStockThreshold();
    // 1. Ready-made bouquets
    for (const b of (this.bouquets || [])) {
      const stock = this.getBouquetStock(b);
      const status = (stock <= 0 || b.availability === 'sold_out') ? 'out_of_stock' : (stock <= globalTh ? 'low_stock' : 'in_stock');
      list.push({
        id: b.id,
        name: b.name,
        description: b.description || '',
        category: b.category || 'Ready-Made Bouquets',
        itemType: 'bouquet',
        isBouquet: true,
        price: b.price || 0,
        stockCount: stock,
        unitOfMeasure: 'bouquets',
        stockDisplay: `${stock} bouquets`,
        stockStatus: status,
        availability: b.availability === 'unavailable' ? 'unavailable' : 'available',
        image: b.image || '',
        formula: b.formula || '',
        occasion: b.occasion || '',
        occasions: Array.isArray(b.occasions) ? b.occasions : (b.specs && Array.isArray(b.specs.occasions) ? b.specs.occasions : (b.occasion ? b.occasion.split(',').map(s => s.trim()) : [])),
        archived: !!b.archived,
        updated_at: b.updatedAt || b.updated_at,
        createdAt: b.createdAt || null
      });
    }

    // 2. Flowers and inventory materials
    for (const f of (this.flowers || [])) {
      const sc = f.stockCount !== undefined ? Number(f.stockCount) : 0;
      const status = (sc <= 0 || f.availability === 'sold_out') ? 'out_of_stock' : (sc <= globalTh ? 'low_stock' : 'in_stock');
      list.push({
        id: f.id,
        name: f.name,
        description: f.description || '',
        category: f.category || (f.itemType === 'flower' ? 'Fresh Flowers' : (f.itemType ? f.itemType.charAt(0).toUpperCase() + f.itemType.slice(1) : 'Materials')),
        itemType: f.itemType || 'flower',
        isBouquet: false,
        price: f.price || 0,
        stockCount: sc,
        unitOfMeasure: f.unitOfMeasure || 'stems',
        stockDisplay: `${sc} ${f.unitOfMeasure || 'stems'}`,
        stockStatus: status,
        availability: f.availability === 'unavailable' ? 'unavailable' : 'available',
        image: f.image || '',
        botanicalName: f.botanicalName || '',
        style: f.style || '',
        occasion: f.occasion || '',
        occasions: Array.isArray(f.occasions) ? f.occasions : (f.occasion ? f.occasion.split(',').map(s => s.trim()) : []),
        unitCost: f.unitCost,
        lowStockThreshold: globalTh,
        archived: !!f.archived,
        updated_at: f.updatedAt || f.updated_at,
        createdAt: f.createdAt || null
      });
    }
    return list;
  }

  toggleStoreAdvancedFilters(forceState) {
    const panel = document.getElementById('store-advanced-filters-panel');
    if (!panel) return;
    if (typeof forceState === 'boolean') {
      if (forceState) panel.classList.remove('hidden');
      else panel.classList.add('hidden');
    } else {
      panel.classList.toggle('hidden');
    }
  }

  handleStoreSearch(val) {
    this.storeSearchQuery = (val || '').toLowerCase().trim();
    if (this.pagination.store) this.pagination.store.page = 1;
    this.renderStoreTable();
  }

  handleStoreCategoryFilter(val) {
    this.storeCategoryFilter = val || 'all';
    if (this.pagination.store) this.pagination.store.page = 1;
    this.renderStoreTable();
  }

  handleStoreOccasionFilter(val) {
    this.storeOccasionFilter = val || 'all';
    if (this.pagination.store) this.pagination.store.page = 1;
    this.renderStoreTable();
  }

  handleStoreStockFilter(val) {
    this.storeStockFilter = val || 'all';
    if (this.pagination.store) this.pagination.store.page = 1;
    this.renderStoreTable();
  }

  handleStoreSort(val) {
    this.storeSortFilter = val || 'name_asc';
    if (this.pagination.store) this.pagination.store.page = 1;
    this.renderStoreTable();
  }

  clearStoreFilters() {
    this.storeSearchQuery = '';
    this.storeCategoryFilter = 'all';
    this.storeOccasionFilter = 'all';
    this.storeStockFilter = 'all';
    this.storeSortFilter = 'name_asc';
    if (this.pagination.store) this.pagination.store.page = 1;

    const searchInput = document.getElementById('store-search-input');
    if (searchInput) searchInput.value = '';
    const catSelect = document.getElementById('store-category-filter');
    if (catSelect) catSelect.value = 'all';
    const occSelect = document.getElementById('store-occasion-filter');
    if (occSelect) occSelect.value = 'all';
    const stockSelect = document.getElementById('store-stock-filter');
    if (stockSelect) stockSelect.value = 'all';
    const sortSelect = document.getElementById('store-sort-filter');
    if (sortSelect) sortSelect.value = 'name_asc';

    const advIndicator = document.getElementById('store-adv-filter-indicator');
    if (advIndicator) advIndicator.classList.add('hidden');

    this.renderStoreTable();
  }

  populateStoreCategoryFilter() {
    // Standard and custom category filter populate
  }

  renderStoreTable() {
    const tbody = document.getElementById('admin-store-tbody');
    const emptyState = document.getElementById('store-empty-state');
    const countText = document.getElementById('store-count-text');
    if (!tbody) return;

    // Toggle advanced filter indicator dot
    const advIndicator = document.getElementById('store-adv-filter-indicator');
    if (advIndicator) {
      if (this.storeOccasionFilter && this.storeOccasionFilter !== 'all') {
        advIndicator.classList.remove('hidden');
      } else {
        advIndicator.classList.add('hidden');
      }
    }

    // Toggle clear filters button visibility
    const hasActiveFilters = Boolean(
      this.storeSearchQuery ||
      (this.storeCategoryFilter && this.storeCategoryFilter !== 'all') ||
      (this.storeOccasionFilter && this.storeOccasionFilter !== 'all') ||
      (this.storeStockFilter && this.storeStockFilter !== 'all') ||
      (this.storeSortFilter && this.storeSortFilter !== 'name_asc')
    );
    const clearBtn = document.getElementById('store-clear-filters-btn');
    if (clearBtn) {
      if (hasActiveFilters) clearBtn.classList.remove('hidden');
      else clearBtn.classList.add('hidden');
    }

    let list = this.getAllStoreItems();

    // 1. Search Query Filter
    if (this.storeSearchQuery) {
      const q = this.storeSearchQuery;
      list = list.filter(item => {
        return (item.name || '').toLowerCase().includes(q) ||
          (item.description || '').toLowerCase().includes(q) ||
          (item.category || '').toLowerCase().includes(q) ||
          (item.occasion || '').toLowerCase().includes(q) ||
          (Array.isArray(item.occasions) && item.occasions.some(o => String(o).toLowerCase().includes(q))) ||
          (item.botanicalName || '').toLowerCase().includes(q) ||
          (item.formula || '').toLowerCase().includes(q) ||
          (item.itemType || '').toLowerCase().includes(q);
      });
    }

    // 2. Category Filter
    if (this.storeCategoryFilter && this.storeCategoryFilter !== 'all') {
      const cf = this.storeCategoryFilter.toLowerCase();
      list = list.filter(item => {
        const norm = this.normalizeCategoryName(item.category).toLowerCase();
        if (cf === 'bouquet' || cf === 'ready-made bouquets') return item.isBouquet || norm === 'ready-made bouquets';
        if (cf === 'flower' || cf === 'fresh flowers') return (!item.isBouquet && item.itemType === 'flower') || norm === 'fresh flowers';
        if (cf === 'filler' || cf === 'foliage' || cf === 'fillers & foliage') return (!item.isBouquet && (item.itemType === 'filler' || item.itemType === 'foliage')) || norm === 'fillers & foliage';
        if (cf === 'wrapping' || cf === 'wrapping materials') return (!item.isBouquet && item.itemType === 'wrapping') || norm === 'wrapping materials';
        if (cf === 'ribbon' || cf === 'ribbons') return (!item.isBouquet && item.itemType === 'ribbon') || norm === 'ribbons';
        if (cf === 'card' || cf === 'greeting cards') return (!item.isBouquet && item.itemType === 'card') || norm === 'greeting cards';
        return norm === cf || (item.category || '').toLowerCase() === cf;
      });
    }

    // 2b. Occasion Filter
    if (this.storeOccasionFilter && this.storeOccasionFilter !== 'all') {
      const targetOcc = this.storeOccasionFilter.toLowerCase().trim();
      list = list.filter(item => {
        const itemOccList = (Array.isArray(item.occasions) ? item.occasions : [])
          .concat(item.occasion ? item.occasion.split(',').map(s => s.trim()) : [])
          .map(s => s.toLowerCase().trim())
          .filter(Boolean);
        return itemOccList.some(o => {
          if (o === targetOcc) return true;
          if (targetOcc === "valentine's day" && o.includes('valentin')) return true;
          if (targetOcc === "mother's day" && o.includes('mother')) return true;
          if (targetOcc === "thank you" && o.includes('thank')) return true;
          if (targetOcc === "sympathy" && (o.includes('sympath') || o.includes('funeral'))) return true;
          return o.includes(targetOcc) || targetOcc.includes(o);
        });
      });
    }

    // 3. Stock Status Filter
    if (this.storeStockFilter && this.storeStockFilter !== 'all') {
      const sf = this.storeStockFilter;
      list = list.filter(item => {
        if (sf === 'in_stock') return item.stockStatus === 'in_stock';
        if (sf === 'low_stock') return item.stockStatus === 'low_stock';
        if (sf === 'out_of_stock') return item.stockStatus === 'out_of_stock';
        return true;
      });
    }

    // 4. Sort Filter
    const sort = this.storeSortFilter || 'name_asc';
    list.sort((a, b) => {
      if (sort === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sort === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sort === 'price_asc') return (a.price || 0) - (b.price || 0);
      if (sort === 'price_desc') return (b.price || 0) - (a.price || 0);
      if (sort === 'stock_asc') return (a.stockCount || 0) - (b.stockCount || 0);
      if (sort === 'stock_desc') return (b.stockCount || 0) - (a.stockCount || 0);
      if (sort === 'newest') return (b.createdAt || b.updated_at || '').localeCompare(a.createdAt || a.updated_at || '') || (a.name || '').localeCompare(b.name || '');
      return 0;
    });

    if (countText) {
      countText.innerText = `${list.length} ${list.length === 1 ? 'item' : 'items'} found`;
    }

    if (!list.length) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      this.renderPagination('store', 0);
      return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    // 5. Pagination
    const pag = this.pagination.store || { page: 1, pageSize: ROWS_PER_PAGE };
    const page = pag.page || 1;
    const pageSize = pag.pageSize || ROWS_PER_PAGE;
    const startIndex = (page - 1) * pageSize;
    const paginated = list.slice(startIndex, startIndex + pageSize);

    tbody.innerHTML = paginated.map(item => {
      const standardCategory = this.normalizeCategoryName(item.category) || (item.isBouquet ? 'Ready-Made Bouquets' : 'Fresh Flowers');

      let stockStatusText = '';
      if (item.availability === 'unavailable') {
        stockStatusText = '<span class="text-stone-500 font-medium text-[11px]">Unavailable</span>';
      } else if (item.stockStatus === 'out_of_stock') {
        stockStatusText = '<span class="text-rose-700 font-semibold text-[11px]">' + (item.isBouquet ? 'Sold Out' : 'Out of Stock') + '</span>';
      } else if (item.stockStatus === 'low_stock') {
        stockStatusText = '<span class="text-amber-700 font-semibold text-[11px]">Low Stock</span>';
      } else {
        stockStatusText = '<span class="text-emerald-700 font-medium text-[11px]">In Stock</span>';
      }
      const uom = item.unitOfMeasure || (item.isBouquet ? 'bouquets' : 'stems');
      const stockMarkup = `
        <div>
          <span class="font-mono font-semibold text-xs text-[#302C2A]">${item.stockCount} <span class="text-[11px] text-[#6E6864] font-sans font-normal">${esc(uom)}</span></span>
          <div class="leading-tight mt-0.5">${stockStatusText}</div>
        </div>
      `;

      const summary = item.formula || item.botanicalName || item.description || '';

      return `
        <tr class="hover:bg-[#FFF9F5]/80 transition group">
          <td class="py-2.5 px-3.5 sm:px-4">
            <div class="flex items-center gap-3">
              <img src="${item.image || 'assets/placeholder.jpg'}" alt="${esc(item.name)}" class="w-9 h-9 rounded-lg object-cover border border-[#E5ECE6] bg-[#FFF9F5] shrink-0" onerror="this.onerror=null;this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23647D69%22 stroke-width=%221.5%22><path d=%22M12 21a9 9 0 009-9H3a9 9 0 009 9z%22/><path d=%22M12 3v9%22/></svg>';">
              <div class="min-w-0">
                <p class="font-semibold text-[#302C2A] text-xs truncate max-w-[180px] sm:max-w-[260px]">${esc(item.name)}</p>
                ${summary ? `<p class="text-[11px] text-[#6E6864] truncate max-w-[180px] sm:max-w-[260px]" title="${esc(summary)}">${esc(summary)}</p>` : ''}
              </div>
            </div>
          </td>
          <td class="py-2.5 px-3.5 sm:px-4 text-xs text-[#524D49] font-medium whitespace-nowrap min-w-[140px]">
            ${esc(standardCategory)}
          </td>
          <td class="py-2.5 px-3.5 sm:px-4 font-mono font-semibold text-xs text-[#302C2A] whitespace-nowrap">
            ${peso(item.price)}
          </td>
          <td class="py-2.5 px-3.5 sm:px-4 min-w-[140px] whitespace-nowrap">
            ${stockMarkup}
          </td>
          <td class="py-2.5 px-3.5 sm:px-4 text-right whitespace-nowrap">
            ${this.renderStoreActionButtons(item)}
          </td>
        </tr>
      `;
    }).join('');

    this.renderPagination('store', list.length);
  }

  openUnifiedItemModal(id, entityType) {
    this.openProductModal(id, entityType);
  }

  // =========================================================================
  // SCREEN 3: PRODUCT MANAGEMENT (Unified Products, Bouquets & Materials)
  // =========================================================================

  async loadProducts() {
    await Promise.all([
      this.fetchFlowersData(),
      this.fetchBouquetsData(),
      this.fetchCategoriesData()
    ]);
    this.populateProductCategoryDropdowns();
    this.renderProductKPIs();
    this.renderProductsTable();
    this.renderInventorySummaryCards();
    this.updateNotificationBadge();
  }

  async fetchFlowersData() {
    const res = await this.apiRequest('/api/admin/flowers');
    if (res.ok) {
      this.flowers = res.data.flowers || [];
    }
  }

  async fetchBouquetsData() {
    const res = await this.apiRequest('/api/admin/bouquets');
    if (res.ok) {
      this.bouquets = res.data.bouquets || [];
    }
  }

  async fetchCategoriesData() {
    const res = await this.apiRequest('/api/admin/categories');
    if (res.ok) {
      this.categories = res.data.categories || [];
    }
  }

  getAllProducts() {
    const list = [];
    // 1. Fresh flowers & materials
    for (const f of (this.flowers || [])) {
      list.push({
        id: f.id,
        name: f.name,
        description: f.description || '',
        category: f.category || 'Fresh Flowers',
        itemType: f.itemType || 'flower',
        isBouquet: false,
        botanicalName: f.botanicalName || '',
        style: f.style || '',
        color: f.color || '#f43f5e',
        price: f.price || 0,
        stockCount: f.stockCount !== undefined ? f.stockCount : 0,
        unitOfMeasure: f.unitOfMeasure || 'stems',
        lowStockThreshold: f.lowStockThreshold || 5,
        availability: f.availability || 'available',
        unitCost: f.unitCost,
        image: f.image || '',
        archived: !!f.archived,
        updated_at: f.updated_at
      });
    }
    // 2. Ready-made bouquets
    for (const b of (this.bouquets || [])) {
      list.push({
        id: b.id,
        name: b.name,
        description: b.description || '',
        category: b.category || 'Ready-Made Bouquets',
        itemType: 'bouquet',
        isBouquet: true,
        occasion: b.occasion || '',
        occasions: Array.isArray(b.occasions) ? b.occasions : (b.specs && Array.isArray(b.specs.occasions) ? b.specs.occasions : []),
        formula: b.formula || '',
        price: b.price || 0,
        stockCount: this.getBouquetStock(b),
        unitOfMeasure: 'bouquets',
        lowStockThreshold: 3,
        availability: b.availability || 'available',
        image: b.image || '',
        specs: b.specs || null,
        archived: !!b.archived,
        updated_at: b.updated_at
      });
    }
    return list;
  }

  getBouquetStock(b) {
    if (!b) return 0;
    if (b.stockCount !== undefined && b.stockCount !== null) {
      return Number(b.stockCount);
    }
    if (b.stock_count !== undefined && b.stock_count !== null) {
      return Number(b.stock_count);
    }
    if (b.specs && typeof b.specs.stockCount === 'number') {
      return b.specs.stockCount;
    }
    return b.availability === 'sold_out' ? 0 : 10;
  }

  handleProductSearch(val) {
    this.productSearch = (val || '').toLowerCase().trim();
    this.pagination.products.page = 1;
    this.renderProductsTable();
  }

  handleProductFilter() {
    const typeSelect = document.getElementById('products-type-filter');
    const occSelect = document.getElementById('products-occasion-filter');
    const availSelect = document.getElementById('products-availability-filter');

    this.productTypeFilter = typeSelect ? typeSelect.value : 'all';
    this.productOccasionFilter = occSelect ? occSelect.value : 'all';
    this.productAvailabilityFilter = availSelect ? availSelect.value : 'all';
    this.pagination.products.page = 1;
    this.renderProductsTable();
  }

  handleProductSort(val) {
    this.productSort = val || 'name_asc';
    this.pagination.products.page = 1;
    this.renderProductsTable();
  }

  clearProductFilters() {
    this.productSearch = '';
    this.productTypeFilter = 'all';
    this.productOccasionFilter = 'all';
    this.productAvailabilityFilter = 'all';
    this.productSort = 'name_asc';
    this.pagination.products.page = 1;

    const searchInput = document.getElementById('products-search-input');
    if (searchInput) searchInput.value = '';
    const typeSelect = document.getElementById('products-type-filter');
    if (typeSelect) typeSelect.value = 'all';
    const occSelect = document.getElementById('products-occasion-filter');
    if (occSelect) occSelect.value = 'all';
    const availSelect = document.getElementById('products-availability-filter');
    if (availSelect) availSelect.value = 'all';
    const sortSelect = document.getElementById('products-sort-filter');
    if (sortSelect) sortSelect.value = 'name_asc';

    this.renderProductsTable();
  }

  renderProductsTable() {
    const tbody = document.getElementById('admin-products-tbody');
    const emptyState = document.getElementById('products-empty-state');
    const countBadge = document.getElementById('products-total-count');
    if (!tbody) return;

    let list = this.getAllProducts();

    // 1. Search Query (name, description, keywords, category, botanical, formula, style, occasion)
    if (this.productSearch) {
      const q = this.productSearch.toLowerCase();
      list = list.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.botanicalName || '').toLowerCase().includes(q) ||
        (p.style || '').toLowerCase().includes(q) ||
        (p.formula || '').toLowerCase().includes(q) ||
        (p.occasion || '').toLowerCase().includes(q)
      );
    }

    // 2. Product Type Filter
    if (this.productTypeFilter && this.productTypeFilter !== 'all') {
      const t = this.productTypeFilter;
      if (t === 'bouquet') {
        list = list.filter(p => p.isBouquet);
      } else if (t === 'flower') {
        list = list.filter(p => !p.isBouquet && p.itemType === 'flower');
      } else if (t === 'fillers_foliage') {
        list = list.filter(p => !p.isBouquet && (p.itemType === 'filler' || p.itemType === 'foliage' || (p.category || '').toLowerCase().includes('filler') || (p.category || '').toLowerCase().includes('foliage')));
      } else if (t === 'wrapping') {
        list = list.filter(p => !p.isBouquet && (p.itemType === 'wrapping' || (p.category || '').toLowerCase().includes('wrapping')));
      } else if (t === 'ribbon') {
        list = list.filter(p => !p.isBouquet && (p.itemType === 'ribbon' || (p.category || '').toLowerCase().includes('ribbon')));
      } else if (t === 'card') {
        list = list.filter(p => !p.isBouquet && (p.itemType === 'card' || (p.category || '').toLowerCase().includes('card')));
      }
    }

    // 3. Occasion Filter
    if (this.productOccasionFilter && this.productOccasionFilter !== 'all') {
      const occKey = this.productOccasionFilter.toLowerCase();
      list = list.filter(p => {
        const occStr = `${p.occasion || ''} ${p.style || ''} ${p.description || ''}`.toLowerCase();
        let occArr = [];
        if (Array.isArray(p.occasions)) occArr = p.occasions.map(o => String(o).toLowerCase());
        const hasKey = (k) => occStr.includes(k) || occArr.some(o => o.includes(k));

        if (occKey === 'birthday') return hasKey('birthday');
        if (occKey === 'anniversary') return hasKey('anniversary');
        if (occKey === 'valentines') return hasKey('valentin');
        if (occKey === 'mothers_day') return hasKey('mother');
        if (occKey === 'graduation') return hasKey('graduat');
        if (occKey === 'congratulations') return hasKey('congrat');
        if (occKey === 'sympathy') return hasKey('sympath');
        if (occKey === 'thank_you') return hasKey('thank');
        return hasKey(occKey);
      });
    }

    // 4. Availability Filter
    if (this.productAvailabilityFilter && this.productAvailabilityFilter !== 'all') {
      const af = this.productAvailabilityFilter;
      if (af === 'available') {
        list = list.filter(p => p.availability === 'available' || (p.availability !== 'sold_out' && p.availability !== 'unavailable'));
      } else if (af === 'unavailable') {
        list = list.filter(p => p.availability === 'unavailable' || p.availability === 'sold_out');
      }
    }

    // 5. Sorting
    const sort = this.productSort || 'name_asc';
    list.sort((a, b) => {
      if (sort === 'name_asc') return (a.name || '').localeCompare(b.name || '');
      if (sort === 'name_desc') return (b.name || '').localeCompare(a.name || '');
      if (sort === 'price_asc') return (a.price || 0) - (b.price || 0);
      if (sort === 'price_desc') return (b.price || 0) - (a.price || 0);
      if (sort === 'recent') return new Date(b.updated_at || 0) - new Date(a.updated_at || 0);
      return 0;
    });

    const totalRecords = list.length;
    if (countBadge) countBadge.innerText = `${totalRecords} item${totalRecords === 1 ? '' : 's'}`;

    if (!totalRecords) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      this.renderPagination('products', 0);
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    // 6 records per page
    const pag = this.pagination.products;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pag.pageSize));
    if (pag.page > totalPages) pag.page = totalPages;
    if (pag.page < 1) pag.page = 1;

    const start = (pag.page - 1) * pag.pageSize;
    const sliced = list.slice(start, start + pag.pageSize);

    tbody.innerHTML = sliced.map(p => this.renderProductRow(p)).join('');
    this.renderPagination('products', totalRecords);
  }

  renderProductRow(p) {
    const isAvail = p.availability === 'available' || (p.availability !== 'sold_out' && p.availability !== 'unavailable');
    const uom = p.unitOfMeasure || (p.isBouquet ? 'bouquets' : 'stems');
    const uomSingular = uom.endsWith('s') ? uom.slice(0, -1) : uom;

    // Image column: thumbnail or clean neutral Lucide floral SVG placeholder
    const imageHtml = p.image ? `
      <img src="${esc(p.image)}" alt="${esc(p.name)}" class="w-10 h-10 object-cover rounded-lg border border-[#E5ECE6] shrink-0">
    ` : `
      <div class="w-10 h-10 rounded-lg bg-[#FFF9F5] border border-[#E5ECE6] flex items-center justify-center text-[#647D69]/70 shrink-0">
        <svg class="w-5 h-5 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <circle cx="12" cy="12" r="3"/>
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4ZM12 22a4 4 0 0 0 4-4v-1a4 4 0 0 0-8 0v1a4 4 0 0 0 4 4ZM2 12a4 4 0 0 0 4 4h1a4 4 0 0 0 0-8H6a4 4 0 0 0-4 4ZM22 12a4 4 0 0 0-4-4h-1a4 4 0 0 0 0 8h1a4 4 0 0 0 4-4Z"/>
        </svg>
      </div>
    `;

    // Type & details
    const typeBadge = this.itemTypeBadge(p.isBouquet ? 'bouquet' : p.itemType);

    // Occasion tags
    let occHtml = '<span class="text-[#A68A80] text-[11px]">—</span>';
    const occSource = p.occasion || (Array.isArray(p.occasions) ? p.occasions.join(', ') : '');
    if (occSource) {
      const parts = occSource.split(/,\s*/).filter(Boolean);
      if (parts.length) {
        occHtml = parts.slice(0, 2).map(tag => `
          <span class="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#FFF9F5] text-[#6E6864] border border-[#E5ECE6]">${esc(tag)}</span>
        `).join(' ');
        if (parts.length > 2) {
          occHtml += ` <span class="text-[10px] text-[#A68A80] font-semibold">+${parts.length - 2}</span>`;
        }
      }
    }

    // Status badge (Storefront availability)
    const statusBadge = this.availabilityBadge(isAvail);

    return `
      <tr class="hover:bg-[#EBF1EC] transition-colors duration-150">
        <td class="py-3 px-4">
          <div class="flex items-center gap-3">
            ${imageHtml}
            <div class="min-w-0 max-w-[220px]">
              <div class="font-bold text-[#302C2A] truncate">${esc(p.name)}</div>
              <div class="text-[11px] text-[#6E6864] truncate mt-0.5">${esc(p.description || '—')}</div>
            </div>
          </div>
        </td>
        <td class="py-3 px-4 whitespace-nowrap">
          <div>${typeBadge}</div>
          <div class="text-[10px] text-[#6E6864] mt-0.5">${esc(uom)}</div>
        </td>
        <td class="py-3 px-4 text-xs text-[#524D49] whitespace-nowrap">${esc(p.category)}</td>
        <td class="py-3 px-4 max-w-[150px] text-xs text-[#6E6864] truncate" title="${esc(occSource || '')}">${esc(occSource || '—')}</td>
        <td class="py-3 px-4 whitespace-nowrap">
          <span class="font-mono font-bold text-[#302C2A]">${peso(p.price)}</span>
          <span class="text-[10px] text-[#6E6864] block">/ ${esc(uomSingular)}</span>
        </td>
        <td class="py-3 px-4 whitespace-nowrap text-xs font-semibold ${isAvail ? 'text-emerald-700' : 'text-stone-500'}">${isAvail ? 'Available' : 'Unavailable'}</td>
        <td class="py-3 px-4 text-right whitespace-nowrap">
          ${this.renderProductsActionButtons(p)}
        </td>
      </tr>
    `;
  }

  /* =========================================================================
     STANDARDIZED TABLE ACTION BUTTONS (View + More)
     Only View (Eye icon) and More (Three-dot dropdown menu) directly on the row.
     Dropdowns automatically open upward/downward based on viewport space and escape
     clipping via fixed overlay positioning.
     ========================================================================= */

  renderTableActionButtons({
    viewTitle = 'View Details',
    onView = null,
    viewIcon = null,
    editTitle = 'Edit',
    onEdit = null,
    menuKey = '',
    menuItems = []
  }) {
    const defaultViewIcon = '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>';
    const viewBtn = onView ? `
      <button type="button" onclick="${onView}" class="w-8 h-8 rounded-lg flex items-center justify-center text-[#6E6864] hover:text-[#344F3B] hover:bg-[#EBF1EC] border border-transparent hover:border-[#E5ECE6] transition btn-tactile" title="${esc(viewTitle)}" aria-label="${esc(viewTitle)}">
        ${viewIcon || defaultViewIcon}
      </button>
    ` : '';

    const validMenuItems = (menuItems || []).filter(Boolean);
    if (onEdit) {
      const hasEditAlready = validMenuItems.some(item => typeof item === 'string' && (item.includes(onEdit) || item.includes('Edit') || item.includes('Manage')));
      if (!hasEditAlready) {
        validMenuItems.unshift(this.buildMenuItem({
          label: editTitle || 'Edit',
          icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>',
          onClick: onEdit
        }));
      }
    }

    const moreBtn = validMenuItems.length ? `
      <div class="relative inline-block text-left" data-options-menu="${esc(menuKey)}">
        <button type="button" onclick="window.adminApp.toggleTableOptionsMenu('${esc(menuKey)}', event)" class="w-8 h-8 rounded-lg flex items-center justify-center text-[#6E6864] hover:text-[#302C2A] hover:bg-[#EBF1EC] border border-transparent hover:border-[#E5ECE6] transition btn-tactile" title="More options" aria-label="More options">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
        </button>
        <div id="table-menu-${esc(menuKey)}" class="table-options-menu hidden absolute right-0 mt-1 w-48 rounded-xl bg-white shadow-xl border border-[#E5ECE6] py-1.5 z-50 text-left text-xs space-y-0.5 divide-y divide-[#E5ECE6]/60">
          <div class="py-0.5 space-y-0.5">
            ${validMenuItems.join('')}
          </div>
        </div>
      </div>
    ` : '';

    return `
      <div class="inline-flex items-center gap-1.5 justify-end">
        ${viewBtn}
        ${moreBtn}
      </div>
    `;
  }

  buildMenuItem({ label, icon, onClick, variant = 'default', title = '' }) {
    const textCls = variant === 'danger'
      ? 'text-rose-700 hover:bg-rose-50'
      : variant === 'success'
        ? 'text-emerald-700 hover:bg-emerald-50'
        : 'text-[#302C2A] hover:bg-[#EBF1EC]';
    const iconCls = variant === 'danger'
      ? 'text-rose-600'
      : variant === 'success'
        ? 'text-emerald-600'
        : 'text-[#647D69]';
    return `
      <button type="button" onclick="${onClick}; window.adminApp.closeAllTableOptionMenus();" class="w-full text-left px-3.5 py-1.5 ${textCls} flex items-center gap-2.5 transition text-xs font-medium" ${title ? `title="${esc(title)}"` : ''}>
        <span class="w-4 h-4 flex items-center justify-center shrink-0 ${iconCls}">
          ${icon}
        </span>
        <span class="truncate">${esc(label)}</span>
      </button>
    `;
  }

  toggleTableOptionsMenu(menuKey, event) {
    if (event) event.stopPropagation();
    const target = document.getElementById(`table-menu-${menuKey}`) || document.getElementById(`product-menu-${menuKey}`);
    const isCurrentlyOpen = target && !target.classList.contains('hidden');

    this.closeAllTableOptionMenus();
    if (!target || isCurrentlyOpen) return;

    target.classList.remove('hidden');

    // Smart positioning: calculate available viewport space to open upward or downward and avoid clipping
    const triggerBtn = (event && event.currentTarget) || target.parentElement?.querySelector('button');
    if (triggerBtn) {
      const rect = triggerBtn.getBoundingClientRect();
      const menuHeight = target.offsetHeight || 200;
      const spaceBelow = window.innerHeight - rect.bottom;

      target.style.position = 'fixed';
      target.style.zIndex = '9999';

      const rightEdge = window.innerWidth - rect.right;
      target.style.right = `${Math.max(8, rightEdge)}px`;
      target.style.left = 'auto';

      if (spaceBelow < menuHeight + 16 && rect.top > menuHeight) {
        // Open UPWARD
        target.style.bottom = `${window.innerHeight - rect.top + 4}px`;
        target.style.top = 'auto';
      } else {
        // Open DOWNWARD
        target.style.top = `${rect.bottom + 4}px`;
        target.style.bottom = 'auto';
      }
    }
    this.setupTableMenuGlobalListeners();
  }

  closeAllTableOptionMenus() {
    document.querySelectorAll('.table-options-menu, [id^="table-menu-"], [id^="product-menu-"]').forEach(el => {
      el.classList.add('hidden');
      el.style.position = '';
      el.style.top = '';
      el.style.bottom = '';
      el.style.right = '';
      el.style.left = '';
      el.style.zIndex = '';
    });
  }

  setupTableMenuGlobalListeners() {
    if (window._tableMenuListenersAttached) return;
    window._tableMenuListenersAttached = true;
    window.addEventListener('scroll', () => this.closeAllTableOptionMenus(), { passive: true, capture: true });
    window.addEventListener('resize', () => this.closeAllTableOptionMenus(), { passive: true });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-options-menu]') && !e.target.closest('.table-options-menu')) {
        this.closeAllTableOptionMenus();
      }
    });
  }

  toggleProductOptionsMenu(id, event) {
    this.toggleTableOptionsMenu(id, event);
  }

  // Stock / Integer Input Sanitization (No leading zeros, positive whole numbers only)
  handleStockKeydown(e) {
    if (['.', '-', '+', 'e', 'E', ','].includes(e.key)) {
      e.preventDefault();
    }
  }

  handleStockInput(input) {
    if (!input) return;
    let val = input.value;
    // Strip any non-digit characters
    val = val.replace(/[^\d]/g, '');
    // Automatically remove unnecessary leading zeros (e.g. 010 -> 10, 006 -> 6, 00 -> 0)
    if (val.length > 1) {
      val = val.replace(/^0+(?=\d)/, '');
    }
    input.value = val;
  }

  handleStockBlur(input) {
    if (!input) return;
    let val = input.value.trim();
    if (val === '' || isNaN(parseInt(val, 10)) || parseInt(val, 10) < 0) {
      input.value = '0';
    } else {
      input.value = String(parseInt(val, 10));
    }
  }

  copyTextToClipboard(text, successMsg = 'Copied to clipboard!') {
    if (!text) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        this.toast(successMsg, 'success');
      }).catch(() => {
        this.fallbackCopyText(text, successMsg);
      });
    } else {
      this.fallbackCopyText(text, successMsg);
    }
  }

  fallbackCopyText(text, successMsg) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.toast(successMsg, 'success');
    } catch (_) {
      this.toast('Failed to copy', 'error');
    }
  }

  renderOrdersActionButtons(o, prefix = '') {
    const menuItems = [
      this.buildMenuItem({
        label: 'Customer Profile',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        onClick: `window.adminApp.openOrderCustomerProfile('${esc(o.orderNumber)}')`
      }),
      this.buildMenuItem({
        label: 'Copy Order Number',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
        onClick: `window.adminApp.copyTextToClipboard('${esc(o.orderNumber)}', 'Order number copied!')`
      })
    ];

    return this.renderTableActionButtons({
      viewTitle: 'View Order Details',
      onView: `window.adminApp.openOrderDetail('${esc(o.orderNumber)}')`,
      menuKey: `${prefix}order-${esc(o.orderNumber)}`,
      menuItems
    });
  }

  renderStoreActionButtons(item) {
    const isBouquet = !!item.isBouquet;
    const type = isBouquet ? 'bouquet' : 'flower';

    const menuItems = [
      this.buildMenuItem({
        label: 'Edit Inventory Info',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>',
        onClick: `window.adminApp.openUnifiedItemModal('${item.id}', '${type}')`
      })
    ];

    if (item.archived) {
      menuItems.push(this.buildMenuItem({
        label: 'Restore Item',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
        onClick: `window.adminApp.restoreProduct('${esc(item.id)}', '${type}')`,
        variant: 'success'
      }));
    } else {
      menuItems.push(this.buildMenuItem({
        label: 'Archive Item',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>',
        onClick: `window.adminApp.archiveProduct('${esc(item.id)}', '${type}')`,
        variant: 'danger'
      }));
    }

    return this.renderTableActionButtons({
      viewTitle: 'View Item Details',
      onView: `window.adminApp.viewProductDetails('${item.id}', '${type}')`,
      menuKey: `store-${esc(item.id)}`,
      menuItems
    });
  }

  renderSuppliersActionButtons(s) {
    const menuItems = [
      this.buildMenuItem({
        label: 'Edit Supplier Details',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>',
        onClick: `window.adminApp.openSupplierModal('${esc(s.id)}')`
      })
    ];

    if (s.active) {
      menuItems.push(this.buildMenuItem({
        label: 'Deactivate Supplier',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>',
        onClick: `window.adminApp.confirmToggleSupplierStatus('${esc(s.id)}', true)`,
        variant: 'danger'
      }));
    } else {
      menuItems.push(this.buildMenuItem({
        label: 'Activate Supplier',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
        onClick: `window.adminApp.confirmToggleSupplierStatus('${esc(s.id)}', false)`,
        variant: 'success'
      }));
    }

    if (s.phone || s.email) {
      const contactVal = s.phone || s.email;
      menuItems.push(this.buildMenuItem({
        label: 'Copy Contact Info',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
        onClick: `window.adminApp.copyTextToClipboard('${esc(contactVal)}', 'Supplier contact copied!')`
      }));
    }

    return this.renderTableActionButtons({
      viewTitle: 'View Supplier Details',
      onView: `window.adminApp.viewSupplierDetails('${esc(s.id)}')`,
      menuKey: `supplier-${esc(s.id)}`,
      menuItems
    });
  }

  renderCustomersActionButtons(c) {
    const menuItems = [];

    if (c.email) {
      menuItems.push(this.buildMenuItem({
        label: 'Copy Email Address',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',
        onClick: `window.adminApp.copyTextToClipboard('${esc(c.email)}', 'Customer email copied!')`
      }));
    }

    if (c.phone) {
      menuItems.push(this.buildMenuItem({
        label: 'Copy Phone Number',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
        onClick: `window.adminApp.copyTextToClipboard('${esc(c.phone)}', 'Customer phone copied!')`
      }));
    }

    menuItems.push(this.buildMenuItem({
      label: 'Copy Customer ID',
      icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
      onClick: `window.adminApp.copyTextToClipboard('${esc(c.id)}', 'Customer ID copied!')`
    }));

    return this.renderTableActionButtons({
      viewTitle: 'View Customer Profile',
      onView: `window.adminApp.openCustomerDetails('${esc(c.id)}')`,
      menuKey: `cust-${esc(c.id)}`,
      menuItems
    });
  }

  renderCategoriesActionButtons(c) {
    const menuItems = [
      this.buildMenuItem({
        label: 'Copy Category Name',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
        onClick: `window.adminApp.copyTextToClipboard('${esc(c.name)}', 'Category name copied!')`
      })
    ];

    if (c.active) {
      menuItems.push(this.buildMenuItem({
        label: 'Archive Category',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>',
        onClick: `window.adminApp.archiveCategoryFromManage('${esc(c.id)}')`,
        variant: 'danger'
      }));
    }

    return this.renderTableActionButtons({
      viewTitle: 'Edit Category',
      onView: `window.adminApp.editCategoryInManage('${esc(c.id)}')`,
      viewIcon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>',
      menuKey: `cat-${esc(c.id)}`,
      menuItems
    });
  }

  renderProductsActionButtons(p) {
    const isBouquet = !!p.isBouquet;
    const type = isBouquet ? 'bouquet' : 'flower';
    const menuItems = [
      this.buildMenuItem({
        label: 'Edit Product',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>',
        onClick: `window.adminApp.openProductModal('${p.id}', '${type}')`
      })
    ];
    if (p.archived) {
      menuItems.push(this.buildMenuItem({
        label: 'Restore Item',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>',
        onClick: `window.adminApp.restoreProduct('${esc(p.id)}', '${type}')`,
        variant: 'success'
      }));
    } else {
      menuItems.push(this.buildMenuItem({
        label: 'Archive Item',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>',
        onClick: `window.adminApp.archiveProduct('${esc(p.id)}', '${type}')`,
        variant: 'danger'
      }));
    }
    return this.renderTableActionButtons({
      viewTitle: 'View Product Details',
      onView: `window.adminApp.viewProductDetails('${p.id}', '${type}')`,
      menuKey: `prod-${esc(p.id)}`,
      menuItems
    });
  }

  renderFlowersActionButtons(f) {
    const menuItems = [
      this.buildMenuItem({
        label: 'Edit Flower',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>',
        onClick: `window.adminApp.editFlower('${esc(f.id)}')`
      }),
      this.buildMenuItem({
        label: 'Archive Flower',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>',
        onClick: `window.adminApp.archiveFlowerPrompt('${esc(f.id)}')`,
        variant: 'danger'
      }),
      this.buildMenuItem({
        label: 'Copy Flower Name',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
        onClick: `window.adminApp.copyTextToClipboard('${esc(f.name)}', 'Flower name copied!')`
      })
    ];

    return this.renderTableActionButtons({
      viewTitle: 'View Flower Details',
      onView: `window.adminApp.viewProductDetails('${esc(f.id)}', 'flower')`,
      menuKey: `flw-${esc(f.id)}`,
      menuItems
    });
  }

  renderBouquetsActionButtons(b) {
    const menuItems = [
      this.buildMenuItem({
        label: 'Edit Bouquet',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/></svg>',
        onClick: `window.adminApp.editBouquet('${esc(b.id)}')`
      }),
      this.buildMenuItem({
        label: 'Archive Bouquet',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/></svg>',
        onClick: `window.adminApp.deleteBouquet('${esc(b.id)}')`,
        variant: 'danger'
      }),
      this.buildMenuItem({
        label: 'Copy Bouquet Name',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
        onClick: `window.adminApp.copyTextToClipboard('${esc(b.name)}', 'Bouquet name copied!')`
      })
    ];

    return this.renderTableActionButtons({
      viewTitle: 'View Bouquet Details',
      onView: `window.adminApp.viewProductDetails('${esc(b.id)}', 'bouquet')`,
      menuKey: `bq-${esc(b.id)}`,
      menuItems
    });
  }

  renderInventoryActionButtons(f) {
    const menuItems = [
      this.buildMenuItem({
        label: 'Adjust Stock Level',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/></svg>',
        onClick: `window.adminApp.openStockAdjustModal('${esc(f.id)}')`
      }),
      this.buildMenuItem({
        label: 'View Item Details',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>',
        onClick: `window.adminApp.viewProductDetails('${esc(f.id)}', 'flower')`
      }),
      this.buildMenuItem({
        label: 'Copy Item Name',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
        onClick: `window.adminApp.copyTextToClipboard('${esc(f.name)}', 'Item name copied!')`
      })
    ];

    return this.renderTableActionButtons({
      viewTitle: 'View Movement History',
      onView: `window.adminApp.viewItemHistory('${esc(f.id)}', '${esc(f.name).replace(/'/g, "\\'")}')`,
      viewIcon: '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>',
      menuKey: `inv-${esc(f.id)}`,
      menuItems
    });
  }

  normalizeCategoryName(name) {
    if (!name) return '';
    const trimmed = String(name).trim();
    const lower = trimmed.toLowerCase();
    if (lower === 'fillers & foliage' || lower === 'fillers' || lower === 'foliage' || lower === 'fillers & greenery' || lower === 'greenery' || lower === 'filler') {
      return 'Fillers & Foliage';
    }
    if (lower === 'wrapping materials' || lower === 'wrapping' || lower === 'wrapping paper' || lower === 'wrapping papers') {
      return 'Wrapping Materials';
    }
    if (lower === 'message cards' || lower === 'greeting cards' || lower === 'message card' || lower === 'greeting card' || lower === 'cards' || lower === 'card') {
      return 'Greeting Cards';
    }
    if (lower === 'ready-made bouquets' || lower === 'ready-made bouquet' || lower === 'bouquets' || lower === 'bouquet') {
      return 'Ready-Made Bouquets';
    }
    if (lower === 'fresh flowers' || lower === 'fresh flower' || lower === 'flowers' || lower === 'flower') {
      return 'Fresh Flowers';
    }
    if (lower === 'ribbons' || lower === 'ribbon') {
      return 'Ribbons';
    }
    if (lower === 'other materials' || lower === 'other supplies' || lower === 'supplies') {
      return 'Other Materials';
    }
    return trimmed;
  }

  categoryToItemType(categoryName) {
    const norm = this.normalizeCategoryName(categoryName).toLowerCase();
    if (norm === 'ready-made bouquets' || norm.includes('bouquet')) {
      return { entityType: 'bouquet', itemType: 'bouquet' };
    }
    if (norm === 'fresh flowers') {
      return { entityType: 'flower', itemType: 'flower' };
    }
    if (norm === 'fillers & foliage') {
      return { entityType: 'flower', itemType: 'filler' };
    }
    if (norm === 'wrapping materials') {
      return { entityType: 'flower', itemType: 'wrapping' };
    }
    if (norm === 'ribbons') {
      return { entityType: 'flower', itemType: 'ribbon' };
    }
    if (norm === 'greeting cards') {
      return { entityType: 'flower', itemType: 'card' };
    }
    if (norm === 'other materials') {
      return { entityType: 'flower', itemType: 'supply' };
    }

    const customCat = (this.categories || []).find(c => (c.name || '').toLowerCase() === norm);
    if (customCat && customCat.type === 'bouquet') {
      return { entityType: 'bouquet', itemType: 'bouquet' };
    }
    return { entityType: 'flower', itemType: 'supply' };
  }

  handleUnifiedCategoryChange(categoryName) {
    const { entityType, itemType } = this.categoryToItemType(categoryName);
    const itemTypeField = document.getElementById('product-field-item-type');
    const entityTypeField = document.getElementById('product-field-entity-type');
    if (itemTypeField) itemTypeField.value = itemType;
    if (entityTypeField) entityTypeField.value = entityType;
    this.handleUnifiedItemTypeChange(itemType);
  }

  populateProductCategoryDropdowns() {
    const sel = document.getElementById('product-field-category');
    const bouquetSel = document.getElementById('bouquet-field-category');

    const standardCategories = [
      'Ready-Made Bouquets',
      'Fresh Flowers',
      'Fillers & Foliage',
      'Wrapping Materials',
      'Ribbons',
      'Greeting Cards'
    ];

    const customCats = (this.categories || [])
      .filter(c => c && c.active !== false && c.name)
      .map(c => this.normalizeCategoryName(c.name))
      .filter(name => !standardCategories.includes(name));

    const finalCategories = [...standardCategories, ...Array.from(new Set(customCats))];

    if (sel) {
      const current = sel.value;
      sel.innerHTML = finalCategories.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
      const normalizedCurrent = this.normalizeCategoryName(current);
      if (normalizedCurrent && finalCategories.includes(normalizedCurrent)) {
        sel.value = normalizedCurrent;
      }
    }

    if (bouquetSel) {
      const currentBq = bouquetSel.value;
      const bqCats = Array.from(new Set([
        'Ready-Made Bouquets',
        ...(this.categories || []).filter(c => c.type === 'bouquet' || c.type === 'both').map(c => this.normalizeCategoryName(c.name)),
        ...(this.bouquets || []).map(b => this.normalizeCategoryName(b.category))
      ].filter(Boolean))).sort();
      bouquetSel.innerHTML = bqCats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
      const normBq = this.normalizeCategoryName(currentBq);
      if (normBq && bqCats.includes(normBq)) {
        bouquetSel.value = normBq;
      }
    }

    const catDatalist = document.getElementById('category-suggestions');
    if (catDatalist) {
      catDatalist.innerHTML = finalCategories.map(c => `<option value="${esc(c)}">`).join('');
    }
  }

  openProductModal(id = null, entityType = 'flower') {
    const modal = document.getElementById('admin-product-modal');
    const form = document.getElementById('admin-product-form');
    const title = document.getElementById('product-modal-title');
    const subtitle = document.getElementById('product-modal-subtitle');
    if (!modal || !form) return;

    form.reset();
    this.populateProductCategoryDropdowns();
    this.syncUnifiedProductImagePreview('');

    document.querySelectorAll('input[name="product-occasions"]').forEach(cb => cb.checked = false);

    document.getElementById('product-field-id').value = '';
    document.getElementById('product-field-entity-type').value = entityType;

    if (id) {
      if (entityType === 'bouquet') {
        const b = (this.bouquets || []).find(x => x.id === id);
        if (b) {
          if (title) title.innerText = `Edit Bouquet: ${b.name}`;
          if (subtitle) subtitle.innerText = 'Update pricing, occasion tags, arrangement formula, and availability.';
          document.getElementById('product-field-id').value = b.id;
          document.getElementById('product-field-entity-type').value = 'bouquet';
          document.getElementById('product-field-name').value = b.name || '';
          document.getElementById('product-field-desc').value = b.description || '';
          if (document.getElementById('product-field-item-type')) document.getElementById('product-field-item-type').value = 'bouquet';
          const targetCat = this.normalizeCategoryName(b.category) || 'Ready-Made Bouquets';
          document.getElementById('product-field-category').value = targetCat;
          this.handleUnifiedCategoryChange(targetCat);
          document.getElementById('product-field-price').value = b.price || '';
          document.getElementById('product-field-uom').value = 'bouquets';
          if (document.getElementById('product-stock-uom-badge')) document.getElementById('product-stock-uom-badge').innerText = 'bouquets';
          const rawBqStock = parseInt(this.getBouquetStock(b), 10);
          const bqStock = (!isNaN(rawBqStock) && rawBqStock >= 0) ? rawBqStock : 0;
          if (document.getElementById('product-field-stock')) document.getElementById('product-field-stock').value = bqStock;
          if (document.getElementById('product-field-cost')) document.getElementById('product-field-cost').value = '';
          if (document.getElementById('product-field-adj-reason')) document.getElementById('product-field-adj-reason').value = '';
          document.getElementById('product-field-availability').value = b.availability || 'available';
          document.getElementById('product-field-formula').value = b.formula || '';
          this.syncUnifiedProductImagePreview(b.image || '');

          const rawTags = []
            .concat(b.occasions || [])
            .concat(b.specs && Array.isArray(b.specs.occasions) ? b.specs.occasions : [])
            .concat(b.occasion ? b.occasion.split(',').map(s => s.trim()) : [])
            .map(s => String(s).toLowerCase().trim())
            .filter(Boolean);

          document.querySelectorAll('input[name="product-occasions"]').forEach(cb => {
            const val = cb.value.toLowerCase().trim();
            const isMatch = rawTags.some(t => {
              if (t === val) return true;
              if (val === "valentine's day" && (t === "valentine's" || t === 'valentines' || t === "valentine's day")) return true;
              if (val === "mother's day" && (t === "mother's day" || t === 'mothers day' || t.includes('mother'))) return true;
              if (val === 'sympathy' && (t === 'sympathy / funeral' || t === 'sympathy/funeral' || t === 'funeral')) return true;
              return false;
            });
            cb.checked = isMatch;
          });
        }
      } else {
        const f = (this.flowers || []).find(x => x.id === id);
        if (f) {
          if (title) title.innerText = `Edit: ${f.name}`;
          if (subtitle) subtitle.innerText = 'Update catalog specifications, pricing, occasion tags, and storefront availability.';
          document.getElementById('product-field-id').value = f.id;
          document.getElementById('product-field-name').value = f.name || '';
          document.getElementById('product-field-desc').value = f.description || '';
          
          let targetCat = this.normalizeCategoryName(f.category);
          if (!targetCat) {
            if (f.itemType === 'flower') targetCat = 'Fresh Flowers';
            else if (f.itemType === 'filler' || f.itemType === 'foliage') targetCat = 'Fillers & Greenery';
            else if (f.itemType === 'wrapping') targetCat = 'Wrapping';
            else if (f.itemType === 'ribbon') targetCat = 'Ribbons';
            else if (f.itemType === 'card') targetCat = 'Greeting Cards';
            else targetCat = 'Other Materials';
          }
          document.getElementById('product-field-category').value = targetCat;
          this.handleUnifiedCategoryChange(targetCat);

          document.getElementById('product-field-price').value = f.price !== undefined ? f.price : '';
          document.getElementById('product-field-uom').value = f.unitOfMeasure || 'stems';
          if (document.getElementById('product-stock-uom-badge')) document.getElementById('product-stock-uom-badge').innerText = f.unitOfMeasure || 'stems';
          document.getElementById('product-field-availability').value = f.availability || 'available';
          if (document.getElementById('product-field-cost')) document.getElementById('product-field-cost').value = f.unitCost !== undefined && f.unitCost !== null ? f.unitCost : '';
          if (document.getElementById('product-field-stock')) document.getElementById('product-field-stock').value = f.stockCount !== undefined ? f.stockCount : 0;
          if (document.getElementById('product-field-adj-reason')) document.getElementById('product-field-adj-reason').value = '';
          const supSelect = document.getElementById('product-field-supplier');
          if (supSelect) {
            supSelect.innerHTML = '<option value="">No Supplier Assigned</option>' + (this.suppliers || []).map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
            supSelect.value = f.supplierId || '';
          }
          if (document.getElementById('product-field-botanical')) document.getElementById('product-field-botanical').value = f.botanicalName || '';
          if (document.getElementById('product-field-color')) document.getElementById('product-field-color').value = f.color || '#f43f5e';
          if (document.getElementById('product-field-style')) document.getElementById('product-field-style').value = f.style || '';
          this.syncUnifiedProductImagePreview(f.image || '');

          if (f.itemType === 'flower') {
            const rawTags = []
              .concat(f.occasions || [])
              .concat(f.occasion ? f.occasion.split(',').map(s => s.trim()) : [])
              .concat((f.style || '').split(',').map(s => s.trim()))
              .concat((f.description || '').split(/[ ,.]+/).map(s => s.trim()))
              .map(s => String(s).toLowerCase().trim())
              .filter(Boolean);

            document.querySelectorAll('input[name="product-occasions"]').forEach(cb => {
              const val = cb.value.toLowerCase().trim();
              const isMatch = rawTags.some(t => {
                if (t === val) return true;
                if (val === "valentine's day" && (t === "valentine's" || t === 'valentines' || t === "valentine's day")) return true;
                if (val === "mother's day" && (t === "mother's day" || t === 'mothers day' || t.includes('mother'))) return true;
                if (val === 'sympathy' && (t === 'sympathy / funeral' || t === 'sympathy/funeral' || t === 'funeral')) return true;
                return false;
              });
              cb.checked = isMatch;
            });
          }
        }
      }
    } else {
      if (title) title.innerText = 'Add Product & Material';
      if (subtitle) subtitle.innerText = 'Configure catalog product specifications, selling price, occasion tags, and storefront availability.';
      const defaultCat = entityType === 'bouquet' ? 'Ready-Made Bouquets' : 'Fresh Flowers';
      document.getElementById('product-field-category').value = defaultCat;
      this.handleUnifiedCategoryChange(defaultCat);
      document.getElementById('product-field-uom').value = entityType === 'bouquet' ? 'bouquets' : 'stems';
      if (document.getElementById('product-stock-uom-badge')) {
        document.getElementById('product-stock-uom-badge').innerText = entityType === 'bouquet' ? 'bouquets' : 'stems';
      }
      if (document.getElementById('product-field-stock')) document.getElementById('product-field-stock').value = entityType === 'bouquet' ? 10 : 0;
      if (document.getElementById('product-field-cost')) document.getElementById('product-field-cost').value = '';
      if (document.getElementById('product-field-adj-reason')) document.getElementById('product-field-adj-reason').value = '';
      const supSelect = document.getElementById('product-field-supplier');
      if (supSelect) {
        supSelect.innerHTML = '<option value="">No Supplier Assigned</option>' + (this.suppliers || []).map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
        supSelect.value = '';
      }
      document.getElementById('product-field-availability').value = 'available';
      if (document.getElementById('product-field-color')) document.getElementById('product-field-color').value = '#f43f5e';
    }

    this.updateModalStockStatusPreview();
    modal.classList.remove('hidden');
  }

  closeProductModal() {
    document.getElementById('admin-product-modal')?.classList.add('hidden');
  }

  handleUnifiedItemTypeChange(type) {
    const t = String(type || 'flower').toLowerCase();
    const flowerGroup = document.getElementById('field-group-flower');
    const bouquetGroup = document.getElementById('field-group-bouquet');
    const materialGroup = document.getElementById('field-group-material');
    const nameLabel = document.getElementById('product-name-label');
    const priceLabel = document.getElementById('product-price-label');
    const styleLabel = document.getElementById('product-style-label');
    const uomSelect = document.getElementById('product-field-uom');
    const entityTypeField = document.getElementById('product-field-entity-type');

    const stockSection = document.getElementById('product-stock-section');
    const occasionsGroup = document.getElementById('product-field-occasions-group');
    const costRow = document.getElementById('product-material-cost-row');
    const uomBadge = document.getElementById('product-stock-uom-badge');

    if (occasionsGroup) {
      if (t === 'flower' || t === 'bouquet') {
        occasionsGroup.classList.remove('hidden');
      } else {
        occasionsGroup.classList.add('hidden');
      }
    }

    if (stockSection) stockSection.classList.remove('hidden');

    if (t === 'bouquet') {
      if (costRow) costRow.classList.add('hidden');
      if (entityTypeField) entityTypeField.value = 'bouquet';
      if (flowerGroup) flowerGroup.classList.add('hidden');
      if (bouquetGroup) bouquetGroup.classList.remove('hidden');
      if (materialGroup) materialGroup.classList.add('hidden');
      if (nameLabel) nameLabel.innerText = 'Bouquet Name';
      if (priceLabel) priceLabel.innerText = 'Unit Price (₱ / bouquet)';
      if (uomSelect) uomSelect.value = 'bouquets';
      if (uomBadge) uomBadge.innerText = 'bouquets';
    } else if (t === 'flower') {
      if (costRow) costRow.classList.remove('hidden');
      if (entityTypeField) entityTypeField.value = 'flower';
      if (flowerGroup) flowerGroup.classList.remove('hidden');
      if (bouquetGroup) bouquetGroup.classList.add('hidden');
      if (materialGroup) materialGroup.classList.add('hidden');
      if (nameLabel) nameLabel.innerText = 'Flower Name';
      if (priceLabel) priceLabel.innerText = 'Unit Price (₱ / stem)';
      if (uomSelect) uomSelect.value = 'stems';
      if (uomBadge) uomBadge.innerText = 'stems';
    } else if (t === 'filler' || t === 'foliage') {
      if (costRow) costRow.classList.remove('hidden');
      if (entityTypeField) entityTypeField.value = 'flower';
      if (flowerGroup) flowerGroup.classList.remove('hidden');
      if (bouquetGroup) bouquetGroup.classList.add('hidden');
      if (materialGroup) materialGroup.classList.add('hidden');
      if (nameLabel) nameLabel.innerText = 'Filler / Greenery Name';
      if (priceLabel) priceLabel.innerText = 'Unit Price (₱ / stem)';
      if (uomSelect) uomSelect.value = 'stems';
      if (uomBadge) uomBadge.innerText = 'stems';
    } else {
      if (costRow) costRow.classList.remove('hidden');
      if (entityTypeField) entityTypeField.value = 'flower';
      if (flowerGroup) flowerGroup.classList.remove('hidden');
      if (bouquetGroup) bouquetGroup.classList.add('hidden');
      if (materialGroup) materialGroup.classList.add('hidden');
      if (t === 'wrapping') {
        if (nameLabel) nameLabel.innerText = 'Wrapping Material Name';
        if (priceLabel) priceLabel.innerText = 'Unit Price (₱ / sheet or set)';
        if (styleLabel) styleLabel.innerText = 'Texture / Paper Finish';
        if (uomSelect) uomSelect.value = 'sheets';
        if (uomBadge) uomBadge.innerText = 'sheets';
      } else if (t === 'ribbon') {
        if (nameLabel) nameLabel.innerText = 'Ribbon Name';
        if (priceLabel) priceLabel.innerText = 'Unit Price (₱ / roll)';
        if (styleLabel) styleLabel.innerText = 'Ribbon Width / Texture';
        if (uomSelect) uomSelect.value = 'rolls';
        if (uomBadge) uomBadge.innerText = 'rolls';
      } else if (t === 'card') {
        if (nameLabel) nameLabel.innerText = 'Greeting Card Name';
        if (priceLabel) priceLabel.innerText = 'Unit Price (₱ / card)';
        if (styleLabel) styleLabel.innerText = 'Sentiment Theme / Style';
        if (uomSelect) uomSelect.value = 'cards';
        if (uomBadge) uomBadge.innerText = 'cards';
      } else {
        if (nameLabel) nameLabel.innerText = 'Material Name';
        if (priceLabel) priceLabel.innerText = 'Unit Price (₱)';
        if (styleLabel) styleLabel.innerText = 'Material Specifications';
        if (uomSelect) uomSelect.value = 'pieces';
        if (uomBadge) uomBadge.innerText = 'pieces';
      }
    }

    this.updateModalStockStatusPreview();
  }

  updateModalStockStatusPreview() {
    const statusContainer = document.getElementById('product-modal-stock-status');
    if (!statusContainer) return;
    const stockInput = document.getElementById('product-field-stock');
    const availSelect = document.getElementById('product-field-availability');
    const uomSelect = document.getElementById('product-field-uom');
    const itemTypeField = document.getElementById('product-field-item-type');
    const entityTypeField = document.getElementById('product-field-entity-type');
    const isBouquet = (itemTypeField?.value === 'bouquet' || entityTypeField?.value === 'bouquet');

    const uom = isBouquet ? 'bouquets' : (uomSelect ? uomSelect.value : 'stems');
    const uomBadge = document.getElementById('product-stock-uom-badge');
    if (uomBadge) uomBadge.innerText = uom;

    const rawStock = stockInput?.value;
    const stock = rawStock !== '' && !isNaN(parseInt(rawStock, 10)) ? parseInt(rawStock, 10) : 0;
    const avail = availSelect ? availSelect.value : 'available';
    const globalTh = this.getGlobalLowStockThreshold();

    if (avail === 'unavailable') {
      statusContainer.innerHTML = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">Unavailable (Storefront Hidden)</span>';
      return;
    }

    if (stock <= 0 || avail === 'sold_out') {
      statusContainer.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]">Out of Stock (0 ${esc(uom)})</span>`;
    } else if (stock <= globalTh) {
      statusContainer.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">Low Stock (1–${globalTh} ${esc(uom)})</span>`;
    } else {
      statusContainer.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">In Stock (&gt;${globalTh} ${esc(uom)})</span>`;
    }
  }

  async saveProduct(e) {
    e.preventDefault();
    const id = document.getElementById('product-field-id')?.value.trim();
    const category = document.getElementById('product-field-category')?.value.trim();
    const { entityType, itemType } = this.categoryToItemType(category);
    if (document.getElementById('product-field-entity-type')) document.getElementById('product-field-entity-type').value = entityType;
    if (document.getElementById('product-field-item-type')) document.getElementById('product-field-item-type').value = itemType;
    const name = document.getElementById('product-field-name')?.value.trim();
    const description = document.getElementById('product-field-desc')?.value.trim();
    const price = parseFloat(document.getElementById('product-field-price')?.value);
    const unitOfMeasure = document.getElementById('product-field-uom')?.value || 'stems';
    const globalThreshold = this.getGlobalLowStockThreshold();
    const availability = document.getElementById('product-field-availability')?.value || 'available';
    const image = document.getElementById('product-field-image')?.value.trim() || '';

    const checkedOccasions = Array.from(document.querySelectorAll('input[name="product-occasions"]:checked')).map(cb => cb.value);
    const occasionString = checkedOccasions.join(', ');

    if (!name) {
      this.toast('Product name is required.', 'error');
      return;
    }
    if (isNaN(price) || price < 0) {
      this.toast('Valid unit price is required.', 'error');
      return;
    }

    const isNew = !id;

    if (itemType === 'bouquet' || entityType === 'bouquet') {
      const prevBq = isNew ? null : (this.bouquets || []).find(b => b.id === id);
      const formula = document.getElementById('product-field-formula')?.value.trim() || '';
      const stockInput = document.getElementById('product-field-stock');
      const rawStock = stockInput ? stockInput.value.trim() : '';
      if (rawStock === '' || !/^\d+$/.test(rawStock) || isNaN(parseInt(rawStock, 10)) || parseInt(rawStock, 10) < 0) {
        this.toast('Please enter a valid stock quantity (whole number >= 0).', 'error');
        return;
      }
      const finalStock = parseInt(rawStock, 10);
      const reasonInput = document.getElementById('product-field-adj-reason');

      const payload = {
        name,
        category: category || 'Ready-Made Bouquets',
        occasion: occasionString,
        price,
        availability,
        formula,
        description,
        image,
        stockCount: finalStock,
        adjustmentReason: reasonInput ? reasonInput.value.trim() : undefined,
        specs: {
          ...(prevBq?.specs || {}),
          stockCount: finalStock,
          occasions: checkedOccasions,
          unitOfMeasure: 'bouquets'
        }
      };

      if (this._pendingImageUpload) await this._pendingImageUpload;
      payload.image = document.getElementById('product-field-image')?.value.trim() || '';

      const btn = document.getElementById('product-modal-submit-btn');
      if (btn) { btn.disabled = true; btn._savedText = btn.innerText; btn.innerText = 'Saving…'; }
      let saveRes;
      try {
        const endpoint = isNew ? '/api/admin/bouquets' : `/api/admin/bouquets/${id}`;
        saveRes = await this.apiRequest(endpoint, isNew ? 'POST' : 'PUT', payload);
      } finally {
        if (btn) { btn.disabled = false; btn.innerText = btn._savedText || 'Save'; }
      }
      if (!saveRes.ok) {
        this.toast(saveRes.data?.error || saveRes.error || 'Failed to save bouquet.', 'error');
        return;
      }
      this.toast(isNew ? `Bouquet "${name}" added to catalog.` : `Bouquet "${name}" saved successfully.`, 'success');
      this.closeProductModal();
      await this.loadStoreData();
      await this.loadProducts();
      if (typeof this.loadInventory === 'function') await this.loadInventory();
      this.loadStats();
    } else {
      const botanicalName = document.getElementById('product-field-botanical')?.value.trim() || '';
      const color = document.getElementById('product-field-color')?.value.trim() || '#f43f5e';
      const style = (itemType === 'flower')
        ? (occasionString ? `Occasion: ${occasionString}` : '')
        : (document.getElementById('product-field-style')?.value.trim() || '');
      const unitCost = document.getElementById('product-field-cost') ? parseFloat(document.getElementById('product-field-cost').value) : null;
      const stockInput = document.getElementById('product-field-stock');
      const rawStock = stockInput ? stockInput.value.trim() : '';
      if (rawStock === '' || !/^\d+$/.test(rawStock) || isNaN(parseInt(rawStock, 10)) || parseInt(rawStock, 10) < 0) {
        this.toast('Please enter a valid stock quantity (whole number >= 0).', 'error');
        return;
      }
      const stockVal = parseInt(rawStock, 10);
      const supSelect = document.getElementById('product-field-supplier');
      const reasonInput = document.getElementById('product-field-adj-reason');

      const payload = {
        name,
        itemType,
        botanicalName,
        style,
        category: category || 'Fresh Flowers',
        color,
        price,
        unitOfMeasure,
        availability,
        unitCost: !isNaN(unitCost) ? unitCost : null,
        lowStockThreshold: globalThreshold,
        stockCount: !isNaN(stockVal) ? Math.max(0, stockVal) : 0,
        supplierId: supSelect ? supSelect.value : undefined,
        adjustmentReason: reasonInput ? reasonInput.value.trim() : undefined,
        description,
        image
      };

      if (this._pendingImageUpload) await this._pendingImageUpload;
      payload.image = document.getElementById('product-field-image')?.value.trim() || '';

      const btn2 = document.getElementById('product-modal-submit-btn');
      if (btn2) { btn2.disabled = true; btn2._savedText = btn2.innerText; btn2.innerText = 'Saving…'; }
      let saveRes2;
      try {
        const endpoint = isNew ? '/api/admin/flowers' : `/api/admin/flowers/${id}`;
        saveRes2 = await this.apiRequest(endpoint, isNew ? 'POST' : 'PUT', payload);
      } finally {
        if (btn2) { btn2.disabled = false; btn2.innerText = btn2._savedText || 'Save'; }
      }
      if (!saveRes2.ok) {
        this.toast(saveRes2.data?.error || saveRes2.error || 'Failed to save product.', 'error');
        return;
      }
      this.toast(isNew ? `Product "${name}" created.` : `Product "${name}" updated successfully.`, 'success');
      this.closeProductModal();
      await this.loadStoreData();
      await this.loadProducts();
      this.loadInventory();
      this.loadStats();
    }
  }

  syncUnifiedProductImagePreview(url) {
    const preview = document.getElementById('product-image-preview');
    const emptyState = document.getElementById('product-image-empty-state');
    const container = document.getElementById('product-image-preview-container');
    const status = document.getElementById('product-image-status');
    const hiddenField = document.getElementById('product-field-image');
    const removeBtn = document.getElementById('product-remove-btn');
    const btnText = document.getElementById('product-upload-btn-text');

    if (hiddenField) hiddenField.value = url || '';

    if (url) {
      if (preview) {
        preview.src = url;
        preview.classList.remove('hidden');
        preview.style.objectFit = 'contain';
      }
      if (emptyState) emptyState.classList.add('hidden');
      if (container) {
        container.classList.remove('border-dashed');
        container.classList.add('border-solid');
      }
      if (status) {
        status.innerText = 'Image uploaded';
        status.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200';
      }
      if (removeBtn) removeBtn.classList.remove('hidden');
      if (btnText) btnText.innerText = 'Replace Image';
    } else {
      if (preview) {
        preview.src = '';
        preview.classList.add('hidden');
      }
      if (emptyState) emptyState.classList.remove('hidden');
      if (container) {
        container.classList.remove('border-solid');
        container.classList.add('border-dashed');
      }
      if (status) {
        status.innerText = 'No image uploaded';
        status.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#EBF1EC] text-[#6E6864] border border-[#E5ECE6]';
      }
      if (removeBtn) removeBtn.classList.add('hidden');
      if (btnText) btnText.innerText = 'Upload Image';
    }
  }

  removeUnifiedProductImage() {
    this.syncUnifiedProductImagePreview('');
    this.toast('Image removed. Reverted to neutral floral placeholder.', 'info');
  }

  async handleUnifiedProductImageUpload(input) {
    const file = input.files && input.files[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      this.toast('Only PNG, JPG, JPEG, and WebP images are allowed.', 'error');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toast('Image file exceeds the 5 MB limit. Please select a smaller photo.', 'error');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      this.syncUnifiedProductImagePreview(dataUrl);

      const folder = this.currentProductTab === 'bouquets' ? 'bouquets' : 'products';
      const res = await this.uploadImage(dataUrl, file.name, folder);
      if (res && res.ok && res.data && res.data.url) {
        this.syncUnifiedProductImagePreview(res.data.url);
        this.toast('Photograph uploaded successfully to atelier assets.', 'success');
      } else {
        this.toast((res && res.error) || 'Failed to upload image.', 'error');
      }
      input.value = '';
    };
    reader.readAsDataURL(file);
  }

  openCategoryManageModal() {
    const modal = document.getElementById('admin-category-manage-modal');
    if (!modal) return;
    this.cancelCategoryEdit();
    this.renderCategoryManageList();
    modal.classList.remove('hidden');
  }

  closeCategoryManageModal() {
    document.getElementById('admin-category-manage-modal')?.classList.add('hidden');
  }

  renderCategoryManageList() {
    const tbody = document.getElementById('cat-manage-tbody');
    const badge = document.getElementById('cat-manage-count-badge');
    if (!tbody) return;

    const cats = this.categories || [];
    if (badge) badge.innerText = `${cats.length} categor${cats.length === 1 ? 'y' : 'ies'}`;

    if (!cats.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-[#6E6864] text-xs italic">No categories created yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = cats.map(c => {
      const pCount = (c.productCount !== undefined) ? c.productCount : ((c.flowerCount || 0) + (c.bouquetCount || 0));
      return `
        <tr class="hover:bg-[#EBF1EC] transition-colors duration-150">
          <td class="py-3 px-4 font-bold text-[#302C2A] whitespace-nowrap">${esc(c.name)}</td>
          <td class="py-3 px-4 whitespace-nowrap text-xs text-[#524D49]">
            ${c.type === 'flower' ? 'Stems Only' : (c.type === 'bouquet' ? 'Bouquets Only' : 'Stems & Bouquets')}
          </td>
          <td class="py-3 px-4 text-[#6E6864] text-[11px] max-w-[220px] truncate" title="${esc(c.description || '')}">${esc(c.description || '—')}</td>
          <td class="py-3 px-4 font-mono text-[11px] tabular-nums font-bold text-[#302C2A] whitespace-nowrap">${pCount} ${pCount === 1 ? 'product' : 'products'}</td>
          <td class="py-3 px-4 whitespace-nowrap text-xs font-semibold ${c.active ? 'text-emerald-700' : 'text-stone-500'}">
            ${c.active ? 'Active' : 'Archived'}
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap">
            ${this.renderCategoriesActionButtons(c)}
          </td>
        </tr>
      `;
    }).join('');
  }

  editCategoryInManage(id) {
    const c = (this.categories || []).find(cat => cat.id === id);
    if (!c) return;
    this.editingCategoryId = c.id;
    document.getElementById('cat-manage-field-id').value = c.id;
    document.getElementById('cat-manage-field-name').value = c.name || '';
    document.getElementById('cat-manage-field-scope').value = c.type || 'both';
    document.getElementById('cat-manage-field-desc').value = c.description || '';

    const formTitle = document.getElementById('cat-manage-form-title');
    const submitBtn = document.getElementById('cat-manage-submit-btn');
    const cancelBtn = document.getElementById('cat-manage-cancel-btn');
    if (formTitle) formTitle.innerText = `Edit Category: ${c.name}`;
    if (submitBtn) submitBtn.innerText = 'Save Category Changes';
    if (cancelBtn) cancelBtn.classList.remove('hidden');
  }

  cancelCategoryEdit() {
    this.editingCategoryId = null;
    const form = document.getElementById('admin-cat-manage-form');
    if (form) form.reset();
    document.getElementById('cat-manage-field-id').value = '';

    const formTitle = document.getElementById('cat-manage-form-title');
    const submitBtn = document.getElementById('cat-manage-submit-btn');
    const cancelBtn = document.getElementById('cat-manage-cancel-btn');
    if (formTitle) formTitle.innerText = 'Create New Category';
    if (submitBtn) submitBtn.innerText = 'Create Category';
    if (cancelBtn) cancelBtn.classList.add('hidden');
  }

  async saveCategoryFromManage(e) {
    e.preventDefault();
    const id = document.getElementById('cat-manage-field-id')?.value.trim();
    const name = document.getElementById('cat-manage-field-name')?.value.trim();
    const type = document.getElementById('cat-manage-field-scope')?.value || 'both';
    const description = document.getElementById('cat-manage-field-desc')?.value.trim() || '';

    if (!name || name.length < 2) {
      this.toast('Category name must be at least 2 characters.', 'error');
      return;
    }

    const existing = (this.categories || []).find(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== id);
    if (existing) {
      this.toast(`Category "${name}" already exists.`, 'error');
      return;
    }

    const isNew = !id;
    const endpoint = isNew ? '/api/admin/categories' : `/api/admin/categories/${id}`;
    const res = await this.apiRequest(endpoint, isNew ? 'POST' : 'PUT', { name, type, description });
    if (!res.ok) {
      this.toast(res.error || 'Failed to save category.', 'error');
      return;
    }

    this.toast(`Category "${name}" saved successfully.`, 'success');
    this.cancelCategoryEdit();
    await this.fetchCategoriesData();
    this.populateProductCategoryDropdowns();
    this.renderCategoryManageList();
  }

  archiveCategoryFromManage(id) {
    const c = (this.categories || []).find(cat => cat.id === id);
    if (!c) return;

    const pCount = (c.productCount !== undefined) ? c.productCount : ((c.flowerCount || 0) + (c.bouquetCount || 0));
    if (pCount > 0) {
      this.toast(`Cannot archive category "${c.name}": ${pCount} active product(s) are assigned to it. Reassign products first.`, 'error');
      return;
    }

    this.confirmAction({
      title: `Archive Category "${c.name}"?`,
      message: 'Archived categories will no longer appear in future product assignments.',
      confirmLabel: 'Archive Category',
      destructive: true
    }, () => this.apiRequest(`/api/admin/categories/${id}`, 'DELETE'), async () => {
      this.toast(`Category "${c.name}" archived.`, 'info');
      await this.fetchCategoriesData();
      this.populateProductCategoryDropdowns();
      this.renderCategoryManageList();
    });
  }

  viewProductDetails(id, type) {
    const modal = document.getElementById('admin-product-view-modal');
    const container = document.getElementById('admin-product-view-content');
    if (!modal || !container) return;

    document.querySelectorAll('[id^="product-menu-"]').forEach(el => el.classList.add('hidden'));

    let p = null;
    if (type === 'bouquet') {
      const b = (this.bouquets || []).find(x => x.id === id);
      if (b) {
        p = {
          ...b,
          isBouquet: true,
          itemType: 'bouquet',
          unitOfMeasure: 'bouquets',
          stockCount: this.getBouquetStock(b)
        };
      }
    } else {
      const f = (this.flowers || []).find(x => x.id === id);
      if (f) {
        p = {
          ...f,
          isBouquet: false
        };
      }
    }

    if (!p) {
      this.toast('Product not found.', 'error');
      return;
    }

    const isAvail = p.availability === 'available' || (p.availability !== 'sold_out' && p.availability !== 'unavailable');
    const uom = p.unitOfMeasure || (p.isBouquet ? 'bouquets' : 'stems');

    container.innerHTML = `
      <div class="space-y-4">
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="flex items-center gap-2">
              <h3 class="font-serif font-bold text-xl text-[#302C2A]">${esc(p.name)}</h3>
              ${this.itemTypeBadge(p.isBouquet ? 'bouquet' : p.itemType)}
            </div>
            <p class="text-xs text-[#6E6864] mt-0.5 font-medium">${esc(p.category)}</p>
          </div>
          ${this.availabilityBadge(isAvail)}
        </div>

        <div class="flex flex-col sm:flex-row gap-4 items-center bg-[#FFF9F5] p-4 rounded-xl border border-[#E5ECE6]">
          <div class="w-24 h-24 rounded-xl overflow-hidden bg-white border border-[#E5ECE6] shrink-0 flex items-center justify-center">
            ${p.image ? `
              <img src="${esc(p.image)}" alt="${esc(p.name)}" class="w-full h-full object-cover">
            ` : `
              <div class="text-[#647D69]/70 flex flex-col items-center">
                <svg class="w-8 h-8 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="3"/><path stroke-linecap="round" stroke-linejoin="round" d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0 8 0V6a4 4 0 0 0-4-4ZM12 22a4 4 0 0 0 4-4v-1a4 4 0 0 0-8 0v1a4 4 0 0 0 4 4ZM2 12a4 4 0 0 0 4 4h1a4 4 0 0 0 0-8H6a4 4 0 0 0-4 4ZM22 12a4 4 0 0 0-4-4h-1a4 4 0 0 0 0 8h1a4 4 0 0 0 4-4Z"/></svg>
                <span class="text-[9px] text-[#A68A80] mt-1 font-semibold">No Image</span>
              </div>
            `}
          </div>
          <div class="grid grid-cols-2 gap-3 text-xs w-full">
            <div>
              <span class="text-[#6E6864] text-[11px] block">Selling Price</span>
              <strong class="font-mono text-base text-[#302C2A]">${peso(p.price)}</strong>
              <span class="text-[10px] text-[#A68A80]">/ ${esc(uom.endsWith('s') ? uom.slice(0, -1) : uom)}</span>
            </div>
            <div>
              <span class="text-[#6E6864] text-[11px] block">Current Physical Stock</span>
              <strong class="font-mono text-base ${p.stockCount <= 0 ? 'text-rose-700' : 'text-emerald-700'}">${p.stockCount}</strong>
              <span class="text-[10px] text-[#A68A80]">${esc(uom)}</span>
            </div>
            <div>
              <span class="text-[#6E6864] text-[11px] block">Stock Status</span>
              <div class="mt-0.5">${this.stockStatusBadge(p.stockCount, null, p.availability)}</div>
            </div>
            <div>
              <span class="text-[#6E6864] text-[11px] block">Catalog Status</span>
              <span class="font-bold text-xs ${p.archived ? 'text-stone-500' : 'text-emerald-700'}">${p.archived ? 'Archived' : 'Active'}</span>
            </div>
          </div>
        </div>

        ${p.description ? `
          <div>
            <span class="font-bold text-[#6E6864] text-xs block mb-1">Catalog Description</span>
            <p class="text-xs text-[#302C2A] leading-relaxed bg-[#FFFFFF] p-3 rounded-xl border border-[#E5ECE6]">${esc(p.description)}</p>
          </div>
        ` : ''}

        ${p.formula ? `
          <div>
            <span class="font-bold text-[#6E6864] text-xs block mb-1">Arrangement Recipe / Composition</span>
            <p class="text-xs font-medium text-[#302C2A] bg-[#FFFFFF] p-3 rounded-xl border border-[#E5ECE6]">${esc(p.formula)}</p>
          </div>
        ` : ''}

        ${p.botanicalName ? `
          <div>
            <span class="font-bold text-[#6E6864] text-xs block mb-1">Botanical Name</span>
            <p class="text-xs font-serif italic text-[#302C2A]">${esc(p.botanicalName)}</p>
          </div>
        ` : ''}

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#E5ECE6]">
          <button type="button" onclick="window.adminApp.closeProductViewModal()" class="py-2 px-4 rounded-xl border border-[#E5ECE6] bg-[#FFFFFF] hover:bg-[#EBF1EC] text-[#6E6864] font-semibold text-xs transition btn-tactile">
            Close
          </button>
          <button type="button" onclick="window.adminApp.closeProductViewModal(); window.adminApp.openProductModal('${esc(p.id)}', '${p.isBouquet ? 'bouquet' : 'flower'}');" class="py-2 px-4 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold font-serif text-xs shadow-xs transition btn-tactile">
            Edit Product
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  closeProductViewModal() {
    document.getElementById('admin-product-view-modal')?.classList.add('hidden');
  }

  archiveProduct(id, type) {
    document.querySelectorAll('[id^="product-menu-"]').forEach(el => el.classList.add('hidden'));

    const isBouquet = type === 'bouquet';
    const item = isBouquet ? (this.bouquets || []).find(b => b.id === id) : (this.flowers || []).find(f => f.id === id);
    const name = item ? item.name : 'this item';
    const endpoint = isBouquet ? `/api/admin/bouquets/${id}` : `/api/admin/flowers/${id}`;

    this.confirmAction({
      title: `Delete "${name}"?`,
      message: `"${name}" will be immediately deleted from the customer-facing website, product catalog, and bouquet builder while preserving order audit history.`,
      confirmLabel: 'Delete Product',
      destructive: true
    }, () => this.apiRequest(endpoint, 'DELETE'), async () => {
      this.toast(`"${name}" has been deleted from store catalog.`, 'info');
      await this.loadStoreData();
      await this.loadProducts();
      this.loadInventory();
      this.loadStats();
    });
  }

  restoreProduct(id, type) {
    document.querySelectorAll('[id^="product-menu-"]').forEach(el => el.classList.add('hidden'));

    const isBouquet = type === 'bouquet';
    const item = isBouquet ? (this.bouquets || []).find(b => b.id === id) : (this.flowers || []).find(f => f.id === id);
    const name = item ? item.name : 'this item';
    const endpoint = isBouquet ? `/api/admin/bouquets/${id}/restore` : `/api/admin/flowers/${id}/restore`;

    this.confirmAction({
      title: `Restore "${name}"?`,
      message: `Restoring will make "${name}" active again in your product catalog.`,
      confirmLabel: 'Restore Product'
    }, () => this.apiRequest(endpoint, 'POST'), async () => {
      this.toast(`"${name}" restored to active catalog.`, 'success');
      await this.loadStoreData();
      await this.loadProducts();
      this.loadInventory();
      this.loadStats();
    });
  }

  renderProductKPIs() {
    const container = document.getElementById('products-kpi-grid');
    if (!container) return;

    const flowersList = this.flowers || [];
    const bouquetsList = this.bouquets || [];

    const freshFlowersCount = flowersList.filter(f => (f.itemType || 'flower') === 'flower').length;
    const bouquetMaterialsCount = flowersList.filter(f => f.itemType && f.itemType !== 'flower').length;
    const readyMadeBouquetsCount = bouquetsList.length;
    const totalProductsCount = flowersList.length + bouquetsList.length;

    container.innerHTML = [
      this.kpiCardHTML({
        id: 'kpi-card-total-products',
        label: 'Total Products',
        value: `<span id="kpi-count-total-products">${totalProductsCount}</span>`,
        subtext: 'All catalog items & materials',
        iconBg: 'bg-[#EBF1EC]',
        iconColor: 'text-[#647D69]',
        iconSvg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>'
      }),
      this.kpiCardHTML({
        id: 'kpi-card-fresh-flowers',
        label: 'Fresh Flowers',
        value: `<span id="kpi-count-fresh-flowers">${freshFlowersCount}</span>`,
        subtext: 'Individual stems & focal blooms',
        iconBg: 'bg-[#EBF1EC]',
        iconColor: 'text-[#E11D48]',
        iconSvg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/><circle cx="12" cy="8" r="2"/><path d="M12 10v12"/></svg>'
      }),
      this.kpiCardHTML({
        id: 'kpi-card-ready-bouquets',
        label: 'Ready-Made Bouquets',
        value: `<span id="kpi-count-ready-bouquets">${readyMadeBouquetsCount}</span>`,
        subtext: 'Pre-arranged gift designs',
        iconBg: 'bg-[#FEF3C7]',
        iconColor: 'text-[#D97706]',
        iconSvg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>'
      }),
      this.kpiCardHTML({
        id: 'kpi-card-bouquet-materials',
        label: 'Bouquet Materials',
        value: `<span id="kpi-count-bouquet-materials">${bouquetMaterialsCount}</span>`,
        subtext: 'Fillers, foliage, wraps & ribbons',
        iconBg: 'bg-[#DCFCE7]',
        iconColor: 'text-[#166534]',
        iconSvg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>'
      })
    ].join('');
  }

  // 3.1 Fresh Flowers & Bouquet Materials
  async loadFlowers() {
    await this.fetchFlowersData();
    this.renderProductsTable();
    this.renderFlowersTable();
    this.populateFlowerCategoryFilter();
    this.populateProductCategoryDropdowns();
    this.renderProductKPIs();
    this.renderInventorySummaryCards();
    this.updateNotificationBadge();
  }

  populateFlowerCategoryFilter() {
    const select = document.getElementById('flowers-category-filter');
    if (!select) return;
    const current = select.value;
    const cats = Array.from(new Set(this.flowers.map(f => f.category).filter(Boolean))).sort();
    select.innerHTML = '<option value="all">All Categories</option>' + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    select.value = current || 'all';
  }

  handleFlowerSearch(val) {
    this.flowerSearch = (val || '').toLowerCase().trim();
    this.pagination.flowers.page = 1;
    this.renderFlowersTable();
  }

  handleFlowerTypeChange(type) {
    if (type === 'bouquets') {
      this.switchProductTab('bouquets');
      return;
    }
    this.handleFlowerFilter();
  }

  handleBouquetTypeChange(type) {
    if (type !== 'bouquets') {
      this.switchProductTab('flowers');
      const flowersTypeSelect = document.getElementById('flowers-type-filter');
      if (flowersTypeSelect) {
        flowersTypeSelect.value = type;
      }
      this.handleFlowerFilter();
      return;
    }
    this.handleBouquetFilter();
  }

  handleFlowerFilter() {
    const catSelect = document.getElementById('flowers-category-filter');
    const typeSelect = document.getElementById('flowers-type-filter');
    const priceSelect = document.getElementById('flowers-price-filter');
    this.flowerCategory = catSelect ? catSelect.value : 'all';
    this.flowerItemType = typeSelect ? typeSelect.value : 'all';
    this.flowerPriceFilter = priceSelect ? priceSelect.value : 'all';
    this.pagination.flowers.page = 1;
    this.renderFlowersTable();
  }

  handleFlowerStatusFilter(val) {
    this.flowerStatusFilter = val || 'all';
    this.pagination.flowers.page = 1;
    this.renderFlowersTable();
  }

  clearFlowerFilters() {
    this.flowerSearch = '';
    this.flowerCategory = 'all';
    this.flowerItemType = 'all';
    this.flowerStatusFilter = 'all';
    this.flowerPriceFilter = 'all';
    this.pagination.flowers.page = 1;

    const searchInput = document.getElementById('flowers-search-input');
    if (searchInput) searchInput.value = '';
    const typeSelect = document.getElementById('flowers-type-filter');
    if (typeSelect) typeSelect.value = 'all';
    const catSelect = document.getElementById('flowers-category-filter');
    if (catSelect) catSelect.value = 'all';
    const statusSelect = document.getElementById('flowers-status-filter');
    if (statusSelect) statusSelect.value = 'all';
    const priceSelect = document.getElementById('flowers-price-filter');
    if (priceSelect) priceSelect.value = 'all';

    this.renderFlowersTable();
  }

  itemTypeBadge(type) {
    // Plain category text in tables (no pills).
    switch (String(type || 'flower').toLowerCase()) {
      case 'bouquet': case 'ready-made bouquets':
        return '<span class="status-text status-text--neutral">Ready-Made Bouquets</span>';
      case 'filler': case 'foliage': case 'fillers_foliage': case 'fillers & foliage':
        return '<span class="status-text status-text--neutral">Fillers & Foliage</span>';
      case 'wrapping': case 'wrapping materials':
        return '<span class="status-text status-text--neutral">Wrapping Materials</span>';
      case 'ribbon': case 'ribbons':
        return '<span class="status-text status-text--neutral">Ribbons</span>';
      case 'card': case 'message cards':
        return '<span class="status-text status-text--neutral">Message Cards</span>';
      case 'accessory': case 'accessories':
        return '<span class="status-text status-text--neutral">Accessories</span>';
      default:
        return '<span class="status-text status-text--neutral">Fresh Flowers</span>';
    }
  }



  movementTypeBadge(type) {
    // Plain movement text in tables (no pills); colour carries the direction.
    const t = String(type || '').toLowerCase();
    if (t === 'restock') return '<span class="status-text status-text--success">Stock In (+)</span>';
    if (t === 'deduct') return '<span class="status-text status-text--warning">Stock Out (-)</span>';
    if (t === 'correction') return '<span class="status-text status-text--info">Adjustment (=)</span>';
    if (t === 'order_fulfillment') return '<span class="status-text status-text--neutral">Order Deduction</span>';
    if (t === 'order_restoration') return '<span class="status-text status-text--info">Order Restoration</span>';
    return `<span class="status-text status-text--neutral">${esc(type || 'Movement')}</span>`;
  }



  handleItemTypeChange(type) {
    const t = String(type || 'flower').toLowerCase();
    const uomSelect = document.getElementById('flower-field-uom');
    const nameLabel = document.getElementById('flower-name-label');
    const priceInput = document.getElementById('flower-field-price');

    if (nameLabel) {
      if (t === 'flower') nameLabel.innerText = 'Flower Name';
      else if (t === 'wrapping') nameLabel.innerText = 'Wrapping Paper Name';
      else if (t === 'ribbon') nameLabel.innerText = 'Ribbon Name';
      else if (t === 'card') nameLabel.innerText = 'Card Design Name';
      else if (t === 'filler') nameLabel.innerText = 'Filler Flower Name';
      else if (t === 'foliage') nameLabel.innerText = 'Greenery / Foliage Name';
      else nameLabel.innerText = 'Item / Material Name';
    }

    if (uomSelect && !uomSelect.dataset.userModified) {
      if (t === 'wrapping') uomSelect.value = 'sheets';
      else if (t === 'ribbon') uomSelect.value = 'rolls';
      else if (t === 'card') uomSelect.value = 'cards';
      else if (t === 'accessory') uomSelect.value = 'pieces';
      else uomSelect.value = 'stems';
    }

    if (priceInput && t === 'card' && !priceInput.value) {
      priceInput.value = '0';
    }
  }

  renderFlowersTable() {
    const tbody = document.getElementById('admin-flowers-tbody');
    const emptyState = document.getElementById('flowers-empty-state');
    if (!tbody) return;

    let list = this.flowers;
    if (this.flowerCategory !== 'all') {
      list = list.filter(f => f.category === this.flowerCategory);
    }
    if (this.flowerItemType && this.flowerItemType !== 'all') {
      if (this.flowerItemType === 'fillers_foliage') {
        list = list.filter(f => {
          const t = (f.itemType || '').toLowerCase();
          const c = (f.category || '').toLowerCase();
          return t === 'filler' || t === 'foliage' || c.includes('filler') || c.includes('foliage');
        });
      } else {
        list = list.filter(f => {
          const t = (f.itemType || 'flower').toLowerCase();
          const c = (f.category || '').toLowerCase();
          if (this.flowerItemType === 'flower') return t === 'flower' || c.includes('fresh flowers');
          if (this.flowerItemType === 'wrapping') return t === 'wrapping' || c.includes('wrapping');
          if (this.flowerItemType === 'ribbon') return t === 'ribbon' || c.includes('ribbon');
          if (this.flowerItemType === 'card') return t === 'card' || c.includes('card');
          return t === this.flowerItemType || c.includes(this.flowerItemType);
        });
      }
    }
    if (this.flowerPriceFilter && this.flowerPriceFilter !== 'all') {
      if (this.flowerPriceFilter === 'under50') {
        list = list.filter(f => (f.price || 0) < 50);
      } else if (this.flowerPriceFilter === '50_100') {
        list = list.filter(f => (f.price || 0) >= 50 && (f.price || 0) <= 100);
      } else if (this.flowerPriceFilter === 'above100') {
        list = list.filter(f => (f.price || 0) > 100);
      }
    }
    const globalTh = this.getGlobalLowStockThreshold();
    if (this.flowerStatusFilter && this.flowerStatusFilter !== 'all') {
      if (this.flowerStatusFilter === 'available') {
        list = list.filter(f => f.stockCount > globalTh && f.availability !== 'sold_out');
      } else if (this.flowerStatusFilter === 'limited') {
        list = list.filter(f => f.stockCount > 0 && f.stockCount <= globalTh);
      } else if (this.flowerStatusFilter === 'sold_out') {
        list = list.filter(f => f.stockCount <= 0 || f.availability === 'sold_out');
      }
    }
    if (this.flowerSearch) {
      list = list.filter(f =>
        (f.name || '').toLowerCase().includes(this.flowerSearch) ||
        (f.botanicalName || '').toLowerCase().includes(this.flowerSearch) ||
        (f.style || '').toLowerCase().includes(this.flowerSearch) ||
        (f.category || '').toLowerCase().includes(this.flowerSearch) ||
        (f.itemType || '').toLowerCase().includes(this.flowerSearch)
      );
    }

    if (!list.length) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      this.renderPagination('flowers', 0);
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    const totalRecords = list.length;
    const pag = this.pagination.flowers;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pag.pageSize));
    if (pag.page > totalPages) pag.page = totalPages;
    if (pag.page < 1) pag.page = 1;

    const start = (pag.page - 1) * pag.pageSize;
    const sliced = list.slice(start, start + pag.pageSize);

    tbody.innerHTML = sliced.map(f => {
      const isSoldOut = f.stockCount <= 0 || f.availability === 'sold_out';
      const isLimited = !isSoldOut && f.stockCount <= globalTh;

      const badge = this.stockStatusBadge(f.stockCount, globalTh, f.availability);

      const colorSwatch = f.color ? `<span class="w-3 h-3 rounded-full border border-stone-300 inline-block align-middle mr-1.5 shrink-0" style="background-color: ${esc(f.color)}" title="${esc(f.color)}"></span>` : '';
      const detailText = f.style ? `${esc(f.style)}` : (f.botanicalName ? `<em>${esc(f.botanicalName)}</em>` : '—');

      const imgHtml = f.image ?
        `<img src="${esc(f.image)}" alt="${esc(f.name)}" class="w-10 h-10 rounded-xl object-cover border border-[#E5E7EB] shrink-0" onerror="this.onerror=null; if(window.UI) this.replaceWith(window.UI.placeholderElement('thumb'));">` :
        `<div class="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 flex flex-col items-center justify-center text-stone-400 shrink-0" title="No image uploaded">
          ${f.color ? `<span class="w-5 h-5 rounded-full border border-black/10" style="background-color: ${esc(f.color)};"></span>` : '<svg class="w-4 h-4 text-stone-400 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21V11m0 0C10.5 8 7 7 7 3c3.5 0 4.5 3.5 5 8zm0 0c1.5-3 5-4 5-8-3.5 0-4.5 3.5-5 8z"/></svg>'}
        </div>`;

      const priceUnit = f.unitOfMeasure ? ` / ${f.unitOfMeasure.replace(/s$/, '')}` : '';
      const priceDisplay = f.price === 0 ? 'Free' : `${peso(f.price)}${priceUnit}`;

      return `
        <tr class="hover:bg-[#EBF1EC] transition-colors duration-150">
          <td class="py-3.5 px-4">
            <div class="flex items-center gap-3">
              ${imgHtml}
              <div class="min-w-0">
                <span class="font-bold text-[#302C2A] block truncate">${esc(f.name)}</span>
                <div class="flex items-center gap-1.5 mt-0.5">
                  ${this.itemTypeBadge(f.itemType)}
                  ${!f.image ? '<span class="text-[9px] text-amber-800 font-medium">No photo</span>' : ''}
                </div>
              </div>
            </div>
          </td>
          <td class="py-3.5 px-4 text-[#6E6864]">
            <div class="flex items-center text-xs">
              ${colorSwatch}
              <span class="truncate max-w-[140px]">${detailText}</span>
            </div>
          </td>
          <td class="py-3.5 px-4 text-xs text-[#524D49] font-medium">${esc(f.category || 'General')}</td>
          <td class="py-3.5 px-4 font-mono font-bold text-[#302C2A] text-right tabular-nums">${priceDisplay}</td>
          <td class="py-3.5 px-4">
            <div class="flex items-center gap-2">
              <span class="font-mono font-bold tabular-nums ${isSoldOut ? 'text-red-700' : (isLimited ? 'text-amber-700' : 'text-[#302C2A]')}">${f.stockCount} ${esc(f.unitOfMeasure || 'stems')}</span>
              <button type="button" onclick="window.adminApp.quickUpdateStock('${esc(f.id)}', ${f.stockCount})" class="btn-tactile text-[10px] text-[#647D69] font-bold hover:underline" title="Quick stock count update">Edit</button>
            </div>
          </td>
          <td class="py-3.5 px-4 text-xs font-semibold ${isSoldOut ? 'text-rose-700' : (isLimited ? 'text-amber-700' : 'text-emerald-700')}">
            ${isSoldOut ? 'Out of Stock' : (isLimited ? 'Low Stock' : 'In Stock')}
          </td>
          <td class="py-3.5 px-4 text-right whitespace-nowrap">
            ${this.renderFlowersActionButtons(f)}
          </td>
        </tr>
      `;
    }).join('');

    this.renderPagination('flowers', totalRecords);
  }

  openFlowerModal(id = null) {
    const modal = document.getElementById('admin-flower-modal');
    const form = document.getElementById('admin-flower-form');
    const title = document.getElementById('flower-modal-title');
    if (!modal || !form) return;

    form.reset();
    this.populateProductCategoryDropdowns();
    document.getElementById('flower-field-id').value = '';
    this.syncImagePreview('flower', '');

    if (id) {
      const flower = this.flowers.find(f => f.id === id);
      if (flower) {
        if (title) title.innerText = `Edit ${flower.name}`;
        document.getElementById('flower-field-id').value = flower.id;
        document.getElementById('flower-field-name').value = flower.name || '';
        if (document.getElementById('flower-field-item-type')) document.getElementById('flower-field-item-type').value = flower.itemType || 'flower';
        document.getElementById('flower-field-botanical').value = flower.botanicalName || '';
        if (document.getElementById('flower-field-style')) document.getElementById('flower-field-style').value = flower.style || '';
        document.getElementById('flower-field-category').value = flower.category || '';
        if (document.getElementById('flower-field-color')) document.getElementById('flower-field-color').value = flower.color || '#f43f5e';
        if (document.getElementById('flower-field-color-picker')) document.getElementById('flower-field-color-picker').value = flower.color || '#f43f5e';
        document.getElementById('flower-field-price').value = flower.price !== undefined ? flower.price : '';
        document.getElementById('flower-field-stock').value = flower.stockCount || 0;
        if (document.getElementById('flower-field-uom')) document.getElementById('flower-field-uom').value = flower.unitOfMeasure || 'stems';
        document.getElementById('flower-field-availability').value = flower.availability || 'available';
        if (document.getElementById('flower-field-cost')) document.getElementById('flower-field-cost').value = flower.unitCost || '';
        if (document.getElementById('flower-field-threshold')) document.getElementById('flower-field-threshold').value = this.getGlobalLowStockThreshold();
        document.getElementById('flower-field-desc').value = flower.description || '';
        this.syncImagePreview('flower', flower.image || '');
        this.handleItemTypeChange(flower.itemType || 'flower');
      }
    } else {
      if (title) title.innerText = 'Add Item / Material';
      if (document.getElementById('flower-field-item-type')) document.getElementById('flower-field-item-type').value = 'flower';
      if (document.getElementById('flower-field-color')) document.getElementById('flower-field-color').value = '#f43f5e';
      if (document.getElementById('flower-field-color-picker')) document.getElementById('flower-field-color-picker').value = '#f43f5e';
      if (document.getElementById('flower-field-uom')) document.getElementById('flower-field-uom').value = 'stems';
      this.handleItemTypeChange('flower');
    }

    modal.classList.remove('hidden');
  }

  closeFlowerModal() {
    document.getElementById('admin-flower-modal')?.classList.add('hidden');
  }

  editFlower(id) {
    this.openFlowerModal(id);
  }

  async saveFlower(e) {
    e.preventDefault();
    const id = document.getElementById('flower-field-id')?.value.trim();
    const name = document.getElementById('flower-field-name')?.value.trim();
    const itemType = document.getElementById('flower-field-item-type')?.value || 'flower';
    const botanicalName = document.getElementById('flower-field-botanical')?.value.trim();
    const style = document.getElementById('flower-field-style')?.value.trim();
    const category = document.getElementById('flower-field-category')?.value.trim();
    const color = document.getElementById('flower-field-color')?.value.trim() || '#f43f5e';
    const price = parseFloat(document.getElementById('flower-field-price')?.value);
    const stockCount = parseInt(document.getElementById('flower-field-stock')?.value, 10);
    const unitOfMeasure = document.getElementById('flower-field-uom')?.value || 'stems';
    const availability = document.getElementById('flower-field-availability')?.value;
    const unitCost = document.getElementById('flower-field-cost') ? parseFloat(document.getElementById('flower-field-cost').value) : undefined;
    const lowStockThreshold = document.getElementById('flower-field-threshold') ? parseInt(document.getElementById('flower-field-threshold').value, 10) : undefined;
    const description = document.getElementById('flower-field-desc')?.value.trim();
    const image = document.getElementById('flower-field-image')?.value.trim() || '';

    const payload = {
      name, itemType, botanicalName, style, category, color, price,
      stockCount, unitOfMeasure, availability,
      unitCost: !isNaN(unitCost) ? unitCost : null,
      lowStockThreshold: !isNaN(lowStockThreshold) ? lowStockThreshold : 5,
      description, image
    };

    const isNew = !id;
    const prev = isNew ? null : this.flowers.find(f => f.id === id);

    const runSave = async () => {
      const endpoint = isNew ? '/api/admin/flowers' : `/api/admin/flowers/${id}`;
      const res = await this.apiRequest(endpoint, isNew ? 'POST' : 'PUT', payload);
      if (!res.ok) {
        this.toast(res.error || 'Failed to save item changes.', 'error');
        return { ok: false, error: res.error };
      }
      this.toast(`Item "${name}" saved successfully.`, 'success');
      this.closeFlowerModal();
      this.loadFlowers();
      this.loadInventory();
      this.loadStats();
      return { ok: true };
    };

    if (prev && prev.price !== price) {
      this.confirmAction({
        title: `Save changes to ${name}?`,
        message: `Update selling price from ${peso(prev.price)} to ${peso(price)}.`,
        details: [
          ['Current price', peso(prev.price)],
          ['New price', peso(price)]
        ],
        confirmLabel: 'Save price change'
      }, runSave);
    } else {
      await runSave();
    }
  }

  deleteFlower(id) {
    const flower = this.flowers.find(f => f.id === id);
    if (!flower) return;

    this.confirmAction({
      title: 'Archive this flower?',
      message: `Archiving "${flower.name}" hides it from the online store. Past orders referencing it will remain intact.`,
      confirmLabel: 'Archive flower',
      destructive: true
    }, () => this.apiRequest(`/api/admin/flowers/${id}`, 'DELETE'), () => {
      this.toast(`Archived "${flower.name}".`, 'info');
      this.loadFlowers();
      this.loadInventory();
      this.loadStats();
    });
  }

  quickUpdateStock(flowerId, currentStock) {
    const flower = this.flowers.find(f => f.id === flowerId);
    const flowerName = flower ? flower.name : 'this flower';

    this.confirmAction({
      title: `Update stock for ${flowerName}`,
      message: `Current physical count: ${currentStock} stems. Enter the verified new count:`,
      confirmLabel: 'Apply stock count',
      input: {
        type: 'number',
        value: currentStock,
        min: 0,
        required: true,
        label: 'New count (stems):',
        validate: (v) => {
          const n = parseInt(v, 10);
          if (isNaN(n) || n < 0) return 'Stock must be a whole number, 0 or more.';
          return '';
        }
      }
    }, (val) => {
      const n = parseInt(val, 10);
      if (isNaN(n) || n < 0) return { ok: false, error: 'Stock must be a whole number, 0 or more.' };
      return this.apiRequest('/api/admin/inventory/adjust', 'POST', {
        flowerId,
        type: 'correction',
        quantity: n,
        reason: 'Physical Count Reconciliation'
      });
    }, () => {
      this.toast('Stock updated.', 'success');
      this.loadFlowers();
      this.loadInventory();
      this.loadStats();
    });
  }

  // 3.2 Ready-Made Bouquets
  async loadBouquets() {
    await this.fetchBouquetsData();
    this.renderProductsTable();
    this.renderBouquetsTable();
    this.populateBouquetCategoryFilter();
    this.populateProductCategoryDropdowns();
    this.renderProductKPIs();
  }

  populateBouquetCategoryFilter() {
    const select = document.getElementById('bouquets-category-filter');
    if (!select) return;
    const current = select.value;
    const cats = Array.from(new Set(this.bouquets.map(b => b.category).filter(Boolean))).sort();
    select.innerHTML = '<option value="all">All Categories</option>' + cats.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join('');
    select.value = current || 'all';
  }

  handleBouquetSearch(val) {
    this.bouquetSearch = (val || '').toLowerCase().trim();
    this.pagination.bouquets.page = 1;
    this.renderBouquetsTable();
  }

  handleBouquetFilter() {
    const catSelect = document.getElementById('bouquets-category-filter');
    const occSelect = document.getElementById('bouquets-occasion-filter');
    const priceSelect = document.getElementById('bouquets-price-filter');
    this.bouquetCategory = catSelect ? catSelect.value : 'all';
    this.bouquetOccasionFilter = occSelect ? occSelect.value : 'all';
    this.bouquetPriceFilter = priceSelect ? priceSelect.value : 'all';
    this.pagination.bouquets.page = 1;
    this.renderBouquetsTable();
  }

  handleBouquetStatusFilter(val) {
    this.bouquetStatusFilter = val || 'all';
    this.pagination.bouquets.page = 1;
    this.renderBouquetsTable();
  }

  clearBouquetFilters() {
    this.bouquetSearch = '';
    this.bouquetCategory = 'all';
    this.bouquetStatusFilter = 'all';
    this.bouquetOccasionFilter = 'all';
    this.bouquetPriceFilter = 'all';
    this.pagination.bouquets.page = 1;

    const searchInput = document.getElementById('bouquets-search-input');
    if (searchInput) searchInput.value = '';
    const typeSelect = document.getElementById('bouquets-type-filter');
    if (typeSelect) typeSelect.value = 'bouquets';
    const occSelect = document.getElementById('bouquets-occasion-filter');
    if (occSelect) occSelect.value = 'all';
    const catSelect = document.getElementById('bouquets-category-filter');
    if (catSelect) catSelect.value = 'all';
    const statusSelect = document.getElementById('bouquets-status-filter');
    if (statusSelect) statusSelect.value = 'all';
    const priceSelect = document.getElementById('bouquets-price-filter');
    if (priceSelect) priceSelect.value = 'all';

    this.renderBouquetsTable();
  }

  renderBouquetsTable() {
    const tbody = document.getElementById('admin-bouquets-tbody');
    const emptyState = document.getElementById('bouquets-empty-state');
    if (!tbody) return;

    let list = this.bouquets;
    if (this.bouquetCategory && this.bouquetCategory !== 'all') {
      list = list.filter(b => b.category === this.bouquetCategory);
    }
    if (this.bouquetOccasionFilter && this.bouquetOccasionFilter !== 'all') {
      const matchOcc = this.bouquetOccasionFilter.toLowerCase();
      list = list.filter(b => {
        const occString = (b.occasion || '').toLowerCase();
        let occList = [];
        if (Array.isArray(b.occasions)) {
          occList = b.occasions.map(o => String(o).toLowerCase());
        }
        if (b.specs_json) {
          try {
            const parsed = typeof b.specs_json === 'string' ? JSON.parse(b.specs_json) : b.specs_json;
            if (Array.isArray(parsed.occasions)) {
              occList.push(...parsed.occasions.map(o => String(o).toLowerCase()));
            }
          } catch (_) {}
        }
        const matchesKey = (key) => occString.includes(key) || occList.some(o => o.includes(key));
        if (matchOcc === 'birthday') return matchesKey('birthday');
        if (matchOcc === 'anniversary') return matchesKey('anniversary');
        if (matchOcc === 'valentines') return matchesKey('valentin');
        if (matchOcc === 'mothers_day') return matchesKey('mother');
        if (matchOcc === 'graduation') return matchesKey('graduat');
        if (matchOcc === 'congratulations') return matchesKey('congrat');
        if (matchOcc === 'sympathy') return matchesKey('sympath');
        if (matchOcc === 'thank_you') return matchesKey('thank');
        return matchesKey(matchOcc);
      });
    }
    if (this.bouquetPriceFilter && this.bouquetPriceFilter !== 'all') {
      if (this.bouquetPriceFilter === 'under1000') {
        list = list.filter(b => (b.price || 0) < 1000);
      } else if (this.bouquetPriceFilter === '1000_1500') {
        list = list.filter(b => (b.price || 0) >= 1000 && (b.price || 0) <= 1500);
      } else if (this.bouquetPriceFilter === 'above1500') {
        list = list.filter(b => (b.price || 0) > 1500);
      }
    }
    if (this.bouquetStatusFilter && this.bouquetStatusFilter !== 'all') {
      if (this.bouquetStatusFilter === 'available') {
        list = list.filter(b => b.availability !== 'sold_out');
      } else if (this.bouquetStatusFilter === 'sold_out') {
        list = list.filter(b => b.availability === 'sold_out');
      } else if (this.bouquetStatusFilter === 'published') {
        list = list.filter(b => !!b.image);
      } else if (this.bouquetStatusFilter === 'unpublished') {
        list = list.filter(b => !b.image);
      }
    }
    if (this.bouquetSearch) {
      list = list.filter(b =>
        (b.name || '').toLowerCase().includes(this.bouquetSearch) ||
        (b.formula || '').toLowerCase().includes(this.bouquetSearch) ||
        (b.occasion || '').toLowerCase().includes(this.bouquetSearch)
      );
    }

    if (!list.length) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      this.renderPagination('bouquets', 0);
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    const totalRecords = list.length;
    const pag = this.pagination.bouquets;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pag.pageSize));
    if (pag.page > totalPages) pag.page = totalPages;
    if (pag.page < 1) pag.page = 1;

    const start = (pag.page - 1) * pag.pageSize;
    const sliced = list.slice(start, start + pag.pageSize);

    tbody.innerHTML = sliced.map(b => {
      const isSoldOut = b.availability === 'sold_out';
      const imgHtml = b.image ?
        `<img src="${esc(b.image)}" alt="${esc(b.name)}" class="w-10 h-10 rounded-xl object-cover border border-[#E5E7EB] shrink-0" onerror="this.onerror=null; if(window.UI) this.replaceWith(window.UI.placeholderElement('thumb'));">` :
        `<div class="w-10 h-10 rounded-xl bg-stone-100 border border-stone-200 flex flex-col items-center justify-center text-stone-400 shrink-0" title="No image uploaded">
          <svg class="w-4 h-4 text-stone-400 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21V11m0 0C10.5 8 7 7 7 3c3.5 0 4.5 3.5 5 8zm0 0c1.5-3 5-4 5-8-3.5 0-4.5 3.5-5 8z"/></svg>
        </div>`;

      return `
        <tr class="hover:bg-[#EBF1EC] transition-colors duration-150">
          <td class="py-3.5 px-4">
            <div class="flex items-center gap-3">
              ${imgHtml}
              <div>
                <p class="font-bold text-[#302C2A]">${esc(b.name)}</p>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <p class="text-[11px] text-[#6E6864] line-clamp-1 max-w-xs">${esc(b.formula || 'Bespoke Recipe')}</p>
                  ${!b.image ? '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">No image</span>' : '<span class="px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">Published</span>'}
                </div>
              </div>
            </div>
          </td>
          <td class="py-3.5 px-4"><span class="px-2.5 py-0.5 rounded-lg bg-[#EBF1EC] text-[#6E6864] border border-[#E5ECE6] text-[10px] font-semibold">${esc(b.category)}</span></td>
          <td class="py-3.5 px-4">
            <div class="flex flex-wrap gap-1 max-w-xs">
              ${(b.occasion || 'General').split(',').map(s => s.trim()).filter(Boolean).map(tag => `<span class="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[#FFF9F5] text-[#6E6864] border border-[#E5ECE6] whitespace-nowrap">${esc(tag)}</span>`).join('')}
            </div>
          </td>
          <td class="py-3.5 px-4 font-mono font-bold text-[#302C2A] text-right tabular-nums">${peso(b.price)}</td>
          <td class="py-3.5 px-4">
            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${isSoldOut ? 'bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]' : 'bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]'}">
              ${isSoldOut ? 'Sold Out' : 'Available'}
            </span>
          </td>
          <td class="py-3.5 px-4 text-right whitespace-nowrap">
            ${this.renderBouquetsActionButtons(b)}
          </td>
        </tr>
      `;
    }).join('');

    this.renderPagination('bouquets', totalRecords);
  }

  openBouquetModal(id = null) {
    const modal = document.getElementById('admin-bouquet-modal');
    const form = document.getElementById('admin-bouquet-form');
    const title = document.getElementById('bouquet-modal-title');
    if (!modal || !form) return;

    form.reset();
    this.populateProductCategoryDropdowns();
    document.getElementById('bouquet-field-id').value = '';
    this.syncImagePreview('bouquet', '');
    document.querySelectorAll('input[name="bouquet-occasions"]').forEach(cb => cb.checked = false);

    if (id) {
      const bq = this.bouquets.find(b => b.id === id);
      if (bq) {
        if (title) title.innerText = 'Edit Ready-Made Bouquet';
        document.getElementById('bouquet-field-id').value = bq.id;
        document.getElementById('bouquet-field-name').value = bq.name || '';
        document.getElementById('bouquet-field-category').value = bq.category || 'Ready-Made Bouquets';
        document.getElementById('bouquet-field-occasion').value = bq.occasion || '';
        document.getElementById('bouquet-field-price').value = bq.price || '';
        document.getElementById('bouquet-field-availability').value = bq.availability || 'available';
        document.getElementById('bouquet-field-formula').value = bq.formula || '';
        document.getElementById('bouquet-field-desc').value = bq.description || '';
        this.syncImagePreview('bouquet', bq.image || '');
        const rawBqStock = parseInt(this.getBouquetStock(bq), 10);
        const bqStock = (!isNaN(rawBqStock) && rawBqStock >= 0) ? rawBqStock : 0;
        if (document.getElementById('bouquet-field-stock')) document.getElementById('bouquet-field-stock').value = bqStock;

        const rawTags = []
          .concat(bq.occasions || [])
          .concat(bq.specs && Array.isArray(bq.specs.occasions) ? bq.specs.occasions : [])
          .concat(bq.occasion ? bq.occasion.split(',').map(s => s.trim()) : [])
          .map(s => String(s).toLowerCase().trim())
          .filter(Boolean);

        document.querySelectorAll('input[name="bouquet-occasions"]').forEach(cb => {
          const val = cb.value.toLowerCase().trim();
          const isMatch = rawTags.some(t => {
            if (t === val) return true;
            if (val === "valentine's day" && (t === "valentine's" || t === 'valentines' || t === "valentine's day")) return true;
            if (val === "mother's day" && (t === "mother's day" || t === 'mothers day' || t.includes('mother'))) return true;
            if (val === 'sympathy' && (t === 'sympathy / funeral' || t === 'sympathy/funeral' || t === 'funeral')) return true;
            return false;
          });
          cb.checked = isMatch;
        });
      }
    } else {
      if (title) title.innerText = 'Add New Ready-Made Bouquet';
      if (document.getElementById('bouquet-field-stock')) document.getElementById('bouquet-field-stock').value = 10;
    }

    this.updateBouquetModalStockStatusPreview();
    modal.classList.remove('hidden');
  }

  closeBouquetModal() {
    document.getElementById('admin-bouquet-modal')?.classList.add('hidden');
  }

  updateBouquetModalStockStatusPreview() {
    const statusContainer = document.getElementById('bouquet-modal-stock-status');
    if (!statusContainer) return;
    const stockInput = document.getElementById('bouquet-field-stock');
    const availSelect = document.getElementById('bouquet-field-availability');
    const rawStock = stockInput?.value;
    const stock = rawStock !== '' && !isNaN(parseInt(rawStock, 10)) ? parseInt(rawStock, 10) : 0;
    const avail = availSelect ? availSelect.value : 'available';
    const globalTh = this.getGlobalLowStockThreshold();

    if (avail === 'unavailable') {
      statusContainer.innerHTML = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-stone-100 text-stone-600 border border-stone-200">Unavailable (Storefront Hidden)</span>';
      return;
    }

    if (stock <= 0 || avail === 'sold_out') {
      statusContainer.innerHTML = '<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]">Out of Stock (0 bouquets)</span>';
    } else if (stock <= globalTh) {
      statusContainer.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">Low Stock (1–${globalTh} bouquets)</span>`;
    } else {
      statusContainer.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]">In Stock (&gt;${globalTh} bouquets)</span>`;
    }
  }

  editBouquet(id) {
    this.openBouquetModal(id);
  }

  async saveBouquet(e) {
    e.preventDefault();
    const id = document.getElementById('bouquet-field-id')?.value.trim();
    const name = document.getElementById('bouquet-field-name')?.value.trim();
    const category = document.getElementById('bouquet-field-category')?.value;

    const checkedOccasions = Array.from(document.querySelectorAll('input[name="bouquet-occasions"]:checked')).map(cb => cb.value);
    const occasionString = checkedOccasions.join(', ');
    const occInput = document.getElementById('bouquet-field-occasion');
    if (occInput) occInput.value = occasionString;
    const occasion = occasionString || (occInput ? occInput.value.trim() : '');

    const price = parseFloat(document.getElementById('bouquet-field-price')?.value);
    const availability = document.getElementById('bouquet-field-availability')?.value;
    const formula = document.getElementById('bouquet-field-formula')?.value.trim();
    const description = document.getElementById('bouquet-field-desc')?.value.trim();
    const image = document.getElementById('bouquet-field-image')?.value.trim() || '';
    const stockInput = document.getElementById('bouquet-field-stock');
    const rawStock = stockInput ? stockInput.value.trim() : '';
    if (rawStock === '' || !/^\d+$/.test(rawStock) || isNaN(parseInt(rawStock, 10)) || parseInt(rawStock, 10) < 0) {
      this.toast('Please enter a valid stock quantity (whole number >= 0).', 'error');
      return;
    }
    const finalStock = parseInt(rawStock, 10);

    const isNew = !id;
    const prev = isNew ? null : this.bouquets.find(b => b.id === id);
    const payload = {
      name,
      category,
      occasion,
      price,
      availability,
      formula,
      description,
      image,
      stockCount: finalStock,
      specs: {
        ...(prev?.specs || {}),
        occasions: checkedOccasions,
        stockCount: finalStock,
        unitOfMeasure: 'bouquets'
      }
    };

    const runSave = async () => {
      // If a Cloudinary upload is in progress, wait for it to finish before saving
      // so the hidden image field has the final https:// URL, not a data: URL.
      if (this._pendingImageUpload) await this._pendingImageUpload;
      // Re-read the image field after any pending upload resolves
      payload.image = document.getElementById('bouquet-field-image')?.value.trim() || '';

      const btn = document.querySelector('#admin-bouquet-form [type="submit"]');
      if (btn) { btn.disabled = true; btn._savedText = btn.innerText; btn.innerText = 'Saving…'; }
      try {
        const endpoint = isNew ? '/api/admin/bouquets' : `/api/admin/bouquets/${id}`;
        const res = await this.apiRequest(endpoint, isNew ? 'POST' : 'PUT', payload);
        if (!res.ok) {
          this.toast(res.data?.error || res.error || 'Failed to save bouquet changes.', 'error');
          return { ok: false, error: res.data?.error || res.error };
        }
        this.toast(`Bouquet "${name}" saved successfully.`, 'success');
        this.closeBouquetModal();
        this.loadBouquets();
        this.loadStats();
        return { ok: true };
      } finally {
        if (btn) { btn.disabled = false; btn.innerText = btn._savedText || 'Save Bouquet Changes'; }
      }
    };

    if (prev && prev.price !== price) {
      this.confirmAction({
        title: `Save changes to ${name}?`,
        message: `Update bouquet selling price from ${peso(prev.price)} to ${peso(price)}.`,
        details: [
          ['Current price', peso(prev.price)],
          ['New price', peso(price)]
        ],
        confirmLabel: 'Save price change'
      }, runSave);
    } else {
      await runSave();
    }
  }

  deleteBouquet(id) {
    const bq = this.bouquets.find(b => b.id === id);
    if (!bq) return;

    this.confirmAction({
      title: 'Archive this bouquet?',
      message: `Archiving "${bq.name}" hides it from the online store. Past orders referencing it will remain intact.`,
      confirmLabel: 'Archive bouquet',
      destructive: true
    }, () => this.apiRequest(`/api/admin/bouquets/${id}`, 'DELETE'), () => {
      this.toast(`Archived "${bq.name}".`, 'info');
      this.loadBouquets();
      this.loadStats();
    });
  }

  // 3.3 Categories
  async loadCategories() {
    await this.fetchCategoriesData();
    this.populateProductCategoryDropdowns();
    this.renderCategoryManageList();
    this.renderCategoriesTable();
  }

  handleCategorySearch(val) {
    this.categorySearch = (val || '').toLowerCase().trim();
    this.pagination.categories.page = 1;
    this.renderCategoriesTable();
  }

  handleCategoryTypeFilter(val) {
    this.categoryTypeFilter = val || 'all';
    this.pagination.categories.page = 1;
    this.renderCategoriesTable();
  }

  handleCategoryStatusFilter(val) {
    this.categoryStatusFilter = val || 'all';
    this.pagination.categories.page = 1;
    this.renderCategoriesTable();
  }

  clearCategoryFilters() {
    this.categorySearch = '';
    this.categoryTypeFilter = 'all';
    this.categoryStatusFilter = 'all';
    this.pagination.categories.page = 1;

    const searchInput = document.getElementById('categories-search-input');
    if (searchInput) searchInput.value = '';
    const typeSelect = document.getElementById('categories-type-filter');
    if (typeSelect) typeSelect.value = 'all';
    const statusSelect = document.getElementById('categories-status-filter');
    if (statusSelect) statusSelect.value = 'all';

    this.renderCategoriesTable();
  }

  renderCategoriesTable() {
    let list = this.categories;
    if (this.categoryTypeFilter && this.categoryTypeFilter !== 'all') {
      list = list.filter(c => c.type === this.categoryTypeFilter);
    }
    if (this.categoryStatusFilter && this.categoryStatusFilter !== 'all') {
      if (this.categoryStatusFilter === 'active') list = list.filter(c => c.active);
      else if (this.categoryStatusFilter === 'archived') list = list.filter(c => !c.active);
    }
    if (this.categorySearch) {
      list = list.filter(c =>
        (c.name || '').toLowerCase().includes(this.categorySearch) ||
        (c.description || '').toLowerCase().includes(this.categorySearch)
      );
    }
    this.renderCategoriesList(list);
  }

  renderCategoriesList(list) {
    const tbody = document.getElementById('admin-categories-tbody');
    const emptyState = document.getElementById('categories-empty-state');
    if (!tbody) return;

    if (!list.length) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      this.renderPagination('categories', 0);
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    const totalRecords = list.length;
    const pag = this.pagination.categories;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pag.pageSize));
    if (pag.page > totalPages) pag.page = totalPages;
    if (pag.page < 1) pag.page = 1;

    const start = (pag.page - 1) * pag.pageSize;
    const sliced = list.slice(start, start + pag.pageSize);

    tbody.innerHTML = sliced.map(c => `
      <tr class="hover:bg-[#EBF1EC] transition-colors duration-150">
        <td class="py-3.5 px-4 font-bold text-[#302C2A]">${esc(c.name)}</td>
        <td class="py-3.5 px-4">
          <span class="px-2.5 py-1 rounded-md text-[10px] font-bold ${c.type === 'flower' ? 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]' : (c.type === 'bouquet' ? 'bg-[#EBF1EC] text-[#647D69] border border-[#E5ECE6]' : 'bg-[#EBF1EC] text-[#6E6864] border border-[#E5ECE6]')}">
            ${c.type === 'flower' ? 'Stems Only' : (c.type === 'bouquet' ? 'Bouquets Only' : 'Stems & Bouquets')}
          </span>
        </td>
        <td class="py-3.5 px-4 text-[#6E6864] text-[11px] max-w-xs truncate">${esc(c.description || '—')}</td>
        <td class="py-3.5 px-4 font-mono font-medium text-[#302C2A] tabular-nums">${c.productCount || 0} active products</td>
        <td class="py-3.5 px-4">
          <span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${c.active ? 'bg-[#DCFCE7] text-[#166534] border border-[#BBF7D0]' : 'bg-stone-100 text-stone-600 border border-stone-200'}">
            ${c.active ? 'Active' : 'Archived'}
          </span>
        </td>
        <td class="py-3.5 px-4 text-right space-x-1.5">
          <button type="button" onclick="window.adminApp.openCategoryModal('${esc(c.id)}')" class="btn-tactile px-2.5 py-1 rounded-lg bg-[#EBF1EC] hover:bg-[#EBF1EC] text-[#302C2A] hover:text-[#647D69] hover:border-[#E5ECE6] border border-[#E5ECE6] font-medium text-[11px] transition">Edit</button>
          ${c.active ? `
            <button type="button" onclick="window.adminApp.deactivateCategory('${esc(c.id)}')" class="btn-tactile px-2 py-1 rounded-lg hover:bg-rose-50 text-[#6E6864] hover:text-rose-700 text-[11px] transition">Deactivate</button>
          ` : ''}
        </td>
      </tr>
    `).join('');

    this.renderPagination('categories', totalRecords);
  }

  openCategoryModal(id = null) {
    const modal = document.getElementById('admin-category-modal');
    const form = document.getElementById('admin-category-form');
    const title = document.getElementById('category-modal-title');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('category-field-id').value = '';

    if (id) {
      const cat = this.categories.find(c => c.id === id);
      if (cat) {
        if (title) title.innerText = 'Edit Category';
        document.getElementById('category-field-id').value = cat.id;
        document.getElementById('category-field-name').value = cat.name || '';
        document.getElementById('category-field-type').value = cat.type || 'both';
        document.getElementById('category-field-desc').value = cat.description || '';
      }
    } else {
      if (title) title.innerText = 'Add Category';
    }

    modal.classList.remove('hidden');
  }

  closeCategoryModal() {
    document.getElementById('admin-category-modal')?.classList.add('hidden');
  }

  async saveCategory(e) {
    e.preventDefault();
    const id = document.getElementById('category-field-id')?.value.trim();
    const name = document.getElementById('category-field-name')?.value.trim();
    const type = document.getElementById('category-field-type')?.value;
    const description = document.getElementById('category-field-desc')?.value.trim();

    const isNew = !id;
    const endpoint = isNew ? '/api/admin/categories' : `/api/admin/categories/${id}`;
    const res = await this.apiRequest(endpoint, isNew ? 'POST' : 'PUT', { name, type, description });
    if (!res.ok) {
      this.toast(res.error || 'Failed to save category.', 'error');
      return;
    }
    this.toast(`Category "${name}" saved.`, 'success');
    this.closeCategoryModal();
    this.loadCategories();
  }

  deactivateCategory(id) {
    const cat = this.categories.find(c => c.id === id);
    if (!cat) return;

    this.confirmAction({
      title: `Deactivate category "${cat.name}"?`,
      message: 'Deactivating will hide this category from future assignments.',
      confirmLabel: 'Deactivate',
      destructive: true
    }, () => this.apiRequest(`/api/admin/categories/${id}`, 'DELETE'), () => {
      this.toast(`Category "${cat.name}" deactivated.`, 'info');
      this.loadCategories();
    });
  }

  // --- Product Image Management ---
  syncImagePreview(kind, url) {
    const preview = document.getElementById(`${kind}-image-preview`);
    const emptyState = document.getElementById(`${kind}-image-empty-state`);
    const container = document.getElementById(`${kind}-image-preview-container`);
    const status = document.getElementById(`${kind}-image-status`);
    const hiddenField = document.getElementById(`${kind}-field-image`);
    const removeBtn = document.getElementById(`${kind}-remove-btn`);
    const btnText = document.getElementById(`${kind}-upload-btn-text`);

    if (hiddenField) hiddenField.value = url || '';

    if (url) {
      if (preview) {
        preview.src = url;
        preview.classList.remove('hidden');
        preview.style.objectFit = 'contain';
      }
      if (emptyState) emptyState.classList.add('hidden');
      if (container) {
        container.classList.remove('border-dashed');
        container.classList.add('border-solid');
      }
      if (status) {
        status.innerText = 'Image uploaded';
        status.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800';
      }
      if (removeBtn) removeBtn.classList.remove('hidden');
      if (btnText) btnText.innerText = 'Replace Image';
    } else {
      if (preview) {
        preview.src = '';
        preview.classList.add('hidden');
      }
      if (emptyState) emptyState.classList.remove('hidden');
      if (container) {
        container.classList.remove('border-solid');
        container.classList.add('border-dashed');
      }
      if (status) {
        status.innerText = 'No image uploaded';
        status.className = 'text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-200 text-stone-700';
      }
      if (removeBtn) removeBtn.classList.add('hidden');
      if (btnText) btnText.innerText = kind === 'flower' ? 'Upload Flower Image' : 'Upload Bouquet Image';
    }
  }

  removeProductImage(kind) {
    this.syncImagePreview(kind, '');
    this.toast(`Removed ${kind} photograph. Reverted to neutral placeholder.`, 'info');
  }

  async handleProductImageUpload(input, kind) {
    const file = input.files && input.files[0];
    if (!file) return;

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      this.toast('Only PNG, JPG, JPEG, and WebP images are allowed.', 'error');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.toast('Image file exceeds the 5 MB limit. Please select a smaller photo.', 'error');
      input.value = '';
      return;
    }

    // Block the Save button while Cloudinary upload is in progress so the first
    // Save click cannot fire with a data: URL (which the server rejects).
    let resolveUpload;
    this._pendingImageUpload = new Promise(r => { resolveUpload = r; });
    const formId = kind === 'bouquet' ? '#admin-bouquet-form' : '#admin-product-form';
    const saveBtn = document.querySelector(`${formId} [type="submit"]`);
    if (saveBtn) { saveBtn.disabled = true; saveBtn._savedText = saveBtn.innerText; saveBtn.innerText = 'Uploading image…'; }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target.result;
      this.syncImagePreview(kind, dataUrl);

      const folder = this.currentProductTab === 'bouquets' ? 'bouquets' : 'products';
      const res = await this.uploadImage(dataUrl, file.name, folder);
      if (res && res.ok && res.data && res.data.url) {
        this.syncImagePreview(kind, res.data.url);
        this.toast('Photograph uploaded successfully to atelier assets.', 'success');
      } else {
        this.toast((res && res.data && res.data.error) || 'Failed to upload image.', 'error');
      }
      input.value = '';
      this._pendingImageUpload = null;
      resolveUpload();
      if (saveBtn) { saveBtn.disabled = false; saveBtn.innerText = saveBtn._savedText || 'Save'; }
    };
    reader.readAsDataURL(file);
  }

  async uploadImage(dataUrl, filename, folder) {
    const res = await this.apiRequest('/api/admin/upload', 'POST', {
      name: filename,
      dataUrl: dataUrl,
      folder: folder || 'misc'
    });
    return res;
  }

  // =========================================================================
  // SCREEN 4: INVENTORY MANAGEMENT
  // =========================================================================
  async loadInventory() {
    const res = await this.apiRequest('/api/admin/inventory/summary');
    if (!res.ok) return;
    this.inventorySummary = res.data;
    this.renderInventorySummaryCards();
    this.renderInventoryTable();
    this.updateNotificationBadge();
  }

  renderInventorySummaryCards() {
    const container = document.getElementById('inventory-summary-cards');
    if (!container) return;

    const s = this.inventorySummary || {};
    const flowersList = Array.isArray(this.flowers) && this.flowers.length > 0 ? this.flowers : (s.flowers || []);

    const trackedItems = s.trackedItems || s.totalFlowers || flowersList.length || 0;

    let lowCount = 0;
    let outCount = 0;

    if (flowersList.length > 0) {
      for (const f of flowersList) {
        const stock = f.stockCount !== undefined ? f.stockCount : (f.stock_count || 0);
        const threshold = f.lowStockThreshold !== undefined ? f.lowStockThreshold : (f.low_stock_threshold || 5);
        const isSoldOut = stock <= 0 || f.availability === 'sold_out';
        if (isSoldOut) {
          outCount++;
        } else if (stock <= threshold) {
          lowCount++;
        }
      }
    } else {
      lowCount = s.lowStockCount || 0;
      outCount = s.outOfStockCount || 0;
    }

    const tz = (this.shopSettings?.store?.timezone) || 'Asia/Manila';
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

    let movementsToday = 0;
    if (Array.isArray(this.stockTransactions) && this.stockTransactions.length > 0) {
      movementsToday = this.stockTransactions.filter(t => {
        try {
          const dStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(t.createdAt || t.created_at));
          return dStr === todayStr;
        } catch (_) { return false; }
      }).length;
    } else if (typeof s.movementsToday === 'number') {
      movementsToday = s.movementsToday;
    }

    container.innerHTML = [
      this.kpiCardHTML({
        id: 'inv-kpi-tracked-items',
        label: 'Tracked Items',
        value: `<span id="inv-kpi-count-tracked">${trackedItems}</span>`,
        subtext: 'Active flowers & materials',
        iconBg: 'bg-[#EBF1EC]',
        iconColor: 'text-[#647D69]',
        iconSvg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>'
      }),
      this.kpiCardHTML({
        id: 'inv-kpi-low-stock',
        label: 'Low Stock',
        value: `<span id="inv-kpi-count-low">${lowCount}</span>`,
        subtext: '≤ threshold, replenishment required',
        iconBg: 'bg-[#FEF3C7]',
        iconColor: 'text-[#D97706]',
        iconSvg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>'
      }),
      this.kpiCardHTML({
        id: 'inv-kpi-out-of-stock',
        label: 'Out of Stock',
        value: `<span id="inv-kpi-count-out">${outCount}</span>`,
        subtext: '0 available stems or units',
        iconBg: 'bg-[#FEE2E2]',
        iconColor: 'text-[#DC2626]',
        iconSvg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>'
      }),
      this.kpiCardHTML({
        id: 'inv-kpi-movements-today',
        label: 'Stock Movements Today',
        value: `<span id="inv-kpi-count-movements">${movementsToday}</span>`,
        subtext: 'Additions, deductions & adjustments',
        iconBg: 'bg-[#DCFCE7]',
        iconColor: 'text-[#166534]',
        iconSvg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>'
      })
    ].join('');
  }

  handleInventorySearch(val) {
    this.inventorySearch = (val || '').toLowerCase().trim();
    this.pagination.inventory.page = 1;
    this.renderInventoryTable();
  }

  handleInventoryFilter(val) {
    this.inventoryStatus = val || 'all';
    this.pagination.inventory.page = 1;
    this.renderInventoryTable();
  }

  handleInventoryTypeFilter(val) {
    this.inventoryTypeFilter = val || 'all';
    this.pagination.inventory.page = 1;
    this.renderInventoryTable();
  }

  clearInventoryFilters() {
    this.inventorySearch = '';
    this.inventoryStatus = 'all';
    this.inventoryTypeFilter = 'all';
    this.pagination.inventory.page = 1;
    const sInput = document.getElementById('inventory-search-input');
    if (sInput) sInput.value = '';
    const stFilter = document.getElementById('inventory-status-filter');
    if (stFilter) stFilter.value = 'all';
    const tFilter = document.getElementById('inventory-type-filter');
    if (tFilter) tFilter.value = 'all';
    this.renderInventoryTable();
  }

  renderInventoryTable() {
    const tbody = document.getElementById('admin-inventory-tbody');
    const countText = document.getElementById('inventory-count-text');
    const emptyState = document.getElementById('inventory-empty-state');
    if (!tbody) return;

    // Include bouquets only if they have legitimate tracked inventory records
    const trackedBouquets = (this.bouquets || []).filter(b => b.stockCount !== undefined && b.stockCount !== null && !b.archived).map(b => ({
      ...b,
      itemType: 'bouquet',
      unitOfMeasure: b.unitOfMeasure || 'bouquets',
      stockCount: Number(b.stockCount) || 0,
      lowStockThreshold: b.lowStockThreshold || 5,
      availability: b.availability || 'available'
    }));

    let list = [...(this.flowers || []), ...trackedBouquets];

    const globalTh = this.getGlobalLowStockThreshold();
    if (this.inventoryStatus === 'available') {
      list = list.filter(f => f.stockCount > globalTh && f.availability !== 'sold_out');
    } else if (this.inventoryStatus === 'limited') {
      list = list.filter(f => f.stockCount > 0 && f.stockCount <= globalTh);
    } else if (this.inventoryStatus === 'sold_out') {
      list = list.filter(f => f.stockCount <= 0 || f.availability === 'sold_out');
    }

    if (this.inventoryTypeFilter && this.inventoryTypeFilter !== 'all') {
      const targetType = this.inventoryTypeFilter;
      list = list.filter(f => {
        const t = (f.itemType || 'flower').toLowerCase();
        if (targetType === 'bouquet') {
          return t === 'bouquet' || t === 'ready-made bouquets';
        }
        if (targetType === 'fillers_foliage') {
          return t === 'fillers_foliage' || t === 'filler' || t === 'foliage' ||
            (f.category || '').toLowerCase().includes('filler') ||
            (f.category || '').toLowerCase().includes('foliage');
        }
        return t === targetType;
      });
    }

    if (this.inventorySearch) {
      list = list.filter(f =>
        (f.name || '').toLowerCase().includes(this.inventorySearch) ||
        (f.category || '').toLowerCase().includes(this.inventorySearch)
      );
    }

    if (countText) countText.innerText = `Showing ${list.length} tracked inventory records`;

    if (!list.length) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      this.renderPagination('inventory', 0);
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    const totalRecords = list.length;
    const pag = this.pagination.inventory;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pag.pageSize));
    if (pag.page > totalPages) pag.page = totalPages;
    if (pag.page < 1) pag.page = 1;

    const start = (pag.page - 1) * pag.pageSize;
    const sliced = list.slice(start, start + pag.pageSize);

    tbody.innerHTML = sliced.map(f => {
      const stock = f.stockCount || 0;
      const threshold = this.getGlobalLowStockThreshold();
      const isSoldOut = stock <= 0 || f.availability === 'sold_out';
      const isLow = stock > 0 && stock <= threshold;

      const badge = this.stockStatusBadge(stock, threshold, f.availability);
      const typeBadge = this.itemTypeBadge(f.itemType);

      const imgHtml = f.image
        ? `<img src="${esc(f.image)}" alt="${esc(f.name)}" class="w-8 h-8 rounded-lg object-cover border border-[#E5ECE6] shrink-0" onerror="this.onerror=null;this.classList.add('hidden');">`
        : `<div class="w-8 h-8 rounded-lg bg-[#FFF9F5] border border-[#E5ECE6] flex items-center justify-center text-[#647D69] shrink-0 font-serif font-bold text-xs">${esc(f.name.charAt(0))}</div>`;

      // Find last updated time from recent transactions or fallback to updatedAt
      const lastTx = (this.stockTransactions || []).find(t => t.flowerId === f.id);
      const lastDate = lastTx ? new Date(lastTx.createdAt || lastTx.created_at) : (f.updatedAt ? new Date(f.updatedAt) : null);
      const lastUpdatedStr = lastDate ? lastDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

      return `
        <tr class="hover:bg-[#EBF1EC] transition-colors duration-150">
          <td class="py-3 px-4">
            <div class="flex items-center gap-2.5">
              ${imgHtml}
              <div class="min-w-0">
                <span class="font-bold text-[#302C2A] block truncate">${esc(f.name)}</span>
                <div class="mt-0.5 text-[10px] text-[#6E6864] font-medium">${esc(f.itemType || 'flower')}</div>
              </div>
            </div>
          </td>
          <td class="py-3 px-4 text-[#6E6864] font-medium">${esc(f.category || 'General')}</td>
          <td class="py-3 px-4 text-[#6E6864] font-medium">${esc(f.unitOfMeasure || 'stems')}</td>
          <td class="py-3 px-4 font-mono font-bold text-sm text-right tabular-nums ${isSoldOut ? 'text-red-700' : (isLow ? 'text-amber-700' : 'text-[#302C2A]')}">
            ${stock.toLocaleString()}
          </td>
          <td class="py-3 px-4 text-[#6E6864] font-mono text-[11px] tabular-nums">≤ ${threshold} ${esc(f.unitOfMeasure || 'stems')}</td>
          <td class="py-3 px-4 text-xs font-semibold ${isSoldOut ? 'text-rose-700' : (isLow ? 'text-amber-700' : 'text-emerald-700')}">
            ${isSoldOut ? 'Out of Stock' : (isLow ? 'Low Stock' : 'In Stock')}
          </td>
          <td class="py-3 px-4 font-mono text-[11px] text-[#6E6864] tabular-nums">${lastUpdatedStr}</td>
          <td class="py-3 px-4 text-right whitespace-nowrap">
            ${this.renderInventoryActionButtons(f)}
          </td>
        </tr>
      `;
    }).join('');

    this.renderPagination('inventory', totalRecords);
  }

  async viewItemHistory(flowerId, flowerName) {
    this.switchTab('reports');
    if (flowerName) {
      this.reportsStockSearch = String(flowerName).trim();
      const input = document.getElementById('reports-stock-search');
      if (input) input.value = String(flowerName).trim();
    }
    if (this.pagination.reportsStock) this.pagination.reportsStock.page = 1;
    this.renderReportsStockTable();
    this.scrollToStockHistory();
  }

  async openStockHistoryModal(filterFlowerName = null) {
    const modal = document.getElementById('admin-stock-history-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const searchInput = document.getElementById('history-search-input');
    if (filterFlowerName) {
      if (searchInput) searchInput.value = filterFlowerName;
      this.historySearch = String(filterFlowerName).toLowerCase().trim();
    } else {
      if (searchInput) searchInput.value = '';
      this.historySearch = '';
    }
    this.pagination.history.page = 1;
    if (!this.stockTransactions || !this.stockTransactions.length) {
      await this.loadStockHistory();
    } else {
      this.renderStockHistoryTable();
    }
  }

  closeStockHistoryModal() {
    const modal = document.getElementById('admin-stock-history-modal');
    if (modal) modal.classList.add('hidden');
  }

  // Stock Movement History
  async loadStockHistory() {
    const res = await this.apiRequest('/api/admin/inventory/history?limit=200');
    if (!res.ok) return;
    this.stockTransactions = res.data.transactions || [];
    this.renderStockHistoryTable();
    this.renderInventorySummaryCards();
  }

  handleHistorySearch(val) {
    this.historySearch = (val || '').toLowerCase().trim();
    this.pagination.history.page = 1;
    this.renderStockHistoryTable();
  }

  handleHistoryTypeFilter(val) {
    this.historyType = val || 'all';
    this.pagination.history.page = 1;
    this.renderStockHistoryTable();
  }

  handleHistoryDateFilter(val) {
    this.historyDateFilter = val || 'all';
    const customBox = document.getElementById('history-custom-date-box');
    if (customBox) {
      if (this.historyDateFilter === 'custom') {
        customBox.classList.remove('hidden');
        const sEl = document.getElementById('history-custom-start');
        const eEl = document.getElementById('history-custom-end');
        if (sEl && !sEl.value) {
          const d = new Date();
          d.setDate(d.getDate() - 7);
          sEl.value = d.toISOString().slice(0, 10);
        }
        if (eEl && !eEl.value) {
          eEl.value = new Date().toISOString().slice(0, 10);
        }
        this.historyCustomStart = sEl ? sEl.value : '';
        this.historyCustomEnd = eEl ? eEl.value : '';
      } else {
        customBox.classList.add('hidden');
      }
    }
    this.pagination.history.page = 1;
    this.renderStockHistoryTable();
  }

  handleHistoryCustomDateChange() {
    this.historyCustomStart = document.getElementById('history-custom-start')?.value || '';
    this.historyCustomEnd = document.getElementById('history-custom-end')?.value || '';
    this.pagination.history.page = 1;
    this.renderStockHistoryTable();
  }

  clearHistoryFilters() {
    this.historySearch = '';
    this.historyType = 'all';
    this.historyDateFilter = 'all';
    this.historyCustomStart = '';
    this.historyCustomEnd = '';
    this.pagination.history.page = 1;
    const sInput = document.getElementById('history-search-input');
    if (sInput) sInput.value = '';
    const tFilter = document.getElementById('history-type-filter');
    if (tFilter) tFilter.value = 'all';
    const dFilter = document.getElementById('history-date-filter');
    if (dFilter) dFilter.value = 'all';
    const customBox = document.getElementById('history-custom-date-box');
    if (customBox) customBox.classList.add('hidden');
    const sEl = document.getElementById('history-custom-start');
    if (sEl) sEl.value = '';
    const eEl = document.getElementById('history-custom-end');
    if (eEl) eEl.value = '';
    this.renderStockHistoryTable();
  }

  renderStockHistoryTable() {
    const tbody = document.getElementById('admin-stock-history-tbody');
    const hClear = document.getElementById('history-clear-filters-btn');
    if (hClear) hClear.classList.toggle('filters-clear-hidden', !(this.historySearch || (this.historyType || 'all') !== 'all' || (this.historyDateFilter || 'all') !== 'all'));
    const emptyState = document.getElementById('history-empty-state');
    if (!tbody) return;

    let list = this.stockTransactions;
    if (this.historyType !== 'all') {
      list = list.filter(t => t.type === this.historyType);
    }
    if (this.historyDateFilter && this.historyDateFilter !== 'all') {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const past7Days = now.getTime() - 7 * 24 * 60 * 60 * 1000;
      const past30Days = now.getTime() - 30 * 24 * 60 * 60 * 1000;

      list = list.filter(t => {
        const itemTime = new Date(t.createdAt || t.created_at || 0).getTime();
        if (this.historyDateFilter === 'today') {
          return itemTime >= todayStart;
        } else if (this.historyDateFilter === 'week') {
          return itemTime >= past7Days;
        } else if (this.historyDateFilter === 'month') {
          return itemTime >= past30Days;
        } else if (this.historyDateFilter === 'custom') {
          const tz = (this.shopSettings?.store?.timezone) || 'Asia/Manila';
          let itemDateStr = '';
          try {
            itemDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date(itemTime));
          } catch (_) {
            itemDateStr = new Date(itemTime).toISOString().slice(0, 10);
          }
          if (this.historyCustomStart && itemDateStr < this.historyCustomStart) return false;
          if (this.historyCustomEnd && itemDateStr > this.historyCustomEnd) return false;
          return true;
        }
        return true;
      });
    }
    if (this.historySearch) {
      list = list.filter(t =>
        (t.flowerName || '').toLowerCase().includes(this.historySearch) ||
        (t.reason || '').toLowerCase().includes(this.historySearch) ||
        (t.orderNumber || '').toLowerCase().includes(this.historySearch)
      );
    }

    if (!list.length) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      this.renderPagination('history', 0);
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    const totalRecords = list.length;
    const pag = this.pagination.history;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pag.pageSize));
    if (pag.page > totalPages) pag.page = totalPages;
    if (pag.page < 1) pag.page = 1;

    const start = (pag.page - 1) * pag.pageSize;
    const sliced = list.slice(start, start + pag.pageSize);

    tbody.innerHTML = sliced.map(t => {
      const isPos = t.quantityChange > 0;
      const typeLabel = {
        'restock': 'Stock In (+)',
        'deduct': 'Stock Out (-)',
        'correction': 'Adjustment (=)',
        'order_fulfillment': 'Order Deduction',
        'order_restoration': 'Order Restoration'
      }[t.type] || esc(t.type || 'Movement');

      const tDate = new Date(t.createdAt || t.created_at || Date.now());
      const dateStr = tDate.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + tDate.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });

      return `
        <tr class="hover:bg-[#EBF1EC] transition-colors duration-150">
          <td class="py-3 px-4 font-mono text-[11px] text-[#6E6864] tabular-nums whitespace-nowrap">${dateStr}</td>
          <td class="py-3 px-4 font-bold text-[#302C2A]">${esc(t.flowerName || '—')}</td>
          <td class="py-3 px-4 text-xs font-medium text-[#302C2A]">${esc(typeLabel)}</td>
          <td class="py-3 px-4 font-mono font-bold text-xs text-right tabular-nums ${isPos ? 'text-emerald-700' : 'text-red-700'}">
            ${isPos ? `+${t.quantityChange}` : `${t.quantityChange}`}
          </td>
          <td class="py-3 px-4 font-mono text-[11px] text-[#6E6864] text-right tabular-nums">${t.previousStock !== undefined && t.previousStock !== null ? t.previousStock : '—'}</td>
          <td class="py-3 px-4 font-mono font-bold text-[11px] text-[#302C2A] text-right tabular-nums">${t.newStock !== undefined && t.newStock !== null ? t.newStock : '—'}</td>
          <td class="py-3 px-4 text-[#6E6864] text-[11px] max-w-xs">
            <span class="font-medium text-[#302C2A] block">${esc(t.reason || '—')}</span>
            ${(t.orderNumber || t.supplierName || t.notes) ? `<span class="text-[10px] text-[#A68A80]">${esc(t.orderNumber ? 'Order #' + t.orderNumber : (t.supplierName ? 'Supplier: ' + t.supplierName : t.notes))}</span>` : ''}
          </td>
          <td class="py-3 px-4 font-mono text-[11px] text-[#6E6864] text-right">${esc(t.adminUsername || 'admin')}</td>
        </tr>
      `;
    }).join('');

    this.renderPagination('history', totalRecords);
  }

  // Stock Adjustment Modal
  openStockAdjustModal(preselectFlowerId = null) {
    const modal = document.getElementById('admin-stock-modal');
    const form = document.getElementById('admin-stock-form');
    const flowerSelect = document.getElementById('stock-field-flower');
    const supplierSelect = document.getElementById('stock-field-supplier');
    if (!modal || !form) return;

    form.reset();

    // Populate Flowers and Bouquet Materials
    if (flowerSelect) {
      flowerSelect.innerHTML = this.flowers.map(f => `
        <option value="${esc(f.id)}" ${f.id === preselectFlowerId ? 'selected' : ''}>
          ${esc(f.name)} (${f.stockCount || 0} ${esc(f.unitOfMeasure || 'stems')} available)
        </option>
      `).join('');
    }

    // Populate Suppliers
    if (supplierSelect) {
      supplierSelect.innerHTML = '<option value="">No Supplier Linked</option>' +
        this.suppliers.filter(s => s.active).map(s => `<option value="${esc(s.id)}">${esc(s.name)}</option>`).join('');
    }

    this.handleStockTypeChange('restock');
    this.updateStockPreview();

    // Event listeners
    const qtyInput = document.getElementById('stock-field-quantity');
    if (qtyInput) {
      qtyInput.oninput = () => this.updateStockPreview();
    }
    if (flowerSelect) {
      flowerSelect.onchange = () => this.updateStockPreview();
    }

    modal.classList.remove('hidden');
  }

  closeStockAdjustModal() {
    document.getElementById('admin-stock-modal')?.classList.add('hidden');
  }

  handleStockTypeChange(type) {
    const qtyLabel = document.getElementById('stock-quantity-label');
    const costBox = document.getElementById('stock-cost-container');
    const reasonSelect = document.getElementById('stock-field-reason-select');

    if (qtyLabel) {
      if (type === 'correction') qtyLabel.innerText = 'Verified Physical Count';
      else if (type === 'deduct') qtyLabel.innerText = 'Deduction Quantity';
      else qtyLabel.innerText = 'Received / Added Quantity';
    }
    if (costBox) {
      if (type === 'restock') costBox.classList.remove('hidden');
      else costBox.classList.add('hidden');
    }
    if (reasonSelect) {
      if (type === 'restock') {
        reasonSelect.innerHTML = `
          <option value="Opening Stock">Opening Stock (Product Initialization)</option>
          <option value="Supplier Delivery">Supplier Delivery</option>
          <option value="Restock">Restock</option>
          <option value="Returned Item">Returned Item</option>
          <option value="Other">Other (custom notes)</option>
        `;
      } else if (type === 'deduct') {
        reasonSelect.innerHTML = `
          <option value="Damage / Spoilage">Damage / Spoilage</option>
          <option value="Customer Order Fulfillment">Customer Order Fulfillment</option>
          <option value="Quality Rejection">Quality Rejection</option>
          <option value="Internal Use">Internal Use</option>
          <option value="Other">Other (custom notes)</option>
        `;
      } else if (type === 'correction') {
        reasonSelect.innerHTML = `
          <option value="Inventory Count Correction">Inventory Count Correction</option>
          <option value="Unit Correction">Unit Correction</option>
          <option value="Discrepancy Reconciliation">Discrepancy Reconciliation</option>
          <option value="Other">Other (custom notes)</option>
        `;
      }
    }
    this.updateStockPreview();
  }

  handleStockReasonSelect(val) {
    const notes = document.getElementById('stock-field-notes');
    if (notes && val !== 'Other' && !notes.value) {
      notes.placeholder = `e.g. ${val}`;
    }
  }

  updateStockPreview() {
    const flowerId = document.getElementById('stock-field-flower')?.value;
    const type = document.getElementById('stock-field-type')?.value || 'restock';
    const qtyVal = parseInt(document.getElementById('stock-field-quantity')?.value, 10);
    const flower = this.flowers.find(f => f.id === flowerId);

    const currEl = document.getElementById('stock-preview-curr');
    const nextEl = document.getElementById('stock-preview-next');

    const currStock = flower ? (flower.stockCount || 0) : 0;
    const unit = flower?.unitOfMeasure || 'units';
    if (currEl) currEl.innerText = `${currStock} ${unit}`;

    if (!isNaN(qtyVal)) {
      let next = currStock;
      if (type === 'restock') next = currStock + qtyVal;
      else if (type === 'deduct') next = Math.max(0, currStock - qtyVal);
      else if (type === 'correction') next = qtyVal;

      if (nextEl) nextEl.innerText = `${next} ${unit}`;
    } else {
      if (nextEl) nextEl.innerText = `${currStock} ${unit}`;
    }
  }

  async submitStockAdjustment(e) {
    e.preventDefault();
    const flowerId = document.getElementById('stock-field-flower')?.value;
    const type = document.getElementById('stock-field-type')?.value || 'restock';
    const quantity = parseInt(document.getElementById('stock-field-quantity')?.value, 10);
    const reasonSelect = document.getElementById('stock-field-reason-select')?.value;
    const notes = document.getElementById('stock-field-notes')?.value.trim();
    const supplierId = document.getElementById('stock-field-supplier')?.value;
    const unitCost = document.getElementById('stock-field-cost')?.value;

    const flower = (this.flowers || []).find(f => f.id === flowerId);
    if (!flower) {
      this.toast('Please select a valid item or material.', 'error');
      return;
    }

    if (isNaN(quantity) || quantity < 0) {
      this.toast('Please enter a valid non-negative quantity.', 'error');
      return;
    }

    // Strict validation against negative stock balances
    const currStock = flower.stockCount || 0;
    const unit = flower.unitOfMeasure || 'units';
    if (type === 'deduct' && quantity > currStock) {
      this.toast(`Cannot deduct ${quantity} ${unit}. Available stock is only ${currStock}.`, 'error');
      return;
    }

    let resultingStock = currStock;
    let typeLabel = 'Stock In (+)';
    if (type === 'restock') {
      resultingStock = currStock + quantity;
      typeLabel = 'Stock In (+)';
    } else if (type === 'deduct') {
      resultingStock = currStock - quantity;
      typeLabel = 'Stock Out (-)';
    } else if (type === 'correction') {
      resultingStock = quantity;
      typeLabel = 'Stock Adjustment (=)';
    }

    const payload = {
      flowerId,
      type,
      quantity,
      reason: reasonSelect,
      notes,
      supplierId: supplierId || null,
      unitCost: unitCost ? parseFloat(unitCost) : null
    };

    const confirmMsg = `Record ${typeLabel} of ${quantity} ${unit} for "${flower.name}"?\nStock will transition from ${currStock} to ${resultingStock} ${unit}.`;

    this.confirmAction({
      title: 'Confirm Stock Movement',
      message: confirmMsg,
      confirmLabel: 'Confirm Movement'
    }, () => this.apiRequest('/api/admin/inventory/adjust', 'POST', payload), () => {
      this.toast('Stock movement recorded successfully.', 'success');
      this.closeStockAdjustModal();
      this.loadFlowers();
      this.loadInventory();
      this.loadStockHistory();
      this.loadStats();
    });
  }

  // =========================================================================
  // SCREEN 5: SUPPLIER MANAGEMENT
  // =========================================================================
  async loadSuppliers() {
    const res = await this.apiRequest('/api/admin/suppliers');
    if (!res.ok) return;
    this.suppliers = res.data.suppliers || [];
    this.renderSupplierKPIs();
    this.renderSuppliersTable();
  }

  handleSupplierSearch(val) {
    this.supplierSearch = (val || '').toLowerCase().trim();
    if (this.pagination.suppliers) this.pagination.suppliers.page = 1;
    this.renderSuppliersTable();
  }

  handleSupplierFilter(val) {
    this.supplierStatus = val || 'all';
    if (this.pagination.suppliers) this.pagination.suppliers.page = 1;
    this.renderSuppliersTable();
  }

  handleSupplierOriginFilter(val) {
    this.supplierOrigin = val || 'all';
    if (this.pagination.suppliers) this.pagination.suppliers.page = 1;
    this.renderSuppliersTable();
  }

  handleSupplierCategoryFilter(val) {
    this.supplierCategory = val || 'all';
    if (this.pagination.suppliers) this.pagination.suppliers.page = 1;
    this.renderSuppliersTable();
  }

  clearSupplierFilters() {
    this.supplierSearch = '';
    this.supplierStatus = 'all';
    this.supplierOrigin = 'all';
    this.supplierCategory = 'all';
    if (this.pagination.suppliers) this.pagination.suppliers.page = 1;

    const sInput = document.getElementById('suppliers-search-input');
    if (sInput) sInput.value = '';
    const stFilter = document.getElementById('suppliers-status-filter');
    if (stFilter) stFilter.value = 'all';
    const orgFilter = document.getElementById('suppliers-origin-filter');
    if (orgFilter) orgFilter.value = 'all';
    const catFilter = document.getElementById('suppliers-category-filter');
    if (catFilter) catFilter.value = 'all';

    this.renderSuppliersTable();
  }

  renderSupplierKPIs() {
    const container = document.getElementById('suppliers-kpi-grid');
    if (!container) return;

    const list = this.suppliers || [];
    const total = list.length;
    const active = list.filter(s => s.active).length;
    const inactive = list.filter(s => !s.active).length;

    container.innerHTML = [
      this.kpiCardHTML({
        id: 'sup-kpi-total',
        label: 'Total Suppliers',
        value: total,
        subtext: 'Total registered suppliers',
        iconBg: 'bg-[#EBF1EC]',
        iconColor: 'text-[#647D69]',
        iconSvg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>'
      }),
      this.kpiCardHTML({
        id: 'sup-kpi-active',
        label: 'Active Suppliers',
        value: active,
        subtext: 'Currently active suppliers',
        iconBg: 'bg-[#DCFCE7]',
        iconColor: 'text-[#166534]',
        iconSvg: '<svg class="w-5 h-5 stroke-[2]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>'
      }),
      this.kpiCardHTML({
        id: 'sup-kpi-inactive',
        label: 'Inactive Suppliers',
        value: inactive,
        subtext: 'Inactive or standby accounts',
        tone: 'neutral',
        iconBg: 'bg-[#EBF1EC]',
        iconColor: 'text-[#4A443E]',
        iconSvg: '<svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/></svg>'
      })
    ].join('');
  }

  renderSuppliersTable() {
    const tbody = document.getElementById('admin-suppliers-tbody');
    const supClearBtn = document.getElementById('suppliers-clear-filters-btn');
    if (supClearBtn) {
      const v = (id) => (document.getElementById(id) || {}).value || '';
      const active = Boolean(v('suppliers-search-input').trim()) || ['suppliers-status-filter', 'suppliers-origin-filter', 'suppliers-category-filter'].some(id => (v(id) || 'all') !== 'all');
      supClearBtn.classList.toggle('filters-clear-hidden', !active);
    }
    const badge = document.getElementById('suppliers-count-badge');
    const emptyState = document.getElementById('suppliers-empty-state');
    if (!tbody) return;

    let list = this.suppliers || [];

    // 1. Status Filter
    if (this.supplierStatus === 'active') {
      list = list.filter(s => s.active);
    } else if (this.supplierStatus === 'inactive') {
      list = list.filter(s => !s.active);
    }

    // 2. Origin Filter
    if (this.supplierOrigin && this.supplierOrigin !== 'all') {
      const targetOrigin = this.supplierOrigin.toLowerCase();
      list = list.filter(s => (s.origin || '').toLowerCase() === targetOrigin);
    }

    // 3. Category Filter
    if (this.supplierCategory && this.supplierCategory !== 'all') {
      const targetCat = this.supplierCategory.toLowerCase();
      list = list.filter(s => {
        const cats = Array.isArray(s.categories) ? s.categories : [];
        return cats.some(c => c.toLowerCase() === targetCat);
      });
    }

    // 4. Search Filter (by Supplier Name or Contact Person)
    if (this.supplierSearch) {
      const q = this.supplierSearch.toLowerCase();
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(q) ||
        (s.contactPerson || '').toLowerCase().includes(q)
      );
    }

    const totalRecords = list.length;
    if (badge) {
      badge.innerText = `${totalRecords} supplier${totalRecords === 1 ? '' : 's'} registered`;
    }

    if (!list.length) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      this.renderPagination('suppliers', 0);
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    const pag = this.pagination.suppliers || { page: 1, pageSize: ROWS_PER_PAGE };
    const totalPages = Math.max(1, Math.ceil(totalRecords / pag.pageSize));
    if (pag.page > totalPages) pag.page = totalPages;
    if (pag.page < 1) pag.page = 1;

    const start = (pag.page - 1) * pag.pageSize;
    const sliced = list.slice(start, start + pag.pageSize);

    tbody.innerHTML = sliced.map(s => {
      const origin = s.origin || 'Unclassified';

      return `
        <tr class="hover:bg-[#FFF9F5] transition-colors duration-150">
          <td class="py-3 px-4 font-semibold text-[#302C2A] text-xs">${esc(s.name)}</td>
          <td class="py-3 px-4 text-[#302C2A] text-xs">${esc(s.contactPerson || '—')}</td>
          <td class="py-3 px-4 text-xs">
            <div class="text-[#302C2A] font-medium">${esc(s.phone || '—')}</div>
            ${s.email ? `<div class="text-[#6E6864] text-[11px]">${esc(s.email)}</div>` : ''}
          </td>
          <td class="py-3 px-4 text-[#524D49] text-xs">${esc(s.address || '—')}</td>
          <td class="py-3 px-4 text-xs text-[#302C2A] font-medium">${esc(origin)}</td>
          <td class="py-3 px-4 text-xs font-semibold ${s.active ? 'text-emerald-700' : 'text-stone-500'}">
            ${s.active ? 'Active' : 'Inactive'}
          </td>
          <td class="py-3 px-4 text-right whitespace-nowrap">
            ${this.renderSuppliersActionButtons(s)}
          </td>
        </tr>
      `;
    }).join('');

    this.renderPagination('suppliers', totalRecords);
  }

  openSupplierModal(id = null) {
    const modal = document.getElementById('admin-supplier-modal');
    const form = document.getElementById('admin-supplier-form');
    const title = document.getElementById('supplier-modal-title');
    const catErr = document.getElementById('supplier-categories-error');
    if (!modal || !form) return;

    form.reset();
    document.getElementById('supplier-field-id').value = '';
    if (catErr) catErr.classList.add('hidden');

    const checkboxes = form.querySelectorAll('input[name="supplier-category-checkbox"]');
    checkboxes.forEach(cb => cb.checked = false);

    if (id) {
      const sup = (this.suppliers || []).find(s => s.id === id);
      if (sup) {
        if (title) title.innerText = 'Edit Supplier';
        document.getElementById('supplier-field-id').value = sup.id;
        document.getElementById('supplier-field-name').value = sup.name || '';
        document.getElementById('supplier-field-contact').value = sup.contactPerson || '';
        document.getElementById('supplier-field-phone').value = sup.phone || '';
        document.getElementById('supplier-field-email').value = sup.email || '';
        document.getElementById('supplier-field-address').value = sup.address || '';
        document.getElementById('supplier-field-origin').value = sup.origin || '';
        document.getElementById('supplier-field-status').value = sup.active ? 'active' : 'inactive';
        document.getElementById('supplier-field-notes').value = sup.notes || '';

        const supCats = Array.isArray(sup.categories) ? sup.categories : [];
        checkboxes.forEach(cb => {
          cb.checked = supCats.includes(cb.value);
        });
      }
    } else {
      if (title) title.innerText = 'Add Supplier';
      document.getElementById('supplier-field-status').value = 'active';
      document.getElementById('supplier-field-origin').value = '';
    }

    modal.classList.remove('hidden');
  }

  closeSupplierModal() {
    document.getElementById('admin-supplier-modal')?.classList.add('hidden');
  }

  async saveSupplier(e) {
    if (e && e.preventDefault) e.preventDefault();

    const id = document.getElementById('supplier-field-id')?.value.trim();
    const name = document.getElementById('supplier-field-name')?.value.trim();
    const contactPerson = document.getElementById('supplier-field-contact')?.value.trim();
    const phone = document.getElementById('supplier-field-phone')?.value.trim();
    const email = document.getElementById('supplier-field-email')?.value.trim();
    const address = document.getElementById('supplier-field-address')?.value.trim();
    const origin = document.getElementById('supplier-field-origin')?.value.trim();
    const statusVal = document.getElementById('supplier-field-status')?.value;
    const notes = document.getElementById('supplier-field-notes')?.value.trim();

    // Required fields validation
    if (!name || name.length < 2) {
      this.toast('Supplier name is required (min 2 characters).', 'error');
      return;
    }
    if (!contactPerson) {
      this.toast('Contact person is required.', 'error');
      return;
    }
    if (!phone) {
      this.toast('Contact number is required.', 'error');
      return;
    }
    if (!address) {
      this.toast('Business address is required.', 'error');
      return;
    }
    if (!origin) {
      this.toast('Supplier origin classification is required.', 'error');
      return;
    }

    // Email format validation if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.toast('Please enter a valid email address.', 'error');
      return;
    }

    // Supplied categories validation (at least one)
    const checkedBoxes = Array.from(document.querySelectorAll('input[name="supplier-category-checkbox"]:checked'));
    const categories = checkedBoxes.map(cb => cb.value);
    const catErr = document.getElementById('supplier-categories-error');
    if (!categories.length) {
      if (catErr) catErr.classList.remove('hidden');
      this.toast('Please select at least one supplied category.', 'error');
      return;
    }
    if (catErr) catErr.classList.add('hidden');

    const active = statusVal !== 'inactive';

    const payload = {
      name,
      contactPerson,
      phone,
      email,
      address,
      origin,
      categories,
      notes,
      active
    };

    const isNew = !id;
    const endpoint = isNew ? '/api/admin/suppliers' : `/api/admin/suppliers/${id}`;

    const submitBtn = document.getElementById('supplier-submit-btn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-70');
    }

    try {
      const res = await this.apiRequest(endpoint, isNew ? 'POST' : 'PUT', payload);
      if (!res.ok) {
        this.toast(res.error || 'Failed to save supplier.', 'error');
        return;
      }
      this.toast(`Supplier "${name}" saved successfully.`, 'success');
      this.closeSupplierModal();
      await this.loadSuppliers();
    } catch (err) {
      this.toast(err.message || 'Error saving supplier.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-70');
      }
    }
  }

  viewSupplierDetails(id) {
    const sup = (this.suppliers || []).find(s => s.id === id);
    if (!sup) return;

    const modal = document.getElementById('admin-supplier-view-modal');
    const content = document.getElementById('supplier-view-content');
    if (!modal || !content) return;

    const origin = sup.origin || 'Unclassified';
    const originBadgeCls = origin === 'Local'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : origin === 'Domestic'
        ? 'bg-sky-50 text-sky-800 border-sky-200'
        : origin === 'International'
          ? 'bg-purple-50 text-purple-800 border-purple-200'
          : 'bg-stone-50 text-stone-600 border-stone-200';

    const cats = Array.isArray(sup.categories) && sup.categories.length ? sup.categories : [];
    const catsHtml = cats.length
      ? cats.map(c => `<span class="inline-block px-2.5 py-1 rounded-xl text-xs bg-[#FFF9F5] text-[#302C2A] border border-[#E5ECE6] font-semibold">${esc(c)}</span>`).join('')
      : '<span class="text-xs text-[#6E6864] italic">No categories specified</span>';

    const suppliedFlowers = (this.flowers || []).filter(f => f.supplierId === sup.id);
    const suppliedMaterials = (this.materials || []).filter(m => m.supplierId === sup.id);
    const allSupplied = [
      ...suppliedFlowers.map(f => ({ name: f.name, type: 'Fresh Flower', stock: f.stockCount !== undefined ? f.stockCount : 0, uom: f.unitOfMeasure || 'stems' })),
      ...suppliedMaterials.map(m => ({ name: m.name, type: 'Material / Packaging', stock: m.stockCount !== undefined ? m.stockCount : 0, uom: m.unitOfMeasure || 'units' }))
    ];

    content.innerHTML = `
      <div class="space-y-4 text-xs">
        <div class="border-b border-[#E5ECE6] pb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="font-serif font-bold text-xl text-[#302C2A]">${esc(sup.name)}</h3>
            <p class="text-xs text-[#6E6864] mt-0.5">Supplier ID: <span class="font-mono text-[#647D69] font-semibold">${esc(sup.id)}</span></p>
          </div>
          <div class="flex items-center gap-1.5">
            <span class="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${originBadgeCls}">${esc(origin)}</span>
            ${this.supplierStatusBadge(sup.active)}
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-[#FFF9F5]/60 p-4 rounded-2xl border border-[#E5ECE6]">
          <div>
            <span class="text-[10px] font-bold text-[#6E6864] uppercase tracking-wider block">Contact Person</span>
            <span class="font-semibold text-xs text-[#302C2A]">${esc(sup.contactPerson || 'Not provided')}</span>
          </div>
          <div>
            <span class="text-[10px] font-bold text-[#6E6864] uppercase tracking-wider block">Contact Number</span>
            <span class="font-mono text-xs text-[#302C2A]">${sup.phone ? `<a href="tel:${esc(sup.phone)}" class="text-[#647D69] hover:underline">${esc(sup.phone)}</a>` : 'Not provided'}</span>
          </div>
          <div>
            <span class="text-[10px] font-bold text-[#6E6864] uppercase tracking-wider block">Email Address</span>
            <span class="text-xs text-[#302C2A]">${sup.email ? `<a href="mailto:${esc(sup.email)}" class="text-[#647D69] hover:underline">${esc(sup.email)}</a>` : 'Not provided'}</span>
          </div>
          <div>
            <span class="text-[10px] font-bold text-[#6E6864] uppercase tracking-wider block">Business Address</span>
            <span class="text-xs text-[#302C2A]">${esc(sup.address || 'Not provided')}</span>
          </div>
        </div>

        <div>
          <span class="text-[10px] font-bold text-[#6E6864] uppercase tracking-wider block mb-1.5">Supplied Categories</span>
          <div class="flex flex-wrap gap-1.5">${catsHtml}</div>
        </div>

        <div>
          <span class="text-[10px] font-bold text-[#6E6864] uppercase tracking-wider block mb-1.5">Supplied Flowers &amp; Materials (${allSupplied.length})</span>
          ${allSupplied.length ? `
            <div class="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              ${allSupplied.map(item => `
                <div class="flex items-center justify-between p-2 rounded-xl bg-white border border-[#E5ECE6]">
                  <div class="flex items-center gap-2">
                    <span class="font-semibold text-xs text-[#302C2A]">${esc(item.name)}</span>
                    <span class="text-[10px] text-[#6E6864] px-1.5 py-0.5 rounded bg-[#F4F6F4]">${item.type}</span>
                  </div>
                  <span class="font-mono text-xs font-bold text-[#647D69]">${item.stock} ${item.uom}</span>
                </div>
              `).join('')}
            </div>
          ` : `
            <p class="text-xs text-[#6E6864] italic">No inventory items currently linked to this supplier.</p>
          `}
        </div>

        ${sup.notes ? `
          <div>
            <span class="text-[10px] font-bold text-[#6E6864] uppercase tracking-wider block mb-1">Notes &amp; Specialty Info</span>
            <div class="p-3 bg-white rounded-xl border border-[#E5ECE6] text-[#524D49] text-xs leading-relaxed">${esc(sup.notes)}</div>
          </div>
        ` : ''}

        <div class="pt-3 border-t border-[#E5ECE6] flex items-center justify-end gap-2.5">
          <button type="button" onclick="window.adminApp.closeSupplierViewModal()" class="px-4 py-2.5 rounded-xl border border-[#E5ECE6] hover:bg-[#FFF9F5] text-[#6E6864] hover:text-[#302C2A] font-semibold text-xs transition btn-tactile">
            Close
          </button>
          <button type="button" onclick="window.adminApp.closeSupplierViewModal(); window.adminApp.openSupplierModal('${esc(sup.id)}');" class="px-4 py-2.5 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white font-serif font-bold text-xs shadow-xs transition btn-tactile">
            Edit Supplier
          </button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  closeSupplierViewModal() {
    document.getElementById('admin-supplier-view-modal')?.classList.add('hidden');
  }

  async confirmToggleSupplierStatus(id, currentActive) {
    const sup = (this.suppliers || []).find(s => s.id === id);
    const name = sup ? sup.name : 'this supplier';

    if (currentActive) {
      const ok = confirm(`Are you sure you want to deactivate "${name}"?\n\nDeactivating marks this supplier as inactive while preserving all history and related records.`);
      if (!ok) return;
    }

    await this.toggleSupplierStatus(id, currentActive);
  }

  async toggleSupplierStatus(id, currentActive) {
    const res = await this.apiRequest(`/api/admin/suppliers/${id}/toggle`, 'POST', { active: !currentActive });
    if (!res.ok) {
      this.toast(res.error || 'Failed to update supplier status.', 'error');
      return;
    }
    this.toast(`Supplier status updated.`, 'info');
    await this.loadSuppliers();
  }

  // =========================================================================
  // SCREEN 6: SHOP SETTINGS
  // =========================================================================
  async loadSettings() {
    const res = await this.apiRequest('/api/admin/settings');
    if (!res.ok) return;
    this.shopSettings = res.data.settings || {};

    const st = this.shopSettings.store || {};
    const del = this.shopSettings.delivery || {};
    const pic = this.shopSettings.pickup || {};
    const hrs = this.shopSettings.hours || {};
    const cb = this.shopSettings.custom_builder || {};
    const inv = this.shopSettings.inventory || {};

    // 1. Store Information
    if (document.getElementById('setting-store-name')) document.getElementById('setting-store-name').value = st.name || '';
    if (document.getElementById('setting-store-phone')) document.getElementById('setting-store-phone').value = st.phone || '';
    if (document.getElementById('setting-store-email')) document.getElementById('setting-store-email').value = st.email || '';
    if (document.getElementById('setting-store-address')) document.getElementById('setting-store-address').value = st.address || '';
    if (document.getElementById('setting-store-desc')) document.getElementById('setting-store-desc').value = st.description || '';

    // 2. Delivery & Pickup
    if (document.getElementById('setting-del-fee')) document.getElementById('setting-del-fee').value = del.fee !== undefined ? del.fee : 150;
    if (document.getElementById('setting-del-free-threshold')) document.getElementById('setting-del-free-threshold').value = del.freeThreshold !== undefined ? del.freeThreshold : 2500;
    if (document.getElementById('setting-del-coverage')) document.getElementById('setting-del-coverage').value = del.coverage || del.serviceArea || 'City of Manila (Districts 1–6)';
    if (document.getElementById('setting-del-enabled')) document.getElementById('setting-del-enabled').checked = del.enabled !== false;
    if (document.getElementById('setting-pickup-enabled')) document.getElementById('setting-pickup-enabled').checked = pic.enabled !== false;
    if (document.getElementById('setting-pickup-lead')) document.getElementById('setting-pickup-lead').value = pic.leadTimeHours !== undefined ? pic.leadTimeHours : 2;

    // 3. Operating Hours
    if (document.getElementById('setting-hours-open')) document.getElementById('setting-hours-open').value = hrs.openingTime || '08:00';
    if (document.getElementById('setting-hours-close')) document.getElementById('setting-hours-close').value = hrs.closingTime || '20:00';
    if (document.getElementById('setting-hours-days')) document.getElementById('setting-hours-days').value = hrs.operatingDays || 'Monday – Sunday';
    const isAccepting = hrs.acceptingOrders !== false;
    if (document.getElementById('setting-orders-enabled')) document.getElementById('setting-orders-enabled').checked = isAccepting;
    const orderPill = document.getElementById('order-status-live-pill');
    if (orderPill) {
      orderPill.textContent = isAccepting ? 'Active' : 'Paused';
      orderPill.className = isAccepting ? 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800' : 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800';
    }

    // 4. Custom Bouquet Settings (Strictly no assembly fee)
    const minS = cb.minStems !== undefined ? cb.minStems : 1;
    const maxS = cb.maxStems !== undefined ? cb.maxStems : 50;
    if (document.getElementById('setting-builder-min-stems')) document.getElementById('setting-builder-min-stems').value = minS;
    if (document.getElementById('setting-builder-max-stems')) document.getElementById('setting-builder-max-stems').value = maxS;
    const minPrev = document.getElementById('builder-min-preview');
    if (minPrev) minPrev.textContent = minS;
    const maxPrev = document.getElementById('builder-max-preview');
    if (maxPrev) maxPrev.textContent = maxS;

    // 5. Inventory & Stock Alerts
    const th = inv.lowStockThreshold != null ? inv.lowStockThreshold : 20;
    if (document.getElementById('setting-inventory-low-stock')) {
      document.getElementById('setting-inventory-low-stock').value = th;
    }
    this.updateThresholdDisplays();
  }

  async saveStoreSettings(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('setting-store-name')?.value.trim();
    const phone = document.getElementById('setting-store-phone')?.value.trim();
    const email = document.getElementById('setting-store-email')?.value.trim();
    const address = document.getElementById('setting-store-address')?.value.trim();
    const description = document.getElementById('setting-store-desc')?.value.trim();

    if (!name) { this.toast('Boutique name is required.', 'error'); return; }
    if (!phone) { this.toast('Contact number is required.', 'error'); return; }
    if (!email) { this.toast('Email address is required.', 'error'); return; }
    if (!address) { this.toast('Store address is required.', 'error'); return; }

    const patch = {
      store: {
        name,
        tagline: this.shopSettings?.store?.tagline || 'Luxury Botanical Arrangements & Custom Bouquets',
        phone,
        email,
        address,
        description
      }
    };
    const res = await this.apiRequest('/api/admin/settings', 'PUT', patch);
    if (res.ok) {
      if (!this.shopSettings) this.shopSettings = {};
      this.shopSettings.store = { ...this.shopSettings.store, ...patch.store };
      this.toast('Store information saved successfully.', 'success');
    } else {
      this.toast(res.error || 'Failed to save store profile.', 'error');
    }
  }

  async saveDeliverySettings(e) {
    if (e) e.preventDefault();
    const fee = parseFloat(document.getElementById('setting-del-fee')?.value);
    const freeThreshold = parseFloat(document.getElementById('setting-del-free-threshold')?.value);
    const coverage = document.getElementById('setting-del-coverage')?.value.trim();
    const delEnabled = document.getElementById('setting-del-enabled')?.checked ?? true;
    const pickupEnabled = document.getElementById('setting-pickup-enabled')?.checked ?? true;
    const leadTimeHours = parseFloat(document.getElementById('setting-pickup-lead')?.value ?? '2');

    if (isNaN(fee) || fee < 0) { this.toast('Please enter a valid delivery fee.', 'error'); return; }
    if (isNaN(leadTimeHours) || leadTimeHours < 0 || leadTimeHours > 48) { this.toast('Pickup preparation time must be between 0 and 48 hours.', 'error'); return; }
    if (isNaN(freeThreshold) || freeThreshold < 0) { this.toast('Please enter a valid free delivery threshold.', 'error'); return; }
    if (!coverage) { this.toast('Delivery coverage area is required.', 'error'); return; }

    const patch = {
      delivery: {
        enabled: delEnabled,
        fee: fee,
        freeThreshold: freeThreshold,
        carrier: this.shopSettings?.delivery?.carrier || 'Grab Delivery',
        serviceArea: coverage,
        coverage: coverage,
        notes: this.shopSettings?.delivery?.notes || ''
      },
      pickup: {
        enabled: pickupEnabled,
        address: this.shopSettings?.pickup?.address || this.shopSettings?.store?.address || '',
        instructions: this.shopSettings?.pickup?.instructions || 'Present your Order Number at the Atelier counter upon arrival.',
        leadTimeHours
      }
    };
    const res = await this.apiRequest('/api/admin/settings', 'PUT', patch);
    if (res.ok) {
      if (!this.shopSettings) this.shopSettings = {};
      this.shopSettings.delivery = { ...this.shopSettings.delivery, ...patch.delivery };
      this.shopSettings.pickup = { ...this.shopSettings.pickup, ...patch.pickup };
      this.toast('Delivery & pickup settings saved.', 'success');
    } else {
      this.toast(res.error || 'Failed to save delivery settings.', 'error');
    }
  }

  async saveHoursSettings(e) {
    if (e) e.preventDefault();
    const openingTime = document.getElementById('setting-hours-open')?.value;
    const closingTime = document.getElementById('setting-hours-close')?.value;
    const operatingDays = document.getElementById('setting-hours-days')?.value.trim();
    const acceptingOrders = document.getElementById('setting-orders-enabled')?.checked ?? true;

    if (!openingTime || !closingTime) { this.toast('Opening and closing times are required.', 'error'); return; }
    if (closingTime <= openingTime) { this.toast('Closing time must be later than opening time.', 'error'); return; }
    if (!operatingDays) { this.toast('Operating days are required.', 'error'); return; }

    const patch = {
      hours: {
        openingTime,
        closingTime,
        operatingDays,
        acceptingOrders
      }
    };
    const res = await this.apiRequest('/api/admin/settings', 'PUT', patch);
    if (res.ok) {
      if (!this.shopSettings) this.shopSettings = {};
      this.shopSettings.hours = { ...this.shopSettings.hours, ...patch.hours };
      const orderPill = document.getElementById('order-status-live-pill');
      if (orderPill) {
        orderPill.textContent = acceptingOrders ? 'Active' : 'Paused';
        orderPill.className = acceptingOrders ? 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800' : 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800';
      }
      this.toast('Operating schedule saved successfully.', 'success');
    } else {
      this.toast(res.error || 'Failed to save operating schedule.', 'error');
    }
  }

  async saveCustomBuilderSettings(e) {
    if (e) e.preventDefault();
    const minStems = parseInt(document.getElementById('setting-builder-min-stems')?.value, 10);
    const maxStems = parseInt(document.getElementById('setting-builder-max-stems')?.value, 10);

    if (isNaN(minStems) || minStems < 1) {
      this.toast('Minimum stems must be at least 1.', 'error');
      return;
    }
    if (isNaN(maxStems) || maxStems < minStems) {
      this.toast('Maximum stems cannot be less than minimum stems.', 'error');
      return;
    }

    const patch = {
      custom_builder: {
        minStems,
        maxStems,
        serviceFee: 0 // Assembly fee explicitly removed
      }
    };
    const res = await this.apiRequest('/api/admin/settings', 'PUT', patch);
    if (res.ok) {
      if (!this.shopSettings) this.shopSettings = {};
      this.shopSettings.custom_builder = patch.custom_builder;
      const minPrev = document.getElementById('builder-min-preview');
      if (minPrev) minPrev.textContent = minStems;
      const maxPrev = document.getElementById('builder-max-preview');
      if (maxPrev) maxPrev.textContent = maxStems;
      this.toast('Custom Bouquet Studio settings saved.', 'success');
    } else {
      this.toast(res.error || 'Failed to save studio settings.', 'error');
    }
  }

  async saveAllSettings(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('save-all-settings-btn');
    if (btn) btn.disabled = true;

    try {
      // 1. Store
      const storeName = document.getElementById('setting-store-name')?.value.trim();
      const storePhone = document.getElementById('setting-store-phone')?.value.trim();
      const storeEmail = document.getElementById('setting-store-email')?.value.trim();
      const storeAddress = document.getElementById('setting-store-address')?.value.trim();
      const storeDesc = document.getElementById('setting-store-desc')?.value.trim() || '';

      if (!storeName || !storePhone || !storeEmail || !storeAddress) {
        this.toast('Please fill in all required Store Information fields.', 'error');
        return;
      }

      // 2. Delivery & Pickup (0 is a valid fee/threshold, so never fall back with `||`)
      const delFee = parseFloat(document.getElementById('setting-del-fee')?.value);
      const delFree = parseFloat(document.getElementById('setting-del-free-threshold')?.value);
      const delCoverage = document.getElementById('setting-del-coverage')?.value.trim() || 'City of Manila (Districts 1–6)';
      const delEnabled = document.getElementById('setting-del-enabled')?.checked ?? true;
      const pickupEnabled = document.getElementById('setting-pickup-enabled')?.checked ?? true;
      const leadTimeHours = parseFloat(document.getElementById('setting-pickup-lead')?.value ?? '2');

      // 3. Operating Hours
      const openTime = document.getElementById('setting-hours-open')?.value || '08:00';
      const closeTime = document.getElementById('setting-hours-close')?.value || '20:00';
      const opDays = document.getElementById('setting-hours-days')?.value.trim() || 'Monday – Sunday';
      const acceptOrders = document.getElementById('setting-orders-enabled')?.checked ?? true;

      // 4. Custom Bouquet
      const minStems = parseInt(document.getElementById('setting-builder-min-stems')?.value, 10);
      const maxStems = parseInt(document.getElementById('setting-builder-max-stems')?.value, 10);

      // 5. Inventory
      const lowStock = parseInt(document.getElementById('setting-inventory-low-stock')?.value, 10);

      // Same validation as the individual section forms (and the server).
      if (isNaN(delFee) || delFee < 0) { this.toast('Please enter a valid delivery fee (0 or more).', 'error'); return; }
      if (isNaN(delFree) || delFree < 0) { this.toast('Please enter a valid free delivery threshold (0 or more).', 'error'); return; }
      if (isNaN(leadTimeHours) || leadTimeHours < 0 || leadTimeHours > 48) { this.toast('Pickup preparation time must be between 0 and 48 hours.', 'error'); return; }
      if (closeTime <= openTime) { this.toast('Closing time must be later than opening time.', 'error'); return; }
      if (isNaN(minStems) || minStems < 1) { this.toast('Minimum stems must be at least 1.', 'error'); return; }
      if (isNaN(maxStems) || maxStems < minStems) { this.toast('Maximum stems cannot be less than minimum stems.', 'error'); return; }
      if (isNaN(lowStock) || lowStock < 0) { this.toast('Low-stock threshold must be a whole number, 0 or more.', 'error'); return; }

      const patch = {
        store: {
          name: storeName,
          tagline: this.shopSettings?.store?.tagline || 'Luxury Botanical Arrangements & Custom Bouquets',
          phone: storePhone,
          email: storeEmail,
          address: storeAddress,
          description: storeDesc
        },
        delivery: {
          enabled: delEnabled,
          fee: delFee,
          freeThreshold: delFree,
          carrier: this.shopSettings?.delivery?.carrier || 'Grab Delivery',
          serviceArea: delCoverage,
          coverage: delCoverage,
          notes: this.shopSettings?.delivery?.notes || ''
        },
        pickup: {
          enabled: pickupEnabled,
          address: this.shopSettings?.pickup?.address || storeAddress,
          instructions: this.shopSettings?.pickup?.instructions || 'Present your Order Number at the Atelier counter upon arrival.',
          leadTimeHours
        },
        hours: {
          openingTime: openTime,
          closingTime: closeTime,
          operatingDays: opDays,
          acceptingOrders: acceptOrders
        },
        custom_builder: {
          minStems,
          maxStems,
          serviceFee: 0
        },
        inventory: {
          lowStockThreshold: lowStock
        }
      };

      const res = await this.apiRequest('/api/admin/settings', 'PUT', patch);
      if (res.ok) {
        this.shopSettings = res.data?.settings || patch;
        this.updateThresholdDisplays();
        const minPrev = document.getElementById('builder-min-preview');
        if (minPrev) minPrev.textContent = minStems;
        const maxPrev = document.getElementById('builder-max-preview');
        if (maxPrev) maxPrev.textContent = maxStems;
        const orderPill = document.getElementById('order-status-live-pill');
        if (orderPill) {
          orderPill.textContent = acceptOrders ? 'Active' : 'Paused';
          orderPill.className = acceptOrders ? 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800' : 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800';
        }
        this.toast('All shop settings saved successfully.', 'success');
      } else {
        this.toast(res.error || 'Failed to save shop settings.', 'error');
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // =========================================================================
  // CENTRALIZED LOW STOCK ALERT THRESHOLD CONTROLLER
  // =========================================================================
  getGlobalLowStockThreshold() {
    const th = Number(this.shopSettings?.inventory?.lowStockThreshold);
    return Number.isFinite(th) && th >= 0 ? th : 20;
  }

  previewThresholdChange(val) {
    const n = parseInt(val, 10);
    const valid = !isNaN(n) && n >= 0 ? n : 20;
    const previewLow = document.getElementById('setting-threshold-preview');
    const previewHigh = document.getElementById('setting-threshold-preview-high');
    if (previewLow) previewLow.textContent = valid;
    if (previewHigh) previewHigh.textContent = valid;
  }

  updateThresholdDisplays() {
    const th = this.getGlobalLowStockThreshold();
    const storeDisplay = document.getElementById('store-threshold-display');
    if (storeDisplay) storeDisplay.textContent = th;
    const modalInput = document.getElementById('modal-threshold-input');
    if (modalInput) modalInput.value = th;
    const modalPreview = document.getElementById('modal-threshold-preview');
    if (modalPreview) modalPreview.textContent = th;
    const settingInput = document.getElementById('setting-inventory-low-stock');
    if (settingInput) settingInput.value = th;
    const settingPreview = document.getElementById('setting-threshold-preview');
    if (settingPreview) settingPreview.textContent = th;
    const settingPreviewHigh = document.getElementById('setting-threshold-preview-high');
    if (settingPreviewHigh) settingPreviewHigh.textContent = th;

    const stockFilter = document.getElementById('store-stock-filter');
    if (stockFilter) {
      const optIn = stockFilter.querySelector('option[value="in_stock"]');
      const optLow = stockFilter.querySelector('option[value="low_stock"]');
      const optOut = stockFilter.querySelector('option[value="out_of_stock"]');
      if (optIn) optIn.textContent = `In Stock (Above ${th} units)`;
      if (optLow) optLow.textContent = `Low Stock (1–${th} units)`;
      if (optOut) optOut.textContent = `Out of Stock (0 units)`;
    }
  }

  openThresholdModal() {
    this.updateThresholdDisplays();
    const modal = document.getElementById('admin-threshold-modal');
    if (modal) modal.classList.remove('hidden');
    const input = document.getElementById('modal-threshold-input');
    if (input) {
      input.focus();
      input.select();
    }
  }

  closeThresholdModal() {
    const modal = document.getElementById('admin-threshold-modal');
    if (modal) modal.classList.add('hidden');
  }

  async saveThresholdModal(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('modal-threshold-input');
    const val = parseInt(input?.value, 10);
    if (isNaN(val) || val < 0) {
      this.toast('Please enter a valid threshold (0 or greater).', 'error');
      return;
    }
    await this._saveGlobalThreshold(val);
    this.closeThresholdModal();
  }

  async saveInventorySettings(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('setting-inventory-low-stock');
    const val = parseInt(input?.value, 10);
    if (isNaN(val) || val < 0) {
      this.toast('Please enter a valid threshold (0 or greater).', 'error');
      return;
    }
    await this._saveGlobalThreshold(val);
  }

  async _saveGlobalThreshold(val) {
    const patch = {
      inventory: {
        lowStockThreshold: val
      }
    };
    const res = await this.apiRequest('/api/admin/settings', 'PUT', patch);
    if (res.ok) {
      if (!this.shopSettings) this.shopSettings = {};
      this.shopSettings.inventory = { lowStockThreshold: val };
      this.updateThresholdDisplays();
      await this.loadStoreData();
      this.renderStoreKPIs();
      this.renderStoreTable();
      if (typeof this.loadInventory === 'function') await this.loadInventory();
      if (typeof this.loadStats === 'function') this.loadStats();
      this.updateNotificationBadge();
      this.renderNotificationsPopover();
      this.toast(`Centralized low-stock alert threshold saved (${val} units).`, 'success');
    } else {
      this.toast(res.error || 'Failed to save threshold.', 'error');
    }
  }

  // =========================================================================
  // CUSTOMER DIRECTORY & DETAILS MODAL (Phase 3 Spec)
  // =========================================================================
  openCustomerDirectoryModal() {
    document.getElementById('admin-customers-directory-modal')?.classList.remove('hidden');
    this.loadCustomers();
  }

  closeCustomerDirectoryModal() {
    document.getElementById('admin-customers-directory-modal')?.classList.add('hidden');
  }

  async loadCustomers() {
    const res = await this.apiRequest('/api/admin/customers');
    if (!res.ok) return;
    this.customers = res.data.customers || [];
    this.renderCustomersTable();
  }

  handleCustomerSearch(val) {
    this.customerSearch = (val || '').toLowerCase().trim();
    this.pagination.customers.page = 1;
    this.renderCustomersTable();
  }

  handleCustomerFilter() {
    const select = document.getElementById('customers-filter-auth');
    this.customerFilter = select ? select.value : 'all';
    this.pagination.customers.page = 1;
    this.renderCustomersTable();
  }

  handleCustomerSort(val) {
    this.customerSort = val || 'newest';
    this.pagination.customers.page = 1;
    this.renderCustomersTable();
  }

  clearCustomerFilters() {
    this.customerSearch = '';
    this.customerFilter = 'all';
    this.customerSort = 'newest';
    this.pagination.customers.page = 1;
    const sInput = document.getElementById('customers-search-input');
    if (sInput) sInput.value = '';
    const fAuth = document.getElementById('customers-filter-auth');
    if (fAuth) fAuth.value = 'all';
    const fSort = document.getElementById('customers-sort');
    if (fSort) fSort.value = 'newest';
    this.renderCustomersTable();
  }

  renderCustomersTable() {
    const tbody = document.getElementById('admin-customers-tbody');
    const cClear = document.getElementById('customers-clear-filters-btn');
    if (cClear) cClear.classList.toggle('filters-clear-hidden', !(this.customerSearch || (this.customerFilter || 'all') !== 'all'));
    const emptyState = document.getElementById('customers-empty-state');
    const countBadge = document.getElementById('cust-count-badge');
    if (!tbody) return;

    let filtered = this.customers.slice();

    // Filter
    if (this.customerFilter === 'google') filtered = filtered.filter(c => c.google);
    else if (this.customerFilter === 'email') filtered = filtered.filter(c => !c.google);
    else if (this.customerFilter === 'with_orders') filtered = filtered.filter(c => (c.orderCount || 0) > 0);
    else if (this.customerFilter === 'no_orders') filtered = filtered.filter(c => !c.orderCount);

    // Search
    if (this.customerSearch) {
      filtered = filtered.filter(c =>
        (c.name || '').toLowerCase().includes(this.customerSearch) ||
        (c.email || '').toLowerCase().includes(this.customerSearch) ||
        (c.phone || '').includes(this.customerSearch)
      );
    }

    // Sort
    if (this.customerSort === 'orders') filtered.sort((a, b) => (b.orderCount || 0) - (a.orderCount || 0));
    else if (this.customerSort === 'spent') filtered.sort((a, b) => (b.totalSpent || 0) - (a.totalSpent || 0));
    else if (this.customerSort === 'name') filtered.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    if (countBadge) countBadge.innerText = `${filtered.length} account${filtered.length === 1 ? '' : 's'}`;

    if (!filtered.length) {
      tbody.innerHTML = '';
      if (emptyState) emptyState.classList.remove('hidden');
      this.renderPagination('customers', 0);
      return;
    }
    if (emptyState) emptyState.classList.add('hidden');

    const totalRecords = filtered.length;
    const pag = this.pagination.customers;
    const totalPages = Math.max(1, Math.ceil(totalRecords / pag.pageSize));
    if (pag.page > totalPages) pag.page = totalPages;
    if (pag.page < 1) pag.page = 1;

    const start = (pag.page - 1) * pag.pageSize;
    const sliced = filtered.slice(start, start + pag.pageSize);

    tbody.innerHTML = sliced.map(c => `
      <tr class="hover:bg-[#EBF1EC] transition-colors duration-150">
        <td class="py-3.5 px-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-full bg-[#EBF1EC] text-[#647D69] border border-[#F5D2C1] font-bold flex items-center justify-center text-xs shrink-0">
              ${esc((c.name || 'C').charAt(0).toUpperCase())}
            </div>
            <div>
              <p class="font-bold text-[#302C2A]">${esc(c.name || 'Anonymous Client')}</p>
              <p class="text-[#6E6864] text-[11px]">${esc(c.email)}</p>
            </div>
          </div>
        </td>
        <td class="py-3.5 px-4 font-mono text-[11px] text-[#6E6864]">${esc(c.phone || '—')}</td>
        <td class="py-3.5 px-4 text-xs text-[#302C2A] font-medium">
          ${c.google ? 'Google' : 'Email'}
        </td>
        <td class="py-3.5 px-4 font-mono font-bold tabular-nums text-[#302C2A] text-right">${c.orderCount || 0}</td>
        <td class="py-3.5 px-4 font-mono font-bold tabular-nums text-[#647D69] text-right">${peso(c.totalSpent)}</td>
        <td class="py-3.5 px-4 text-[#6E6864] text-[11px] font-mono">${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</td>
        <td class="py-3.5 px-4 text-right whitespace-nowrap">
          ${this.renderCustomersActionButtons(c)}
        </td>
      </tr>
    `).join('');

    this.renderPagination('customers', totalRecords);
  }

  openOrderCustomerProfile(orderNumber) {
    if (!orderNumber) return;
    const order = (this.orders || []).find(o => o.orderNumber === orderNumber);
    if (!order) {
      this.toast('Order not found.', 'error');
      return;
    }

    const modal = document.getElementById('admin-customer-modal');
    const avatar = document.getElementById('cust-modal-avatar');
    const nameEl = document.getElementById('cust-modal-name');
    const emailEl = document.getElementById('cust-modal-email');
    const content = document.getElementById('cust-modal-content');
    if (!modal || !content) return;

    // Customer Name
    const customerName = (order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim()) || 'Not provided';
    // Contact Number
    const phone = order.phone || 'Not provided';
    // Email Address
    const email = order.email || 'Not provided';
    // Saved Delivery Address
    let address = 'Not provided';
    if (order.address) {
      if (typeof order.address === 'string' && order.address.trim()) {
        address = order.address.trim();
      } else if (typeof order.address === 'object') {
        const parts = [
          order.address.street,
          order.address.barangay,
          order.address.district ? `District ${order.address.district}` : null,
          order.address.city || 'Manila'
        ].filter(Boolean);
        if (parts.length) address = parts.join(', ');
      }
    } else if (order.userId && Array.isArray(this.customers)) {
      const cust = this.customers.find(c => c.id === order.userId);
      if (cust && cust.address) {
        const parts = [
          cust.address.street,
          cust.address.barangay,
          cust.address.district ? `District ${cust.address.district}` : null,
          cust.address.city || 'Manila'
        ].filter(Boolean);
        if (parts.length) address = parts.join(', ');
      }
    }

    if (avatar) avatar.innerText = (customerName !== 'Not provided' ? customerName.charAt(0) : 'C').toUpperCase();
    if (nameEl) nameEl.innerText = 'Customer Profile';
    if (emailEl) emailEl.innerText = orderNumber ? `Order #${orderNumber}` : '';

    content.innerHTML = `
      <div class="space-y-3">
        <div class="p-3.5 bg-[#FFF9F5] rounded-2xl border border-[#E5ECE6]">
          <span class="text-[10px] font-bold text-[#6E6864] uppercase tracking-wider block mb-1">Customer Name</span>
          <span class="font-serif font-bold text-base text-[#302C2A]">${esc(customerName)}</span>
        </div>
        <div class="p-3.5 bg-[#FFF9F5] rounded-2xl border border-[#E5ECE6]">
          <span class="text-[10px] font-bold text-[#6E6864] uppercase tracking-wider block mb-1">Contact Number</span>
          <span class="font-mono font-bold text-sm text-[#302C2A]">${esc(phone)}</span>
        </div>
        <div class="p-3.5 bg-[#FFF9F5] rounded-2xl border border-[#E5ECE6]">
          <span class="text-[10px] font-bold text-[#6E6864] uppercase tracking-wider block mb-1">Email Address</span>
          <span class="font-medium text-sm text-[#302C2A]">${esc(email)}</span>
        </div>
        <div class="p-3.5 bg-[#FFF9F5] rounded-2xl border border-[#E5ECE6]">
          <span class="text-[10px] font-bold text-[#6E6864] uppercase tracking-wider block mb-1">Saved Delivery Address</span>
          <p class="font-medium text-sm text-[#302C2A] leading-relaxed">${esc(address)}</p>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  async openCustomerDetails(id) {
    if (!id) return;
    const res = await this.apiRequest(`/api/admin/customers/${id}`);
    if (!res.ok) {
      this.toast('Could not retrieve customer details.', 'error');
      return;
    }

    const { customer } = res.data;
    const modal = document.getElementById('admin-customer-modal');
    const avatar = document.getElementById('cust-modal-avatar');
    const nameEl = document.getElementById('cust-modal-name');
    const emailEl = document.getElementById('cust-modal-email');
    const content = document.getElementById('cust-modal-content');
    if (!modal || !content) return;

    const customerName = customer.name || 'Not provided';
    const phone = customer.phone || 'Not provided';
    const email = customer.email || 'Not provided';

    let address = 'Not provided';
    if (customer.address) {
      if (typeof customer.address === 'string' && customer.address.trim()) {
        address = customer.address.trim();
      } else if (typeof customer.address === 'object') {
        const parts = [
          customer.address.street,
          customer.address.barangay,
          customer.address.district ? `District ${customer.address.district}` : null,
          customer.address.city || 'Manila'
        ].filter(Boolean);
        if (parts.length) address = parts.join(', ');
      }
    }

    if (avatar) avatar.innerText = (customerName !== 'Not provided' ? customerName.charAt(0) : 'C').toUpperCase();
    if (nameEl) nameEl.innerText = 'Customer Profile';
    if (emailEl) emailEl.innerText = '';

    content.innerHTML = `
      <div class="space-y-3">
        <div class="p-3.5 bg-[#FFF9F5] rounded-2xl border border-[#E5ECE6]">
          <span class="text-[10px] font-bold text-[#6E6864] uppercase tracking-wider block mb-1">Customer Name</span>
          <span class="font-serif font-bold text-base text-[#302C2A]">${esc(customerName)}</span>
        </div>
        <div class="p-3.5 bg-[#FFF9F5] rounded-2xl border border-[#E5ECE6]">
          <span class="text-[10px] font-bold text-[#6E6864] uppercase tracking-wider block mb-1">Contact Number</span>
          <span class="font-mono font-bold text-sm text-[#302C2A]">${esc(phone)}</span>
        </div>
        <div class="p-3.5 bg-[#FFF9F5] rounded-2xl border border-[#E5ECE6]">
          <span class="text-[10px] font-bold text-[#6E6864] uppercase tracking-wider block mb-1">Email Address</span>
          <span class="font-medium text-sm text-[#302C2A]">${esc(email)}</span>
        </div>
        <div class="p-3.5 bg-[#FFF9F5] rounded-2xl border border-[#E5ECE6]">
          <span class="text-[10px] font-bold text-[#6E6864] uppercase tracking-wider block mb-1">Saved Delivery Address</span>
          <p class="font-medium text-sm text-[#302C2A] leading-relaxed">${esc(address)}</p>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  closeCustomerModal() {
    document.getElementById('admin-customer-modal')?.classList.add('hidden');
  }

  // =========================================================================
  // SCREEN: REPORTS OVERVIEW & PDF GENERATION
  // =========================================================================
  async loadReportsData() {
    let url = `/api/admin/reports/data?range=${encodeURIComponent(this.reportsRange)}`;
    if (this.reportsRange === 'custom') {
      if (this.reportsStartDate) url += `&startDate=${encodeURIComponent(this.reportsStartDate)}`;
      if (this.reportsEndDate) url += `&endDate=${encodeURIComponent(this.reportsEndDate)}`;
    }

    const res = await this.apiRequest(url);
    if (!res.ok) {
      this.toast(res.error || 'Failed to fetch business reports data.', 'error');
      return;
    }

    this.reportsData = res.data;
    this.renderReportsKPIs();
    this.renderReportsCharts();
    this.renderReportsProductsTable();
    this.renderReportsInventoryHealth();
    this.renderReportsInventoryTable();
    this.renderReportsTransactionsTable();
    this.renderReportsStockTable();
    this.updateReportsRangeDisplay();
    this.applyReportsTypeVisibility();
  }

  updateReportsRangeDisplay() {
    const labelEl = document.getElementById('reports-active-range-label');
    if (!labelEl || !this.reportsData) return;

    const start = this.reportsData.startDate;
    const end = this.reportsData.endDate;

    const formatDate = (isoStr) => {
      try {
        const parts = isoStr.split('-');
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
      } catch (_) {
        return isoStr;
      }
    };

    const formatted = start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`;
    labelEl.innerHTML = `
      <svg class="w-3.5 h-3.5 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      <span>${formatted}</span>
    `;

    document.querySelectorAll('[data-reports-range]').forEach(btn => {
      const r = btn.getAttribute('data-reports-range');
      if (r === this.reportsRange) {
        btn.className = 'px-3.5 py-1.5 rounded-full text-xs font-bold border border-[#647D69] bg-[#647D69] text-white shadow-xs transition btn-tactile inline-flex items-center gap-1.5 whitespace-nowrap';
      } else {
        btn.className = 'px-3 py-1.5 rounded-full text-xs font-semibold border border-[#E5ECE6] bg-[#FFFFFF] text-[#6E6864] hover:bg-[#FFF9F5] transition btn-tactile inline-flex items-center gap-1.5 whitespace-nowrap';
      }
    });

    const typeFilterEl = document.getElementById('reports-type-filter');
    if (typeFilterEl && this.currentReportType) {
      typeFilterEl.value = this.currentReportType;
    }
  }

  setReportsDateRange(range) {
    this.reportsRange = range;
    this.reportsStartDate = '';
    this.reportsEndDate = '';
    const customBox = document.getElementById('reports-custom-range-box');
    if (customBox) customBox.classList.add('hidden');
    // Rule 9: Reset to Page 1 when a new filter or date range is selected
    if (this.pagination.reportsProducts) this.pagination.reportsProducts.page = 1;
    if (this.pagination.reportsInventory) this.pagination.reportsInventory.page = 1;
    if (this.pagination.reportsTransactions) this.pagination.reportsTransactions.page = 1;
    if (this.pagination.reportsStock) this.pagination.reportsStock.page = 1;
    this.loadReportsData();
  }

  toggleReportsCustomRange() {
    const customBox = document.getElementById('reports-custom-range-box');
    if (!customBox) return;
    const isHidden = customBox.classList.contains('hidden');
    if (isHidden) {
      customBox.classList.remove('hidden');
      const startIn = document.getElementById('reports-custom-start');
      const endIn = document.getElementById('reports-custom-end');
      if (startIn && !startIn.value) {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        startIn.value = d.toISOString().slice(0, 10);
      }
      if (endIn && !endIn.value) {
        endIn.value = new Date().toISOString().slice(0, 10);
      }
    } else {
      customBox.classList.add('hidden');
    }
  }

  applyReportsCustomRange() {
    const startIn = document.getElementById('reports-custom-start');
    const endIn = document.getElementById('reports-custom-end');
    const s = startIn?.value;
    const e = endIn?.value;

    if (!s || !e) {
      this.toast('Please select both start and end dates.', 'error');
      return;
    }
    if (s > e) {
      this.toast('Start date cannot be after end date.', 'error');
      return;
    }

    this.reportsRange = 'custom';
    this.reportsStartDate = s;
    this.reportsEndDate = e;
    // Rule 9: Reset to Page 1 when a new filter or date range is selected
    if (this.pagination.reportsProducts) this.pagination.reportsProducts.page = 1;
    if (this.pagination.reportsInventory) this.pagination.reportsInventory.page = 1;
    if (this.pagination.reportsTransactions) this.pagination.reportsTransactions.page = 1;
    if (this.pagination.reportsStock) this.pagination.reportsStock.page = 1;
    this.loadReportsData();
  }

  handleReportsTypeChange(type) {
    this.currentReportType = type || 'all';
    // Rule 9: Reset to Page 1 when a new filter is selected
    if (this.pagination.reportsProducts) this.pagination.reportsProducts.page = 1;
    if (this.pagination.reportsInventory) this.pagination.reportsInventory.page = 1;
    if (this.pagination.reportsTransactions) this.pagination.reportsTransactions.page = 1;
    if (this.pagination.reportsStock) this.pagination.reportsStock.page = 1;
    this.applyReportsTypeVisibility();
  }

  applyReportsTypeVisibility() {
    const type = this.currentReportType || 'all';

    const kpiSec = document.getElementById('reports-kpi-section');
    const chartsSec = document.getElementById('reports-charts-section');
    const salesCard = document.getElementById('reports-sales-card');
    const distCard = document.getElementById('reports-distribution-card');
    const prodSec = document.getElementById('reports-products-section');
    const invSec = document.getElementById('reports-inventory-section');
    const txSec = document.getElementById('reports-transactions-section');
    const stockSec = document.getElementById('reports-stock-movement-section');

    const show = (el) => el && el.classList.remove('hidden');
    const hide = (el) => el && el.classList.add('hidden');

    if (type === 'sales') {
      show(kpiSec);
      show(chartsSec);
      show(salesCard);
      hide(distCard);
      hide(prodSec);
      hide(invSec);
      show(txSec);
      hide(stockSec);
      if (salesCard) salesCard.className = 'lg:col-span-3 bg-white rounded-2xl border border-[#E5ECE6] shadow-xs p-5 sm:p-6 space-y-4 admin-card-hover';
    } else if (type === 'orders') {
      show(kpiSec);
      show(chartsSec);
      hide(salesCard);
      show(distCard);
      hide(prodSec);
      hide(invSec);
      show(txSec);
      hide(stockSec);
      if (distCard) distCard.className = 'lg:col-span-3 bg-white rounded-2xl border border-[#E5ECE6] shadow-xs p-5 sm:p-6 space-y-4 flex flex-col justify-between admin-card-hover';
    } else if (type === 'products') {
      show(kpiSec);
      hide(chartsSec);
      show(prodSec);
      hide(invSec);
      hide(txSec);
      hide(stockSec);
    } else if (type === 'inventory') {
      show(kpiSec);
      hide(chartsSec);
      hide(prodSec);
      show(invSec);
      hide(txSec);
      show(stockSec);
    } else {
      // 'all'
      show(kpiSec);
      show(chartsSec);
      show(salesCard);
      show(distCard);
      if (salesCard) salesCard.className = 'lg:col-span-2 bg-white rounded-2xl border border-[#E5ECE6] shadow-xs p-5 sm:p-6 space-y-4 admin-card-hover';
      if (distCard) distCard.className = 'bg-white rounded-2xl border border-[#E5ECE6] shadow-xs p-5 sm:p-6 space-y-4 flex flex-col justify-between admin-card-hover';
      show(prodSec);
      show(invSec);
      show(txSec);
      show(stockSec);
    }
  }

  // 1. Four KPI Cards
  renderReportsKPIs() {
    if (!this.reportsData) return;
    const kpis = this.reportsData.kpis || {};

    // Revenue = completed AND paid. Completed-but-unpaid orders and net sales (all non-cancelled orders) are
    // shown underneath so unpaid Cash on Delivery / older unpaid orders are never counted as money received.
    const revEl = document.getElementById('reports-kpi-revenue');
    if (revEl) revEl.innerText = peso(kpis.realizedRevenue || 0);

    const revSubEl = document.getElementById('reports-kpi-revenue-sub');
    if (revSubEl) {
      revSubEl.innerText = `${peso(kpis.completedUnpaidAmount || 0)} unpaid · ${peso(kpis.totalRevenue || 0)} net sales`;
      revSubEl.title = `Completed but unpaid: ${peso(kpis.completedUnpaidAmount || 0)}. Net sales = all non-cancelled orders in the period (${kpis.activeOrders || 0} orders, ${peso(kpis.cancelledAmount || 0)} cancelled).`;
    }

    const ordEl = document.getElementById('reports-kpi-orders');
    if (ordEl) ordEl.innerText = String(kpis.totalOrders || 0);

    const ordSubEl = document.getElementById('reports-kpi-orders-sub');
    if (ordSubEl) {
      ordSubEl.innerText = `${kpis.completedOrders || 0} completed • ${kpis.cancelledOrders || 0} cancelled`;
    }

    const prodEl = document.getElementById('reports-kpi-products');
    if (prodEl) prodEl.innerText = `${kpis.productsSold || 0}`;

    const prodSubEl = document.getElementById('reports-kpi-products-sub');
    if (prodSubEl) {
      prodSubEl.innerText = 'Units of bouquets & floral items';
    }

    const aovEl = document.getElementById('reports-kpi-aov');
    if (aovEl) aovEl.innerText = peso(kpis.averageOrderValue || 0);

    const aovSubEl = document.getElementById('reports-kpi-aov-sub');
    if (aovSubEl) {
      aovSubEl.innerText = 'Average qualifying order total';
    }
  }

  // 3. Sales Performance & Order Distribution Charts
  renderReportsCharts() {
    if (!this.reportsData || typeof window.Chart === 'undefined') return;

    const data = this.reportsData;
    const salesList = data.salesPerformance || [];

    // 1. Sales Performance Line Chart
    const salesCanvas = document.getElementById('reports-sales-chart');
    const salesEmpty = document.getElementById('reports-sales-empty');

    if (salesCanvas) {
      if (this.reportsSalesChart) {
        this.reportsSalesChart.destroy();
        this.reportsSalesChart = null;
      }

      const hasSalesData = salesList.some(d => d.revenue > 0 || d.orders > 0);
      if (!hasSalesData && salesList.length === 0) {
        if (salesEmpty) salesEmpty.classList.remove('hidden');
      } else {
        if (salesEmpty) salesEmpty.classList.add('hidden');
        const ctx = salesCanvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 240);
        gradient.addColorStop(0, 'rgba(100, 125, 105, 0.28)');
        gradient.addColorStop(1, 'rgba(100, 125, 105, 0.00)');

        this.reportsSalesChart = new window.Chart(salesCanvas, {
          type: 'line',
          data: {
            labels: salesList.map(d => d.label),
            datasets: [
              {
                label: 'Net Sales (₱)',
                data: salesList.map(d => d.revenue),
                borderColor: '#647D69',
                backgroundColor: gradient,
                borderWidth: 2.5,
                fill: true,
                tension: 0.35,
                pointBackgroundColor: '#647D69',
                pointBorderColor: '#FFFFFF',
                pointBorderWidth: 1.5,
                pointRadius: 4,
                pointHoverRadius: 6
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#302C2A',
                titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: 'bold' },
                bodyFont: { family: 'Plus Jakarta Sans', size: 11 },
                padding: 10,
                cornerRadius: 8,
                callbacks: {
                  label: function (context) {
                    const row = salesList[context.dataIndex];
                    const ordersText = row && row.orders !== undefined ? ` (${row.orders} order${row.orders === 1 ? '' : 's'})` : '';
                    return `Net Sales: ₱${Number(context.raw || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}${ordersText}`;
                  }
                }
              }
            },
            scales: {
              x: {
                grid: { display: false },
                ticks: { font: { family: 'Plus Jakarta Sans', size: 10 }, color: '#6E6864' }
              },
              y: {
                type: 'linear',
                display: true,
                grid: { color: '#E5ECE6' },
                ticks: {
                  font: { family: 'Plus Jakarta Sans', size: 10 },
                  color: '#6E6864',
                  callback: (val) => `₱${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`
                }
              }
            }
          }
        });
      }
    }

    // 2. Order Distribution Donut Chart
    const distCanvas = document.getElementById('reports-distribution-chart');
    const legendEl = document.getElementById('reports-distribution-legend');

    if (distCanvas) {
      if (this.reportsDistributionChart) {
        this.reportsDistributionChart.destroy();
        this.reportsDistributionChart = null;
      }

      const dist = data.orderDistribution || {};
      const segments = [
        { label: 'Pending', count: dist.pending || 0, color: '#E09F3E' },
        { label: 'Processing', count: dist.processing || 0, color: '#647D69' },
        { label: 'Completed', count: dist.completed || 0, color: '#2D6A4F' },
        { label: 'Cancelled', count: dist.cancelled || 0, color: '#8C4A3E' }
      ];

      const totalOrders = segments.reduce((sum, s) => sum + s.count, 0);

      this.reportsDistributionChart = new window.Chart(distCanvas, {
        type: 'doughnut',
        data: {
          labels: segments.map(s => s.label),
          datasets: [{
            data: segments.map(s => s.count),
            backgroundColor: segments.map(s => s.color),
            borderColor: '#FFFFFF',
            borderWidth: 2,
            hoverOffset: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#302C2A',
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: function (ctx) {
                  const val = ctx.raw || 0;
                  const pct = totalOrders > 0 ? Math.round((val / totalOrders) * 100) : 0;
                  return `${ctx.label}: ${val} (${pct}%)`;
                }
              }
            }
          }
        }
      });

      if (legendEl) {
        legendEl.innerHTML = segments.map(s => {
          const pct = totalOrders > 0 ? Math.round((s.count / totalOrders) * 100) : 0;
          return `
            <div class="flex items-center justify-between p-1.5 rounded-lg bg-[#FFF9F5]/60 border border-[#E5ECE6]">
              <span class="flex items-center gap-1.5 truncate text-[11px] text-[#333038]">
                <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${s.color};"></span>
                <span class="truncate font-medium">${s.label}</span>
              </span>
              <span class="font-mono font-bold text-xs text-[#302C2A] ml-1">${s.count} <span class="text-[10px] text-[#6E6864] font-normal">(${pct}%)</span></span>
            </div>
          `;
        }).join('');
      }
    }
  }

  // 4. Best-Selling Products Table Controller
  renderReportsProductsTable() {
    if (!this.reportsData) return;
    const bestSellers = this.reportsData.bestSellers || [];

    const countBadge = document.getElementById('reports-bestsellers-count-badge');
    if (countBadge) countBadge.innerText = `${bestSellers.length} product${bestSellers.length === 1 ? '' : 's'}`;

    const tbody = document.getElementById('reports-bestsellers-tbody');
    const emptyEl = document.getElementById('reports-bestsellers-empty');
    if (!tbody) return;

    if (bestSellers.length === 0) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      this.renderPagination('reportsProducts', 0);
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');

    // Rule 1: Display a maximum of 6 records per page
    const pag = this.pagination.reportsProducts || { page: 1, pageSize: ROWS_PER_PAGE };
    const totalRecords = bestSellers.length;
    const totalPages = Math.ceil(totalRecords / pag.pageSize) || 1;
    if (pag.page > totalPages) pag.page = totalPages;
    if (pag.page < 1) pag.page = 1;

    const startIdx = (pag.page - 1) * pag.pageSize;
    const pageRecords = bestSellers.slice(startIdx, startIdx + pag.pageSize);

    tbody.innerHTML = pageRecords.map(p => `
      <tr class="hover:bg-[#FFF9F5] transition-colors">
        <td class="py-3 px-4 font-bold text-[#302C2A]">${esc(p.name)}</td>
        <td class="py-3 px-4 text-xs text-[#524D49] font-medium">${esc(p.category || 'General')}</td>
        <td class="py-3 px-4 text-right font-mono font-bold text-[#302C2A]">${p.quantity} <span class="text-[10px] text-[#6E6864] font-normal">units</span></td>
        <td class="py-3 px-4 text-right font-mono font-bold text-[#647D69]">${peso(p.revenue)}</td>
      </tr>
    `).join('');

    this.renderPagination('reportsProducts', totalRecords);
  }

  // 5. Inventory Health Controller
  renderReportsInventoryHealth() {
    if (!this.reportsData) return;
    const inv = this.reportsData.inventoryHealth || {};

    const inEl = document.getElementById('reports-inv-instock');
    if (inEl) inEl.innerText = String(inv.inStockCount || 0);

    const lowEl = document.getElementById('reports-inv-low');
    if (lowEl) lowEl.innerText = String(inv.lowStockCount || 0);

    const outEl = document.getElementById('reports-inv-out');
    if (outEl) outEl.innerText = String(inv.outOfStockCount || 0);

    const thSub = document.getElementById('reports-inv-threshold-sub');
    if (thSub) {
      const th = inv.threshold || inv.lowStockThreshold || 20;
      thSub.innerText = `Current inventory stock levels evaluated against Global Low-Stock Threshold (${th} units) configured in Shop Settings.`;
    }
  }

  handleReportsInventoryFilter(val) {
    this.reportsInventoryFilter = val || 'all';
    // Rule: Reset to Page 1 when filter changes
    if (this.pagination.reportsInventory) this.pagination.reportsInventory.page = 1;
    this.renderReportsInventoryTable();
  }

  handleReportsInventoryCategoryFilter(val) {
    this.reportsInventoryCategory = val || 'all';
    // Rule: Reset to Page 1 when filter changes
    if (this.pagination.reportsInventory) this.pagination.reportsInventory.page = 1;
    this.renderReportsInventoryTable();
  }

  renderReportsInventoryTable() {
    if (!this.reportsData) return;
    const inv = this.reportsData.inventoryHealth || {};
    const allItems = inv.items || inv.trackedItemsList || [];

    // Sync from DOM if rendered
    const catSelect = document.getElementById('reports-inventory-category-filter');
    const statusSelect = document.getElementById('reports-inventory-filter');

    if (catSelect && this.reportsInventoryCategory && catSelect.value !== this.reportsInventoryCategory) {
      catSelect.value = this.reportsInventoryCategory;
    } else if (catSelect && !this.reportsInventoryCategory) {
      this.reportsInventoryCategory = catSelect.value || 'all';
    }

    if (statusSelect && this.reportsInventoryFilter && statusSelect.value !== this.reportsInventoryFilter) {
      statusSelect.value = this.reportsInventoryFilter;
    } else if (statusSelect && !this.reportsInventoryFilter) {
      this.reportsInventoryFilter = statusSelect.value || 'all';
    }

    const categoryFilter = this.reportsInventoryCategory || 'all';
    const statusFilter = this.reportsInventoryFilter || 'all';

    let filtered = allItems;

    // 1. Filter by Category
    if (categoryFilter && categoryFilter !== 'all') {
      const targetCat = categoryFilter.trim().toLowerCase();
      filtered = filtered.filter(item => (item.category || '').trim().toLowerCase() === targetCat);
    }

    // 2. Filter by Stock Status
    if (statusFilter === 'alert' || statusFilter === 'alerts') {
      filtered = filtered.filter(i => i.status === 'low_stock' || i.status === 'out_of_stock');
    } else if (statusFilter === 'low_stock') {
      filtered = filtered.filter(i => i.status === 'low_stock');
    } else if (statusFilter === 'out_of_stock') {
      filtered = filtered.filter(i => i.status === 'out_of_stock');
    } else if (statusFilter === 'in_stock') {
      filtered = filtered.filter(i => i.status === 'in_stock');
    }

    const tbody = document.getElementById('reports-inventory-tbody');
    const emptyEl = document.getElementById('reports-inventory-empty');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (emptyEl) {
        emptyEl.textContent = 'No inventory items found matching the selected category and stock status.';
        emptyEl.classList.remove('hidden');
      }
      this.renderPagination('reportsInventory', 0);
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');

    // Rule 1: Display a maximum of 6 records per page
    const pag = this.pagination.reportsInventory || { page: 1, pageSize: ROWS_PER_PAGE };
    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / pag.pageSize) || 1;
    if (pag.page > totalPages) pag.page = totalPages;
    if (pag.page < 1) pag.page = 1;

    const startIdx = (pag.page - 1) * pag.pageSize;
    const pageRecords = filtered.slice(startIdx, startIdx + pag.pageSize);

    tbody.innerHTML = pageRecords.map(item => {
      const isOut = item.status === 'out_of_stock';
      const isLow = item.status === 'low_stock';
      const badgeCls = isOut
        ? 'bg-rose-50 text-rose-800 border-rose-200'
        : isLow
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-emerald-50 text-emerald-800 border-emerald-200';
      const badgeText = isOut ? 'Out of Stock' : (isLow ? 'Low Stock' : 'In Stock');
      const countCls = isOut ? 'text-rose-700' : (isLow ? 'text-amber-700' : 'text-emerald-700');

      return `
        <tr class="hover:bg-[#FFF9F5] transition-colors">
          <td class="py-3 px-4 font-bold text-[#302C2A]">${esc(item.name)}</td>
          <td class="py-3 px-4 text-xs text-[#524D49] font-medium">${esc(item.category || 'General')}</td>
          <td class="py-3 px-4 text-right font-mono font-bold ${countCls}">
            ${item.stockCount} <span class="text-[10px] text-[#6E6864] font-normal">${esc(item.unitOfMeasure || 'units')}</span>
          </td>
          <td class="py-3 px-4 text-right text-xs font-semibold ${countCls}">
            ${badgeText}
          </td>
        </tr>
      `;
    }).join('');

    this.renderPagination('reportsInventory', totalRecords);
  }

  // 6. Recent Transactions Table Controller
  renderReportsTransactionsTable() {
    if (!this.reportsData) return;
    const txList = this.reportsData.recentTransactions || [];

    const countBadge = document.getElementById('reports-tx-count-badge');
    if (countBadge) countBadge.innerText = `${txList.length} order${txList.length === 1 ? '' : 's'}`;

    const tbody = document.getElementById('reports-transactions-tbody');
    const emptyEl = document.getElementById('reports-transactions-empty');
    if (!tbody) return;

    if (txList.length === 0) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      this.renderPagination('reportsTransactions', 0);
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');

    // Rule 1: Display exactly 6 records per page
    const pag = this.pagination.reportsTransactions || { page: 1, pageSize: ROWS_PER_PAGE };
    const totalRecords = txList.length;
    const totalPages = Math.ceil(totalRecords / pag.pageSize) || 1;
    if (pag.page > totalPages) pag.page = totalPages;
    if (pag.page < 1) pag.page = 1;

    const startIdx = (pag.page - 1) * pag.pageSize;
    const pageRecords = txList.slice(startIdx, startIdx + pag.pageSize);

    tbody.innerHTML = pageRecords.map(o => `
      <tr class="hover:bg-[#FFF9F5] transition-colors">
        <td class="py-3 px-4 font-mono font-bold text-[#647D69]">${esc(o.orderNumber)}</td>
        <td class="py-3 px-4 font-bold text-[#302C2A]">${esc(o.customerName)}</td>
        <td class="py-3 px-4 text-[#6E6864]">${esc(o.date)}</td>
        <td class="py-3 px-4 text-right font-mono font-bold text-[#302C2A]">${peso(o.total)}</td>
        <td class="py-3 px-4">
          ${this.tableOrderStatusText(o.status)}
        </td>
        <td class="py-3 px-4 text-right whitespace-nowrap">
          ${this.renderReportsTransactionActionButtons(o)}
        </td>
      </tr>
    `).join('');

    this.renderPagination('reportsTransactions', totalRecords);
  }

  renderReportsTransactionActionButtons(o) {
    const menuItems = [
      this.buildMenuItem({
        label: 'Customer Profile',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        onClick: `window.adminApp.openOrderCustomerProfile('${esc(o.orderNumber)}')`
      }),
      this.buildMenuItem({
        label: 'Copy Order Number',
        icon: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
        onClick: `window.adminApp.copyTextToClipboard('${esc(o.orderNumber)}', 'Order number copied!')`
      })
    ];
    return this.renderTableActionButtons({
      viewTitle: 'View Order Details',
      onView: `window.adminApp.openOrderDetail('${esc(o.orderNumber)}')`,
      menuKey: `rptx-${esc(o.orderNumber)}`,
      menuItems
    });
  }

  // 7. Stock Movement History Controller
  scrollToStockHistory() {
    const el = document.getElementById('reports-stock-movement-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('ring-2', 'ring-[#647D69]', 'transition-all');
      setTimeout(() => el.classList.remove('ring-2', 'ring-[#647D69]'), 2000);
    }
  }

  getFilteredReportsStockMovements() {
    if (!this.reportsData || !Array.isArray(this.reportsData.stockMovements)) {
      return [];
    }
    let list = this.reportsData.stockMovements;

    // Search filter
    if (this.reportsStockSearch) {
      const q = this.reportsStockSearch.toLowerCase().trim();
      list = list.filter(m => {
        const name = (m.flowerName || m.flower_name || m.productName || '').toLowerCase();
        const reason = (m.reason || '').toLowerCase();
        const performed = (m.adminUsername || m.admin_username || m.performed_by || '').toLowerCase();
        const type = (m.type || m.transactionType || m.transaction_type || '').toLowerCase();
        const cat = (m.category || '').toLowerCase();
        const orderNum = (m.orderNumber || m.order_number || '').toLowerCase();
        return name.includes(q) || reason.includes(q) || performed.includes(q) || type.includes(q) || cat.includes(q) || orderNum.includes(q);
      });
    }

    // Category filter
    if (this.reportsStockCategory && this.reportsStockCategory !== 'all') {
      const catFilter = this.reportsStockCategory.toLowerCase();
      list = list.filter(m => (m.category || '').toLowerCase() === catFilter);
    }

    // Movement type filter
    if (this.reportsStockType && this.reportsStockType !== 'all') {
      const typeFilter = this.reportsStockType.toLowerCase();
      list = list.filter(m => (m.type || m.transactionType || m.transaction_type || '').toLowerCase() === typeFilter);
    }

    return list;
  }

  populateReportsStockCategories(movements) {
    const catSelect = document.getElementById('reports-stock-category');
    if (!catSelect) return;
    const currentVal = this.reportsStockCategory || 'all';

    const standardCats = ['Ready-Made Bouquets', 'Fresh Flowers', 'Fillers & Foliage', 'Wrapping Materials', 'Ribbons', 'Greeting Cards'];
    const dynamicCats = movements.map(m => m.category).filter(Boolean);
    const allUnique = Array.from(new Set([...standardCats, ...dynamicCats])).sort();

    let html = '<option value="all">All Categories</option>';
    allUnique.forEach(cat => {
      const selected = cat.toLowerCase() === currentVal.toLowerCase() ? 'selected' : '';
      html += `<option value="${esc(cat)}" ${selected}>${esc(cat)}</option>`;
    });
    catSelect.innerHTML = html;
  }

  formatManilaDateTime(isoStr) {
    if (!isoStr) return 'Not Available';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Manila',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      }).format(d);
    } catch (_) {
      return isoStr;
    }
  }

  renderReportsStockTable() {
    const rsClear = document.getElementById('reports-stock-clear-filters-btn');
    if (rsClear) rsClear.classList.toggle('filters-clear-hidden', !(this.reportsStockSearch || (this.reportsStockCategory || 'all') !== 'all' || (this.reportsStockType || 'all') !== 'all'));
    const allMovements = this.reportsData?.stockMovements || [];
    this.populateReportsStockCategories(allMovements);

    const filtered = this.getFilteredReportsStockMovements();
    const countBadge = document.getElementById('reports-stock-count-badge');
    if (countBadge) {
      countBadge.innerText = `${filtered.length} movement${filtered.length === 1 ? '' : 's'}`;
    }

    const tbody = document.getElementById('reports-stock-tbody');
    const emptyEl = document.getElementById('reports-stock-empty');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      this.renderPagination('reportsStock', 0);
      return;
    }

    if (emptyEl) emptyEl.classList.add('hidden');

    // Rule 1: Display a maximum of 6 records per page
    const pag = this.pagination.reportsStock || { page: 1, pageSize: ROWS_PER_PAGE };
    const totalRecords = filtered.length;
    const totalPages = Math.ceil(totalRecords / pag.pageSize) || 1;
    if (pag.page > totalPages) pag.page = totalPages;
    if (pag.page < 1) pag.page = 1;

    const startIdx = (pag.page - 1) * pag.pageSize;
    const pageRecords = filtered.slice(startIdx, startIdx + pag.pageSize);

    tbody.innerHTML = pageRecords.map(m => {
      // Critical Data Fixes: map both camelCase and snake_case with 'Not Available' fallback
      const productName = m.flowerName || m.flower_name || m.productName || 'Not Available';
      const category = m.category || 'General';
      const prevStock = (m.previousStock !== null && m.previousStock !== undefined)
        ? m.previousStock
        : (m.previous_stock !== null && m.previous_stock !== undefined ? m.previous_stock : (m.previous_quantity !== null && m.previous_quantity !== undefined ? m.previous_quantity : 'Not Available'));
      const newStock = (m.newStock !== null && m.newStock !== undefined)
        ? m.newStock
        : (m.new_stock !== null && m.new_stock !== undefined ? m.new_stock : (m.new_quantity !== null && m.new_quantity !== undefined ? m.new_quantity : 'Not Available'));
      const qtyChange = (m.quantityChange !== null && m.quantityChange !== undefined)
        ? m.quantityChange
        : (m.quantity_change !== null && m.quantity_change !== undefined ? m.quantity_change : (m.change_amount !== null && m.change_amount !== undefined ? m.change_amount : null));
      const formattedDate = (m.createdAt || m.created_at) ? this.formatManilaDateTime(m.createdAt || m.created_at) : 'Not Available';
      const reason = m.reason || 'Not Available';
      const performedBy = m.adminUsername || m.admin_username || m.performed_by || 'Admin';

      const changeVal = qtyChange !== null ? Number(qtyChange) : null;
      const isPositive = changeVal !== null && changeVal > 0;
      const isZero = changeVal !== null && changeVal === 0;
      const changeSign = changeVal !== null ? (isPositive ? `+${changeVal}` : `${changeVal}`) : 'Not Available';
      const changeClass = isPositive
        ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
        : isZero
          ? 'text-stone-600 bg-stone-50 border-stone-200'
          : changeVal !== null
            ? 'text-rose-700 bg-rose-50 border-rose-200'
            : 'text-stone-500 bg-stone-50 border-stone-200';

      const type = m.type || m.transactionType || m.transaction_type;
      const typeLabel = {
        'restock': 'Restock',
        'deduct': 'Manual Adjustment',
        'order_fulfillment': 'Order Deduction',
        'order_restoration': 'Order Restoration',
        'correction': 'Count Correction'
      }[type] || (type ? String(type).replace(/_/g, ' ') : 'Adjustment');

      const typeBadgeClass = {
        'restock': 'bg-emerald-50 text-emerald-700 border-emerald-200',
        'order_fulfillment': 'bg-rose-50 text-rose-700 border-rose-200',
        'order_restoration': 'bg-sky-50 text-sky-700 border-sky-200',
        'deduct': 'bg-amber-50 text-amber-700 border-amber-200',
        'correction': 'bg-purple-50 text-purple-700 border-purple-200'
      }[type] || 'bg-stone-50 text-stone-700 border-stone-200';

      return `
        <tr class="hover:bg-[#FFF9F5] transition-colors">
          <td class="py-3 px-4 font-bold text-[#302C2A]">${esc(productName)}</td>
          <td class="py-3 px-4 text-xs font-medium text-[#302C2A]">${esc(typeLabel)}</td>
          <td class="py-3 px-4 text-right font-mono font-bold text-xs ${isPositive ? 'text-emerald-700' : (changeVal < 0 ? 'text-rose-700' : 'text-stone-600')}">
            ${esc(changeSign)}
          </td>
          <td class="py-3 px-4 text-right font-mono font-semibold text-[#6E6864]">${prevStock}</td>
          <td class="py-3 px-4 text-right font-mono font-bold text-[#302C2A]">${newStock}</td>
          <td class="py-3 px-4 text-[#6E6864] font-mono text-[11px] whitespace-nowrap">${esc(formattedDate)}</td>
          <td class="py-3 px-4 text-[#6E6864] max-w-[200px] truncate" title="${esc(reason)}">${esc(reason)}</td>
          <td class="py-3 px-4 text-right text-[#6E6864] font-medium font-mono text-[11px]">${esc(performedBy)}</td>
        </tr>
      `;
    }).join('');

    this.renderPagination('reportsStock', totalRecords);
  }

  handleReportsStockSearch(val) {
    this.reportsStockSearch = (val || '').toLowerCase().trim();
    if (this.pagination.reportsStock) this.pagination.reportsStock.page = 1;
    this.renderReportsStockTable();
  }

  handleReportsStockCategory(val) {
    this.reportsStockCategory = val || 'all';
    if (this.pagination.reportsStock) this.pagination.reportsStock.page = 1;
    this.renderReportsStockTable();
  }

  handleReportsStockType(val) {
    this.reportsStockType = val || 'all';
    if (this.pagination.reportsStock) this.pagination.reportsStock.page = 1;
    this.renderReportsStockTable();
  }

  clearReportsStockFilters() {
    this.reportsStockSearch = '';
    this.reportsStockCategory = 'all';
    this.reportsStockType = 'all';
    const sIn = document.getElementById('reports-stock-search');
    if (sIn) sIn.value = '';
    const catIn = document.getElementById('reports-stock-category');
    if (catIn) catIn.value = 'all';
    const typeIn = document.getElementById('reports-stock-type');
    if (typeIn) typeIn.value = 'all';
    if (this.pagination.reportsStock) this.pagination.reportsStock.page = 1;
    this.renderReportsStockTable();
  }

  // --- CSV Generation Helpers ---
  csvCell(val) {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  }

  downloadCSV(csvContent, filename) {
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportReportsStockCSV() {
    const list = this.getFilteredReportsStockMovements();
    if (!list || list.length === 0) {
      this.toast('No stock movements available to export.', 'warning');
      return;
    }

    const headers = [
      'Product',
      'Movement Type',
      'Quantity Change',
      'Previous Stock',
      'New Stock',
      'Date & Time',
      'Reason',
      'Performed By'
    ];

    const rows = list.map(m => [
      m.flowerName || m.flower_name || m.productName || 'Not Available',
      m.type || m.transactionType || m.transaction_type || 'Adjustment',
      m.quantityChange != null ? (Number(m.quantityChange) > 0 ? `+${m.quantityChange}` : m.quantityChange) : (m.change_amount != null ? (Number(m.change_amount) > 0 ? `+${m.change_amount}` : m.change_amount) : '0'),
      m.previousStock != null ? m.previousStock : (m.previous_stock != null ? m.previous_stock : (m.previous_quantity != null ? m.previous_quantity : 'Not Available')),
      m.newStock != null ? m.newStock : (m.new_stock != null ? m.new_stock : (m.new_quantity != null ? m.new_quantity : 'Not Available')),
      (m.createdAt || m.created_at) ? this.formatManilaDateTime(m.createdAt || m.created_at) : 'Not Available',
      m.reason || 'Not Available',
      m.adminUsername || m.admin_username || m.performed_by || 'Admin'
    ]);

    const csvContent = [headers.map(h => this.csvCell(h)).join(','), ...rows.map(r => r.map(c => this.csvCell(c)).join(','))].join('\r\n');
    const dateStr = new Date().toISOString().slice(0, 10);
    this.downloadCSV(csvContent, `Umaira_Florist_Stock_Movements_${dateStr}.csv`);
    this.toast('Stock movement history CSV exported successfully.', 'success');
  }

  // =========================================================================
  // UNIFIED EXPORT REPORT ENGINE (PDF & CSV)
  // =========================================================================

  getReportFilename(reportType, format) {
    const tz = 'Asia/Manila';
    const dateStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    const typeTitles = {
      sales: 'Sales',
      orders: 'Orders',
      products: 'Products',
      inventory: 'Inventory',
      complete: 'Complete_Business'
    };
    const title = typeTitles[reportType] || 'Business';
    return `Umaira_${title}_Report_${dateStr}.${String(format).toLowerCase()}`;
  }

  openGenerateReportModal() {
    const modal = document.getElementById('admin-report-modal');
    if (!modal) return;

    const tz = 'Asia/Manila';
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

    // Restrict date pickers from selecting future dates
    const startIn = document.getElementById('report-modal-start');
    const endIn = document.getElementById('report-modal-end');
    if (startIn) {
      startIn.max = todayStr;
      if (this.reportsRange === 'custom' && this.reportsStartDate) {
        startIn.value = this.reportsStartDate;
      } else if (!startIn.value) {
        startIn.value = todayStr;
      }
    }
    if (endIn) {
      endIn.max = todayStr;
      if (this.reportsRange === 'custom' && this.reportsEndDate) {
        endIn.value = this.reportsEndDate;
      } else if (!endIn.value) {
        endIn.value = todayStr;
      }
    }

    // Set modal range dropdown default to match current Reports page filter
    const rangeSelect = document.getElementById('report-modal-range');
    const defaultRange = (this.reportsRange && ['today', 'last7days', 'last30days', 'custom'].includes(this.reportsRange))
      ? this.reportsRange
      : 'last7days';

    if (rangeSelect) {
      rangeSelect.value = defaultRange;
    }

    this.handleReportModalRangeChange(defaultRange);

    // Preselect current report type if user has filtered on the page
    const typeSelect = document.getElementById('report-modal-type');
    if (typeSelect) {
      if (this.currentReportType && ['sales', 'orders', 'products', 'inventory'].includes(this.currentReportType)) {
        typeSelect.value = this.currentReportType;
      } else {
        typeSelect.value = 'complete';
      }
      this.handleReportModalTypeChange(typeSelect.value);
    }

    // Default to PDF format card
    this.handleReportFormatChange('pdf');

    this._clearReportModalDateError();
    modal.classList.remove('hidden');
  }

  closeGenerateReportModal() {
    const modal = document.getElementById('admin-report-modal');
    if (modal) modal.classList.add('hidden');
    this._clearReportModalDateError();
  }

  handleReportModalRangeChange(range) {
    const customDiv = document.getElementById('report-modal-custom-dates');
    if (!customDiv) return;

    if (range === 'custom') {
      customDiv.classList.remove('hidden');
      const tz = 'Asia/Manila';
      const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
      const startIn = document.getElementById('report-modal-start');
      const endIn = document.getElementById('report-modal-end');
      if (startIn && !startIn.value) startIn.value = this.reportsStartDate || todayStr;
      if (endIn && !endIn.value) endIn.value = this.reportsEndDate || todayStr;
      this.validateReportModalCustomDates();
    } else {
      customDiv.classList.add('hidden');
      this._clearReportModalDateError();
    }
  }

  validateReportModalCustomDates() {
    const range = document.getElementById('report-modal-range')?.value;
    if (range !== 'custom') {
      this._clearReportModalDateError();
      return true;
    }

    const startIn = document.getElementById('report-modal-start');
    const endIn = document.getElementById('report-modal-end');
    const startVal = startIn ? startIn.value.trim() : '';
    const endVal = endIn ? endIn.value.trim() : '';

    const tz = 'Asia/Manila';
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

    if (!startVal || !endVal) {
      this._showReportModalDateError('Both Start Date and End Date are required for Custom Range.');
      return false;
    }

    if (startVal > endVal) {
      this._showReportModalDateError('Start Date cannot be later than End Date.');
      return false;
    }

    if (startVal > todayStr) {
      this._showReportModalDateError('Start Date cannot be in the future. Please select today or an earlier date.');
      return false;
    }

    if (endVal > todayStr) {
      this._showReportModalDateError('End Date cannot be in the future. Please select today or an earlier date.');
      return false;
    }

    this._clearReportModalDateError();
    return true;
  }

  _showReportModalDateError(msg) {
    const errBox = document.getElementById('report-modal-date-error');
    const errText = document.getElementById('report-modal-date-error-text');
    if (errBox && errText) {
      errText.innerText = msg;
      errBox.classList.remove('hidden');
    }
  }

  _clearReportModalDateError() {
    const errBox = document.getElementById('report-modal-date-error');
    if (errBox) {
      errBox.classList.add('hidden');
    }
  }

  async _getModalReportData(modalRange) {
    const startIn = document.getElementById('report-modal-start')?.value || '';
    const endIn = document.getElementById('report-modal-end')?.value || '';

    // If modal matches active page filter, reuse cached report data
    const isSameRange = (modalRange === this.reportsRange);
    const isSameCustom = (modalRange === 'custom' && startIn === this.reportsStartDate && endIn === this.reportsEndDate);

    if (this.reportsData && (isSameCustom || (isSameRange && modalRange !== 'custom'))) {
      return this.reportsData;
    }

    // Fetch report data independently without altering main Reports page filters
    let url = `/api/admin/reports/data?range=${encodeURIComponent(modalRange)}`;
    if (modalRange === 'custom') {
      if (startIn) url += `&startDate=${encodeURIComponent(startIn)}`;
      if (endIn) url += `&endDate=${encodeURIComponent(endIn)}`;
    }
    const res = await this.apiRequest(url);
    if (!res.ok) throw new Error(res.error || 'Failed to fetch report data for selected range.');
    return res.data;
  }

  handleReportModalTypeChange(type) {
    const infoEl = document.getElementById('report-modal-included-info');
    if (!infoEl) return;
    const infoMap = {
      sales: 'Total Revenue, Sales Performance, Average Order Value',
      orders: 'Order Details, Order Status, Order Totals, Dates',
      products: 'Best-Selling Products, Quantities Sold, Revenue',
      inventory: 'Stock Levels, Low-Stock Items, Stock Movement History',
      complete: 'Combined Sales, Orders, Products, and Inventory Reports'
    };
    infoEl.innerText = infoMap[type] || 'Essential business data matching your selection.';
  }

  handleReportFormatChange(format) {
    const pdfCard = document.getElementById('report-format-card-pdf');
    const csvCard = document.getElementById('report-format-card-csv');
    const pdfRadio = document.getElementById('report-format-pdf');
    const csvRadio = document.getElementById('report-format-csv');

    if (format === 'csv') {
      if (csvRadio) csvRadio.checked = true;
      if (pdfRadio) pdfRadio.checked = false;
      csvCard?.classList.add('border-[#647D69]', 'bg-[#EBF1EC]/60', 'ring-2', 'ring-[#647D69]/30');
      csvCard?.classList.remove('border-[#E5ECE6]', 'bg-white');
      pdfCard?.classList.remove('border-[#647D69]', 'bg-[#EBF1EC]/60', 'ring-2', 'ring-[#647D69]/30');
      pdfCard?.classList.add('border-[#E5ECE6]', 'bg-white');
    } else {
      if (pdfRadio) pdfRadio.checked = true;
      if (csvRadio) csvRadio.checked = false;
      pdfCard?.classList.add('border-[#647D69]', 'bg-[#EBF1EC]/60', 'ring-2', 'ring-[#647D69]/30');
      pdfCard?.classList.remove('border-[#E5ECE6]', 'bg-white');
      csvCard?.classList.remove('border-[#647D69]', 'bg-[#EBF1EC]/60', 'ring-2', 'ring-[#647D69]/30');
      csvCard?.classList.add('border-[#E5ECE6]', 'bg-white');
    }
  }

  async handleGenerateReport(e) {
    if (e && e.preventDefault) e.preventDefault();

    const modalRange = document.getElementById('report-modal-range')?.value || 'last7days';
    if (modalRange === 'custom') {
      const isValid = this.validateReportModalCustomDates();
      if (!isValid) return;
    }

    const submitBtn = document.getElementById('report-modal-submit-btn');
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : '';

    try {
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-60', 'cursor-not-allowed');
        submitBtn.innerHTML = `
          <svg class="w-4 h-4 animate-spin inline-block mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" class="opacity-25"></circle><path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" class="opacity-75"></path></svg>
          <span>Generating Report...</span>
        `;
      }

      const reportType = document.getElementById('report-modal-type')?.value || 'complete';
      const formatRadio = document.querySelector('input[name="report-modal-format"]:checked');
      const format = formatRadio ? formatRadio.value : 'pdf';

      // Obtain report data for the selected modal date range
      const reportData = await this._getModalReportData(modalRange);

      if (format === 'csv') {
        await this.handleGenerateCSVReport(reportType, reportData);
      } else {
        await this._downloadPDFReport(reportType, reportData);
      }
    } catch (err) {
      console.error('Report generation error:', err);
      this.toast(err.message || 'Failed to generate report.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-60', 'cursor-not-allowed');
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  }

  async _downloadPDFReport(reportType, reportData) {
    this.toast('Generating official PDF report...', 'info');
    const { doc } = await this._preparePDFDoc(reportType, reportData);
    const filename = this.getReportFilename(reportType, 'pdf');
    doc.save(filename);
    this.toast('PDF report downloaded successfully.', 'success');
    this.closeGenerateReportModal();
  }

  async handleGenerateCSVReport(overrideType, overrideReportData) {
    try {
      const typeSelect = document.getElementById('report-modal-type');
      const reportType = overrideType || typeSelect?.value || 'complete';
      let reportData = overrideReportData;

      if (!reportData) {
        const modalRange = document.getElementById('report-modal-range')?.value || this.reportsRange || 'last7days';
        reportData = await this._getModalReportData(modalRange);
      }

      const filename = this.getReportFilename(reportType, 'csv');
      let csvContent = '';

      if (reportType === 'sales') {
        const headers = ['Date / Interval', 'Period Label', 'Net Sales (PHP)', 'Gross Sales (PHP)', 'Orders Placed', 'Units Sold'];
        const rows = (reportData.salesPerformance || []).map(s => [
          s.date || s.hour || '',
          s.label,
          s.revenue || 0,
          s.grossSales || s.revenue || 0,
          s.orders || 0,
          s.itemsSold || 0
        ]);
        const summaryRows = [
          ['UMAIRA FLORIST - SALES & REVENUE REPORT', ''],
          ['Reporting Period', `${reportData.startDate} to ${reportData.endDate}`],
          ['Revenue - Paid & Completed (PHP)', reportData.kpis?.realizedRevenue || 0],
          ['Completed but Unpaid (PHP)', reportData.kpis?.completedUnpaidAmount || 0],
          ['Net Sales excl. Cancelled (PHP)', reportData.kpis?.totalRevenue || 0],
          ['Total Orders', reportData.kpis?.totalOrders || 0],
          ['Average Order Value (PHP)', reportData.kpis?.averageOrderValue || 0],
          ['Generated On', new Date().toISOString()],
          ['', ''],
          headers,
          ...rows
        ];
        csvContent = summaryRows.map(r => r.map(c => this.csvCell(c)).join(',')).join('\r\n');
      } else if (reportType === 'orders') {
        const headers = ['Order ID', 'Order Date', 'Customer Name', 'Recipient', 'Fulfillment', 'Payment Method', 'Payment Status', 'Status', 'Total Amount (PHP)'];
        const rows = (reportData.recentTransactions || []).map(o => [
          o.orderNumber,
          o.date,
          o.customerName,
          o.recipientName || 'Same as Customer',
          o.fulfillment ? o.fulfillment.toUpperCase() : 'DELIVERY',
          o.paymentMethod || 'Cash',
          o.paymentStatus || 'Pending',
          o.status,
          o.total
        ]);
        const summaryRows = [
          ['UMAIRA FLORIST - CUSTOMER ORDERS REPORT', ''],
          ['Reporting Period', `${reportData.startDate} to ${reportData.endDate}`],
          ['Total Orders', reportData.kpis?.totalOrders || 0],
          ['Completed Orders', reportData.kpis?.completedOrders || 0],
          ['Cancelled Orders', reportData.kpis?.cancelledOrders || 0],
          ['Generated On', new Date().toISOString()],
          ['', ''],
          headers,
          ...rows
        ];
        csvContent = summaryRows.map(r => r.map(c => this.csvCell(c)).join(',')).join('\r\n');
      } else if (reportType === 'products') {
        const headers = ['Rank', 'Product Name', 'Category', 'Item Type', 'Quantity Sold', 'Gross Revenue (PHP)'];
        const rows = (reportData.bestSellers || []).map((p, idx) => [
          idx + 1,
          p.name,
          p.category || 'General',
          (p.itemType || 'Product').toUpperCase(),
          p.quantity || 0,
          p.revenue || 0
        ]);
        const summaryRows = [
          ['UMAIRA FLORIST - BEST-SELLING PRODUCTS REPORT', ''],
          ['Reporting Period', `${reportData.startDate} to ${reportData.endDate}`],
          ['Total Products Sold', reportData.kpis?.productsSold || 0],
          ['Top Products Listed', (reportData.bestSellers || []).length],
          ['Generated On', new Date().toISOString()],
          ['', ''],
          headers,
          ...rows
        ];
        csvContent = summaryRows.map(r => r.map(c => this.csvCell(c)).join(',')).join('\r\n');
      } else if (reportType === 'inventory') {
        const threshold = reportData.inventoryHealth?.threshold || 20;
        const invItems = (reportData.inventoryHealth?.items || reportData.inventoryHealth?.trackedItemsList || []);
        const movements = (reportData.stockMovements || []);

        const lines = [
          ['UMAIRA FLORIST - INVENTORY & STOCK REPORT', ''],
          ['Reporting Period', `${reportData.startDate} to ${reportData.endDate}`],
          ['Tracked Items', reportData.inventoryHealth?.trackedItems || invItems.length],
          ['In Stock Items', reportData.inventoryHealth?.inStockCount || 0],
          ['Low Stock Items', reportData.inventoryHealth?.lowStockCount || 0],
          ['Out of Stock Items', reportData.inventoryHealth?.outOfStockCount || 0],
          ['Global Low-Stock Threshold', threshold],
          ['Generated On', new Date().toISOString()],
          ['', ''],
          ['--- CURRENT INVENTORY STOCK STATUS & LEVELS ---', '', '', '', '', '', ''],
          ['SKU / Item ID', 'Item Name', 'Category', 'Current Stock', 'Unit of Measure', 'Low-Stock Threshold', 'Health Status'],
          ...invItems.map(i => [
            i.id,
            i.name,
            i.category || 'General',
            i.stockCount != null ? i.stockCount : 0,
            i.unitOfMeasure || 'units',
            i.threshold != null ? i.threshold : threshold,
            i.status === 'out_of_stock' ? 'Out of Stock' : (i.status === 'low_stock' ? 'Low Stock' : 'In Stock')
          ]),
          ['', ''],
          ['--- STOCK MOVEMENT HISTORY AUDIT LOG ---', '', '', '', '', '', '', ''],
          ['Product', 'Movement Type', 'Quantity Change', 'Previous Stock', 'New Stock', 'Date & Time', 'Reason', 'Performed By'],
          ...movements.map(m => [
            m.flowerName || m.flower_name || m.productName || 'Not Available',
            m.type || m.transactionType || m.transaction_type || 'Adjustment',
            m.quantityChange != null ? (Number(m.quantityChange) > 0 ? `+${m.quantityChange}` : m.quantityChange) : (m.change_amount != null ? (Number(m.change_amount) > 0 ? `+${m.change_amount}` : m.change_amount) : '0'),
            m.previousStock != null ? m.previousStock : (m.previous_stock != null ? m.previous_stock : (m.previous_quantity != null ? m.previous_quantity : 'Not Available')),
            m.newStock != null ? m.newStock : (m.new_stock != null ? m.new_stock : (m.new_quantity != null ? m.new_quantity : 'Not Available')),
            (m.createdAt || m.created_at) ? this.formatManilaDateTime(m.createdAt || m.created_at) : 'Not Available',
            m.reason || 'Not Available',
            m.adminUsername || m.admin_username || m.performed_by || 'Admin'
          ])
        ];
        csvContent = lines.map(row => row.map(c => this.csvCell(c)).join(',')).join('\r\n');
      } else {
        // Complete summary CSV (Structured sections)
        const kpis = reportData.kpis || {};
        const threshold = reportData.inventoryHealth?.threshold || 20;
        const invItems = (reportData.inventoryHealth?.items || reportData.inventoryHealth?.trackedItemsList || []);
        const lines = [
          ['UMAIRA FLORIST - COMPLETE BUSINESS REPORT', ''],
          ['Reporting Period', `${reportData.startDate} to ${reportData.endDate}`],
          ['Revenue - Paid & Completed (PHP)', kpis.realizedRevenue || 0],
          ['Completed but Unpaid (PHP)', kpis.completedUnpaidAmount || 0],
          ['Net Sales excl. Cancelled (PHP)', kpis.totalRevenue || 0],
          ['Total Orders', kpis.totalOrders || 0],
          ['Products Sold', kpis.productsSold || 0],
          ['Average Order Value (PHP)', kpis.averageOrderValue || 0],
          ['Generated On', new Date().toISOString()],
          ['', ''],
          ['--- SECTION 1: SALES PERFORMANCE TIMELINE ---', '', '', '', ''],
          ['Date / Interval', 'Period Label', 'Revenue (PHP)', 'Orders Placed', 'Units Sold'],
          ...(reportData.salesPerformance || []).map(s => [s.date || s.hour || '', s.label, s.revenue || 0, s.orders || 0, s.itemsSold || 0]),
          ['', ''],
          ['--- SECTION 2: TOP-SELLING PRODUCTS ---', '', '', '', ''],
          ['Rank', 'Product Name', 'Category', 'Quantity Sold', 'Revenue (PHP)'],
          ...(reportData.bestSellers || []).map((p, idx) => [idx + 1, p.name, p.category || 'General', p.quantity || 0, p.revenue || 0]),
          ['', ''],
          ['--- SECTION 3: CUSTOMER ORDERS & TRANSACTIONS ---', '', '', '', ''],
          ['Order ID', 'Date', 'Customer', 'Status', 'Total (PHP)'],
          ...(reportData.recentTransactions || []).map(o => [o.orderNumber, o.date, o.customerName, o.status, o.total]),
          ['', ''],
          ['--- SECTION 4: INVENTORY HEALTH SNAPSHOT ---', '', '', '', '', ''],
          ['SKU / Item ID', 'Item Name', 'Category', 'Current Stock', 'Threshold', 'Status'],
          ...invItems.map(i => [i.id, i.name, i.category || 'General', i.stockCount != null ? i.stockCount : 0, i.threshold != null ? i.threshold : threshold, i.status]),
          ['', ''],
          ['--- SECTION 5: STOCK MOVEMENT AUDIT TRAIL ---', '', '', '', '', '', '', ''],
          ['Product', 'Movement Type', 'Quantity Change', 'Previous Stock', 'New Stock', 'Date & Time', 'Reason', 'Performed By'],
          ...(reportData.stockMovements || []).map(m => [
            m.flowerName || m.flower_name || m.productName || 'Not Available',
            m.type || m.transactionType || m.transaction_type || 'Adjustment',
            m.quantityChange != null ? (Number(m.quantityChange) > 0 ? `+${m.quantityChange}` : m.quantityChange) : '0',
            m.previousStock != null ? m.previousStock : 'Not Available',
            m.newStock != null ? m.newStock : 'Not Available',
            (m.createdAt || m.created_at) ? this.formatManilaDateTime(m.createdAt || m.created_at) : 'Not Available',
            m.reason || 'Not Available',
            m.adminUsername || m.admin_username || m.performed_by || 'Admin'
          ])
        ];
        csvContent = lines.map(row => row.map(c => this.csvCell(c)).join(',')).join('\r\n');
      }

      this.downloadCSV(csvContent, filename);
      this.toast('CSV report generated and downloaded successfully.', 'success');
      this.closeGenerateReportModal();
    } catch (err) {
      this.toast(err.message || 'Failed to generate CSV report.', 'error');
    }
  }

  async _preparePDFDoc(overrideType, overrideReportData) {
    if (!window.ReportPDFGenerator || !window.ReportPDFGenerator.isSupported()) {
      throw new Error('PDF Generation engine is not ready. Please verify your connection to cdnjs.');
    }

    const typeSelect = document.getElementById('report-modal-type');
    const reportType = overrideType || typeSelect?.value || 'complete';
    let reportData = overrideReportData;

    if (!reportData) {
      const modalRange = document.getElementById('report-modal-range')?.value || this.reportsRange || 'last7days';
      reportData = await this._getModalReportData(modalRange);
    }

    let chartImage = null;
    const matchesPageData = this.reportsData && 
      reportData.startDate === this.reportsData.startDate && 
      reportData.endDate === this.reportsData.endDate;

    if (matchesPageData) {
      const salesCanvas = document.getElementById('reports-sales-chart');
      if (salesCanvas) {
        try {
          chartImage = salesCanvas.toDataURL('image/png');
        } catch (_) {}
      }
    }

    const rangeLabel = reportData.startDate === reportData.endDate
      ? reportData.startDate
      : `${reportData.startDate} to ${reportData.endDate}`;

    const user = sessionStorage.getItem('umaira_admin_user') || 'Administrator';

    const doc = window.ReportPDFGenerator.generate(reportData, {
      reportType,
      rangeLabel,
      generatedBy: user,
      chartImage,
      includeCharts: !!chartImage,
      includeTables: true
    });

    return { doc, reportType, reportData };
  }

  // Quick Export Aliases
  handleQuickExportCSV() {
    this.openGenerateReportModal();
    this.handleReportFormatChange('csv');
  }

  handleQuickExportPDF() {
    this.openGenerateReportModal();
    this.handleReportFormatChange('pdf');
  }

  // =========================================================================
  // UNIFIED ADMIN ACCOUNT SETTINGS CONTROLLER (Profile, Security, Session)
  // =========================================================================

  openAccountModal() {
    this.stagedAvatarDataUrl = null;
    this.stagedAvatarRemoved = false;

    // Reset feedback alerts
    const profAlert = document.getElementById('admin-profile-alert');
    if (profAlert) {
      profAlert.className = 'hidden';
      profAlert.innerText = '';
    }
    const pwdAlert = document.getElementById('admin-password-alert');
    if (pwdAlert) {
      pwdAlert.className = 'hidden';
      pwdAlert.innerText = '';
    }

    // Reset password inputs
    ['admin-pwd-current', 'admin-pwd-new', 'admin-pwd-confirm'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.value = '';
        el.type = 'password';
      }
    });

    // Populate profile inputs
    const p = this.adminProfile || {};
    const usernameInput = document.getElementById('admin-profile-username-input');
    if (usernameInput) usernameInput.value = p.username || 'admin';

    const nameInput = document.getElementById('admin-profile-display-name-input');
    if (nameInput) nameInput.value = p.displayName || sessionStorage.getItem('umaira_admin_user') || 'Admin Staff';

    const roleText = document.getElementById('admin-profile-role-text');
    if (roleText) roleText.innerText = p.role || 'Administrator';

    // Set Avatar Preview in Modal
    const modalImg = document.getElementById('admin-modal-avatar-img');
    const modalInitials = document.getElementById('admin-modal-avatar-initials');
    const displayName = p.displayName || sessionStorage.getItem('umaira_admin_user') || 'Admin Staff';
    const initials = displayName.trim().split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join('').toUpperCase() || 'A';

    if (modalInitials) modalInitials.innerText = initials;

    if (p.avatarUrl && modalImg) {
      modalImg.src = p.avatarUrl;
      modalImg.classList.remove('hidden');
      modalInitials?.classList.add('hidden');
    } else {
      modalImg?.classList.add('hidden');
      modalInitials?.classList.remove('hidden');
    }

    const fileInput = document.getElementById('admin-profile-file-input');
    if (fileInput) fileInput.value = '';

    const modal = document.getElementById('admin-account-modal');
    if (modal) modal.classList.remove('hidden');
  }

  closeAccountModal() {
    const modal = document.getElementById('admin-account-modal');
    if (modal) modal.classList.add('hidden');
    this.stagedAvatarDataUrl = null;
    this.stagedAvatarRemoved = false;
  }

  // Backward-compatibility aliases
  openProfileModal() { this.openAccountModal(); }
  closeProfileModal() { this.closeAccountModal(); }
  openPasswordModal() { this.openAccountModal(); }
  closePasswordModal() { this.closeAccountModal(); }
  isAccountPopoverOpen() { return false; }
  toggleAccountPopover() { this.openAccountModal(); }
  closeAccountPopover() {}

  async fetchAdminProfile() {
    if (!this.token) return null;
    try {
      const res = await fetch('/api/admin/profile', {
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'x-admin-token': this.token
        }
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => ({}));
      if (data.ok && data.admin) {
        this.adminProfile = data.admin;
        if (data.admin.displayName) {
          sessionStorage.setItem('umaira_admin_user', data.admin.displayName);
        }
        this.renderSidebarProfile();
        return data.admin;
      }
    } catch (_) {}
    return null;
  }

  renderSidebarProfile() {
    const p = this.adminProfile || {};
    const storedUser = sessionStorage.getItem('umaira_admin_user');
    const displayName = p.displayName || storedUser || 'Admin Staff';
    const username = p.username || 'admin';
    const role = p.role || 'Administrator';
    const avatarUrl = p.avatarUrl || '';

    // Update Text Elements
    const userDisplay = document.getElementById('admin-user-display');
    if (userDisplay) userDisplay.innerText = displayName;

    const roleLabel = document.getElementById('admin-sidebar-role-label');
    if (roleLabel) roleLabel.innerText = role;

    const welcomeName = document.getElementById('dashboard-welcome-name');
    if (welcomeName) welcomeName.innerText = displayName;

    // Compute Initials Fallback
    const initials = (displayName || username)
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'A';

    // Sidebar Avatar Elements
    const imgEl = document.getElementById('admin-sidebar-avatar-img');
    const initialsEl = document.getElementById('admin-sidebar-avatar-initials');

    if (avatarUrl) {
      if (imgEl) {
        imgEl.src = avatarUrl;
        imgEl.classList.remove('hidden');
      }
      if (initialsEl) initialsEl.classList.add('hidden');
    } else {
      if (imgEl) {
        imgEl.src = '';
        imgEl.classList.add('hidden');
      }
      if (initialsEl) {
        initialsEl.innerText = initials;
        initialsEl.classList.remove('hidden');
      }
    }
  }

  handleAvatarFileSelect(event) {
    const file = event.target?.files?.[0];
    if (!file) return;

    const alertEl = document.getElementById('admin-profile-alert');
    const validMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validMimes.includes(file.type.toLowerCase())) {
      if (alertEl) {
        alertEl.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200 block';
        alertEl.innerText = 'Please select a valid image file (PNG, JPG, or WebP).';
      }
      event.target.value = '';
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      if (alertEl) {
        alertEl.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200 block';
        alertEl.innerText = 'Profile photo must be smaller than 5 MB.';
      }
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      this.stagedAvatarDataUrl = e.target.result;
      this.stagedAvatarRemoved = false;

      const modalImg = document.getElementById('admin-modal-avatar-img');
      const modalInitials = document.getElementById('admin-modal-avatar-initials');
      if (modalImg) {
        modalImg.src = this.stagedAvatarDataUrl;
        modalImg.classList.remove('hidden');
      }
      if (modalInitials) modalInitials.classList.add('hidden');

      if (alertEl) {
        alertEl.className = 'hidden';
        alertEl.innerText = '';
      }
    };
    reader.readAsDataURL(file);
  }

  removeAvatarPhoto() {
    this.stagedAvatarDataUrl = null;
    this.stagedAvatarRemoved = true;

    const fileInput = document.getElementById('admin-profile-file-input');
    if (fileInput) fileInput.value = '';

    const modalImg = document.getElementById('admin-modal-avatar-img');
    if (modalImg) {
      modalImg.src = '';
      modalImg.classList.add('hidden');
    }

    const modalInitials = document.getElementById('admin-modal-avatar-initials');
    if (modalInitials) modalInitials.classList.remove('hidden');

    const alertEl = document.getElementById('admin-profile-alert');
    if (alertEl) {
      alertEl.className = 'hidden';
      alertEl.innerText = '';
    }
  }

  async saveAdminProfile(event) {
    if (event && event.preventDefault) event.preventDefault();

    const saveBtn = document.getElementById('admin-profile-save-btn');
    const alertEl = document.getElementById('admin-profile-alert');
    const nameInput = document.getElementById('admin-profile-display-name-input');
    const displayName = nameInput?.value?.trim();

    if (!displayName) {
      if (alertEl) {
        alertEl.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200 block';
        alertEl.innerText = 'Display Name is required.';
      }
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span>Saving...</span>';
    }

    try {
      let avatarUrl = this.stagedAvatarRemoved ? '' : (this.adminProfile?.avatarUrl || '');

      // Upload newly staged image
      if (this.stagedAvatarDataUrl) {
        const upRes = await fetch('/api/admin/upload', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.token}`,
            'x-admin-token': this.token
          },
          body: JSON.stringify({ dataUrl: this.stagedAvatarDataUrl, folder: 'avatars' })
        });
        const upData = await upRes.json().catch(() => ({}));
        if (!upRes.ok) {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<span>Save Profile Changes</span>';
          }
          if (alertEl) {
            alertEl.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200 block';
            alertEl.innerText = upData.error || 'Failed to upload photo.';
          }
          return;
        }
        avatarUrl = upData.url;
      }

      // Persist profile in database
      const profRes = await fetch('/api/admin/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'x-admin-token': this.token
        },
        body: JSON.stringify({ displayName, avatarUrl })
      });
      const profData = await profRes.json().catch(() => ({}));

      if (!profRes.ok) {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<span>Save Profile Changes</span>';
        }
        if (alertEl) {
          alertEl.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200 block';
          alertEl.innerText = profData.error || 'Failed to update profile.';
        }
        return;
      }

      this.adminProfile = profData.admin;
      sessionStorage.setItem('umaira_admin_user', profData.admin.displayName);
      this.renderSidebarProfile();
      this.toast('Admin profile updated successfully.', 'success');

      if (alertEl) {
        alertEl.className = 'p-3 rounded-xl text-xs font-medium border bg-emerald-50 text-emerald-800 border-emerald-200 block';
        alertEl.innerText = 'Profile updated successfully.';
        setTimeout(() => {
          if (alertEl.innerText === 'Profile updated successfully.') {
            alertEl.className = 'hidden';
            alertEl.innerText = '';
          }
        }, 4000);
      }
    } catch (err) {
      if (alertEl) {
        alertEl.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200 block';
        alertEl.innerText = 'Network error while updating profile.';
      }
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>Save Profile Changes</span>';
      }
    }
  }

  togglePasswordInput(inputId, eyeId) {
    const input = document.getElementById(inputId);
    const eye = document.getElementById(eyeId);
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      if (eye) {
        eye.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>';
      }
    } else {
      input.type = 'password';
      if (eye) {
        eye.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>';
      }
    }
  }

  async saveAdminPassword(event) {
    if (event && event.preventDefault) event.preventDefault();

    const currentPassword = document.getElementById('admin-pwd-current')?.value || '';
    const newPassword = document.getElementById('admin-pwd-new')?.value || '';
    const confirmPassword = document.getElementById('admin-pwd-confirm')?.value || '';
    const alertEl = document.getElementById('admin-password-alert');
    const submitBtn = document.getElementById('admin-pwd-submit-btn');

    if (!currentPassword) {
      if (alertEl) {
        alertEl.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200 block';
        alertEl.innerText = 'Please enter your current password.';
      }
      return;
    }

    if (newPassword.length < 8) {
      if (alertEl) {
        alertEl.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200 block';
        alertEl.innerText = 'New password must be at least 8 characters long.';
      }
      return;
    }

    if (newPassword !== confirmPassword) {
      if (alertEl) {
        alertEl.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200 block';
        alertEl.innerText = 'New password and confirmation do not match.';
      }
      return;
    }

    if (newPassword === currentPassword) {
      if (alertEl) {
        alertEl.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200 block';
        alertEl.innerText = 'New password must be different from current password.';
      }
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Updating...</span>';
    }

    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`,
          'x-admin-token': this.token
        },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (alertEl) {
          alertEl.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200 block';
          alertEl.innerText = data.error || 'Failed to update password.';
        }
        return;
      }

      this.toast('Administrator password updated successfully.', 'success');

      // Clear password inputs on success
      ['admin-pwd-current', 'admin-pwd-new', 'admin-pwd-confirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });

      if (alertEl) {
        alertEl.className = 'p-3 rounded-xl text-xs font-medium border bg-emerald-50 text-emerald-800 border-emerald-200 block';
        alertEl.innerText = 'Password updated successfully.';
        setTimeout(() => {
          if (alertEl.innerText === 'Password updated successfully.') {
            alertEl.className = 'hidden';
            alertEl.innerText = '';
          }
        }, 4000);
      }
    } catch (err) {
      if (alertEl) {
        alertEl.className = 'p-3 rounded-xl text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200 block';
        alertEl.innerText = 'Network error while updating password.';
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Update Password</span>';
      }
    }
  }

  // ── PAGE DECORATIONS ─────────────────────────────────────────────────────
  async loadDecorationLibrary() {
    await this.refreshDecorationLibrary();
    await this.refreshDecorationPageSummary();
  }

  async refreshDecorationLibrary() {
    const grid = document.getElementById('admin-decor-library-grid');
    if (!grid) return;
    grid.innerHTML = '<div class="col-span-full text-center py-8 text-[#6E6864] text-xs">Loading images…</div>';
    try {
      const res = await fetch('/api/decoration-images');
      const data = await res.json().catch(() => ({ images: [] }));
      const images = data.images || [];
      if (!images.length) {
        grid.innerHTML = '<div class="col-span-full text-center py-8 text-[#6E6864] text-xs">No images found in <code>image/backgound/</code>.</div>';
        return;
      }
      grid.innerHTML = images.map(img => `
        <div class="rounded-2xl border border-[#E5ECE6] bg-[#FAF6F0] overflow-hidden group hover:border-[#647D69] transition">
          <div class="aspect-square p-2 flex items-center justify-center bg-white/50">
            <img src="${img.url}" alt="${esc(img.name)}" class="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-200" loading="lazy" />
          </div>
          <div class="px-2 py-1.5 border-t border-[#E5ECE6]">
            <p class="text-[10px] text-[#6E6864] truncate" title="${esc(img.name)}">${esc(img.name)}</p>
          </div>
        </div>`).join('');
    } catch (e) {
      grid.innerHTML = '<div class="col-span-full text-center py-8 text-rose-500 text-xs">Failed to load images.</div>';
    }
  }

  async refreshDecorationPageSummary() {
    const container = document.getElementById('admin-decor-page-summary');
    if (!container) return;
    try {
      const res = await fetch('/api/admin/decorations', { headers: { 'X-Admin-Token': this.token || '' } });
      const data = await res.json().catch(() => ({ decorations: {} }));
      const decs = data.decorations || {};
      const pages = Object.keys(decs).filter(k => decs[k] && decs[k].length > 0);
      if (!pages.length) {
        container.innerHTML = '<p class="text-xs text-[#6E6864] text-center py-4">No server-saved decorations yet. Use the Decoration Studio to place flowers.</p>';
        return;
      }
      container.innerHTML = pages.map(p => `
        <div class="flex items-center justify-between p-3 rounded-xl bg-[#FAF6F0] border border-[#E5ECE6]">
          <span class="text-xs font-semibold text-[#302C2A] capitalize">${esc(p)}</span>
          <span class="text-[11px] text-[#647D69] font-bold">${decs[p].length} decoration${decs[p].length !== 1 ? 's' : ''}</span>
        </div>`).join('');
    } catch (e) {
      container.innerHTML = '<p class="text-xs text-rose-500 text-center py-4">Could not load decoration summary.</p>';
    }
  }

}

// Initialize on DOM load
window.addEventListener('DOMContentLoaded', () => {
  window.adminApp = new AdminApp();
});
