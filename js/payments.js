/**
 * UMAIRA FLORIST - Customer payment panel (order details / tracking, My Orders, confirmation page).
 * GCash: shows the shop's official GCash QR code (downloadable), account details if set, the exact amount and the
 * steps, then lets the customer submit the transaction reference, the amount sent and a receipt image.
 * Cash on Pickup / Cash on Delivery: only how and when to pay — no proof upload.
 * The browser never decides that an order is paid: it shows the status the server reports. Updates arrive as
 * in-app notifications (no email). Load after account.js.
 */
(function () {
  'use strict';
  var esc = window.escapeHtml;
  var money = function (n) { return formatCurrency(Number(n) || 0); };
  var $ = function (id) { return document.getElementById(id); };
  var keyOf = function (n) { return String(n || '').replace(/[^A-Za-z0-9]/g, ''); };
  var R = window.SHOP_RULES;

  function fmt(iso) { var d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); }

  var STATUS_STYLE = {
    'Unpaid': 'bg-amber-100 text-amber-900 border-amber-200',
    'Pending Verification': 'bg-sky-100 text-sky-900 border-sky-200',
    'Paid': 'bg-emerald-100 text-emerald-900 border-emerald-300',
    'Rejected': 'bg-red-100 text-red-800 border-red-200'
  };
  var PROOF_LABEL = { pending: 'Pending Verification', approved: 'Verified', rejected: 'Rejected' };
  function statusPill(s) {
    return '<span class="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ' + (STATUS_STYLE[s] || STATUS_STYLE.Unpaid) + '">' + esc(s) + '</span>';
  }
  function gcashAccount() { return (window.appState && appState.paymentAccounts && appState.paymentAccounts.gcash) || null; }

  // GCash QR code, account details, exact amount and steps. Returns null when GCash is not set up.
  function gcashInstructionsHtml(o) {
    var g = gcashAccount();
    if (!g) return null;
    return '<div class="p-4 rounded-2xl bg-white border border-stone-200 flex flex-col sm:flex-row gap-4">' +
      '<div class="shrink-0 text-center">' +
        '<img src="' + esc(g.qrImage) + '" alt="Official GCash QR code of ' + esc((R.info && R.info.name) || 'the shop') + '" class="w-52 sm:w-56 h-auto max-h-[30rem] object-contain rounded-xl border border-stone-200 bg-white mx-auto">' +
        '<a href="' + esc(g.qrImage) + '" download="umaira-florist-gcash-qr.' + esc(String(g.qrImage).split('.').pop()) + '" class="mt-2 inline-block px-3 py-1.5 rounded-lg bg-[#EBF1EC] text-[#344F3B] text-[11px] font-bold hover:bg-[#dfe9e1]">Download QR Code</a>' +
      '</div>' +
      '<div class="space-y-2 text-xs text-stone-600">' +
        '<p class="text-[11px] font-bold uppercase tracking-wider text-stone-500">How to pay with GCash</p>' +
        (g.accountName || g.number ? '<p>GCash account: <strong class="text-stone-900">' + esc(g.accountName) + '</strong>' + (g.number ? ' · <span class="font-mono font-bold text-stone-900">' + esc(g.number) + '</span>' : '') + '</p>' : '') +
        '<p>Amount to send: <strong class="text-stone-900 text-sm">' + money(o.total) + '</strong> (exact amount)</p>' +
        '<ol class="list-decimal pl-4 space-y-0.5">' +
          '<li>Scan or download the QR code in the GCash app.</li>' +
          '<li>Send exactly ' + money(o.total) + ' and keep the receipt or screenshot.</li>' +
          '<li>Submit the transaction reference number, the amount you sent and the receipt below.</li></ol>' +
        '<p class="text-[11px] text-stone-500">The shop confirms and prepares your order only after it has verified the payment in its GCash account.</p>' +
      '</div></div>';
  }

  function formHtml(o) {
    var k = keyOf(o.orderNumber);
    var inp = 'w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-200 bg-white focus:outline-none focus:ring-1 focus:ring-[#647D69] focus:border-[#647D69]';
    return '<form id="pay-form-' + k + '" class="p-4 rounded-2xl bg-white border border-stone-200 space-y-3" onsubmit="window.customerPayments.submit(event, \'' + esc(o.orderNumber) + '\')" novalidate>' +
      '<p class="text-[11px] font-bold uppercase tracking-wider text-stone-500">Submit payment proof</p>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">' +
        '<div><label for="pay-ref-' + k + '" class="block text-xs font-semibold text-stone-700 mb-1">GCash reference no. <span class="text-rose-600">*</span></label>' +
          '<input id="pay-ref-' + k + '" type="text" maxlength="40" autocomplete="off" required placeholder="e.g. 1234 567 890123" class="' + inp + ' font-mono"></div>' +
        '<div><label for="pay-amt-' + k + '" class="block text-xs font-semibold text-stone-700 mb-1">Amount you sent (₱) <span class="text-rose-600">*</span></label>' +
          '<input id="pay-amt-' + k + '" type="number" min="1" step="0.01" inputmode="decimal" required placeholder="Amount due: ' + esc(Number(o.total).toFixed(2)) + '" class="' + inp + ' font-mono"></div>' +
      '</div>' +
      '<div><label for="pay-file-' + k + '" class="block text-xs font-semibold text-stone-700 mb-1">Receipt or screenshot <span class="text-rose-600">*</span></label>' +
        '<input id="pay-file-' + k + '" type="file" accept="image/png,image/jpeg,image/webp" required onchange="window.customerPayments.pickFile(this, \'' + esc(o.orderNumber) + '\')" class="block w-full text-xs text-stone-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-[#EBF1EC] file:text-[#344F3B] file:font-semibold">' +
        '<p class="text-[11px] text-stone-400 mt-1">PNG, JPG or WebP, up to 5 MB.</p>' +
        '<img id="pay-prev-' + k + '" alt="Receipt preview" class="hidden mt-2 max-h-48 rounded-xl border border-stone-200 object-contain"></div>' +
      '<p id="pay-err-' + k + '" class="hidden text-xs rounded-xl p-3 bg-red-50 border border-red-200 text-red-800" role="alert"></p>' +
      '<button type="submit" id="pay-btn-' + k + '" class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white text-xs font-bold transition disabled:opacity-60">Submit Payment Proof</button>' +
    '</form>';
  }

  // The payment section shown wherever a customer looks at one of their orders.
  function panelHtml(o) {
    if (!o) return '';
    var k = keyOf(o.orderNumber);
    var status = R.normalizePaymentStatus(o.paymentStatus);
    var online = R.paymentKind(o.paymentMethod) === 'online';
    var cancelled = /Rejected|Cancel/.test(o.status || '');
    var label = R.paymentMethodLabel(o.paymentMethod);
    var body = '';
    if (status === 'Paid') {
      body = '<p class="text-xs text-emerald-800">' + (online ? 'Payment verified by the shop' : 'Cash payment received by the shop') + (o.paidAt ? ' on ' + esc(fmt(o.paidAt)) : '') + '. Thank you!</p>';
    } else if (o.paymentMethod === 'Cash on Pickup') {
      body = '<p class="text-xs text-stone-600">No advance payment needed. Pay <strong class="text-stone-900">' + money(o.total) + '</strong> in cash at the shop when you collect your order' +
        ((R.info && (R.info.pickupAddress || R.info.address)) ? ' — <strong class="text-stone-900">' + esc(R.info.pickupAddress || R.info.address) + '</strong>' : '') +
        '. The order is released after the shop confirms your payment.</p>';
    } else if (o.paymentMethod === 'Cash on Delivery') {
      body = '<p class="text-xs text-stone-600">No advance payment needed. Please prepare <strong class="text-stone-900">' + money(o.total) + '</strong> in cash for the courier. It shows as paid once the shop has received the cash.</p>';
    } else if (cancelled) {
      body = '<p class="text-xs text-stone-600">This order was cancelled. If you already sent a payment, please contact the shop with your order reference.</p>';
    } else if (status === 'Pending Verification') {
      body = '<p class="text-xs text-sky-900">We received your payment proof. The shop is checking that the payment arrived in its GCash account — you will see the result here and in your notifications.</p>';
    } else if (o.paymentMethod === 'GCash') {
      var steps = gcashInstructionsHtml(o);
      body = (status === 'Rejected' ? '<div id="pay-reject-' + k + '" class="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">Your last payment proof could not be verified. Please check the details and submit new proof with the correct reference number.</div>' : '') +
        (steps ? steps + formHtml(o)
          : '<p class="text-xs p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">GCash payment is temporarily unavailable because the shop has not set up its GCash QR code. Please contact the shop before paying — payment proof can be submitted once GCash is available.</p>');
    } else {
      // Older BDO Bank Transfer orders: proof can still be submitted, but the method is no longer offered.
      body = (status === 'Rejected' ? '<div id="pay-reject-' + k + '" class="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800">Your last payment proof could not be verified. Please submit new proof with the correct reference number.</div>' : '') +
        '<p class="text-xs text-stone-600">' + esc(label) + ' is no longer offered for new orders. If you already paid this order, submit the transfer details below; otherwise please contact the shop.</p>' + formHtml(o);
    }
    return '<div class="bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-3" data-pay-order="' + esc(o.orderNumber) + '" data-pay-online="' + (online ? '1' : '0') + '">' +
      '<div class="flex flex-wrap items-center justify-between gap-2">' +
        '<div><span class="font-bold text-stone-400 uppercase tracking-wider block text-[11px]">Payment</span>' +
          '<p class="font-semibold text-stone-900 text-sm">' + esc(label) + ' <span class="text-stone-400 font-normal">·</span> <span class="font-mono">' + money(o.total) + '</span></p>' +
          '<p class="text-[11px] text-stone-500">Order reference <span class="font-mono font-semibold text-stone-700">' + esc(o.orderNumber) + '</span> · Order status <span class="font-semibold text-stone-700">' + esc(o.status || '') + '</span></p></div>' +
        statusPill(status) +
      '</div>' +
      (online ? '<div id="pay-latest-' + k + '"></div>' : '') + body +
      '<div id="pay-hist-' + k + '"></div>' +
    '</div>';
  }

  function latestHtml(s) {
    if (!s) return '';
    return '<dl class="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-xs p-3 rounded-xl bg-white border border-stone-200">' +
      '<dt class="text-stone-500">Reference no.</dt><dd class="font-mono font-bold text-stone-900 break-all">' + esc(s.reference) + '</dd>' +
      '<dt class="text-stone-500">Amount sent</dt><dd class="font-mono font-semibold text-stone-900">' + money(s.amountSubmitted) + '</dd>' +
      '<dt class="text-stone-500">Proof status</dt><dd class="font-semibold">' + esc(PROOF_LABEL[s.status] || s.status) + '</dd>' +
      '<dt class="text-stone-500">Submitted</dt><dd>' + esc(fmt(s.submittedAt)) + '</dd>' +
      (s.rejectionReason ? '<dt class="text-stone-500">Reason</dt><dd class="text-red-700 font-semibold">' + esc(s.rejectionReason) + '</dd>' : '') +
    '</dl>';
  }
  function historyHtml(subs, orderNumber) {
    if (!subs || subs.length < 1) return '';
    var rows = subs.map(function (s) {
      return '<li class="py-2 flex flex-wrap items-start justify-between gap-2">' +
        '<div class="text-xs"><p class="font-mono font-semibold text-stone-800">Ref ' + esc(s.reference) + ' · ' + money(s.amountSubmitted) + '</p>' +
          '<p class="text-[11px] text-stone-500">Submitted ' + esc(fmt(s.submittedAt)) + (s.reviewedAt ? ' · reviewed ' + esc(fmt(s.reviewedAt)) : '') + '</p>' +
          (s.rejectionReason ? '<p class="text-[11px] text-red-700 mt-0.5"><strong>Reason:</strong> ' + esc(s.rejectionReason) + '</p>' : '') + '</div>' +
        '<div class="flex items-center gap-2"><span class="text-[10px] font-bold uppercase text-stone-500">' + esc(PROOF_LABEL[s.status] || s.status) + '</span>' +
          '<button type="button" class="text-[11px] font-bold text-[#647D69] hover:underline" onclick="window.customerPayments.viewReceipt(\'' + esc(orderNumber) + '\',' + Number(s.id) + ')">View receipt</button></div></li>';
    }).join('');
    return '<details class="text-xs pt-1"><summary class="cursor-pointer font-semibold text-[#647D69] select-none">Payment history (' + subs.length + ' submission' + (subs.length > 1 ? 's' : '') + ')</summary><ul class="divide-y divide-stone-200 mt-1">' + rows + '</ul></details>';
  }

  var api = {
    files: {},
    panelHtml: panelHtml,
    // Fill in the latest submission and history (with any rejection reason) for every payment panel on screen.
    hydrate: function () {
      if (!window.appState || !appState.isAuthenticated || !appState.isAuthenticated()) return;
      document.querySelectorAll('[data-pay-order]').forEach(function (el) {
        if (el.getAttribute('data-pay-loaded') || el.getAttribute('data-pay-online') !== '1') return;
        el.setAttribute('data-pay-loaded', '1');
        var n = el.getAttribute('data-pay-order');
        appState.api('/api/orders/' + encodeURIComponent(n) + '/payments').then(function (r) {
          if (!r.ok) return;
          var subs = r.data.submissions || [];
          var latest = $('pay-latest-' + keyOf(n)); if (latest) latest.innerHTML = latestHtml(subs[0]);
          var box = $('pay-hist-' + keyOf(n)); if (box) box.innerHTML = historyHtml(subs, n);
          var rej = $('pay-reject-' + keyOf(n));
          if (rej && subs[0] && subs[0].rejectionReason) rej.innerHTML = '<strong>Payment proof not verified.</strong> Reason: ' + esc(subs[0].rejectionReason) + '<br>Please submit new proof with the correct reference number.';
        });
      });
    },
    pickFile: function (input, orderNumber) {
      var k = keyOf(orderNumber), f = input.files && input.files[0], self = this;
      var prev = $('pay-prev-' + k);
      delete this.files[k];
      if (!f) { if (prev) prev.classList.add('hidden'); return; }
      if (f.size > 5 * 1024 * 1024) { showToast('The receipt image must be 5 MB or smaller.', 'error'); input.value = ''; return; }
      if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { showToast('Please choose a PNG, JPG or WebP image.', 'error'); input.value = ''; return; }
      var reader = new FileReader();
      reader.onload = function (e) { self.files[k] = e.target.result; if (prev) { prev.src = e.target.result; prev.classList.remove('hidden'); } };
      reader.readAsDataURL(f);
    },
    submit: async function (e, orderNumber) {
      if (e && e.preventDefault) e.preventDefault();
      var k = keyOf(orderNumber);
      var err = $('pay-err-' + k);
      var show = function (m) { err.textContent = m; err.classList.remove('hidden'); };
      err.classList.add('hidden');
      var ref = ($('pay-ref-' + k).value || '').trim(), amt = $('pay-amt-' + k).value;
      if (R.paymentReferenceKey(ref).length < 6) return show('Enter the transaction reference number shown on your receipt.');
      if (!(Number(amt) > 0)) return show('Enter the amount you sent.');
      if (!this.files[k]) return show('Attach your payment receipt or screenshot.');
      var self = this;
      var sent = await UI.confirm({
        title: 'Submit this payment proof?',
        message: 'Please check the details. Each transaction reference number can only be used once.',
        details: [['Order', orderNumber], ['Reference no.', ref], ['Amount sent', money(amt)]],
        confirmLabel: 'Submit proof', busyLabel: 'Uploading…',
        onConfirm: async function () {
          var r = await appState.api('/api/orders/' + encodeURIComponent(orderNumber) + '/payments', { method: 'POST', body: { reference: ref, amount: Number(amt), receiptDataUrl: self.files[k] } });
          if (r.ok) return { ok: true };
          if (r.network) return { ok: false, error: 'We could not reach the shop. Nothing was submitted — please try again.' };
          show((r.data && r.data.error) || 'Your payment proof could not be submitted.');
          return { ok: false, close: true };
        }
      });
      if (!sent) return;
      delete self.files[k];
      showToast('Payment proof submitted for ' + orderNumber + '. Status: Pending Verification.', 'success');
      appState.ordersLoaded = false;
      var router = window.appRouter;
      if (router && router.currentView === 'account') router.refreshAccountOrders();
      else if (router && router.currentView === 'confirmation') { var d = await appState.fetchOrder(orderNumber); if (d.ok) router.lastCreatedOrder = d.order; router.renderView('confirmation'); api.hydrate(); }
      else if (router) router.loadTrackingResult(orderNumber);
      if (window.customerNotifications) window.customerNotifications.poll();
    },
    viewReceipt: async function (orderNumber, id) {
      try {
        var res = await fetch('/api/orders/' + encodeURIComponent(orderNumber) + '/payments/' + id + '/receipt', { headers: { Authorization: 'Bearer ' + appState.customerToken } });
        if (!res.ok) { showToast('The receipt could not be opened.', 'error'); return; }
        var url = URL.createObjectURL(await res.blob());
        window.customerDelivery.openLightbox(url, 'Payment receipt — ' + orderNumber, 'Submitted by you');
      } catch (_) { showToast('The receipt could not be opened.', 'error'); }
    }
  };
  window.customerPayments = api;

  // Hydrate after any view that renders order payment panels.
  var router = window.appRouter;
  if (router) {
    var proto = Object.getPrototypeOf(router);
    ['loadTrackingResult', 'refreshAccountOrders'].forEach(function (fn) {
      var orig = proto[fn];
      if (typeof orig !== 'function') return;
      proto[fn] = async function () { var r = await orig.apply(this, arguments); api.hydrate(); return r; };
    });
    var origRender = proto.renderView;
    proto.renderView = function (view) { var r = origRender.apply(this, arguments); if (view === 'confirmation') setTimeout(function () { api.hydrate(); }, 0); return r; };
  }
  document.addEventListener('toggle', function () { api.hydrate(); }, true);
})();
