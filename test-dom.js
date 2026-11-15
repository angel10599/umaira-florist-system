const fs = require('fs');

// Mock browser globals
global.window = global;
global.addEventListener = (evt, fn) => {};
global.removeEventListener = (evt, fn) => {};

// Fake DOM element with the standard methods the app calls (no-ops). Enough for rendering logic tests.
function makeEl(id) {
  return {
    id: id || '', value: '', checked: false, disabled: false, hidden: false,
    className: '', innerText: '', innerHTML: '', textContent: '', style: {}, dataset: {}, children: [],
    classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false },
    appendChild: () => {}, removeChild: () => {}, remove: () => {}, replaceWith: () => {}, insertAdjacentHTML: () => {},
    setAttribute: () => {}, getAttribute: () => null, removeAttribute: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
    querySelector: () => makeEl(), querySelectorAll: () => [], closest: () => null, contains: () => false,
    focus: () => {}, blur: () => {}, click: () => {}, scrollIntoView: () => {},
    getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 })
  };
}

global.document = {
  readyState: 'complete',
  head: makeEl('head'),
  body: Object.assign(makeEl('body'), { insertBefore: () => {} }),
  addEventListener: (evt, fn) => {},
  removeEventListener: (evt, fn) => {},
  getElementById: (id) => makeEl(id),
  querySelector: () => makeEl(),
  querySelectorAll: (selector) => [Object.assign(makeEl(), { getAttribute: () => 'home' })],
  createElement: (tag) => makeEl()
};
global.localStorage = {
  getItem: () => null,
  setItem: () => {}
};
global.location = {
  hash: '#',
  href: 'http://localhost:3000/#'
};
global.history = {
  pushState: () => {},
  replaceState: () => {}
};
global.scrollTo = () => {};

