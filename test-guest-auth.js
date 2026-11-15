const fs = require('fs');

console.log('=== STARTING UMAIRA FLORIST GUEST ACCESS & AUTH TEST SUITE ===');

// Setup mock DOM environment
global.window = global;
global.addEventListener = () => {};
global.removeEventListener = () => {};

let mockElements = {};
let createdCount = 0;
function getOrCreateMockEl(id) {
  if (!mockElements[id]) {
    mockElements[id] = {
      id,
      className: '',
      innerText: '',
      innerHTML: '',
      style: {},
      classList: {
        _classes: new Set(),
        add: function(...c) { c.forEach(x => this._classes.add(x)); },
        remove: function(...c) { c.forEach(x => this._classes.delete(x)); },
        contains: function(x) { return this._classes.has(x); },
        toggle: function(x) { if (this._classes.has(x)) this._classes.delete(x); else this._classes.add(x); }
      },
      appendChild: () => {},
      insertAdjacentHTML: () => {},
      scrollIntoView: () => {},
      // Standard DOM methods used by the shared UI helpers (no-ops in this test)
      value: '', hidden: false, dataset: {},
      setAttribute: function (k, v) { this['attr:' + k] = String(v); }, getAttribute: function (k) { return this['attr:' + k] ?? null; },
      removeAttribute: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => true,
      querySelector: () => getOrCreateMockEl('child-' + (++createdCount)), querySelectorAll: () => [], closest: () => null, contains: () => false,
      focus: () => {}, blur: () => {}, click: () => {}, remove: () => {}, replaceWith: () => {},
      getBoundingClientRect: () => ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 })
    };
  }
  return mockElements[id];
}

global.document = {
  readyState: 'complete',
  head: { appendChild: () => {} },
  body: {
    setAttribute: () => {},
    getAttribute: () => '',
    style: {},
    appendChild: () => {}
  },
  // DOM APIs used by js/ui.js (shared dialogs and menus)
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: (id) => getOrCreateMockEl(id),
  querySelector: (sel) => {
    if (sel.includes('meta')) return null;
    return getOrCreateMockEl('query-' + sel);
  },
  querySelectorAll: (sel) => {
    if (sel === '[data-auth-required="true"]') {
      return [
        getOrCreateMockEl('nav-collections'),
        getOrCreateMockEl('nav-builder'),
        getOrCreateMockEl('nav-tracking'),
        getOrCreateMockEl('nav-cart-btn')
      ];
    }
    if (sel === '.nav-link') {
      return [
        { getAttribute: () => 'home', className: '' },
        { getAttribute: () => 'collections', className: '' },
        { getAttribute: () => 'builder', className: '' },
        { getAttribute: () => 'care', className: '' },
        { getAttribute: () => 'about', className: '' }
      ];
    }
    return [];
  },
  // New elements get the same fake element API (toasts look up their message <p> inside the element).
  createElement: () => getOrCreateMockEl('created-' + (++createdCount))
};

global.localStorage = {
  _store: {},
  getItem: function(k) { return this._store[k] || null; },
  setItem: function(k, v) { this._store[k] = String(v); },
  removeItem: function(k) { delete this._store[k]; },
  clear: function() { this._store = {}; }
};

global.location = { hash: '#home', href: 'http://localhost:3000/#home' };
global.history = {
  pushState: (state, title, url) => { global.location.hash = url; },
  replaceState: (state, title, url) => { global.location.hash = url; }
};
global.scrollTo = () => {};

// Load scripts
eval(fs.readFileSync('js/data.js', 'utf8'));
eval(fs.readFileSync('js/shop-rules.js', 'utf8'));
eval(fs.readFileSync('js/state.js', 'utf8'));
eval(fs.readFileSync('js/builder.js', 'utf8'));
eval(fs.readFileSync('js/app.js', 'utf8'));
eval(fs.readFileSync('js/site-update.js', 'utf8'));

// 1. Initial State: Unauthenticated Guest
if (window.appState.isAuthenticated()) {
  throw new Error('Initial state must be unauthenticated guest');
}
console.log('OK: Initial guest state confirmed (unauthenticated)');

// 2. Permitted Guest Navigation Tests
console.log('Testing Permitted Guest Routes...');
window.appRouter.navigate('home');
if (window.appRouter.currentView !== 'home') throw new Error('Guest should be able to navigate to home');

window.appRouter.navigate('care');
if (window.appRouter.currentView !== 'care') throw new Error('Guest should be able to navigate to care');

window.appRouter.navigate('about');
if (window.appRouter.currentView !== 'about') throw new Error('Guest should be able to navigate to about');

for (const browse of ['collections', 'builder']) {
  window.appRouter.navigate(browse);
  if (window.appRouter.currentView !== browse) throw new Error('Guest should be able to browse ' + browse);
}
console.log('OK: Guests can browse Home, Collections, Bouquet Builder, Florist Care Guide, and About Us');

