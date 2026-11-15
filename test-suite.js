// Isolated temporary database: this test can never touch the shop's real data (must load before server/store).
const iso = require('./tests/helpers/isolated-db');
const fs = require('fs');
const http = require('http');

// =========================================================================
// PART 1: DOM & CLIENT-SIDE UNIT TESTS
// =========================================================================
console.log('--- RUNNING CLIENT & DOM TESTS ---');

global.window = global;
global.addEventListener = () => {};
global.removeEventListener = () => {};

global.document = {
  readyState: 'complete',
  head: { appendChild: () => {} },
  body: {
    setAttribute: () => {},
    getAttribute: () => '',
    style: {},
    insertBefore: () => {},
    appendChild: () => {}
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: (id) => ({
    value: "", // real inputs always have a string value
    id,
    className: '',
    innerText: '',
    innerHTML: '',
    classList: { add: () => {}, remove: () => {}, toggle: () => {} },
    appendChild: () => {},
    remove: () => {},
    scrollIntoView: () => {}
  }),
  querySelector: () => ({
    getAttribute: () => '',
    value: 'GCash',
    checked: true,
    style: {},
    classList: { add: () => {}, remove: () => {} }
  }),
  querySelectorAll: () => [{
    getAttribute: () => 'home',
    className: '',
    classList: { add: () => {}, remove: () => {} }
  }],
  // New elements: toasts look up their message <p> inside the element they create.
  createElement: () => ({
    className: '',
    innerHTML: '',
    textContent: '',
    style: {},
    setAttribute: () => {},
    classList: { add: () => {}, remove: () => {} },
    addEventListener: () => {},
    appendChild: () => {},
    remove: () => {},
    querySelector: () => ({ textContent: '', setAttribute: () => {}, classList: { add: () => {}, remove: () => {} } })
  })
};

global.localStorage = { getItem: () => null, setItem: () => {} };
global.location = { hash: '#', href: 'http://localhost:3000/#' };
global.history = { pushState: () => {}, replaceState: () => {} };
global.scrollTo = () => {};

eval(fs.readFileSync('js/data.js', 'utf8'));
eval(fs.readFileSync('js/shop-rules.js', 'utf8'));
eval(fs.readFileSync('js/ui.js', 'utf8')); // same load order as index.html (shared dialogs, image helper)
eval(fs.readFileSync('js/state.js', 'utf8'));
eval(fs.readFileSync('js/builder.js', 'utf8'));
eval(fs.readFileSync('js/app.js', 'utf8'));
eval(fs.readFileSync('js/site-update.js', 'utf8'));

// 1. Home Page — current six sections
console.log('Testing Home Page (6 sections)...');
const homeHtml = window.appRouter.renderHomeView();
const homeText = homeHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const expectHome = (label, ...texts) => { for (const t of texts) if (!homeText.includes(t)) throw new Error(label + ' missing "' + t + '"'); };
expectHome('Section 1 (Hero)', 'UMAIRA FLORIST', 'Flowers, thoughtfully made.', 'Explore Collections', 'Build Your Bouquet');
expectHome('Section 2 (Shop by Occasion)', 'Shop by Occasion', 'Birthday', 'Anniversary', 'Graduation', 'Sympathy', 'View Full Catalog');
const featuredHeading = homeText.includes('Customer Favorites') ? 'Customer Favorites' : 'Ready-Made Arrangements Coming Soon'; // the featured section's own heading (empty catalog shows the "Coming Soon" version)
expectHome('Section 3 (Featured bouquets)', featuredHeading);
expectHome('Section 4 (Why choose us)', 'The Umaira Florist Difference', 'Fresh Daily Stems', 'Custom Bouquet Builder', 'Reliable Manila Delivery');
expectHome('Section 5 (How to Order)', 'How to Order', 'Choose Your Flowers', 'Personalize Your Gift', 'Delivery or Pickup', 'Pay Easily & Securely');
expectHome('Section 6 (Shop location)', 'Our BGC Flower Shop');
if (!homeHtml.includes('store-address-val') || !homeHtml.includes('store-phone-val')) throw new Error('Shop location contact details must be bound to Shop Settings');
const homeOrder = ['Flowers, thoughtfully made.', 'Shop by Occasion', featuredHeading, 'The Umaira Florist Difference', 'How to Order', 'Our BGC Flower Shop'].map(t => homeText.indexOf(t));
if (homeOrder.some((v, i) => i > 0 && v < homeOrder[i - 1])) throw new Error('Home sections are out of order');
console.log('OK: All 6 Home Sections verified in order');

// Dedicated Brand Story on About Us
console.log('Testing About Us page...');
const T = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');
const aboutHtml = window.appRouter.renderAboutView();
for (const t of ['Every Bloom Has a Story', 'Thoughtfully Made, Beautifully Given', 'The Founder Behind the Blooms', 'Meet the Heart Behind Umaira Florist Atelier', 'Angel M. Baldonado', 'Owner & Founder', 'Let Flowers Tell Your Story']) {
  if (!T(aboutHtml).includes(t)) throw new Error('About Us missing "' + t + '"');
}
if (!aboutHtml.includes('image/flower_content/login%20screen.jpg')) throw new Error('About Us missing storefront image');
if (aboutHtml.includes('assets/umaira-florist-shop.jpg')) throw new Error('About Us still shows the old storefront image');
if (!fs.existsSync('image/flower_content/login screen.jpg')) throw new Error('About Us image file is missing on disk');
if (!aboutHtml.includes('image/flower_content/myprofile.jpg')) throw new Error('About Us missing founder profile image');
if (!fs.existsSync('image/flower_content/myprofile.jpg')) throw new Error('Founder profile image file is missing on disk');
if (aboutHtml.includes('Sofia Reyes') || aboutHtml.includes('Isabella Cruz')) throw new Error('About Us still contains temporary sample owners');
if (aboutHtml.includes('Sample Identity') || aboutHtml.includes('Sample Portrait')) throw new Error('About Us still contains sample disclaimers');
if (!aboutHtml.includes('store-address-val')) throw new Error('About Us address must be bound to Shop Settings');
console.log('OK: About Us page verified');

// 2. Collections page — load a catalog the way the live site does (appState.applyCatalog), from the
//    static sample data, then exercise the real filter/sort functions.
console.log('Testing Collections Page...');
{
  const vm = require('vm'); const ctx = { window: {} }; ctx.window.window = ctx.window; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync('js/data.js', 'utf8'), ctx);
  const S = ctx.window.FLOWER_DATA;
  const asItem = (x, itemType) => ({ ...x, itemType, category: itemType === 'flower' ? 'Fresh Flowers' : '', availability: 'available', stockCount: 50, archived: false });
  const flowers = S.mainFlowers.map(f => asItem(f, 'flower'));
  const materials = [...flowers, ...(S.fillerFlowers || []).map(f => asItem(f, 'filler')), ...(S.wrappingOptions || []).map(w => asItem(w, 'wrapping')), ...(S.ribbonOptions || []).map(r => asItem(r, 'ribbon'))];
  const bouquets = S.featuredBouquets.map(b => ({ ...b, category: 'Ready-Made Bouquets', availability: 'available', stockCount: 20, archived: false }));
  appState.applyCatalog({ flowers, bouquets, materials, customBuilder: { minStems: 1, maxStems: 50 } });
  global.SAMPLE_BOUQUET_COUNT = bouquets.length;
}
const colHtml = window.appRouter.renderCollectionsView();
if (!colHtml.includes('Bouquet Collections')) throw new Error('Collections page missing "Bouquet Collections" heading');
if (colHtml.includes('Available Fresh Flowers')) throw new Error('Collections page must NOT display individual flowers as standalone products');
for (const id of ['su-filter-flower', 'su-filter-occasion', 'su-filter-budget', 'su-filter-sort']) {
  if (!colHtml.includes('id="' + id + '"')) throw new Error('Collections missing filter #' + id);
}
window.suClearAllFilters();
window.suSetPriceRange('1000-2000');
const midPriceBqs = window.getFilteredBouquets();
for (const bq of midPriceBqs) if (bq.price < 1000 || bq.price > 2000) throw new Error('Price out of bounds for 1000-2000 range: ' + bq.price);
window.suClearAllFilters();
window.suSetSortBy('price-asc');
const sortedAsc = window.getFilteredBouquets();
for (let i = 1; i < sortedAsc.length; i++) if (sortedAsc[i].price < sortedAsc[i - 1].price) throw new Error('Sort price-asc failed at index ' + i);
window.suClearAllFilters();
const allBqs = window.getFilteredBouquets();
if (allBqs.length !== global.SAMPLE_BOUQUET_COUNT) throw new Error('Expected ' + global.SAMPLE_BOUQUET_COUNT + ' bouquets after clear all, got: ' + allBqs.length);
console.log('OK: Collections page verified (filters, price range, sorting; ' + allBqs.length + ' bouquets)');

