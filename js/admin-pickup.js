/**
 * UMAIRA FLORIST - Two-way store pickup confirmation (extends AdminApp from admin.js; load after it).
 *  1. Shop: "Confirm Pickup" when the order is physically handed over → Awaiting Customer Confirmation
 *     (records the admin and the time; the customer gets an in-app request to confirm receipt).
 *  2. Customer: "Confirm Received" on their order page → Picked Up, or "Report an Issue" → Pickup Disputed.
 * The admin can never mark a pickup as received for the customer. The server enforces every rule.
 * Also: the delivery confirmation record (photo → customer answer), "Delivery Attempt Failed", and the
 * automatic confirmation when the customer does not answer in time (pickup 24 h, delivery 48 h).
 */
(function () {
  'use strict';
  if (typeof AdminApp === 'undefined') { console.error('admin-pickup.js: AdminApp not found'); return; }
  const P = AdminApp.prototype;
  const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('en-PH', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }); };
  const ACTION = {
    pickup_handover_confirmed: 'Shop confirmed handover',
    pickup_receipt_confirmed: 'Customer confirmed receipt',
    pickup_issue_reported: 'Customer reported an issue',
    pickup_issue_resolved: 'Shop resolved the issue',
    pickup_auto_confirmed: 'Confirmed automatically (no response)',
    delivery_pod_uploaded: 'Delivered with photo',
    delivery_receipt_confirmed: 'Customer confirmed receipt',
    delivery_issue_reported: 'Customer reported an issue',
    delivery_issue_resolved: 'Shop resolved the issue',
    delivery_auto_confirmed: 'Confirmed automatically (no response)',
    delivery_attempt_failed: 'Delivery attempt failed',
    delivery_reattempt: 'Delivery re-attempted',
    confirmation_reminder_sent: 'Customer reminded to confirm',
    order_cancelled: 'Order cancelled'
  };
  const historyHTML = (o, open) => {
    const items = (o.history || []).filter(e => ACTION[e.action]).map(e =>
      `<li class="py-1"><span class="font-semibold">${esc(ACTION[e.action])}</span> · ${esc(when(e.createdAt))}${e.actorType === 'admin' ? ' · ' + esc(e.actor) : e.actorType === 'system' ? ' · Automatic' : ''}${e.note && !['pickup_handover_confirmed', 'pickup_receipt_confirmed', 'delivery_receipt_confirmed'].includes(e.action) ? `<span class="block text-[11px] text-[#6E6864]">${esc(e.note)}</span>` : ''}</li>`).join('');
    return items ? `<details class="text-xs"${open ? ' open' : ''}><summary class="cursor-pointer font-semibold text-[#647D69]">Order history</summary><ul class="divide-y divide-[#E5ECE6] mt-1">${items}</ul></details>` : '';
  };
  const customerLine = (o, doneStatus, disputedStatus) => {
    if (o.status === doneStatus && o.customerConfirmationStatus === 'auto') return `<span class="text-emerald-800 font-semibold">Confirmed automatically ${esc(when(o.customerConfirmedAt))}</span> <span class="text-[#6E6864]">(no response in time)</span>`;
    if (o.status === doneStatus && o.customerConfirmationStatus === 'resolved') return `<span class="text-emerald-800 font-semibold">Resolved by the shop</span>${o.disputeResolvedAt ? ' · ' + esc(when(o.disputeResolvedAt)) : ''}`;
    if (o.status === doneStatus && o.customerConfirmedAt) return `<span class="text-emerald-800 font-semibold">Confirmed ${esc(when(o.customerConfirmedAt))}</span>`;
    if (o.status === disputedStatus) return `<span class="text-rose-700 font-semibold">Issue reported: ${esc(o.customerDisputeReason || 'Order not received')}</span>`;
    return `<span class="text-amber-700 font-semibold">Waiting for the customer to confirm receipt</span>${o.confirmationDeadline ? `<span class="block text-[11px] text-[#6E6864]">Confirmed automatically on ${esc(when(o.confirmationDeadline))} if there is no answer</span>` : ''}`;
  };

  // "Delivery Attempt Failed": the reason is shown to the customer; then re-attempt or cancel.
  P.markDeliveryFailedPrompt = function (orderNum) {
    const o = (this.orders || []).find(x => x.orderNumber === orderNum);
    this.confirmAction({
      title: 'Delivery attempt failed?',
      message: 'Record that the courier could not deliver. The customer is notified with the reason; you can then re-attempt the delivery or cancel the order.',
      details: o ? [['Order', o.orderNumber], ['Recipient', `${o.firstName} ${o.lastName}`], ['Address', o.address || '']] : undefined,
      confirmLabel: 'Record Failed Attempt',
      input: { type: 'textarea', label: 'What happened? (shown to the customer)', placeholder: 'e.g. Nobody was home; the guard would not accept the delivery', required: true }
    }, (val) => this.apiRequest(`/api/admin/orders/${encodeURIComponent(orderNum)}/delivery-failed`, 'POST', { reason: val }), async () => {
      this.toast(`Failed delivery attempt recorded for ${orderNum}. The customer has been notified.`, 'info');
      await this.loadOrders();
      if (typeof this.loadStats === 'function') this.loadStats();
      this.openOrderDetail(orderNum);
    });
  };

  P.deliveryConfirmationHTML = function (o) {
    if (!o || o.fulfillment === 'pickup') return '';
    const failed = o.status === 'Delivery Attempt Failed';
    // The photo and the customer's answer are shown in the Proof of Delivery section above; this panel adds the
    // failed-attempt reason, the automatic-confirmation deadline and the full history.
    const history = historyHTML(o, o.status === 'Delivery Disputed' || failed);
    if (!failed && !history) return '';
    const waiting = o.status === 'Delivered — Awaiting Confirmation' && o.confirmationDeadline;
    return `
      <div class="p-4 rounded-2xl ${failed ? 'bg-orange-50 border-orange-200' : 'bg-[#FFF9F5] border-[#E5ECE6]'} border space-y-2.5">
        <div class="flex items-center gap-2 border-b border-[#E5ECE6] pb-2.5">
          <span class="w-2.5 h-2.5 rounded-full ${failed ? 'bg-orange-500' : 'bg-[#647D69]'}"></span>
          <span class="font-bold text-[#302C2A] text-xs">Delivery Record</span>
        </div>
        ${failed ? `<p class="text-xs text-orange-900"><span class="font-semibold">Delivery attempt failed:</span> ${esc(o.deliveryFailedReason || '')}</p>` : ''}
        ${waiting ? `<p class="text-xs text-[#6E6864]">Confirmed automatically on <span class="font-semibold text-[#302C2A]">${esc(when(o.confirmationDeadline))}</span> if the customer does not answer.</p>` : ''}
        ${history}
      </div>`;
  };

  // Step 1: the shop confirms the physical handover (never on the customer's behalf).
  P.confirmPickupHandover = function (orderNum) {
    const o = (this.orders || []).find(x => x.orderNumber === orderNum);
    const gate = o && typeof this.paymentGate === 'function' ? this.paymentGate(o, 'Awaiting Customer Confirmation') : '';
    if (gate) { this.toast(gate, 'error'); return; }
    this.confirmAction({
      title: 'Confirm pickup handover?',
      message: 'Confirm only when the order has been physically handed over at the shop. The customer will be asked to confirm receipt; the order becomes Picked Up only after they do.',
      details: o ? [['Order', o.orderNumber], ['Customer', `${o.firstName} ${o.lastName}`], ['Payment', `${o.paymentMethod} — ${o.paymentStatus}`]] : undefined,
      confirmLabel: 'Confirm Pickup'
    }, () => this.apiRequest(`/api/admin/orders/${encodeURIComponent(orderNum)}/confirm-pickup`, 'POST'), async () => {
      this.toast(`Handover of ${orderNum} confirmed. Waiting for the customer to confirm receipt.`, 'success');
      await this.loadOrders();
      if (typeof this.loadStats === 'function') this.loadStats();
      this.openOrderDetail(orderNum);
    });
  };

  // Both confirmation records (and any issue) in the order details.
  P.pickupConfirmationHTML = function (o) {
    if (o && o.fulfillment !== 'pickup') return this.deliveryConfirmationHTML(o);
    if (!o || !o.pickupHandoverAt) return '';
    const custLine = customerLine(o, 'Picked Up', 'Pickup Disputed');
    return `
      <div class="p-4 rounded-2xl bg-[#FFF9F5] border border-[#E5ECE6] space-y-2.5">
        <div class="flex items-center gap-2 border-b border-[#E5ECE6] pb-2.5">
          <span class="w-2.5 h-2.5 rounded-full bg-[#647D69]"></span>
          <span class="font-bold text-[#302C2A] text-xs">Store Pickup Confirmation (shop + customer)</span>
        </div>
        <dl class="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1 text-xs">
          <dt class="text-[#6E6864]">Shop handover</dt><dd><span class="font-semibold">${esc(o.pickupHandoverBy || 'admin')}</span> · ${esc(when(o.pickupHandoverAt))}</dd>
          <dt class="text-[#6E6864]">Customer receipt</dt><dd>${custLine}</dd>
        </dl>
        ${historyHTML(o, o.status === 'Pickup Disputed')}
      </div>`;
  };

  // Dispute outcomes differ for pickups: hand over again (both confirm again) or cancel — never "Picked Up".
  const origOpenResolve = P.openResolveDisputeModal;
  P.openResolveDisputeModal = function (orderNum) {
    const r = origOpenResolve.apply(this, arguments);
    const o = (this.orders || []).find(x => x.orderNumber === orderNum);
    const sel = document.getElementById('resolve-dispute-status');
    if (sel) {
      if (!sel.dataset.deliveryOptions) sel.dataset.deliveryOptions = sel.innerHTML;
      sel.innerHTML = o && o.fulfillment === 'pickup'
        ? '<option value="Ready for Pickup">Ready for Pickup (hand over again — shop and customer confirm again)</option><option value="Rejected/Cancelled">Rejected/Cancelled (Refund / Recredited)</option>'
        : sel.dataset.deliveryOptions;
    }
    return r;
  };

  // Notification badges for the pickup confirmation alerts.
  const origGetNotifications = P.getNotifications;
  P.getNotifications = function () {
    const list = origGetNotifications.apply(this, arguments);
    const byId = new Map((this.dbNotifications || []).map(n => [n.id, n]));
    for (const item of list) {
      const n = item.dbId != null ? byId.get(item.dbId) : null;
      if (!n) continue;
      if (n.type === 'pickup_disputed') { item.badge = 'Pickup Issue'; item.badgeClass = 'bg-rose-100 text-rose-800 border-rose-300 font-bold'; item.type = 'dispute'; }
      else if (n.type === 'pickup_confirmed') { item.badge = 'Picked Up'; item.badgeClass = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold'; }
      else if (n.type === 'pickup_auto_confirmed' || n.type === 'delivery_auto_confirmed') { item.badge = 'Auto-Confirmed'; item.badgeClass = 'bg-emerald-50 text-emerald-800 border-emerald-200 font-bold'; }
    }
    return list;
  };
})();