// 3. Restricted Routes Guard Tests
console.log('Testing Restricted Routes Guard for Guests...');
const restrictedRoutes = ['cart', 'checkout', 'tracking', 'account', 'notifications'];
for (const route of restrictedRoutes) {
  window.appRouter.navigate(route);
  if (window.appRouter.currentView !== 'auth') {
    throw new Error(`Guest should NOT be able to access "${route}". Expected redirect to "auth", got "${window.appRouter.currentView}"`);
  }
  const pending = window.appState.getPendingAction();
  if (!pending || pending.target !== route) {
    throw new Error(`Pending action for restricted route "${route}" was not stored properly`);
  }
}
console.log('OK: All restricted customer routes (cart, checkout, tracking, account, notifications) redirect guests to sign-in and store the pending action');

// 4. Guest Navigation Bar Verification
console.log('Testing Guest Navigation Bar display...');
window.appRouter.updateNavBar();
const cartBtn = document.getElementById('nav-cart-btn');
if (!cartBtn.classList.contains('hidden')) throw new Error('Cart button must be hidden for unauthenticated guests');
const navAuth = document.getElementById('nav-auth-container');
if (!/Sign In/.test(navAuth.innerHTML) || !navAuth.innerHTML.includes("navigate(\'auth\')")) {
  throw new Error('Guest nav auth container must display a "Sign In" button that opens the sign-in page');
}
console.log('OK: Guest navigation hides the cart and shows a "Sign In" button');

// 5. Dedicated Authentication View Verification
console.log('Testing Dedicated Sign In & Sign Up Page View...');
const authHtml = window.appRouter.renderAuthView('signin');
if (!authHtml.includes('Welcome to Umaira Florist')) throw new Error('Auth page missing "Welcome to Umaira Florist" title');
if (!authHtml.includes('Sign In') || !authHtml.includes('Create Account')) throw new Error('Auth page missing tabs');
if (!authHtml.includes('Continue with Google')) throw new Error('Auth page missing "Continue with Google" button');
if (!authHtml.includes('auth-page-login-email') || !authHtml.includes('auth-page-login-password')) throw new Error('Auth page missing email & password inputs');

const authRegHtml = window.appRouter.renderAuthView('signup');
if (!authRegHtml.includes('Full Name') || !authRegHtml.includes('Mobile / Contact Number')) {
  throw new Error('Sign Up form missing Name or Mobile fields');
}
console.log('OK: Dedicated Authentication view verified for both Sign In and Sign Up');

// 6. Home Page for guests: browse freely, sign in only to order / track orders
console.log('Testing Home Page for guests...');
const guestHomeHtml = window.appRouter.renderHomeView();
for (const text of ['Explore Collections', 'Build Your Bouquet', 'Guests welcome', 'Sign In']) {
  if (!guestHomeHtml.includes(text)) throw new Error('Guest home hero missing "' + text + '"');
}
console.log('OK: Guest home hero invites browsing (Collections, Builder) and offers Sign In for tracking orders');

// 7. Customer sign-in reveals the cart and account menu
console.log('Testing Sign-In Flow & Navigation...');
const mockUser = { id: 'usr_test_123', name: 'Leonor Rivera', email: 'leonor@rivera.ph', role: 'customer' };
window.appState.setCurrentUser(mockUser, 'tok_test_abc');
if (!window.appState.isAuthenticated()) throw new Error('User should now be authenticated');
window.appRouter.updateNavBar();
if (cartBtn.classList.contains('hidden')) throw new Error('Cart button must be visible for signed-in customers');
if (!navAuth.innerHTML.includes('Leonor') || !navAuth.innerHTML.includes('Sign Out')) {
  throw new Error('Account menu must show the customer name and a Sign Out item');
}
for (const view of ['collections', 'builder', 'cart']) {
  window.appRouter.navigate(view);
  if (window.appRouter.currentView !== view) throw new Error('Signed-in customer should be able to open ' + view);
}
console.log('OK: Signing in shows the cart and account menu and opens Collections, Builder and Cart');

// 8. Sign out (customer confirms the dialog) restores the guest experience
(async () => {
  console.log('Testing Sign Out Flow...');
  window.UI = window.UI || {};
  window.UI.confirm = async () => true; // the customer confirms "Sign out of Umaira Florist?"
  global.UI = window.UI;
  await window.appRouter.handleCustomerLogout();
  if (window.appState.isAuthenticated()) throw new Error('User must be logged out after confirming sign out');
  if (window.appRouter.currentView !== 'home') throw new Error('Customer logout must redirect to the home page');
  window.appRouter.updateNavBar();
  if (!cartBtn.classList.contains('hidden')) throw new Error('Cart button must be hidden again after sign out');
  window.appRouter.navigate('collections');
  if (window.appRouter.currentView !== 'collections') throw new Error('Guests may still browse collections after sign out');
  window.appRouter.navigate('cart');
  if (window.appRouter.currentView !== 'auth') throw new Error('Cart after sign out must redirect to sign-in');
  console.log('OK: Signing out restores the guest experience (browse yes, cart needs sign-in)');

  console.log('\n======================================================');
  console.log('ALL GUEST ACCESS AND CUSTOMER AUTH TESTS PASSED 100%!');
  console.log('======================================================');
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
