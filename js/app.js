/**
 * FLEUR DE L'AMOUR - Main Application Router, View Renderers & Interaction Engine
 */

class AppRouter {
  constructor() {
    this.currentView = 'home';
    this.selectedCatalogCategory = 'all';
    this.catalogSearchQuery = '';
    this.catalogAvailabilityFilter = 'all';
    this.selectedOccasion = 'all';
    this.pendingAuthAction = null;
    this.selectedCartItemIds = new Set();
    this.init();
  }

  init() {
    // Bind navigation events
    window.addEventListener('popstate', (e) => {
      const raw = e.state ? e.state.view : (window.location.hash.replace('#', '') || 'home');
      const view = raw.split('?')[0];
      this.navigate(view, true);
    });

    window.addEventListener('hashchange', () => {
      const raw = (window.location.hash || '').replace('#', '') || 'home';
      const hash = raw.split('?')[0];
      if (this.currentView !== hash) {
        this.navigate(hash);
      }
    });

    // Subscribe to state changes
    appState.on('auth_change', () => {
      this.updateNavBar();
      if (this.currentView === 'account') {
        this.renderView('account');
      }
    });

    appState.on('cart_change', () => {
      this.updateNavBar();
      if (this.currentView === 'cart') {
        this.renderView('cart'); // redraw so quantities, totals and buttons match the cart
      }
    });

    appState.on('settings_change', (settings) => {
      this.onSettingsUpdated(settings);
    });

    appState.on('catalog_change', () => {
      this.renderAnnouncementContent();
      this.updateStoreInfoDOM(appState.storeSettings);
    });

    // Check initial URL hash or route
    const rawHash = (window.location.hash || '').replace('#', '');
    const initialView = rawHash.split('?')[0] || 'home';
    // The first page is drawn by js/account.js once the live catalog has loaded.
    this.currentView = initialView;
    this.renderAnnouncementContent();
    this.updateStoreInfoDOM(appState.storeSettings);
  }

  updateAnnouncementThreshold(threshold) {
    const n = Number(threshold);
    const amount = Number.isFinite(n) && n >= 0 ? n : appState.getFreeDeliveryThreshold();
    const formatted = typeof formatCurrency === 'function' ? formatCurrency(amount) : ('₱' + amount.toLocaleString());
    const nodes = document.querySelectorAll('.announcement-threshold-val, .free-delivery-threshold-val');
    nodes.forEach(el => {
      el.textContent = formatted;
    });
  }

  renderAnnouncementContent() {
    const delivery = appState.deliverySettings || {};
    const pickup = appState.pickupSettings || {};
    const delEnabled = delivery.enabled !== false;
    const picEnabled = pickup.enabled !== false;
    const threshold = appState.getFreeDeliveryThreshold();
    const thresholdFormatted = typeof formatCurrency === 'function' ? formatCurrency(threshold) : ('₱' + threshold.toLocaleString());
    // Free delivery applies when the subtotal is AT or above the threshold (same rule as checkout/server).
    const freeText = threshold > 0
      ? `Free delivery within ${'{COV}'} on orders of <span class="announcement-threshold-val">${thresholdFormatted}</span> and up`
      : `Free delivery on all orders within ${'{COV}'}`;

    let coverageText = 'Manila';
    const cov = String(delivery.coverage || delivery.serviceArea || '').trim();
    if (cov) {
      if (/metro manila/i.test(cov)) coverageText = 'Metro Manila';
      else if (/manila/i.test(cov)) coverageText = 'Manila';
      else coverageText = cov.split('(')[0].trim() || 'Manila';
    }

    let itemHtml = '';
    const freeHtml = freeText.split('{COV}').join(coverageText);
    if (delEnabled && picEnabled) {
      itemHtml = `<span>${freeHtml}</span><span class="opacity-60">·</span><span>Store pickup available</span>`;
    } else if (delEnabled && !picEnabled) {
      itemHtml = `<span>${freeHtml}</span><span class="opacity-60">·</span><span>Handcrafted fresh blooms daily</span>`;
    } else if (!delEnabled && picEnabled) {
      itemHtml = `<span>Store pickup available at our boutique atelier</span><span class="opacity-60">·</span><span>Handcrafted fresh blooms daily</span>`;
    } else {
      itemHtml = `<span>Boutique atelier open</span><span class="opacity-60">·</span><span>Handcrafted fresh blooms daily</span>`;
    }

    const marquee = document.querySelector('.announcement-marquee');
    if (!marquee) return;

    marquee.innerHTML = `
      <div class="announcement-track flex shrink-0 items-center">
        <span class="inline-flex items-center gap-2 px-6 sm:px-10">
          ${itemHtml}
        </span>
        <span class="inline-flex items-center gap-2 px-6 sm:px-10" aria-hidden="true">
          ${itemHtml}
        </span>
      </div>
      <div class="announcement-track flex shrink-0 items-center" aria-hidden="true">
        <span class="inline-flex items-center gap-2 px-6 sm:px-10">
          ${itemHtml}
        </span>
        <span class="inline-flex items-center gap-2 px-6 sm:px-10">
          ${itemHtml}
        </span>
      </div>
    `;
  }

  updateStoreInfoDOM(store) {
    const s = store || appState.storeSettings || {};
    if (s.name) {
      document.querySelectorAll('.store-name-val').forEach(el => el.textContent = s.name);
    }
    if (s.tagline) {
      document.querySelectorAll('.store-tagline-val').forEach(el => el.textContent = s.tagline);
    }
    if (s.address) {
      document.querySelectorAll('.store-address-val').forEach(el => el.textContent = s.address);
    }
    if (s.phone) {
      document.querySelectorAll('.store-phone-val').forEach(el => el.textContent = s.phone);
      const phoneLink = document.getElementById('footer-contact-phone');
      if (phoneLink) phoneLink.href = 'tel:' + s.phone.replace(/[^+\d]/g, '');
    }
    if (s.email) {
      document.querySelectorAll('.store-email-val').forEach(el => el.textContent = s.email);
      const emailLink = document.getElementById('footer-contact-email');
      if (emailLink) emailLink.href = 'mailto:' + s.email.trim();
    }
    if (s.description) {
      document.querySelectorAll('.store-desc-val').forEach(el => el.textContent = s.description);
    }
  }

