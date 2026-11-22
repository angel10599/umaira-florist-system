/* Umaira Florist — Prism-Terra shell & motion (customer storefront only).
   Presentation layer on top of the existing router: it never changes data, prices, carts or orders.
   - top bar: time-of-day greeting, live shop status, running cart total
   - page entrances: on-screen blocks rise in a short cascade when a new page opens
   - filter/tab swaps: new cards re-enter in a cascade (only right after the customer acts)
   - micro-interactions: press ripple, fly-to-cart dot, cart pill bump
   - Ctrl/Cmd + K opens search; the ambient light follows the pointer slightly
   Everything is skipped under prefers-reduced-motion. */
(function () {
  'use strict';
  var router = window.appRouter;
  var state = window.appState;
  if (!router || !state || router.__prism) return;
  router.__prism = true;

  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reduced = function () { return Boolean(mq && mq.matches); };
  var $ = function (id) { return document.getElementById(id); };
  var money = function (n) { return typeof window.formatCurrency === 'function' ? window.formatCurrency(n) : '₱' + Number(n || 0).toLocaleString(); };

  /* ------------------------------------------------------------------ top bar */
  function manilaHour() {
    try {
      var h = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'Asia/Manila' }).format(new Date());
      return Number(h) % 24;
    } catch (e) { return new Date().getHours(); }
  }
  function greeting() {
    var h = manilaHour();
    return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }
  function firstName(user) {
    var n = String((user && user.name) || '').trim().split(/\s+/)[0] || '';
    return n.length > 18 ? n.slice(0, 18) + '…' : n;
  }
  function updateHello() {
    var greetEl = $('pt-hello-greet'), nameEl = $('pt-hello-name'), noteEl = $('pt-hello-note');
    if (!greetEl || !nameEl) return;
    var isAuth = Boolean(state.isAuthenticated && state.isAuthenticated());
    var name = isAuth ? firstName(state.currentUser) : '';
    if (name) {
      greetEl.textContent = greeting() + ',';
      nameEl.textContent = name;
    } else {
      greetEl.textContent = greeting() + ', welcome to';
      nameEl.textContent = (state.storeSettings && state.storeSettings.name) || 'Umaira Florist';
    }
    if (!noteEl || typeof window.SHOP_RULES === 'undefined') return;
    var hours = state.hoursSettings;
    var text = '', closed = false;
    try {
      if (hours && hours.acceptingOrders === false) { text = 'Online orders paused'; closed = true; }
      else if (window.SHOP_RULES.isShopOpen(hours)) { text = 'Open now'; }
      else {
        var next = window.SHOP_RULES.getNextOpeningText(hours);
        text = next ? 'Opens ' + next.charAt(0).toLowerCase() + next.slice(1) : 'Closed now';
        closed = true;
      }
    } catch (e) { text = ''; }
    noteEl.textContent = text;
    noteEl.classList.toggle('is-closed', closed);
  }

  var lastCount = null;
  var lastAddPoint = null; // where the customer pressed an add-to-cart control, for the fly animation
  function updateCartPill() {
    var totalEl = $('pt-cart-total');
    var isAuth = Boolean(state.isAuthenticated && state.isAuthenticated());
    var count = isAuth && state.getCartCount ? state.getCartCount() : 0;
    if (totalEl) totalEl.textContent = money(isAuth && state.getCartSubtotal ? state.getCartSubtotal() : 0);
    if (lastCount !== null && count > lastCount) celebrateCart();
    lastCount = count;
  }
  function celebrateCart() {
    var pill = $('nav-cart-btn');
    if (!pill || pill.classList.contains('hidden')) return;
    var bump = function () {
      pill.classList.remove('pt-cart-bump');
      void pill.offsetWidth;
      pill.classList.add('pt-cart-bump');
    };
    var from = lastAddPoint && (Date.now() - lastAddPoint.t < 2500) ? lastAddPoint : null;
    lastAddPoint = null;
    if (reduced() || !from || !pill.animate) { bump(); return; }
    var r = pill.getBoundingClientRect();
    var tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    var dot = document.createElement('span');
    dot.className = 'pt-fly';
    dot.style.left = from.x + 'px';
    dot.style.top = from.y + 'px';
    document.body.appendChild(dot);
    var dx = tx - from.x, dy = ty - from.y;
    var lift = Math.min(160, Math.abs(dx) * 0.35 + 60);
    var anim = dot.animate([
      { transform: 'translate(0,0) scale(1)', opacity: 1 },
      { transform: 'translate(' + dx * 0.5 + 'px,' + (dy * 0.5 - lift) + 'px) scale(1.25)', opacity: 1, offset: 0.5 },
      { transform: 'translate(' + dx + 'px,' + dy + 'px) scale(.4)', opacity: 0.2 }
    ], { duration: 700, easing: 'cubic-bezier(.5,0,.3,1)' });
    anim.onfinish = function () { dot.remove(); bump(); };
    anim.oncancel = function () { dot.remove(); };
  }
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest ? e.target.closest('button,[role="button"]') : null;
    if (!t) return;
    var oc = String(t.getAttribute('onclick') || '') + ' ' + String(t.id || '') + ' ' + String(t.className || '');
    if (/addPreMadeBouquetToCart|addToCart|AddToCart|add-to-cart|buyNow|addCustom|addBouquet|builder-add/i.test(oc) || /add to cart/i.test(t.textContent || '')) {
      lastAddPoint = { x: e.clientX || 0, y: e.clientY || 0, t: Date.now() };
      if (!e.clientX && !e.clientY) { var b = t.getBoundingClientRect(); lastAddPoint.x = b.left + b.width / 2; lastAddPoint.y = b.top + b.height / 2; }
    }
  }, true);

  /* ------------------------------------------------ guest / signed-in layout */
  var isMember = function () { return Boolean(state.isAuthenticated && state.isAuthenticated()); };
  function syncLayout() {
    var member = isMember();
    var body = document.body;
    if (body.classList.contains('pt-member') === member && body.classList.contains('pt-guest') === !member) return;
    body.classList.toggle('pt-member', member);
    body.classList.toggle('pt-guest', !member);
    if (member && typeof router.closeMobileMenu === 'function') router.closeMobileMenu();
    if (member) closeGate(false);
    requestAnimationFrame(placeNavIndicator);
  }

  // Guest navigation: the ink pill glides to the active page.
  function placeNavIndicator() {
    var nav = document.querySelector('.pt-gnav');
    var ind = nav && nav.querySelector('.pt-gnav-ind');
    if (!nav || !ind) return;
    if (!nav.offsetParent) { nav.classList.remove('has-ind'); return; }
    var active = nav.querySelector('.pt-glink.is-active');
    if (!active) { nav.classList.remove('has-ind'); return; }
    var first = !nav.classList.contains('has-ind');
    if (first) ind.style.transition = 'none';
    ind.style.width = active.offsetWidth + 'px';
    ind.style.transform = 'translateX(' + active.offsetLeft + 'px)';
    nav.classList.add('has-ind');
    if (first) { void ind.offsetWidth; ind.style.transition = ''; }
  }
  window.addEventListener('resize', function () { requestAnimationFrame(placeNavIndicator); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { requestAnimationFrame(placeNavIndicator); });

  var origUpdateNavBar = router.updateNavBar;
  router.updateNavBar = function () {
    var out = origUpdateNavBar.apply(this, arguments);
    try { syncLayout(); updateHello(); updateCartPill(); placeNavIndicator(); } catch (e) { /* presentation only */ }
    return out;
  };
  if (state.on) {
    state.on('settings_change', function () { try { updateHello(); } catch (e) {} });
    state.on('auth_change', function () { try { syncLayout(); } catch (e) {} });
    var rehydrate = function () { if (router.currentView === 'home' && typeof window.suHydrateMemberStrip === 'function') window.suHydrateMemberStrip(); };
    state.on('cart_change', rehydrate);
    state.on('orders_change', rehydrate);
  }

  /* --------------------------------------------- guest menu: focus & scroll */
  var drawer = document.getElementById('mobile-nav-drawer');
  var menuBtn = document.getElementById('mobile-menu-btn');
  function afterDrawerChange() {
    var open = drawer && !drawer.classList.contains('hidden');
    var gateOpen = Boolean(gate && !gate.hidden);
    document.documentElement.classList.toggle('pt-lock', Boolean(open) || gateOpen);
    if (menuBtn) menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    if (open) {
      var first = drawer.querySelector('.pt-dlink.is-active') || drawer.querySelector('.pt-dlink');
      if (first) setTimeout(function () { first.focus({ preventScroll: true }); }, 60);
    }
  }
  ['toggleMobileMenu', 'closeMobileMenu'].forEach(function (fn) {
    var orig = router[fn];
    if (typeof orig !== 'function') return;
    router[fn] = function () {
      var wasOpen = drawer && !drawer.classList.contains('hidden');
      var out = orig.apply(this, arguments);
      afterDrawerChange();
      if (wasOpen && drawer.classList.contains('hidden') && menuBtn && drawer.contains(document.activeElement)) menuBtn.focus({ preventScroll: true });
      return out;
    };
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer && !drawer.classList.contains('hidden')) router.closeMobileMenu();
  });

  /* ------------------------------------------ sign-in sheet for guests */
  var RESTRICTED = ['cart', 'checkout', 'tracking', 'confirmation', 'account', 'notifications'];
  var ICON = {
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
    truck: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    flower: '<circle cx="12" cy="12" r="2.6"/><path d="M12 9.4C10 6 10.4 3 12 3s2 3 0 6.4M14.6 12c3.4-2 6.4-1.6 6.4 0s-3 2-6.4 0M12 14.6c2 3.4 1.6 6.4 0 6.4s-2-3 0-6.4M9.4 12C6 14 3 13.6 3 12s3-2 6.4 0"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>'
  };
  var svg = function (name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICON[name] || ICON.user) + '</svg>'; };
  var escHtml = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  function bouquetName(id) {
    try {
      var list = (window.FLOWER_DATA && window.FLOWER_DATA.featuredBouquets) || [];
      for (var i = 0; i < list.length; i++) if (String(list[i].id) === String(id)) return list[i].name || '';
    } catch (e) {}
    return '';
  }
  // Words for why the guest is being asked to sign in, from the action the app saved to resume after sign-in.
  function gateCopy(p, fallback) {
    var t = p && p.type;
    var name = p ? bouquetName(p.bouquetId || p.id) : '';
    if (t === 'add_bouquet') return { icon: 'bag', title: 'Sign in to add ' + (name || 'this bouquet') + ' to your cart', sub: 'We will add it for you as soon as you are signed in.' };
    if (t === 'buy_now') return { icon: 'bag', title: 'Sign in to buy ' + (name || 'this bouquet'), sub: 'You will go straight to checkout after signing in.' };
    if (t === 'add_custom_bouquet') return { icon: 'flower', title: 'Sign in to save your bouquet', sub: 'Your design is kept. It goes into your cart right after you sign in.' };
    if (t === 'add_stem') return { icon: 'flower', title: 'Sign in to build with this flower', sub: 'You will continue in the bouquet builder with it added.' };
    if (t === 'view_bouquet') return { icon: 'flower', title: 'Sign in to see ' + (name || 'this bouquet'), sub: 'You will come straight back to it.' };
    if (t === 'navigate') {
      var g = p.target;
      if (g === 'cart') return { icon: 'bag', title: 'Sign in to see your cart', sub: 'Your cart is saved to your account, so it is there on any device.' };
      if (g === 'checkout') return { icon: 'bag', title: 'Sign in to check out', sub: 'Delivery across the City of Manila, or pickup at the shop.' };
      if (g === 'tracking' || g === 'confirmation') return { icon: 'truck', title: 'Sign in to track your orders', sub: 'Orders can be followed from the account that placed them.' };
      if (g === 'account') return { icon: 'user', title: 'Sign in to open your account', sub: 'Update your details and see your order history.' };
      if (g === 'notifications') return { icon: 'bell', title: 'Sign in to see your notifications', sub: 'Order updates appear here as the shop works on them.' };
    }
    return { icon: 'user', title: 'Sign in to continue', sub: fallback || 'Ordering, checkout and order tracking need an account.' };
  }

  var gate = null, gateReturnFocus = null;
  function buildGate() {
    gate = document.createElement('div');
    gate.className = 'pt-gate';
    gate.id = 'pt-gate';
    gate.hidden = true;
    gate.setAttribute('role', 'dialog');
    gate.setAttribute('aria-modal', 'true');
    gate.setAttribute('aria-labelledby', 'pt-gate-title');
    gate.innerHTML =
      '<div class="pt-gate-card">' +
        '<button type="button" class="pt-orb pt-gate-x" data-gate="later" aria-label="Close"><svg class="pt-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>' +
        '<span class="pt-gate-disc" data-slot="icon"></span>' +
        '<h2 class="pt-gate-title" id="pt-gate-title"></h2>' +
        '<p class="pt-gate-sub" data-slot="sub"></p>' +
        '<div class="pt-gate-acts">' +
          '<button type="button" class="pt-btn pt-btn-ink" data-gate="signin">Sign in</button>' +
          '<button type="button" class="pt-btn pt-btn-prism" data-gate="signup">Create account</button>' +
        '</div>' +
        '<button type="button" class="pt-gate-later" data-gate="later">Keep browsing</button>' +
        '<p class="pt-gate-foot">New here? Creating an account takes a minute.</p>' +
      '</div>';
    document.body.appendChild(gate);
    gate.addEventListener('click', function (e) {
      var b = e.target.closest('[data-gate]');
      if (e.target === gate) { closeGate(true); return; }
      if (!b) return;
      var act = b.getAttribute('data-gate');
      if (act === 'later') { closeGate(true); return; }
      closeGate(false, true);
      router.navigate(act === 'signup' ? 'signup' : 'signin');
    });
    gate.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); closeGate(true); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.filter.call(gate.querySelectorAll('button'), function (x) { return x.offsetParent; });
      if (!f.length) return;
      var i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
    });
  }
  function openGate(pending, fallback) {
    if (!gate) buildGate();
    var c = gateCopy(pending, fallback);
    gate.querySelector('[data-slot="icon"]').innerHTML = svg(c.icon);
    gate.querySelector('#pt-gate-title').textContent = c.title;
    gate.querySelector('[data-slot="sub"]').textContent = c.sub;
    gate.classList.remove('is-leaving');
    gateReturnFocus = document.activeElement;
    gate.hidden = false;
    document.documentElement.classList.add('pt-lock');
    if (typeof router.closeMobileMenu === 'function') router.closeMobileMenu();
    document.documentElement.classList.add('pt-lock');
    setTimeout(function () { var b = gate.querySelector('[data-gate="signin"]'); if (b) b.focus({ preventScroll: true }); }, 40);
  }
  // keepAction: the guest chose to sign in, so the saved action must survive for the app to resume it.
  function closeGate(dropAction, keepFocus) {
    if (!gate || gate.hidden) return;
    if (dropAction && state.clearPendingAction) state.clearPendingAction();
    document.documentElement.classList.remove('pt-lock');
    var finish = function () { gate.hidden = true; gate.classList.remove('is-leaving'); };
    if (reduced()) finish(); else { gate.classList.add('is-leaving'); setTimeout(finish, 220); }
    if (!keepFocus && gateReturnFocus && gateReturnFocus.focus && document.contains(gateReturnFocus)) gateReturnFocus.focus({ preventScroll: true });
  }
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && gate && !gate.hidden) closeGate(true);
  });

  // Same access rules as before (the app still saves the action and resumes it after sign-in);
  // only the way the guest is asked changes: a sheet over the page instead of a jump to the sign-in page.
  var origPrompt = router.promptGuestSignIn;
  if (typeof origPrompt === 'function') {
    router.promptGuestSignIn = function (message, pendingAction) {
      if (!booted || this.currentView === 'auth' || isMember()) return origPrompt.apply(this, arguments);
      if (pendingAction) state.setPendingAction(pendingAction);
      openGate(state.getPendingAction && state.getPendingAction(), message);
    };
  }

  /* ------------------------------------- sign-in page: say why, show what's in it */
  function authNoteHtml() {
    var p = state.getPendingAction && state.getPendingAction();
    if (!p) return '';
    var c = gateCopy(p);
    return '<div class="pt-auth-note" role="note"><span class="pt-disc" aria-hidden="true">' + svg(c.icon) + '</span>' +
      '<span><b>' + escHtml(c.title) + '</b><small>' + escHtml(c.sub) + '</small></span></div>';
  }
  function authAsideHtml() {
    var li = function (icon, title, text) { return '<li>' + svg(icon) + '<span><b>' + title + '</b>' + text + '</span></li>'; };
    return '<aside class="pt-auth-aside" aria-label="What your account is for">' +
      '<div class="pt-auth-arch"><img src="/image/umaira-florist-shop.jpg" alt="The Umaira Florist shop" loading="lazy" decoding="async"></div>' +
      '<div>' +
        '<span class="pt-kick">Your Umaira account</span>' +
        '<h2>Everything for your order, <em>in one place.</em></h2>' +
        '<ul class="pt-auth-perks">' +
          li('bag', 'Delivery or pickup', 'Order for delivery across the City of Manila, or pick up at the shop.') +
          li('flower', 'Your own designs', 'Bouquets you build go straight into your cart.') +
          li('truck', 'Every step, live', 'Follow each order from confirmed to delivered.') +
          li('user', 'Remembered for you', 'Your cart and delivery address stay with your account.') +
        '</ul>' +
      '</div>' +
    '</aside>';
  }
  var origAuthView = router.renderAuthView;
  if (typeof origAuthView === 'function') {
    router.renderAuthView = function () {
      var html = origAuthView.apply(this, arguments);
      var marker = '<section class="auth-page-container">';
      if (typeof html !== 'string' || html.indexOf(marker) < 0) return html;
      try { return html.replace(marker, '<section class="auth-page-container pt-auth">' + authNoteHtml() + authAsideHtml()); }
      catch (e) { return html; }
    };
  }
  setInterval(function () { try { updateHello(); } catch (e) {} }, 60000);

  /* ------------------------------------------------------------ page entrance */
  var main = $('main-content');
  var animatedView = null;
  var swapGuardUntil = 0;
  var lastUserAct = 0;
  ['pointerdown', 'keydown', 'input', 'change'].forEach(function (ev) {
    document.addEventListener(ev, function () { lastUserAct = Date.now(); }, { capture: true, passive: true });
  });

  function visible(el) {
    if (!el || el.nodeType !== 1) return false;
    if (/^(SCRIPT|STYLE|TEMPLATE|LINK)$/.test(el.tagName)) return false;
    if (el.hidden || el.classList.contains('hidden')) return false;
    var cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.position === 'absolute' || cs.position === 'fixed') return false;
    if (el.classList.contains('customer-decor-wrapper') || el.classList.contains('homepage-decor-wrapper')) return false;
    return el.getBoundingClientRect().height > 0;
  }
  function kids(el) { return Array.prototype.filter.call(el.children || [], visible); }
  function isGrid(el) { var d = getComputedStyle(el).display; return d === 'grid' || d === 'inline-grid'; }

  function entranceTargets() {
    var vh = window.innerHeight || 800;
    var picked = [];
    var add = function (el) {
      if (picked.length >= 18) return;
      var r = el.getBoundingClientRect();
      if (r.top > vh * 1.02 || r.bottom < 0) return;
      for (var i = 0; i < picked.length; i++) if (picked[i].contains(el) || el.contains(picked[i])) return;
      picked.push(el);
    };
    // Walk down single-child wrappers to the first level that actually holds the page's blocks.
    var walk = function (root, depth) {
      if (!root || depth > 6 || picked.length >= 18) return;
      var list = kids(root);
      if (list.length === 1 && depth < 5) { walk(list[0], depth + 1); return; }
      list.forEach(function (k) {
        if (picked.length >= 18) return;
        var r = k.getBoundingClientRect();
        if (r.top > vh * 1.02) return;
        // A grid of cards cascades card by card; a big block that fills the screen is split one level.
        if (isGrid(k) && kids(k).length > 1) { kids(k).forEach(add); return; }
        if (r.height > vh * 0.9 && depth < 4 && kids(k).length > 1) { walk(k, depth + 1); return; }
        add(k);
      });
    };
    walk(main, 0);
    return picked;
  }

  function playEntrance() {
    if (!main || reduced()) return;
    var list = entranceTargets();
    list.forEach(function (el, i) {
      if (el.closest('.pt-hero')) return; // the hero has its own choreography
      el.style.setProperty('--pt-i', String(i));
      el.classList.remove('pt-in');
      void el.offsetWidth;
      el.classList.add('pt-in');
      var done = function () { el.classList.remove('pt-in'); el.style.removeProperty('--pt-i'); el.removeEventListener('animationend', done); };
      el.addEventListener('animationend', done);
      setTimeout(done, 2200);
    });
  }

  var booted = false; // true once the router has drawn a page (so a sheet has something to sit on)
  var origRenderView = router.renderView;
  router.renderView = function (viewName) {
    var out = origRenderView.apply(this, arguments);
    booted = true;
    try {
      var view = viewName || this.currentView;
      if (view === 'home' && typeof window.suHydrateMemberStrip === 'function') window.suHydrateMemberStrip();
      if (view !== animatedView) {
        animatedView = view;
        swapGuardUntil = Date.now() + 400;
        if (observer) observer.takeRecords();
        requestAnimationFrame(playEntrance);
      }
    } catch (e) { /* presentation only */ }
    return out;
  };

  var origNavigate = router.navigate;
  router.navigate = function (viewName) {
    // A guest heading for a members-only page from within the site gets the sign-in sheet over the current page.
    // The saved action is the one the router itself would save, so sign-in still lands them on that page.
    // (Opening such a link directly, before any page is drawn, keeps the router's own redirect to sign-in.)
    if (booted && !isMember() && RESTRICTED.indexOf(viewName) >= 0 && this.currentView !== 'auth') {
      state.setPendingAction({ type: 'navigate', target: viewName });
      openGate(state.getPendingAction(), '');
      return;
    }
    var before = this.currentView;
    var out = origNavigate.apply(this, arguments);
    try {
      // A new page starts at the top straight away (the old smooth scroll fought with the entrance).
      if (this.currentView !== before) window.scrollTo(0, 0);
    } catch (e) {}
    return out;
  };

  /* ------------------------------------------------------- grid swap cascade */
  var observer = null;
  if (main && 'MutationObserver' in window) {
    observer = new MutationObserver(function (records) {
      if (reduced() || Date.now() < swapGuardUntil || Date.now() - lastUserAct > 1500) return;
      var cards = [];
      records.forEach(function (rec) {
        Array.prototype.forEach.call(rec.addedNodes, function (n) {
          if (n.nodeType !== 1 || cards.length > 24) return;
          if (isGrid(n) && n.children.length > 1) { Array.prototype.forEach.call(n.children, function (c) { cards.push(c); }); return; }
          if (rec.target && rec.target.nodeType === 1 && isGrid(rec.target) && rec.addedNodes.length > 1) { cards.push(n); return; }
          var inner = n.querySelector && n.querySelector('.grid');
          if (inner && inner.children.length > 1 && n.children.length <= 3) Array.prototype.forEach.call(inner.children, function (c) { cards.push(c); });
        });
      });
      cards.slice(0, 24).forEach(function (el, i) {
        if (!el.classList || el.closest('.pt-hero')) return;
        el.style.setProperty('--pt-i', String(i));
        el.classList.add('pt-swap');
        var done = function () { el.classList.remove('pt-swap'); el.style.removeProperty('--pt-i'); el.removeEventListener('animationend', done); };
        el.addEventListener('animationend', done);
        setTimeout(done, 1800);
      });
    });
    observer.observe(main, { childList: true, subtree: true });
  }

  /* ------------------------------------------------------------------ ripple */
  var RIPPLE = '.pt-btn, .pt-cartpill, #nav-auth-container > button';
  document.addEventListener('pointerdown', function (e) {
    if (reduced() || e.button !== 0) return;
    var b = e.target && e.target.closest ? e.target.closest(RIPPLE) : null;
    if (!b || b.disabled) return;
    var r = b.getBoundingClientRect();
    var size = Math.max(r.width, r.height) * 2.2;
    var s = document.createElement('span');
    s.className = 'pt-ripple';
    s.style.width = s.style.height = size + 'px';
    s.style.left = (e.clientX - r.left - size / 2) + 'px';
    s.style.top = (e.clientY - r.top - size / 2) + 'px';
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = 'hidden';
    b.appendChild(s);
    setTimeout(function () { s.remove(); }, 700);
  }, { passive: true });

  /* --------------------------------------------------------------- shortcuts */
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && String(e.key).toLowerCase() === 'k') {
      if (typeof router.openNavSearch === 'function') { e.preventDefault(); router.openNavSearch(); }
    }
  });
  var kbd = document.querySelector('.pt-kbd');
  if (kbd && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')) kbd.textContent = '⌘ K';

  /* -------------------------------------------------- ambient light parallax */
  var orbs = Array.prototype.slice.call(document.querySelectorAll('.pt-bg i'));
  var fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (orbs.length && fine) {
    var tx = 0, ty = 0, x = 0, y = 0, raf = 0;
    var step = function () {
      raf = 0;
      x += (tx - x) * 0.06; y += (ty - y) * 0.06;
      orbs.forEach(function (o, i) {
        var depth = (i % 2 ? -1 : 1) * (14 + i * 6);
        o.style.translate = (x * depth).toFixed(1) + 'px ' + (y * depth).toFixed(1) + 'px';
      });
      if (Math.abs(tx - x) > 0.002 || Math.abs(ty - y) > 0.002) raf = requestAnimationFrame(step);
    };
    document.addEventListener('pointermove', function (e) {
      if (reduced()) return;
      tx = (e.clientX / window.innerWidth) - 0.5;
      ty = (e.clientY / window.innerHeight) - 0.5;
      if (!raf) raf = requestAnimationFrame(step);
    }, { passive: true });
  }

  /* -------------------------------------------------------------------- boot */
  try { syncLayout(); updateHello(); updateCartPill(); placeNavIndicator(); } catch (e) {}
  // The first layout is drawn without motion; transitions switch on after two frames.
  requestAnimationFrame(function () { requestAnimationFrame(function () { document.documentElement.classList.remove('pt-no-anim'); }); });
})();