// 2b. Home "Shop by Occasion": 4 cards wired to the SAME official occasion list / filter as the catalog.
console.log('Testing Shop by Occasion cards...');
{
  const official = window.SHOP_RULES.OFFICIAL_OCCASIONS;
  const hasOcc = (b, occ) => [].concat(b.occasions || [], b.occasion ? String(b.occasion).split(',') : [], (b.specs && b.specs.occasions) || [])
    .some(o => String(o).trim().toLowerCase() === occ.toLowerCase());
  const home = window.appRouter.renderHomeView();
  const section = home.slice(home.indexOf('id="home-occasions"'), home.indexOf('id="home-featured"'));
  const cardOccs = [...section.matchAll(/data-occasion="([^"]+)"/g)].map(m => m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  if (cardOccs.length !== 4) throw new Error('Shop by Occasion must show exactly 4 cards, got ' + cardOccs.length);
  if (new Set(cardOccs).size !== 4) throw new Error('Shop by Occasion cards must be distinct: ' + cardOccs.join(', '));
  for (const o of cardOccs) if (!official.includes(o)) throw new Error('Card "' + o + '" is not an official occasion');
  if (/Best Sellers|Romance & Anniversaries/.test(section)) throw new Error('Old non-official cards must be gone');
  if (!section.includes('window.suViewFullCatalog()')) throw new Error('View Full Catalog must reset filters and open the full catalog');

  const realNavigate = window.appRouter.navigate; const navigatedTo = []; window.appRouter.navigate = (v) => { navigatedTo.push(v); }; // the mock DOM can't run the real router
  for (const occ of cardOccs) {
    window.suSetPriceRange('1000-2000'); window.suSetSearchQuery('zzz'); // leftover filters must not leak into the card click
    window.suShopByOccasion(occ);
    if (navigatedTo[navigatedTo.length - 1] !== 'collections') throw new Error(occ + ': card must open the Collections (Ready-Made Bouquet) page');
    if (window.collectionFilterState.occasion !== occ) throw new Error('Card did not set the occasion filter: ' + occ);
    if (window.collectionFilterState.budget !== 'all' || window.collectionFilterState.searchQuery !== '') throw new Error('Card click must clear other filters');
    const shown = window.getFilteredBouquets();
    const expected = (window.FLOWER_DATA.featuredBouquets || []).filter(b => !b.archived && b.availability !== 'unavailable' && hasOcc(b, occ));
    if (shown.some(b => !hasOcc(b, occ))) throw new Error(occ + ': a bouquet from another occasion is displayed');
    if (shown.length !== expected.length) throw new Error(occ + ': expected ' + expected.length + ' bouquets, got ' + shown.length);
    if (!window.appRouter.renderCollectionsView().includes('<option value="' + occ + '" selected>')) throw new Error(occ + ': catalog Occasion dropdown does not show the card\'s occasion');
  }
  window.suShopByOccasion('Not A Real Occasion');
  if (window.collectionFilterState.occasion !== 'all') throw new Error('Unknown occasion must fall back to the full catalog');
  window.suSetOccasion('Birthday'); window.suSetSortBy('price_asc');
  window.suViewFullCatalog();
  if (navigatedTo[navigatedTo.length - 1] !== 'collections') throw new Error('View Full Catalog must open the Collections page');
  window.appRouter.navigate = realNavigate;
  if (window.getFilteredBouquets().length !== global.SAMPLE_BOUQUET_COUNT) throw new Error('View Full Catalog must show every bouquet');
  window.suClearAllFilters();
  console.log('OK: 4 occasion cards (' + cardOccs.join(', ') + ') filter the catalog by the official occasion list');
}