  updateShopStatusBanner() {
    const banner = document.getElementById('chk-shop-status-banner');
    const submitBtn = document.getElementById('chk-submit-btn');
    if (!banner) return;

    const acceptingOrders = appState.hoursSettings?.acceptingOrders !== false;
    const isClosed = !SHOP_RULES.isShopOpen(appState.hoursSettings);
    const nextOpening = SHOP_RULES.getNextOpeningText(appState.hoursSettings);

    if (!acceptingOrders) {
      banner.className = 'p-4 sm:p-5 rounded-3xl bg-amber-50 border border-amber-200 text-amber-900 shadow-xs flex items-start gap-3.5';
      banner.innerHTML = `
        <div class="w-9 h-9 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0 text-amber-800">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
        </div>
        <div class="space-y-1">
          <h4 class="font-serif font-bold text-base text-amber-950">Online Ordering Temporarily Unavailable</h4>
          <p class="text-xs sm:text-sm text-amber-800 leading-relaxed">
            We are temporarily not accepting new online orders. You may still browse our collections and look at our floral arrangements. Please check back soon!
          </p>
        </div>
      `;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Ordering Temporarily Paused';
      }
    } else if (isClosed) {
      banner.className = 'p-4 sm:p-5 rounded-3xl bg-[#FFF9F5] border border-[#647D69]/30 text-[#302C2A] shadow-xs flex items-start gap-3.5';
      banner.innerHTML = `
        <div class="w-9 h-9 rounded-2xl bg-[#F9DFE8] border border-[#E5ECE6] flex items-center justify-center shrink-0 text-[#647D69]">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <div class="space-y-1 flex-1">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h4 class="font-serif font-bold text-base text-[#344F3B]">Shop Currently Closed</h4>
            <span class="inline-flex items-center px-2.5 py-0.5 rounded-full bg-[#EBF1EC] text-[#526B57] text-[11px] font-bold">24/7 Online Ordering Active</span>
          </div>
          <p class="text-xs sm:text-sm text-[#6E6864] leading-relaxed">
            Our physical shop is currently closed, but you can still place your order! We'll start processing it once we reopen.
          </p>
          <p class="text-xs font-semibold text-[#647D69] pt-0.5">
            Next Opening: <span class="font-bold underline">${nextOpening}</span>
          </p>
        </div>
      `;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Place Order';
      }
    } else {
      banner.className = 'hidden';
      banner.innerHTML = '';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Place Order';
      }
    }
  }

  updateCheckoutFulfillmentAvailability() {
    const delEnabled = appState.deliverySettings?.enabled !== false;
    const picEnabled = appState.pickupSettings?.enabled !== false;

    const optDel = document.getElementById('chk-opt-delivery');
    const optPic = document.getElementById('chk-opt-pickup');

    if (optDel) {
      optDel.style.display = delEnabled ? '' : 'none';
    }
    if (optPic) {
      optPic.style.display = picEnabled ? '' : 'none';
    }

    if (!delEnabled && this.checkoutFulfillment === 'delivery') {
      this.setFulfillment('pickup');
    } else if (!picEnabled && this.checkoutFulfillment === 'pickup') {
      this.setFulfillment('delivery');
    }
  }

  onSettingsUpdated(payload) {
    const settings = payload || {};
    const delivery = settings.delivery || appState.deliverySettings;
    const store = settings.store || appState.storeSettings;
    const threshold = (delivery && delivery.freeThreshold !== undefined)
      ? Number(delivery.freeThreshold)
      : (appState.getFreeDeliveryThreshold ? appState.getFreeDeliveryThreshold() : 2500);

    this.updateAnnouncementThreshold(threshold);
    this.renderAnnouncementContent();
    this.updateStoreInfoDOM(store);

    if (this.currentView === 'cart' || document.getElementById('cart-selected-total')) {
      if (typeof this.updateCartLiveUI === 'function') {
        this.updateCartLiveUI();
      }
    }

    if (this.currentView === 'checkout' || document.getElementById('chk-fee-value') || document.getElementById('chk-shop-status-banner')) {
      this.updateCheckoutFulfillmentAvailability();
      this.updateShopStatusBanner();
      if (typeof this.refreshCheckoutPriceSummary === 'function') {
        this.refreshCheckoutPriceSummary();
      }
    }
  }

  refreshCheckoutPriceSummary() {
    const pickup = this.checkoutFulfillment === 'pickup';
    const checkoutItems = this.getCheckoutItems();
    const subtotal = checkoutItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    const fee = pickup ? 0 : appState.getDeliveryFee(subtotal);
    const $ = (id) => document.getElementById(id);
    if ($('chk-fee-label')) $('chk-fee-label').textContent = pickup ? 'Delivery Fee (Store Pickup)' : 'Delivery Fee';
    if ($('chk-fee-value')) $('chk-fee-value').innerHTML = fee === 0 ? (pickup ? 'None' : 'FREE') : formatCurrency(fee);
    if ($('chk-total-value')) $('chk-total-value').textContent = formatCurrency(subtotal + fee);
    // Keep the exact amount in the payment instructions in step with the summary.
    const pm = document.querySelector && document.querySelector('input[name="paymentMethod"]:checked');
    if (pm && typeof this.showPaymentDetails === 'function') this.showPaymentDetails(pm.value);
  }

  getViewTitle(viewName) {
    const titles = {
      collections: 'Collections',
      flowers: 'Collections',
      occasions: 'Collections',
      builder: 'Build Your Bouquet',
      care: 'Florist Guide',
      about: 'About Us',
      cart: 'Shopping Cart',
      notifications: 'Notifications',
      checkout: 'Checkout & Delivery',
      tracking: 'Track Order',
      account: 'My Account'
    };
    return titles[viewName] || 'this page';
  }

  promptGuestSignIn(message, pendingAction = null) {
    if (pendingAction) {
      appState.setPendingAction(pendingAction);
    }
    showToast(message || 'Please sign in to continue.', 'info');
    this.navigate('auth', false, { mode: 'signin' });
  }

  navigate(viewName, replace = false, options = {}) {
    // Normalization & aliases
    if (viewName === 'occasions') viewName = 'collections';
    if (viewName === 'flowers') viewName = 'collections';
    if (viewName === 'care-guide' || viewName === 'guide' || viewName === 'florist-guide') viewName = 'care';
    if (viewName === 'about-us') viewName = 'about';

    if (viewName === 'signin') {
      viewName = 'auth';
      options = { ...options, mode: 'signin' };
    } else if (viewName === 'signup') {
      viewName = 'auth';
      options = { ...options, mode: 'signup' };
    }

    if (options && options.mode) {
      this.authPageMode = options.mode;
    }

    const RESTRICTED_VIEWS = ['cart', 'checkout', 'tracking', 'confirmation', 'account', 'notifications'];
    const isAuth = Boolean(appState.isAuthenticated && appState.isAuthenticated());

    // Route guard: guests can browse (home, collections, care guide, about); cart, checkout, orders and account need sign-in
    if (!isAuth && RESTRICTED_VIEWS.includes(viewName)) {
      appState.setPendingAction({ type: 'navigate', target: viewName });
      showToast(`Please sign in to access ${this.getViewTitle(viewName)}.`, 'info');
      return this.navigate('auth', replace, { mode: 'signin' });
    }

    if (viewName !== 'checkout') {
      this.clearBuyNowItem();
    }

    if (viewName === 'checkout' && appState.cart.length === 0 && !this.getBuyNowItem()) {
      showToast('Your cart is empty. Please add flowers or a bouquet first!', 'warning');
      this.navigate('collections');
      return;
    }

    this.currentView = viewName;
    
    // Safely update history and hash (safe for file:// protocol)
    try {
      if (replace) {
        window.history.replaceState({ view: viewName }, '', `#${viewName}`);
      } else {
        window.history.pushState({ view: viewName }, '', `#${viewName}`);
      }
    } catch (e) {
      try {
        if (window.location.hash !== `#${viewName}`) {
          window.location.hash = viewName;
        }
      } catch (err) {
        console.warn('Hash update skipped:', err);
      }
    }

    this.renderView(viewName);
    this.playViewEnter();
    try {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {}
    this.updateNavBar();
  }

  // Soft entrance for each page, then (re)attach scroll/pointer effects to the new markup.
  playViewEnter() {
    const main = document.getElementById('main-content');
    if (main) {
      main.classList.remove('view-enter');
      void main.offsetWidth;
      main.classList.add('view-enter');
    }
    if (window.FX) window.FX.refresh();
  }

  toggleMobileMenu() {
    const drawer = document.getElementById('mobile-nav-drawer');
    const btn = document.getElementById('mobile-menu-btn');
    const openIcon = document.getElementById('mobile-menu-icon-open');
    const closeIcon = document.getElementById('mobile-menu-icon-close');
    if (!drawer) return;
    const isHidden = drawer.classList.contains('hidden');
    drawer.classList.toggle('hidden', !isHidden);
    if (btn) btn.setAttribute('aria-expanded', String(isHidden));
    if (openIcon) openIcon.classList.toggle('hidden', isHidden);
    if (closeIcon) closeIcon.classList.toggle('hidden', !isHidden);
  }

  closeMobileMenu() {
    const drawer = document.getElementById('mobile-nav-drawer');
    const btn = document.getElementById('mobile-menu-btn');
    const openIcon = document.getElementById('mobile-menu-icon-open');
    const closeIcon = document.getElementById('mobile-menu-icon-close');
    if (drawer) drawer.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (openIcon) openIcon.classList.remove('hidden');
    if (closeIcon) closeIcon.classList.add('hidden');
  }

  navigateToContact() {
    this.closeMobileMenu();
    if (this.currentView === 'home') {
      const el = document.getElementById('home-atelier');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    } else {
      this.navigate('home');
      setTimeout(() => {
        const el = document.getElementById('home-atelier');
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  }

  updateNavBar() {
    this.closeMobileMenu();
    const cartCountEl = document.getElementById('nav-cart-count');
    const activeLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');
    const isAuth = Boolean(appState.isAuthenticated && appState.isAuthenticated());

    // Highlight active link with soft blush-pink pill background
    activeLinks.forEach(link => {
      const target = link.getAttribute('data-view');
      const isActive = target && target === this.currentView;
      link.classList.toggle('is-active', Boolean(isActive));
    });

    // About dropdown button active state
    const aboutBtn = document.getElementById('about-dropdown-btn') || document.getElementById('more-menu-btn');
    if (aboutBtn) {
      const on = ['care', 'about'].includes(this.currentView);
      aboutBtn.classList.toggle('is-active', on);
    }

    // Shopping cart and notification bell visibility:
    // Only display both icons for authenticated customers; hide for guest users.
    const cartBtn = document.getElementById('nav-cart-btn');
    const notifContainer = document.getElementById('customer-notif-container');

    if (isAuth) {
      if (cartBtn) {
        cartBtn.classList.remove('hidden');
        cartBtn.classList.add('flex');
      }
      if (notifContainer) {
        notifContainer.classList.remove('hidden');
      }
    } else {
      if (cartBtn) {
        cartBtn.classList.add('hidden');
        cartBtn.classList.remove('flex');
      }
      if (notifContainer) {
        notifContainer.classList.add('hidden');
        const notifDrop = document.getElementById('customer-notif-dropdown');
        if (notifDrop) notifDrop.classList.add('hidden');
        if (window.customerNotifications) window.customerNotifications.isOpen = false;
      }
    }

    // Cart count: shown only when the cart has items and user is authenticated
    const count = isAuth ? appState.getCartCount() : 0;
    if (cartCountEl) {
      const prev = cartCountEl.dataset.count;
      cartCountEl.innerText = count > 99 ? '99+' : count;
      cartCountEl.classList.toggle('hidden', count === 0 || !isAuth);
      cartCountEl.classList.toggle('flex', count > 0 && isAuth);
      if (prev !== undefined && String(prev) !== String(count) && count > 0 && isAuth) {
        cartCountEl.classList.remove('badge-bump');
        void cartCountEl.offsetWidth; // trigger reflow
        cartCountEl.classList.add('badge-bump');
      }
      cartCountEl.dataset.count = count;
    }
    if (cartBtn) cartBtn.setAttribute('aria-label', `Cart, ${count} ${count === 1 ? 'item' : 'items'}`);

    // Account control: Sign In for guests, elegant rounded profile popover for logged-in customers.
    const navAuth = document.getElementById('nav-auth-container');
    const user = isAuth ? (appState.currentUser || {}) : null;
    const authKey = isAuth ? 'u:' + (user.name || '') + '|' + (user.email || '') : 'guest';
    if (navAuth && navAuth.dataset.state !== authKey) {
      navAuth.dataset.state = authKey;
      if (!isAuth) {
        navAuth.innerHTML = '<button type="button" onclick="window.appRouter.navigate(\'auth\')" class="px-4 sm:px-5 py-2 sm:py-2.5 min-h-[40px] rounded-full text-xs sm:text-sm font-bold text-white bg-[#647D69] hover:bg-[#526B57] shadow-xs hover:shadow transition-all duration-200 flex items-center gap-1.5 shrink-0"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg><span>Sign In</span></button>';
      } else {
        const fullName = escapeHtml(user.name || 'Account');
        const initials = ((user.name || 'U').split(' ').map(p => p[0]).join('').slice(0, 2) || 'U').toUpperCase();
        const item = 'block w-full text-left px-4 py-2.5 mx-1 rounded-xl w-[calc(100%-8px)] text-xs sm:text-sm font-medium text-[#302C2A] hover:bg-[#EBF1EC]/40 hover:text-[#647D69] transition';
        navAuth.innerHTML = `
          <div class="relative">
            <button type="button" id="account-menu-btn" data-menu-toggle="account-menu" aria-haspopup="menu" aria-expanded="false" aria-controls="account-menu" aria-label="Account menu for ${fullName}" title="Account (${fullName})" class="w-10 h-10 sm:w-11 sm:h-11 flex items-center justify-center rounded-full bg-[#EBF1EC] hover:bg-[#EBF1EC]/80 text-[#302C2A] hover:text-[#647D69] border border-[#E5ECE6] transition-all duration-200 shadow-xs">
              <span class="text-xs sm:text-sm font-bold text-[#302C2A]">${initials}</span>
            </button>
            <div id="account-menu" role="menu" aria-labelledby="account-menu-btn" hidden class="ui-pop nav-glass-dropdown absolute right-0 mt-3 w-60 py-2.5 z-50">
              <div class="px-4 py-2.5 mb-1 border-b border-[#E5ECE6]/70">
                <p class="text-xs sm:text-sm font-semibold text-[#302C2A] truncate">${fullName}</p>
                <p class="text-[11px] text-[#6E6864] truncate">${escapeHtml(user.email || '')}</p>
              </div>
              <button type="button" role="menuitem" onclick="window.appRouter.openAccount('profile')" class="${item}">My Profile</button>
              <button type="button" role="menuitem" onclick="window.appRouter.openAccount('orders')" class="${item}">My Orders</button>
              <button type="button" role="menuitem" onclick="window.appRouter.navigate('tracking')" class="${item}">Track Order</button>
              <div class="my-1.5 border-t border-[#E5ECE6]/70"></div>
              <button type="button" role="menuitem" onclick="window.appRouter.handleCustomerLogout()" class="block w-full text-left px-4 py-2.5 mx-1 rounded-xl w-[calc(100%-8px)] text-xs sm:text-sm font-medium text-rose-700 hover:bg-rose-50 transition">Sign Out</button>
            </div>
          </div>`;
      }
    }
  }

  // Floating Quick Search Methods
  openNavSearch() {
    const modal = document.getElementById('nav-search-modal');
    if (modal) {
      modal.classList.remove('hidden');
      const input = document.getElementById('nav-quick-search-input');
      if (input) {
        input.value = '';
        setTimeout(() => input.focus(), 60);
      }
      if (!this._searchEscBound) {
        window.addEventListener('keydown', (e) => {
          if (e.key === 'Escape') this.closeNavSearch();
        });
        this._searchEscBound = true;
      }
    } else {
      this.navigate('collections');
      setTimeout(() => {
        const inp = document.getElementById('su-bouquet-search-input');
        if (inp) {
          inp.focus();
          inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }

  closeNavSearch() {
    const modal = document.getElementById('nav-search-modal');
    if (modal) modal.classList.add('hidden');
  }

  submitNavSearch(e) {
    if (e && e.preventDefault) e.preventDefault();
    const input = document.getElementById('nav-quick-search-input');
    const query = (input?.value || '').trim();
    this.closeNavSearch();
    this.navigate('collections');
    if (window.suSetSearchQuery) {
      window.suSetSearchQuery(query);
    }
  }

  quickSearchTag(tag) {
    this.closeNavSearch();
    this.navigate('collections');
    if (window.suSetSearchQuery) {
      window.suSetSearchQuery(tag);
    }
  }

  renderView(viewName) {
    const mainContainer = document.getElementById('main-content');
    if (!mainContainer) return;

    switch (viewName) {
      case 'home':
        mainContainer.innerHTML = this.renderHomeView();
        break;
      case 'collections':
      case 'flowers':
        mainContainer.innerHTML = typeof this.renderCollectionsView === 'function' ? this.renderCollectionsView() : this.renderFlowersView();
        break;
      case 'builder':
        mainContainer.innerHTML = this.renderBuilderView();
        if (window.builderCtrl) {
          window.builderCtrl.renderProgressIndicator();
          window.builderCtrl.renderCurrentStep();
          window.builderCtrl.updateSelectedBouquetPanel();
        }
        break;
      case 'about':
        mainContainer.innerHTML = this.renderAboutView();
        requestAnimationFrame(() => this.initFlowerCarousel());
        break;
      case 'care':
        mainContainer.innerHTML = typeof this.renderFloristGuideView === 'function' ? this.renderFloristGuideView() : (typeof this.renderCareGuideView === 'function' ? this.renderCareGuideView() : '');
        break;
      case 'cart':
        mainContainer.innerHTML = this.renderCartView();
        this.updateCartLiveUI();
        break;
      case 'checkout':
        mainContainer.innerHTML = this.renderCheckoutView();
        this.initCheckoutForm();
        break;
      case 'confirmation':
        mainContainer.innerHTML = this.renderConfirmationView();
        break;
      case 'tracking':
        mainContainer.innerHTML = this.renderTrackingView();
        break;
      case 'auth':
      case 'signin':
      case 'signup':
        mainContainer.innerHTML = this.renderAuthView(this.authPageMode || (viewName === 'signup' ? 'signup' : 'signin'));
        this.initGoogleAuth();
        break;
      default:
        mainContainer.innerHTML = this.renderHomeView();
    }
  }

  // =========================================================================
  // VIEW 1: HOMEPAGE (Clean, Modern, Minimal, Warm & Romantic)
  // =========================================================================
  // =========================================================================
  // HOME PAGE DECORATION (continuous, non-interactive motion)
  // =========================================================================

  // Shared SVG shapes: three petal tints and one leaf. Referenced with <use>.
  decorDefs() {
    return '';
  }

  // Dedicated decorative background wrapper using the actual illustrations from /image/backgound/
  renderHomepageDecorations() {
    return `
      <div class="homepage-decor-wrapper" aria-hidden="true">
        <!-- 1. Upper-Left Corner: Floral spray arching in -->
        <img src="/image/backgound/image-removebg-preview%20(1).png" alt="" class="homepage-decor-img decor-corner-tl" />

        <!-- 2. Upper-Right Corner: Floral branch framing the top -->
        <img src="/image/backgound/image-removebg-preview%20(2).png" alt="" class="homepage-decor-img decor-corner-tr" />

        <!-- 3. Hero Left Flank: Vertical botanical stem -->
        <img src="/image/backgound/image-removebg-preview.png" alt="" class="homepage-decor-img decor-side-hero-left" />

        <!-- 4. Carousel / Atelier Right Flank: Blooming cluster -->
        <img src="/image/backgound/image-removebg-preview%20(4).png" alt="" class="homepage-decor-img decor-side-atelier-right" />

        <!-- 5. Popular Blooms Left Flank: Elegant floral stems -->
        <img src="/image/backgound/image-removebg-preview%20(5).png" alt="" class="homepage-decor-img decor-side-blooms-left" />

        <!-- 7. Shop by Occasion Left Flank: Soft floral arrangement -->
        <img src="/image/backgound/image-removebg-preview%20(7).png" alt="" class="homepage-decor-img decor-side-occasion-left" />

        <!-- 8. Bouquet Studio Right Flank: Vibrant artisan blooms -->
        <img src="/image/backgound/image-removebg-preview%20(6).png" alt="" class="homepage-decor-img decor-side-studio-right" />

        <!-- 9. How It Works Left Flank: Vertical botanical art -->
        <img src="/image/backgound/background1.png" alt="" class="homepage-decor-img decor-side-works-left" />

        <!-- 10. Lower-Left Corner: Graceful botanical grounding -->
        <img src="/image/backgound/download.png" alt="" class="homepage-decor-img decor-corner-bl" />

        <!-- 11. Lower-Right Corner: Full celebratory floral bouquet -->
        <img src="/image/backgound/image-removebg-preview%20(8).png" alt="" class="homepage-decor-img decor-corner-br" />
      </div>`;
  }

  decorBlob(style, size, dur, delay) {
    return `<div class="decor-blob decor-item pointer-events-none select-none" style="${style}width:${size}px;height:${size}px;--d:${dur}s;--dl:-${delay}s" aria-hidden="true"></div>`;
  }

  flowerImg(f, cls = '') {
    if (!f) return '';
    return window.UI ? window.UI.renderImage(f.image, f.name, cls, 'thumb') : `<img class="${cls}" src="${f.image || ''}" alt="${f.name || ''}">`;
  }

  renderHero() {
    return `
      <section data-hero data-scene class="hero-immersive hero-floral-bg">
        <div data-mouse="-18" class="absolute inset-0 pointer-events-none">
          ${this.decorBlob('left:-80px;top:-60px;', 340, 20, 3)}
          ${this.decorBlob('right:-60px;bottom:-80px;', 380, 24, 11)}
          ${this.decorBlob('left:42%;top:28%;', 240, 17, 7)}
        </div>
        <div class="hero-garden-overlay" aria-hidden="true"></div>

        <div class="max-w-7xl mx-auto w-full relative z-20 flex items-center">
          <div data-hero-content class="max-w-xl lg:max-w-2xl space-y-6 text-center lg:text-left">
            <div class="hero-fade inline-flex items-center px-4 py-1.5 rounded-full bg-white/90 border border-rose-200 text-rose-900 text-xs font-bold tracking-wider uppercase shadow-xs" style="--dl:.05s">
              UMAIRA FLORIST
            </div>

            <h1 class="hero-title font-serif text-5xl sm:text-6xl lg:text-7xl font-bold text-stone-900 leading-[1.08]">
              <span class="hero-word" style="--i:0">Flowers,</span><br>
              <span class="hero-word italic text-rose-900 font-normal" style="--i:1">thoughtfully</span> <span class="hero-word italic text-rose-900 font-normal" style="--i:2">made.</span>
            </h1>

            <p class="hero-fade text-stone-600 text-base sm:text-lg max-w-lg mx-auto lg:mx-0 font-normal leading-relaxed" style="--dl:.75s">
              Handcrafted bouquets and single stems sourced daily, arranged with love, and delivered across Manila.
            </p>

            <div class="hero-fade flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-2" style="--dl:.95s">
              <button type="button" data-magnetic onclick="window.appRouter.navigate('collections')" class="py-4 px-8 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-base shadow-lg shadow-rose-900/25">
                Explore Collections
              </button>
              <button type="button" data-magnetic onclick="window.appRouter.navigate('builder')" class="py-4 px-8 rounded-2xl bg-white hover:bg-rose-50 text-stone-900 border border-stone-300 font-bold text-base shadow-sm">
                Build Your Bouquet
              </button>
            </div>
          </div>
        </div>

        <div class="absolute bottom-0 left-0 right-0 h-10 sm:h-16 bg-gradient-to-t from-[#FAF6F0] to-transparent pointer-events-none z-10"></div>
      </section>`;
  }

  renderScrollBands() {
    const words = ['Roses', 'Tulips', 'Lilies', 'Sunflowers', 'Peonies', 'Orchids'];
    const row = (cls) => words.concat(words).map(w => `<span class="band-text ${cls}">${w}</span><i class="band-dot"></i>`).join('');
    return `
      <section class="scroll-band" aria-hidden="true">
        <div class="band-row" data-scroll-x="-0.38" style="margin-left:-8%">${row('')}</div>
        <div class="band-row" data-scroll-x="0.38" style="margin-left:-45%">${row('solid')}</div>
      </section>`;
  }

  renderFlowerRing() {
    const order = ['fl-tulip-pink', 'fl-rose-red', 'fl-sunflower', 'fl-lily-stargazer', 'fl-hydrangea-blue', 'fl-rose-pink', 'fl-orchid-purple', 'fl-tulip-yellow', 'fl-peony-blush', 'fl-carnation-peach'];
    const flowers = order.map(id => FLOWER_DATA.mainFlowers.find(f => f.id === id)).filter(f => f && f.availability !== 'sold_out').slice(0, 8);
    const n = flowers.length;

    const cards = flowers.map((f, i) => `
      <button type="button" class="ring-card" data-ring-card="${i}" style="--i:${i}" aria-label="${f.name}">
        <span class="ring-card-float" style="--dl:-${(i * 1.4).toFixed(1)}s">
          ${this.flowerImg(f)}
          <span class="ring-card-cap font-serif font-bold">${f.name}</span>
        </span>
      </button>`).join('');

    const infos = flowers.map((f, i) => `
      <div class="ring-info-item${i === 0 ? ' is-active' : ''}" data-ring-info="${i}">
        <span class="text-[11px] font-bold text-rose-900 uppercase tracking-widest">${f.category}</span>
        <h3 class="font-serif text-2xl sm:text-3xl font-bold text-stone-900 leading-tight">${f.name}</h3>
        <p class="text-xs text-stone-500 italic">${f.botanicalName}</p>
        <p class="text-sm text-stone-600 max-w-md line-clamp-2">${f.description}</p>
        <div class="flex items-center gap-3 pt-1">
          <span class="font-bold text-rose-900 price">${formatCurrency(f.price)} <span class="text-xs font-normal text-stone-500">/ stem</span></span>
          <button type="button" onclick="window.appRouter.showFlowerModal('${f.id}')" class="px-4 py-2 rounded-xl bg-white border border-stone-300 hover:bg-rose-50 text-stone-900 text-xs font-bold transition-colors">Details</button>
          <button type="button" onclick="window.appRouter.addStemToCustomBuilder('${f.id}')" class="px-4 py-2 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-xs font-bold transition-colors">Add to Bouquet</button>
        </div>
      </div>`).join('');

    const dots = flowers.map((f, i) => `<button type="button" class="ring-dot${i === 0 ? ' is-active' : ''}" data-ring-dot="${i}" aria-label="Show ${f.name}"></button>`).join('');

    return `
      <section data-ring class="ring-section" style="--n:${n}">
        <div class="ring-stage">
          <div class="ring-head">
            <span class="text-xs font-bold text-rose-900 uppercase tracking-widest">Discover the blooms</span>
            <h2 class="font-serif text-3xl sm:text-4xl font-bold text-stone-900 mt-1">Scroll to turn the garden</h2>
          </div>
          <div class="ring-scene">
            <div class="ring-tilt">
              <div class="ring" style="--n:${n}">${cards}</div>
            </div>
          </div>
          <div class="ring-info">${infos}</div>
          <div class="ring-dots">${dots}</div>
        </div>
      </section>`;
  }

  renderFlowerMarquee(compact = false) {
    const featuredSelection = [
      FLOWER_DATA.mainFlowers.find(f => f.id === 'fl-tulip-pink') || FLOWER_DATA.mainFlowers[0],
      FLOWER_DATA.mainFlowers.find(f => f.id === 'fl-rose-red') || FLOWER_DATA.mainFlowers[2],
      FLOWER_DATA.mainFlowers.find(f => f.id === 'fl-sunflower') || FLOWER_DATA.mainFlowers[5],
      FLOWER_DATA.mainFlowers.find(f => f.id === 'fl-lily-stargazer') || FLOWER_DATA.mainFlowers[6]
    ].filter((f, i, a) => f && a.indexOf(f) === i);
    if (!featuredSelection.length) return ''; // catalog empty or unavailable

    // Featured strip: images are supplied by the owner in assets/flowers/.
    // If a file is missing, the catalog photo is used so the strip never shows a broken image.
    const featuredItemHtml = (flower) => {
      return `
        <figure class="flower-marquee-item">
          <div class="flower-marquee-photo overflow-hidden flex items-center justify-center">
            ${window.UI ? window.UI.renderImage(flower.image, flower.name, 'w-full h-full object-cover', 'card') : `<img src="${flower.image || ''}" alt="${flower.name}">`}
          </div>
          <figcaption>
            <span class="font-serif font-bold text-stone-900 text-base block">${flower.name}</span>
            <span class="text-xs text-stone-500 italic">${flower.botanicalName}</span>
          </figcaption>
        </figure>
      `;
    };

    // Each group must be wider than the container for a seamless loop, so short lists are repeated.
    const repeatCount = Math.max(1, Math.ceil(8 / featuredSelection.length));
    const groupItems = Array.from({ length: repeatCount }, () => featuredSelection).flat();
    const marqueeDuration = groupItems.length * 7;
    const featuredGroupHtml = groupItems.map(featuredItemHtml).join('');
    return `
      <div class="flower-marquee${compact ? ' flower-marquee-compact' : ''}" role="region" aria-label="Featured flowers">
        <div class="flower-marquee-track" style="animation-duration: ${marqueeDuration}s;">
          <div class="flower-marquee-group">${featuredGroupHtml}</div>
          <div class="flower-marquee-group" aria-hidden="true">${featuredGroupHtml}</div>
        </div>
      </div>
    `;

  }

  renderHomeView() {
    // 1. Featured flowers: a continuously moving strip, shared with the Flowers page
    const featuredFlowersHtml = this.renderFlowerMarquee();

    // 2. Official Occasions from Ready-Made Bouquet categories (Birthday, Anniversary, Graduation, Sympathy)
    const compactOccasions = [
      { id: 'Birthday', name: 'Birthday', desc: 'Bright and cheerful flowers for life\'s happy celebrations' },
      { id: 'Anniversary', name: 'Anniversary', desc: 'Classic roses and romantic arrangements to celebrate lasting love' },
      { id: 'Graduation', name: 'Graduation', desc: 'Sunflowers and vibrant blooms to celebrate accomplishments' },
      { id: 'Sympathy', name: 'Sympathy', desc: 'Gentle white lilies, orchids, and peaceful arrangements' }
    ];

    const occasionsHtml = compactOccasions.map(occ => {
      const data = FLOWER_DATA.occasions.find(o => o.id === occ.id);
      return `
      <div data-reveal data-tilt="9" class="relative">
        <button type="button" onclick="window.appRouter.filterOccasion('${occ.id}')" class="occ-card group relative" aria-label="Shop flowers for ${occ.name}">
          <span class="occ-card-img tilt-pop">${window.UI ? window.UI.renderImage(data ? data.image : '', occ.name, 'w-full h-full object-cover', 'card') : ''}</span>
          <span class="occ-card-text tilt-pop-2">
            <span class="block font-serif font-bold text-xl leading-tight">${occ.name}</span>
            <span class="block text-xs text-rose-100 mt-1">${occ.desc}</span>
            <span class="block text-[11px] font-bold uppercase tracking-wider mt-3 text-white/90">Explore</span>
          </span>
        </button>
      </div>`;
    }).join('');

    return `
      <div class="homepage-canvas relative overflow-x-hidden bg-[#FAF6F0] w-full min-h-screen">
        ${this.renderHomepageDecorations()}

        <div class="homepage-content-layer relative z-10 w-full">
          ${this.renderHero()}

          ${this.renderScrollBands()}

          ${this.renderFlowerRing()}

          <!-- 2. MEET THE OWNER SECTION -->
          <section class="relative overflow-hidden py-14 bg-transparent border-b border-stone-200/60">
            <div class="relative z-10 max-w-4xl mx-auto px-6">
              <div data-reveal class="bg-white/95 rounded-3xl p-6 sm:p-8 border border-rose-100/80 shadow-sm flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                <!-- Owner Portrait / Visual -->
                <div class="w-32 h-32 sm:w-40 sm:h-40 rounded-full border-4 border-white shadow-md shrink-0 bg-gradient-to-br from-rose-100 to-rose-200 flex flex-col items-center justify-center text-rose-900 select-none p-4">
                  <img src="/image/Logo.png" alt="Umaira Florist Atelier" class="w-20 h-20 sm:w-24 sm:h-24 object-contain">
                  <span class="text-[10px] tracking-widest uppercase font-semibold text-rose-700/80 mt-1">Atelier</span>
                </div>

                <!-- Owner Bio -->
                <div class="space-y-2 text-center sm:text-left">
                  <span class="text-xs font-bold text-rose-900 uppercase tracking-widest">Meet the Owner</span>
                  <h3 class="font-serif text-2xl font-bold text-stone-900">Umaira</h3>
                  <p class="text-xs font-semibold text-rose-800 italic">Owner & Founder, Umaira Florist</p>
                  <p class="text-stone-600 text-sm leading-relaxed pt-1">
                    “Welcome to Umaira Florist! What started as a deep love for botanical artistry has grown into our welcoming flower boutique. Every stem is hand-picked with care, and every bouquet is arranged with heart to help you celebrate life’s most precious moments.”
                  </p>
                </div>
              </div>
            </div>
          </section>

          <!-- 3. FEATURED FLOWERS SECTION -->
          <section class="relative overflow-hidden py-16 bg-transparent">
            <div class="relative z-10 max-w-7xl mx-auto px-6">
              <div data-reveal class="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4">
                <div>
                  <span class="text-xs font-bold text-rose-900 uppercase tracking-widest">Popular Blooms</span>
                  <h2 class="font-serif text-3xl font-bold text-stone-900 mt-1">Featured Fresh Flowers</h2>
                </div>
                <button type="button" onclick="window.appRouter.navigate('collections')" class="inline-flex items-center gap-2 py-2 px-5 rounded-xl bg-white/95 border border-stone-300 hover:bg-rose-50 text-stone-900 text-xs font-bold transition-colors shadow-xs">
                  Explore Collections
                </button>
              </div>

              <div data-reveal>${featuredFlowersHtml}</div>
            </div>
          </section>

          <!-- DELIVERY & PICKUP -->
          <section class="py-14 bg-transparent border-t border-stone-200/60">
            <div class="max-w-5xl mx-auto px-6">
              <div data-reveal class="text-center mb-8">
                <span class="text-xs font-bold text-rose-900 uppercase tracking-widest">Delivery & Pickup</span>
                <h2 class="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-1">Delivery: Manila only <span class="text-stone-300 font-normal mx-1">|</span> Pickup: Available at the shop</h2>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div data-reveal data-tilt="6" class="p-6 rounded-3xl border border-stone-200/80 bg-white/90 backdrop-blur-xs space-y-3 shadow-xs">
                  <div class="flex items-center gap-3">
                    <span class="w-10 h-10 rounded-full bg-rose-100 text-rose-900 flex items-center justify-center">
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
                    </span>
                    <h3 class="font-serif font-bold text-stone-900 text-lg">Delivery</h3>
                  </div>
                  <ul class="text-sm text-stone-600 space-y-1.5 leading-relaxed">
                    <li>Available within Manila only.</li>
                    <li>Enter a complete, valid Manila address at checkout.</li>
                    <li>Orders outside Manila cannot be accepted for delivery.</li>
                  </ul>
                </div>

                <div data-reveal data-tilt="6" class="p-6 rounded-3xl border border-stone-200/80 bg-white/90 backdrop-blur-xs space-y-3 shadow-xs">
                  <div class="flex items-center gap-3">
                    <span class="w-10 h-10 rounded-full bg-rose-100 text-rose-900 flex items-center justify-center">
                      <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
                    </span>
                    <h3 class="font-serif font-bold text-stone-900 text-lg">Store Pickup</h3>
                  </div>
                  <ul class="text-sm text-stone-600 space-y-1.5 leading-relaxed">
                    <li><strong class="text-stone-800">Address:</strong> ${SHOP_RULES.info.address}</li>
                    <li><strong class="text-stone-800">Hours:</strong> ${SHOP_RULES.info.hoursText}</li>
                    <li>Choose your pickup date and time at checkout. Your order is prepared and ready before then.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <!-- 4. SHOP BY OCCASION SECTION -->
          <section class="relative overflow-hidden py-16 bg-transparent border-y border-stone-200/60">
            <div class="relative z-10 max-w-7xl mx-auto px-6">
              <div class="text-center max-w-xl mx-auto mb-10">
                <span class="text-xs font-bold text-rose-900 uppercase tracking-widest">Thoughtful Collections</span>
                <h2 class="font-serif text-3xl font-bold text-stone-900 mt-1">Shop by Occasion</h2>
                <p class="text-stone-600 text-xs sm:text-sm mt-1">Find the perfect floral expression for any celebration or quiet gesture.</p>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                ${occasionsHtml}
              </div>
            </div>
          </section>

          <!-- 5. BUILD YOUR BOUQUET HIGHLIGHT -->
          <section class="relative overflow-hidden py-16 bg-transparent">
            <div class="relative z-10 max-w-5xl mx-auto px-6">
              <div data-reveal class="bg-gradient-to-r from-rose-900 via-rose-950 to-stone-900 rounded-3xl p-8 sm:p-12 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
                <div class="space-y-3 max-w-lg text-center md:text-left relative z-10">
                  <span class="inline-block px-3 py-1 rounded-full bg-white/20 text-rose-100 text-xs font-semibold">Custom Atelier Studio</span>
                  <h2 class="font-serif text-3xl sm:text-4xl font-bold leading-tight">Build Your Own Bouquet</h2>
                  <p class="text-rose-100 text-sm leading-relaxed">
                    Choose your flowers, fillers, greenery, wrapping, and ribbon to create a bouquet that's uniquely yours.
                  </p>
                  <div class="pt-2">
                    <button type="button" onclick="window.appRouter.navigate('builder')" data-magnetic class="py-3.5 px-8 rounded-2xl bg-white text-rose-950 hover:bg-rose-100 font-bold text-sm shadow-md">
                      Start Building
                    </button>
                  </div>
                </div>

                <div class="relative shrink-0 w-full md:w-80 h-72 hidden sm:block">
                  <div class="tilt-pop rounded-2xl overflow-hidden border border-white/20 bg-stone-900/80 backdrop-blur-md p-6 flex flex-col justify-between text-white shadow-2xl h-full">
                    <div class="flex items-center justify-between">
                      <span class="text-[10px] font-bold uppercase tracking-widest text-rose-300">Bouquet Studio</span>
                      <span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-200 text-[10px] font-mono">3 Steps</span>
                    </div>
                    <div class="space-y-2 text-center my-auto">
                      <div class="w-12 h-12 mx-auto rounded-full bg-rose-900/60 border border-rose-300/30 flex items-center justify-center text-rose-200">
                        <svg class="w-6 h-6 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                        </svg>
                      </div>
                      <h4 class="font-serif font-bold text-sm text-stone-100">Stem by Stem</h4>
                      <p class="text-[11px] text-stone-400 max-w-[200px] mx-auto">Select focal blooms, greenery, artisan wrapping &amp; ribbon</p>
                    </div>
                    <button type="button" onclick="window.appRouter.navigate('builder')" class="w-full py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition border border-white/20 text-center flex items-center justify-center gap-1.5">
                      <span>Open Studio</span>
                      <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <!-- 6. HOW IT WORKS (Choose → Customize → Schedule → Delivered) -->
          <section class="relative overflow-hidden py-16 bg-transparent">
            <div class="relative z-10 max-w-6xl mx-auto px-6">
              <div data-reveal class="text-center max-w-xl mx-auto mb-12">
                <span class="text-xs font-bold text-rose-900 uppercase tracking-widest">Effortless Experience</span>
                <h2 class="font-serif text-3xl font-bold text-stone-900 mt-1">How It Works</h2>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-center">
                <div data-reveal data-tilt="9" class="p-6 rounded-3xl bg-white/90 border border-stone-200/80 shadow-xs">
                  <h3 class="font-serif font-bold text-stone-900 text-base mb-1">1. Choose</h3>
                  <p class="text-stone-600 text-xs">Browse fresh flowers or pick a special occasion.</p>
                </div>

                <div data-reveal data-tilt="9" class="p-6 rounded-3xl bg-white/90 border border-stone-200/80 shadow-xs">
                  <h3 class="font-serif font-bold text-stone-900 text-base mb-1">2. Customize</h3>
                  <p class="text-stone-600 text-xs">Personalize stems, wraps, ribbons, and gift card.</p>
                </div>

                <div data-reveal data-tilt="9" class="p-6 rounded-3xl bg-white/90 border border-stone-200/80 shadow-xs">
                  <h3 class="font-serif font-bold text-stone-900 text-base mb-1">3. Schedule</h3>
                  <p class="text-stone-600 text-xs">Select your preferred delivery date and time slot.</p>
                </div>

                <div data-reveal data-tilt="9" class="p-6 rounded-3xl bg-white/90 border border-stone-200/80 shadow-xs">
                  <h3 class="font-serif font-bold text-stone-900 text-base mb-1">4. Delivered</h3>
                  <p class="text-stone-600 text-xs">Delivered fresh in climate-controlled dispatch.</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // VIEW 2: FLOWERS / COLLECTIONS CATALOG
  // =========================================================================
  renderCollectionsView() {
    return this.renderFlowersView();
  }

  renderFlowersView() {
    return `
      <div class="py-12 px-6 max-w-7xl mx-auto">
        <!-- Header -->
        <div class="text-center max-w-2xl mx-auto mb-10">
          <span class="text-xs font-bold text-rose-900 uppercase tracking-widest">Botanical Catalog</span>
          <h1 class="font-serif text-3xl sm:text-4xl font-bold text-stone-900 mt-1">Fresh Farm Flower Catalog</h1>
          <p class="text-stone-600 text-sm mt-2">Explore our full selection of sustainably harvested stems, with real-time farm stock indicators.</p>
        </div>

        <!-- Continuously moving flower strip -->
        <div class="mb-8">
          ${this.renderFlowerMarquee(true)}
        </div>

        <!-- Search & Filter Controls -->
        <div class="bg-white p-4 rounded-3xl border border-stone-200 shadow-sm mb-8 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <!-- Search Input -->
            <div class="md:col-span-6 relative">
              <input type="text" id="catalog-search-input" value="${this.catalogSearchQuery}" oninput="window.appRouter.handleCatalogSearch(this.value)" placeholder="Search flowers..." class="w-full pl-10 pr-4 py-2.5 text-sm bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-rose-500 focus:bg-white">
              <span class="absolute left-3.5 top-3.5 text-stone-400"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"></path></svg></span>
            </div>

            <!-- Availability Filter -->
            <div class="md:col-span-6 flex items-center justify-end gap-2 text-xs">
              <span class="text-stone-500 font-medium">Availability:</span>
              <select id="catalog-availability-select" onchange="window.appRouter.setAvailabilityFilter(this.value)" class="py-2 px-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-800 font-medium text-xs focus:ring-2 focus:ring-rose-500">
                <option value="all" ${this.catalogAvailabilityFilter === 'all' ? 'selected' : ''}>All Stems (12)</option>
                <option value="available" ${this.catalogAvailabilityFilter === 'available' ? 'selected' : ''}>Available Only</option>
                <option value="limited" ${this.catalogAvailabilityFilter === 'limited' ? 'selected' : ''}>Limited Stock</option>
                <option value="sold_out" ${this.catalogAvailabilityFilter === 'sold_out' ? 'selected' : ''}>Sold Out</option>
              </select>
            </div>
          </div>

          <div id="flowers-chips" class="space-y-3 border-t border-stone-100 pt-3">${this.renderFlowerChips()}</div>
        </div>

        <div id="flowers-results">${this.renderFlowersResults()}</div>
      </div>
    `;
  }


  renderFlowerChips() {
    const chip = (active) => `px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${active ? 'bg-[#647D69] text-white font-bold shadow-sm' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}`;
    const occasions = [{ id: 'all', name: 'All' }, ...FLOWER_DATA.occasions.map(o => ({ id: o.id, name: o.name }))];
    const occasionChips = occasions.map(o => `
      <button type="button" onclick="window.appRouter.setOccasion('${o.id}')" class="${chip(this.selectedOccasion === o.id)}">${o.name}</button>
    `).join('');

    const categories = ['all', 'Roses', 'Tulips', 'Lilies', 'Sunflowers', 'Hydrangeas', 'Peonies', 'Carnations', 'Orchids'];
    const categoryTabsHtml = categories.map(cat => `
      <button type="button" onclick="window.appRouter.setCatalogCategory('${cat}')" class="px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${this.selectedCatalogCategory === cat ? 'bg-[#647D69] text-white font-bold shadow-sm' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'}">
        ${cat.charAt(0).toUpperCase() + cat.slice(1)}
      </button>
    `).join('');


    return `
      <div class="flex items-center gap-2 overflow-x-auto pb-1">
        <span class="text-xs font-semibold text-stone-500 shrink-0 mr-1">Occasion:</span>
        ${occasionChips}
      </div>
      <div class="flex items-center gap-2 overflow-x-auto pb-1">
        <span class="text-xs font-semibold text-stone-500 shrink-0 mr-1">Category:</span>
        ${categoryTabsHtml}
      </div>
    `;
  }

  renderFlowersResults() {
    let filtered = FLOWER_DATA.mainFlowers.filter(f => {
      // Occasion filter
      if (this.selectedOccasion !== 'all' && !(f.occasions || []).includes(this.selectedOccasion)) {
        return false;
      }
      // Category filter
      if (this.selectedCatalogCategory !== 'all' && f.category.toLowerCase() !== this.selectedCatalogCategory.toLowerCase()) {
        return false;
      }
      // Availability filter
      if (this.catalogAvailabilityFilter !== 'all' && f.availability !== this.catalogAvailabilityFilter) {
        return false;
      }
      // Search filter
      if (this.catalogSearchQuery) {
        const q = this.catalogSearchQuery.toLowerCase();
        const matchName = f.name.toLowerCase().includes(q);
        const matchDesc = f.description.toLowerCase().includes(q);
        const matchCat = f.category.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchCat) return false;
      }
      return true;
    });

    const flowerCardsHtml = filtered.length === 0 ? `
      <div class="col-span-full py-16 text-center bg-white rounded-3xl border border-stone-200">
                <h3 class="font-serif text-lg font-bold text-stone-900">No flowers match your search</h3>
        <p class="text-stone-500 text-xs mt-1">Try resetting your filters or search keywords.</p>
        <button type="button" onclick="window.appRouter.resetCatalogFilters()" class="mt-4 px-4 py-2 bg-[#647D69] text-white font-bold rounded-xl text-xs font-semibold">
          Clear Filters
        </button>
      </div>
    ` : filtered.map(flower => {
      const isUnavailable = flower.availability === 'unavailable';
      const isSoldOut = isUnavailable || flower.availability === 'sold_out' || (flower.stockCount != null && flower.stockCount <= 0);
      const isLimited = !isSoldOut && flower.availability === 'limited';

      let statusBadge = '';
      if (isUnavailable) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-stone-100 text-stone-700">Unavailable</span>`;
      } else if (isSoldOut) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Sold Out</span>`;
      } else if (isLimited) {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Limited (${flower.stockCount} left)</span>`;
      } else {
        statusBadge = `<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Available</span>`;
      }

      return `
        <div data-reveal data-tilt="7" class="group bg-white rounded-3xl p-4 border border-stone-200/80 shadow-floral hover:shadow-floral-lg transition-shadow duration-300 flex flex-col justify-between ${isSoldOut ? 'opacity-70 grayscale-[30%]' : ''}">
          <div>
            <div class="tilt-pop relative w-full h-56 rounded-2xl overflow-hidden mb-4 bg-stone-100 flex items-center justify-center">
              ${window.UI ? window.UI.renderImage(flower.image, flower.name, 'w-full h-full object-cover group-hover:scale-105 transition duration-500', 'card') : ''}
              <div class="absolute top-3 left-3">
                ${statusBadge}
              </div>
              <div class="absolute top-3 right-3 px-3 py-1 bg-white/95 backdrop-blur-md rounded-xl text-xs font-bold text-stone-900 shadow-sm price">
                ${formatCurrency(flower.price)} / stem
              </div>
            </div>
            <div class="flex items-center justify-between mb-1">
              <h3 class="font-serif font-bold text-stone-900 text-lg">${flower.name}</h3>
              <span class="text-xs text-stone-400 font-medium">${flower.category}</span>
            </div>
            <p class="text-xs text-stone-500 italic mb-2">${flower.botanicalName}</p>
            <p class="text-stone-600 text-xs line-clamp-2 mb-3 leading-relaxed">${flower.description}</p>
            <div class="flex items-center gap-4 text-[11px] text-stone-500 mb-4 bg-stone-50 p-2 rounded-xl">
              <span>Stem: ${flower.stemLength}</span>
              <span>Vase life: ${flower.vaseLife}</span>
            </div>
          </div>

          <div class="pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
            <button type="button" onclick="window.appRouter.showFlowerModal('${flower.id}')" class="px-3 py-2 text-xs font-semibold text-stone-700 hover:text-rose-900 hover:bg-rose-50 rounded-xl transition">
              Quick Details
            </button>
            ${isSoldOut ? `
              <button disabled class="px-4 py-2 rounded-xl bg-stone-100 text-stone-400 text-xs font-medium cursor-not-allowed">${isUnavailable ? 'Unavailable' : 'Sold Out'}</button>
            ` : `
              <button type="button" onclick="window.appRouter.addStemToCustomBuilder('${flower.id}')" class="px-4 py-2 rounded-xl bg-[#647D69] text-white font-bold hover:bg-rose-800 text-xs font-semibold shadow-sm transition">
                + Add to Bouquet
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');


    // Ready-made bouquets follow the same occasion filter.
    let bouquets = FLOWER_DATA.featuredBouquets;
    let heading = 'Ready-Made Bouquets';
    if (this.selectedOccasion !== 'all') {
      const activeOcc = FLOWER_DATA.occasions.find(o => o.id === this.selectedOccasion);
      if (activeOcc) {
        bouquets = bouquets.filter(b => b.occasion === activeOcc.name || activeOcc.recommendedBouquetIds.includes(b.id));
        heading = `Ready-Made Bouquets for ${activeOcc.name}`;
      }
    }
    const bouquetSection = bouquets.length === 0 ? '' : `
      <div class="mt-14">
        <div class="mb-6">
          <span class="text-xs font-bold text-rose-900 uppercase tracking-widest">Ready to Order</span>
          <h2 class="font-serif text-2xl font-bold text-stone-900 mt-1">${heading}</h2>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          ${bouquets.map(bq => this.renderBouquetCard(bq)).join('')}
        </div>
      </div>
    `;

    return `
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        ${flowerCardsHtml}
      </div>
      ${bouquetSection}
    `;
  }

  // Only the chips and results are redrawn, so the flower strip keeps moving and the search box keeps focus.
  refreshFlowers() {
    const chips = document.getElementById('flowers-chips');
    const results = document.getElementById('flowers-results');
    if (!chips || !results) { this.renderView('flowers'); return; }
    chips.innerHTML = this.renderFlowerChips();
    results.innerHTML = this.renderFlowersResults();
    if (window.FX) window.FX.refresh();
  }

  setOccasion(occId) {
    this.selectedOccasion = occId;
    this.refreshFlowers();
  }

  setCatalogCategory(cat) {
    this.selectedCatalogCategory = cat;
    this.refreshFlowers();
  }

  handleCatalogSearch(q) {
    this.catalogSearchQuery = q;
    this.refreshFlowers();
  }

  setAvailabilityFilter(filterVal) {
    this.catalogAvailabilityFilter = filterVal;
    this.refreshFlowers();
  }

  resetCatalogFilters() {
    this.selectedCatalogCategory = 'all';
    this.selectedOccasion = 'all';
    this.catalogSearchQuery = '';
    this.catalogAvailabilityFilter = 'all';
    const search = document.getElementById('catalog-search-input');
    const avail = document.getElementById('catalog-availability-select');
    if (search) search.value = '';
    if (avail) avail.value = 'all';
    this.refreshFlowers();
  }

  addStemToCustomBuilder(flowerId) {
    if (appState.isAuthenticated && !appState.isAuthenticated()) {
      appState.setPendingAction({ type: 'add_stem', flowerId });
      this.showCustomerAuthModal('login', 'Please sign in to compose and save your custom bouquet.');
      return;
    }
    const fl = getFlowerById(flowerId);
    if (!fl || fl.availability === 'unavailable' || fl.availability === 'sold_out' || (fl.stockCount != null && fl.stockCount <= 0)) {
      showToast('This flower is currently unavailable for purchase.', 'error');
      return;
    }
    window.builderCtrl.updateMainFlowerQty(flowerId, 1);
    showToast(`Added 1× ${fl.name} to your Custom Bouquet Studio!`, 'success');
    this.navigate('builder');
  }

  // =========================================================================
  // VIEW 3: BUILD YOUR BOUQUET STUDIO
  // =========================================================================
  renderBuilderView() {
    return `
      <div id="builder-steps-container" class="py-10 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
        <!-- Studio Header -->
        <div class="text-center max-w-2xl mx-auto">
          <span class="inline-flex items-center px-4 py-1.5 rounded-full bg-rose-50 border border-rose-200/80 text-[#647D69] text-xs font-bold tracking-wider uppercase mb-2">
            Bespoke Floral Studio
          </span>
          <h1 class="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 tracking-tight" aria-label="Build Your Bouquet">
            <span class="su-typewriter" data-typewriter="Build Your Bouquet">
              <span class="typewriter-ghost" aria-hidden="true">Build Your Bouquet</span>
              <span class="typewriter-visible" aria-hidden="true"><span class="typewriter-text"></span><span class="typewriter-cursor">|</span></span>
            </span>
          </h1>
          <p class="text-stone-600 text-sm sm:text-base mt-2 leading-relaxed">
            Create your own bespoke bouquet by choosing your favorite flowers, fillers, and greenery.
          </p>
        </div>

        <!-- Studio Grid: Left Selection vs Right Sticky Live Visualizer -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <!-- Left Main Selection Area (lg:col-span-7 xl:col-span-8) -->
          <div class="lg:col-span-7 xl:col-span-8 space-y-5">
            <!-- Clean Category Navigation Tabs -->
            <div id="builder-nav-tabs" class="bg-white p-2 rounded-2xl border border-[#E5ECE6] shadow-xs flex items-center gap-1.5 overflow-x-auto">
              <!-- Injected by builderCtrl.renderNavTabs() -->
            </div>

            <!-- Tab Content Area -->
            <div id="builder-tab-content" class="bg-white p-6 sm:p-7 rounded-3xl border border-[#E5ECE6] shadow-floral min-h-[480px]">
              <!-- Injected by builderCtrl.renderCurrentTab() -->
            </div>
          </div>

          <!-- Right Sticky Live Bouquet Summary (lg:col-span-5 xl:col-span-4) -->
          <div id="builder-summary-card" class="lg:col-span-5 xl:col-span-4 sticky top-28 space-y-4">
            <div class="bg-white p-6 rounded-3xl border border-[#E5ECE6] shadow-floral space-y-5">
              <!-- Panel Header -->
              <div class="flex items-center justify-between pb-3 border-b border-stone-100">
                <div>
                  <span class="text-[10px] font-bold uppercase tracking-wider text-[#647D69]">Live Summary</span>
                  <h3 class="font-serif font-bold text-stone-900 text-xl leading-tight">Your Bouquet</h3>
                </div>
                <div class="flex items-center gap-2">
                  <span id="builder-live-stem-count" class="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-100 text-[#647D69] font-sans">0 Stems</span>
                  <button type="button" onclick="window.builderCtrl.resetBuilder()" title="Reset custom bouquet" class="text-xs font-semibold text-stone-400 hover:text-[#647D69] transition-colors">Clear All</button>
                </div>
              </div>

              <!-- Selected Flowers & Breakdown List (Single Source of Truth) -->
              <div id="builder-selected-flowers" class="max-h-[500px] overflow-y-auto pr-1 space-y-4">
                <!-- Injected in real-time by builderCtrl.updateSelectedBouquetPanel() -->
              </div>

              <!-- Total Price & CTA -->
              <div class="pt-4 border-t border-stone-200 space-y-3">
                <div class="flex items-baseline justify-between">
                  <span class="text-xs font-semibold text-stone-500 uppercase tracking-wider">Total Bouquet Price</span>
                  <span id="builder-live-total" class="text-3xl font-bold text-[#647D69] price">₱0</span>
                </div>

                <button type="button" id="builder-checkout-btn" data-testid="builder-checkout-btn" onclick="window.builderCtrl.proceedToCheckout()" class="w-full py-4 px-6 rounded-2xl bg-[#647D69] hover:bg-[#526B57] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-base shadow-lg shadow-[#647D69]/25 transition flex items-center justify-center gap-2">
                  <span>Pick Flowers to Continue</span>
                  <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </button>
                <p class="text-[11px] text-stone-400 text-center">Handcrafted fresh to order by Umaira Florist</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  loadBouquetToBuilder(bouquetId) {
    // Ready-made bouquets are fixed products and cannot be customized.
    showToast('Ready-made bouquets are artisan curated fixed products. Use our Custom Studio to compose a bespoke arrangement.', 'info');
    this.navigate('builder');
  }

  isBouquetAvailable(bq) {
    if (!bq || bq.availability === 'unavailable' || bq.availability === 'sold_out') return false;
    if (bq.stockCount !== undefined && bq.stockCount !== null && bq.stockCount <= 0) return false;
    return true;
  }

  addPreMadeBouquetToCart(bouquetId, qty) {
    const parsedQty = Math.max(1, parseInt(qty, 10) || 1);
    if (appState.isAuthenticated && !appState.isAuthenticated()) {
      appState.setPendingAction({ type: 'add_bouquet', bouquetId, qty: parsedQty });
      this.promptGuestSignIn('Please sign in or create an account to add bouquets to your cart.');
      return;
    }
    const bq = FLOWER_DATA.featuredBouquets.find(b => b.id === bouquetId);
    if (!bq) return;

    if (!this.isBouquetAvailable(bq)) { showToast(`${bq.name} is currently unavailable for purchase.`, 'error'); return; }

    const cartItem = {
      id: bq.id,
      isCustom: false,
      name: bq.name,
      summary: bq.formula || bq.description || '',
      price: bq.price,
      quantity: parsedQty,
      image: bq.image,
      message: (bq.specs && bq.specs.message) || '',
      isUnavailable: false
    };

    const added = appState.addToCart(cartItem);
    if (added && added.ok === false) {
      if (added.capped === 0) showToast(`${bq.name} is currently out of stock.`, 'error');
      else showToast(`Only ${added.capped} available for ${bq.name}. Quantity adjusted.`, 'warning');
    } else {
      showToast(`"${bq.name}" added to cart!`, 'success');
    }
    // Do not redirect to checkout or cart: user stays on page with confirmation message
  }

  buyNowBouquet(bouquetId, qty) {
    const parsedQty = Math.max(1, parseInt(qty, 10) || 1);
    if (appState.isAuthenticated && !appState.isAuthenticated()) {
      appState.setPendingAction({ type: 'buy_now', bouquetId, qty: parsedQty });
      this.promptGuestSignIn('Please sign in or create an account to proceed with purchase.');
      return;
    }
    const bq = FLOWER_DATA.featuredBouquets.find(b => b.id === bouquetId);
    if (!bq) return;

    if (!this.isBouquetAvailable(bq)) {
      showToast(`${bq.name} is currently unavailable for purchase.`, 'error');
      return;
    }

    let maxStock = 999;
    if (window.appState && typeof window.appState.maxQuantityFor === 'function') {
      maxStock = window.appState.maxQuantityFor({ id: bq.id, isCustom: false });
    }
    if (maxStock <= 0) {
      showToast(`${bq.name} is currently out of stock.`, 'error');
      return;
    }
    const finalQty = Math.min(parsedQty, maxStock);

    const buyNowItem = {
      cartItemId: 'buynow_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      id: bq.id,
      isCustom: false,
      name: bq.name,
      summary: bq.formula || bq.description || '',
      price: bq.price,
      quantity: finalQty,
      image: bq.image,
      message: (bq.specs && bq.specs.message) || '',
      isUnavailable: false,
      isBuyNow: true
    };

    this.setBuyNowItem(buyNowItem);
    this.navigate('checkout');
  }

  getBuyNowItem() {
    if (this.buyNowItem) return this.buyNowItem;
    try {
      const stored = sessionStorage.getItem('umaira_buynow');
      if (stored) {
        this.buyNowItem = JSON.parse(stored);
        return this.buyNowItem;
      }
    } catch (_) {}
    return null;
  }

  setBuyNowItem(item) {
    this.buyNowItem = item;
    try {
      if (item) sessionStorage.setItem('umaira_buynow', JSON.stringify(item));
      else sessionStorage.removeItem('umaira_buynow');
    } catch (_) {}
  }

  clearBuyNowItem() {
    this.buyNowItem = null;
    try { sessionStorage.removeItem('umaira_buynow'); } catch (_) {}
  }

  // =========================================================================
  // READY-MADE BOUQUET CARD (shown on the Flowers page)
  // =========================================================================
  renderBouquetCard(bq) {
    const isAvail = this.isBouquetAvailable(bq);
    const isSoldOut = !isAvail;
    const isLimited = !isSoldOut && bq.availability === 'limited';

    let statusBadge = '';
    if (isSoldOut) {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Sold Out</span>';
    } else if (isLimited) {
      statusBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Limited Availability</span>';
    }

    return `
      <div data-reveal data-tilt="7" class="group bg-white rounded-3xl p-5 border border-stone-200/80 shadow-floral hover:shadow-floral-lg transition-shadow duration-300 flex flex-col justify-between ${isSoldOut ? 'opacity-70 grayscale-[25%]' : ''}">
        <div>
          <div class="tilt-pop relative w-full h-64 rounded-2xl overflow-hidden mb-4 bg-stone-100 flex items-center justify-center cursor-pointer" onclick="if(window.suOpenBouquet) window.suOpenBouquet('${bq.id}');">
            ${window.UI ? window.UI.renderImage(bq.image, bq.name, 'w-full h-full object-cover group-hover:scale-105 transition duration-500', 'card') : ''}
            <div class="absolute top-3 left-3 flex flex-col gap-1 items-start">
              <span class="px-3 py-1 bg-rose-900/90 text-white rounded-xl text-xs font-bold shadow-sm">${bq.occasion || 'Celebration'}</span>
              ${statusBadge}
            </div>
            <div class="absolute top-3 right-3 px-3 py-1 bg-white/95 backdrop-blur-md rounded-xl text-xs font-bold text-stone-900 shadow-sm price">
              ${formatCurrency(bq.price)}
            </div>
          </div>
          <h3 class="font-serif font-bold text-stone-900 text-xl mb-1 cursor-pointer hover:text-[#647D69] transition-colors" onclick="if(window.suOpenBouquet) window.suOpenBouquet('${bq.id}');">${bq.name}</h3>
          <p class="text-xs font-semibold text-rose-900 mb-2">${bq.tagline || ''}</p>
          <p class="text-stone-600 text-xs mb-3 leading-relaxed">${bq.description || ''}</p>
          <div class="mb-3">
            <button type="button" onclick="if(window.suOpenBouquet) window.suOpenBouquet('${bq.id}');" class="text-xs font-semibold text-[#647D69] hover:text-[#526B57] hover:underline flex items-center gap-1">
              <span>View Details</span> &rarr;
            </button>
          </div>
        </div>

        <div class="pt-3 border-t border-stone-100">
          ${isSoldOut ? `
            <button disabled class="w-full py-2.5 px-3 rounded-xl bg-stone-100 text-stone-400 text-xs font-bold cursor-not-allowed text-center">
              Sold Out
            </button>
          ` : `
            <div class="grid grid-cols-2 gap-2">
              <button type="button" onclick="window.appRouter.addPreMadeBouquetToCart('${bq.id}')" class="w-full py-2.5 px-2 rounded-xl bg-white hover:bg-[#EBF1EC] text-[#647D69] hover:text-[#526B57] border border-[#647D69] hover:border-[#526B57] font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-1.5 hover:-translate-y-0.5 text-center truncate btn-tactile" title="Add to Cart">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                <span>Add to Cart</span>
              </button>
              <button type="button" onclick="window.appRouter.buyNowBouquet('${bq.id}')" class="w-full py-2.5 px-2 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-xs transition-colors shadow-2xs flex items-center justify-center gap-1.5 hover:-translate-y-0.5 text-center truncate btn-tactile" title="Buy Now">
                <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>Buy Now</span>
              </button>
            </div>
          `}
        </div>
      </div>
    `;
  }

  // Occasion cards on the home page open the Flowers page with that occasion selected.
  filterOccasion(occId) {
    this.selectedOccasion = occId;
    this.navigate('flowers');
  }

  // =========================================================================
  // VIEW 5: ABOUT US — EDITORIAL BRAND STORY & CRAFT
  // =========================================================================
  initFlowerCarousel() {
    const track = document.getElementById('fmc-track');
    const dotsEl = document.getElementById('fmc-dots');
    const root = document.getElementById('fmc-root');
    if (!track || !dotsEl || !root) return;

    const flowers = [
      { img: 'image/Fresh%20Flower/Red%20Rose.jpg',           name: 'Red Rose',              tag: 'Love & Passion',               desc: 'The language of hearts. Red roses speak the words that need no translation — a timeless symbol of romantic love and deep, unwavering desire.' },
      { img: 'image/Fresh%20Flower/Pink%20Rose.jpg',          name: 'Pink Rose',             tag: 'Admiration & Gratitude',       desc: 'A gentle declaration of appreciation. Pink roses say thank you, I cherish you, and you are special — beautifully and sincerely, all at once.' },
      { img: 'image/Fresh%20Flower/White%20Rose.jpg',         name: 'White Rose',            tag: 'Purity & New Beginnings',      desc: 'Quietly powerful in its simplicity. White roses carry sincere intentions, peaceful feelings, and the hopeful promise of beautiful new chapters.' },
      { img: 'image/Fresh%20Flower/Sunflower.jpg',            name: 'Sunflower',             tag: 'Happiness & Loyalty',          desc: 'Always facing the light. Sunflowers radiate unwavering positivity, genuine friendship, and the warm joy of an open and devoted heart.' },
      { img: 'image/Fresh%20Flower/Pink%20Peony.jpg',         name: 'Pink Peony',            tag: 'Romance & Good Fortune',       desc: 'Lush, abundant, and deeply romantic. Peonies celebrate love in full bloom — a beloved choice for weddings, anniversaries, and heartfelt celebrations.' },
      { img: 'image/Fresh%20Flower/Stargazer%20Lily.jpg',     name: 'Stargazer Lily',        tag: 'Passion & Achievement',        desc: 'Reaching ever skyward. Stargazer lilies honor bold ambitions and meaningful milestones — a stunning tribute to passion and personal pride.' },
      { img: 'image/Fresh%20Flower/Pink%20Tulip.jpg',         name: 'Pink Tulip',            tag: 'Affection & Care',             desc: 'Simple and utterly genuine. Tulips express tender affection with quiet warmth — a perfect way to show someone how much they truly mean to you.' },
      { img: 'image/Fresh%20Flower/Hydrangea.jpg',            name: 'Hydrangea',             tag: 'Gratitude & Emotion',          desc: 'Graceful and generous in spirit. Hydrangeas convey sincere appreciation, deep understanding, and the beauty of connections that truly matter.' },
      { img: 'image/Fresh%20Flower/Phalaenopsis%20Orchid.jpg',name: 'Phalaenopsis Orchid',   tag: 'Rare Beauty & Strength',       desc: 'Effortlessly refined and enduring. Orchids represent rare elegance, inner resilience, and a deep love that transcends the ordinary.' },
      { img: 'image/Fresh%20Flower/Pink%20Carnation.jpg',     name: 'Pink Carnation',        tag: "Admiration & Devotion",        desc: "A mother's flower, a friend's gratitude. Pink carnations carry warm admiration and the timeless sweetness of devoted, genuine affection." }
    ];

    let active = 0;
    let cardW = 0;
    let gap = 0;
    let autoTimer = null;

    function getCardMetrics() {
      const vw = root.offsetWidth;
      if (vw >= 1024) {
        cardW = 316; gap = 16;
      } else if (vw >= 640) {
        cardW = 280; gap = 14;
      } else {
        cardW = Math.min(Math.round(vw * 0.74), 272); gap = 12;
      }
      root.style.setProperty('--fmc-card-w', cardW + 'px');
      root.style.setProperty('--fmc-gap', gap + 'px');
    }

    function buildCards() {
      track.innerHTML = flowers.map((f, i) =>
        `<div class="fmc-card" role="listitem" aria-label="${f.name}" data-fmc-idx="${i}">
          <div class="fmc-card-img-wrap">
            <img src="${f.img}" alt="${f.name}" class="fmc-card-img" loading="lazy" draggable="false">
            <div class="fmc-card-img-overlay" aria-hidden="true"></div>
          </div>
          <div class="fmc-card-body">
            <span class="fmc-card-tag">${f.tag}</span>
            <h3 class="fmc-card-name">${f.name}</h3>
            <p class="fmc-card-desc">${f.desc}</p>
          </div>
        </div>`
      ).join('');

      dotsEl.innerHTML = flowers.map((f, i) =>
        `<button class="fmc-dot" role="tab" aria-label="${f.name}" data-fmc-dot="${i}" type="button"></button>`
      ).join('');
    }

    function updateClasses() {
      const cards = track.querySelectorAll('.fmc-card');
      const dots = dotsEl.querySelectorAll('.fmc-dot');
      cards.forEach((c, i) => {
        const diff = i - active;
        c.classList.toggle('is-active', diff === 0);
        c.classList.toggle('is-adjacent', Math.abs(diff) === 1);
        c.setAttribute('aria-hidden', diff !== 0 ? 'true' : 'false');
      });
      dots.forEach((d, i) => d.classList.toggle('is-active', i === active));
    }

    function translateTo(idx, animate = true) {
      active = Math.max(0, Math.min(idx, flowers.length - 1));
      const containerW = root.offsetWidth;
      const totalCard = cardW + gap;
      const offset = -(active * totalCard) + (containerW - cardW) / 2;
      if (!animate) track.style.transition = 'none';
      track.style.transform = `translateX(${offset}px)`;
      if (!animate) {
        track.getBoundingClientRect();
        track.style.transition = '';
      }
      updateClasses();
    }

    function advance(dir) {
      clearAuto();
      let next = active + dir;
      if (next < 0) next = flowers.length - 1;
      if (next >= flowers.length) next = 0;
      translateTo(next);
      scheduleAuto();
    }

    function scheduleAuto() {
      clearAuto();
      autoTimer = setTimeout(() => {
        translateTo((active + 1) % flowers.length);
        scheduleAuto();
      }, 5000);
    }

    function clearAuto() {
      clearTimeout(autoTimer);
      autoTimer = null;
    }

    getCardMetrics();
    buildCards();
    translateTo(0, false);
    scheduleAuto();

    document.getElementById('fmc-prev').addEventListener('click', () => advance(-1));
    document.getElementById('fmc-next').addEventListener('click', () => advance(1));

    track.addEventListener('click', e => {
      const card = e.target.closest('[data-fmc-idx]');
      if (!card) return;
      const idx = parseInt(card.dataset.fmcIdx, 10);
      if (!isNaN(idx) && idx !== active) { clearAuto(); translateTo(idx); scheduleAuto(); }
    });

    dotsEl.addEventListener('click', e => {
      const dot = e.target.closest('[data-fmc-dot]');
      if (!dot) return;
      const idx = parseInt(dot.dataset.fmcDot, 10);
      if (!isNaN(idx)) { clearAuto(); translateTo(idx); scheduleAuto(); }
    });

    // Keyboard nav
    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); advance(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); advance(1); }
    });

    // Touch/swipe
    let touchX = null;
    root.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
    root.addEventListener('touchend', e => {
      if (touchX === null) return;
      const dx = e.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(dx) > 40) advance(dx < 0 ? 1 : -1);
    }, { passive: true });

    // Recalculate on resize
    let resizeTimer;
    const onResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => { getCardMetrics(); translateTo(active, false); }, 150);
    };
    window.addEventListener('resize', onResize, { passive: true });
    // Cleanup on navigation away
    const obs = new MutationObserver(() => {
      if (!document.getElementById('fmc-root')) {
        clearAuto();
        window.removeEventListener('resize', onResize);
        obs.disconnect();
      }
    });
    if (root.parentElement) obs.observe(root.parentElement.parentElement || document.body, { childList: true, subtree: true });
  }

  renderAboutView() {
    return `
      <div class="py-12 sm:py-16 lg:py-24 px-6 max-w-6xl mx-auto space-y-20 lg:space-y-28">

        <!-- SECTION 1: OUR STORY -->
        <section class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div data-reveal class="lg:col-span-7 space-y-6 text-left">
            <div class="about-eyebrow">
              <span class="w-2 h-2 rounded-full bg-[#647D69] animate-pulse"></span>
              <span>Our Story &middot; Umaira Florist</span>
            </div>
            <h1 class="su-typewriter font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 leading-[1.18] relative inline-block" data-typewriter="Every Bloom Has a Story" aria-label="Every Bloom Has a Story">
              <span class="typewriter-ghost" aria-hidden="true">Every Bloom Has a Story</span>
              <span class="typewriter-visible" aria-hidden="true"><span class="typewriter-text"></span><span class="typewriter-cursor">|</span></span>
            </h1>
            <div class="space-y-5 text-stone-600 about-editorial-p">
              <p>
                At Umaira Florist, we believe that flowers have a beautiful way of expressing what words sometimes cannot. Whether it’s love, appreciation, congratulations, or simply a thoughtful gesture, every bouquet carries a story worth sharing.
              </p>
              <p>
                Umaira Florist was created with the idea of making floral gifting more personal and meaningful. We wanted to create a space where people could find thoughtfully arranged flowers and express their feelings through something beautiful.
              </p>
              <p class="border-l-2 border-[#647D69]/40 pl-4 sm:pl-5 italic text-stone-700 bg-rose-50/30 py-2 rounded-r-xl">
                From carefully selected blooms to personalized arrangements, we aim to make every bouquet feel special. Because to us, flowers are not just gifts. They are little reminders of the people, memories, and moments that matter most.
              </p>
            </div>
          </div>
          <div data-reveal class="lg:col-span-5 flex justify-center">
            <div class="relative w-full max-w-md">
              <div class="su-hero-halo" aria-hidden="true" style="inset:-15% -10% -10% -10%;"></div>
              <div class="about-image-frame relative z-10">
                <img src="image/flower_content/login%20screen.jpg" alt="Colorful fresh flower arrangements on display at Umaira Florist" class="w-full h-80 sm:h-96 lg:h-[420px] object-cover object-center transition-transform duration-700 hover:scale-105" loading="lazy">
                <div class="p-4 bg-white/95 backdrop-blur-xs border-t border-[#E5ECE6] flex items-center justify-between text-xs text-[#6E6864]">
                  <span class="font-serif italic font-medium text-stone-800 store-name-val">${this.state.getStoreName()} Atelier</span>
                  <span class="store-address-val">${this.state.getStoreAddress()}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- DELICATE FLORAL DIVIDER -->
        <div class="about-divider" aria-hidden="true">
          <span class="about-divider-glyph">&#10022;</span>
        </div>

        <!-- SECTION 2: WHAT MAKES UMAIRA FLORIST SPECIAL -->
        <section class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div data-reveal class="lg:col-span-5 flex justify-center order-2 lg:order-1">
            <div class="relative w-full max-w-md flex items-center justify-center">
              <div class="su-hero-halo" aria-hidden="true" style="inset:-20% -15% -15% -15%;"></div>
              <div class="relative z-10 w-full flex flex-col items-center">
                <img src="/image/holding%20a%20flower.png" alt="Handcrafted pink rose bouquet at Umaira Florist" class="su-hero-img max-h-[440px] drop-shadow-xl" loading="lazy" style="filter:drop-shadow(0 16px 28px rgba(216,69,124,0.12));">
                <span class="text-[11px] font-serif italic text-[#6E6864] mt-2 block tracking-wider">Conditioned daily &middot; Hand-tied with love</span>
              </div>
            </div>
          </div>
          <div data-reveal class="lg:col-span-7 space-y-6 text-left order-1 lg:order-2">
            <div class="about-eyebrow">
              <span class="w-2 h-2 rounded-full bg-[#647D69]"></span>
              <span>The Art of Floral Gifting</span>
            </div>
            <h2 class="su-typewriter font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 leading-[1.18] relative inline-block" data-typewriter="Thoughtfully Made, Beautifully Given" aria-label="Thoughtfully Made, Beautifully Given">
              <span class="typewriter-ghost" aria-hidden="true">Thoughtfully Made, Beautifully Given</span>
              <span class="typewriter-visible" aria-hidden="true"><span class="typewriter-text"></span><span class="typewriter-cursor">|</span></span>
            </h2>
            <div class="space-y-5 text-stone-600 about-editorial-p">
              <p>
                What makes Umaira Florist special is our focus on creating arrangements that feel <span class="text-[#647D69] font-semibold">personal rather than ordinary</span>. We believe that every customer has a different story to tell, and their flowers should reflect that.
              </p>
              <p>
                Our ready-made collections offer thoughtfully designed bouquets for birthdays, anniversaries, graduations, and other meaningful occasions. For customers who want something more personal, our <strong class="text-stone-900 font-serif font-bold">Build Your Bouquet</strong> experience allows them to choose their preferred flowers, fillers, wrapping materials, ribbons, and greeting cards.
              </p>
              <p>
                We also believe that the smallest details can make the biggest difference. From the combination of colors to the finishing touches, every element contributes to making a bouquet feel memorable and thoughtfully given.
              </p>
            </div>
          </div>
        </section>

        <!-- DELICATE FLORAL DIVIDER -->
        <div class="about-divider" aria-hidden="true">
          <span class="about-divider-glyph">&#10022;</span>
        </div>

        <!-- SECTION 3: THE FOUNDER BEHIND THE BLOOMS -->
        <section class="space-y-10 sm:space-y-12">
          <div data-reveal class="text-center max-w-2xl mx-auto space-y-3">
            <div class="about-eyebrow justify-center">
              <span class="w-2 h-2 rounded-full bg-[#647D69]"></span>
              <span>The Founder Behind the Blooms</span>
            </div>
            <h2 class="su-typewriter font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 leading-[1.18] relative inline-block" data-typewriter="Meet the Heart Behind Umaira Florist Atelier" aria-label="Meet the Heart Behind Umaira Florist Atelier">
              <span class="typewriter-ghost" aria-hidden="true">Meet the Heart Behind Umaira Florist Atelier</span>
              <span class="typewriter-visible" aria-hidden="true"><span class="typewriter-text"></span><span class="typewriter-cursor">|</span></span>
            </h2>
            <p class="text-stone-500 text-sm max-w-lg mx-auto leading-relaxed">
              The creative vision, dedication, and personal care guiding every handcrafted arrangement at our atelier.
            </p>
          </div>

          <div data-reveal data-tilt="1" class="max-w-4xl mx-auto bg-white/95 backdrop-blur-xs p-7 sm:p-10 lg:p-12 rounded-[2.5rem] border border-[#E5ECE6] shadow-sm hover:shadow-floral-lg transition-all duration-500">
            <div class="flex flex-col md:flex-row items-center md:items-start gap-8 lg:gap-11">
              <div class="w-48 sm:w-56 md:w-64 shrink-0">
                <div class="group relative aspect-square rounded-[2rem] overflow-hidden border border-[#E5ECE6] shadow-sm bg-[#FFF9F5] transition-all duration-500 hover:shadow-floral hover:border-[#647D69]/50">
                  <img src="image/flower_content/myprofile.jpg" alt="Angel M. Baldonado - Owner &amp; Founder" class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" loading="lazy" />
                  <div class="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-black/5 pointer-events-none"></div>
                </div>
              </div>
              <div class="flex-1 space-y-4 text-center md:text-left">
                <div class="space-y-1.5">
                  <span class="inline-block text-[11px] uppercase tracking-[0.22em] font-bold text-[#647D69] bg-[#EBF1EC] px-3.5 py-1 rounded-full">
                    Owner &amp; Founder
                  </span>
                  <h3 class="font-serif text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight pt-1">
                    Angel M. Baldonado
                  </h3>
                </div>
                <div class="space-y-3.5 text-stone-600 text-sm sm:text-[15px] leading-relaxed">
                  <p class="about-editorial-p">
                    Angel M. Baldonado is the founder of Umaira Florist Atelier, a floral boutique built on the belief that every flower arrangement tells a meaningful story. With a passion for creativity and thoughtful presentation, Angel envisioned a floral atelier where every bouquet becomes more than just a gift—it becomes a personal expression of love, appreciation, and celebration.
                  </p>
                  <p class="about-editorial-p">
                    Through Umaira Florist Atelier, Angel aims to bring beautiful floral arrangements closer to every customer by combining creativity, attention to detail, and personalized service. Every arrangement reflects the atelier’s commitment to making meaningful moments even more special through the beauty of flowers.
                  </p>
                </div>
                <div class="pt-4 mt-4 border-t border-[#E5ECE6]/80">
                  <blockquote class="relative pl-4 border-l-2 border-[#647D69] text-stone-800 font-serif italic text-sm sm:text-base leading-snug text-left">
                    &ldquo;Every bloom has a story, and every bouquet deserves to make someone feel special.&rdquo;
                  </blockquote>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- DELICATE FLORAL DIVIDER -->
        <div class="about-divider" aria-hidden="true">
          <span class="about-divider-glyph">&#10022;</span>
        </div>

        <!-- SECTION 4: EVERY FLOWER HAS A MEANING (Carousel) -->
        <section class="fmc-section space-y-10" data-reveal>
          <div class="text-center max-w-2xl mx-auto space-y-3">
            <div class="about-eyebrow justify-center">
              <span class="w-2 h-2 rounded-full bg-[#647D69]"></span>
              <span>The Language of Blooms</span>
            </div>
            <h2 class="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 leading-[1.18]">
              Every Flower Has a Meaning.
            </h2>
            <p class="text-stone-500 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
              Flowers carry feelings that words sometimes cannot. Discover the quiet story each bloom tells,
              and find the perfect flower to express what your heart wants to say.
            </p>
          </div>

          <div class="fmc-carousel-wrap" id="fmc-root">
            <div class="fmc-track" id="fmc-track" role="list" aria-label="Flower meanings carousel"></div>
            <button class="fmc-nav fmc-nav-prev" id="fmc-prev" aria-label="Previous flower" type="button">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            </button>
            <button class="fmc-nav fmc-nav-next" id="fmc-next" aria-label="Next flower" type="button">
              <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
            </button>
          </div>

          <div class="fmc-dots" id="fmc-dots" role="tablist" aria-label="Select a flower"></div>
        </section>

        <!-- DELICATE FLORAL DIVIDER -->
        <div class="about-divider" aria-hidden="true">
          <span class="about-divider-glyph">&#10022;</span>
        </div>

        <!-- SECTION 5: CLOSING INVITATION -->
        <section data-reveal class="text-center max-w-3xl mx-auto py-10 space-y-6">
          <div class="space-y-4">
            <h2 class="su-typewriter font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 leading-[1.18] relative inline-block" data-typewriter="Let Flowers Tell Your Story" aria-label="Let Flowers Tell Your Story">
              <span class="typewriter-ghost" aria-hidden="true">Let Flowers Tell Your Story</span>
              <span class="typewriter-visible" aria-hidden="true"><span class="typewriter-text"></span><span class="typewriter-cursor">|</span></span>
            </h2>
            <p class="text-stone-600 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
              Whether you are celebrating a milestone, comforting a loved one, or simply brightening someone’s day, we invite you to explore our handcrafted collections or compose your own bouquet stem by stem.
            </p>
          </div>
          <div class="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button type="button" data-magnetic onclick="window.appRouter.navigate('collections')" class="py-4 px-8 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-base shadow-lg shadow-[#647D69]/25 transition duration-300 hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2">
              <span>Explore Collections</span>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>
            <button type="button" data-magnetic onclick="window.appRouter.navigate('builder')" class="py-4 px-8 rounded-2xl bg-white hover:bg-[#FFF9F5] text-stone-900 border border-stone-300 font-bold text-base shadow-xs transition duration-300 hover:border-[#647D69]/40 hover:-translate-y-0.5 flex items-center gap-2">
              <svg class="w-4 h-4 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
              <span>Build Your Bouquet</span>
            </button>
          </div>
        </section>

      </div>
    `;
  }

  // =========================================================================
  // SHOPEE-STYLE CART SELECTION HELPERS
  // =========================================================================
  pruneSelectedCartItems() {
    if (!this.selectedCartItemIds) this.selectedCartItemIds = new Set();
    const validIds = new Set(
      appState.cart
        .filter(item => appState.isItemAvailable(item))
        .map(item => item.cartItemId)
    );
    for (const id of Array.from(this.selectedCartItemIds)) {
      if (!validIds.has(id)) {
        this.selectedCartItemIds.delete(id);
      }
    }
  }

  isCartItemSelected(cartItemId) {
    return Boolean(this.selectedCartItemIds && this.selectedCartItemIds.has(cartItemId));
  }

  getCheckoutItems() {
    const buyNow = this.getBuyNowItem();
    if (buyNow) {
      if (appState.isItemAvailable(buyNow)) {
        return [buyNow];
      }
      this.clearBuyNowItem();
      return [];
    }
    this.pruneSelectedCartItems();
    return appState.cart.filter(item => this.isCartItemSelected(item.cartItemId) && appState.isItemAvailable(item));
  }

  onCartItemCheckChange(cartItemId, isChecked) {
    if (!this.selectedCartItemIds) this.selectedCartItemIds = new Set();
    if (isChecked) {
      const item = appState.cart.find(i => i.cartItemId === cartItemId);
      if (item && appState.isItemAvailable(item)) {
        this.selectedCartItemIds.add(cartItemId);
      }
    } else {
      this.selectedCartItemIds.delete(cartItemId);
    }
    this.updateCartLiveUI();
  }

  toggleSelectAllCartItems(isChecked) {
    if (!this.selectedCartItemIds) this.selectedCartItemIds = new Set();
    if (isChecked) {
      appState.cart.forEach(item => {
        if (appState.isItemAvailable(item)) {
          this.selectedCartItemIds.add(item.cartItemId);
        }
      });
    } else {
      this.selectedCartItemIds.clear();
    }
    this.updateCartLiveUI();
  }

  updateCartLiveUI() {
    if (this.currentView !== 'cart') return;
    this.pruneSelectedCartItems();

    const availableItems = appState.cart.filter(item => appState.isItemAvailable(item));
    const selectedAvailCount = availableItems.filter(item => this.isCartItemSelected(item.cartItemId)).length;

    // 1. Update Select All checkbox
    const selectAllChk = document.getElementById('cart-select-all');
    if (selectAllChk) {
      if (availableItems.length === 0) {
        selectAllChk.checked = false;
        selectAllChk.indeterminate = false;
        selectAllChk.disabled = true;
      } else if (selectedAvailCount === 0) {
        selectAllChk.checked = false;
        selectAllChk.indeterminate = false;
        selectAllChk.disabled = false;
      } else if (selectedAvailCount === availableItems.length) {
        selectAllChk.checked = true;
        selectAllChk.indeterminate = false;
        selectAllChk.disabled = false;
      } else {
        selectAllChk.checked = false;
        selectAllChk.indeterminate = true;
        selectAllChk.disabled = false;
      }
    }

    // 2. Update item cards and checkboxes
    appState.cart.forEach(item => {
      const chk = document.getElementById(`cart-item-chk-${item.cartItemId}`);
      const card = document.getElementById(`cart-card-${item.cartItemId}`);
      const isAvail = appState.isItemAvailable(item);
      const isSelected = this.isCartItemSelected(item.cartItemId) && isAvail;

      if (chk) {
        chk.checked = isSelected;
        chk.disabled = !isAvail;
      }

      if (card) {
        if (!isAvail) {
          card.className = "p-5 sm:p-6 rounded-3xl border border-red-200 bg-red-50/20 shadow-soft transition-all duration-300 flex flex-col sm:flex-row gap-4 sm:gap-5 items-start sm:items-center justify-between";
        } else if (isSelected) {
          card.className = "p-5 sm:p-6 rounded-3xl border border-[#E5ECE6] bg-[#FFF9F5] shadow-soft hover:shadow-floral transition-all duration-300 flex flex-col sm:flex-row gap-4 sm:gap-5 items-start sm:items-center justify-between ring-1 ring-[#E5ECE6]/60";
        } else {
          card.className = "p-5 sm:p-6 rounded-3xl border border-[#E5ECE6] bg-white shadow-soft hover:shadow-floral transition-all duration-300 flex flex-col sm:flex-row gap-4 sm:gap-5 items-start sm:items-center justify-between";
        }
      }
    });

    // 3. Dynamic Price Summary calculation (selected items only)
    const checkoutItems = this.getCheckoutItems();
    const totalQty = checkoutItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    const subtotal = checkoutItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    const threshold = appState.getFreeDeliveryThreshold();
    const fee = totalQty > 0 ? appState.getDeliveryFee(subtotal, 'delivery') : 0;
    const total = subtotal + fee;

    const countEl = document.getElementById('cart-selected-count');
    if (countEl) countEl.textContent = totalQty;

    const subtotalEl = document.getElementById('cart-selected-subtotal');
    if (subtotalEl) subtotalEl.textContent = formatCurrency(subtotal);

    const deliveryEl = document.getElementById('cart-selected-delivery');
    if (deliveryEl) {
      if (totalQty === 0) {
        deliveryEl.textContent = '—';
      } else if (fee === 0) {
        deliveryEl.innerHTML = '<span class="text-emerald-700 font-bold">FREE</span>';
      } else {
        deliveryEl.textContent = formatCurrency(fee);
      }
    }

    const hintEl = document.getElementById('cart-free-delivery-hint');
    if (hintEl) {
      if (totalQty > 0 && fee > 0) {
        hintEl.innerHTML = `<p class="text-[11px] text-[#647D69] bg-rose-50/80 p-2.5 rounded-2xl border border-rose-200">Add ${formatCurrency(threshold - subtotal)} more for <strong>FREE Delivery</strong>!</p>`;
        hintEl.classList.remove('hidden');
      } else {
        hintEl.innerHTML = '';
        hintEl.classList.add('hidden');
      }
    }

    const totalEl = document.getElementById('cart-selected-total');
    if (totalEl) totalEl.textContent = formatCurrency(total);

    // 4. Dynamic Checkout Button
    const btn = document.getElementById('cart-buy-now-btn');
    if (btn) {
      if (totalQty === 0) {
        btn.disabled = true;
        btn.className = "w-full py-4 rounded-2xl bg-stone-200 text-stone-400 cursor-not-allowed font-bold text-base transition-all flex items-center justify-center gap-2";
        btn.innerHTML = `<span>Select Items to Checkout</span>`;
      } else {
        btn.disabled = false;
        btn.className = "w-full py-4 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white shadow-lg shadow-[#647D69]/25 hover:shadow-xl hover:-translate-y-0.5 font-bold text-base transition-all flex items-center justify-center gap-2";
        const itemLabel = totalQty === 1 ? '1 Item' : `${totalQty} Items`;
        btn.innerHTML = `<span>Checkout (${itemLabel})</span><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
      }
    }
  }

  // =========================================================================
  // VIEW 6: SHOPPING CART
  // =========================================================================
  renderCartView() {
    const items = appState.cart;

    if (items.length === 0) {
      return `
        <div class="py-24 px-6 max-w-xl mx-auto text-center space-y-6">
          <div class="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#FFF9F5] to-[#EBF1EC]/40 border border-[#E5ECE6] text-[#647D69] flex items-center justify-center mx-auto shadow-sm">
            <svg class="w-10 h-10 stroke-[1.3]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 21V11m0 0C10.5 8 7 7 7 3c3.5 0 4.5 3.5 5 8zm0 0c1.5-3 5-4 5-8-3.5 0-4.5 3.5-5 8zm0 4c-2-1.5-4-1-5 1 2 0 4 .5 5-1zm0 3c2-1.5 4-1 5 1-2 0-4 .5-5-1z"/>
            </svg>
          </div>
          <div class="space-y-2">
            <span class="text-xs font-bold text-[#647D69] uppercase tracking-widest">Your Cart Awaits</span>
            <h1 class="font-serif text-3xl sm:text-4xl font-bold text-stone-900">Your Basket is Currently Empty</h1>
            <p class="text-stone-600 text-sm sm:text-base leading-relaxed max-w-md mx-auto">
              You haven't selected any fresh flowers or bouquets yet. Explore our curated collections or compose a bespoke bouquet in our studio!
            </p>
          </div>
          <div class="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button type="button" onclick="window.appRouter.navigate('collections')" class="w-full sm:w-auto py-3.5 px-8 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-sm shadow-md shadow-[#647D69]/20 hover:shadow-lg hover:-translate-y-0.5 transition-all">
              Explore Collections
            </button>
            <button type="button" onclick="window.appRouter.navigate('builder')" class="w-full sm:w-auto py-3.5 px-8 rounded-2xl bg-white hover:bg-[#FFF9F5] border border-[#E5ECE6] text-stone-800 font-semibold text-sm shadow-xs hover:border-[#647D69]/40 transition-all">
              Design Bespoke Bouquet
            </button>
          </div>
        </div>
      `;
    }

    this.pruneSelectedCartItems();
    const availableItems = items.filter(item => appState.isItemAvailable(item));
    const hasUnavailable = appState.hasUnavailableItems();
    const checkoutItems = this.getCheckoutItems();
    const selectedTotalQty = checkoutItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
    const selectedSubtotal = checkoutItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    // Same Shop Settings values as updateCartLiveUI(), checkout and the server (no hard-coded fee/threshold).
    const freeThreshold = appState.getFreeDeliveryThreshold();
    const selectedFee = selectedTotalQty > 0 ? appState.getDeliveryFee(selectedSubtotal, 'delivery') : 0;
    const selectedTotal = selectedSubtotal + selectedFee;

    const itemsHtml = items.map(item => {
      const isAvail = appState.isItemAvailable(item);
      const isSelected = this.isCartItemSelected(item.cartItemId) && isAvail;
      const isCustom = Boolean(item.isCustom);
      const typeBadge = isCustom
        ? '<span class="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold uppercase tracking-wider">Customized</span>'
        : '<span class="px-2.5 py-0.5 rounded-full bg-rose-100 text-[#647D69] text-[10px] font-bold uppercase tracking-wider">Ready-Made</span>';
      const availBadge = isAvail
        ? ''
        : '<span class="px-2.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold uppercase tracking-wider">Out of Stock</span>';

      return `
      <div id="cart-card-${item.cartItemId}" class="p-5 sm:p-6 rounded-3xl border ${!isAvail ? 'border-red-200 bg-red-50/20' : isSelected ? 'border-[#E5ECE6] bg-[#FFF9F5] ring-1 ring-[#E5ECE6]/60' : 'border-[#E5ECE6] bg-white'} shadow-soft hover:shadow-floral transition-all duration-300 flex flex-col sm:flex-row gap-4 sm:gap-5 items-start sm:items-center justify-between">
        <div class="flex items-start sm:items-center gap-3 sm:gap-4 flex-1 w-full">
          <!-- Item Checkbox -->
          <div class="pt-1 sm:pt-0 shrink-0">
            <input type="checkbox" id="cart-item-chk-${item.cartItemId}" data-cart-id="${item.cartItemId}" onchange="window.appRouter.onCartItemCheckChange('${item.cartItemId}', this.checked)" ${isSelected ? 'checked' : ''} ${!isAvail ? 'disabled' : ''} class="w-5 h-5 rounded-md text-[#647D69] border-[#E5ECE6] focus:ring-[#647D69] accent-[#647D69] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40" aria-label="Select ${item.name}">
          </div>

          <!-- Thumbnail -->
          <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden border border-[#E5ECE6] shrink-0 bg-stone-100 flex items-center justify-center shadow-xs relative">
            ${window.UI ? window.UI.renderImage(item.image, item.name, 'w-full h-full object-cover', 'thumb') : ''}
            ${!isAvail ? '<div class="absolute inset-0 bg-stone-900/40 backdrop-blur-[1px] flex items-center justify-center text-white text-[9px] font-bold uppercase tracking-wider">Out of Stock</div>' : ''}
          </div>

          <!-- Details -->
          <div class="space-y-1 flex-1 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h3 class="font-serif font-bold text-stone-900 text-base sm:text-lg">${item.name}</h3>
              ${typeBadge}
              ${availBadge}
            </div>
            <p class="text-xs text-stone-600 line-clamp-2 max-w-md">${item.summary || ''}</p>
            ${item.message ? `<p class="text-xs italic text-[#647D69] font-serif">Personal Card: &ldquo;${item.message}&rdquo;</p>` : ''}
            ${!isAvail ? `<p class="text-[11px] font-semibold text-red-600 mt-1">This bouquet or one of its stems is currently unavailable and cannot be selected for checkout.</p>` : ''}

            ${isCustom ? `
              <div class="pt-1.5">
                <button type="button" onclick="window.appRouter.showCustomizationDetails('${item.cartItemId}')" class="inline-flex items-center gap-1.5 py-1 px-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 text-xs font-bold border border-purple-200/80 transition shadow-2xs">
                  <svg class="w-3.5 h-3.5 text-purple-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>
                  <span>View Customization Details</span>
                </button>
              </div>
            ` : ''}
          </div>
        </div>

        <div class="flex items-center justify-between sm:justify-end gap-5 sm:gap-6 w-full sm:w-auto border-t border-stone-100 sm:border-t-0 pt-3 sm:pt-0">
          <!-- Soft UI Quantity Stepper -->
          <div class="flex items-center gap-2 bg-[#FFF9F5] p-1.5 rounded-2xl border border-[#E5ECE6] shadow-2xs">
            <button type="button" onclick="window.appRouter.changeCartQty('${item.cartItemId}', ${item.quantity - 1})" class="w-8 h-8 flex items-center justify-center rounded-xl bg-white text-stone-800 hover:bg-rose-50 hover:text-[#647D69] font-bold transition text-xs shadow-xs border border-stone-100" aria-label="Decrease quantity">−</button>
            <span class="w-7 text-center font-bold text-stone-900 text-xs">${item.quantity}</span>
            <button type="button" onclick="window.appRouter.changeCartQty('${item.cartItemId}', ${item.quantity + 1})" class="w-8 h-8 flex items-center justify-center rounded-xl bg-[#647D69] text-white font-bold hover:bg-[#526B57] transition text-xs shadow-xs" aria-label="Increase quantity">+</button>
          </div>

          <div class="text-right">
            <span class="font-bold text-stone-900 text-base sm:text-lg block price">${formatCurrency(item.price * item.quantity)}</span>
            <span class="text-[11px] text-stone-400 font-mono">${formatCurrency(item.price)} each</span>
          </div>

          <button type="button" onclick="window.appRouter.removeCartItem('${item.cartItemId}');" class="text-stone-400 hover:text-rose-600 transition p-2 text-xs font-semibold flex items-center gap-1" title="Remove item">
            <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            <span>Remove</span>
          </button>
        </div>
      </div>
      `;
    }).join('');

    const allChecked = availableItems.length > 0 && checkoutItems.length === availableItems.length;

    return `
      <div class="py-12 px-6 max-w-6xl mx-auto space-y-8">
        <div>
          <span class="text-xs font-bold text-[#647D69] uppercase tracking-widest">Order Summary</span>
          <h1 class="font-serif text-3xl sm:text-4xl font-bold text-stone-900 mt-1">Your Shopping Cart (${appState.getCartCount()} item${appState.getCartCount() !== 1 ? 's' : ''})</h1>
        </div>

        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <!-- Cart Items List -->
          <div class="lg:col-span-8 space-y-4">
            <!-- Select All Header Bar -->
            <div class="bg-white p-4 rounded-2xl border border-[#E5ECE6] shadow-2xs flex items-center justify-between gap-4">
              <label class="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" id="cart-select-all" onchange="window.appRouter.toggleSelectAllCartItems(this.checked)" ${allChecked ? 'checked' : ''} ${availableItems.length === 0 ? 'disabled' : ''} class="w-5 h-5 rounded-md text-[#647D69] border-[#E5ECE6] focus:ring-[#647D69] accent-[#647D69] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                <span class="text-sm font-bold text-stone-800">Select All (${availableItems.length} available bouquet${availableItems.length !== 1 ? 's' : ''})</span>
              </label>
              <button type="button" onclick="window.appRouter.clearCartWithUndo();" class="text-xs font-semibold text-stone-400 hover:text-rose-600 transition">
                Clear All Items
              </button>
            </div>

            ${itemsHtml}

            <div class="pt-4 flex items-center justify-between">
              <button type="button" onclick="window.appRouter.navigate('collections')" class="text-xs font-bold text-[#647D69] hover:underline flex items-center gap-1.5">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>
                <span>Continue Shopping</span>
              </button>
            </div>
          </div>

          <!-- Checkout Summary Sidebar (Dynamic Shopee-Style) -->
          <div class="lg:col-span-4 bg-white/95 backdrop-blur-md p-6 sm:p-7 rounded-3xl border border-[#E5ECE6] shadow-floral space-y-5 sticky top-24">
            <h3 class="font-serif font-bold text-stone-900 text-lg border-b border-stone-100 pb-3">Price Summary</h3>
            
            <div class="space-y-3 text-sm">
              <div class="flex items-center justify-between text-stone-600">
                <span>Selected Items</span>
                <span id="cart-selected-count" class="font-mono font-semibold text-stone-900">${selectedTotalQty}</span>
              </div>
              <div class="flex items-center justify-between text-stone-600">
                <span>Subtotal</span>
                <span id="cart-selected-subtotal" class="font-mono font-semibold text-stone-900">${formatCurrency(selectedSubtotal)}</span>
              </div>
              <div class="flex items-center justify-between text-stone-600">
                <span>Delivery Fee (Manila)</span>
                <span id="cart-selected-delivery" class="font-mono font-semibold text-stone-900">${selectedTotalQty === 0 ? '—' : (selectedFee === 0 ? '<span class="text-emerald-700 font-bold">FREE</span>' : formatCurrency(selectedFee))}</span>
              </div>
              <div id="cart-free-delivery-hint" class="${(selectedTotalQty > 0 && selectedFee > 0) ? '' : 'hidden'}">
                ${(selectedTotalQty > 0 && selectedFee > 0) ? `<p class="text-[11px] text-[#647D69] bg-rose-50/80 p-2.5 rounded-2xl border border-rose-200">Add ${formatCurrency(freeThreshold - selectedSubtotal)} more for <strong>FREE Delivery</strong>!</p>` : ''}
              </div>
              
              <div class="border-t border-stone-200 pt-3 flex items-center justify-between text-base font-bold text-stone-900">
                <span class="font-semibold text-base text-stone-900">Total Due:</span>
                <span id="cart-selected-total" class="font-bold text-2xl text-[#647D69] price">${formatCurrency(selectedTotal)}</span>
              </div>
            </div>

            ${hasUnavailable ? `
              <div class="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                <p class="font-bold flex items-center gap-1.5 text-amber-900">
                  <svg class="w-4 h-4 text-amber-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                  <span>Unavailable Item(s) in Cart</span>
                </p>
                <p class="leading-relaxed">Out of stock bouquets are disabled and cannot be selected for checkout.</p>
              </div>
            ` : ''}

            <!-- Shopee-Style Dynamic Checkout Button (Buy Now replacement) -->
            <button type="button" id="cart-buy-now-btn" data-testid="cart-checkout-btn" onclick="window.appRouter.proceedToBuyNow()" ${selectedTotalQty === 0 ? 'disabled' : ''} class="w-full py-4 rounded-2xl ${selectedTotalQty === 0 ? 'bg-stone-200 text-stone-400 cursor-not-allowed' : 'bg-[#647D69] hover:bg-[#526B57] text-white shadow-lg shadow-[#647D69]/25 hover:shadow-xl hover:-translate-y-0.5'} font-bold text-base transition-all flex items-center justify-center gap-2">
              <span>${selectedTotalQty === 0 ? 'Select Items to Checkout' : `Checkout (${selectedTotalQty === 1 ? '1 Item' : `${selectedTotalQty} Items`})`}</span>
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </button>
            <!-- <span>Buy Now</span> -->

            <div class="text-center text-[11px] text-stone-400 space-y-1 pt-1">
              <p>Protected checkout &bull; Manila Delivery &bull; Free Store Pickup</p>
              <p>Unselected bouquets remain safely saved in your cart</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  proceedToCheckout() {
    this.proceedToCheckoutSelected();
  }

  proceedToBuyNow() {
    this.proceedToCheckoutSelected();
  }

  proceedToCheckoutSelected() {
    this.pruneSelectedCartItems();
    const selectedItems = this.getCheckoutItems();

    if (!selectedItems.length) {
      showToast('Please select at least one available bouquet to checkout.', 'info');
      return;
    }

    if (!appState.isAuthenticated()) {
      appState.setPendingAction({ type: 'navigate', target: 'checkout' });
      this.promptGuestSignIn('Please sign in or create an account to proceed with checkout.');
      return;
    }

    // Revalidate live catalog and inventory
    const notes = appState.reconcileCart();
    this.pruneSelectedCartItems();
    const activeSelected = this.getCheckoutItems();
    if (!activeSelected.length) {
      showToast('Selected bouquets are currently unavailable.', 'error');
      this.renderView('cart');
      return;
    }

    if (notes && notes.length) {
      showToast('Your cart was updated with latest pricing and availability.', 'info');
    }
    this.navigate('checkout');
  }

  showCustomizationDetails(cartItemId) {
    const item = appState.cart.find(c => c.cartItemId === cartItemId);
    if (!item || !item.specs) {
      showToast('No customization details found for this bouquet.', 'info');
      return;
    }

    const s = item.specs;
    const flowers = (s.mainFlowers || []).map(f => {
      const fl = getFlowerById(f.id);
      return `
        <li class="flex items-center justify-between text-xs py-1 border-b border-stone-100">
          <span class="font-medium text-stone-800">${f.quantity}× ${fl ? fl.name : f.name || f.id}</span>
          <span class="font-mono text-stone-500">${formatCurrency((fl ? fl.price : f.price || 0) * f.quantity)}</span>
        </li>
      `;
    }).join('');

    const fillers = (s.fillers || []).map(f => {
      const fil = getFillerById(f.id) || getGreeneryById(f.id);
      return `
        <li class="flex items-center justify-between text-xs py-1 border-b border-stone-100">
          <span class="font-medium text-stone-800">${f.quantity || 1}× ${fil ? fil.name : f.name || f.id}</span>
          <span class="font-mono text-stone-500">${formatCurrency((fil ? fil.price : f.price || 0) * (f.quantity || 1))}</span>
        </li>
      `;
    }).join('');

    const wrappings = (s.wrappings || []).map(w => {
      return `
        <li class="flex items-center justify-between text-xs py-1 border-b border-stone-100">
          <span class="font-medium text-stone-800">${w.name || w.id} ${w.color ? `(${w.color})` : ''}</span>
          <span class="font-mono text-stone-500">${formatCurrency(((getWrappingById(w.id) || w).price) || 0)}</span>
        </li>
      `;
    }).join('');

    const ribbons = (s.ribbons || []).map(r => {
      return `
        <li class="flex items-center justify-between text-xs py-1 border-b border-stone-100">
          <span class="font-medium text-stone-800">${r.name || r.id} ${r.color ? `(${r.color})` : ''}</span>
          <span class="font-mono text-stone-500">${formatCurrency(((getRibbonById(r.id) || r).price) || 0)}</span>
        </li>
      `;
    }).join('');

    const cardDesign = s.cardDesign ? getCardDesignById(s.cardDesign) : null;
    const cardText = s.cardMessage || item.message || '';

    let modal = document.getElementById('customization-details-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'customization-details-modal';
      modal.className = 'fixed inset-0 z-50 bg-[#302C2A]/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-fade-in';
      modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div class="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full shadow-floral border border-stone-200 space-y-4 max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
        <div class="flex items-start justify-between border-b border-stone-100 pb-3">
          <div>
            <span class="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-bold uppercase tracking-wider">Customized Bouquet</span>
            <h3 class="font-serif font-bold text-stone-900 text-xl mt-1">${item.name}</h3>
            <p class="text-xs text-stone-500">Calculated Total: <strong class="text-[#647D69]">${formatCurrency(item.price)}</strong></p>
          </div>
          <button type="button" onclick="document.getElementById('customization-details-modal').remove()" class="w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition" aria-label="Close details"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
        </div>

        <div class="space-y-4 divide-y divide-stone-100 text-stone-700">
          <div>
            <h4 class="text-xs font-bold text-[#647D69] uppercase tracking-wider mb-2">Step 1 — Fresh Flowers</h4>
            <ul class="space-y-0.5">${flowers || '<li class="text-xs text-stone-400">None selected</li>'}</ul>
          </div>

          <div class="pt-3">
            <h4 class="text-xs font-bold text-[#647D69] uppercase tracking-wider mb-2">Step 2 — Fillers &amp; Greenery</h4>
            <ul class="space-y-0.5">${fillers || '<li class="text-xs text-stone-400">None selected</li>'}</ul>
          </div>

          <div class="pt-3">
            <h4 class="text-xs font-bold text-[#647D69] uppercase tracking-wider mb-2">Step 3 — Wrapping Material</h4>
            <ul class="space-y-0.5">${wrappings || '<li class="text-xs text-stone-400">Korean Matte Paper</li>'}</ul>
          </div>

          <div class="pt-3">
            <h4 class="text-xs font-bold text-[#647D69] uppercase tracking-wider mb-2">Step 4 — Ribbon &amp; Accent</h4>
            <ul class="space-y-0.5">${ribbons || '<li class="text-xs text-stone-400">Satin Ribbon</li>'}</ul>
          </div>

          <div class="pt-3">
            <h4 class="text-xs font-bold text-[#647D69] uppercase tracking-wider mb-1">Step 5 — Greeting Card &amp; Message</h4>
            <p class="text-xs font-medium text-stone-800">${cardDesign ? cardDesign.name : 'Artisanal Card'}</p>
            ${cardText ? `
              <div class="mt-2 p-3 rounded-xl bg-rose-50/70 border border-rose-100 text-xs text-stone-700 italic font-serif leading-relaxed">
                &ldquo;${cardText}&rdquo;
              </div>
            ` : '<p class="text-xs text-stone-400 italic">No message provided</p>'}
          </div>
        </div>

        <div class="pt-3 border-t border-stone-100">
          <button type="button" onclick="document.getElementById('customization-details-modal').remove()" class="w-full py-3 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs transition">
            Close Summary
          </button>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // VIEW 7: CHECKOUT
  // =========================================================================
  renderCheckoutView() {
    this.pruneSelectedCartItems();
    const checkoutItems = this.getCheckoutItems();
    if (!checkoutItems.length) {
      setTimeout(() => {
        if (this.currentView === 'checkout') {
          showToast('Please select at least one available bouquet from your cart to checkout.', 'info');
          this.navigate('cart');
        }
      }, 0);
      return `
        <div class="py-24 px-6 max-w-md mx-auto text-center space-y-4">
          <h2 class="font-serif text-2xl font-bold text-stone-900">No Items Selected for Checkout</h2>
          <p class="text-sm text-stone-600">Please choose which bouquets you wish to purchase from your cart.</p>
          <button type="button" onclick="window.appRouter.navigate('cart')" class="py-3 px-6 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-sm shadow-md">
            Return to Shopping Cart
          </button>
        </div>
      `;
    }

    const subtotal = checkoutItems.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    this.checkoutFulfillment = 'delivery';
    const info = SHOP_RULES.info;

    const inputCls = 'w-full p-3.5 bg-white border border-[#E5ECE6] rounded-2xl text-sm text-stone-800 placeholder-stone-400 focus:ring-2 focus:ring-[#647D69] focus:border-[#647D69] transition-all shadow-xs';
    const err = (f) => `<p id="chk-err-${f}" class="text-[11px] text-red-600 mt-1 hidden"></p>`;
    const stepBadge = (n) => `<span class="w-7 h-7 rounded-full bg-rose-100 text-[#647D69] text-xs flex items-center justify-center font-serif font-bold shadow-2xs">${n}</span>`;

    return `
      <div class="py-12 px-6 max-w-6xl mx-auto space-y-8">
        <div>
          <span class="text-xs font-bold text-[#647D69] uppercase tracking-widest">Secure Checkout</span>
          <h1 class="font-serif text-3xl sm:text-4xl font-bold text-stone-900 mt-1">Complete Your Order</h1>
          <p class="text-sm text-stone-500 mt-1">We only ask for the details required to prepare and handcraft your order. You can follow it anytime from My Account.</p>
        </div>

        <!-- Shop Status Banner (Closed Reminder or Ordering Disabled) -->
        <div id="chk-shop-status-banner" class="hidden"></div>

        <form id="checkout-form" novalidate onsubmit="window.appRouter.handlePlaceOrder(event)" class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div class="lg:col-span-8 space-y-6">

            <!-- 1. Delivery or pickup -->
            <div class="bg-white p-6 sm:p-7 rounded-3xl border border-[#E5ECE6] shadow-xs space-y-4">
              <h3 class="font-serif font-bold text-stone-900 text-lg flex items-center gap-2">${stepBadge(1)} How would you like to receive your order?</h3>
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label id="chk-opt-delivery" class="flex flex-col p-4 sm:p-5 rounded-2xl border-2 border-[#647D69] bg-gradient-to-br from-[#FFF9F5] to-[#FCE7F0]/40 shadow-xs cursor-pointer transition-all">
                  <input type="radio" name="fulfillment" value="delivery" checked onchange="window.appRouter.setFulfillment('delivery')" class="text-[#647D69] focus:ring-[#647D69] accent-[#647D69] mb-2">
                  <span class="font-bold text-stone-900 text-sm">Delivery</span>
                  <span class="text-xs text-stone-500 mt-0.5" id="chk-opt-delivery-sub">Within Manila only</span>
                </label>
                <label id="chk-opt-pickup" class="flex flex-col p-4 sm:p-5 rounded-2xl border border-[#E5ECE6] bg-white hover:border-[#647D69]/40 hover:bg-[#FFF9F5]/50 cursor-pointer transition-all">
                  <input type="radio" name="fulfillment" value="pickup" onchange="window.appRouter.setFulfillment('pickup')" class="text-[#647D69] focus:ring-[#647D69] accent-[#647D69] mb-2">
                  <span class="font-bold text-stone-900 text-sm">Store Pickup</span>
                  <span class="text-xs text-stone-500 mt-0.5">Collect at our shop, no delivery fee</span>
                </label>
              </div>
              <div id="chk-pickup-banner" class="hidden p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-xs text-emerald-900 space-y-1">
                <p class="font-bold text-sm">You selected Store Pickup. Your order will not be delivered.</p>
                <p><strong>Pick up at:</strong> <span class="store-name-val">${info.name}</span>, <span class="store-address-val">${appState.pickupSettings?.address || info.address}</span></p>
                <p><strong>Pickup hours:</strong> <span id="chk-pickup-hours-text">${info.hoursText}</span></p>
                <p>Your order will be prepared and ready before the pickup time you choose.</p>
              </div>
              <div id="chk-delivery-note" class="p-3 rounded-2xl bg-stone-50 border border-stone-200 text-xs text-stone-600">
                Delivery is available within Manila only. Please enter a complete Manila address below.
              </div>
            </div>

            <!-- 2. Customer details -->
            <div class="bg-white p-6 sm:p-7 rounded-3xl border border-[#E5ECE6] shadow-xs space-y-4">
              <h3 class="font-serif font-bold text-stone-900 text-lg flex items-center gap-2">${stepBadge(2)} Your Details</h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-stone-600 mb-1" for="chk-first-name">First Name *</label>
                  <input type="text" id="chk-first-name" autocomplete="given-name" value="" class="${inputCls}">
                  ${err('firstName')}
                </div>
                <div>
                  <label class="block text-xs font-semibold text-stone-600 mb-1" for="chk-last-name">Last Name (Surname) *</label>
                  <input type="text" id="chk-last-name" autocomplete="family-name" value="" class="${inputCls}">
                  ${err('lastName')}
                </div>
                <div>
                  <label class="block text-xs font-semibold text-stone-600 mb-1" for="chk-phone">Contact Number *</label>
                  <input type="tel" id="chk-phone" autocomplete="tel" placeholder="09XX XXX XXXX" value="" class="${inputCls}">
                  ${err('phone')}
                </div>
                <div>
                  <label class="block text-xs font-semibold text-stone-600 mb-1" for="chk-email">Email Address *</label>
                  <input type="email" id="chk-email" autocomplete="email" value="" class="${inputCls}">
                  ${err('email')}
                </div>
              </div>
            </div>

            <!-- 3. Delivery address (hidden for pickup) -->
            <div id="chk-address-section" class="bg-white p-6 sm:p-7 rounded-3xl border border-[#E5ECE6] shadow-xs space-y-4">
              <div class="flex items-center justify-between border-b border-stone-100 pb-3">
                <h3 class="font-serif font-bold text-stone-900 text-lg flex items-center gap-2">
                  ${stepBadge(3)} Delivery Address — Manila Only
                </h3>
                <span class="text-[11px] font-semibold tracking-wider uppercase text-[#647D69] bg-rose-50 px-3 py-1 rounded-full border border-rose-200">
                  Manila Only
                </span>
              </div>

              <!-- 1. District -->
              <div>
                <label class="block text-xs font-semibold text-stone-700 mb-1" for="chk-district">
                  District *
                </label>
                <select id="chk-district" onchange="window.appRouter.onDistrictChange(this.value)" class="${inputCls}">
                  <option value="">Select District ▼</option>
                  ${SHOP_RULES.MANILA_DISTRICTS.map(d => `<option value="${d.id}">${d.name} — ${d.areas}</option>`).join('')}
                </select>
                ${err('district')}
              </div>

              <!-- 2. Barangay -->
              <div>
                <label class="block text-xs font-semibold text-stone-700 mb-1" for="chk-barangay">
                  Barangay *
                </label>
                <select id="chk-barangay" disabled class="${inputCls} disabled:bg-stone-100 disabled:text-stone-400 disabled:cursor-not-allowed">
                  <option value="">Select a district first</option>
                </select>
                ${err('barangay')}
              </div>

              <!-- 3. City -->
              <div>
                <label class="block text-xs font-semibold text-stone-700 mb-1" for="chk-city">
                  City *
                </label>
                <div class="relative">
                  <input type="text" id="chk-city" value="Manila" readonly class="${inputCls} bg-stone-100 text-stone-800 font-medium cursor-not-allowed select-none" tabindex="-1">
                  <span class="absolute right-3.5 top-3.5 text-[11px] text-stone-500 font-semibold uppercase tracking-wider">Fixed: Manila Only</span>
                </div>
                ${err('city')}
              </div>

              <!-- 4. Street / Building / House or Unit No. -->
              <div>
                <label class="block text-xs font-semibold text-stone-700 mb-1" for="chk-address">
                  Street / Building / House or Unit No. *
                </label>
                <input type="text" id="chk-address" autocomplete="street-address" placeholder="Enter your complete delivery address" class="${inputCls}">
                ${err('address')}
              </div>

              <!-- 5. Delivery Notes -->
              <div>
                <label class="block text-xs font-semibold text-stone-700 mb-1" for="chk-notes">
                  Delivery Notes
                </label>
                <input type="text" id="chk-notes" maxlength="200" placeholder="Optional: landmarks, gate instructions, etc." class="${inputCls}">
              </div>
            </div>

            <!-- 4. Date and time -->
            <div class="bg-white p-6 sm:p-7 rounded-3xl border border-[#E5ECE6] shadow-xs space-y-4">
              <h3 class="font-serif font-bold text-stone-900 text-lg flex items-center gap-2">${stepBadge(4)} <span id="chk-schedule-title">Preferred Delivery Date & Time</span></h3>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-semibold text-stone-600 mb-1" for="chk-date" id="chk-date-label">Preferred Delivery Date *</label>
                  <input type="date" id="chk-date" onchange="window.appRouter.refreshTimeOptions()" class="${inputCls} font-mono">
                  <p id="chk-date-hint" class="text-[11px] text-stone-400 mt-1"></p>
                  ${err('date')}
                </div>
                <div>
                  <label class="block text-xs font-semibold text-stone-600 mb-1" for="chk-time" id="chk-time-label">Preferred Delivery Time *</label>
                  <select id="chk-time" class="${inputCls}"></select>
                  ${err('time')}
                </div>
              </div>
            </div>

            <!-- 5. Payment -->
            <div class="bg-white p-6 sm:p-7 rounded-3xl border border-[#E5ECE6] shadow-xs space-y-4">
              <h3 class="font-serif font-bold text-stone-900 text-lg flex items-center gap-2">${stepBadge(5)} Payment Method</h3>
              <div id="chk-payment-options" class="grid grid-cols-1 sm:grid-cols-3 gap-3"></div>
              ${err('paymentMethod')}
              <div id="payment-method-details" class="p-4 bg-[#FFF9F5] rounded-2xl border border-[#E5ECE6] text-xs text-stone-600"></div>
            </div>

            <!-- 6. Delivery Instructions -->
            <div class="bg-white p-6 sm:p-7 rounded-3xl border border-[#E5ECE6] shadow-xs space-y-3">
              <h3 class="font-serif font-bold text-stone-900 text-lg flex items-center gap-2">${stepBadge(6)} Delivery Instructions <span class="text-xs font-normal text-stone-400">(optional)</span></h3>
              <p class="text-xs text-stone-500">Provide specific instructions for the delivery rider (e.g., recipient alternate contact number, building name, gate pass, landmarks, or drop-off instructions).</p>
              <textarea id="chk-gift-message" rows="3" maxlength="250" placeholder="e.g., Please leave with lobby guard, call recipient at 0917-XXX-XXXX upon arrival at gate 2" class="${inputCls}"></textarea>
              ${err('giftMessage')}
            </div>
          </div>

          <!-- Summary -->
          <div class="lg:col-span-4 bg-white/95 backdrop-blur-md p-6 sm:p-7 rounded-3xl border border-[#E5ECE6] shadow-floral space-y-5 sticky top-24">
            <div class="flex items-center justify-between border-b border-stone-100 pb-3">
              <h3 class="font-serif font-bold text-stone-900 text-lg">Review Order</h3>
              ${this.getBuyNowItem() ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#EBF1EC] text-[#526B57] border border-[#647D69]/30">Buy Now</span>' : ''}
            </div>
            <div class="max-h-60 overflow-y-auto space-y-3 pr-1">
              ${checkoutItems.map(item => `
                <div class="flex items-start gap-3 py-2 border-b border-stone-100 text-xs">
                  <div class="w-12 h-12 rounded-xl overflow-hidden border border-[#E5ECE6] shrink-0 bg-stone-100 flex items-center justify-center">
                    ${window.UI ? window.UI.renderImage(item.image, item.name, 'w-full h-full object-cover', 'thumb') : ''}
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="font-bold text-stone-900 truncate">${item.quantity}× ${item.name}</p>
                    <p class="text-stone-500 text-[11px] truncate">${item.summary || ''}</p>
                  </div>
                  <span class="font-mono font-semibold text-stone-900 shrink-0">${formatCurrency(item.price * item.quantity)}</span>
                </div>
              `).join('')}
            </div>
            <div class="space-y-2 pt-2 text-xs">
              <div class="flex justify-between text-stone-600">
                <span>Subtotal</span>
                <span class="font-mono font-medium text-stone-900">${formatCurrency(subtotal)}</span>
              </div>
              <div class="flex justify-between text-stone-600">
                <span id="chk-fee-label">Delivery Fee</span>
                <span id="chk-fee-value" class="font-mono font-medium text-stone-900"></span>
              </div>
              <div class="border-t border-stone-200 pt-3 flex justify-between text-base font-bold text-stone-900">
                <span class="font-semibold text-base text-stone-900">Total Due:</span>
                <span id="chk-total-value" class="font-bold text-2xl text-[#647D69] price"></span>
              </div>
            </div>
            <p id="chk-submit-error" class="hidden text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3"></p>
            <button type="submit" id="chk-submit-btn" class="w-full py-4 rounded-2xl bg-[#647D69] hover:bg-[#526B57] disabled:opacity-60 text-white font-bold text-base shadow-lg shadow-[#647D69]/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
              Place Order
            </button>
          </div>
        </form>
      </div>
    `;
  }

  // Called after the checkout markup is on the page.
  initCheckoutForm() {
    this.updateCheckoutFulfillmentAvailability();
    const delEnabled = appState.deliverySettings?.enabled !== false;
    const picEnabled = appState.pickupSettings?.enabled !== false;
    if (delEnabled) {
      this.setFulfillment('delivery');
    } else if (picEnabled) {
      this.setFulfillment('pickup');
    } else {
      this.setFulfillment('delivery');
    }
    this.updateShopStatusBanner();
    this.refreshCheckoutPriceSummary();
  }

  // Rebuild the Barangay dropdown for the selected district (clears any previous choice).
  onDistrictChange(districtId) {
    const sel = document.getElementById('chk-barangay');
    if (!sel) return;
    const list = SHOP_RULES.barangaysForDistrict(districtId);
    if (!list.length) {
      sel.innerHTML = '<option value="">Select a district first</option>';
      sel.disabled = true;
      sel.value = '';
      return;
    }
    sel.innerHTML = '<option value="">Select Barangay ▼</option>' + list.map(b => `<option value="${b}">${b}</option>`).join('');
    sel.disabled = false;
    sel.value = '';

    const errDistrict = document.getElementById('chk-err-district');
    const errBarangay = document.getElementById('chk-err-barangay');
    if (errDistrict) { errDistrict.textContent = ''; errDistrict.classList.add('hidden'); }
    if (errBarangay) { errBarangay.textContent = ''; errBarangay.classList.add('hidden'); }
  }

  setFulfillment(type) {
    const delEnabled = appState.deliverySettings?.enabled !== false;
    const picEnabled = appState.pickupSettings?.enabled !== false;
    if (type === 'delivery' && !delEnabled) {
      if (picEnabled) type = 'pickup';
      else {
        showToast('Delivery service is currently disabled.', 'warning');
        return;
      }
    }
    if (type === 'pickup' && !picEnabled) {
      if (delEnabled) type = 'delivery';
      else {
        showToast('Store pickup is currently disabled.', 'warning');
        return;
      }
    }

    this.checkoutFulfillment = type;
    const pickup = type === 'pickup';
    const $ = (id) => document.getElementById(id);

    // Option cards
    const on = 'flex flex-col p-4 sm:p-5 rounded-2xl border-2 border-[#647D69] bg-gradient-to-br from-[#FFF9F5] to-[#FCE7F0]/40 shadow-xs cursor-pointer transition-all';
    const off = 'flex flex-col p-4 sm:p-5 rounded-2xl border border-[#E5ECE6] bg-white hover:border-[#647D69]/40 hover:bg-[#FFF9F5]/50 cursor-pointer transition-all';
    if ($('chk-opt-delivery')) $('chk-opt-delivery').className = pickup ? off : on;
    if ($('chk-opt-pickup')) $('chk-opt-pickup').className = pickup ? on : off;

    const radDel = document.querySelector('input[name="fulfillment"][value="delivery"]');
    const radPic = document.querySelector('input[name="fulfillment"][value="pickup"]');
    if (radDel) radDel.checked = !pickup;
    if (radPic) radPic.checked = pickup;

    $('chk-pickup-banner')?.classList.toggle('hidden', !pickup);
    $('chk-delivery-note')?.classList.toggle('hidden', pickup);
    $('chk-address-section')?.classList.toggle('hidden', pickup);

    // Update dynamic text in banners
    const cov = String(appState.deliverySettings?.coverage || appState.deliverySettings?.serviceArea || 'City of Manila (Districts 1–6)').trim();
    if ($('chk-delivery-note')) {
      $('chk-delivery-note').textContent = `Delivery is available within ${cov}. Please enter a complete address within this coverage area below.`;
    }
    if ($('chk-opt-delivery-sub')) {
      $('chk-opt-delivery-sub').textContent = `Within ${cov.split('(')[0].trim() || 'Manila'}`;
    }
    if ($('chk-pickup-banner')) {
      const storeName = appState.storeSettings?.name || SHOP_RULES.info.name || 'Umaira Florist Atelier';
      const storeAddr = appState.pickupSettings?.address || appState.storeSettings?.address || SHOP_RULES.info.address;
      const hoursTxt = SHOP_RULES.info.hoursText;
      $('chk-pickup-banner').innerHTML = `
        <p class="font-bold text-sm">You selected Store Pickup. Your order will not be delivered.</p>
        <p><strong>Pick up at:</strong> <span class="store-name-val">${storeName}</span>, <span class="store-address-val">${storeAddr}</span></p>
        <p><strong>Pickup hours:</strong> <span id="chk-pickup-hours-text">${hoursTxt}</span></p>
        <p>Your order will be prepared and ready before the pickup time you choose.</p>
      `;
    }

    // If pickup, clear address validation errors
    if (pickup) {
      ['district', 'barangay', 'city', 'address'].forEach(f => {
        const el = document.getElementById('chk-err-' + f);
        if (el) { el.textContent = ''; el.classList.add('hidden'); }
      });
    }

    // Wording
    const word = pickup ? 'Pickup' : 'Delivery';
    if ($('chk-schedule-title')) $('chk-schedule-title').textContent = `Preferred ${word} Date & Time`;
    if ($('chk-date-label')) $('chk-date-label').textContent = `Preferred ${word} Date *`;
    if ($('chk-time-label')) $('chk-time-label').textContent = `Preferred ${word} Time *`;
    if ($('chk-date-hint')) {
      const leadH = SHOP_RULES.PICKUP_LEAD_MINUTES / 60;
      const prep = leadH > 0 ? ` We need ${leadH} hour${leadH === 1 ? '' : 's'} to prepare same-day orders.` : '';
      const days = SHOP_RULES.info.operatingDays || 'Monday – Sunday';
      const daily = /^monday\s*[–—-]\s*sunday$/i.test(days.trim());
      $('chk-date-hint').textContent = pickup
        ? `Open ${SHOP_RULES.info.hoursText.replace('Monday – Sunday: ', 'daily, ')}.${prep}`
        : (daily ? 'Deliveries start from tomorrow.' : `Deliveries start from tomorrow, on our operating days (${days}).`);
    }

    // Date limits
    const dateEl = $('chk-date');
    if (dateEl) {
      const min = SHOP_RULES.earliestDate(type);
      dateEl.min = min;
      if (!dateEl.value || dateEl.value < min) dateEl.value = min;
    }

    this.refreshTimeOptions();
    this.renderPaymentOptions();

    // Price summary
    this.refreshCheckoutPriceSummary();
  }

  refreshTimeOptions() {
    const select = document.getElementById('chk-time');
    const dateEl = document.getElementById('chk-date');
    if (!select) return;
    const previous = select.value;
    let options;
    if (this.checkoutFulfillment === 'pickup') {
      const slots = SHOP_RULES.availablePickupSlots(dateEl ? dateEl.value : '');
      options = slots.map(s => s.label);
      if (options.length === 0) {
        select.innerHTML = '<option value="">No pickup times left on this date</option>';
        return;
      }
    } else {
      if (dateEl && dateEl.value && typeof SHOP_RULES.isOpenOn === 'function' && !SHOP_RULES.isOpenOn(dateEl.value)) {
        select.innerHTML = '<option value="">The shop is closed on this date — no deliveries</option>';
        return;
      }
      options = SHOP_RULES.deliverySlots;
    }
    select.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join('');
    if (options.includes(previous)) select.value = previous;
  }

  renderPaymentOptions() {
    const box = document.getElementById('chk-payment-options');
    if (!box) return;
    const pickup = this.checkoutFulfillment === 'pickup';
    const cashLabel = pickup ? 'Cash on Pickup' : 'Cash on Delivery';
    const cashHint = pickup ? 'Pay in cash when you collect' : 'Pay the courier in cash on delivery';
    // Offered methods: GCash, plus Cash on Pickup (pickup) or Cash on Delivery (delivery). GCash appears only
    // when the shop has set up its GCash QR code (Shop Settings → Payment Accounts).
    const gcashReady = !!(window.appState && appState.paymentAccounts && appState.paymentAccounts.gcash);
    const methods = [
      { value: 'GCash', title: 'GCash', hint: gcashReady ? 'Pay in advance via QR, then upload receipt' : 'Not available right now', disabled: !gcashReady },
      { value: cashLabel, title: cashLabel, hint: cashHint }
    ];
    const current = document.querySelector ? document.querySelector('input[name="paymentMethod"]:checked')?.value : null;
    const usable = methods.filter(m => !m.disabled);
    const selected = usable.some(m => m.value === current) ? current : usable[0].value;
    box.className = 'grid grid-cols-1 sm:grid-cols-2 gap-3';
    box.innerHTML = methods.map(m => `
      <label class="relative flex flex-col p-4 rounded-2xl border-2 ${m.disabled ? 'border-[#E5ECE6] bg-stone-50 opacity-60 cursor-not-allowed' : (m.value === selected ? 'border-[#647D69] bg-gradient-to-br from-[#FFF9F5] to-[#FCE7F0]/40 shadow-xs cursor-pointer' : 'border-[#E5ECE6] bg-white hover:border-[#647D69]/40 hover:bg-[#FFF9F5]/50 cursor-pointer')} payment-option transition-all">
        <input type="radio" name="paymentMethod" value="${m.value}" ${m.value === selected ? 'checked' : ''} ${m.disabled ? 'disabled' : ''} onchange="window.appRouter.selectPayment(this)" class="text-[#647D69] focus:ring-[#647D69] accent-[#647D69] mb-2">
        <span class="font-bold text-stone-900 text-sm">${m.title}</span>
        <span class="text-xs text-stone-500 mt-0.5">${m.hint}</span>
      </label>
    `).join('');
    this.showPaymentDetails(selected);
  }

  // Exact amount the customer will be charged (same calculation as the summary and the server).
  checkoutTotalAmount() {
    const pickup = this.checkoutFulfillment === 'pickup';
    const items = typeof this.getCheckoutItems === 'function' ? this.getCheckoutItems() : (appState.cart || []);
    const subtotal = items.reduce((sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 1), 0);
    return subtotal + (pickup ? 0 : appState.getDeliveryFee(subtotal));
  }

  selectPayment(radioEl) {
    document.querySelectorAll('.payment-option').forEach(el => {
      el.className = 'relative flex flex-col p-4 rounded-2xl border border-[#E5ECE6] bg-white hover:border-[#647D69]/40 hover:bg-[#FFF9F5]/50 cursor-pointer payment-option transition-all';
    });
    radioEl.closest('label').className = 'relative flex flex-col p-4 rounded-2xl border-2 border-[#647D69] bg-gradient-to-br from-[#FFF9F5] to-[#FCE7F0]/40 shadow-xs cursor-pointer payment-option transition-all';
    this.showPaymentDetails(radioEl.value);
  }

  showPaymentDetails(method) {
    const infoBox = document.getElementById('payment-method-details');
    if (!infoBox) return;
    const e = window.escapeHtml || ((v) => String(v == null ? '' : v));
    const total = formatCurrency(this.checkoutTotalAmount());
    const info = SHOP_RULES.info || {};
    if (method === 'GCash') {
      const g = (window.appState && appState.paymentAccounts && appState.paymentAccounts.gcash) || null;
      if (!g) { infoBox.innerHTML = '<p><strong>GCash</strong> is not available right now. Please choose a cash option.</p>'; return; }
      infoBox.innerHTML = `
        <div class="flex flex-col sm:flex-row gap-4 items-start">
          <div class="shrink-0 text-center">
            <img src="${e(g.qrImage)}" alt="${e(info.name || 'Shop')} official GCash QR code" class="w-52 sm:w-56 h-auto max-h-[30rem] object-contain rounded-xl border border-[#E5ECE6] bg-white mx-auto">
            <a href="${e(g.qrImage)}" download="umaira-florist-gcash-qr.${e(String(g.qrImage).split('.').pop())}" class="mt-2 inline-block text-[11px] font-bold text-[#647D69] hover:underline">Download QR Code</a>
          </div>
          <div class="space-y-1.5">
            <p><strong>GCash — advance payment.</strong> Amount to send: <strong class="text-stone-900">${total}</strong> (exact amount).</p>
            ${g.accountName || g.number ? `<p>GCash account: <strong class="text-stone-900">${e(g.accountName)}</strong>${g.number ? ` · <span class="font-mono">${e(g.number)}</span>` : ''}</p>` : ''}
            <ol class="list-decimal pl-4 space-y-0.5">
              <li>Place your order, then scan or download this QR code in the GCash app.</li>
              <li>Send exactly ${total} and keep the receipt and its reference number.</li>
              <li>On the next screen (or later in My Orders) submit the reference number, amount and receipt.</li>
            </ol>
            <p class="text-stone-500">Your order is confirmed and prepared only after the shop verifies the payment.</p>
          </div>
        </div>`;
      return;
    }
    if (method === 'Cash on Pickup') {
      infoBox.innerHTML = `<p><strong>Cash on Pickup:</strong> no advance payment. Pay <strong class="text-stone-900">${total}</strong> in cash at the shop when you collect your order.</p>
        <p class="mt-1">Pick up at: <strong class="text-stone-900">${e(info.pickupAddress || info.address || '')}</strong>${info.hoursText ? ` · ${e(info.hoursText)}` : ''}</p>
        ${info.pickupInstructions ? `<p class="mt-1">${e(info.pickupInstructions)}</p>` : '<p class="mt-1">Please show your order reference at the counter.</p>'}`;
      return;
    }
    if (method === 'Cash on Delivery') {
      infoBox.innerHTML = `<p><strong>Cash on Delivery:</strong> no advance payment. Please prepare <strong class="text-stone-900">${total}</strong> in cash for the courier when your order arrives.</p>`;
      return;
    }
    infoBox.innerHTML = '';
  }

  showCheckoutErrors(errors) {
    document.querySelectorAll('[id^="chk-err-"]').forEach(el => { el.textContent = ''; el.classList.add('hidden'); });
    let first = null;
    Object.keys(errors || {}).forEach(field => {
      const el = document.getElementById('chk-err-' + field);
      if (el) {
        el.textContent = errors[field];
        el.classList.remove('hidden');
        if (!first) first = el;
      }
    });
    if (first) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // handlePlaceOrder, renderConfirmationView, renderTrackingView, searchTrackingOrder and
  // viewOrderTracking now live in js/account.js (they talk to the server; nothing is simulated).

  // =========================================================================
  // FLOWER DETAILS MODAL
  // =========================================================================
  showFlowerModal(flowerId) {
    const flower = getFlowerById(flowerId);
    if (!flower) return;

    const modal = document.getElementById('flower-detail-modal');
    const content = document.getElementById('flower-modal-content');
    if (!modal || !content) return;

    const isSoldOut = flower.availability === 'sold_out';
    const isLimited = flower.availability === 'limited';

    let badge = isSoldOut ? 'Sold Out' : (isLimited ? `Limited (${flower.stockCount} left)` : 'Available');

    content.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        <div class="rounded-2xl overflow-hidden aspect-square bg-stone-100 flex items-center justify-center border border-stone-200">
          ${window.UI ? window.UI.renderImage(flower.image, flower.name, 'w-full h-full object-cover', 'large') : ''}
        </div>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700">${flower.category}</span>
            <span class="text-xs font-bold">${badge}</span>
          </div>
          <h3 class="font-serif text-2xl font-bold text-stone-900">${flower.name}</h3>
          <p class="text-xs text-stone-500 italic">${flower.botanicalName}</p>
          <p class="text-stone-600 text-xs leading-relaxed">${flower.description}</p>
          
          <div class="grid grid-cols-2 gap-2 text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-200">
            <div><strong>Stem Length:</strong> ${flower.stemLength}</div>
            <div><strong>Vase Life:</strong> ${flower.vaseLife}</div>
            <div><strong>Fragrance:</strong> ${flower.fragrance}</div>
            <div><strong>Price:</strong> <span class="font-mono font-bold text-rose-900">${formatCurrency(flower.price)}/stem</span></div>
          </div>

          <div class="pt-2">
            ${isSoldOut ? `
              <button disabled class="w-full py-3 rounded-xl bg-stone-100 text-stone-400 font-bold text-xs cursor-not-allowed">Currently Sold Out</button>
            ` : `
              <button type="button" onclick="window.appRouter.addStemToCustomBuilder('${flower.id}'); window.appRouter.hideFlowerModal();" class="w-full py-3 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-xs shadow-sm transition">
                + Add Stem to Custom Bouquet Builder
              </button>
            `}
          </div>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
  }

  hideFlowerModal() {
    const modal = document.getElementById('flower-detail-modal');
    if (modal) modal.classList.add('hidden');
  }

  // =========================================================================
  // CUSTOMER AUTHENTICATION MODAL & ACCESS CONTROL
  // =========================================================================
  showCustomerAuthModal(tab = 'login', notice = '') {
    const modal = document.getElementById('customer-auth-modal');
    if (!modal) return;
    modal.classList.remove('hidden');

    const errBox = document.getElementById('auth-error-alert');
    if (errBox) errBox.classList.add('hidden');

    const subtitle = document.getElementById('auth-modal-subtitle');
    if (subtitle && notice) {
      subtitle.textContent = notice;
    } else if (subtitle) {
      subtitle.textContent = 'Sign in to customize bouquets, checkout, and track your orders';
    }

    this.switchAuthTab(tab);
  }

  hideCustomerAuthModal() {
    const modal = document.getElementById('customer-auth-modal');
    if (modal) modal.classList.add('hidden');
    const errBox = document.getElementById('auth-error-alert');
    if (errBox) errBox.classList.add('hidden');
  }

  switchAuthTab(tab) {
    const tabLogin = document.getElementById('tab-auth-login');
    const tabReg = document.getElementById('tab-auth-register');
    const formLogin = document.getElementById('form-auth-login');
    const formReg = document.getElementById('form-auth-register');
    const formOtp = document.getElementById('form-auth-modal-otp');
    const title = document.getElementById('auth-modal-title');
    const modalTabs = document.querySelector('#customer-auth-modal .flex.border-b');
    const googleArea = document.querySelector('[data-google-modal-area]');
    const divider = googleArea ? googleArea.nextElementSibling : null;
    const errBox = document.getElementById('auth-error-alert');
    if (errBox) errBox.classList.add('hidden');
    if (formOtp) formOtp.classList.add('hidden');
    if (modalTabs) modalTabs.classList.remove('hidden');
    if (googleArea) googleArea.classList.remove('hidden');
    if (divider) divider.classList.remove('hidden');

    if (tab === 'register') {
      if (tabLogin) {
        tabLogin.className = 'flex-1 pb-2.5 text-center text-sm font-medium border-b-2 border-transparent text-[#6E6864] hover:text-[#647D69] transition-all';
      }
      if (tabReg) {
        tabReg.className = 'flex-1 pb-2.5 text-center text-sm font-semibold border-b-2 border-[#647D69] text-[#647D69] transition-all';
      }
      if (formLogin) formLogin.classList.add('hidden');
      if (formReg) formReg.classList.remove('hidden');
      if (title) title.textContent = 'Create Customer Account';
    } else {
      if (tabLogin) {
        tabLogin.className = 'flex-1 pb-2.5 text-center text-sm font-semibold border-b-2 border-[#647D69] text-[#647D69] transition-all';
      }
      if (tabReg) {
        tabReg.className = 'flex-1 pb-2.5 text-center text-sm font-medium border-b-2 border-transparent text-[#6E6864] hover:text-[#647D69] transition-all';
      }
      if (formLogin) formLogin.classList.remove('hidden');
      if (formReg) formReg.classList.add('hidden');
      if (title) title.textContent = 'A Bouquet Made Just for You';
    }
  }

  renderAuthView(mode = 'signin') {
    return `
      <section class="auth-page-container">
        <div class="auth-card-wrapper bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-xl border border-[#E5ECE6]">
          <!-- Monogram & Header -->
          <div class="text-center space-y-2 mb-6">
            <div class="w-12 h-12 rounded-2xl bg-[#FFF9F5] border border-[#E5ECE6] p-2 flex items-center justify-center shadow-xs mx-auto mb-1">
              <img src="/image/Logo.png" alt="Umaira Florist" class="w-full h-full object-contain">
            </div>
            <h2 class="font-serif text-2xl sm:text-3xl font-bold text-stone-900">Welcome to Umaira Florist</h2>
            <p class="text-xs text-stone-500 max-w-xs mx-auto">
              Sign in to explore our collections, customize bespoke bouquets, and arrange Manila delivery.
            </p>
          </div>

          <!-- Tab Switcher -->
          <div class="flex items-center p-1.5 bg-[#FFF9F5] border border-[#E5ECE6] rounded-2xl mb-6">
            <button type="button" id="tab-auth-page-signin" onclick="window.appRouter.switchAuthPageTab('signin')" class="flex-1 py-2 rounded-xl text-xs font-semibold transition ${mode === 'signin' ? 'bg-[#647D69] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-[#647D69]'}">
              Sign In
            </button>
            <button type="button" id="tab-auth-page-signup" onclick="window.appRouter.switchAuthPageTab('signup')" class="flex-1 py-2 rounded-xl text-xs font-semibold transition ${mode === 'signup' ? 'bg-[#647D69] text-white font-bold shadow-xs' : 'text-stone-600 hover:text-[#647D69]'}">
              Create Account
            </button>
          </div>

          <!-- Error Alert Banner -->
          <div id="auth-page-error" class="hidden mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs"></div>

          <!-- Sign In Form -->
          <form id="form-auth-page-signin" onsubmit="window.appRouter.handleCustomerLoginSubmit(event, 'page')" class="space-y-4 ${mode === 'signin' ? '' : 'hidden'}">
            <div>
              <label class="block text-xs font-semibold text-stone-700 mb-1">Email Address</label>
              <input type="email" id="auth-page-login-email" required placeholder="you@example.ph" class="w-full text-xs px-4 py-3 rounded-xl border border-[#E5ECE6] bg-[#FFF9F5]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#647D69] focus:border-[#647D69] transition-all shadow-2xs">
            </div>
            <div>
              <label class="block text-xs font-semibold text-stone-700 mb-1">Password</label>
              <input type="password" id="auth-page-login-password" required placeholder="••••••••" class="w-full text-xs px-4 py-3 rounded-xl border border-[#E5ECE6] bg-[#FFF9F5]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#647D69] focus:border-[#647D69] transition-all shadow-2xs">
            </div>
            <p class="text-right -mt-2"><button type="button" onclick="window.appRouter.showForgotPassword()" class="text-[11px] text-[#647D69] font-semibold underline hover:text-[#526B57]">Forgot your password?</button></p>
            <button type="submit" id="auth-page-login-btn" class="w-full py-3.5 px-4 bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-xs rounded-xl transition shadow-md shadow-[#647D69]/20 hover:shadow-lg hover:-translate-y-0.5 mt-2">
              Sign In to Umaira
            </button>

            <!-- Divider -->
            <div class="relative flex items-center justify-center my-4">
              <div class="border-t border-[#E5ECE6] w-full"></div>
              <span class="bg-white px-3 text-[11px] text-stone-400 uppercase tracking-wider shrink-0 font-medium">Or</span>
              <div class="border-t border-[#E5ECE6] w-full"></div>
            </div>

            <!-- Google Sign-In Area -->
            <div data-google-area class="hidden"><div id="google-auth-btn-page" class="w-full flex justify-center min-h-[44px]">
              <button type="button" onclick="window.appRouter.handleGoogleSignInClick()" class="w-full py-2.5 px-4 bg-white hover:bg-[#FFF9F5] text-stone-700 text-xs font-semibold rounded-xl border border-[#E5ECE6] flex items-center justify-center gap-2.5 transition shadow-2xs">
                <svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                <span>Continue with Google</span>
              </button>
            </div></div>

            <p class="text-center text-xs text-stone-500 pt-2">
              Don't have an account yet? 
              <button type="button" onclick="window.appRouter.switchAuthPageTab('signup')" class="text-[#647D69] font-semibold underline hover:text-[#526B57]">Create one here</button>
            </p>
          </form>

          <!-- Sign Up Form -->
          <form id="form-auth-page-signup" onsubmit="window.appRouter.handleCustomerRegisterSubmit(event, 'page')" class="space-y-4 ${mode === 'signup' ? '' : 'hidden'}">
            <div>
              <label class="block text-xs font-semibold text-stone-700 mb-1">Full Name <span class="text-red-500">*</span></label>
              <input type="text" id="auth-page-reg-name" required placeholder="e.g. Maria Clara" class="w-full text-xs px-4 py-3 rounded-xl border border-[#E5ECE6] bg-[#FFF9F5]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#647D69] focus:border-[#647D69] transition-all shadow-2xs">
            </div>
            <div>
              <label class="block text-xs font-semibold text-stone-700 mb-1">Mobile / Contact Number <span class="text-red-500">*</span></label>
              <input type="tel" id="auth-page-reg-phone" required placeholder="0917 123 4567" class="w-full text-xs px-4 py-3 rounded-xl border border-[#E5ECE6] bg-[#FFF9F5]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#647D69] focus:border-[#647D69] transition-all shadow-2xs">
              <p class="text-[11px] text-stone-400 mt-1">Philippine mobile number (e.g. 0917 123 4567 or +63 917 123 4567)</p>
            </div>
            <div>
              <label class="block text-xs font-semibold text-stone-700 mb-1">Email Address <span class="text-red-500">*</span></label>
              <input type="email" id="auth-page-reg-email" required placeholder="you@example.ph" class="w-full text-xs px-4 py-3 rounded-xl border border-[#E5ECE6] bg-[#FFF9F5]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#647D69] focus:border-[#647D69] transition-all shadow-2xs">
            </div>
            <div>
              <label class="block text-xs font-semibold text-stone-700 mb-1">Password <span class="text-red-500">*</span></label>
              <input type="password" id="auth-page-reg-password" required minlength="8" placeholder="At least 8 characters" class="w-full text-xs px-4 py-3 rounded-xl border border-[#E5ECE6] bg-[#FFF9F5]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#647D69] focus:border-[#647D69] transition-all shadow-2xs">
            </div>
            <button type="submit" id="auth-page-reg-btn" class="w-full py-3.5 px-4 bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-xs rounded-xl transition shadow-md shadow-[#647D69]/20 hover:shadow-lg hover:-translate-y-0.5 mt-2">
              Create Customer Account
            </button>

            <!-- Divider -->
            <div class="relative flex items-center justify-center my-4">
              <div class="border-t border-stone-200 w-full"></div>
              <span class="bg-white px-3 text-[11px] text-stone-400 uppercase tracking-wider shrink-0 font-medium">Or</span>
              <div class="border-t border-stone-200 w-full"></div>
            </div>

            <!-- Google Sign-In Area -->
            <div data-google-area class="hidden"><div id="google-auth-reg-btn-page" class="w-full flex justify-center min-h-[44px]">
              <button type="button" onclick="window.appRouter.handleGoogleSignInClick()" class="w-full py-2.5 px-4 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold rounded-xl border border-stone-300 flex items-center justify-center gap-2.5 transition shadow-2xs">
                <svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
                <span>Continue with Google</span>
              </button>
            </div></div>

            <p class="text-center text-xs text-stone-500 pt-2">
              Already have an account? 
              <button type="button" onclick="window.appRouter.switchAuthPageTab('signin')" class="text-[#647D69] font-semibold underline hover:text-[#526B57]">Sign in here</button>
            </p>
          </form>

          <!-- OTP Verification Form (Page) -->
          <form id="form-auth-page-otp" onsubmit="window.appRouter.handleCustomerVerifyOTPSubmit(event, 'page')" class="space-y-5 hidden">
            <div class="text-center">
              <div class="w-14 h-14 rounded-2xl bg-[#FFF9F5] border border-[#E5ECE6] text-[#647D69] flex items-center justify-center mx-auto mb-3 shadow-xs">
                <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h9"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  <path d="m16 19 2 2 4-4"/>
                </svg>
              </div>
              <span class="inline-block px-3 py-1 bg-[#FFF9F5] border border-[#E5ECE6] text-[11px] font-bold text-[#647D69] rounded-full uppercase tracking-wider mb-2">Email Verification</span>
              <h3 class="font-serif text-2xl font-bold text-stone-900">Check Your Inbox</h3>
              <p class="text-xs text-stone-600 mt-1 max-w-sm mx-auto">
                We've sent a 6-digit verification code to <span id="auth-page-otp-target-email" class="font-semibold text-stone-900"></span>. Please enter the code below to activate your account.
              </p>
            </div>

            <div>
              <label class="block text-center text-xs font-semibold text-stone-700 mb-2">6-Digit Verification Code</label>
              <input type="text" id="auth-page-otp-input" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="one-time-code" placeholder="••••••" class="w-full text-center text-3xl font-mono tracking-[0.35em] py-3.5 px-4 rounded-xl border border-[#E5ECE6] bg-[#FFF9F5]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#647D69] focus:border-[#647D69] text-[#1C281F] font-bold shadow-2xs">
              <div class="flex items-center justify-between mt-2 text-[11px] text-stone-500 px-1">
                <span>⏱ Code expires in 5 minutes</span>
                <span>Single-use security code</span>
              </div>
            </div>

            <button type="submit" id="auth-page-otp-btn" class="w-full py-3.5 px-4 bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-xs rounded-xl transition shadow-md shadow-[#647D69]/20 hover:shadow-lg hover:-translate-y-0.5">
              Verify Code &amp; Activate Account
            </button>

            <div class="flex items-center justify-between text-xs pt-1 px-1 border-t border-[#E5ECE6]/80 mt-4">
              <button type="button" id="auth-page-otp-resend-btn" onclick="window.appRouter.handleCustomerResendOTP('page')" class="text-[#647D69] font-medium hover:underline disabled:text-stone-400 disabled:no-underline">
                Resend Code
              </button>
              <button type="button" onclick="window.appRouter.backToRegister('page')" class="text-stone-500 hover:text-stone-800">
                &larr; Back to registration
              </button>
            </div>
          </form>
        </div>
      </section>
    `;
  }

  switchAuthPageTab(mode) {
    this.authPageMode = mode;
    const signinTab = document.getElementById('tab-auth-page-signin');
    const signupTab = document.getElementById('tab-auth-page-signup');
    const signinForm = document.getElementById('form-auth-page-signin');
    const signupForm = document.getElementById('form-auth-page-signup');
    const otpForm = document.getElementById('form-auth-page-otp');
    const tabs = document.querySelector('.auth-page-container .flex.items-center.p-1\\.5');
    const errEl = document.getElementById('auth-page-error');
    if (errEl) errEl.classList.add('hidden');
    if (otpForm) otpForm.classList.add('hidden');
    if (tabs) tabs.classList.remove('hidden');

    if (mode === 'signup') {
      if (signinTab) {
        signinTab.className = 'flex-1 py-2 rounded-xl text-xs font-semibold transition text-stone-600 hover:text-stone-900';
      }
      if (signupTab) {
        signupTab.className = 'flex-1 py-2 rounded-xl text-xs font-semibold transition bg-[#647D69] text-white font-bold shadow-xs';
      }
      if (signinForm) signinForm.classList.add('hidden');
      if (signupForm) signupForm.classList.remove('hidden');
    } else {
      if (signinTab) {
        signinTab.className = 'flex-1 py-2 rounded-xl text-xs font-semibold transition bg-[#647D69] text-white font-bold shadow-xs';
      }
      if (signupTab) {
        signupTab.className = 'flex-1 py-2 rounded-xl text-xs font-semibold transition text-stone-600 hover:text-stone-900';
      }
      if (signinForm) signinForm.classList.remove('hidden');
      if (signupForm) signupForm.classList.add('hidden');
    }
  }

  showAuthError(msg, context = 'modal') {
    const isPage = context === 'page' || this.currentView === 'auth';
    const errBox = document.getElementById(isPage ? 'auth-page-error' : 'auth-error-alert');
    const errText = document.getElementById(isPage ? 'auth-page-error' : 'auth-error-text');
    if (errBox) {
      if (errText) errText.textContent = msg || 'An error occurred. Please try again.';
      errBox.classList.remove('hidden');
    } else {
      showToast(msg, 'error');
    }
  }

  hideAuthError(context = 'modal') {
    const isPage = context === 'page' || this.currentView === 'auth';
    const errBox = document.getElementById(isPage ? 'auth-page-error' : 'auth-error-alert');
    if (errBox) errBox.classList.add('hidden');
  }

  showOTPVerificationView(email, context = 'modal') {
    const isPage = context === 'page' || this.currentView === 'auth';
    this.pendingVerificationEmail = email;

    if (isPage) {
      const signupForm = document.getElementById('form-auth-page-signup');
      const signinForm = document.getElementById('form-auth-page-signin');
      const otpForm = document.getElementById('form-auth-page-otp');
      const emailDisplay = document.getElementById('auth-page-otp-target-email');
      const otpInput = document.getElementById('auth-page-otp-input');
      const tabs = document.querySelector('.auth-page-container .flex.items-center.p-1\\.5');
      if (signupForm) signupForm.classList.add('hidden');
      if (signinForm) signinForm.classList.add('hidden');
      if (tabs) tabs.classList.add('hidden');
      if (otpForm) otpForm.classList.remove('hidden');
      if (emailDisplay) emailDisplay.textContent = email;
      if (otpInput) {
        otpInput.value = '';
        setTimeout(() => otpInput.focus(), 100);
      }
    } else {
      const modalTabs = document.querySelector('#customer-auth-modal .flex.border-b');
      const googleArea = document.querySelector('[data-google-modal-area]');
      const divider = googleArea ? googleArea.nextElementSibling : null;
      const formLogin = document.getElementById('form-auth-login');
      const formReg = document.getElementById('form-auth-register');
      const formOtp = document.getElementById('form-auth-modal-otp');
      const title = document.getElementById('auth-modal-title');
      const subtitle = document.getElementById('auth-modal-subtitle');
      const emailDisplay = document.getElementById('auth-modal-otp-target-email');
      const otpInput = document.getElementById('auth-modal-otp-input');

      if (modalTabs) modalTabs.classList.add('hidden');
      if (googleArea) googleArea.classList.add('hidden');
      if (divider) divider.classList.add('hidden');
      if (formLogin) formLogin.classList.add('hidden');
      if (formReg) formReg.classList.add('hidden');
      if (title) title.textContent = 'Verify Your Email';
      if (subtitle) subtitle.textContent = 'Enter the 6-digit code sent to your email to activate your account';
      if (formOtp) formOtp.classList.remove('hidden');
      if (emailDisplay) emailDisplay.textContent = email;
      if (otpInput) {
        otpInput.value = '';
        setTimeout(() => otpInput.focus(), 100);
      }
    }

    this.startResendCooldownTimer(60, context);
  }

  backToRegister(context = 'modal') {
    const isPage = context === 'page' || this.currentView === 'auth';
    this.hideAuthError(context);
    if (isPage) {
      const signupForm = document.getElementById('form-auth-page-signup');
      const otpForm = document.getElementById('form-auth-page-otp');
      const tabs = document.querySelector('.auth-page-container .flex.items-center.p-1\\.5');
      if (otpForm) otpForm.classList.add('hidden');
      if (tabs) tabs.classList.remove('hidden');
      if (signupForm) signupForm.classList.remove('hidden');
      this.switchAuthPageTab('signup');
    } else {
      const modalTabs = document.querySelector('#customer-auth-modal .flex.border-b');
      const googleArea = document.querySelector('[data-google-modal-area]');
      const divider = googleArea ? googleArea.nextElementSibling : null;
      const formReg = document.getElementById('form-auth-register');
      const formOtp = document.getElementById('form-auth-modal-otp');
      if (formOtp) formOtp.classList.add('hidden');
      if (modalTabs) modalTabs.classList.remove('hidden');
      if (googleArea) googleArea.classList.remove('hidden');
      if (divider) divider.classList.remove('hidden');
      this.switchAuthTab('register');
    }
  }

  startResendCooldownTimer(seconds = 60, context = 'modal') {
    const isPage = context === 'page' || this.currentView === 'auth';
    const btn = document.getElementById(isPage ? 'auth-page-otp-resend-btn' : 'auth-modal-otp-resend-btn');
    if (!btn) return;

    if (this._resendTimer) clearInterval(this._resendTimer);
    let remaining = seconds;
    btn.disabled = true;
    btn.textContent = `Resend code (${remaining}s)`;

    this._resendTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(this._resendTimer);
        this._resendTimer = null;
        btn.disabled = false;
        btn.textContent = 'Resend Code';
      } else {
        btn.textContent = `Resend code (${remaining}s)`;
      }
    }, 1000);
  }

  async handleCustomerLoginSubmit(event, context = 'modal') {
    if (event) event.preventDefault();
    const isPage = context === 'page' || this.currentView === 'auth';
    const emailEl = document.getElementById(isPage ? 'auth-page-login-email' : 'auth-login-email');
    const passEl = document.getElementById(isPage ? 'auth-page-login-password' : 'auth-login-password');
    const btn = document.getElementById(isPage ? 'auth-page-login-btn' : 'auth-login-btn');
    if (!emailEl || !passEl) return;

    const email = emailEl.value.trim().toLowerCase();
    const password = passEl.value;
    if (!email || !password) {
      this.showAuthError('Please enter both your email address and password.', context);
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Signing in...';
    }
    this.hideAuthError(context);

    try {
      const res = await appState.login(email, password);
      if (res && res.ok) {
        this.hideCustomerAuthModal();
        this.updateNavBar();
        showToast(`Welcome back, ${res.user.name || 'valued customer'}!`, 'success');
        this.handlePendingActionResume();
      } else if (res && res.unverified) {
        this.pendingVerificationEmail = res.email || email;
        this.showAuthError(res.error || 'Your email address has not been verified yet.', context);
        // Dispatch OTP and show verification view
        appState.resendOTP(this.pendingVerificationEmail).catch(() => {});
        this.showOTPVerificationView(this.pendingVerificationEmail, context);
        showToast('We sent a verification code to your email. Please verify to activate.', 'info');
      } else {
        this.showAuthError(res.error || 'Invalid email or password.', context);
      }
    } catch (e) {
      this.showAuthError('Sign in failed. Please check your credentials and try again.', context);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = isPage ? 'Sign In to Umaira' : 'Sign In';
      }
    }
  }

  async handleCustomerRegisterSubmit(event, context = 'modal') {
    if (event) event.preventDefault();
    const isPage = context === 'page' || this.currentView === 'auth';
    const nameEl = document.getElementById(isPage ? 'auth-page-reg-name' : 'auth-reg-name');
    const emailEl = document.getElementById(isPage ? 'auth-page-reg-email' : 'auth-reg-email');
    const phoneEl = document.getElementById(isPage ? 'auth-page-reg-phone' : 'auth-reg-phone');
    const passEl = document.getElementById(isPage ? 'auth-page-reg-password' : 'auth-reg-password');
    const btn = document.getElementById(isPage ? 'auth-page-reg-btn' : 'auth-reg-btn');
    if (!nameEl || !emailEl || !passEl) return;

    const fullName = nameEl.value.trim();
    const email = emailEl.value.trim().toLowerCase();
    const phone = phoneEl ? phoneEl.value.trim() : '';
    const password = passEl.value;

    // Strict frontend validation for all 4 required fields
    if (!fullName) {
      this.showAuthError('Please enter your full name.', context);
      nameEl.focus();
      return;
    }
    if (fullName.length < 2) {
      this.showAuthError('Full name must be at least 2 characters.', context);
      nameEl.focus();
      return;
    }
    if (!phone) {
      this.showAuthError('Please enter your mobile / contact number.', context);
      if (phoneEl) phoneEl.focus();
      return;
    }
    const digitsOnly = phone.replace(/\D/g, '');
    const isValidPH = /^09\d{9}$/.test(digitsOnly) || /^639\d{9}$/.test(digitsOnly) || /^9\d{9}$/.test(digitsOnly);
    if (!isValidPH) {
      this.showAuthError('Please enter a valid Philippine mobile number (e.g. 0917 123 4567 or +63 917 123 4567).', context);
      if (phoneEl) phoneEl.focus();
      return;
    }
    if (!email) {
      this.showAuthError('Please enter your email address.', context);
      emailEl.focus();
      return;
    }
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
    if (!emailRegex.test(email)) {
      this.showAuthError('Please enter a valid email address (e.g. name@example.ph).', context);
      emailEl.focus();
      return;
    }
    if (!password) {
      this.showAuthError('Please enter a password.', context);
      passEl.focus();
      return;
    }
    if (password.length < 8) {
      this.showAuthError('Password must be at least 8 characters long.', context);
      passEl.focus();
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending verification code...';
    }
    this.hideAuthError(context);

    try {
      const res = await appState.register({ fullName, email, phone, password });
      if (res && res.ok && res.requiresVerification) {
        this.pendingVerificationEmail = res.email || email;
        this.showOTPVerificationView(this.pendingVerificationEmail, context);
        showToast('Verification code sent to your email! Please check your inbox.', 'success');
      } else if (res && res.ok && res.user) {
        this.hideCustomerAuthModal();
        this.updateNavBar();
        showToast(`Account created! Welcome, ${res.user.name}!`, 'success');
        this.handlePendingActionResume();
      } else {
        this.showAuthError(res.error || 'Could not register account with that email.', context);
      }
    } catch (e) {
      this.showAuthError('Registration failed. Please try again.', context);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = isPage ? 'Create Customer Account' : 'Create Account';
      }
    }
  }

  async handleCustomerVerifyOTPSubmit(event, context = 'modal') {
    if (event) event.preventDefault();
    const isPage = context === 'page' || this.currentView === 'auth';
    const input = document.getElementById(isPage ? 'auth-page-otp-input' : 'auth-modal-otp-input');
    const btn = document.getElementById(isPage ? 'auth-page-otp-btn' : 'auth-modal-otp-verify-btn');
    const email = this.pendingVerificationEmail;

    if (!email) {
      this.showAuthError('Registration session expired. Please register again.', context);
      this.backToRegister(context);
      return;
    }

    const otp = input ? input.value.trim() : '';
    if (!otp || !/^\d{6}$/.test(otp)) {
      this.showAuthError('Please enter the 6-digit verification code.', context);
      if (input) input.focus();
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Verifying...';
    }
    this.hideAuthError(context);

    try {
      const res = await appState.verifyOTP(email, otp);
      if (res && res.ok) {
        if (this._resendTimer) {
          clearInterval(this._resendTimer);
          this._resendTimer = null;
        }
        this.pendingVerificationEmail = null;
        this.hideCustomerAuthModal();
        this.updateNavBar();
        showToast('Your email has been successfully verified! Welcome to Umaira Florist.', 'success');
        this.handlePendingActionResume();
      } else {
        this.showAuthError(res.error || 'Verification failed. Please check your code.', context);
      }
    } catch (e) {
      this.showAuthError('Verification failed. Please try again.', context);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = isPage ? 'Verify Code & Activate Account' : 'Verify & Activate Account';
      }
    }
  }

  async handleCustomerResendOTP(context = 'modal') {
    const isPage = context === 'page' || this.currentView === 'auth';
    const btn = document.getElementById(isPage ? 'auth-page-otp-resend-btn' : 'auth-modal-otp-resend-btn');
    const email = this.pendingVerificationEmail;
    if (!email) {
      this.showAuthError('No pending verification found. Please register again.', context);
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending...';
    }
    this.hideAuthError(context);

    try {
      const res = await appState.resendOTP(email);
      if (res && res.ok) {
        showToast('A new 6-digit verification code has been sent to your email.', 'success');
        this.startResendCooldownTimer(60, context);
      } else {
        this.showAuthError(res.error || 'Could not resend code. Please try again later.', context);
        if (res.cooldownSeconds) {
          this.startResendCooldownTimer(res.cooldownSeconds, context);
        } else if (btn) {
          btn.disabled = false;
          btn.textContent = 'Resend Code';
        }
      }
    } catch (e) {
      this.showAuthError('Failed to resend code. Please try again.', context);
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Resend Code';
      }
    }
  }

  async getGoogleClientId() {
    if (this._googleClientId !== undefined) return this._googleClientId;
    try {
      const res = await fetch('/api/auth/config');
      const cfg = res.ok ? await res.json() : {};
      this._googleClientId = cfg.googleClientId || '';
    } catch (e) { this._googleClientId = ''; }
    return this._googleClientId;
  }

  async initGoogleAuth() {
    const clientId = await this.getGoogleClientId();
    if (!clientId) return; // Google areas stay hidden
    if (!(window.google && window.google.accounts && window.google.accounts.id)) {
      // Google's script may still be loading; try again shortly.
      if ((this._gsiTries = (this._gsiTries || 0) + 1) < 20) setTimeout(() => this.initGoogleAuth(), 500);
      return;
    }
    {
      try {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => this.handleGoogleCredentialResponse(response),
          auto_select: false,
          cancel_on_tap_outside: true
        });

        const pageBtn = document.getElementById('google-auth-btn-page');
        document.querySelectorAll('[data-google-area]').forEach(el => el.classList.remove('hidden'));
        if (pageBtn) {
          pageBtn.innerHTML = '';
          window.google.accounts.id.renderButton(pageBtn, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            shape: 'pill',
            text: 'continue_with',
            width: 280
          });
        }
        const regBtn = document.getElementById('google-auth-reg-btn-page');
        if (regBtn) {
          regBtn.innerHTML = '';
          window.google.accounts.id.renderButton(regBtn, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            shape: 'pill',
            text: 'continue_with',
            width: 280
          });
        }
      } catch (e) {
        console.warn('Failed to initialize Google Accounts ID:', e);
      }
    }
  }

  // The Google button is drawn by Google's own script. If the shop has not configured
  // GOOGLE_CLIENT_ID on the server, the button is simply not shown (nothing for customers to set up).
  async handleGoogleSignInClick() {
    this.showAuthError('Google sign-in is not available right now. Please use your email and password.');
  }

  async handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) {
      this.showAuthError('Google authentication was cancelled or no credential was received.');
      return;
    }

    try {
      const res = await appState.loginWithGoogle(response.credential);
      if (res && res.ok) {
        this.hideCustomerAuthModal();
        this.updateNavBar();
        showToast(`Signed in with Google as ${res.user.name}!`, 'success');
        this.handlePendingActionResume();
      } else {
        this.showAuthError(res.error || 'Google authentication failed.');
      }
    } catch (e) {
      this.showAuthError('Error communicating with authentication server: ' + e.message);
    }
  }

  async handleCustomerLogout() {
    const ok = await UI.confirm({
      title: 'Sign out of Umaira Florist?',
      message: 'Your cart stays saved to your account, so it will be here when you sign back in.',
      confirmLabel: 'Sign out'
    });
    if (!ok) return;
    this.lastCreatedOrder = null; this._checkoutOrderNumber = null;
    appState.logout();
    this.updateNavBar();
    showToast('You have signed out successfully.', 'info');
    this.navigate('home', true);
  }

  // Header account menu: set the desired tab before navigating so renderView activates it immediately.
  openAccount(section) {
    this._accountSection = section || 'profile';
    if (this.currentView === 'account') {
      // Already on the account page — just switch the tab without a full re-render.
      this.switchAccountTab(this._accountSection);
      this._accountSection = null;
    } else {
      this.navigate('account');
    }
  }

  handlePendingActionResume() {
    const pending = appState.getPendingAction();
    appState.clearPendingAction();
    if (!pending) {
      this.navigate('home');
      return;
    }

    if (pending.type === 'navigate') {
      this.navigate(pending.target);
    } else if (pending.type === 'add_bouquet') {
      this.addPreMadeBouquetToCart(pending.id || pending.bouquetId, pending.qty || 1);
      this.navigate('collections');
    } else if (pending.type === 'buy_now') {
      this.buyNowBouquet(pending.id || pending.bouquetId, pending.qty || 1);
    } else if (pending.type === 'add_custom_bouquet' && pending.item) {
      appState.addToCart(pending.item);
      appState.resetBuilder();
      showToast('Bespoke bouquet saved to your cart!', 'success');
      this.navigate('cart');
    } else if (pending.type === 'add_stem') {
      this.addStemToCustomBuilder(pending.id || pending.flowerId);
      this.navigate('builder');
    } else if (pending.type === 'view_bouquet') {
      this.navigate('collections');
      setTimeout(() => {
        if (typeof window.suOpenBouquet === 'function') {
          window.suOpenBouquet(pending.id);
        }
      }, 250);
    } else {
      this.navigate('home');
    }
  }
}

// Global Toast Dispatcher
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-emerald-900 text-white',
    error: 'bg-red-900 text-white',
    warning: 'bg-amber-900 text-white',
    info: 'bg-rose-950 text-white'
  };

  const icons = {
    success: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
    warning: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>',
    info: '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
  };

  toast.className = `toast flex items-center gap-3 p-4 rounded-2xl shadow-xl text-xs font-medium border border-white/20 ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `
    <span class="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center font-bold text-[10px] shrink-0">${icons[type] || '•'}</span>
    <p class="flex-1"></p>
  `;
  toast.querySelector('p').textContent = message;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);

  setTimeout(() => {
    if (toast.classList && typeof toast.classList.remove === 'function') toast.classList.remove('show');
    setTimeout(() => {
      if (typeof toast.remove === 'function') toast.remove();
    }, 300);
  }, 3500);
}

// Initialize Router
window.appRouter = new AppRouter();
window.buyNowBouquet = (id, q) => window.appRouter.buyNowBouquet(id, q);
window.addPreMadeBouquetToCart = (id, q) => window.appRouter.addPreMadeBouquetToCart(id, q);