try {
  eval(fs.readFileSync('js/data.js', 'utf8'));
  console.log('OK: data.js loaded successfully');
  eval(fs.readFileSync('js/shop-rules.js', 'utf8'));
  eval(fs.readFileSync('js/state.js', 'utf8'));
  console.log('OK: state.js loaded successfully');
  eval(fs.readFileSync('js/builder.js', 'utf8'));
  console.log('OK: builder.js loaded successfully');
  eval(fs.readFileSync('js/app.js', 'utf8'));
  console.log('OK: app.js loaded successfully');

  console.log('Testing renderHomeView()...');
  const homeHtml = window.appRouter.renderHomeView();
  console.log('OK: Home HTML generated, length:', homeHtml.length);
  
  console.log('Testing renderFlowersView()...');
  const flowersHtml = window.appRouter.renderFlowersView();
  console.log('OK: Flowers HTML generated, length:', flowersHtml.length);
  
  console.log('Testing renderBuilderView()...');
  const builderHtml = window.appRouter.renderBuilderView();
  console.log('OK: Builder HTML generated, length:', builderHtml.length);
  if (!builderHtml.includes('Build Your Bouquet')) throw new Error('Missing "Build Your Bouquet" title');
  if (!builderHtml.includes('id="builder-nav-tabs"')) throw new Error('Missing builder-nav-tabs element');
  if (!builderHtml.includes('id="builder-tab-content"')) throw new Error('Missing builder-tab-content element');
  if (!builderHtml.includes('id="builder-selected-flowers"')) throw new Error('Missing builder-selected-flowers element');
  if (!builderHtml.includes('id="builder-selected-flowers"')) throw new Error('Missing builder-selected-flowers element');
  if (!builderHtml.includes('Proceed to Checkout') && !builderHtml.includes('builder-checkout-btn')) throw new Error('Missing Proceed to Checkout button in summary panel');
  console.log('OK: Builder Studio HTML structure verified');

  // Load a catalog the way the live site does (appState.applyCatalog), from the static sample data.
  {
    const vm = require('vm'); const ctx = { window: {} }; ctx.window.window = ctx.window; vm.createContext(ctx);
    vm.runInContext(fs.readFileSync('js/data.js', 'utf8'), ctx);
    const S = ctx.window.FLOWER_DATA;
    const asItem = (x, itemType) => ({ ...x, itemType, category: itemType === 'flower' ? 'Fresh Flowers' : '', availability: x.availability || 'available',
      stockCount: x.stockCount != null ? x.stockCount : 50, archived: false });
    const flowers = S.mainFlowers.map(f => asItem(f, 'flower'));
    const materials = [...flowers, ...(S.fillerFlowers || []).map(f => asItem(f, 'filler')), ...(S.wrappingOptions || []).map(w => asItem(w, 'wrapping')),
      ...(S.ribbonOptions || []).map(r => asItem(r, 'ribbon'))];
    appState.applyCatalog({ flowers, bouquets: [], materials, customBuilder: { minStems: 1, maxStems: 50 } });
  }
  console.log('Testing 5-Step Bouquet Builder steps & logic...');
  const steps = [
    ['renderStep1Flowers', 'Choose Your Flowers'],
    ['renderStep2Fillers', 'Choose Your Fillers &amp; Greenery'],
    ['renderStep3Wrapping', 'Choose Your Wrapping'],
    ['renderStep4Ribbon', 'Choose Your Ribbon'],
    ['renderStep5Card', 'Add a Personalized Greeting Card']
  ];
  for (const [fn, heading] of steps) {
    const html = window.builderCtrl[fn]();
    if (!html.includes(heading)) throw new Error(fn + ' missing heading "' + heading + '"');
    if (/\bundefined\b/.test(html.replace(/<[^>]+>/g, ' '))) throw new Error(fn + ' shows "undefined"');
    if (html.includes('id="builder-checkout-btn"')) throw new Error(fn + ' must NOT have a duplicate checkout button (only the summary panel has one)');
  }
  if (window.builderCtrl.totalSteps !== 5) throw new Error('Builder total steps must be 5');

  // Step rules: flowers required (min stems from Shop Settings), fillers optional, at least 1 wrapping required.
  window.builderCtrl.resetBuilder(true); // silent reset (no confirmation prompt)
  if (window.builderCtrl.validateStep(1)) throw new Error('Step 1 validation should fail when 0 stems are selected');
  window.builderCtrl.updateMainFlowerQty('fl-red-rose', 2);
  window.builderCtrl.updateMainFlowerQty('fl-pink-rose', 1);
  if (!window.builderCtrl.validateStep(1)) throw new Error('Step 1 validation should pass after adding stems');
  if (!window.builderCtrl.validateStep(2)) throw new Error('Step 2 (fillers) is optional and must not block');
  if (window.builderCtrl.validateStep(3)) throw new Error('Step 3 validation should fail without a wrapping');

  // Multi-wrap selection (up to 3 wrapping materials)
  window.builderCtrl.toggleWrapping('wrp-korean');
  window.builderCtrl.toggleWrapping('wrp-kraft');
  const wrappings = window.builderCtrl.getSelectedWrappings();
  if (wrappings.length !== 2) throw new Error('Expected 2 wrappings selected, got ' + wrappings.length);
  if (!window.builderCtrl.validateStep(3)) throw new Error('Step 3 validation should pass with a wrapping selected');
  window.builderCtrl.toggleRibbon('rbn-satin');

  const breakdown = window.builderCtrl.calculateBreakdown();
  if (!(breakdown.subtotal > 0)) throw new Error('Breakdown subtotal must be greater than 0');
  const wrapItems = breakdown.items.filter(i => i.type === 'wrapping');
  if (wrapItems.length !== 2) throw new Error('Breakdown should include both selected wrapping items, got ' + wrapItems.length);
  if (breakdown.items.some(i => /fee/i.test(i.name || '') || /fee/i.test(i.type || ''))) throw new Error('No arrangement/assembly fee may be added');
  console.log('OK: 5-Step Builder verified (rules, multi-wrapping breakdown, no fee) total: ₱' + breakdown.subtotal);

  eval(fs.readFileSync('js/site-update.js', 'utf8'));
  console.log('OK: site-update.js loaded successfully');

  console.log('Testing renderCollectionsView()...');
  const collectionsHtml = window.appRouter.renderCollectionsView();
  console.log('OK: Collections HTML generated, length:', collectionsHtml.length);
  if (!collectionsHtml.includes('Bouquet Collections')) throw new Error('Missing "Bouquet Collections" header');
  if (collectionsHtml.includes('Available Fresh Flowers')) throw new Error('Collections page must NOT display individual flowers as standalone products');
  if (!collectionsHtml.includes('id="su-filter-flower"')) throw new Error('Missing Flower Type filter dropdown');
  if (!collectionsHtml.includes('id="su-filter-occasion"')) throw new Error('Missing Occasion filter dropdown');
  // Source filter is shown only when at least one bouquet has a source (none in this sample catalog).
  if (collectionsHtml.includes('id="su-filter-source"')) throw new Error('Source filter must be hidden when no bouquet has a source');
  if (!collectionsHtml.includes('id="su-filter-budget"')) throw new Error('Missing Budget filter dropdown');
  if (!collectionsHtml.includes('id="su-filter-sort"')) throw new Error('Missing Sort By filter dropdown');
  
  if (collectionsHtml.includes('Browse by Collection')) throw new Error('Browse by Collection section must be removed per user instruction');
  // No published bouquets in this sample catalog -> friendly empty state with a link to the builder.
  if (!collectionsHtml.includes('Curating Our Next Collection') || !collectionsHtml.includes("navigate(\'builder\')")) throw new Error('Empty collections must show the curating state with a builder link');
  if (!fs.readFileSync('js/site-update.js', 'utf8').includes('grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5')) throw new Error('Collections bouquet grid must have 5 columns on desktop');
  console.log('OK: Collections HTML verified (filters, empty state, 5-column grid)');

  console.log('Testing renderAboutView()...');
  const aboutHtml = window.appRouter.renderAboutView();
  console.log('OK: About HTML generated, length:', aboutHtml.length);

  console.log('Testing renderCareGuideView() 3D Masterclass & 5 Steps...');
  const careHtml = window.appRouter.renderCareGuideView();
  console.log('OK: Care Guide HTML generated, length:', careHtml.length);
  // Current Florist Guide: flower meanings (carousel), interactive 3D flower with 5 care steps, gifting tips.
  for (const id of ['guide-meanings', 'guide-care', 'guide-gifting', 'guide-3d-flower-viewport', 'flower-coverflow-stage'])
    if (!careHtml.includes('id="' + id + '"')) throw new Error('Florist Guide missing #' + id);
  if (!careHtml.includes('Interactive 3D Flower Display')) throw new Error('Missing interactive 3D flower display');
  for (const step of ['1. Trim the Stems', '2. Use Fresh Water', '3. Change the Water Regularly', '4. Avoid Direct Sunlight', '5. Remove Submerged Leaves'])
    if (!careHtml.includes(step)) throw new Error('Missing care step: ' + step);
  console.log('OK: 3D Care Masterclass & all 5 interactive steps verified completely');

  console.log('Testing renderCartView()...');
  const cartHtml = window.appRouter.renderCartView();
  console.log('OK: Cart HTML generated, length:', cartHtml.length);

  console.log('Testing renderCheckoutView()...');
  // Add item to cart to test checkout rendering
  // Approved flow: carts and checkout need a signed-in customer, and only selected available items proceed.
  appState.currentUser = { id: 'usr_test', name: 'Test Customer', email: 'test@example.com' }; appState.customerToken = 'test-token';
  appState.addToCart({ id: 'fl-red-rose', name: 'Red Rose', price: 150, quantity: 2, image: '', summary: 'Fresh roses' });
  window.appRouter.selectedCartItemIds = new Set(appState.cart.map(c => c.cartItemId));
  const checkoutHtml = window.appRouter.renderCheckoutView();
  console.log('OK: Checkout HTML generated, length:', checkoutHtml.length);

  // Assertions for Manila Delivery Address requirements
  if (!checkoutHtml.includes('Delivery Address — Manila Only')) throw new Error('Missing "Delivery Address — Manila Only" heading');
  if (!checkoutHtml.includes('id="chk-district"')) throw new Error('Missing chk-district element');
  if (!checkoutHtml.includes('id="chk-barangay"')) throw new Error('Missing chk-barangay element');
  if (!checkoutHtml.includes('id="chk-city"')) throw new Error('Missing chk-city element');
  if (!checkoutHtml.includes('value="Manila"')) throw new Error('Missing fixed Manila option');
  if (!checkoutHtml.includes('id="chk-address"')) throw new Error('Missing chk-address element');
  if (!checkoutHtml.includes('id="chk-notes"')) throw new Error('Missing chk-notes element');
  if (!checkoutHtml.includes('Select District ▼')) throw new Error('Missing Select District ▼ prompt');
  if (!checkoutHtml.includes('Delivery Instructions')) throw new Error('Checkout missing Delivery Instructions section');
  if (checkoutHtml.includes('Gift Message')) throw new Error('Checkout must not present rider instructions as Gift Message');
  console.log('OK: Checkout HTML structure contains all required Manila delivery fields & Delivery Instructions');

  // Verify dynamic district to barangay mapping
  const d4List = SHOP_RULES.barangaysForDistrict('4');
  if (!d4List.includes('Barangay 395') || !d4List.includes('Barangay 636') || d4List.includes('Barangay 1')) {
    throw new Error('District IV barangay range incorrect');
  }
  console.log('OK: District IV barangays verified (count: ' + d4List.length + ')');

  const d5List = SHOP_RULES.barangaysForDistrict('5');
  if (!d5List.includes('Barangay 649') || !d5List.includes('Barangay 659-A') || !d5List.includes('Barangay 820')) {
    throw new Error('District V barangay range incorrect');
  }
  console.log('OK: District V barangays verified (count: ' + d5List.length + ')');

  // Test address validation
  const baseOrder = {
    fulfillment: 'delivery',
    firstName: 'Maria',
    lastName: 'Santos',
    phone: '09178924310',
    email: 'maria@example.ph',
    address: '123 Escolta St, Unit 4B',
    district: '4',
    barangay: 'Barangay 400',
    city: 'Manila',
    date: '2099-10-10',
    time: SHOP_RULES.deliverySlots[0],
    paymentMethod: 'GCash'
  };

  const validRes = SHOP_RULES.validateOrderInput(baseOrder);
  if (Object.keys(validRes).length > 0) throw new Error('Valid order failed validation: ' + JSON.stringify(validRes));
  console.log('OK: Valid Manila delivery order passed validation');

  const invalidDist = SHOP_RULES.validateOrderInput({ ...baseOrder, district: '99', barangay: 'Barangay 400' });
  if (!invalidDist.district) throw new Error('Failed to reject invalid district');
  console.log('OK: Invalid district rejected properly');

  const mismatchedBrgy = SHOP_RULES.validateOrderInput({ ...baseOrder, district: '4', barangay: 'Barangay 1' });
  if (!mismatchedBrgy.barangay) throw new Error('Failed to reject mismatched barangay');
  console.log('OK: Mismatched barangay rejected properly');

  const invalidCity = SHOP_RULES.validateOrderInput({ ...baseOrder, city: 'Makati' });
  if (!invalidCity.city) throw new Error('Failed to reject non-Manila city');
  console.log('OK: Non-Manila city rejected properly');

  const otherCityInStreet = SHOP_RULES.validateOrderInput({ ...baseOrder, address: '123 Ayala Ave, Makati' });
  if (!otherCityInStreet.address) throw new Error('Failed to reject outside city in address text');
  console.log('OK: Outside city mention in street address rejected properly');

  const pickupOrder = { ...baseOrder, fulfillment: 'pickup', address: '', district: '', barangay: '', city: '', time: '8:00 AM' };
  const pickupRes = SHOP_RULES.validateOrderInput(pickupOrder);
  if (pickupRes.address || pickupRes.district || pickupRes.barangay || pickupRes.city) {
    throw new Error('Pickup order unexpectedly required address fields: ' + JSON.stringify(pickupRes));
  }
  console.log('OK: Store Pickup correctly skips delivery address validation');

  console.log('Testing footer in index.html...');
  const indexHtml = fs.readFileSync('index.html', 'utf8');
  const footer = indexHtml.slice(indexHtml.indexOf('<footer'), indexHtml.indexOf('</footer>'));
  if (!footer.includes('footer-atelier')) throw new Error('Footer missing "footer-atelier" styling class');
  if (!footer.includes('Umaira Florist') || !footer.includes('Flowers Made With Love')) throw new Error('Footer missing brand name or tagline');
  for (const view of ['collections', 'builder', 'tracking']) {
    if (!footer.includes("navigate('" + view + "')")) throw new Error('Footer Quick Links missing ' + view);
  }
  // Contact details come from Admin → Shop Settings (updateStoreInfoDOM fills these elements on load).
  for (const cls of ['store-email-val', 'store-phone-val', 'store-address-val']) {
    if (!footer.includes('class="' + cls + '"')) throw new Error('Footer contact field not bound to Shop Settings: ' + cls);
  }
  if (!footer.includes('id="footer-contact-email"') || !footer.includes('id="footer-contact-phone"')) throw new Error('Footer contact links missing');
  if (!/©\s*2026/.test(footer)) throw new Error('Footer missing copyright');
  if (!footer.includes('Privacy Policy') || !footer.includes('Terms of Service')) throw new Error('Footer missing Privacy Policy / Terms of Service');
  console.log('OK: Footer verified (links, Shop-Settings-bound contact details, copyright)');

  console.log('\nALL VIEWS, FOOTER & MANILA DELIVERY RULES VERIFIED COMPLETELY & ERROR-FREE!');
} catch (err) {
  console.error('ERROR OCCURRED DURING EVALUATION:', err);
  process.exit(1);
}

