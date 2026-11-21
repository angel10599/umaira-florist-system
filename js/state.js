/**
 * UMAIRA FLORIST - Client state.
 * The server is the source of truth for accounts, carts, orders and the product catalog.
 * The browser only caches the session token and a copy of the cart for instant display.
 */

const STORAGE_KEYS = {
  CURRENT_USER: 'umaira_current_user',
  CUSTOMER_TOKEN: 'umaira_customer_token',
  BUILDER: 'umaira_active_bouquet_builder',
  PENDING_ACTION: 'umaira_pending_action',
  CART_PREFIX: 'umaira_cart_'          // one cart cache per signed-in customer
};

// The password-reset email links to  /#reset?token=...  Capture it before the router rewrites the hash.
(function captureResetToken() {
  try {
    const m = /^#reset\?token=([0-9a-f]{64})$/.exec(window.location.hash || '');
    window.__umairaResetToken = m ? m[1] : '';
  } catch (e) { window.__umairaResetToken = ''; }
})();

// Escape text before placing it into HTML.
function escapeHtml(v) {
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
window.escapeHtml = escapeHtml;

const MAX_ITEM_QTY = 50;

class StateManager {
  constructor() {
    this.listeners = {};
    this.currentUser = this.load(STORAGE_KEYS.CURRENT_USER, null);
    this.customerToken = this.load(STORAGE_KEYS.CUSTOMER_TOKEN, '');
    if (!this.customerToken) this.currentUser = null;
    this.pendingAction = this.load(STORAGE_KEYS.PENDING_ACTION, null);
    this.cart = this.currentUser ? this.load(this.cartKey(), []) : [];
    this.orders = [];               // loaded from the server (GET /api/my/orders)
    this.ordersLoaded = false;
    this.builderState = this.load(STORAGE_KEYS.BUILDER, this.getDefaultBuilderState());
    this.catalogReady = false;
    this.catalogError = false;
    this.storeSettings = {
      name: 'Umaira Florist Atelier',
      tagline: 'Flowers Made With Love.',
      address: '128 Rosa Street, BGC, Taguig City, Metro Manila',
      phone: '+63 917 892 4310',
      email: 'concierge@umairaflorist.com',
      description: 'Bespoke florist atelier crafting luxury arrangements and curated botanical gifts.'
    };
    this.deliverySettings = {
      fee: 150,
      freeThreshold: 2500,
      coverage: 'City of Manila (Districts 1–6)',
      enabled: true,
      carrier: 'Grab Delivery'
    };
    this.pickupSettings = {
      enabled: true,
      address: '128 Rosa Street, BGC, Taguig City, Metro Manila',
      instructions: 'Present your Order Number at the Atelier counter upon arrival.',
      leadTimeHours: 2
    };
    this.hoursSettings = {
      openingTime: '08:00',
      closingTime: '20:00',
      operatingDays: 'Monday – Sunday',
      acceptingOrders: true
    };
    this.customBuilderSettings = {
      minStems: 1,
      maxStems: 50,
      serviceFee: 0
    };
    this.inventorySettings = {
      lowStockThreshold: 20
    };

    // Keep the static extras (occasions, stem length, specs...) but start with NO products:
    // everything shown to customers must come from the database via /api/catalog.
    this._base = { flowers: new Map(), bouquets: new Map() };
    if (typeof FLOWER_DATA !== 'undefined') {
      FLOWER_DATA.mainFlowers.forEach(f => this._base.flowers.set(f.id, f));
      FLOWER_DATA.featuredBouquets.forEach(b => this._base.bouquets.set(b.id, b));
      FLOWER_DATA.mainFlowers.length = 0;
      FLOWER_DATA.featuredBouquets.length = 0;
      if (Array.isArray(FLOWER_DATA.fillerFlowers)) FLOWER_DATA.fillerFlowers.length = 0;
      if (Array.isArray(FLOWER_DATA.greenery)) FLOWER_DATA.greenery.length = 0;
      if (Array.isArray(FLOWER_DATA.wrappingOptions)) FLOWER_DATA.wrappingOptions.length = 0;
      if (Array.isArray(FLOWER_DATA.ribbonOptions)) FLOWER_DATA.ribbonOptions.length = 0;
      if (Array.isArray(FLOWER_DATA.cardDesigns)) FLOWER_DATA.cardDesigns.length = 0;
      FLOWER_DATA.allMaterials = [];
    }
  }

  getDefaultBuilderState() {
    return {
      currentStep: 1,
      totalSteps: 5,
      name: 'Artisan Bespoke Bouquet',
      mainFlowers: [],
      fillers: [],
      filler: '',
      greenery: '',
      wrappings: [],
      wrapping: '',
      wrappingColors: {},
      ribbons: [],
      ribbon: '',
      ribbonColors: {},
      cardDesign: '',
      cardMessage: '',
      message: ''
    };
  }

  load(key, fallback) {
    try { const d = localStorage.getItem(key); return d ? JSON.parse(d) : fallback; }
    catch (e) { return fallback; }
  }
  save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage full / private mode */ }
  }
  cartKey() { return STORAGE_KEYS.CART_PREFIX + (this.currentUser ? this.currentUser.id : 'guest'); }

  on(event, cb) { (this.listeners[event] = this.listeners[event] || []).push(cb); }
  triggerListeners(event, data) { (this.listeners[event] || []).forEach(cb => { try { cb(data); } catch (e) { console.error(e); } }); }

  // ------------------------------------------------------------------ API helper
  async api(path, { method = 'GET', body, auth = true } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth && this.customerToken) headers['Authorization'] = 'Bearer ' + this.customerToken;
    try {
      const res = await fetch(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 && auth && this.customerToken && !path.startsWith('/api/auth/login')) this.handleSessionExpired();
      return { ok: res.ok, status: res.status, data };
    } catch (e) {
      return { ok: false, status: 0, data: { error: 'Could not reach the server. Please check your connection and try again.' }, network: true };
    }
  }

  clearStoredSession() {
    try { localStorage.removeItem(STORAGE_KEYS.CURRENT_USER); localStorage.removeItem(STORAGE_KEYS.CUSTOMER_TOKEN); } catch (e) {}
  }

  handleSessionExpired() {
    if (!this.currentUser) return;
    this.currentUser = null; this.customerToken = ''; this.cart = []; this.orders = []; this.ordersLoaded = false;
    this.clearStoredSession();
    this.triggerListeners('session_expired', null);
    this.triggerListeners('auth_change', null);
  }

  // ------------------------------------------------------------------ auth
  async setCurrentUser(user, token) {
    this.currentUser = user;
    this.save(STORAGE_KEYS.CURRENT_USER, user);
    if (token) { this.customerToken = token; this.save(STORAGE_KEYS.CUSTOMER_TOKEN, token); }
    this.orders = []; this.ordersLoaded = false;
    await this.loadServerCart();
    this.triggerListeners('auth_change', user);
  }

  /** On page load: confirm the stored token is still valid and refresh the profile from the server. */
  async restoreSession() {
    if (!this.customerToken) return false;
    const r = await this.api('/api/auth/me');
    if (r.ok && r.data.user) {
      this.currentUser = r.data.user;
      this.save(STORAGE_KEYS.CURRENT_USER, r.data.user);
      await this.loadServerCart();
      this.triggerListeners('auth_change', r.data.user);
      return true;
    }
    if (!r.network) this.handleSessionExpired(); // token revoked/expired
    return false;
  }

  logout() {
    const token = this.customerToken;
    if (token) fetch('/api/auth/logout', { method: 'POST', headers: { Authorization: 'Bearer ' + token } }).catch(() => {});
    try { localStorage.removeItem(this.cartKey()); localStorage.removeItem(this.cartKey() + '_dirty'); } catch (e) {}
    this.currentUser = null; this.customerToken = ''; this.cart = []; this.orders = []; this.ordersLoaded = false;
    this.clearStoredSession();
    this.triggerListeners('cart_change', this.cart);
    this.triggerListeners('auth_change', null);
  }

  getCurrentUser() { return this.currentUser; }
  isAuthenticated() { return Boolean(this.currentUser && this.currentUser.id && this.customerToken); }

  setPendingAction(a) { this.pendingAction = a; this.save(STORAGE_KEYS.PENDING_ACTION, a); }
  getPendingAction() { return this.pendingAction; }
  clearPendingAction() { this.pendingAction = null; this.save(STORAGE_KEYS.PENDING_ACTION, null); }

  async _authenticate(path, body) {
    const r = await this.api(path, { method: 'POST', body, auth: false });
    if (r.ok && r.data.user && r.data.token) {
      await this.setCurrentUser(r.data.user, r.data.token);
      return { ok: true, user: r.data.user };
    }
    if (r.data && r.data.unverified) {
      return { ok: false, unverified: true, email: r.data.email, error: r.data.error };
    }
    return { ok: false, error: (r.data && r.data.error) || 'Something went wrong. Please try again.' };
  }

  login(email, password) {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return Promise.resolve({ ok: false, error: 'Please enter your email address.' });
    if (!password) return Promise.resolve({ ok: false, error: 'Please enter your password.' });
    return this._authenticate('/api/auth/login', { email: e, password: String(password) });
  }

  async register(d) {
    const name = String(d.fullName || d.name || '').trim();
    const email = String(d.email || '').trim().toLowerCase();
    const phone = String(d.phone || '').trim();
    const password = String(d.password || '');

    if (!name || name.length < 2) {
      return { ok: false, error: 'Please enter your full name (at least 2 characters).' };
    }
    if (!phone) {
      return { ok: false, error: 'Please enter your mobile / contact number.' };
    }
    // Philippine phone format check
    const digitsOnly = phone.replace(/\D/g, '');
    const isValidPH = /^09\d{9}$/.test(digitsOnly) || /^639\d{9}$/.test(digitsOnly) || /^9\d{9}$/.test(digitsOnly);
    if (!isValidPH) {
      return { ok: false, error: 'Please enter a valid Philippine mobile number (e.g. 0917 123 4567 or +63 917 123 4567).' };
    }
    if (!/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/.test(email)) {
      return { ok: false, error: 'Please enter a valid email address (e.g. name@example.ph).' };
    }
    if (password.length < 8) {
      return { ok: false, error: 'Password must be at least 8 characters long.' };
    }

    const r = await this.api('/api/auth/register', { method: 'POST', body: { name, email, password, phone }, auth: false });
    if (r.ok && r.data.requiresVerification) {
      return {
        ok: true,
        requiresVerification: true,
        email: r.data.email || email,
        message: r.data.message || 'Verification code sent to your email.'
      };
    }
    if (r.ok && r.data.user && r.data.token) {
      await this.setCurrentUser(r.data.user, r.data.token);
      return { ok: true, user: r.data.user };
    }
    return { ok: false, error: (r.data && r.data.error) || 'Registration failed. Please check your information.' };
  }

  async verifyOTP(email, otp) {
    const e = String(email || '').trim().toLowerCase();
    const code = String(otp || '').trim();
    if (!code || !/^\d{6}$/.test(code)) {
      return { ok: false, error: 'Please enter the 6-digit code received in your email.' };
    }
    const r = await this.api('/api/auth/verify-otp', { method: 'POST', body: { email: e, otp: code }, auth: false });
    if (r.ok && r.data.user && r.data.token) {
      await this.setCurrentUser(r.data.user, r.data.token);
      return { ok: true, user: r.data.user, message: r.data.message };
    }
    return { ok: false, error: (r.data && r.data.error) || 'Verification failed. Please check the code and try again.' };
  }

  async resendOTP(email) {
    const e = String(email || '').trim().toLowerCase();
    const r = await this.api('/api/auth/resend-otp', { method: 'POST', body: { email: e }, auth: false });
    if (r.ok) {
      return { ok: true, message: r.data.message || 'A new verification code has been sent.' };
    }
    return { ok: false, error: (r.data && r.data.error) || 'Could not resend verification code.', cooldownSeconds: r.data && r.data.cooldownSeconds };
  }

  loginWithGoogle(credential) { return this._authenticate('/api/auth/google', { credential }); }

  async forgotPassword(email) {
    const r = await this.api('/api/auth/forgot', { method: 'POST', body: { email: String(email || '').trim() }, auth: false });
    return r.ok ? { ok: true, message: r.data.message } : { ok: false, error: r.data.error || 'Could not send reset email.' };
  }
  async resetPassword(token, password) {
    const r = await this.api('/api/auth/reset', { method: 'POST', body: { token, password }, auth: false });
    return r.ok ? { ok: true } : { ok: false, error: r.data.error || 'Could not reset password.' };
  }

  async updateProfile(profile) {
    const r = await this.api('/api/auth/me', { method: 'PUT', body: profile });
    if (r.ok && r.data.user) {
      this.currentUser = r.data.user; this.save(STORAGE_KEYS.CURRENT_USER, r.data.user);
      this.triggerListeners('auth_change', r.data.user);
      return { ok: true, user: r.data.user };
    }
    return { ok: false, error: (r.data && r.data.error) || 'Could not save your profile.' };
  }

  async deleteAccount({ password, confirmEmail }) {
    const body = password !== undefined ? { password } : { confirmEmail };
    const r = await this.api('/api/auth/me', { method: 'DELETE', body });
    if (r.ok) return { ok: true };
    return { ok: false, error: (r.data && r.data.error) || 'Could not delete account.' };
  }

  // ------------------------------------------------------------------ catalog (database -> storefront)
  async loadCatalog() {
    const r = await this.api('/api/catalog', { auth: false });
    if (!r.ok || !Array.isArray(r.data.flowers)) { this.catalogError = true; this.catalogReady = true; this.triggerListeners('catalog_change'); return false; }
    this.applyAllSettings({
      store: r.data.store,
      delivery: r.data.delivery,
      pickup: r.data.pickup,
      hours: r.data.hours,
      customBuilder: r.data.customBuilder,
      inventory: r.data.inventory
    });
    // GCash account exactly as configured in Admin → Payment Accounts (null while GCash is unavailable).
    const payment = r.data.payment || { gcash: null, bank: null };
    const paySig = JSON.stringify(payment);
    const paymentChanged = this.paymentSig !== undefined && paySig !== this.paymentSig;
    this.paymentSig = paySig;
    this.paymentAccounts = payment;
    const sig = JSON.stringify([r.data.flowers, r.data.bouquets, r.data.materials, r.data.delivery, r.data.store, r.data.hours]);
    const changed = sig !== this.catalogSig;
    this.catalogSig = sig;
    if (changed) this.applyCatalog(r.data);
    this.catalogError = false; this.catalogReady = true;
    this.reconcileCart();
    this.triggerListeners('catalog_change', { changed });
    if (paymentChanged) this.triggerListeners('payment_accounts_change', payment);
    return true;
  }

  applyCatalog({ flowers, bouquets, materials, customBuilder }) {
    if (customBuilder) {
      this.customBuilderSettings = customBuilder;
    }
    const fl = flowers.map(db => {
      const base = this._base.flowers.get(db.id) || { occasions: [], stemLength: '', fragrance: '', vaseLife: '', popular: false };
      // Occasions saved by the admin (stored as "Occasion: A, B") are authoritative. The static starter
      // list is only a fallback, so the storefront never shows occasions the admin removed or duplicates.
      let parsedOccasions = [...(base.occasions || [])];
      if (db.style && /occasion:/i.test(db.style)) {
        const seenOcc = new Set();
        parsedOccasions = db.style.replace(/^.*?occasion:\s*/i, '').split(',').map(s => s.trim()).filter(Boolean)
          .filter(o => { const k = o.toLowerCase(); if (seenOcc.has(k)) return false; seenOcc.add(k); return true; });
      }
      return { ...base, id: db.id, name: db.name, botanicalName: db.botanicalName, category: db.category, price: db.price,
        availability: db.availability, stockCount: db.stockCount, description: db.description, image: db.image, color: db.color,
        occasions: parsedOccasions, style: db.style };
    });
    const bq = bouquets.map(db => {
      const base = this._base.bouquets.get(db.id) || {
        tagline: '', categories: [], flowerTypes: [], occasions: [],
        specs: { mainFlowers: [], message: '' }, isBestSeller: false, isSeasonal: false, createdAt: new Date().toISOString()
      };
      const dbOccs = db.occasion ? String(db.occasion).split(',').map(s => s.trim()).filter(Boolean) : [];
      const specsOccs = (db.specs && Array.isArray(db.specs.occasions)) ? db.specs.occasions.map(s => String(s).trim()).filter(Boolean) : [];
      const officialOccs = (typeof window !== 'undefined' && window.SHOP_RULES && Array.isArray(window.SHOP_RULES.OFFICIAL_OCCASIONS))
        ? window.SHOP_RULES.OFFICIAL_OCCASIONS
        : ['Birthday', 'Anniversary', "Valentine's Day", "Mother's Day", 'Graduation', 'Congratulations', 'Sympathy', 'Thank You'];
      const officialSet = new Set(officialOccs.map(o => o.toLowerCase()));
      const combinedOccs = Array.from(new Set([...specsOccs, ...dbOccs]));
      const parsedOccasions = combinedOccs.length > 0
        ? combinedOccs
        : (base.occasions || []).filter(o => officialSet.has(String(o).toLowerCase()));
      const parsedCategories = Array.from(new Set([...(base.categories || []), db.category].filter(Boolean)));
      const specs = db.specs || base.specs || {};
      const flowerTypes = Array.from(new Set([
        ...(Array.isArray(db.flowerTypes) ? db.flowerTypes : []),
        ...(Array.isArray(specs.flowerTypes) ? specs.flowerTypes : []),
        ...(Array.isArray(base.flowerTypes) ? base.flowerTypes : [])
      ]));
      const primaryFlower = db.primaryFlower || specs.primaryFlower || (flowerTypes[0] || '');
      const source = db.source || specs.source || '';
      const sources = db.sources || specs.sources || (source ? [source] : []);
      const mainFlowersText = (specs.mainFlowers && Array.isArray(specs.mainFlowers) && specs.mainFlowers.length)
        ? specs.mainFlowers.map(f => (f.quantity ? `${f.quantity}× ` : '') + (f.name || f.id)).join(', ')
        : (db.formula || '');

      return {
        ...base,
        id: db.id,
        name: db.name,
        category: db.category || base.category || 'Ready-Made Bouquets',
        categories: parsedCategories,
        occasion: db.occasion || '',
        occasions: parsedOccasions,
        price: db.price,
        description: db.description || base.description || '',
        image: db.image || base.image || '',
        formula: db.formula || base.formula || '',
        availability: db.availability || 'available',
        // Ready-made bouquets have their own inventory: the storefront caps quantities by this real count
        // (it used to be missing, so every bouquet fell back to a hard-coded limit of 10).
        stockCount: (db.stockCount !== undefined && db.stockCount !== null) ? Number(db.stockCount) : undefined,
        archived: Boolean(db.archived),
        specs: specs,
        flowerTypes: flowerTypes,
        primaryFlower: primaryFlower,
        source: source,
        sources: sources,
        mainFlowersText: mainFlowersText,
        salesCount: db.salesCount || 0,
        // Real creation date from the database ("Newest First"); null when unknown, never "now".
        createdAt: db.createdAt || null,
        popularity: db.popularity || db.salesCount || 0
      };
    });
    FLOWER_DATA.mainFlowers.splice(0, FLOWER_DATA.mainFlowers.length, ...fl);
    FLOWER_DATA.featuredBouquets.splice(0, FLOWER_DATA.featuredBouquets.length, ...bq);
    FLOWER_DATA.flowers = FLOWER_DATA.mainFlowers;

    const activeMaterials = Array.isArray(materials) ? materials.filter(m => !m.archived) : [];
    this.materials = activeMaterials;
    FLOWER_DATA.allMaterials = activeMaterials;

    const fillers = activeMaterials.filter(m => m.itemType === 'filler' || (String(m.category || '').toLowerCase() === 'fillers & foliage' && m.itemType !== 'foliage'));
    if (!Array.isArray(FLOWER_DATA.fillerFlowers)) FLOWER_DATA.fillerFlowers = [];
    FLOWER_DATA.fillerFlowers.splice(0, FLOWER_DATA.fillerFlowers.length, ...fillers.map(m => ({
      id: m.id, name: m.name, botanicalName: m.botanicalName, price: m.price,
      image: m.image, description: m.description, availability: m.availability, stockCount: m.stockCount
    })));

    const greenery = activeMaterials.filter(m => m.itemType === 'foliage' || (String(m.category || '').toLowerCase() === 'fillers & foliage' && m.itemType === 'foliage'));
    if (!Array.isArray(FLOWER_DATA.greenery)) FLOWER_DATA.greenery = [];
    FLOWER_DATA.greenery.splice(0, FLOWER_DATA.greenery.length, ...greenery.map(m => ({
      id: m.id, name: m.name, botanicalName: m.botanicalName, price: m.price,
      image: m.image, description: m.description, availability: m.availability, stockCount: m.stockCount
    })));

    const wrappings = activeMaterials.filter(m => m.itemType === 'wrapping' || String(m.category || '').toLowerCase() === 'wrapping materials');
    if (!Array.isArray(FLOWER_DATA.wrappingOptions)) FLOWER_DATA.wrappingOptions = [];
    FLOWER_DATA.wrappingOptions.splice(0, FLOWER_DATA.wrappingOptions.length, ...wrappings.map(m => ({
      id: m.id, name: m.name, colorHex: m.color || '#c2a382', price: m.price,
      image: m.image, description: m.description, availability: m.availability, stockCount: m.stockCount,
      style: m.style
    })));

    const ribbons = activeMaterials.filter(m => m.itemType === 'ribbon' || String(m.category || '').toLowerCase() === 'ribbons');
    if (!Array.isArray(FLOWER_DATA.ribbonOptions)) FLOWER_DATA.ribbonOptions = [];
    FLOWER_DATA.ribbonOptions.splice(0, FLOWER_DATA.ribbonOptions.length, ...ribbons.map(m => ({
      id: m.id, name: m.name, colorHex: m.color || '#f472b6', style: m.style || 'Satin',
      price: m.price, availability: m.availability, stockCount: m.stockCount,
      image: m.image, description: m.description
    })));

    const cards = activeMaterials.filter(m => m.itemType === 'card' || String(m.category || '').toLowerCase() === 'greeting cards' || String(m.category || '').toLowerCase() === 'message cards');
    if (!Array.isArray(FLOWER_DATA.cardDesigns)) FLOWER_DATA.cardDesigns = [];
    FLOWER_DATA.cardDesigns.splice(0, FLOWER_DATA.cardDesigns.length, ...cards.map(m => ({
      id: m.id, name: m.name, theme: m.style || 'Artisanal', price: m.price || 0,
      availability: m.availability, stockCount: m.stockCount,
      image: m.image, description: m.description, style: m.style
    })));

    // Instantly purge any deleted product/material from active builder state
    if (this.builderState) {
      const activeFlowerIds = new Set(fl.map(f => f.id));
      const activeMaterialIds = new Set(activeMaterials.map(m => m.id));
      let stateChanged = false;

      if (Array.isArray(this.builderState.mainFlowers)) {
        const origLen = this.builderState.mainFlowers.length;
        this.builderState.mainFlowers = this.builderState.mainFlowers.filter(f => activeFlowerIds.has(f.id));
        if (this.builderState.mainFlowers.length !== origLen) stateChanged = true;
      }
      if (Array.isArray(this.builderState.fillers)) {
        const origLen = this.builderState.fillers.length;
        this.builderState.fillers = this.builderState.fillers.filter(f => activeMaterialIds.has(typeof f === 'object' ? f.id : f));
        if (this.builderState.fillers.length !== origLen) stateChanged = true;
      }
      if (Array.isArray(this.builderState.wrappings)) {
        const origLen = this.builderState.wrappings.length;
        this.builderState.wrappings = this.builderState.wrappings.filter(w => activeMaterialIds.has(typeof w === 'object' ? w.id : w));
        if (this.builderState.wrappings.length !== origLen) stateChanged = true;
      }
      if (Array.isArray(this.builderState.ribbons)) {
        const origLen = this.builderState.ribbons.length;
        this.builderState.ribbons = this.builderState.ribbons.filter(r => activeMaterialIds.has(typeof r === 'object' ? r.id : r));
        if (this.builderState.ribbons.length !== origLen) stateChanged = true;
      }
      if (this.builderState.cardDesign && !activeMaterialIds.has(this.builderState.cardDesign)) {
        this.builderState.cardDesign = '';
        stateChanged = true;
      }
      if (stateChanged) {
        this.save(STORAGE_KEYS.BUILDER, this.builderState);
        this.triggerListeners('builder_change');
      }
    }
  }

  /** Keep cart lines in line with the live catalog (prices changed, items sold out or archived). Keeps items in cart, flagging unavailable ones. */
  reconcileCart() {
    if (!this.cart.length) return [];
    const notes = [];
    const kept = [];
    for (const item of this.cart) {
      if (item.isCustom) {
        const specs = item.specs || {};
        const gone = (specs.mainFlowers || []).find(f => { const fl = getFlowerById(f.id); return !fl || fl.availability === 'unavailable' || fl.availability === 'sold_out' || (fl.stockCount != null && fl.stockCount <= 0) || (fl.stockCount != null && fl.stockCount < (f.quantity || 1)); });
        if (gone) {
          item.isUnavailable = true;
          notes.push(`"${item.name}" contains flowers that are currently out of stock or unavailable.`);
        } else {
          item.isUnavailable = false;
        }
        if (window.builderCtrl && typeof window.builderCtrl.calculateBreakdown === 'function') {
          const price = window.builderCtrl.calculateBreakdown(specs).subtotal;
          if (price !== item.price) { notes.push(`The price of "${item.name}" changed to ${formatCurrency(price)}.`); item.price = price; }
        }
        kept.push(item);
        continue;
      }
      const bq = FLOWER_DATA.featuredBouquets.find(b => b.id === item.id);
      const fl = bq ? null : FLOWER_DATA.mainFlowers.find(f => f.id === item.id);
      const src = bq || fl;
      if (!src || src.availability === 'unavailable' || src.availability === 'sold_out' || (src.stockCount != null && src.stockCount <= 0)) {
        item.isUnavailable = true;
        notes.push(`"${item.name}" is currently sold out or unavailable.`);
        kept.push(item);
        continue;
      }
      item.isUnavailable = false;
      if (src.price !== item.price) { notes.push(`The price of "${src.name}" changed to ${formatCurrency(src.price)}.`); item.price = src.price; }
      item.name = src.name; item.image = src.image || item.image;
      const maxAllowed = this.maxQuantityFor(item);
      if (item.quantity > maxAllowed) {
        if (maxAllowed <= 0) {
          item.isUnavailable = true;
          notes.push(`"${item.name}" is currently unavailable for purchase.`);
        } else {
          item.quantity = maxAllowed;
          notes.push(`Only ${maxAllowed} of "${src.name}" can be fulfilled with available stock; quantity adjusted.`);
        }
      }
      kept.push(item);
    }
    const changed = notes.length > 0;
    this.cart = kept;
    if (changed) { this.persistCart(); this.triggerListeners('cart_change', this.cart); }
    if (notes.length) this.triggerListeners('cart_notice', notes);
    return notes;
  }

  isItemAvailable(item) {
    if (!item) return false;
    if (item.isUnavailable) return false;
    if (item.isCustom) {
      const specs = item.specs || {};
      const gone = (specs.mainFlowers || []).find(f => {
        const fl = getFlowerById(f.id);
        return !fl || fl.availability === 'unavailable' || fl.availability === 'sold_out' || (fl.stockCount != null && fl.stockCount <= 0) || (fl.stockCount != null && fl.stockCount < (f.quantity || 1));
      });
      return !gone;
    }
    const bq = FLOWER_DATA.featuredBouquets.find(b => b.id === item.id);
    if (bq) {
      if (bq.availability === 'unavailable' || bq.availability === 'sold_out' || bq.archived) return false;
      if (bq.stockCount != null && bq.stockCount <= 0) return false;
      return true;
    }
    const fl = FLOWER_DATA.mainFlowers.find(f => f.id === item.id);
    if (fl) {
      return fl.availability !== 'unavailable' && fl.availability !== 'sold_out' && !fl.archived && (fl.stockCount == null || fl.stockCount >= item.quantity) && (fl.stockCount == null || fl.stockCount > 0);
    }
    return false;
  }

  hasUnavailableItems() {
    if (!Array.isArray(this.cart) || !this.cart.length) return false;
    return this.cart.some(item => !this.isItemAvailable(item));
  }

  // ------------------------------------------------------------------ cart (server-backed)
  async loadServerCart() {
    if (!this.customerToken) return;
    // Unsaved local changes (e.g. the tab was reloaded within the save delay) win over the server copy.
    if (this.load(this.cartKey() + '_dirty', false)) {
      this.cart = this.load(this.cartKey(), []);
      if (this.catalogReady) this.reconcileCart();
      this.triggerListeners('cart_change', this.cart);
      await this.syncCartNow();
      return;
    }
    const r = await this.api('/api/cart');
    if (r.ok && Array.isArray(r.data.items)) {
      this.cart = r.data.items;
      this.save(this.cartKey(), this.cart);
      if (this.catalogReady) this.reconcileCart();
      this.triggerListeners('cart_change', this.cart);
    } else {
      this.cart = this.load(this.cartKey(), []);
    }
  }

  persistCart() {
    if (!this.isAuthenticated()) return;
    this.save(this.cartKey(), this.cart);
    this._cartVersion = (this._cartVersion || 0) + 1;
    this.save(this.cartKey() + '_dirty', true);
    clearTimeout(this._cartTimer);
    this._cartTimer = setTimeout(() => this.syncCartNow(), 350);
  }
  async syncCartNow() {
    clearTimeout(this._cartTimer); this._cartTimer = null;
    if (!this.isAuthenticated()) return;
    const version = this._cartVersion;
    const r = await this.api('/api/cart', { method: 'PUT', body: { items: this.cart } });
    if (r.ok && version === this._cartVersion) this.save(this.cartKey() + '_dirty', false);
  }
  /** Send any not-yet-saved cart change right now (used when the tab is closed or reloaded). */
  flushCart() {
    if (!this._cartTimer || !this.isAuthenticated()) return;
    clearTimeout(this._cartTimer); this._cartTimer = null;
    try {
      fetch('/api/cart', { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.customerToken }, body: JSON.stringify({ items: this.cart }) });
    } catch (e) { /* best effort */ }
  }

  /** Largest quantity allowed for a cart line (stock for single stems, recipe stock for bouquets, 50 otherwise). */
  maxQuantityFor(item) {
    if (!item.isCustom) {
      const fl = FLOWER_DATA.mainFlowers.find(f => f.id === item.id);
      if (fl) {
        if (fl.availability === 'unavailable' || fl.availability === 'sold_out' || fl.archived || (fl.stockCount != null && fl.stockCount <= 0)) return 0;
        return Math.max(0, Math.min(MAX_ITEM_QTY, fl.stockCount || 0));
      }
      const bq = FLOWER_DATA.featuredBouquets.find(b => b.id === item.id);
      if (bq) {
        if (bq.availability === 'unavailable' || bq.availability === 'sold_out' || bq.archived || (bq.stockCount != null && bq.stockCount <= 0)) return 0;
        return Math.max(0, Math.min(MAX_ITEM_QTY, bq.stockCount != null ? bq.stockCount : 10));
      }
    }
    return MAX_ITEM_QTY;
  }

  addToCart(item) {
    if (!this.isAuthenticated()) return false;
    const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
    const idx = this.cart.findIndex(c => (c.isCustom && item.isCustom) ? c.customKey === item.customKey : (!c.isCustom && !item.isCustom && c.id === item.id));
    const max = this.maxQuantityFor(item);
    if (idx > -1) {
      const next = this.cart[idx].quantity + qty;
      if (next > max) { this.cart[idx].quantity = max; this.persistCart(); this.triggerListeners('cart_change', this.cart); return { ok: false, capped: max }; }
      this.cart[idx].quantity = next;
    } else {
      if (qty > max) return { ok: false, capped: max };
      this.cart.push({ ...item, cartItemId: 'item_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), quantity: qty });
    }
    this.persistCart();
    this.triggerListeners('cart_change', this.cart);
    return { ok: true };
  }

  updateCartQuantity(cartItemId, newQty) {
    newQty = parseInt(newQty, 10);
    if (!Number.isFinite(newQty) || newQty <= 0) { this.removeFromCart(cartItemId); return { ok: true }; }
    const item = this.cart.find(i => i.cartItemId === cartItemId);
    if (!item) return { ok: false };
    const max = this.maxQuantityFor(item);
    const capped = newQty > max;
    item.quantity = Math.min(newQty, max);
    this.persistCart();
    this.triggerListeners('cart_change', this.cart);
    return capped ? { ok: false, capped: max } : { ok: true };
  }

  removeFromCart(cartItemId) {
    this.cart = this.cart.filter(i => i.cartItemId !== cartItemId);
    this.persistCart();
    this.triggerListeners('cart_change', this.cart);
  }

  restoreCartItems(entries) {
    entries.forEach(({ item, index }) => this.cart.splice(Math.min(index, this.cart.length), 0, item));
    this.persistCart();
    this.triggerListeners('cart_change', this.cart);
  }

  clearCart() { this.cart = []; this.persistCart(); this.triggerListeners('cart_change', this.cart); }
  getCartCount() { return this.cart.reduce((s, i) => s + i.quantity, 0); }
  getCartSubtotal() { return this.cart.reduce((s, i) => s + (i.price * i.quantity), 0); }
  getFreeDeliveryThreshold() {
    if (this.deliverySettings && typeof this.deliverySettings.freeThreshold === 'number') {
      return this.deliverySettings.freeThreshold;
    }
    if (typeof SHOP_RULES !== 'undefined' && typeof SHOP_RULES.getFreeDeliveryMin === 'function') {
      return SHOP_RULES.getFreeDeliveryMin();
    }
    return 2500;
  }

  getDeliveryFee(subtotal, fulfillment = 'delivery') {
    const threshold = this.getFreeDeliveryThreshold();
    const fee = (this.deliverySettings && typeof this.deliverySettings.fee === 'number') ? this.deliverySettings.fee : 150;
    if (typeof SHOP_RULES !== 'undefined' && typeof SHOP_RULES.deliveryFee === 'function') {
      return SHOP_RULES.deliveryFee(subtotal, fulfillment, threshold, fee);
    }
    if (fulfillment === 'pickup' || !(subtotal > 0)) return 0;
    return subtotal >= threshold ? 0 : fee;
  }

  getStoreName() { return this.storeSettings?.name || 'Umaira Florist'; }
  getStoreAddress() { return this.storeSettings?.address || '128 Rosa Street, BGC, Taguig City, Metro Manila'; }
  getStorePhone() { return this.storeSettings?.phone || '+63 917 892 4310'; }
  getStoreEmail() { return this.storeSettings?.email || 'concierge@umairaflorist.com'; }
  getStoreDescription() { return this.storeSettings?.description || ''; }
  getStoreTagline() { return this.storeSettings?.tagline || 'Flowers Made With Love.'; }
  isDeliveryEnabled() { return this.deliverySettings?.enabled !== false; }
  isPickupEnabled() { return this.pickupSettings?.enabled !== false; }
  isAcceptingOrders() { return this.hoursSettings?.acceptingOrders !== false; }
  getLowStockThreshold() { const t = Number(this.inventorySettings?.lowStockThreshold); return Number.isFinite(t) && t >= 0 ? t : 20; }

  applyDeliverySettings(delivery) {
    this.applyAllSettings({ delivery });
  }

  applyAllSettings(settings) {
    if (!settings || typeof settings !== 'object') return;
    if (settings.store) this.storeSettings = { ...this.storeSettings, ...settings.store };
    if (settings.delivery) {
      const del = settings.delivery;
      const fee = del.fee !== undefined ? Number(del.fee) : (del.defaultFee !== undefined ? Number(del.defaultFee) : (this.deliverySettings?.fee ?? 150));
      const freeThreshold = del.freeThreshold !== undefined ? Number(del.freeThreshold) : (del.freeDeliveryThreshold !== undefined ? Number(del.freeDeliveryThreshold) : (this.deliverySettings?.freeThreshold ?? 2500));
      this.deliverySettings = {
        ...this.deliverySettings,
        ...del,
        fee: isNaN(fee) ? 150 : fee,
        freeThreshold: isNaN(freeThreshold) ? 2500 : freeThreshold
      };
    }
    if (settings.pickup) this.pickupSettings = { ...this.pickupSettings, ...settings.pickup };
    if (settings.hours) this.hoursSettings = { ...this.hoursSettings, ...settings.hours };
    if (settings.custom_builder || settings.customBuilder) {
      this.customBuilderSettings = { ...this.customBuilderSettings, ...(settings.custom_builder || settings.customBuilder) };
    }
    if (settings.inventory) {
      const inv = settings.inventory;
      const th = inv.lowStockThreshold !== undefined ? Number(inv.lowStockThreshold) : 20;
      this.inventorySettings = { ...this.inventorySettings, ...inv, lowStockThreshold: isNaN(th) ? 20 : th };
    }

    if (typeof SHOP_RULES !== 'undefined') {
      if (typeof SHOP_RULES.updateShopInfo === 'function') {
        SHOP_RULES.updateShopInfo({
          store: this.storeSettings,
          pickup: this.pickupSettings,
          hours: this.hoursSettings
        });
      }
      if (typeof SHOP_RULES.setDeliverySettings === 'function') {
        SHOP_RULES.setDeliverySettings(this.deliverySettings);
      }
    }

    const payload = {
      store: this.storeSettings,
      delivery: this.deliverySettings,
      pickup: this.pickupSettings,
      hours: this.hoursSettings,
      customBuilder: this.customBuilderSettings,
      inventory: this.inventorySettings
    };

    this.triggerListeners('settings_change', payload);

    if (typeof window !== 'undefined' && window.appRouter && typeof window.appRouter.onSettingsUpdated === 'function') {
      window.appRouter.onSettingsUpdated(payload);
    }
  }

  // ------------------------------------------------------------------ builder (local working draft)
  setBuilderState(s, emitEvent = true) {
    if (s.wrappings && !s.wrapping) s.wrapping = s.wrappings[0] || '';
    else if (s.wrapping && !s.wrappings) s.wrappings = s.wrapping ? [s.wrapping] : [];
    this.builderState = { ...this.builderState, ...s };
    this.save(STORAGE_KEYS.BUILDER, this.builderState);
    if (emitEvent) {
      this.triggerListeners('builder_change', this.builderState);
    }
  }
  loadPresetIntoBuilder(specs, customName = '') {
    this.builderState = { ...this.getDefaultBuilderState(), ...specs, name: customName || 'Customized Bouquet' };
    this.save(STORAGE_KEYS.BUILDER, this.builderState);
    this.triggerListeners('builder_change', this.builderState);
  }
  resetBuilder() {
    this.builderState = this.getDefaultBuilderState();
    this.save(STORAGE_KEYS.BUILDER, this.builderState);
    this.triggerListeners('builder_change', this.builderState);
  }

  fetchCatalog() {
    return this.loadCatalog();
  }

  // ------------------------------------------------------------------ orders (server)
  async refreshOrders() {
    if (!this.isAuthenticated()) return false;
    const r = await this.api('/api/my/orders');
    if (r.ok) { this.orders = r.data.orders || []; this.ordersLoaded = true; this.ordersError = false; }
    else this.ordersError = r.data && r.data.error || true;
    this.triggerListeners('orders_change', this.orders);
    return r.ok;
  }
  async fetchOrder(orderNumber) {
    const r = await this.api('/api/orders/' + encodeURIComponent(String(orderNumber).replace(/^#/, '')));
    return r.ok ? { ok: true, order: r.data } : { ok: false, status: r.status, error: r.data && r.data.error };
  }

  setupRealtimeEvents() {
    if (typeof window === 'undefined' || !window.EventSource) return;
    if (this._eventSource) {
      try { this._eventSource.close(); } catch (_) {}
      this._eventSource = null;
    }
    try {
      const es = new EventSource('/api/events');
      this._eventSource = es;
      es.addEventListener('order:status', (e) => {
        try {
          const d = JSON.parse(e.data || '{}');
          if (this.isAuthenticated()) {
            this.refreshOrders();
          }
          this.triggerListeners('order_status_update', d);
        } catch (_) {}
      });
      es.addEventListener('catalog:updated', () => {
        this.fetchCatalog();
      });
      es.addEventListener('settings:updated', (e) => {
        try {
          const d = JSON.parse(e.data || '{}');
          if (d.settings) {
            this.applyAllSettings(d.settings);
          } else if (d.patch) {
            this.applyAllSettings(d.patch);
          } else if (d.delivery || d.store || d.hours || d.pickup || d.inventory) {
            this.applyAllSettings(d);
          } else {
            this.fetchCatalog();
          }
        } catch (_) {}
      });
      window.addEventListener('beforeunload', () => {
        if (this._eventSource) {
          try { this._eventSource.close(); } catch (_) {}
          this._eventSource = null;
        }
      });
    } catch (_) {}
  }
}

var appState = new StateManager();
if (typeof window !== 'undefined') {
  window.appState = appState;
  appState.setupRealtimeEvents();
  window.addEventListener('pagehide', () => appState.flushCart());
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') appState.flushCart(); });
}
