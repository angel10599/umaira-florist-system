/**
 * UMAIRA FLORIST - Account, checkout submission, order confirmation/tracking, password reset and start-up.
 * Load LAST (after site-update.js). Everything here talks to the server; no order, price or
 * account data is ever invented in the browser.
 */
(function () {
  'use strict';
  var router = window.appRouter;
  if (!router) { console.error('account.js: appRouter not found'); return; }
  var proto = Object.getPrototypeOf(router);
  var esc = window.escapeHtml;
  var money = function (n) { return formatCurrency(Number(n) || 0); };
  var $ = function (id) { return document.getElementById(id); };
  var CATALOG_VIEWS = ['home', 'collections', 'builder', 'cart', 'checkout'];

  var inputCls = 'w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-rose-900 focus:border-[#647D69]';
  var cardCls = 'bg-white p-6 rounded-3xl border border-stone-200 shadow-sm';

  // ------------------------------------------------------------------ small helpers
  function fmtDateTime(iso) {
    var d = new Date(iso); if (isNaN(d)) return '';
    return d.toLocaleString('en-PH', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function districtLabel(id) {
    var d = SHOP_RULES.MANILA_DISTRICTS.find(function (x) { return x.id === SHOP_RULES.normalizeDistrictId(id); });
    return d ? d.name + ' — ' + d.areas : (id ? 'District ' + id : '');
  }
  function barangayLabel(b) { return !b ? '' : (/^Barangay/i.test(b) ? b : 'Brgy. ' + b); }
  function paymentBadge(paymentStatus) {
    var s = (paymentStatus || 'Pending').trim();
    var cls = /paid|completed|verified/i.test(s) ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
              /partial/i.test(s) ? 'bg-blue-50 text-blue-800 border border-blue-200' :
              /refund/i.test(s) ? 'bg-purple-50 text-purple-800 border border-purple-200' :
              'bg-amber-50 text-amber-800 border border-amber-200';
    return '<span class="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ' + cls + '">' + esc(s) + '</span>';
  }

  function statusBadge(status) {
    var cls = 'bg-amber-100 text-amber-900 border border-amber-200';
    if (status === 'Delivered — Confirmed' || status === 'Picked Up') cls = 'bg-emerald-100 text-emerald-900 border border-emerald-300';
    else if (status === 'Delivered — Awaiting Confirmation') cls = 'bg-amber-100 text-amber-900 border border-amber-300 ring-2 ring-amber-100';
    else if (status === 'Delivery Disputed') cls = 'bg-rose-100 text-rose-900 border border-rose-300 ring-2 ring-rose-100';
    else if (status === 'Delivery Attempt Failed') cls = 'bg-orange-100 text-orange-900 border border-orange-300';
    else if (/Delivered/i.test(status)) cls = 'bg-emerald-100 text-emerald-900 border border-emerald-200';
    else if (/Rejected|Cancel/.test(status)) cls = 'bg-red-100 text-red-800 border border-red-200';
    else if (status !== 'Pending Confirmation') cls = 'bg-[#EBF1EC] text-[#302C2A] font-bold border border-[#E5ECE6]';
    return '<span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide inline-flex items-center gap-1 ' + cls + '">' + esc(status) + '</span>';
  }
  function loadingPanel(msg) { return '<div class="py-24 text-center text-sm text-stone-500">' + esc(msg || 'Loading…') + '</div>'; }
  function errorPanel(msg, retry) {
    return '<div class="max-w-xl mx-auto my-16 p-6 rounded-3xl bg-red-50 border border-red-200 text-center space-y-3"><p class="text-sm text-red-800">' + esc(msg) + '</p>' +
      (retry ? '<button type="button" onclick="' + retry + '" class="px-5 py-2 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white text-xs font-bold font-semibold">Try again</button>' : '') + '</div>';
  }

  // Server stores custom bouquets as one row per component. Group rows back into bouquets for display.
  function groupItems(items) {
    var groups = [];
    (items || []).forEach(function (it) {
      var g = groups.length ? groups[groups.length - 1] : null;
      // Same rule as the server reports: materials of a custom bouquet, or a flower stored under a bouquet name.
      var isComponent = !!it.bouquetName && it.type !== 'ready_bouquet' &&
        (['filler', 'greenery', 'foliage', 'wrapping', 'ribbon', 'card'].indexOf(it.type) >= 0 || (it.type === 'flower' && it.bouquetName !== it.name));
      if (isComponent && g && g.custom && g.title === it.bouquetName && g.card === (it.cardMessage || '')) { g.parts.push(it); g.total += it.lineTotal; return; }
      if (isComponent) { groups.push({ custom: true, title: it.bouquetName, card: it.cardMessage || '', parts: [it], total: it.lineTotal, qty: 1 }); return; }
      groups.push({ custom: false, title: it.name, card: it.cardMessage || '', parts: [it], total: it.lineTotal, qty: it.quantity });
    });
    return groups;
  }
  function itemsHtml(items) {
    return groupItems(items).map(function (g) {
      var detail = g.custom ? g.parts.map(function (p) { return p.quantity + '× ' + esc(p.name); }).join(', ') : '';
      return '<div class="flex items-start justify-between gap-4 py-2 border-b border-stone-100 text-xs">' +
        '<div><p class="font-bold text-stone-900">' + (g.custom ? '' : g.qty + '× ') + esc(g.title) + '</p>' +
        (detail ? '<p class="text-stone-500">' + detail + '</p>' : '') +
        (g.card ? '<p class="italic text-rose-800 font-serif">Card: “' + esc(g.card) + '”</p>' : '') + '</div>' +
        '<span class="font-mono font-bold text-stone-900 shrink-0">' + money(g.total) + '</span></div>';
    }).join('');
  }
  function totalsHtml(o) {
    return '<div class="border-t border-stone-200 pt-4 space-y-2 text-xs max-w-xs ml-auto">' +
      '<div class="flex justify-between text-stone-600"><span>Subtotal:</span><span class="font-mono font-semibold text-stone-900">' + money(o.subtotal) + '</span></div>' +
      '<div class="flex justify-between text-stone-600"><span>Delivery Fee:</span><span class="font-mono font-semibold text-stone-900">' +
        (o.fulfillment === 'pickup' ? 'None (Store Pickup)' : (o.deliveryFee === 0 ? 'FREE' : money(o.deliveryFee))) + '</span></div>' +
      '<div class="flex justify-between text-base font-bold text-stone-900 border-t border-stone-200 pt-2"><span class="font-semibold">Grand Total:</span><span class="font-bold text-xl text-[#647D69] price">' + money(o.total) + '</span></div></div>';
  }
  function whereHtml(o) {
    if (o.fulfillment === 'pickup') {
      return '<span class="font-bold text-stone-400 uppercase tracking-wider block mb-1">Store Pickup</span>' +
        '<p class="font-semibold text-stone-900">' + esc(SHOP_RULES.info.name) + '</p><p class="text-stone-500">' + esc(SHOP_RULES.info.pickupAddress || SHOP_RULES.info.address) + '</p><p class="text-stone-500">' + esc(SHOP_RULES.info.hoursText) + '</p>';
    }
    return '<span class="font-bold text-stone-400 uppercase tracking-wider block mb-1">Delivery Address (Manila)</span>' +
      '<p class="font-semibold text-stone-900">' + esc(o.address) + '</p>' +
      '<p class="text-stone-600">' + esc(barangayLabel(o.barangay)) + ', ' + esc(o.city || 'Manila') + '</p>' +
      (o.district ? '<p class="text-stone-500 text-[11px]">' + esc(districtLabel(o.district)) + '</p>' : '') +
      (o.notes ? '<p class="text-stone-400 text-[11px] italic mt-1">Delivery note: ' + esc(o.notes) + '</p>' : '');
  }

  // ------------------------------------------------------------------ cart quantity (with stock feedback)
  proto.changeCartQty = function (id, qty) {
    if (Number(qty) <= 0) { this.removeCartItem(id); return; }
    var r = appState.updateCartQuantity(id, qty);
    if (r && r.ok === false && r.capped !== undefined) showToast('Only ' + r.capped + ' available in stock.', 'warning');
  };

  proto.removeCartItem = function (id) {
    if (this.selectedCartItemIds) {
      this.selectedCartItemIds.delete(id);
    }
    var idx = appState.cart.findIndex(function (i) { return i.cartItemId === id; });
    if (idx < 0) return;
    var item = appState.cart[idx];
    appState.removeFromCart(id);
    UI.undo((item.name || 'Item') + ' removed from your cart.', function () { appState.restoreCartItems([{ item: item, index: idx }]); });
  };
  proto.clearCartWithUndo = function () {
    if (this.selectedCartItemIds) {
      this.selectedCartItemIds.clear();
    }
    var all = appState.cart.map(function (item, index) { return { item: item, index: index }; });
    if (!all.length) return;
    appState.clearCart();
    UI.undo('Cart cleared.', function () { appState.restoreCartItems(all); });
  };

  // ------------------------------------------------------------------ checkout
  // Order numbers use the shop's calendar date (Asia/Manila), same as the server.
  function newOrderNumber() {
    return '#FLR-' + SHOP_RULES.manilaNow().date.replace(/-/g, '') + '-' + String(Math.floor(1000 + Math.random() * 9000));
  }
  var origInitCheckout = proto.initCheckoutForm;
  proto.initCheckoutForm = function () {
    origInitCheckout.call(this);
    // One order number per checkout attempt: a double click or retry can never create two orders.
    if (!this._checkoutOrderNumber) this._checkoutOrderNumber = newOrderNumber();
    var u = appState.getCurrentUser() || {};
    var set = function (id, v) { var el = $(id); if (el && !el.value && v) el.value = v; };
    var parts = String(u.name || '').trim().split(/\s+/);
    set('chk-first-name', parts[0] || '');
    set('chk-last-name', parts.slice(1).join(' '));
    set('chk-phone', u.phone || '');
    set('chk-email', u.email || '');
    var a = u.address || {};
    set('chk-address', a.street || '');
    if (a.district && $('chk-district') && !$('chk-district').value) {
      $('chk-district').value = SHOP_RULES.normalizeDistrictId(a.district) || '';
      this.onDistrictChange($('chk-district').value);
      if (a.barangay && $('chk-barangay')) $('chk-barangay').value = a.barangay;
    }
  };

  proto.handlePlaceOrder = async function (e) {
    e.preventDefault();
    if (this._placingOrder) return; // ignore double clicks while a request is in flight
    var val = function (id) { return (($(id) || {}).value || '').trim(); };
    var pickup = this.checkoutFulfillment === 'pickup';

    if (window.appState && typeof window.appState.isAcceptingOrders === 'function' && !window.appState.isAcceptingOrders()) {
      showToast('Online ordering is temporarily paused. Please check back later.', 'warning');
      return;
    }
    if (pickup && window.appState && typeof window.appState.isPickupEnabled === 'function' && !window.appState.isPickupEnabled()) {
      showToast('Store pickup is currently unavailable. Please select delivery.', 'warning');
      return;
    }
    if (!pickup && window.appState && typeof window.appState.isDeliveryEnabled === 'function' && !window.appState.isDeliveryEnabled()) {
      showToast('Delivery service is currently unavailable. Please select store pickup.', 'warning');
      return;
    }

    var input = {
      fulfillment: this.checkoutFulfillment,
      firstName: val('chk-first-name'), lastName: val('chk-last-name'), phone: val('chk-phone'), email: val('chk-email'),
      address: pickup ? '' : val('chk-address'), district: pickup ? '' : val('chk-district'), barangay: pickup ? '' : val('chk-barangay'),
      city: pickup ? '' : 'Manila', notes: pickup ? '' : val('chk-notes'), date: val('chk-date'), time: val('chk-time'),
      paymentMethod: (document.querySelector('input[name="paymentMethod"]:checked') || {}).value || '', giftMessage: val('chk-gift-message')
    };
    var errors = SHOP_RULES.validateOrderInput(input);
    this.showCheckoutErrors(errors);
    if (Object.keys(errors).length) return;
    
    var self = this;
    var checkoutItems = typeof self.getCheckoutItems === 'function' ? self.getCheckoutItems() : appState.cart;
    if (!checkoutItems.length) { showToast('Please select at least one available bouquet from your cart to checkout.', 'warning'); this.navigate('cart'); return; }

    var submitError = $('chk-submit-error'), btn = $('chk-submit-btn');
    submitError.classList.add('hidden');
    this._placingOrder = true; btn.disabled = true; btn.textContent = 'Checking your order…';
    try {
      // Re-price against the live catalog first, so the total shown below is the one the shop will charge.
      await appState.loadCatalog();
      checkoutItems = typeof self.getCheckoutItems === 'function' ? self.getCheckoutItems() : appState.cart;
      if (!checkoutItems.length) { showToast('Selected bouquets are no longer available.', 'warning'); this.navigate('cart'); return; }
      
      var subtotal = checkoutItems.reduce(function (sum, item) { return sum + (Number(item.price) || 0) * (Number(item.quantity) || 1); }, 0);
      var fee = pickup ? 0 : appState.getDeliveryFee(subtotal);
      var count = checkoutItems.reduce(function (sum, item) { return sum + (Number(item.quantity) || 1); }, 0);
      var placed = null;
      var confirmed = await UI.confirm({
        title: 'Place this order?',
        message: 'Your order goes to the shop for confirmation. Please check the details below.',
        details: [
          ['Fulfillment', pickup ? 'Store pickup' : 'Manila delivery'],
          [pickup ? 'Pick up at' : 'Deliver to', pickup ? (SHOP_RULES.info.pickupAddress || SHOP_RULES.info.address) : input.address + ', ' + barangayLabel(input.barangay)],
          ['Schedule', input.date + ', ' + input.time],
          ['Payment', input.paymentMethod],
          ['Items', count + (count === 1 ? ' item' : ' items')],
          ['Delivery fee', pickup ? 'None' : (fee === 0 ? 'Free' : money(fee))],
          ['Total', money(subtotal + fee)]
        ],
        confirmLabel: 'Place order',
        busyLabel: 'Placing order…',
        onConfirm: async function () {
          var r = await appState.api('/api/orders', { method: 'POST', body: Object.assign({}, input, {
            orderNumber: self._checkoutOrderNumber,
            items: checkoutItems.map(function (i) {
              return {
                cartItemId: i.cartItemId,
                id: i.id,
                isCustom: !!i.isCustom,
                customKey: i.customKey || (i.isCustom ? JSON.stringify(i.specs) : ''),
                name: i.name,
                quantity: i.quantity,
                message: i.message || '',
                specs: i.isCustom ? i.specs : undefined
              };
            })
          }) });
          if (r.ok) { placed = r.data; return { ok: true }; }
          // The order was NOT placed. Say so plainly; never show a success page.
          if (r.network) return { ok: false, error: 'We could not reach the shop. Your order has NOT been placed — please check your connection and try again.' };
          var msg;
          if (r.status === 401) msg = 'Your session has expired. Please sign in again; your cart is saved.';
          else if (r.status === 400 && r.data && r.data.errors) { self.showCheckoutErrors(r.data.errors); msg = r.data.error || 'Please check the highlighted fields.'; }
          else msg = (r.data && r.data.error) || 'We could not place your order. Please try again.';
          if (r.status >= 500) return { ok: false, error: msg }; // retry from the dialog: the same order number prevents duplicates
          if (r.status === 409 && r.data && r.data.code === 'ORDER_NUMBER_TAKEN') {
            self._checkoutOrderNumber = newOrderNumber(); // rare clash with another customer's number: retry safely
            return { ok: false, error: 'Please press "Place order" once more to finish.' };
          }
          if (r.status === 400 || r.status === 409) await appState.loadCatalog(); // stock/price changed: refresh the cart
          submitError.textContent = msg; submitError.classList.remove('hidden');
          return { ok: false, close: true };
        }
      });
      if (!confirmed) return; // cancelled, or the server refused: nothing was created

      // Order successfully confirmed: remove only the purchased items from selection and local cart
      var orderedIds = new Set(checkoutItems.map(function (i) { return i.cartItemId; }));
      if (self.selectedCartItemIds) {
        orderedIds.forEach(function (id) { self.selectedCartItemIds.delete(id); });
      }
      appState.cart = appState.cart.filter(function (i) { return !orderedIds.has(i.cartItemId); });
      appState.persistCart(); // (was appState.saveCart(), which does not exist and aborted the confirmation page)

      if (typeof self.clearBuyNowItem === 'function') {
        self.clearBuyNowItem();
      } else {
        self.buyNowItem = null;
      }

      var detail = await appState.fetchOrder(placed.orderNumber);
      this.lastCreatedOrder = detail.ok ? detail.order : Object.assign({ firstName: input.firstName, lastName: input.lastName, items: [] }, input, placed);
      this._checkoutOrderNumber = null;
      await appState.loadServerCart();
      appState.ordersLoaded = false;
      this.navigate('confirmation');
    } finally {
      this._placingOrder = false;
      var b2 = $('chk-submit-btn'); if (b2) { b2.disabled = false; b2.textContent = 'Place Order'; }
    }
  };

  // ------------------------------------------------------------------ confirmation
  proto.renderConfirmationView = function () {
    var o = this.lastCreatedOrder;
    if (!o) {
      setTimeout(function () { router.navigate('account'); }, 0);
      var loadingHtml = loadingPanel('Opening your orders…');
      if (typeof window.wrapCustomerViewWithDecor === 'function') {
        return window.wrapCustomerViewWithDecor('confirmation', loadingHtml);
      }
      return loadingHtml;
    }
    var num = esc(o.orderNumber);
    var isClosed = typeof SHOP_RULES !== 'undefined' && typeof SHOP_RULES.isShopOpen === 'function' ? !SHOP_RULES.isShopOpen() : false;
    var nextOpen = typeof SHOP_RULES !== 'undefined' && typeof SHOP_RULES.getNextOpeningText === 'function' ? SHOP_RULES.getNextOpeningText() : 'during next operating hours';

    var innerHtml = '<div class="py-12 px-6 max-w-4xl mx-auto space-y-8 animate-fade-in">' +
      '<div class="text-center space-y-3">' +
        '<div class="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto shadow-sm"><svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg></div>' +
        '<span class="text-xs font-bold text-emerald-700 uppercase tracking-widest">' + (isClosed ? 'Order Placed Successfully!' : 'Order Received') + '</span>' +
        '<h1 class="font-serif text-3xl sm:text-4xl font-bold text-stone-900">' + (isClosed ? 'Order Placed Successfully!' : 'Thank You, ' + esc(o.firstName) + '!') + '</h1>' +
        (isClosed ?
          '<div class="max-w-lg mx-auto p-4 rounded-2xl bg-[#FFF9F5] border border-[#647D69]/30 text-stone-700 text-sm space-y-1">' +
            '<p class="font-bold text-[#344F3B]">Shop Currently Closed — 24/7 Order Received</p>' +
            '<p class="text-xs text-[#6E6864]">Thank you for your order! Our physical shop is currently closed, but we\'ll begin processing your order when we reopen (' + esc(nextOpen) + ').</p>' +
            '<p class="text-xs text-stone-500">Your order <strong class="font-mono text-[#647D69]">' + num + '</strong> is <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">' + esc(o.status || 'Pending Confirmation') + '</span>.</p>' +
          '</div>' :
          '<p class="text-stone-600 text-sm max-w-md mx-auto">Your order <strong class="font-mono text-[#647D69]">' + num + '</strong> has been received and is <span class="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 text-xs font-bold">' + esc(o.status || 'Pending Confirmation') + '</span>. The shop will confirm it shortly.</p>'
        ) +
      '</div>' +
      (o.fulfillment === 'pickup' ? '<div class="max-w-2xl mx-auto p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-sm text-emerald-900 text-center"><p class="font-bold">Store Pickup — this order will not be delivered.</p><p class="text-xs mt-1">Collect it at ' + esc(SHOP_RULES.info.pickupAddress || SHOP_RULES.info.address) + ' on ' + esc(o.date) + ' (' + esc(o.time) + ').</p></div>' : '') +
      '<div id="printable-receipt" class="bg-white p-8 rounded-3xl border border-stone-200 shadow-floral space-y-6">' +
        '<div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-200 pb-4 gap-2"><div><span class="font-serif text-2xl font-bold text-rose-950">' + esc(SHOP_RULES.info.name) + '</span><p class="text-xs text-stone-500">' + esc(SHOP_RULES.info.address) + '</p></div>' +
          '<div class="text-left sm:text-right"><span class="text-xs text-stone-400 block font-mono">Order Number</span><span class="font-mono font-bold text-stone-900 text-base">' + num + '</span><span class="text-[11px] text-stone-400 block">' + esc(fmtDateTime(o.createdAt)) + '</span></div></div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs border-b border-stone-200 pb-6">' +
          '<div><span class="font-bold text-stone-400 uppercase tracking-wider block mb-1">Customer</span><p class="font-semibold text-stone-900">' + esc(o.firstName + ' ' + o.lastName) + '</p><p class="text-stone-500">' + esc(o.phone) + '</p><p class="text-stone-500">' + esc(o.email) + '</p></div>' +
          '<div>' + whereHtml(o) + '</div>' +
          '<div><span class="font-bold text-stone-400 uppercase tracking-wider block mb-1">' + (o.fulfillment === 'pickup' ? 'Pickup' : 'Delivery') + ' Schedule &amp; Payment</span><p class="font-semibold text-stone-900">' + esc(o.date) + '</p><p class="text-stone-500">' + esc(o.time) + '</p><p class="text-[#647D69] font-bold mt-1">' + esc(SHOP_RULES.paymentMethodLabel(o.paymentMethod)) + ' (' + esc(o.paymentStatus || 'Unpaid') + ')</p></div></div>' +
        '<div class="space-y-1"><h4 class="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Bouquets &amp; Items</h4>' + itemsHtml(o.items) + '</div>' +
        (o.giftMessage ? '<p class="text-xs text-stone-600 font-medium">Delivery Instructions: “' + esc(o.giftMessage) + '”</p>' : '') +
        totalsHtml(o) + '</div>' +
      // How to pay (GCash / BDO details + proof form, or cash instructions) right after placing the order.
      (window.customerPayments ? '<div class="no-print">' + window.customerPayments.panelHtml(o) + '</div>' : '') +
      '<div class="flex flex-wrap items-center justify-center gap-4 no-print">' +
        '<button type="button" onclick="window.appRouter.viewOrderTracking(\'' + num + '\')" class="py-3.5 px-8 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold shadow-xs hover:shadow text-sm shadow-lg shadow-rose-900/25 transition">Track My Order</button>' +
        '<button type="button" onclick="window.print()" class="py-3.5 px-6 rounded-2xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 font-bold text-sm transition">Print / Save Receipt</button>' +
        '<button type="button" onclick="window.appRouter.navigate(\'account\')" class="py-3.5 px-6 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-sm transition">My Orders</button></div></div>';

    if (typeof window.wrapCustomerViewWithDecor === 'function') {
      return window.wrapCustomerViewWithDecor('confirmation', innerHtml);
    }
    return innerHtml;
  };

  // ------------------------------------------------------------------ tracking
  // Store pickup is confirmed by both sides: the shop confirms the handover, then the customer confirms receipt.
  var PICKUP_STAGES = ['Pending Confirmation', 'Confirmed', 'Preparing', 'Ready for Pickup', 'Awaiting Customer Confirmation', 'Picked Up'];
  var DELIVERY_STAGES = ['Pending Confirmation', 'Confirmed', 'Preparing', 'Rider Assigned', 'On the Way', 'Delivered'];

  proto.renderTrackingView = function () {
    var innerHtml = '<div class="py-12 px-6 max-w-5xl mx-auto space-y-8">' +
      '<div class="text-center max-w-xl mx-auto space-y-3"><span class="text-xs font-bold text-[#647D69] uppercase tracking-widest">Order Tracking</span>' +
      '<h1 class="font-serif text-3xl sm:text-4xl font-bold text-stone-900">Track Your Floral Order</h1>' +
      '<p class="text-stone-600 text-sm">Enter an order number from your confirmation, or pick one of your recent orders. You can only view orders placed from your own account.</p>' +
      '<form onsubmit="window.appRouter.searchTrackingOrder(event); return false;" class="flex items-center gap-2 pt-2">' +
        '<input type="text" id="track-order-input" placeholder="e.g. #FLR-20261006-0001" class="w-full p-3 bg-white border border-stone-300 rounded-2xl text-sm font-mono focus:ring-2 focus:ring-rose-500 shadow-sm">' +
        '<button type="submit" id="track-order-btn" class="py-3 px-6 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold shadow-xs hover:shadow text-sm hover:bg-rose-800 transition shrink-0 shadow-sm">Track</button></form></div>' +
      '<div id="track-result">' + loadingPanel('Loading your orders…') + '</div></div>';

    if (typeof window.wrapCustomerViewWithDecor === 'function') {
      return window.wrapCustomerViewWithDecor('tracking', innerHtml);
    }
    return innerHtml;
  };

  // "If we don't hear from you by …" — shown while the order waits for the customer's answer.
  function deadlineNote(o) {
    return o.confirmationDeadline ? '<p class="text-[11px] text-stone-500">If we don\'t hear from you by <strong class="text-[#302C2A]">' + esc(fmtDateTime(o.confirmationDeadline)) + '</strong>, the order will be marked as received automatically.</p>' : '';
  }
  function autoConfirmedHtml(what, hours) {
    return '<div class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">' +
      '<svg class="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>' +
      '<div><div class="font-bold text-sm text-emerald-800">' + esc(what) + ' Completed</div><div class="text-[11px] text-emerald-700 mt-0.5">Marked as received automatically because no issue was reported within ' + hours + ' hours. Thank you for choosing Umaira Florist!</div></div></div>';
  }
  function deadlineHours(kind) {
    var d = SHOP_RULES.CONFIRMATION_DEADLINES && SHOP_RULES.CONFIRMATION_DEADLINES[kind];
    return d ? d.autoConfirmAfterHours : (kind === 'pickup' ? 24 : 48);
  }

  // Two-way store pickup confirmation panel (same look as the delivery confirmation block).
  function pickupConfirmHtml(o) {
    if (o.fulfillment !== 'pickup' || !o.pickupHandoverAt) return '';
    var auto = o.status === 'Picked Up' && o.customerConfirmationStatus === 'auto';
    var rows = '<div class="text-[11px] text-[#6E6864] space-y-0.5">' +
      '<p><strong class="text-[#302C2A]">Shop confirmed handover:</strong> ' + esc(fmtDateTime(o.pickupHandoverAt)) + '</p>' +
      (o.customerConfirmedAt && o.status === 'Picked Up' ? '<p><strong class="text-[#302C2A]">' + (auto ? 'Confirmed automatically:' : 'You confirmed receipt:') + '</strong> ' + esc(fmtDateTime(o.customerConfirmedAt)) + '</p>' : '') + '</div>';
    var block;
    if (auto) {
      block = autoConfirmedHtml('Pickup', deadlineHours('pickup'));
    } else if (o.status === 'Picked Up') {
      block = '<div class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">' +
        '<svg class="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg>' +
        '<div><div class="font-bold text-sm text-emerald-800">Pickup Confirmed by You and the Shop</div><div class="text-[11px] text-emerald-700 mt-0.5">Thank you for choosing Umaira Florist!</div></div></div>';
    } else if (o.status === 'Pickup Disputed') {
      block = '<div class="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2 text-xs text-rose-900">' +
        '<div class="font-bold text-rose-800">Pickup Issue Reported — Under Review</div>' +
        '<p class="text-[11px] text-rose-700"><strong>Your report:</strong> ' + esc(o.customerDisputeReason || 'Order not received') + '</p>' +
        '<p class="text-[11px] text-stone-500">The shop will contact you. If you have since received your order, you can still confirm it:</p>' +
        '<button type="button" onclick="window.customerDelivery.confirmDelivery(\'' + esc(o.orderNumber) + '\', true)" class="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition">Confirm Received</button></div>';
    } else if (o.status === 'Awaiting Customer Confirmation') {
      block = '<div class="p-4 rounded-2xl bg-[#FFF9F5] border border-[#EBF1EC] space-y-2.5">' +
        '<p class="text-xs text-[#302C2A] font-medium leading-relaxed">The shop has confirmed that your order was handed over to you. Please confirm that you received it:</p>' +
        '<div class="flex flex-wrap items-center gap-2.5 pt-1">' +
          '<button type="button" onclick="window.customerDelivery.confirmDelivery(\'' + esc(o.orderNumber) + '\', true)" class="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition flex items-center gap-1.5">' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg><span>Confirm Received</span></button>' +
          '<button type="button" onclick="window.customerDelivery.openDisputeModal(\'' + esc(o.orderNumber) + '\', \'pickup\')" class="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition">I Did Not Receive It — Report an Issue</button>' +
        '</div>' + deadlineNote(o) + '</div>';
    } else {
      return '';
    }
    return '<div class="p-5 sm:p-6 rounded-3xl bg-[rgba(255,249,245,0.98)] border border-[#E5ECE6] space-y-3">' +
      '<div class="flex items-center gap-2 border-b border-[#E5ECE6] pb-3"><span class="w-2.5 h-2.5 rounded-full bg-[#647D69]"></span>' +
      '<h4 class="font-serif text-sm sm:text-base font-bold text-[#302C2A]">Store Pickup Confirmation</h4></div>' + rows + block + '</div>';
  }

  function trackingResultHtml(o) {
    var pickup = o.fulfillment === 'pickup';
    var stages = pickup ? PICKUP_STAGES : DELIVERY_STAGES;
    var cancelled = /Rejected|Cancel/.test(o.status);
    var cur = stages.indexOf(o.status);
    if (cur === -1) {
      if (o.status === 'Pickup Disputed') cur = stages.indexOf('Awaiting Customer Confirmation');
      else if (o.status === 'Delivery Attempt Failed') cur = Math.max(0, stages.indexOf('On the Way'));
      else if (/Delivered|Disputed/i.test(o.status)) cur = stages.length - 1;
      else if (/Out for Delivery|On the Way|Rider/i.test(o.status)) cur = Math.max(0, stages.indexOf('On the Way'));
      else cur = 0;
    }
    var timeline = stages.map(function (label, idx) {
      var past = !cancelled && idx < cur, current = !cancelled && idx === cur;
      var bubble = past ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : (current ? 'bg-[#647D69] text-white border-[#647D69] ring-4 ring-rose-200 tracking-current-step' : 'bg-stone-100 text-stone-400 border-stone-300');
      return '<div class="relative flex-1 flex flex-col items-center text-center"><div class="w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold text-sm z-10 ' + bubble + '">' +
        (past ? '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : (idx + 1)) + '</div>' +
        '<span class="mt-2 text-xs font-bold ' + (current ? 'text-[#647D69]' : (past ? 'text-stone-900' : 'text-stone-400')) + '">' + esc(label) + '</span>' +
        (current ? '<span class="mt-0.5 text-[10px] font-semibold text-rose-700 bg-[#FFF9F5] px-2 py-0.5 rounded-full">Current Stage</span>' : '') + '</div>';
    }).join('');

    var mobileTimeline = stages.map(function (label, idx) {
      var past = !cancelled && idx < cur, current = !cancelled && idx === cur;
      var icon = past ? '<span class="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center p-1"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg></span>' :
        (current ? '<span class="w-6 h-6 rounded-full bg-[#647D69] text-white flex items-center justify-center text-xs font-bold ring-2 ring-rose-200 tracking-current-step">' + (idx + 1) + '</span>' :
        '<span class="w-6 h-6 rounded-full bg-stone-100 text-stone-400 flex items-center justify-center text-xs border border-stone-300">' + (idx + 1) + '</span>');
      return '<div class="flex items-center gap-3 py-1.5 ' + (current ? 'font-bold text-[#647D69]' : (past ? 'text-stone-800' : 'text-stone-400')) + '">' +
        icon + '<span class="text-xs">' + esc(label) + (current ? ' (Current Stage)' : '') + '</span></div>';
    }).join('');

    var podHtml = '';
    if (o.podPhotoUrl) {
      var confirmBlock = '';
      if (o.customerConfirmationStatus === 'auto') {
        confirmBlock = autoConfirmedHtml('Delivery', deadlineHours('delivery'));
      } else if (o.customerConfirmationStatus === 'confirmed') {
        confirmBlock = '<div class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-2.5 text-xs text-emerald-900">' +
          '<svg class="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>' +
          '<div><div class="font-bold text-sm text-emerald-800">Delivery Confirmed by You</div><div class="text-[11px] text-emerald-700 mt-0.5">Receipt confirmed on ' + esc(fmtDateTime(o.customerConfirmedAt)) + '. Thank you for choosing Umaira Florist!</div></div></div>';
      } else if (o.customerConfirmationStatus === 'disputed') {
        confirmBlock = '<div class="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-2 text-xs text-rose-900">' +
          '<div class="flex items-center gap-2 font-bold text-rose-800"><svg class="w-4 h-4 text-rose-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg><span>Delivery Disputed — Under Investigation</span></div>' +
          '<p class="text-[11px] text-rose-700"><strong>Your Report:</strong> ' + esc(o.customerDisputeReason || 'Reported not received') + '</p>' +
          (o.customerDisputePhotoUrl ? '<div class="flex items-center gap-2 pt-1"><span class="text-[11px] text-[#6E6864]">Your issue photo:</span><button type="button" onclick="window.customerDelivery.openLightbox(\'' + esc(o.customerDisputePhotoUrl) + '\', \'Dispute Issue Photo\', \'Customer uploaded evidence\')" class="text-[11px] font-bold text-[#647D69] hover:underline">View Uploaded Photo</button></div>' : '') +
          (o.disputeResolvedAt ? '<div class="p-2.5 bg-white/80 rounded-xl text-[11px] text-emerald-800 border border-emerald-200 mt-2"><strong>Atelier Resolution:</strong> ' + esc(o.disputeResolutionNotes || 'Resolved') + ' (' + esc(fmtDateTime(o.disputeResolvedAt)) + ')</div>' : '<p class="text-[11px] text-stone-500 italic">Our concierge team is contacting the courier and reviewing delivery timestamps.</p>') +
          '</div>';
      } else if (o.customerConfirmationStatus === 'resolved') {
        confirmBlock = '<div class="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">' +
          '<div class="font-bold text-emerald-800">Dispute Resolved by Atelier Concierge</div>' +
          '<div class="text-[11px] text-emerald-700 mt-0.5">' + esc(o.disputeResolutionNotes || 'Case closed.') + ' (' + esc(fmtDateTime(o.disputeResolvedAt)) + ')</div></div>';
      } else {
        confirmBlock = '<div class="p-4 rounded-2xl bg-[#FFF9F5] border border-[#EBF1EC] space-y-2.5">' +
          '<p class="text-xs text-[#302C2A] font-medium leading-relaxed">Your order has been marked as delivered. Please review the delivery photo and confirm if you received it:</p>' +
          '<div class="flex flex-wrap items-center gap-2.5 pt-1">' +
            '<button type="button" onclick="window.customerDelivery.confirmDelivery(\'' + esc(o.orderNumber) + '\', true)" class="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition flex items-center gap-1.5">' +
              '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' +
              '<span>Yes, I Received It</span>' +
            '</button>' +
            '<button type="button" onclick="window.customerDelivery.openDisputeModal(\'' + esc(o.orderNumber) + '\')" class="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition flex items-center gap-1.5">' +
              '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
              '<span>No, I Haven\'t Received It</span>' +
            '</button>' +
          '</div>' + deadlineNote(o) +
        '</div>';
      }

      podHtml = '<div class="p-5 sm:p-6 rounded-3xl bg-[rgba(255,249,245,0.98)] border border-[#E5ECE6] space-y-4">' +
        '<div class="flex items-center justify-between border-b border-[#E5ECE6] pb-3">' +
          '<div class="flex items-center gap-2">' +
            '<span class="w-2.5 h-2.5 rounded-full bg-[#647D69]"></span>' +
            '<h4 class="font-serif text-sm sm:text-base font-bold text-[#302C2A]">Proof of Delivery (POD)</h4>' +
          '</div>' +
          '<span class="text-[11px] text-[#6E6864]">Delivered ' + esc(fmtDateTime(o.podDeliveredAt)) + '</span>' +
        '</div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-3 gap-5 items-start">' +
          '<div class="relative group cursor-pointer overflow-hidden rounded-2xl border border-[#E5ECE6] bg-stone-100 aspect-4/3" onclick="window.customerDelivery.openLightbox(\'' + esc(o.podPhotoUrl) + '\', \'Order #' + esc(o.orderNumber) + ' Delivery Photo\', \'Verified handover by ' + esc(o.podAdmin || 'Atelier Courier') + '\')">' +
            '<img src="' + esc(o.podPhotoUrl) + '" alt="Proof of delivery" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />' +
            '<div class="absolute inset-0 bg-stone-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5">' +
              '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"/></svg>' +
              '<span>Click to Enlarge</span>' +
            '</div>' +
          '</div>' +
          '<div class="sm:col-span-2 space-y-3">' +
            '<div>' +
              '<p class="text-xs text-[#302C2A] font-semibold">Verified by: <span class="font-normal text-[#6E6864]">' + esc(o.podAdmin || 'Admin') + '</span></p>' +
              (o.podNotes ? '<p class="text-xs text-[#302C2A] font-semibold mt-1">Delivery Notes: <span class="font-normal text-[#6E6864]">' + esc(o.podNotes) + '</span></p>' : '') +
            '</div>' +
            confirmBlock +
          '</div>' +
        '</div>' +
      '</div>';
    }

    return '<div class="bg-white p-6 sm:p-8 rounded-3xl border border-stone-200 shadow-floral space-y-8 animate-fade-in">' +
      '<div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-200 pb-4 gap-3">' +
        '<div>' +
          '<div class="flex items-center gap-2">' +
            '<span class="text-xs text-stone-400 font-mono">Tracking Order</span>' +
            '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ' + (pickup ? 'bg-amber-100 text-amber-900' : 'bg-rose-100 text-[#647D69]') + '">' + (pickup ? 'Store Pickup' : 'Manila Delivery') + '</span>' +
          '</div>' +
          '<h3 class="font-mono text-2xl font-bold text-[#647D69] mt-1">' + esc(o.orderNumber) + '</h3>' +
          '<p class="text-[11px] text-stone-400">Placed ' + esc(fmtDateTime(o.createdAt)) + ' · Last update ' + esc(fmtDateTime(o.updatedAt)) + '</p>' +
        '</div>' +
        '<div class="flex items-center gap-2">' +
          statusBadge(o.status) +
        '</div>' +
      '</div>' +
      (cancelled ? '<div class="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-900 space-y-1"><div class="font-bold text-sm">This order was cancelled / not accepted</div><p class="text-xs text-red-700">' + esc(o.rejectReason || 'The shop was unable to fulfil this order.') + '</p></div>' :
        '<div>' +
          '<div class="hidden sm:block relative py-4"><div class="absolute top-9 left-6 right-6 h-1 bg-stone-200 -translate-y-1/2 z-0"><div class="h-full bg-emerald-600 transition-all duration-500" style="width:' + (cur / (stages.length - 1)) * 100 + '%"></div></div><div class="flex justify-between relative z-10">' + timeline + '</div></div>' +
          '<div class="sm:hidden bg-stone-50 p-4 rounded-2xl border border-stone-200 space-y-1 mb-4">' + mobileTimeline + '</div>' +
        '</div>') +
      (o.grabTrackingUrl && /^https:\/\//.test(o.grabTrackingUrl) ? '<div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row items-center justify-between gap-4"><div><span class="text-xs font-bold text-emerald-900 uppercase tracking-wider block">Live Delivery Partner</span><p class="text-xs text-emerald-700 mt-0.5">Follow your delivery with our courier partner.</p></div>' +
        '<a href="' + esc(o.grabTrackingUrl) + '" target="_blank" rel="noopener noreferrer" class="px-5 py-2.5 bg-[#00b14f] hover:bg-[#009b45] text-white rounded-xl text-xs font-bold shadow-sm transition shrink-0">Track Delivery via Grab</a></div>' : '') +
      (o.status === 'Delivery Attempt Failed' ? '<div class="p-4 rounded-2xl bg-orange-50 border border-orange-200 text-orange-900 space-y-1"><div class="font-bold text-sm">Delivery Attempt Unsuccessful</div><p class="text-xs">' + esc(o.deliveryFailedReason || 'The courier could not deliver your order.') + '</p><p class="text-[11px] text-orange-800">The shop will contact you to arrange another delivery.</p></div>' : '') +
      podHtml + pickupConfirmHtml(o) +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs"><div class="bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-1">' + whereHtml(o) + '<p class="text-stone-500 pt-1">Scheduled: ' + esc(o.date) + ' • ' + esc(o.time) + '</p></div>' +
        (window.customerPayments ? '<div class="sm:col-span-2">' + window.customerPayments.panelHtml(o) + '</div>'
          : '<div class="bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-1"><span class="font-bold text-stone-400 uppercase tracking-wider block mb-1">Payment</span><p class="font-semibold text-stone-900">' + esc(SHOP_RULES.paymentMethodLabel(o.paymentMethod)) + '</p><p class="text-stone-500">' + esc(o.paymentStatus) + '</p></div>') + '</div>' +
      '<div><h4 class="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Bouquets &amp; Items</h4>' + itemsHtml(o.items) + '</div>' + totalsHtml(o) + '</div>';
  }

  proto.loadTrackingResult = async function (orderNumber) {
    var box = $('track-result'); if (!box) return;
    if (orderNumber) {
      box.innerHTML = loadingPanel('Looking up ' + orderNumber + '…');
      var r = await appState.fetchOrder(orderNumber);
      box = $('track-result'); if (!box) return;
      if (r.ok) { box.innerHTML = trackingResultHtml(r.order); var inp = $('track-order-input'); if (inp) inp.value = r.order.orderNumber; return; }
      box.innerHTML = r.status === 404 ? '<div class="bg-white p-12 rounded-3xl border border-stone-200 text-center space-y-2 shadow-sm"><h3 class="font-serif font-bold text-stone-900 text-lg">No order found</h3><p class="text-stone-500 text-xs">We could not find that order number on your account. Please check it against your confirmation.</p></div>' : errorPanel((r.error || 'Could not load the order.'), "window.appRouter.loadTrackingResult('" + esc(orderNumber) + "')");
      return;
    }
    await appState.refreshOrders();
    box = $('track-result'); if (!box) return;
    if (appState.ordersError) { box.innerHTML = errorPanel('We could not load your orders.', 'window.appRouter.loadTrackingResult()'); return; }
    if (!appState.orders.length) { box.innerHTML = '<div class="bg-white p-12 rounded-3xl border border-stone-200 text-center space-y-3 shadow-sm"><h3 class="font-serif font-bold text-stone-900 text-lg">You have no orders yet</h3><p class="text-stone-500 text-xs">Once you place an order you can follow it here.</p><button type="button" onclick="window.appRouter.navigate(\'collections\')" class="px-5 py-2 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white text-xs font-bold font-semibold">Browse Collections</button></div>'; return; }
    var chips = appState.orders.slice(0, 6).map(function (o) { return '<button type="button" onclick="window.appRouter.loadTrackingResult(\'' + esc(o.orderNumber) + '\')" class="px-3 py-1.5 rounded-full bg-white border border-stone-200 hover:border-rose-300 text-[11px] font-mono text-stone-700">' + esc(o.orderNumber) + '</button>'; }).join('');
    box.innerHTML = '<div class="flex flex-wrap gap-2 justify-center mb-6">' + chips + '</div>' + trackingResultHtml(appState.orders[0]);
    var inp = $('track-order-input'); if (inp) inp.value = appState.orders[0].orderNumber;
  };

  proto.searchTrackingOrder = function (event) {
    if (event && event.preventDefault) event.preventDefault();
    var q = (($('track-order-input') || {}).value || '').trim();
    if (!q) { showToast('Please enter an order number to track.', 'warning'); return; }
    this.loadTrackingResult(q);
  };
  window.toggleOrderTracking = function (orderNumber) {
    var panel = document.getElementById('order-track-' + orderNumber);
    var btn = document.getElementById('order-track-btn-' + orderNumber);
    if (!panel) return;
    var isHidden = panel.classList.contains('hidden');
    if (isHidden) {
      panel.classList.remove('hidden');
      if (btn) btn.innerHTML = '<span>Hide Tracking Details</span> <span aria-hidden="true">↑</span>';
    } else {
      panel.classList.add('hidden');
      if (btn) btn.innerHTML = '<span>Track Order Progress</span> <span aria-hidden="true">↓</span>';
    }
  };
  proto.viewOrderTracking = function (orderNumber) {
    if (this.currentView === 'account') {
      var panel = document.getElementById('order-track-' + orderNumber);
      if (panel) {
        panel.classList.remove('hidden');
        var btn = document.getElementById('order-track-btn-' + orderNumber);
        if (btn) btn.innerHTML = '<span>Hide Tracking Details</span> <span aria-hidden="true">↑</span>';
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        return;
      }
    }
    this.navigate('tracking');
    var self = this; setTimeout(function () { self.loadTrackingResult(orderNumber); }, 0);
  };

  // ------------------------------------------------------------------ account (profile + order history)
  var TAB_ACTIVE = 'rounded-xl bg-white shadow-sm px-5 py-2 text-xs sm:text-sm font-semibold text-[#302C2A] transition';
  var TAB_IDLE   = 'rounded-xl px-5 py-2 text-xs sm:text-sm font-medium text-stone-500 hover:text-stone-700 transition';

  proto.renderAccountView = function () {
    var u = appState.getCurrentUser() || {};
    var a = u.address || {};
    var isGoogle = Boolean(u.google);
    var districtOpts = '<option value="">Select district</option>' + SHOP_RULES.MANILA_DISTRICTS.map(function (d) {
      return '<option value="' + esc(d.id) + '"' + (SHOP_RULES.normalizeDistrictId(a.district) === d.id ? ' selected' : '') + '>' + esc(d.name + ' — ' + d.areas) + '</option>';
    }).join('');
    var brgys = SHOP_RULES.barangaysForDistrict(SHOP_RULES.normalizeDistrictId(a.district) || '');
    var brgyOpts = '<option value="">' + (brgys.length ? 'Select barangay' : 'Select a district first') + '</option>' + brgys.map(function (b) { return '<option value="' + esc(b) + '"' + (a.barangay === b ? ' selected' : '') + '>' + esc(b) + '</option>'; }).join('');
    var joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-PH', { year: 'numeric', month: 'short' }) : 'Verified Member';

    return '<div class="py-12 px-6 max-w-5xl mx-auto space-y-8 animate-fade-in">' +
      '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200/80 pb-5">' +
        '<div>' +
          '<h1 class="font-serif text-3xl sm:text-4xl font-bold text-stone-900 mt-1">Hello, ' + esc((u.name || 'Valued Customer').split(' ')[0]) + '</h1>' +
          '<div class="flex flex-wrap items-center gap-2 mt-2 text-xs text-stone-500">' +
            '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ' + (isGoogle ? 'bg-blue-50 text-blue-800 border border-blue-200/80' : 'bg-stone-100 text-stone-700') + '">' +
              (isGoogle ? '<svg class="w-3.5 h-3.5 text-blue-600" viewBox="0 0 24 24" fill="currentColor"><path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/></svg> Google Account' : 'Standard Email Account') +
            '</span>' +
            '<span>·</span><span>Member since ' + esc(joined) + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="flex items-center gap-1 bg-stone-100/80 p-1.5 rounded-2xl border border-stone-200/60">' +
          '<button type="button" id="acct-tab-profile" onclick="window.appRouter.switchAccountTab(\'profile\')" class="' + TAB_ACTIVE + '">Profile Details</button>' +
          '<button type="button" id="acct-tab-orders" onclick="window.appRouter.switchAccountTab(\'orders\')" class="' + TAB_IDLE + '">Order History</button>' +
        '</div>' +
      '</div>' +

      // ── PROFILE PANE ─────────────────────────────────────────────────────────
      '<div id="acct-pane-profile" class="space-y-8">' +
        '<form id="acct-profile-form" onsubmit="window.appRouter.saveProfile(event)" class="' + cardCls + ' space-y-4 max-w-lg">' +
          '<div class="border-b border-stone-100 pb-3">' +
            '<h2 class="font-serif font-bold text-lg text-stone-900">Personal Information</h2>' +
            '<p class="text-xs text-stone-500">Update your contact information and default Manila delivery address.</p>' +
          '</div>' +
          '<p id="acct-error" class="hidden text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3"></p>' +
          '<div><label class="block text-xs font-semibold text-stone-700 mb-1" for="acct-name">Full name</label><input id="acct-name" type="text" required minlength="2" maxlength="100" value="' + esc(u.name) + '" class="' + inputCls + '"></div>' +
          '<div><label class="block text-xs font-semibold text-stone-700 mb-1" for="acct-email">Email address <span class="text-stone-400 font-normal">(Verified)</span></label><input id="acct-email" type="email" readonly value="' + esc(u.email) + '" class="' + inputCls + ' bg-stone-100 cursor-not-allowed"></div>' +
          '<div><label class="block text-xs font-semibold text-stone-700 mb-1" for="acct-phone">Mobile number</label><input id="acct-phone" type="tel" maxlength="30" placeholder="0917 123 4567" value="' + esc(u.phone) + '" class="' + inputCls + '"></div>' +
          '<div class="pt-2 border-t border-stone-100">' +
            '<h3 class="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2">Default Manila Delivery Address</h3>' +
            '<div class="space-y-3">' +
              '<div><label class="block text-[11px] font-semibold text-stone-600 mb-1" for="acct-street">Street address / building / unit</label><input id="acct-street" type="text" maxlength="200" placeholder="e.g. Unit 4B, 123 Sampaguita St" value="' + esc(a.street) + '" class="' + inputCls + '"></div>' +
              '<div><label class="block text-[11px] font-semibold text-stone-600 mb-1" for="acct-district">District</label><select id="acct-district" onchange="window.appRouter.onAccountDistrictChange(this.value)" class="' + inputCls + '">' + districtOpts + '</select></div>' +
              '<div><label class="block text-[11px] font-semibold text-stone-600 mb-1" for="acct-barangay">Barangay</label><select id="acct-barangay" class="' + inputCls + '"' + (brgys.length ? '' : ' disabled') + '>' + brgyOpts + '</select></div>' +
              '<div><label class="block text-[11px] font-semibold text-stone-600 mb-1" for="acct-landmark">Landmark (optional)</label><input id="acct-landmark" type="text" maxlength="120" placeholder="e.g. Near UST gate 2" value="' + esc(a.landmark) + '" class="' + inputCls + '"></div>' +
            '</div>' +
          '</div>' +
          '<button type="submit" id="acct-save-btn" class="w-full py-3 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold shadow-xs hover:shadow text-xs font-semibold transition shadow-sm">Save Profile Changes</button>' +
        '</form>' +

        '<div class="' + cardCls + ' border-red-200 bg-rose-50/30 space-y-4 max-w-lg">' +
          '<div class="border-b border-red-100 pb-3">' +
            '<h2 class="font-serif font-bold text-lg text-red-900">Danger Zone</h2>' +
            '<p class="text-xs text-red-700/80">Permanent and irreversible account actions. These cannot be undone.</p>' +
          '</div>' +
          '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">' +
            '<div>' +
              '<p class="text-sm font-semibold text-stone-900">Delete Account</p>' +
              '<p class="text-xs text-stone-600 mt-0.5">Remove your personal information, credentials, and active sessions. Your order history is anonymised and kept for business records.</p>' +
            '</div>' +
            '<button type="button" onclick="window.appRouter.openDeleteAccountModal()" class="shrink-0 py-2.5 px-5 rounded-xl border border-red-300 bg-white hover:bg-red-50 text-red-700 font-bold text-xs transition">' +
              '<span class="flex items-center gap-1.5"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="m19 6-.867 12.142A2 2 0 0 1 16.138 20H7.862a2 2 0 0 1-1.995-1.858L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="m8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/></svg>Delete My Account</span>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      // ── ORDERS PANE (initially hidden; shown when tab is activated) ───────────
      '<div id="acct-pane-orders" class="hidden space-y-4">' +
        '<div class="flex items-center justify-between border-b border-stone-200 pb-3">' +
          '<h2 class="font-serif font-bold text-xl text-stone-900">My Orders</h2>' +
        '</div>' +
        '<div id="acct-orders">' + loadingPanel('Loading your orders…') + '</div>' +
      '</div>' +

    '</div>';
  };

  proto.switchAccountTab = function (tab) {
    var paneProfile = $('acct-pane-profile');
    var paneOrders  = $('acct-pane-orders');
    var btnProfile  = $('acct-tab-profile');
    var btnOrders   = $('acct-tab-orders');
    if (paneProfile) paneProfile.classList.toggle('hidden', tab === 'orders');
    if (paneOrders)  paneOrders.classList.toggle('hidden',  tab !== 'orders');
    if (btnProfile)  btnProfile.className  = tab === 'profile' ? TAB_ACTIVE : TAB_IDLE;
    if (btnOrders)   btnOrders.className   = tab === 'orders'  ? TAB_ACTIVE : TAB_IDLE;
    if (tab === 'orders') this.refreshAccountOrders();
  };

  proto.onAccountDistrictChange = function (districtId) {
    var sel = $('acct-barangay'); if (!sel) return;
    var list = SHOP_RULES.barangaysForDistrict(districtId);
    sel.innerHTML = '<option value="">' + (list.length ? 'Select barangay' : 'Select a district first') + '</option>' + list.map(function (b) { return '<option value="' + esc(b) + '">' + esc(b) + '</option>'; }).join('');
    sel.disabled = !list.length;
  };

  proto.saveProfile = async function (e) {
    e.preventDefault();
    var err = $('acct-error'), btn = $('acct-save-btn');
    err.classList.add('hidden');
    var name = $('acct-name').value.trim(), phone = $('acct-phone').value.trim();
    if (name.length < 2) { err.textContent = 'Please enter your full name.'; err.classList.remove('hidden'); return; }
    if (phone && !/^[+\d][\d\s()-]{6,24}$/.test(phone)) { err.textContent = 'Please enter a valid mobile number.'; err.classList.remove('hidden'); return; }
    var u = appState.getCurrentUser() || {}, a = u.address || {};
    var next = { name: name, phone: phone, address: { street: $('acct-street').value.trim(), district: $('acct-district').value, barangay: $('acct-barangay').value, landmark: $('acct-landmark').value.trim() } };
    var cur = { street: a.street || '', district: SHOP_RULES.normalizeDistrictId(a.district) || '', barangay: a.barangay || '', landmark: a.landmark || '' };
    var none = function (v) { return v || 'None'; };
    var changes = [];
    if (name !== (u.name || '')) changes.push(['Name', none(u.name) + ' → ' + name]);
    if (phone !== (u.phone || '')) changes.push(['Mobile', none(u.phone) + ' → ' + none(phone)]);
    if (Object.keys(cur).some(function (k) { return cur[k] !== next.address[k]; })) {
      changes.push(['Default address', [next.address.street, barangayLabel(next.address.barangay), districtLabel(next.address.district)].filter(Boolean).join(', ') || 'Cleared']);
    }
    if (!changes.length) { showToast('No changes to save.', 'info'); return; }
    var saved = await UI.confirm({
      title: 'Save these profile changes?',
      message: 'These details will prefill your future orders.',
      details: changes,
      confirmLabel: 'Save changes',
      busyLabel: 'Saving…',
      onConfirm: async function () {
        var r = await appState.updateProfile(next);
        return r.ok ? { ok: true } : { ok: false, error: r.error || 'We could not save your profile. Please try again.' };
      }
    });
    if (saved) showToast('Profile saved successfully.', 'success');
  };

  proto.openDeleteAccountModal = function () {
    var modal = $('delete-account-modal');
    if (!modal) return;
    var u = appState.getCurrentUser() || {};
    var isGoogle = Boolean(u.google);
    var pwField = $('del-acct-password-field');
    var emailField = $('del-acct-email-field');
    if (pwField) pwField.classList.toggle('hidden', isGoogle);
    if (emailField) emailField.classList.toggle('hidden', !isGoogle);
    var inp = $('del-acct-password') || $('del-acct-confirm-email');
    if (inp) inp.value = '';
    var err = $('del-acct-error');
    if (err) { err.textContent = ''; err.classList.add('hidden'); }
    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
    setTimeout(function () { var f = $('del-acct-password') || $('del-acct-confirm-email'); if (f) f.focus(); }, 80);
  };

  proto.closeDeleteAccountModal = function () {
    var modal = $('delete-account-modal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  };

  proto.confirmDeleteAccount = async function () {
    var err = $('del-acct-error'), btn = $('del-acct-confirm-btn');
    if (err) { err.textContent = ''; err.classList.add('hidden'); }
    var u = appState.getCurrentUser() || {};
    var isGoogle = Boolean(u.google);
    var opts = {};
    if (isGoogle) {
      var ce = ($('del-acct-confirm-email') || {}).value || '';
      opts.confirmEmail = ce.trim().toLowerCase();
    } else {
      var pw = ($('del-acct-password') || {}).value || '';
      opts.password = pw;
    }
    if (btn) { btn.disabled = true; btn.textContent = 'Deleting…'; }
    var r = await appState.deleteAccount(opts);
    if (!r.ok) {
      if (err) { err.textContent = r.error || 'Could not delete account.'; err.classList.remove('hidden'); }
      if (btn) { btn.disabled = false; btn.textContent = 'Permanently Delete My Account'; }
      return;
    }
    // Server has already invalidated the session; clear local state, close modal, go home as guest.
    appState.logout();
    this.closeDeleteAccountModal();
    window.appRouter.navigate('home', true);
    showToast('Your account has been successfully deleted. You are now browsing Umaira Florist as a guest.', 'success');
  };

  function orderCard(o) {
    var groups = groupItems(o.items);
    var pickup = o.fulfillment === 'pickup';
    var addressLine = '';
    if (!pickup) {
      var parts = [o.address, barangayLabel(o.barangay), districtLabel(o.district)].filter(Boolean);
      if (parts.length) addressLine = '<p class=”text-[11px] text-stone-500 mt-0.5”>Deliver to: ' + esc(parts.join(', ')) + '</p>';
    } else {
      addressLine = '<p class=”text-[11px] text-stone-500 mt-0.5”>Collect from store</p>';
    }
    return '<div class=”' + cardCls + ' space-y-3.5 hover:border-stone-300 transition”>' +

      // Header: order number, fulfillment type, date, order status badge
      '<div class=”flex flex-wrap items-center justify-between gap-2 border-b border-stone-100 pb-3”>' +
        '<div>' +
          '<div class=”flex items-center gap-2”>' +
            '<p class=”font-mono font-bold text-[#647D69] text-sm”>' + esc(o.orderNumber) + '</p>' +
            '<span class=”text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600”>' + (pickup ? 'Store Pickup' : 'Delivery') + '</span>' +
          '</div>' +
          '<p class=”text-[11px] text-stone-400 mt-0.5”>Placed ' + esc(fmtDateTime(o.createdAt)) + '</p>' +
        '</div>' +
        statusBadge(o.status) +
      '</div>' +

      // Products summary + schedule + total
      '<div>' +
        '<p class=”text-xs text-stone-700 font-medium”>' + groups.slice(0, 3).map(function (g) { return esc((g.custom ? '' : g.qty + '× ') + g.title); }).join(', ') + (groups.length > 3 ? ' +' + (groups.length - 3) + ' more' : '') + '</p>' +
        '<div class=”flex items-center justify-between text-xs text-stone-500 mt-1”>' +
          '<span>Schedule: ' + esc(o.date) + ' (' + esc(o.time) + ')</span>' +
          '<span class=”font-bold text-stone-900 text-base price”>' + money(o.total) + '</span>' +
        '</div>' +
      '</div>' +

      // Payment status + delivery/pickup address — always visible
      '<div class=”flex flex-wrap items-center justify-between gap-2 text-xs”>' +
        '<div class=”flex items-center gap-1.5”>' +
          '<span class=”text-stone-500”>Payment:</span>' +
          paymentBadge(o.paymentStatus) +
          '<span class=”text-stone-400 text-[11px]”>(' + esc(SHOP_RULES.paymentMethodLabel(o.paymentMethod)) + ')</span>' +
        '</div>' +
        (addressLine ? '<div>' + addressLine + '</div>' : '') +
      '</div>' +

      // Expandable item detail
      '<details class=”text-xs border-t border-stone-100 pt-2 text-stone-600”>' +
        '<summary class=”cursor-pointer font-semibold text-[#647D69] select-none hover:underline py-1”>View order items &amp; instructions (' + (o.items ? o.items.length : 0) + ')</summary>' +
        '<div class=”mt-2 space-y-2 bg-stone-50 p-3 rounded-xl border border-stone-200”>' +
          itemsHtml(o.items) +
          (o.giftMessage ? '<p class=”pt-2 text-[11px] text-stone-500 italic”>Delivery note: &ldquo;' + esc(o.giftMessage) + '&rdquo;</p>' : '') +
        '</div>' +
      '</details>' +

      // Track order button
      '<div class=”pt-2 border-t border-stone-100”>' +
        '<button type=”button” id=”order-track-btn-' + esc(o.orderNumber) + '” onclick=”window.toggleOrderTracking(\'' + esc(o.orderNumber) + '\')” class=”w-full py-2.5 px-4 rounded-xl bg-[#FFF9F5] hover:bg-rose-100 text-[#647D69] text-xs font-bold transition text-center shadow-2xs flex items-center justify-center gap-1.5”>' +
          '<span>Track Order Progress</span> <span aria-hidden=”true”>↓</span>' +
        '</button>' +
        '<div id=”order-track-' + esc(o.orderNumber) + '” class=”hidden mt-3 pt-3 border-t border-[#E5ECE6]”>' +
          trackingResultHtml(o) +
        '</div>' +
      '</div>' +
    '</div>';
  }

  proto.refreshAccountOrders = async function () {
    var box = $('acct-orders'); if (box) box.innerHTML = loadingPanel('Loading your orders…');
    await appState.refreshOrders();
    box = $('acct-orders'); if (!box) return;
    if (appState.ordersError) { box.innerHTML = errorPanel('We could not load your orders.', 'window.appRouter.refreshAccountOrders()'); return; }
    box.innerHTML = appState.orders.length ? '<div class="space-y-4">' + appState.orders.map(orderCard).join('') + '</div>' :
      '<div class="' + cardCls + ' text-center space-y-3 py-12"><h3 class="font-serif font-bold text-stone-900">No orders yet</h3><p class="text-xs text-stone-500">When you place an order it will appear here.</p><button type="button" onclick="window.appRouter.navigate(\'collections\')" class="px-5 py-2 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white text-xs font-bold font-semibold">Browse Collections</button></div>';
  };

  // ------------------------------------------------------------------ forgot / reset password
  proto.showForgotPassword = function () { this.navigate('forgot'); };
  proto.renderForgotView = function () {
    return '<section class="min-h-[calc(100vh-14rem)] flex items-center justify-center py-12 px-4"><div class="w-full max-w-md ' + cardCls + ' space-y-5">' +
      '<h2 class="font-serif text-2xl font-bold text-stone-900 text-center">Reset your password</h2><p class="text-xs text-stone-500 text-center">Enter your account email and we will send you a link to choose a new password.</p>' +
      '<p id="forgot-msg" class="hidden text-xs rounded-xl p-3"></p>' +
      '<form onsubmit="window.appRouter.handleForgotSubmit(event)" class="space-y-4"><div><label class="block text-xs font-semibold text-stone-700 mb-1" for="forgot-email">Email address</label><input id="forgot-email" type="email" required class="' + inputCls + '"></div>' +
      '<button type="submit" id="forgot-btn" class="w-full py-3 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold shadow-xs hover:shadow text-xs font-semibold">Send reset link</button></form>' +
      '<p class="text-center text-xs"><button type="button" onclick="window.appRouter.navigate(\'signin\')" class="text-[#647D69] font-semibold underline">Back to sign in</button></p></div></section>';
  };
  proto.handleForgotSubmit = async function (e) {
    e.preventDefault();
    var btn = $('forgot-btn'), msg = $('forgot-msg'); btn.disabled = true; btn.textContent = 'Sending…';
    var r = await appState.forgotPassword($('forgot-email').value);
    btn.disabled = false; btn.textContent = 'Send reset link';
    msg.className = 'text-xs rounded-xl p-3 ' + (r.ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800');
    msg.textContent = r.ok ? r.message : r.error;
  };
  proto.renderResetView = function () {
    var token = window.__umairaResetToken || '';
    if (!token) return '<section class="py-24 px-4 text-center space-y-3"><h2 class="font-serif text-2xl font-bold text-stone-900">This reset link is not valid</h2><p class="text-xs text-stone-500">Please request a new one.</p><button type="button" onclick="window.appRouter.showForgotPassword()" class="px-5 py-2 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white text-xs font-bold font-semibold">Request a new link</button></section>';
    return '<section class="min-h-[calc(100vh-14rem)] flex items-center justify-center py-12 px-4"><div class="w-full max-w-md ' + cardCls + ' space-y-5">' +
      '<h2 class="font-serif text-2xl font-bold text-stone-900 text-center">Choose a new password</h2><p id="reset-msg" class="hidden text-xs rounded-xl p-3"></p>' +
      '<form onsubmit="window.appRouter.handleResetSubmit(event)" class="space-y-4">' +
      '<div><label class="block text-xs font-semibold text-stone-700 mb-1" for="reset-pass">New password (8+ characters)</label><input id="reset-pass" type="password" required minlength="8" autocomplete="new-password" class="' + inputCls + '"></div>' +
      '<div><label class="block text-xs font-semibold text-stone-700 mb-1" for="reset-pass2">Confirm new password</label><input id="reset-pass2" type="password" required minlength="8" autocomplete="new-password" class="' + inputCls + '"></div>' +
      '<button type="submit" id="reset-btn" class="w-full py-3 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold shadow-xs hover:shadow text-xs font-semibold">Update password</button></form></div></section>';
  };
  proto.handleResetSubmit = async function (e) {
    e.preventDefault();
    var msg = $('reset-msg'), p1 = $('reset-pass').value, p2 = $('reset-pass2').value;
    var show = function (ok, t) { msg.className = 'text-xs rounded-xl p-3 ' + (ok ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-red-50 border border-red-200 text-red-800'); msg.textContent = t; };
    if (p1.length < 8) return show(false, 'Password must be at least 8 characters.');
    if (p1 !== p2) return show(false, 'The two passwords do not match.');
    var btn = $('reset-btn'); btn.disabled = true;
    var r = await appState.resetPassword(window.__umairaResetToken, p1);
    btn.disabled = false;
    if (!r.ok) return show(false, r.error);
    window.__umairaResetToken = '';
    show(true, 'Password updated. You can now sign in.');
    showToast('Password updated. Please sign in.', 'success');
    var self = this; setTimeout(function () { self.navigate('signin'); }, 1200);
  };

  // ------------------------------------------------------------------ view routing additions
  var prevRenderView = proto.renderView;
  proto.renderView = function (view) {
    var main = $('main-content'); if (!main) return;
    if (CATALOG_VIEWS.indexOf(view) >= 0 && !appState.catalogReady) {
      document.body.setAttribute('data-view', view);
      main.innerHTML = '<div id="boot-loading">' + loadingPanel('Loading Umaira Florist…') + '</div>';
      return;
    }
    var own = { account: 'renderAccountView', forgot: 'renderForgotView', reset: 'renderResetView' };
    if (own[view]) {
      document.body.setAttribute('data-view', view);
      var ownHtml = this[own[view]]();
      if (typeof window.wrapCustomerViewWithDecor === 'function') {
        ownHtml = window.wrapCustomerViewWithDecor(view, ownHtml);
      }
      main.innerHTML = ownHtml;
      if (view === 'account') {
        var section = (window.appRouter && window.appRouter._accountSection) || 'profile';
        if (window.appRouter) window.appRouter._accountSection = null;
        this.switchAccountTab(section);
      }
      if (window.FX) window.FX.refresh();
      return;
    }
    prevRenderView.call(this, view);
    if (view === 'tracking') this.loadTrackingResult();
    if (CATALOG_VIEWS.indexOf(view) >= 0 && appState.catalogError) {
      main.insertAdjacentHTML('afterbegin', '<div class="max-w-3xl mx-auto mt-6 px-4"><div class="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center justify-between gap-3"><span>We could not load the latest products. Prices and availability may be missing.</span><button type="button" onclick="appState.loadCatalog()" class="px-3 py-1.5 rounded-lg bg-amber-900 text-white font-semibold">Retry</button></div></div>');
    }
  };

  // After moving to a catalog page, quietly refresh prices/stock (at most every 20 s).
  var lastRefresh = 0;
  var prevNavigate = proto.navigate;
  proto.navigate = function (view, replace, options) {
    var r = prevNavigate.call(this, view, replace, options);
    // Checkout always re-checks, so payment availability (e.g. GCash) is current when the customer arrives.
    if (CATALOG_VIEWS.indexOf(this.currentView) >= 0 && appState.catalogReady && (this.currentView === 'checkout' || Date.now() - lastRefresh > 20000)) {
      lastRefresh = Date.now(); appState.loadCatalog();
    }
    return r;
  };

  // ------------------------------------------------------------------ start-up
  var firstCatalog = true;
  appState.on('catalog_change', function (info) {
    var v = router.currentView;
    if (firstCatalog) {
      firstCatalog = false;
      var start = ((window.location.hash || '').replace('#', '').split('?')[0]) || 'home';
      router.navigate(start, true);
      return;
    }
    if (info && info.changed && v !== 'checkout' && v !== 'builder' && CATALOG_VIEWS.indexOf(v) >= 0) {
      var st = { x: window.scrollX, y: window.scrollY }; router.renderView(v); router.updateNavBar(); window.scrollTo(st.x, st.y);
    } else if (info && info.changed && (v === 'checkout' || v === 'builder')) {
      showToast('Prices or availability were just updated. Please review your selection.', 'info');
    }
  });
  // The shop can turn GCash on or off at any time. On checkout only the payment choices are redrawn, so
  // everything else the customer typed stays as it is.
  appState.on('payment_accounts_change', function () {
    if (router.currentView !== 'checkout' || typeof router.renderPaymentOptions !== 'function') return;
    var cur = document.querySelector('input[name="paymentMethod"]:checked');
    var hadGcash = !!(cur && cur.value === 'GCash');
    router.renderPaymentOptions();
    if (hadGcash && !(appState.paymentAccounts && appState.paymentAccounts.gcash)) {
      showToast('GCash is no longer available for this order. Please choose a cash option.', 'warning');
    }
  });
  // Live events do not reach every server instance on serverless hosting, so re-check when the customer returns.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && router.currentView === 'checkout' && appState.catalogReady) appState.loadCatalog();
  });
  appState.on('cart_notice', function (notes) { notes.forEach(function (n) { showToast(n, 'warning'); }); });
  appState.on('session_expired', function () {
    showToast('Your session has ended. Please sign in again.', 'warning');
    if (['builder', 'cart', 'checkout', 'tracking', 'confirmation', 'account'].indexOf(router.currentView) >= 0) router.navigate('auth', true, { mode: 'signin' });
    else router.updateNavBar();
  });
  appState.on('cart_change', function () { router.updateNavBar(); });
  // The public event stream only signals "an order changed" (no order numbers are broadcast). Refresh
  // whatever this signed-in customer is looking at through the authenticated API.
  appState.on('order_status_update', function () {
    if (!appState.isAuthenticated()) return;
    var inp = document.getElementById('track-order-input');
    if (router.currentView === 'tracking' && inp && inp.value.trim()) router.loadTrackingResult(inp.value.trim());
    if (router.currentView === 'account') router.refreshAccountOrders();
    if (window.customerNotifications) window.customerNotifications.poll();
  });

  // ------------------------------------------------------------------ Customer Delivery Confirmation & Dispute
  window.customerDelivery = {
    disputePhotoDataUrl: null,
    openLightbox: function (url, title, caption) {
      var modal = document.getElementById('pod-image-lightbox-modal');
      var img = document.getElementById('pod-lightbox-img');
      var tit = document.getElementById('pod-lightbox-title');
      var cap = document.getElementById('pod-lightbox-caption');
      if (!modal || !img) return;
      img.src = url;
      if (tit) tit.textContent = title || 'Delivery Photo';
      if (cap) cap.textContent = caption || '';
      modal.classList.remove('hidden');
    },
    closeLightbox: function () {
      var modal = document.getElementById('pod-image-lightbox-modal');
      if (modal) modal.classList.add('hidden');
    },
    openDisputeModal: function (orderNumber, kind) {
      var modal = document.getElementById('customer-dispute-modal');
      var numInput = document.getElementById('dispute-order-number');
      if (numInput) numInput.value = orderNumber;
      // Same report form for deliveries and store pickups; only the wording changes.
      var title = modal && modal.querySelector('h3'), intro = title && title.parentElement && title.parentElement.nextElementSibling;
      if (title) { title.dataset.orig = title.dataset.orig || title.textContent; title.textContent = kind === 'pickup' ? 'Report Pickup Issue' : title.dataset.orig; }
      if (intro && intro.tagName === 'P') { intro.dataset.orig = intro.dataset.orig || intro.textContent; intro.textContent = kind === 'pickup' ? 'Please tell us what went wrong — for example, you did not receive the order at the shop or it was not what you ordered. The shop will review it and contact you.' : intro.dataset.orig; }
      if (modal) modal.classList.remove('hidden');
    },
    closeDisputeModal: function () {
      var modal = document.getElementById('customer-dispute-modal');
      if (modal) modal.classList.add('hidden');
      this.clearDisputePhoto();
    },
    handleDisputePhotoSelected: function (input) {
      var self = this;
      var file = input.files && input.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image file must be 5MB or less.', 'error');
        input.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        self.disputePhotoDataUrl = e.target.result;
        var prev = document.getElementById('dispute-photo-preview');
        var wrap = document.getElementById('dispute-photo-preview-wrap');
        var name = document.getElementById('dispute-photo-name');
        if (prev) prev.src = self.disputePhotoDataUrl;
        if (wrap) wrap.classList.remove('hidden');
        if (name) name.textContent = file.name;
      };
      reader.readAsDataURL(file);
    },
    clearDisputePhoto: function () {
      this.disputePhotoDataUrl = null;
      var inp = document.getElementById('dispute-photo-input');
      if (inp) inp.value = '';
      var wrap = document.getElementById('dispute-photo-preview-wrap');
      if (wrap) wrap.classList.add('hidden');
      var name = document.getElementById('dispute-photo-name');
      if (name) name.textContent = 'No file chosen';
    },
    confirmDelivery: async function (orderNumber, confirmed) {
      // Signed-in request: the server only lets the customer who placed the order confirm it.
      var r = await appState.api('/api/orders/' + encodeURIComponent(orderNumber) + '/confirm-delivery', { method: 'POST', body: { confirmed: true } });
      if (r.ok) {
        showToast('Thank you! You confirmed receiving your order.', 'success');
        if (window.appRouter) window.appRouter.loadTrackingResult(orderNumber);
        if (window.customerNotifications) window.customerNotifications.poll();
      } else {
        showToast((r.data && r.data.error) || 'Could not confirm receipt. Please try again.', 'error');
      }
    },
    submitDispute: async function (e) {
      if (e && e.preventDefault) e.preventDefault();
      var orderNumber = document.getElementById('dispute-order-number').value;
      var reason = (document.getElementById('dispute-reason').value || '').trim();
      if (!reason) {
        showToast('Please provide an explanation.', 'warning');
        return;
      }
      var btn = document.getElementById('dispute-submit-btn');
      if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

      try {
        var disputePhotoUrl = null;
        if (this.disputePhotoDataUrl) {
          var up = await appState.api('/api/upload', { method: 'POST', body: { dataUrl: this.disputePhotoDataUrl } });
          if (!up.ok) { showToast((up.data && up.data.error) || 'The photo could not be uploaded. Please try again.', 'error'); return; }
          disputePhotoUrl = up.data.url;
        }
        var r = await appState.api('/api/orders/' + encodeURIComponent(orderNumber) + '/confirm-delivery', {
          method: 'POST',
          body: { confirmed: false, reason: reason, disputePhotoUrl: disputePhotoUrl }
        });
        if (r.ok) {
          showToast('Your report has been submitted. Our concierge is investigating.', 'info');
          this.closeDisputeModal();
          if (window.appRouter) window.appRouter.loadTrackingResult(orderNumber);
          if (window.customerNotifications) window.customerNotifications.poll();
        } else {
          showToast((r.data && r.data.error) || 'Failed to submit report.', 'error');
        }
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Submit Report'; }
      }
    }
  };

  // ------------------------------------------------------------------ Customer Notification Bell
  window.customerNotifications = {
    notifications: [],
    unreadCount: 0,
    isOpen: false,
    _pollTimer: null,
    init: function () {
      var self = this;
      if (appState.isAuthenticated && appState.isAuthenticated()) {
        this.poll();
      }
      if (!this._pollTimer) {
        this._pollTimer = setInterval(function () {
          if (appState.isAuthenticated && appState.isAuthenticated()) {
            self.poll();
          }
        }, 15000);
      }
      document.addEventListener('click', function (e) {
        var drop = document.getElementById('customer-notif-dropdown');
        var btn = document.getElementById('customer-notif-bell-btn');
        if (drop && !drop.classList.contains('hidden') && !drop.contains(e.target) && btn && !btn.contains(e.target)) {
          self.isOpen = false;
          drop.classList.add('hidden');
        }
      });
    },
    poll: async function () {
      if (!appState.isAuthenticated || !appState.isAuthenticated()) {
        this.notifications = [];
        this.unreadCount = 0;
        this.renderBadge();
        return;
      }
      try {
        // All of this customer's notifications (the server scopes them to the signed-in account).
        var url = '/api/notifications';
        var headers = {};
        if (appState.customerToken) headers['Authorization'] = 'Bearer ' + appState.customerToken;
        var res = await fetch(url, { headers: headers });
        if (res.ok) {
          var data = await res.json();
          this.notifications = data.notifications || [];
          this.unreadCount = data.unreadCount || 0;
          this.renderBadge();
          if (this.isOpen) this.renderList();
        } else if (res.status === 401) {
          this.notifications = [];
          this.unreadCount = 0;
          this.renderBadge();
        }
      } catch (_) {}
    },
    renderBadge: function () {
      var badge = document.getElementById('customer-notif-badge');
      if (!badge) return;
      if (!appState.isAuthenticated || !appState.isAuthenticated()) {
        badge.classList.add('hidden');
        badge.classList.remove('flex');
        return;
      }
      if (this.unreadCount > 0) {
        badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
        badge.classList.remove('hidden');
        badge.classList.add('flex');
      } else {
        badge.classList.add('hidden');
        badge.classList.remove('flex');
      }
    },
    toggleDropdown: function () {
      if (!appState.isAuthenticated || !appState.isAuthenticated()) return;
      this.isOpen = !this.isOpen;
      var drop = document.getElementById('customer-notif-dropdown');
      if (!drop) return;
      if (this.isOpen) {
        drop.classList.remove('hidden');
        this.renderList();
      } else {
        drop.classList.add('hidden');
      }
    },
    renderList: function () {
      var list = document.getElementById('customer-notif-list');
      if (!list) return;
      if (!this.notifications.length) {
        list.innerHTML = '<div class="p-6 text-center text-stone-400">No notifications yet.</div>';
        return;
      }
      list.innerHTML = this.notifications.map(function (n) {
        return '<div class="p-3.5 hover:bg-[#EBF1EC]/20 transition cursor-pointer ' + (n.isRead ? 'opacity-70' : 'bg-[#FFF9F5]') + '" onclick="window.customerNotifications.handleClick(\'' + n.id + '\', \'' + esc(n.link || '') + '\')">' +
          '<div class="flex items-start justify-between gap-2">' +
            '<div class="font-bold text-[#302C2A] flex items-center gap-1.5">' +
              (!n.isRead ? '<span class="w-1.5 h-1.5 rounded-full bg-[#647D69] shrink-0"></span>' : '') +
              '<span>' + esc(n.title) + '</span>' +
            '</div>' +
            '<span class="text-[10px] text-stone-400 shrink-0">' + esc(fmtDateTime(n.createdAt)) + '</span>' +
          '</div>' +
          '<p class="text-[11px] text-[#6E6864] mt-1 leading-snug">' + esc(n.message) + '</p>' +
        '</div>';
      }).join('');
    },
    handleClick: async function (id, link) {
      if (!appState.isAuthenticated || !appState.isAuthenticated()) return;
      try {
        var headers = {};
        if (appState.customerToken) headers['Authorization'] = 'Bearer ' + appState.customerToken;
        await fetch('/api/notifications/' + id + '/read', { method: 'POST', headers: headers });
        this.poll();
      } catch (_) {}
      if (link) {
        this.isOpen = false;
        var drop = document.getElementById('customer-notif-dropdown');
        if (drop) drop.classList.add('hidden');
        if (link.indexOf('#track=') >= 0) {
          var orderNum = link.split('#track=')[1];
          if (window.appRouter) {
            window.appRouter.navigate('tracking'); // ('track' is not a view and fell through to Home)
            setTimeout(function () { window.appRouter.loadTrackingResult(decodeURIComponent(orderNum)); }, 0);
          }
        } else {
          window.location.href = link;
        }
      }
    },
    markAllRead: async function () {
      if (!appState.isAuthenticated || !appState.isAuthenticated()) return;
      try {
        var headers = {};
        if (appState.customerToken) headers['Authorization'] = 'Bearer ' + appState.customerToken;
        await fetch('/api/notifications/read-all', { method: 'POST', headers: headers });
        this.poll();
      } catch (_) {}
    }
  };

  appState.on('auth_change', function (user) {
    if (user && window.customerNotifications) {
      window.customerNotifications.poll();
    } else if (window.customerNotifications) {
      window.customerNotifications.notifications = [];
      window.customerNotifications.unreadCount = 0;
      window.customerNotifications.isOpen = false;
      window.customerNotifications.renderBadge();
      var drop = document.getElementById('customer-notif-dropdown');
      if (drop) drop.classList.add('hidden');
    }
    if (router && typeof router.updateNavBar === 'function') {
      router.updateNavBar();
    }
  });

  if (window.__umairaResetToken) router.navigate('reset', true);
  Promise.all([appState.loadCatalog(), appState.restoreSession()]).then(function () {
    router.updateNavBar();
    window.customerNotifications.init();
  });
})();
