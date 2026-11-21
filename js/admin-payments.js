/**
 * UMAIRA FLORIST - Admin payment verification (extends AdminApp from admin.js; load after it).
 *  • Payment status on every order row and in the order details, separate from the fulfillment status.
 *  • "Review Payment": receipt preview, amount due vs amount sent, reference, warnings, approve / reject.
 *  • Cash on Pickup / Cash on Delivery: "Confirm Cash Received" (the only way a cash order becomes Paid) —
 *    Cash on Pickup once the order is confirmed, Cash on Delivery only after delivery and the courier's remittance.
 *  • Payment history (append-only audit trail). Notifications are in-app only — no email.
 *  • Rich admin notifications for payment proofs and Shop Settings → Payment Accounts (GCash QR code).
 * The server enforces every rule; this file only presents it.
 */
(function () {
  'use strict';
  if (typeof AdminApp === 'undefined') { console.error('admin-payments.js: AdminApp not found'); return; }
  const P = AdminApp.prototype;
  const R = window.SHOP_RULES;
  const money = (n) => '₱' + (Number(n) || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  const errOf = (r, fb) => (r && r.data && r.data.error) || (r && r.error) || fb;

  const PILL = {
    'Unpaid': 'bg-amber-50 text-amber-800 border-amber-200',
    'Pending Verification': 'bg-sky-50 text-sky-800 border-sky-200',
    'Paid': 'bg-emerald-50 text-emerald-800 border-emerald-200',
    'Rejected': 'bg-red-50 text-red-700 border-red-200'
  };
  const ACTION_LABEL = {
    proof_submitted: 'Proof submitted', payment_approved: 'Payment approved', payment_rejected: 'Proof rejected',
    cash_received: 'Cash received by the shop', cash_collected_by_courier: 'Cash collected by courier (not yet remitted)'
  };
  const COP_CONFIRMABLE = ['Confirmed', 'Preparing', 'Ready for Pickup', 'Picked Up'];
  const COD_DELIVERED = ['Delivered — Awaiting Confirmation', 'Delivered', 'Delivered — Confirmed'];

  // Shown under the order status in the Orders table: plain text, colour carries the meaning (no pill).
  P.paymentStatusPill = function (o) {
    const s = R.normalizePaymentStatus(o && o.paymentStatus);
    const tone = { Paid: 'success', 'Pending Verification': 'info', Rejected: 'danger' }[s] || 'warning';
    return `<span class="status-text__sub" title="Payment: ${esc(R.paymentMethodLabel(o.paymentMethod))}"><span class="status-text status-text--${tone}" style="font-size:inherit">${s === 'Pending Verification' ? 'Payment to verify' : esc(s)}</span></span>`;
  };


  // ---------------------------------------------------------------- receipt images (private, fetched with the admin token)
  P.receiptObjectUrl = async function (subId) {
    this._receiptUrls = this._receiptUrls || {};
    if (this._receiptUrls[subId]) return this._receiptUrls[subId];
    const res = await fetch(`/api/admin/payments/${subId}/receipt`, { headers: { Authorization: `Bearer ${this.token}`, 'x-admin-token': this.token } });
    if (!res.ok) return '';
    const url = URL.createObjectURL(await res.blob());
    this._receiptUrls[subId] = url;
    return url;
  };
  P.fillReceiptImages = function (root) {
    (root || document).querySelectorAll('img[data-receipt-id]:not([data-loaded])').forEach(async (img) => {
      img.setAttribute('data-loaded', '1');
      const url = await this.receiptObjectUrl(img.getAttribute('data-receipt-id'));
      if (url) img.src = url; else img.alt = 'Receipt could not be loaded';
    });
  };
  P.openReceipt = async function (subId, title) {
    const url = await this.receiptObjectUrl(subId);
    if (!url) { this.toast('The receipt image could not be loaded.', 'error'); return; }
    this.openPodLightbox(url, title || 'Payment receipt', 'Customer-submitted payment proof — always check the actual account before approving.');
  };

  // ---------------------------------------------------------------- order details: payment panel
  const origOpenOrderDetail = P.openOrderDetail;
  P.openOrderDetail = function (orderNum) {
    const r = origOpenOrderDetail.apply(this, arguments);
    const order = (this.orders || []).find(o => o.orderNumber === orderNum);
    const content = document.getElementById('admin-order-modal-content');
    if (!order || !content) return r;
    const wrap = content.firstElementChild;
    if (wrap && !document.getElementById('admin-order-payment-panel')) {
      const panel = document.createElement('div');
      panel.id = 'admin-order-payment-panel';
      panel.innerHTML = this.orderPaymentPanelHTML(order, null);
      if (wrap.children[1]) wrap.insertBefore(panel, wrap.children[1]); else wrap.appendChild(panel);
    }
    this.gatePreparationButton(order);
    this.loadOrderPaymentPanel(orderNum);
    return r;
  };

  // Buttons that would move an order past a payment gate are disabled with the reason (the server refuses too):
  // GCash — Confirm Order / Start Preparation until Paid; Cash on Pickup — Mark Picked Up until the cash is confirmed.
  P.gatePreparationButton = function (order) {
    document.querySelectorAll('#admin-order-modal-content button').forEach(b => {
      const oc = b.getAttribute('onclick') || '';
      const target = /confirmOrder\(/.test(oc) ? 'Confirmed'
        : /confirmPickupHandover\(/.test(oc) ? 'Awaiting Customer Confirmation'
        : ((oc.match(/updateStatus\([^,]+,\s*'([^']+)'\)/) || [])[1] || '');
      const msg = target ? this.paymentGate(order, target) : '';
      if (!msg) return;
      b.disabled = true;
      b.classList.add('opacity-50', 'cursor-not-allowed');
      b.title = msg;
      b.textContent = target === 'Picked Up' ? 'Mark Picked Up (confirm cash first)' : target === 'Awaiting Customer Confirmation' ? 'Confirm Pickup (confirm cash first)' : target === 'Confirmed' ? 'Confirm Order (verify payment first)' : 'Start Preparation (verify payment first)';
    });
  };

  P.orderPaymentPanelHTML = function (o, data) {
    const s = R.normalizePaymentStatus(o.paymentStatus);
    const online = o.paymentKind === 'online';
    const isPickupCash = o.paymentMethod === 'Cash on Pickup';
    const isCod = o.paymentMethod === 'Cash on Delivery';
    const cancelled = o.status === 'Rejected/Cancelled';
    const pending = data ? data.submissions.find(x => x.status === 'pending') : null;
    const n = esc(o.orderNumber);
    const g = (this.shopSettings && this.shopSettings.payment && this.shopSettings.payment.gcash) || {};
    const accountMissing = o.paymentMethod === 'GCash' && !g.qrImage;
    const collected = data && data.codCashCollected;
    let action = '';
    if (s === 'Paid') {
      action = `<p class="text-[11px] text-emerald-800 font-semibold">Paid${o.paidAmount != null ? ' ' + money(o.paidAmount) : ''} · ${online ? 'verified' : 'cash confirmed'} by <strong>${esc(o.paidBy || 'admin')}</strong>${o.paidAt ? ' on ' + esc(when(o.paidAt)) : ''}</p>`;
    } else if (online && pending) {
      action = `<button type="button" onclick="window.adminApp.openPaymentReview('${n}', ${pending.id})" class="btn-tactile py-2 px-4 rounded-xl bg-sky-700 hover:bg-sky-800 text-white font-bold text-xs shadow-xs transition">Review Payment</button>
        ${pending.warnings.length ? `<span class="text-[11px] font-bold text-red-700">${pending.warnings.length} warning${pending.warnings.length > 1 ? 's' : ''}</span>` : ''}`;
    } else if (online) {
      action = `<p class="text-[11px] text-[#6E6864]">${s === 'Rejected' ? 'Last proof was rejected — waiting for the customer to submit new proof.' : 'Waiting for the customer to submit GCash payment proof.'} Confirming and preparing the order are blocked until the payment is verified.</p>`;
    } else if (cancelled) {
      action = '';
    } else if (isPickupCash) {
      action = COP_CONFIRMABLE.includes(o.status)
        ? `<button type="button" onclick="window.adminApp.openCashConfirm('${n}')" class="btn-tactile py-2 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition">Confirm Cash Received</button>
          <span class="text-[11px] text-[#6E6864]">When the customer pays ${money(o.total)} at the shop. The order cannot be released until then.</span>`
        : `<p class="text-[11px] text-[#6E6864]">Cash on Pickup: confirm and prepare the order now; collect ${money(o.total)} at the shop when the customer picks it up.</p>`;
    } else if (isCod) {
      action = COD_DELIVERED.includes(o.status)
        ? `<button type="button" onclick="window.adminApp.openCashConfirm('${n}')" class="btn-tactile py-2 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition">Confirm Cash Received</button>
          <span class="text-[11px] text-[#6E6864]">${collected ? 'Courier collected the cash. ' : ''}Confirm only after the courier has remitted ${money(o.total)} to the shop.</span>`
        : `<p class="text-[11px] text-[#6E6864]">Cash on Delivery: the courier collects ${money(o.total)} on delivery. Payment stays Unpaid until the remitted cash is confirmed after delivery.</p>`;
    }
    return `
      <div class="p-4 rounded-2xl border ${s === 'Pending Verification' ? 'border-sky-200 bg-sky-50/40' : 'border-[#E5ECE6] bg-[#FFF9F5]'} space-y-2.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span class="font-bold text-[#6E6864] text-[10px] uppercase tracking-wider block">Payment</span>
            <p class="font-bold text-[#302C2A] text-sm">${esc(R.paymentMethodLabel(o.paymentMethod))} · <span class="font-mono">${money(o.total)}</span> due</p>
          </div>
          <span class="inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border ${PILL[s] || PILL.Unpaid}">${esc(s)}</span>
        </div>
        ${accountMissing && s !== 'Paid' ? `<p class="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">No GCash QR code is set in Shop Settings → Payment Accounts, so this customer cannot submit GCash payment proof yet.</p>` : ''}
        <div class="flex flex-wrap items-center gap-2">${action}
          <button type="button" onclick="window.adminApp.openPaymentReview('${n}')" class="text-[11px] font-bold text-[#647D69] hover:underline ml-auto">Payment history${data ? ` (${data.events.length})` : ''}</button>
        </div>
      </div>`;
  };

  P.loadOrderPaymentPanel = async function (orderNum) {
    const r = await this.apiRequest(`/api/admin/orders/${encodeURIComponent(orderNum)}/payments`);
    const panel = document.getElementById('admin-order-payment-panel');
    const order = (this.orders || []).find(o => o.orderNumber === orderNum);
    if (!r.ok || !panel || !order || this.currentDetailOrderNumber !== orderNum) return;
    panel.innerHTML = this.orderPaymentPanelHTML(order, r.data);
  };

  // ---------------------------------------------------------------- payment review modal
  P.ensurePaymentModal = function () {
    let m = document.getElementById('admin-payment-modal');
    if (m) return m;
    m = document.createElement('div');
    m.id = 'admin-payment-modal';
    m.className = 'hidden fixed inset-0 z-[60] bg-[#302C2A]/30 backdrop-blur-sm flex items-center justify-center p-4';
    m.innerHTML = '<div class="bg-white w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl p-5 sm:p-7 shadow-2xl border border-[#E5ECE6]" id="admin-payment-modal-body"></div>';
    m.addEventListener('click', (e) => { if (e.target === m) this.closePaymentModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !m.classList.contains('hidden')) this.closePaymentModal(); });
    document.body.appendChild(m);
    return m;
  };
  // The dialog role is present only while the modal is open (a hidden dialog must not linger for assistive tech).
  P.showPaymentModal = function (m) {
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('aria-labelledby', 'admin-payment-modal-title');
    m.classList.remove('hidden');
  };
  P.closePaymentModal = function () {
    const m = document.getElementById('admin-payment-modal');
    if (m) {
      m.classList.add('hidden');
      ['role', 'aria-modal', 'aria-labelledby'].forEach(a => m.removeAttribute(a));
      const body = document.getElementById('admin-payment-modal-body');
      if (body) body.innerHTML = '';
    }
    this._paymentModalOrder = null;
  };

  P.openPaymentReview = async function (orderNum, submissionId) {
    const m = this.ensurePaymentModal();
    const body = document.getElementById('admin-payment-modal-body');
    body.innerHTML = '<p class="py-16 text-center text-xs text-[#6E6864]">Loading payment details…</p>';
    this.showPaymentModal(m);
    this._paymentModalOrder = orderNum;
    if (!(this.orders || []).some(o => o.orderNumber === orderNum)) await this.loadOrders();
    const r = await this.apiRequest(`/api/admin/orders/${encodeURIComponent(orderNum)}/payments`);
    const order = (this.orders || []).find(o => o.orderNumber === orderNum);
    if (!r.ok || !order) { body.innerHTML = `<p class="py-16 text-center text-xs text-red-700">${esc(errOf(r, 'Could not load this order.'))}</p>`; return; }
    const data = r.data;
    const sub = submissionId ? data.submissions.find(s => s.id === Number(submissionId)) : data.submissions.find(s => s.status === 'pending');
    body.innerHTML = this.paymentReviewHTML(order, data, sub);
    this.fillReceiptImages(body);
    const first = body.querySelector('input,textarea,button');
    if (first) first.focus();
  };

  P.paymentReviewHTML = function (o, data, sub) {
    const n = esc(o.orderNumber);
    const label = esc(R.paymentMethodLabel(o.paymentMethod));
    const mismatch = sub && Math.abs(sub.amountSubmitted - sub.amountDue) > 0.009;
    const reviewBlock = sub ? `
      <div class="grid grid-cols-1 md:grid-cols-5 gap-4">
        <button type="button" onclick="window.adminApp.openReceipt(${sub.id}, 'Receipt — ${n}')" class="md:col-span-2 rounded-xl border border-[#E5ECE6] bg-stone-50 overflow-hidden flex items-center justify-center min-h-[220px] group" aria-label="Open the receipt at full size">
          <img data-receipt-id="${sub.id}" alt="Payment receipt submitted for ${n}" class="max-h-[340px] w-full object-contain group-hover:opacity-90">
        </button>
        <div class="md:col-span-3 space-y-3 text-xs">
          <dl class="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5">
            <dt class="text-[#6E6864]">Customer</dt><dd class="font-bold text-[#302C2A]">${esc(o.firstName)} ${esc(o.lastName)} <span class="font-normal text-[#6E6864]">· ${esc(o.phone)} · ${esc(o.email)}</span></dd>
            <dt class="text-[#6E6864]">Order</dt><dd class="font-mono font-bold">${n} <span class="font-sans font-normal text-[#6E6864]">(${esc(o.status)})</span></dd>
            <dt class="text-[#6E6864]">Method</dt><dd class="font-semibold">${esc(sub.methodLabel)}</dd>
            <dt class="text-[#6E6864]">Amount due</dt><dd class="font-mono font-bold">${money(sub.amountDue)}</dd>
            <dt class="text-[#6E6864]">Amount sent</dt><dd class="font-mono font-bold ${mismatch ? 'text-red-700' : 'text-emerald-800'}">${money(sub.amountSubmitted)}${mismatch ? ' — does not match the amount due' : ' — matches the amount due'}</dd>
            <dt class="text-[#6E6864]">Reference no.</dt><dd class="font-mono font-bold text-[#302C2A] break-all">${esc(sub.reference)}</dd>
            <dt class="text-[#6E6864]">Submitted</dt><dd>${esc(when(sub.submittedAt))}</dd>
            <dt class="text-[#6E6864]">Status</dt><dd class="font-semibold">${esc(sub.status)}${sub.reviewedBy ? ` by ${esc(sub.reviewedBy)} · ${esc(when(sub.reviewedAt))}` : ''}</dd>
            ${sub.reviewNote ? `<dt class="text-[#6E6864]">Note</dt><dd>${esc(sub.reviewNote)}</dd>` : ''}
          </dl>
          ${sub.warnings.length ? `<div class="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 space-y-1" role="alert"><strong class="block">Needs careful review</strong>${sub.warnings.map(w => `<p>• ${esc(w.message)}</p>`).join('')}</div>` : ''}
        </div>
      </div>
      ${sub.status === 'pending' ? `
      <form class="space-y-3 border-t border-[#E5ECE6] pt-4 text-xs" onsubmit="return false">
        <label class="flex items-start gap-2 p-3 rounded-xl bg-[#FFF9F5] border border-[#E5ECE6] cursor-pointer">
          <input type="checkbox" id="pay-confirm-received" class="mt-0.5 accent-[#647D69]">
          <span>I checked the <strong>${label}</strong> account and <strong>${money(sub.amountSubmitted)}</strong> with reference <strong class="font-mono">${esc(sub.reference)}</strong> was actually received. <span class="text-[#6E6864]">(A screenshot alone is never enough.)</span></span>
        </label>
        ${sub.warnings.length ? `<label class="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 cursor-pointer"><input type="checkbox" id="pay-ack-warnings" class="mt-0.5 accent-red-700"><span>I reviewed the warnings above and the payment is correct (explain in the note).</span></label>` : ''}
        <div><label for="pay-review-note" class="block font-semibold text-[#302C2A] mb-1">Note <span class="font-normal text-[#6E6864]">— required to reject (the customer sees it)${sub.warnings.length ? ' and to approve a flagged payment' : ''}</span></label>
          <textarea id="pay-review-note" rows="2" maxlength="300" class="w-full px-3 py-2 rounded-xl border border-[#E5ECE6] focus:ring-2 focus:ring-[#647D69]/25 focus:border-[#647D69]" placeholder="e.g. Amount not found in GCash history / Reference number does not match"></textarea></div>
        <p id="pay-review-error" class="hidden p-3 rounded-xl bg-red-50 border border-red-200 text-red-800" role="alert"></p>
        <div class="flex flex-wrap justify-end gap-2">
          <button type="button" id="pay-reject-btn" onclick="window.adminApp.submitPaymentDecision('${n}', ${sub.id}, 'reject')" class="btn-tactile py-2.5 px-4 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-bold">Reject Proof</button>
          <button type="button" id="pay-approve-btn" onclick="window.adminApp.submitPaymentDecision('${n}', ${sub.id}, 'approve')" class="btn-tactile py-2.5 px-5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold shadow-xs">Approve — Mark Paid</button>
        </div>
      </form>` : ''}` : `<p class="text-xs text-[#6E6864] p-3 rounded-xl bg-[#FFF9F5] border border-[#E5ECE6]">${o.paymentKind === 'online' ? 'No payment proof is waiting for review on this order.' : 'This is a cash order — no proof is uploaded. Use "Confirm Cash Received" once the shop actually has the cash.'}</p>`;

    const subs = data.submissions.map(s => `
      <li class="py-2 flex flex-wrap items-center justify-between gap-2">
        <span><span class="font-mono font-semibold">${esc(s.reference)}</span> · ${money(s.amountSubmitted)} · ${esc(when(s.submittedAt))}${s.warnings.length ? ' · <span class="text-red-700 font-bold">needs review</span>' : ''}</span>
        <span class="flex items-center gap-2"><span class="text-[10px] font-bold uppercase">${esc(s.status)}${s.reviewedBy ? ' · ' + esc(s.reviewedBy) : ''}</span>
          ${sub && s.id === sub.id ? '' : `<button type="button" class="text-[11px] font-bold text-[#647D69] hover:underline" onclick="window.adminApp.openPaymentReview('${n}', ${s.id})">Open</button>`}</span>
      </li>`).join('') || '<li class="py-2 text-[#6E6864]">No submissions yet.</li>';
    const events = data.events.map(e => `
      <li class="py-1.5"><span class="font-semibold">${esc(ACTION_LABEL[e.action] || e.action)}</span> — ${esc(e.fromStatus || '')} → <strong>${esc(e.toStatus || '')}</strong>${e.amount != null ? ' · ' + money(e.amount) : ''}
        <span class="block text-[11px] text-[#6E6864]">${esc(when(e.createdAt))} · ${e.actorType === 'admin' ? 'Admin ' + esc(e.actor) : e.actorType === 'customer' ? 'Customer' : 'System'}${e.note ? ' · ' + esc(e.note) : ''}</span></li>`).join('') || '<li class="py-1.5 text-[#6E6864]">No payment activity yet.</li>';

    return `
      <div class="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 id="admin-payment-modal-title" class="font-serif font-bold text-xl text-[#302C2A]">Payment — <span class="font-mono">${n}</span></h3>
          <p class="text-xs text-[#6E6864]">${label} · ${money(o.total)} due · payment status <strong>${esc(o.paymentStatus)}</strong></p>
        </div>
        <button type="button" onclick="window.adminApp.closePaymentModal()" class="w-8 h-8 rounded-full bg-[#FFF9F5] hover:bg-[#EBF1EC] border border-[#E5ECE6] text-[#6E6864] shrink-0 flex items-center justify-center" aria-label="Close"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      </div>
      <div class="space-y-5">
        ${reviewBlock}
        <details class="text-xs border-t border-[#E5ECE6] pt-3" ${sub && sub.status === 'pending' ? '' : 'open'}>
          <summary class="cursor-pointer font-bold text-[#302C2A]">Submissions (${data.submissions.length})</summary><ul class="divide-y divide-[#E5ECE6] mt-1">${subs}</ul></details>
        <details class="text-xs border-t border-[#E5ECE6] pt-3" ${sub && sub.status === 'pending' ? '' : 'open'}>
          <summary class="cursor-pointer font-bold text-[#302C2A]">Payment history — audit trail (${data.events.length})</summary><ul class="divide-y divide-[#E5ECE6] mt-1">${events}</ul></details>
      </div>`;
  };

  P.afterPaymentChange = async function (orderNum, msg) {
    this.toast(msg, 'success');
    await this.loadOrders();
    if (typeof this.loadAdminNotifications === 'function') { await this.loadAdminNotifications(); this.updateNotificationBadge(); }
    if (this.currentDetailOrderNumber === orderNum) this.openOrderDetail(orderNum);
  };

  P.submitPaymentDecision = async function (orderNum, subId, decision) {
    const note = (document.getElementById('pay-review-note')?.value || '').trim();
    const errBox = document.getElementById('pay-review-error');
    const show = (t) => { if (errBox) { errBox.textContent = t; errBox.classList.remove('hidden'); } };
    if (errBox) errBox.classList.add('hidden');
    const confirmReceived = !!document.getElementById('pay-confirm-received')?.checked;
    const ackEl = document.getElementById('pay-ack-warnings');
    if (decision === 'approve' && !confirmReceived) return show('Tick the box once you have confirmed in the account that the money actually arrived.');
    if (decision === 'approve' && ackEl && (!ackEl.checked || note.length < 5)) return show('This payment has warnings: tick "I reviewed the warnings" and write a short note explaining why it is correct.');
    if (decision === 'reject' && note.length < 5) return show('Write the reason for rejecting (at least 5 characters). The customer will see it.');
    const btn = document.getElementById(decision === 'approve' ? 'pay-approve-btn' : 'pay-reject-btn');
    if (btn) btn.disabled = true;
    const r = await this.apiRequest(`/api/admin/orders/${encodeURIComponent(orderNum)}/payments/${subId}/${decision}`, 'POST',
      { note, confirmReceived, acknowledgeWarnings: !!(ackEl && ackEl.checked) });
    if (btn) btn.disabled = false;
    if (!r.ok) return show(errOf(r, 'The payment could not be updated. Nothing was changed.'));
    this.closePaymentModal();
    await this.afterPaymentChange(orderNum, decision === 'approve' ? `Payment for ${orderNum} approved — marked Paid. Customer notified.` : `Payment proof for ${orderNum} rejected. Customer notified with the reason.`);
  };

  // ---------------------------------------------------------------- cash
  P.openCashConfirm = async function (orderNum) {
    const o = (this.orders || []).find(x => x.orderNumber === orderNum);
    if (!o || o.paymentKind !== 'cash') return; // GCash is never marked paid with a cash confirmation
    const isCod = o.paymentMethod === 'Cash on Delivery';
    let collected = false;
    if (isCod) {
      const r = await this.apiRequest(`/api/admin/orders/${encodeURIComponent(orderNum)}/payments`);
      collected = !!(r.ok && r.data && r.data.codCashCollected);
    }
    const m = this.ensurePaymentModal();
    const body = document.getElementById('admin-payment-modal-body');
    body.innerHTML = `
      <div class="flex items-start justify-between gap-3 mb-4">
        <div><h3 id="admin-payment-modal-title" class="font-serif font-bold text-xl text-[#302C2A]">Confirm cash received</h3>
          <p class="text-xs text-[#6E6864]">Order <strong class="font-mono text-[#302C2A]">${esc(o.orderNumber)}</strong> · ${esc(o.firstName)} ${esc(o.lastName)} · ${esc(R.paymentMethodLabel(o.paymentMethod))} · expected <strong class="text-[#302C2A]">${money(o.total)}</strong></p></div>
        <button type="button" onclick="window.adminApp.closePaymentModal()" class="w-8 h-8 rounded-full bg-[#FFF9F5] hover:bg-[#EBF1EC] border border-[#E5ECE6] text-[#6E6864] shrink-0 flex items-center justify-center" aria-label="Close"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
      </div>
      <form class="space-y-3 text-xs" onsubmit="window.adminApp.submitCashConfirm(event, '${esc(o.orderNumber)}')">
        <div><label for="cash-amount" class="block font-semibold text-[#302C2A] mb-1">Cash amount received (₱)</label>
          <input id="cash-amount" type="number" min="1" step="0.01" required value="${Number(o.total).toFixed(2)}" class="w-48 px-3 py-2 rounded-xl border border-[#E5ECE6] font-mono font-bold focus:ring-2 focus:ring-[#647D69]/25"></div>
        ${isCod ? `
        <label class="flex items-start gap-2 p-3 rounded-xl bg-[#FFF9F5] border border-[#E5ECE6] cursor-pointer"><input type="checkbox" id="cash-collected" class="mt-0.5 accent-[#647D69]" ${collected ? 'checked disabled' : ''}><span>The courier collected the cash from the customer on delivery${collected ? ' (already recorded)' : ''}.</span></label>
        <label class="flex items-start gap-2 p-3 rounded-xl bg-[#FFF9F5] border border-[#E5ECE6] cursor-pointer"><input type="checkbox" id="cash-remitted" class="mt-0.5 accent-[#647D69]"><span>The courier has <strong>remitted</strong> this cash to the shop.</span></label>` : ''}
        <label class="flex items-start gap-2 p-3 rounded-xl bg-[#FFF9F5] border border-[#E5ECE6] cursor-pointer"><input type="checkbox" id="cash-confirm" class="mt-0.5 accent-[#647D69]"><span>I have counted the cash and the shop has actually received it.</span></label>
        <div><label for="cash-note" class="block font-semibold text-[#302C2A] mb-1">Note <span class="font-normal text-[#6E6864]">— required if the amount differs from the total</span></label>
          <textarea id="cash-note" rows="2" maxlength="300" class="w-full px-3 py-2 rounded-xl border border-[#E5ECE6]"></textarea></div>
        <p id="cash-error" class="hidden p-3 rounded-xl bg-red-50 border border-red-200 text-red-800" role="alert"></p>
        <div class="flex justify-end gap-2"><button type="button" onclick="window.adminApp.closePaymentModal()" class="py-2.5 px-4 rounded-xl border border-[#E5ECE6] bg-white font-semibold">Cancel</button>
          <button type="submit" id="cash-submit" class="btn-tactile py-2.5 px-5 rounded-xl bg-emerald-800 hover:bg-emerald-700 text-white font-bold">Confirm Cash Received</button></div>
      </form>`;
    this.showPaymentModal(m);
    document.getElementById('cash-amount')?.focus();
  };
  P.submitCashConfirm = async function (e, orderNum) {
    if (e) e.preventDefault();
    const err = document.getElementById('cash-error');
    const show = (t) => { err.textContent = t; err.classList.remove('hidden'); };
    err.classList.add('hidden');
    const confirmReceived = !!document.getElementById('cash-confirm')?.checked;
    const collectedEl = document.getElementById('cash-collected'), remittedEl = document.getElementById('cash-remitted');
    if (collectedEl && !collectedEl.checked) return show('Tick that the courier collected the cash from the customer.');
    if (remittedEl && !remittedEl.checked) return show('Cash on Delivery is confirmed only after the courier remits the cash to the shop.');
    if (!confirmReceived) return show('Tick the box only once the shop actually has the cash.');
    const btn = document.getElementById('cash-submit'); if (btn) btn.disabled = true;
    const r = await this.apiRequest(`/api/admin/orders/${encodeURIComponent(orderNum)}/payments/cash`, 'POST', {
      amountReceived: Number(document.getElementById('cash-amount')?.value), note: (document.getElementById('cash-note')?.value || '').trim(), confirmReceived,
      collectedByCourier: !!(collectedEl && collectedEl.checked), remittedToShop: !!(remittedEl && remittedEl.checked)
    });
    if (btn) btn.disabled = false;
    if (!r.ok) return show(errOf(r, 'Could not record the cash payment.'));
    this.closePaymentModal();
    await this.afterPaymentChange(orderNum, `Cash payment recorded for ${orderNum} — marked Paid.`);
  };

  // Proof of delivery for Cash on Delivery: optionally record that the courier collected the cash (payment stays Unpaid).
  const origOpenPod = P.openPodModal;
  P.openPodModal = function (orderNum) {
    const r = origOpenPod.apply(this, arguments);
    const o = (this.orders || []).find(x => x.orderNumber === orderNum);
    const notes = document.getElementById('admin-pod-notes');
    let box = document.getElementById('pod-cod-collected-wrap');
    if (box) box.remove();
    if (o && o.paymentMethod === 'Cash on Delivery' && o.paymentStatus !== 'Paid' && notes) {
      box = document.createElement('label');
      box.id = 'pod-cod-collected-wrap';
      box.className = 'flex items-start gap-2 p-3 rounded-xl bg-[#FFF9F5] border border-[#E5ECE6] text-xs cursor-pointer';
      box.innerHTML = `<input type="checkbox" id="pod-cod-collected" class="mt-0.5 accent-[#647D69]"><span>Cash on Delivery: the courier collected <strong>${money(o.total)}</strong> from the customer. <span class="text-[#6E6864]">(Payment stays Unpaid until the cash is remitted and confirmed.)</span></span>`;
      (notes.parentElement || notes).insertAdjacentElement('afterend', box);
    }
    return r;
  };

  // ---------------------------------------------------------------- notifications
  const origGetNotifications = P.getNotifications;
  P.getNotifications = function () {
    const list = origGetNotifications.apply(this, arguments);
    const byId = new Map((this.dbNotifications || []).map(n => [n.id, n]));
    for (const item of list) {
      const n = item.dbId != null ? byId.get(item.dbId) : null;
      if (!n) continue;
      if (n.type === 'payment_submitted') {
        const d = n.data || {};
        item.badge = (d.warnings && d.warnings.length) ? 'Payment (check)' : 'Payment';
        item.badgeClass = (d.warnings && d.warnings.length) ? 'bg-red-100 text-red-800 border-red-300 font-bold' : 'bg-sky-100 text-sky-800 border-sky-300 font-bold';
        item.type = 'order';
        item.payment = d;
        item.action = async () => {
          if (!n.isRead) { try { await this.apiRequest(`/api/admin/notifications/${n.id}/read`, 'POST'); } catch (_) {} }
          this.openPaymentReview(n.orderNumber, d.submissionId);
          await this.loadAdminNotifications();
          this.updateNotificationBadge();
        };
      }
    }
    return list;
  };
  // Payment alerts show every detail plus the receipt, with a direct "Review Payment" button.
  const origRenderPopover = P.renderNotificationsPopover;
  P.renderNotificationsPopover = function () {
    const r = origRenderPopover.apply(this, arguments);
    const dropdown = document.getElementById('topbar-notifications-dropdown');
    if (!dropdown) return r;
    for (const item of this.getNotifications()) {
      if (!item.payment) continue;
      const btn = dropdown.querySelector(`button[onclick="window.adminApp.handleNotificationClick('${item.id}')"]`);
      if (!btn || btn.nextElementSibling && btn.nextElementSibling.classList.contains('pay-notif-detail')) continue;
      const d = item.payment;
      const box = document.createElement('div');
      box.className = 'pay-notif-detail mx-2.5 mb-2 p-2.5 rounded-xl border border-sky-200 bg-sky-50/50 flex gap-2.5 text-[11px] text-[#302C2A]';
      box.innerHTML = `
        <img data-receipt-id="${Number(d.submissionId)}" alt="Receipt" class="w-14 h-14 rounded-lg object-cover bg-white border border-[#E5ECE6] shrink-0">
        <div class="min-w-0 flex-1 space-y-0.5">
          <p><strong>${esc(d.customerName)}</strong> · <span class="font-mono">${esc(d.orderNumber)}</span></p>
          <p>${esc(d.method)} · due <strong>${money(d.amountDue)}</strong> · sent <strong class="${Math.abs(d.amountSubmitted - d.amountDue) > 0.009 ? 'text-red-700' : ''}">${money(d.amountSubmitted)}</strong></p>
          <p>Ref <span class="font-mono font-bold">${esc(d.reference)}</span> · ${esc(when(d.submittedAt))}</p>
          ${(d.warnings || []).map(w => `<p class="text-red-700">Warning: ${esc(w.message)}</p>`).join('')}
          <button type="button" class="mt-1 px-2.5 py-1 rounded-lg bg-sky-700 hover:bg-sky-800 text-white font-bold" onclick="window.adminApp.handleNotificationClick('${item.id}')">Review Payment</button>
        </div>`;
      btn.insertAdjacentElement('afterend', box);
    }
    this.fillReceiptImages(dropdown);
    return r;
  };

  // Stored alerts (e.g. payment proofs submitted while the console was closed) load with the console.
  const origRefreshAll = P.refreshAll;
  if (typeof origRefreshAll === 'function') {
    P.refreshAll = async function () {
      const r = await origRefreshAll.apply(this, arguments);
      try { await this.loadAdminNotifications(); this.updateNotificationBadge(); } catch (_) {}
      return r;
    };
  }

  // ---------------------------------------------------------------- realtime: tell the admin immediately
  const origSetup = P.setupRealtimeSync;
  P.setupRealtimeSync = function () {
    const r = origSetup.apply(this, arguments);
    if (this.eventSource) {
      this.eventSource.addEventListener('payment:submitted', (e) => {
        let d = {}; try { d = JSON.parse(e.data || '{}'); } catch (_) {}
        this.toast(`Payment proof from ${d.customerName || 'a customer'} for ${d.orderNumber || 'an order'} (${money(d.amountSubmitted)}). Open the bell to review.`, (d.warnings && d.warnings.length) ? 'warning' : 'info');
        this.loadAdminNotifications().then(() => this.updateNotificationBadge());
      });
    }
    return r;
  };

  // ---------------------------------------------------------------- Shop Settings → Payment Accounts (GCash only)
  P.renderPaymentAccountSettings = function () {
    const g = ((this.shopSettings && this.shopSettings.payment) || {}).gcash || {};
    // Live updates refresh settings in the background; never overwrite details the admin is still editing.
    const form = document.getElementById('settings-payment-form');
    if (form && !form.dataset.dirtyWatch) {
      form.dataset.dirtyWatch = '1';
      form.addEventListener('input', () => { form.dataset.dirty = '1'; });
    }
    if (!(form && form.dataset.dirty === '1')) {
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ''; };
      set('setting-gcash-name', g.accountName); set('setting-gcash-number', g.number);
      this._pendingQr = g.qrImage || '';
      this._qrChanged = false;
    }
    this.renderQrPreview();
    const pill = document.getElementById('payment-accounts-pill');
    if (pill) {
      const gcashActive = !!(g.qrImage && g.accountName && g.number);
      pill.textContent = gcashActive ? 'GCash active' : 'GCash not set up';
      pill.className = 'text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ' + (gcashActive ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-amber-50 text-amber-800 border-amber-200');
    }
    // If all payment fields are empty, the settings may not have loaded yet — fetch once and re-render.
    if (!g.accountName && !g.number && !g.qrImage && !this._paymentSettingsFetching) {
      this._paymentSettingsFetching = true;
      this.apiRequest('/api/admin/settings').then(res => {
        this._paymentSettingsFetching = false;
        if (res.ok && res.data && res.data.settings) {
          this.shopSettings = res.data.settings;
          this.renderPaymentAccountSettings();
        }
      }).catch(() => { this._paymentSettingsFetching = false; });
    }
  };
  P.renderQrPreview = function () {
    const img = document.getElementById('setting-gcash-qr-preview');
    const empty = document.getElementById('setting-gcash-qr-empty');
    const remove = document.getElementById('setting-gcash-qr-remove');
    const has = !!this._pendingQr;
    if (img) { if (has) img.src = this._pendingQr; else img.removeAttribute('src'); img.classList.toggle('hidden', !has); }
    if (empty) empty.classList.toggle('hidden', has);
    if (remove) remove.classList.toggle('hidden', !has);
  };
  // Upload a new QR image; it becomes active only after "Save Payment Accounts".
  P.handleGcashQrSelected = async function (input) {
    const f = input.files && input.files[0];
    if (!f) return;
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) { this.toast('Upload the QR code as a PNG, JPG or WebP image.', 'error'); input.value = ''; return; }
    if (f.size > 5 * 1024 * 1024) { this.toast('The QR image must be 5 MB or smaller.', 'error'); input.value = ''; return; }
    const dataUrl = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.onerror = rej; rd.readAsDataURL(f); });
    const up = await this.apiRequest('/api/admin/upload', 'POST', { dataUrl, folder: 'settings' });
    input.value = '';
    if (!up.ok || !up.data || !up.data.url) { this.toast(errOf(up, 'The QR image could not be uploaded.'), 'error'); return; }
    this._pendingQr = up.data.url;
    this._qrChanged = true;
    const form = document.getElementById('settings-payment-form');
    if (form) form.dataset.dirty = '1';
    this.renderQrPreview();
    this.toast('QR code uploaded. Click "Save Payment Accounts" to make it active.', 'info');
  };
  P.removeGcashQr = function () {
    this._pendingQr = '';
    this._qrChanged = true; // the image file itself is kept on the server; only the setting stops pointing to it
    const form = document.getElementById('settings-payment-form');
    if (form) form.dataset.dirty = '1';
    this.renderQrPreview();
  };
  const origLoadSettings = P.loadSettings;
  P.loadSettings = async function () {
    const r = await origLoadSettings.apply(this, arguments);
    this.renderPaymentAccountSettings();
    return r;
  };

  // Render immediately on navigation using cached data (before the fetch completes),
  // so the form never flashes "GCASH NOT SET UP" while settings are loading.
  const origSwitchTab = P.switchTab;
  if (typeof origSwitchTab === 'function') {
    P.switchTab = function (target) {
      const r = origSwitchTab.apply(this, arguments);
      if (target === 'settings') this.renderPaymentAccountSettings();
      return r;
    };
  }
  P.savePaymentSettings = async function (e) {
    if (e) e.preventDefault();
    const v = (id) => (document.getElementById(id)?.value || '').trim();
    // The QR code is sent only when the admin picked a new one or removed it; otherwise the configured QR is kept as is.
    const gcash = { accountName: v('setting-gcash-name'), number: v('setting-gcash-number') };
    if (this._qrChanged) gcash.qrImage = this._pendingQr || '';
    const patch = { payment: { gcash } };
    const r = await this.apiRequest('/api/admin/settings', 'PUT', patch);
    if (!r.ok) { this.toast(errOf(r, 'Payment accounts could not be saved.'), 'error'); return; }
    this.shopSettings = r.data.settings || this.shopSettings;
    const form = document.getElementById('settings-payment-form');
    if (form) delete form.dataset.dirty;
    this.renderPaymentAccountSettings();
    const saved = ((this.shopSettings.payment || {}).gcash || {});
    const gcashActive = !!(saved.qrImage && saved.accountName && saved.number);
    if (gcashActive) {
      this.toast('GCash is now active. Customers can see the QR code and pay at checkout.', 'success');
    } else {
      const missing = [!saved.qrImage && 'QR code', !saved.accountName && 'account name', !saved.number && 'mobile number'].filter(Boolean);
      this.toast(`Saved. GCash is unavailable to customers until you add: ${missing.join(', ')}.`, 'info');
    }
  };
})();