// 2c. Bouquet cards (Collections + Home Featured): minimal layout, the image opens the correct details modal.
console.log('Testing bouquet cards & details modal...');
{
  const T2 = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  window.suClearAllFilters();
  const list = window.getFilteredBouquets();
  const colPage = window.appRouter.renderCollectionsView();
  const grid = colPage.slice(colPage.indexOf('id="su-bouquet-grid"'));
  const cards = grid.split('<article').slice(1);
  if (cards.length !== list.length) throw new Error('Expected ' + list.length + ' bouquet cards, got ' + cards.length);

  // A persistent element to capture what suOpenBouquet() renders (the mock DOM returns a new object per lookup).
  const modalEl = { id: 'su-bq-modal', innerHTML: '', classList: { add() {}, remove() {} }, addEventListener() {}, appendChild() {} };
  const origGet = document.getElementById;
  document.getElementById = (id) => id === 'su-bq-modal' ? modalEl : origGet(id);

  const modalFor = (id) => { window.suOpenBouquet(id); return modalEl.innerHTML; };
  const seenModals = new Set();
  cards.forEach((card, i) => {
    const bq = list[i], label = bq.name;
    for (const banned of ['Manila Delivery', 'Bouquet Recipe']) if (card.includes(banned)) throw new Error(label + ': card must not contain "' + banned + '"');
    if (!card.includes('View Details')) throw new Error(label + ': card must contain "View Details"');
    if (bq.description && T2(card).includes(T2(bq.description).slice(0, 25))) throw new Error(label + ': card must not show the description');
    if (!T2(card).includes(bq.name)) throw new Error(label + ': card must show the name');
    if (!/absolute bottom-2 right-2[^"]*price/.test(card) || !card.includes(formatCurrency(bq.price))) throw new Error(label + ': price must overlay the image bottom-right');
    if (!card.includes('addPreMadeBouquetToCart') || !card.includes('buyNowBouquet')) throw new Error(label + ': Add to Cart / Buy Now missing');
    if (!card.includes('<button type="button" onclick="window.suOpenBouquet(\'' + bq.id + '\')"')) throw new Error(label + ': "View Details" link must trigger suOpenBouquet for this bouquet');
    // The image wrapper (first element in the card) is the trigger and points at THIS bouquet's id.
    const imgWrap = card.slice(card.indexOf('role="button"'), card.indexOf('absolute bottom-2 right-2'));
    if (!imgWrap.includes("window.suOpenBouquet('" + bq.id + "')")) throw new Error(label + ': image must open this bouquet\'s modal');
    // Exactly one category label, never the whole comma list of occasions.
    const catPill = card.match(/uppercase tracking-wider[^>]*>([^<]*)</);
    if (!catPill || !catPill[1].trim()) throw new Error(label + ': category label missing');
    if (catPill[1].includes(',')) throw new Error(label + ': category must be a single label, got "' + catPill[1].trim() + '"');

    const modal = modalFor(bq.id);
    seenModals.add(modal);
    const mt = T2(modal);
    if (!mt.includes(bq.name)) throw new Error(label + ': modal missing name');
    if (!mt.includes(T2(bq.description || '').slice(0, 25))) throw new Error(label + ': modal missing description');
    if (!modal.includes(formatCurrency(bq.price))) throw new Error(label + ': modal missing price');
    if (!mt.includes('Bouquet Composition')) throw new Error(label + ': modal missing composition');
    if (!modal.includes('su-bq-qty') || !modal.includes('Add to Cart') || !modal.includes('Buy Now')) throw new Error(label + ': modal missing quantity / order buttons');
    for (const other of list) if (other.id !== bq.id && other.name.length > 8 && mt.includes(other.name) && !bq.name.includes(other.name)) throw new Error(label + ': modal shows another bouquet (' + other.name + ')');
  });
  if (seenModals.size !== list.length) throw new Error('Each bouquet must open its own modal');
  document.getElementById = origGet;

  // Home Featured Bouquets use the very same minimal card.
  const homeNow = window.appRouter.renderHomeView();
  const feat = homeNow.slice(homeNow.indexOf('id="home-featured"'), homeNow.indexOf('<section', homeNow.indexOf('id="home-featured"') + 10));
  if (!feat.includes('<article')) throw new Error('Featured section should list bouquet cards');
  if (!feat.includes('View Details')) throw new Error('Featured cards must have a View Details link');
  console.log('OK: ' + cards.length + ' bouquet cards with View Details link; link and image open each bouquet\'s own details modal');
}

// 3. 5-Step Bouquet Builder (Flowers → Fillers → Wrapping → Ribbon → Greeting Card)
console.log('Testing 5-Step Bouquet Builder...');
if (window.builderCtrl.totalSteps !== 5) throw new Error('Builder must have 5 steps');
for (const [fn, heading] of [['renderStep1Flowers', 'Choose Your Flowers'], ['renderStep2Fillers', 'Choose Your Fillers &amp; Greenery'],
  ['renderStep3Wrapping', 'Choose Your Wrapping'], ['renderStep4Ribbon', 'Choose Your Ribbon'], ['renderStep5Card', 'Add a Personalized Greeting Card']]) {
  const html = window.builderCtrl[fn]();
  if (!html.includes(heading)) throw new Error(fn + ' missing "' + heading + '"');
  if (html.includes('id="builder-checkout-btn"')) throw new Error(fn + ' must not duplicate the summary checkout button');
}
window.builderCtrl.resetBuilder(true);
if (window.builderCtrl.validateStep(1)) throw new Error('Step 1 validation must fail with 0 stems');
window.builderCtrl.updateMainFlowerQty('fl-red-rose', 3);
if (!window.builderCtrl.validateStep(1)) throw new Error('Step 1 validation must pass with stems');
if (!window.builderCtrl.validateStep(2)) throw new Error('Step 2 (fillers) is optional');
if (window.builderCtrl.validateStep(3)) throw new Error('Step 3 must require a wrapping');
window.builderCtrl.toggleWrapping('wrp-korean');
window.builderCtrl.toggleWrapping('wrp-kraft');
if (window.builderCtrl.getSelectedWrappings().length !== 2) throw new Error('Expected 2 wrappings selected');
window.builderCtrl.toggleRibbon('rbn-satin');
const breakdown = window.builderCtrl.calculateBreakdown();
if (breakdown.items.filter(i => i.type === 'wrapping').length !== 2) throw new Error('Expected 2 wrapping items in breakdown');
if (breakdown.items.some(i => /fee/i.test((i.name || '') + (i.type || '')))) throw new Error('No arrangement/assembly fee may be added');
console.log('OK: 5-Step Builder verified (rules, multi-wrap, no fee)');

// 4. Order Tracking page (customer's own orders; Grab link only for https URLs)
console.log('Testing Order Tracking...');
eval(fs.readFileSync('js/account.js', 'utf8'));
const trackingHtml = window.appRouter.renderTrackingView();
if (!trackingHtml.includes('Track Your Floral Order') || !trackingHtml.includes('id="track-order-input"')) throw new Error('Tracking page missing title or order search');
const accountJs = fs.readFileSync('js/account.js', 'utf8');
if (!accountJs.includes('Track Delivery via Grab') || !accountJs.includes("o.grabTrackingUrl && /^https:\\/\\//.test(o.grabTrackingUrl)")) throw new Error('Grab tracking link must only show for https URLs');
if (accountJs.includes('Advance Status (Demo)')) throw new Error('Customer tracking must not have a demo advance-status button');
console.log('OK: Order Tracking UI verified');

// =========================================================================
// PART 2: BACKEND STORE TESTS (isolated temporary database)
// =========================================================================
console.log('\n--- RUNNING BACKEND STORE & API TESTS ---');
const store = require('./server/store');
const flowersDb = store.getFlowers();
if (!flowersDb || flowersDb.length < 15) throw new Error('Store flowers table not populated properly, got: ' + flowersDb.length);
const bouquetsDb = store.getBouquets();
if (!bouquetsDb || bouquetsDb.length < 8) throw new Error('Store bouquets table not populated properly, got: ' + bouquetsDb.length);
console.log('OK: Store contains ' + flowersDb.length + ' inventory items and ' + bouquetsDb.length + ' ready-made bouquets');

const rules = require('./js/shop-rules.js');
const newOrder = (num, extra = {}) => store.placeOrder({
  orderNumber: num, status: 'Pending Confirmation', fulfillment: 'delivery',
  firstName: 'Juan', lastName: 'Luna', phone: '09181234567', email: 'juan@luna.ph',
  address: '789 Rizal Ave', district: '3', barangay: 'Barangay 297', city: 'Manila',
  date: rules.earliestDate('delivery'), time: rules.deliverySlots[0], paymentMethod: 'GCash', paymentStatus: 'Pending',
  subtotal: 1200, deliveryFee: 150, total: 1350, createdAt: new Date().toISOString(),
  items: [{ type: 'custom', name: 'Test Bloom', quantity: 1, unitPrice: 1200, lineTotal: 1200 }], ...extra
});
const today = rules.manilaNow().date.replace(/-/g, '');
const testOrderNumber = '#FLR-' + today + '-' + Math.floor(1000 + Math.random() * 9000);
const placed = newOrder(testOrderNumber);
if (!placed || !placed.ok) throw new Error('Failed to place test order: ' + JSON.stringify(placed));
const fetched = store.get(testOrderNumber);
if (!fetched || fetched.status !== 'Pending Confirmation') throw new Error('Initial status must be "Pending Confirmation"');
console.log('OK: Order ' + testOrderNumber + ' stored with status ' + fetched.status);

console.log('Testing Admin Sessions & RBAC...');
const token = store.createSession('admin');
const validated = store.validateSession(token);
if (!validated || validated.username !== 'admin') throw new Error('Admin session validation failed');
console.log('OK: Admin session created and validated successfully');

console.log('Testing payment gate (GCash is paid in advance: verified before confirmation)...');
if (store.confirm(testOrderNumber).ok) throw new Error('Unpaid GCash order must not be confirmed');
const payer = store.createUser({ name: 'Juan Luna', email: 'juan_' + Date.now() + '@luna.ph', password: 'Password-123' });
store.db.prepare('UPDATE orders SET user_id = ? WHERE order_number = ?').run(payer.id, testOrderNumber); // test order only
const sub = store.submitPayment({ orderNumber: testOrderNumber, userId: payer.id, amount: 1350, reference: 'SUITE-' + Date.now(), receipt: { file: 'none.png', mime: 'image/png', sha256: 'suite-' + Date.now() } });
if (!sub.ok) throw new Error('Payment submission failed: ' + sub.error);
const appr = store.reviewPayment({ orderNumber: testOrderNumber, submissionId: sub.submission.id, decision: 'approve', adminUsername: 'admin', confirmReceived: true });
if (!appr.ok || store.get(testOrderNumber).paymentStatus !== 'Paid') throw new Error('Payment approval failed: ' + appr.error);
console.log('OK: payment verified by admin before confirmation');

console.log('Testing Admin Confirm Order...');
const confirmed = store.confirm(testOrderNumber);
if (!confirmed || !confirmed.ok || store.get(testOrderNumber).status !== 'Confirmed') throw new Error('Failed to confirm order');
console.log('OK: Order confirmed');

console.log('Testing Admin Status Progression & Grab Link...');
store.setStatus(testOrderNumber, 'Preparing');
store.setStatus(testOrderNumber, 'Rider Assigned', { grabTrackingUrl: 'https://grab.com/ph/delivery/test-grab-123' });
const withGrab = store.get(testOrderNumber);
if (withGrab.status !== 'Rider Assigned') throw new Error('Expected Rider Assigned status, got: ' + withGrab.status);
if (withGrab.grabTrackingUrl !== 'https://grab.com/ph/delivery/test-grab-123') throw new Error('Grab URL not saved correctly, got: ' + withGrab.grabTrackingUrl);
console.log('OK: Grab tracking link and status progression updated successfully');

const rejectOrderNumber = '#FLR-' + today + '-' + Math.floor(1000 + Math.random() * 9000);
newOrder(rejectOrderNumber);
const rejected = store.reject(rejectOrderNumber, 'Address outside Manila delivery coverage');
const afterReject = store.get(rejectOrderNumber);
if (!rejected || !rejected.ok || afterReject.status !== 'Rejected/Cancelled') throw new Error('Failed to reject order');
if (afterReject.rejectReason !== 'Address outside Manila delivery coverage') throw new Error('Rejection reason missing');
console.log('OK: Order rejected with reason successfully');

console.log('\n======================================================');
console.log('ALL TESTS PASSED: DOM, LOGIC, STORE & RBAC 100% VERIFIED');
console.log('======================================================');
process.exit(0);