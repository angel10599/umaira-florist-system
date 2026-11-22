/* Umaira Florist — shop-managed decorations (customer storefront).
   Nothing decorative is placed automatically. This file paints only the decorations the shop adds in
   Admin → Decorations, saved with the shop settings (store.decor). Guests and signed-in customers have
   separate sets, chosen per page. Decorations never take clicks or taps.

   Saved shape (store.decor):
     { v: 1, items: [Item], library: [{ url, name }], updatedAt }
     Item = { id, side: 'guest'|'customer', page, src, name,
              x, y   centre, % of the page area (width / height),
              w      width, % of the page width,
              r      rotation in degrees, o opacity 0.1–1,
              layer  'back' (behind content) | 'front' (over content, still click-through),
              flip, motion: 'none'|'float'|'sway', show: { desktop, tablet, phone } }

   When this page is framed by Admin → Decorations (?decor-editor=1, same origin only), it also acts as the
   live editing surface: the admin page sends the draft, and dragging, resizing and rotating here report back. */
(function () {
  'use strict';
  var state = window.appState;
  var router = window.appRouter;
  if (!state || !router || window.ptDecor) return;

  var RESTRICTED = ['cart', 'checkout', 'tracking', 'confirmation', 'account', 'notifications'];
  var editor = null;

  function clamp(n, lo, hi, d) { n = Number(n); if (!isFinite(n)) n = d; return Math.min(hi, Math.max(lo, n)); }
  function safeSrc(src) {
    src = String(src || '');
    if (/["'<>\\\s]/.test(src.replace(/%20/g, ''))) return '';
    return /^(\/image\/|\/assets\/|https:\/\/res\.cloudinary\.com\/)/.test(src) ? src : '';
  }
  function normPage(v) {
    v = String(v || 'home');
    if (v === 'flowers' || v === 'occasions') return 'collections';
    if (v === 'care-guide' || v === 'guide' || v === 'florist-guide') return 'care';
    if (v === 'signin' || v === 'signup') return 'auth';
    return v;
  }
  function currentSide() {
    if (editor) return editor.side;
    return document.body.classList.contains('pt-member') ? 'customer' : 'guest';
  }
  function currentPage() { return editor ? editor.page : normPage(router.currentView); }
  function allItems() {
    if (editor) return editor.items || [];
    var d = state.storeSettings && state.storeSettings.decor;
    return d && Array.isArray(d.items) ? d.items : [];
  }
  function pageArea() {
    var main = document.getElementById('main-content');
    if (!main) return null;
    return main.querySelector('.homepage-canvas, .customer-page-canvas') || main;
  }

  function buildItem(it) {
    var src = safeSrc(it.src);
    if (!src) return null;
    var show = it.show || {};
    var wrap = document.createElement('div');
    wrap.className = 'pt-deco-item' +
      (show.desktop === false ? ' no-desktop' : '') + (show.tablet === false ? ' no-tablet' : '') + (show.phone === false ? ' no-phone' : '') +
      (it.motion === 'float' ? ' is-float' : it.motion === 'sway' ? ' is-sway' : '');
    wrap.setAttribute('data-id', String(it.id || ''));
    wrap.style.left = clamp(it.x, -20, 120, 50) + '%';
    wrap.style.top = clamp(it.y, -5, 105, 10) + '%';
    wrap.style.width = clamp(it.w, 2, 90, 18) + '%';
    wrap.style.transform = 'translate(-50%, -50%) rotate(' + clamp(it.r, -360, 360, 0) + 'deg)';
    var img = document.createElement('img');
    img.src = src;
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    img.style.opacity = String(clamp(it.o, 0.05, 1, 0.9));
    if (it.flip) img.style.transform = 'scaleX(-1)';
    wrap.appendChild(img);
    return wrap;
  }

  function paint() {
    var area = pageArea();
    if (!area) return;
    Array.prototype.forEach.call(area.querySelectorAll(':scope > .pt-deco'), function (n) { n.remove(); });
    var side = currentSide(), page = currentPage();
    var list = allItems().filter(function (it) { return it && it.side === side && it.page === page; });
    if (!list.length) return;
    var back = document.createElement('div'); back.className = 'pt-deco pt-deco-back'; back.setAttribute('aria-hidden', 'true');
    var front = document.createElement('div'); front.className = 'pt-deco pt-deco-front'; front.setAttribute('aria-hidden', 'true');
    list.forEach(function (it) {
      var el = buildItem(it);
      if (el) (it.layer === 'front' ? front : back).appendChild(el);
    });
    area.insertBefore(back, area.firstChild);
    area.appendChild(front);
    if (editor) markSelection();
  }

  // Repaint after every page render, sign-in/out and settings change (decorations update live after a save).
  var origRender = router.renderView;
  router.renderView = function () {
    var out = origRender.apply(this, arguments);
    try { paint(); } catch (e) { /* decorations are optional */ }
    return out;
  };
  if (state.on) {
    state.on('settings_change', function () { try { paint(); } catch (e) {} });
    state.on('auth_change', function () { requestAnimationFrame(function () { try { paint(); } catch (e) {} }); });
  }

  // Some views are redrawn without renderView (e.g. Home and Collections refresh in place when the catalog
  // updates), so also repaint whenever the page content is replaced. Our own layers are ignored here.
  var mainEl = document.getElementById('main-content');
  var queued = false;
  var schedule = function () { if (queued) return; queued = true; requestAnimationFrame(function () { queued = false; try { paint(); } catch (e) {} }); };
  if (mainEl && 'MutationObserver' in window) {
    new MutationObserver(function (recs) {
      var relevant = recs.some(function (r) {
        return Array.prototype.some.call(r.addedNodes, function (n) { return n.nodeType === 1 && !n.classList.contains('pt-deco'); }) ||
               Array.prototype.some.call(r.removedNodes, function (n) { return n.nodeType === 1 && !n.classList.contains('pt-deco'); });
      });
      if (relevant) schedule();
    }).observe(mainEl, { childList: true });
  }

  window.ptDecor = { paint: paint };
  // The first page may already have been drawn while this file was loading: paint it now as well.
  try { paint(); } catch (e) {}

  /* ======================================================================= editor bridge */
  function framedByAdmin() {
    // Admin → Decorations opens this page as a same-origin document flagged with window.__ptDecorEditor.
    if (window.__ptDecorEditor !== true && !/[?&]decor-editor=1(&|$)/.test(location.search)) return false;
    try { return window.parent !== window && window.parent.location.origin === location.origin; } catch (e) { return false; }
  }
  if (!framedByAdmin()) return;

  editor = { side: 'guest', page: 'home', items: [], selected: null };
  document.documentElement.classList.add('pt-editor');
  var post = function (msg) { try { window.parent.postMessage(msg, location.origin); } catch (e) {} };

  function itemById(id) { return (editor.items || []).filter(function (x) { return x && x.id === id; })[0] || null; }
  function markSelection() {
    Array.prototype.forEach.call(document.querySelectorAll('.pt-deco-item'), function (el) {
      var on = el.getAttribute('data-id') === editor.selected;
      el.classList.toggle('is-selected', on);
      if (on && !el.querySelector('.pt-deco-h')) {
        el.insertAdjacentHTML('beforeend', '<span class="pt-deco-h is-size" data-h="size" title="Drag to resize"></span><span class="pt-deco-h is-rot" data-h="rot" title="Drag to rotate"></span>');
      }
      if (!on) Array.prototype.forEach.call(el.querySelectorAll('.pt-deco-h'), function (h) { h.remove(); });
    });
  }

  // Members-only pages cannot be opened without a customer session, so the editor shows a neutral page frame
  // (no customer data) to place decorations on. Real customers see them on the real page.
  var PAGE_TITLES = { cart: 'Your cart', checkout: 'Checkout', tracking: 'Track your order', confirmation: 'Order confirmation', account: 'My account', notifications: 'Notifications' };
  function showPlaceholder(page) {
    var main = document.getElementById('main-content');
    if (!main) return;
    document.body.setAttribute('data-view', page);
    var rows = '';
    for (var i = 0; i < 4; i++) rows += '<div class="pt-skel pt-editor-row"></div>';
    main.innerHTML = '<div class="customer-page-canvas relative overflow-x-hidden w-full min-h-screen" data-page-view="' + page + '">' +
      '<div class="customer-page-content relative z-10 w-full"><div class="pt-editor-ph">' +
        '<span class="pt-kick">Members-only page</span><h1 class="pt-editor-ph-title">' + (PAGE_TITLES[page] || page) + '</h1>' +
        '<p class="pt-editor-ph-note">Preview frame. Signed-in customers see the real page with your decorations in the same places.</p>' +
        '<div class="pt-editor-ph-grid"><div>' + rows + '</div><div class="pt-skel pt-editor-side"></div></div>' +
      '</div></div></div>';
    paint();
  }

  function goPage(page) {
    var authed = Boolean(state.isAuthenticated && state.isAuthenticated());
    if (RESTRICTED.indexOf(page) >= 0 && !authed) { showPlaceholder(page); return; }
    if (normPage(router.currentView) === page && document.querySelector('#main-content .homepage-canvas, #main-content .customer-page-canvas')) { paint(); return; }
    router.navigate(page);
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin || e.source !== window.parent) return;
    var d = e.data || {};
    if (d.t === 'decor:state') {
      var sideChanged = editor.side !== d.side;
      editor.side = d.side === 'customer' ? 'customer' : 'guest';
      editor.items = Array.isArray(d.items) ? d.items : [];
      editor.selected = d.selected || null;
      window.ptLayoutOverride = editor.side;
      if (sideChanged && typeof window.ptSyncLayout === 'function') window.ptSyncLayout();
      if (d.page && d.page !== editor.page) { editor.page = d.page; goPage(d.page); }
      else paint();
    } else if (d.t === 'decor:add') {
      var area = pageArea(); if (!area) return;
      var rect = area.getBoundingClientRect();
      var y = ((window.innerHeight * 0.42) - rect.top) / Math.max(1, rect.height) * 100;
      var vw = window.innerWidth;
      post({ t: 'decor:added', item: {
        src: d.src, name: d.name || '',
        x: 50, y: Math.round(clamp(y, 1, 99, 10) * 100) / 100,
        w: vw >= 1024 ? 16 : vw >= 640 ? 26 : 40
      } });
    } else if (d.t === 'decor:focus') {
      var el = document.querySelector('.pt-deco-item[data-id="' + String(d.id).replace(/"/g, '') + '"]');
      if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  });

  // ---- direct manipulation: drag to move, corner to resize, top handle to rotate
  var drag = null;
  document.addEventListener('pointerdown', function (e) {
    var itemEl = e.target.closest && e.target.closest('.pt-deco-item');
    if (!itemEl) {
      if (editor.selected) { editor.selected = null; markSelection(); post({ t: 'decor:select', id: null }); }
      return;
    }
    e.preventDefault();
    var id = itemEl.getAttribute('data-id');
    var it = itemById(id);
    if (!it) return;
    if (editor.selected !== id) { editor.selected = id; markSelection(); post({ t: 'decor:select', id: id }); }
    var layer = itemEl.parentElement;
    var lr = layer.getBoundingClientRect();
    var ir = itemEl.getBoundingClientRect();
    var cx = ir.left + ir.width / 2, cy = ir.top + ir.height / 2;
    var h = e.target.getAttribute && e.target.getAttribute('data-h');
    drag = {
      id: id, el: itemEl, it: it, mode: h || 'move', lr: lr, cx: cx, cy: cy,
      sx: e.clientX, sy: e.clientY, x: Number(it.x), y: Number(it.y), w: Number(it.w), r: Number(it.r) || 0,
      d0: Math.max(8, Math.hypot(e.clientX - cx, e.clientY - cy))
    };
    try { itemEl.setPointerCapture(e.pointerId); } catch (err) {}
  });
  document.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var it = drag.it, el = drag.el;
    if (drag.mode === 'move') {
      it.x = Math.round(clamp(drag.x + (e.clientX - drag.sx) / drag.lr.width * 100, -20, 120, 50) * 100) / 100;
      it.y = Math.round(clamp(drag.y + (e.clientY - drag.sy) / drag.lr.height * 100, -5, 105, 10) * 100) / 100;
      el.style.left = it.x + '%'; el.style.top = it.y + '%';
    } else if (drag.mode === 'size') {
      var d = Math.hypot(e.clientX - drag.cx, e.clientY - drag.cy);
      it.w = Math.round(clamp(drag.w * d / drag.d0, 2, 90, 18) * 10) / 10;
      el.style.width = it.w + '%';
    } else if (drag.mode === 'rot') {
      var ang = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx) * 180 / Math.PI + 90;
      if (e.shiftKey) ang = Math.round(ang / 15) * 15;
      it.r = Math.round(((ang + 540) % 360) - 180);
      el.style.transform = 'translate(-50%, -50%) rotate(' + it.r + 'deg)';
    }
    post({ t: 'decor:live', id: drag.id, x: it.x, y: it.y, w: it.w, r: it.r });
  });
  function endDrag() {
    if (!drag) return;
    var it = drag.it;
    post({ t: 'decor:change', id: drag.id, x: it.x, y: it.y, w: it.w, r: it.r });
    drag = null;
  }
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);

  document.addEventListener('keydown', function (e) {
    if (!editor.selected) return;
    var it = itemById(editor.selected);
    if (!it) return;
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); post({ t: 'decor:remove', id: it.id }); return; }
    if (e.key === 'Escape') { editor.selected = null; markSelection(); post({ t: 'decor:select', id: null }); return; }
    var step = e.shiftKey ? 2 : 0.25, dx = 0, dy = 0;
    if (e.key === 'ArrowLeft') dx = -step; else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step / 4; else if (e.key === 'ArrowDown') dy = step / 4; else return;
    e.preventDefault();
    it.x = Math.round(clamp(Number(it.x) + dx, -20, 120, 50) * 100) / 100;
    it.y = Math.round(clamp(Number(it.y) + dy, -5, 105, 10) * 100) / 100;
    paint();
    post({ t: 'decor:change', id: it.id, x: it.x, y: it.y, w: it.w, r: it.r });
  });

  // Tell the admin page we are ready once the first page has been drawn.
  (function waitReady() {
    if (document.querySelector('#main-content .homepage-canvas, #main-content .customer-page-canvas')) post({ t: 'decor:ready' });
    else setTimeout(waitReady, 120);
  })();
})();
