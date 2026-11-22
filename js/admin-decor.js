/* Admin → Decorations
   Place decorative images (flowers, butterflies, flourishes…) on the customer storefront, separately for
   guests and for signed-in customers, page by page. Nothing appears on the storefront until it is added here.

   - Live preview: the real storefront page in a frame (desktop / tablet / phone), where decorations can be
     dragged to move, resized from the corner handle and rotated from the top handle (js/decor.js).
   - Library: the images in image/backgound/ plus images uploaded here (existing /api/admin/upload).
   - Saved with the shop settings as store.decor through the existing PUT /api/admin/settings, so it needs no
     new server code or database table and works the same locally and on Vercel.
   Decorations never take clicks on the storefront. */
(function () {
  'use strict';
  if (typeof AdminApp === 'undefined') return;

  var PAGES = {
    guest: [['home', 'Home'], ['collections', 'Collections'], ['builder', 'Build a Bouquet'], ['about', 'About Us'], ['care', 'Florist Guide'], ['auth', 'Sign in / Create account'], ['privacy', 'Privacy Policy'], ['terms', 'Terms of Service']],
    customer: [['home', 'Home'], ['collections', 'Collections'], ['builder', 'Build a Bouquet'], ['about', 'About Us'], ['care', 'Florist Guide'], ['cart', 'Cart'], ['checkout', 'Checkout'], ['confirmation', 'Order confirmation'], ['tracking', 'Order tracking'], ['account', 'My account'], ['privacy', 'Privacy Policy'], ['terms', 'Terms of Service']]
  };
  var DEVICES = { desktop: { w: 1440, h: 900, label: 'Desktop' }, tablet: { w: 834, h: 1112, label: 'Tablet' }, phone: { w: 390, h: 844, label: 'Phone' } };
  var MAX_ITEMS = 80, MAX_LIBRARY = 60;

  var S = {
    app: null, loading: false, loaded: false,
    decor: { v: 1, items: [], library: [] }, savedJson: '',
    repo: [], side: 'guest', page: 'home', device: 'desktop', selected: null,
    frameReady: false, saving: false, picking: false
  };

  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var $ = function (id) { return document.getElementById(id); };
  var clamp = function (n, lo, hi, d) { n = Number(n); if (!isFinite(n)) n = d; return Math.min(hi, Math.max(lo, n)); };
  var safeSrc = function (src) { src = String(src || ''); return /^(\/image\/|\/assets\/|https:\/\/res\.cloudinary\.com\/)/.test(src) && !/["'<>\\]/.test(src) ? src : ''; };
  var uid = function () { return 'dc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };
  var nameFromSrc = function (src) {
    var f = decodeURIComponent(String(src).split('/').pop() || '').replace(/\.[a-z0-9]+$/i, '');
    return f.replace(/[-_()]+/g, ' ').replace(/\s+/g, ' ').trim() || 'Decoration';
  };
  var pageLabel = function (side, page) { var p = (PAGES[side] || []).filter(function (x) { return x[0] === page; })[0]; return p ? p[1] : page; };

  function normalise(it) {
    var show = it.show || {};
    return {
      id: String(it.id || uid()).slice(0, 40),
      side: it.side === 'customer' ? 'customer' : 'guest',
      page: String(it.page || 'home').slice(0, 30),
      src: safeSrc(it.src),
      name: String(it.name || nameFromSrc(it.src)).slice(0, 80),
      x: Math.round(clamp(it.x, -20, 120, 50) * 100) / 100,
      y: Math.round(clamp(it.y, -5, 105, 10) * 100) / 100,
      w: Math.round(clamp(it.w, 2, 90, 18) * 10) / 10,
      r: Math.round(clamp(it.r, -180, 180, 0)),
      o: Math.round(clamp(it.o, 0.1, 1, 0.9) * 100) / 100,
      layer: it.layer === 'front' ? 'front' : 'back',
      flip: it.flip === true,
      motion: it.motion === 'float' || it.motion === 'sway' ? it.motion : 'none',
      show: { desktop: show.desktop !== false, tablet: show.tablet !== false, phone: show.phone !== false }
    };
  }
  function cleanDecor(d) {
    d = d && typeof d === 'object' ? d : {};
    return {
      v: 1,
      items: (Array.isArray(d.items) ? d.items : []).map(normalise).filter(function (x) { return x.src; }).slice(0, MAX_ITEMS),
      library: (Array.isArray(d.library) ? d.library : []).map(function (l) { return { url: safeSrc(l && l.url), name: String((l && l.name) || '').slice(0, 80) }; })
        .filter(function (l) { return l.url; }).slice(0, MAX_LIBRARY)
    };
  }
  var snapshot = function () { return JSON.stringify(cleanDecor(S.decor)); };
  var isDirty = function () { return S.loaded && snapshot() !== S.savedJson; };
  var pageItems = function () { return S.decor.items.filter(function (it) { return it.side === S.side && it.page === S.page; }); };
  var selectedItem = function () { return S.decor.items.filter(function (it) { return it.id === S.selected; })[0] || null; };

  /* ------------------------------------------------------------------ frame */
  function frame() { return $('decor-frame'); }
  function sendState() {
    var f = frame();
    if (!f || !S.frameReady || !f.contentWindow) return;
    f.contentWindow.postMessage({ t: 'decor:state', side: S.side, page: S.page, items: S.decor.items, selected: S.selected }, location.origin);
  }
  var stateQueued = false;
  function queueState() { if (stateQueued) return; stateQueued = true; requestAnimationFrame(function () { stateQueued = false; sendState(); }); }
  function fitFrame() {
    var stage = $('decor-stage'), f = frame();
    if (!stage || !f) return;
    var dev = DEVICES[S.device];
    var avail = stage.parentElement.clientWidth - 2;
    var maxH = Math.max(420, Math.min(window.innerHeight - 230, 860));
    var scale = Math.min(1, avail / dev.w, maxH / dev.h);
    f.style.width = dev.w + 'px';
    f.style.height = dev.h + 'px';
    f.style.transform = 'scale(' + scale + ')';
    stage.style.width = Math.round(dev.w * scale) + 'px';
    stage.style.height = Math.round(dev.h * scale) + 'px';
    var lab = $('decor-device-size'); if (lab) lab.textContent = dev.label + ' · ' + dev.w + ' px wide' + (scale < 1 ? ' · shown at ' + Math.round(scale * 100) + '%' : '');
  }

  // The server sends X-Frame-Options: DENY, so the storefront page cannot be framed by URL. Instead its HTML is
  // fetched and opened as a same-origin blob document (with a <base> so every script, style and API call still goes
  // to this site). js/decor.js sees window.__ptDecorEditor and becomes the editing surface. Server headers unchanged.
  async function loadFrame() {
    var f = frame();
    if (!f) return;
    S.frameReady = false;
    try {
      var res = await fetch('/index.html', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var html = await res.text();
      var inject = '<base href="' + location.origin + '/"><script>window.__ptDecorEditor = true;<\/script>';
      html = /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, function (m) { return m + inject; }) : inject + html;
      var url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
      f.addEventListener('load', function () { setTimeout(function () { URL.revokeObjectURL(url); }, 4000); }, { once: true });
      f.src = url + '#' + (S.page || 'home');
    } catch (e) {
      var st = $('decor-stage');
      if (st) st.insertAdjacentHTML('beforeend', '<p class="absolute inset-0 flex items-center justify-center text-xs text-rose-600 p-6 text-center">The preview could not be loaded. Check your connection and open this tab again.</p>');
    }
  }

  window.addEventListener('message', function (e) {
    var f = frame();
    if (!f || e.origin !== location.origin || e.source !== f.contentWindow) return;
    var d = e.data || {};
    if (d.t === 'decor:ready') { S.frameReady = true; sendState(); return; }
    if (d.t === 'decor:select') { S.selected = d.id || null; S.picking = false; renderList(); renderProps(); return; }
    if (d.t === 'decor:live' || d.t === 'decor:change') {
      var it = S.decor.items.filter(function (x) { return x.id === d.id; })[0];
      if (!it) return;
      it.x = clamp(d.x, -20, 120, it.x); it.y = clamp(d.y, -5, 105, it.y); it.w = clamp(d.w, 2, 90, it.w); it.r = clamp(d.r, -180, 180, it.r);
      syncPropInputs(); renderStatus();
      if (d.t === 'decor:change') renderList();
      return;
    }
    if (d.t === 'decor:added') {
      if (S.decor.items.length >= MAX_ITEMS) { toast('You can place up to ' + MAX_ITEMS + ' decorations in total.', 'error'); return; }
      var item = normalise(Object.assign({}, d.item, { id: uid(), side: S.side, page: S.page }));
      if (!item.src) return;
      S.decor.items.push(item);
      S.selected = item.id;
      queueState(); renderList(); renderProps(); renderStatus();
      return;
    }
    if (d.t === 'decor:remove') { removeItem(d.id); }
  });

  /* ----------------------------------------------------------------- render */
  function toast(msg, type) { if (S.app && S.app.toast) S.app.toast(msg, type || 'info'); }
  function seg(id, opts, cur) {
    return '<div id="' + id + '" class="inline-flex p-1 rounded-xl bg-[#FAF6F0] border border-[#E5ECE6]" role="group">' + opts.map(function (o) {
      var on = o[0] === cur;
      return '<button type="button" data-val="' + o[0] + '" aria-pressed="' + on + '" class="px-3 py-1.5 rounded-lg text-xs font-semibold transition ' +
        (on ? 'bg-[#647D69] text-white shadow-xs' : 'text-[#6E6864] hover:bg-[#EBF1EC] hover:text-[#302C2A]') + '">' + o[1] + '</button>';
    }).join('') + '</div>';
  }
  var card = 'bg-white/90 rounded-2xl border border-[#E5ECE6] shadow-xs';

  function renderShell() {
    var root = $('decor-app');
    if (!root) return;
    root.innerHTML =
      '<div class="space-y-4">' +
        '<div class="' + card + ' p-3 sm:p-4 flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-3">' +
          '<div class="flex flex-wrap items-center gap-2.5">' +
            '<span id="decor-side-wrap"></span>' +
            '<label class="flex items-center gap-2 text-xs font-semibold text-[#6E6864]">Page <select id="decor-page" class="py-2 pl-3 pr-8 rounded-xl border border-[#E5ECE6] bg-white text-xs font-semibold text-[#302C2A] focus:outline-none focus:ring-2 focus:ring-[#647D69]/30"></select></label>' +
            '<span id="decor-device-wrap"></span>' +
          '</div>' +
          '<div class="flex flex-wrap items-center gap-2">' +
            '<span id="decor-status" class="text-xs font-semibold mr-1"></span>' +
            '<button type="button" id="decor-discard" class="py-2 px-3.5 rounded-xl border border-[#E5ECE6] bg-white hover:bg-[#FAF6F0] text-[#302C2A] text-xs font-semibold transition disabled:opacity-40">Discard changes</button>' +
            '<button type="button" id="decor-save" class="py-2 px-4 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white text-xs font-bold shadow-xs transition disabled:opacity-40">Save decorations</button>' +
          '</div>' +
        '</div>' +
        '<div class="grid grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)] gap-4 items-start">' +
          '<div class="space-y-4 min-w-0">' +
            '<section class="' + card + ' p-4 space-y-3" aria-labelledby="decor-lib-h">' +
              '<div class="flex items-center justify-between gap-2"><h3 id="decor-lib-h" class="text-sm font-bold text-[#302C2A]">Add a decoration</h3>' +
                '<label class="cursor-pointer py-1.5 px-3 rounded-xl bg-[#EBF1EC] hover:bg-[#DFE9E1] text-[#344F3B] text-xs font-bold transition">Upload image<input type="file" id="decor-upload" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden"></label></div>' +
              '<p class="text-[11px] text-[#6E6864] leading-relaxed">Click an image to place it on the page shown. PNG images with a transparent background look best (up to 5 MB).</p>' +
              '<div id="decor-library" class="grid grid-cols-4 gap-2 max-h-[260px] overflow-y-auto pr-1"></div>' +
            '</section>' +
            '<section class="' + card + ' p-4 space-y-2.5" aria-labelledby="decor-list-h">' +
              '<h3 id="decor-list-h" class="text-sm font-bold text-[#302C2A]">On this page</h3>' +
              '<div id="decor-list" class="space-y-1.5"></div>' +
            '</section>' +
            '<section id="decor-props" class="' + card + ' p-4 space-y-3" aria-labelledby="decor-props-h"></section>' +
          '</div>' +
          '<div class="' + card + ' p-3 sm:p-4 min-w-0">' +
            '<div class="flex flex-wrap items-center justify-between gap-2 mb-3">' +
              '<p class="text-xs font-semibold text-[#302C2A]">Live preview <span id="decor-device-size" class="font-normal text-[#6E6864]"></span></p>' +
              '<p class="text-[11px] text-[#6E6864]">Drag to move &middot; corner handle to resize &middot; top handle to rotate (Shift snaps) &middot; arrow keys nudge &middot; Delete removes</p>' +
            '</div>' +
            '<div class="w-full overflow-hidden flex justify-center"><div id="decor-stage" class="relative overflow-hidden rounded-xl border border-[#E5ECE6] bg-[#f6f4ea] shrink-0">' +
              '<iframe id="decor-frame" title="Storefront preview for decorations" class="absolute left-0 top-0 origin-top-left border-0 bg-white"></iframe>' +
            '</div></div>' +
            '<p class="text-[11px] text-[#6E6864] mt-3 leading-relaxed">Decorations are placed relative to the page and scale with screen width. Use <b>Show on</b> to hide one on phones or tablets if it covers content there. They never block clicks or taps.</p>' +
          '</div>' +
        '</div>' +
      '</div>';

    root.addEventListener('click', onClick);
    root.addEventListener('input', onInput);
    root.addEventListener('change', onChange);
    $('decor-upload').addEventListener('change', onUpload);
    renderToolbar(); renderLibrary(); renderList(); renderProps(); renderStatus();
    fitFrame();
    loadFrame();
    if (window.ResizeObserver) new ResizeObserver(function () { fitFrame(); }).observe($('decor-stage').parentElement);
    window.addEventListener('resize', fitFrame);
  }

  function renderToolbar() {
    $('decor-side-wrap').innerHTML = seg('decor-side', [['guest', 'Guest side'], ['customer', 'Customer side']], S.side);
    $('decor-device-wrap').innerHTML = seg('decor-device', [['desktop', 'Desktop'], ['tablet', 'Tablet'], ['phone', 'Phone']], S.device);
    var sel = $('decor-page');
    sel.innerHTML = PAGES[S.side].map(function (p) {
      var n = S.decor.items.filter(function (it) { return it.side === S.side && it.page === p[0]; }).length;
      return '<option value="' + p[0] + '"' + (p[0] === S.page ? ' selected' : '') + '>' + p[1] + (n ? ' (' + n + ')' : '') + '</option>';
    }).join('');
  }

  function renderLibrary() {
    var box = $('decor-library'); if (!box) return;
    var used = {};
    var lib = S.decor.library.map(function (l) { used[l.url] = 1; return { url: l.url, name: l.name || nameFromSrc(l.url), mine: true }; })
      .concat(S.repo.filter(function (r) { return !used[r.url]; }).map(function (r) { return { url: r.url, name: nameFromSrc(r.name || r.url), mine: false }; }));
    if (!lib.length) { box.innerHTML = '<p class="col-span-4 text-[11px] text-[#6E6864] py-3 text-center">No images yet. Upload one to start.</p>'; return; }
    box.innerHTML = lib.map(function (l) {
      return '<div class="relative group">' +
        '<button type="button" data-act="' + (S.picking ? 'replace' : 'add') + '" data-src="' + esc(l.url) + '" data-name="' + esc(l.name) + '" title="' + esc((S.picking ? 'Use ' : 'Place ') + l.name) + '" class="w-full aspect-square rounded-xl border ' + (S.picking ? 'border-[#647D69]' : 'border-[#E5ECE6]') + ' bg-[#FAF6F0] hover:border-[#647D69] hover:bg-white p-1.5 flex items-center justify-center transition">' +
          '<img src="' + esc(l.url) + '" alt="" loading="lazy" class="max-w-full max-h-full object-contain pointer-events-none"></button>' +
        (l.mine ? '<button type="button" data-act="unlib" data-src="' + esc(l.url) + '" title="Remove from library" aria-label="Remove ' + esc(l.name) + ' from library" class="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-[#E5ECE6] text-[#6E6864] hover:text-rose-600 text-[11px] leading-none hidden group-hover:flex items-center justify-center shadow-xs">&times;</button>' : '') +
      '</div>';
    }).join('');
  }

  function renderList() {
    var box = $('decor-list'); if (!box) return;
    var list = pageItems();
    var h = $('decor-list-h'); if (h) h.textContent = 'On this page (' + list.length + ')';
    if (!list.length) {
      box.innerHTML = '<p class="text-[11px] text-[#6E6864] leading-relaxed">Nothing on <b>' + esc(pageLabel(S.side, S.page)) + '</b> for the ' + (S.side === 'guest' ? 'guest' : 'customer') + ' side yet. This page stays clean until you add something.</p>';
    } else {
      box.innerHTML = list.map(function (it) {
        var on = it.id === S.selected;
        var where = [it.show.desktop && 'Desktop', it.show.tablet && 'Tablet', it.show.phone && 'Phone'].filter(Boolean).join(', ') || 'Hidden everywhere';
        return '<div class="flex items-center gap-2 p-1.5 rounded-xl border ' + (on ? 'border-[#647D69] bg-[#EBF1EC]' : 'border-transparent hover:bg-[#FAF6F0]') + '">' +
          '<button type="button" data-act="select" data-id="' + it.id + '" class="flex-1 min-w-0 flex items-center gap-2 text-left">' +
            '<span class="w-10 h-10 rounded-lg bg-[#FAF6F0] border border-[#E5ECE6] p-1 flex items-center justify-center shrink-0"><img src="' + esc(it.src) + '" alt="" class="max-w-full max-h-full object-contain"></span>' +
            '<span class="min-w-0"><span class="block text-xs font-semibold text-[#302C2A] truncate">' + esc(it.name) + '</span>' +
            '<span class="block text-[10.5px] text-[#6E6864] truncate">' + (it.layer === 'front' ? 'In front' : 'Behind content') + ' &middot; ' + where + '</span></span>' +
          '</button>' +
          '<button type="button" data-act="remove" data-id="' + it.id + '" title="Remove" aria-label="Remove ' + esc(it.name) + '" class="w-8 h-8 rounded-lg text-[#6E6864] hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center shrink-0">' +
            '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>' +
        '</div>';
      }).join('');
    }
    renderToolbar();
  }

  function range(id, label, val, min, max, step, unit) {
    return '<label class="block"><span class="flex justify-between text-[11px] font-semibold text-[#6E6864] mb-1"><span>' + label + '</span><span id="' + id + '-v" class="text-[#302C2A]">' + val + unit + '</span></span>' +
      '<input type="range" id="' + id + '" data-prop="' + id.replace('decor-p-', '') + '" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '" class="w-full accent-[#647D69]"></label>';
  }
  function renderProps() {
    var box = $('decor-props'); if (!box) return;
    var it = selectedItem();
    if (!it) {
      box.innerHTML = '<h3 id="decor-props-h" class="text-sm font-bold text-[#302C2A]">Selected decoration</h3><p class="text-[11px] text-[#6E6864] leading-relaxed">Select a decoration in the preview or in the list to change its size, angle, transparency, layer and where it shows.</p>';
      return;
    }
    var other = it.side === 'guest' ? 'customer' : 'guest';
    box.innerHTML =
      '<div class="flex items-center justify-between gap-2"><h3 id="decor-props-h" class="text-sm font-bold text-[#302C2A] truncate">' + esc(it.name) + '</h3>' +
        '<button type="button" data-act="pick" class="text-[11px] font-bold text-[#647D69] hover:underline shrink-0">' + (S.picking ? 'Cancel replace' : 'Replace image') + '</button></div>' +
      (S.picking ? '<p class="text-[11px] font-semibold text-[#344F3B] bg-[#EBF1EC] rounded-lg px-2.5 py-1.5">Choose the new image in “Add a decoration” above.</p>' : '') +
      range('decor-p-w', 'Size (% of page width)', it.w, 2, 90, 0.5, '%') +
      range('decor-p-r', 'Rotation', it.r, -180, 180, 1, '°') +
      range('decor-p-o', 'Opacity', Math.round(it.o * 100), 10, 100, 1, '%') +
      '<div class="grid grid-cols-2 gap-2">' +
        '<label class="text-[11px] font-semibold text-[#6E6864]">Across (%)<input type="number" id="decor-p-x" data-prop="x" step="0.5" min="-20" max="120" value="' + it.x + '" class="mt-1 w-full py-1.5 px-2 rounded-lg border border-[#E5ECE6] text-xs text-[#302C2A]"></label>' +
        '<label class="text-[11px] font-semibold text-[#6E6864]">Down the page (%)<input type="number" id="decor-p-y" data-prop="y" step="0.25" min="-5" max="105" value="' + it.y + '" class="mt-1 w-full py-1.5 px-2 rounded-lg border border-[#E5ECE6] text-xs text-[#302C2A]"></label>' +
      '</div>' +
      '<fieldset><legend class="text-[11px] font-semibold text-[#6E6864] mb-1">Layer</legend><div class="grid grid-cols-2 gap-1.5">' +
        ['back', 'front'].map(function (l) {
          return '<label class="flex items-center gap-1.5 p-2 rounded-lg border ' + (it.layer === l ? 'border-[#647D69] bg-[#EBF1EC]' : 'border-[#E5ECE6]') + ' text-[11px] font-semibold text-[#302C2A] cursor-pointer"><input type="radio" name="decor-layer" data-prop="layer" value="' + l + '"' + (it.layer === l ? ' checked' : '') + ' class="accent-[#647D69]">' + (l === 'back' ? 'Behind content' : 'In front of content') + '</label>';
        }).join('') +
      '</div></fieldset>' +
      '<div class="grid grid-cols-2 gap-2">' +
        '<label class="text-[11px] font-semibold text-[#6E6864]">Movement<select data-prop="motion" class="mt-1 w-full py-1.5 px-2 rounded-lg border border-[#E5ECE6] bg-white text-xs text-[#302C2A]">' +
          [['none', 'Still'], ['float', 'Gentle float'], ['sway', 'Gentle sway']].map(function (m) { return '<option value="' + m[0] + '"' + (it.motion === m[0] ? ' selected' : '') + '>' + m[1] + '</option>'; }).join('') + '</select></label>' +
        '<label class="flex items-end gap-1.5 pb-1.5 text-[11px] font-semibold text-[#302C2A] cursor-pointer"><input type="checkbox" data-prop="flip"' + (it.flip ? ' checked' : '') + ' class="accent-[#647D69]">Flip horizontally</label>' +
      '</div>' +
      '<fieldset><legend class="text-[11px] font-semibold text-[#6E6864] mb-1">Show on</legend><div class="flex flex-wrap gap-3">' +
        ['desktop', 'tablet', 'phone'].map(function (dv) {
          return '<label class="flex items-center gap-1.5 text-[11px] font-semibold text-[#302C2A] cursor-pointer"><input type="checkbox" data-prop="show-' + dv + '"' + (it.show[dv] ? ' checked' : '') + ' class="accent-[#647D69]">' + DEVICES[dv].label + '</label>';
        }).join('') +
      '</div></fieldset>' +
      '<div class="flex flex-wrap gap-1.5 pt-1 border-t border-[#E5ECE6]">' +
        btn('front', 'Bring to front') + btn('backmost', 'Send to back') + btn('dup', 'Duplicate') + btn('copy', 'Copy to ' + (other === 'guest' ? 'guest' : 'customer') + ' side') +
        '<button type="button" data-act="remove" data-id="' + it.id + '" class="py-1.5 px-2.5 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px] font-semibold">Remove</button>' +
      '</div>';
  }
  function btn(act, label) { return '<button type="button" data-act="' + act + '" class="py-1.5 px-2.5 rounded-lg border border-[#E5ECE6] hover:bg-[#FAF6F0] text-[#302C2A] text-[11px] font-semibold">' + label + '</button>'; }

  function syncPropInputs() {
    var it = selectedItem(); if (!it) return;
    var set = function (id, v, label) { var el = $(id); if (el && document.activeElement !== el) el.value = v; var l = $(id + '-v'); if (l && label !== undefined) l.textContent = label; };
    set('decor-p-w', it.w, it.w + '%'); set('decor-p-r', it.r, it.r + '°'); set('decor-p-x', it.x); set('decor-p-y', it.y);
  }

  function renderStatus() {
    var st = $('decor-status'), save = $('decor-save'), dis = $('decor-discard');
    if (!st) return;
    var dirty = isDirty();
    st.textContent = S.saving ? 'Saving…' : dirty ? 'Unsaved changes' : 'All changes saved';
    st.className = 'text-xs font-semibold mr-1 ' + (dirty ? 'text-amber-700' : 'text-[#647D69]');
    if (save) save.disabled = !dirty || S.saving;
    if (dis) dis.disabled = !dirty || S.saving;
  }

  /* ----------------------------------------------------------------- events */
  function removeItem(id) {
    S.decor.items = S.decor.items.filter(function (x) { return x.id !== id; });
    if (S.selected === id) S.selected = null;
    queueState(); renderList(); renderProps(); renderStatus();
  }
  function onClick(e) {
    var b = e.target.closest('button'); if (!b) return;
    var segBox = b.parentElement && b.parentElement.id;
    if (segBox === 'decor-side' && b.dataset.val !== S.side) {
      S.side = b.dataset.val; S.selected = null; S.picking = false;
      if (!PAGES[S.side].some(function (p) { return p[0] === S.page; })) S.page = 'home';
      queueState(); renderList(); renderProps(); return;
    }
    if (segBox === 'decor-device' && b.dataset.val !== S.device) { S.device = b.dataset.val; renderToolbar(); fitFrame(); return; }
    var act = b.dataset.act, it = selectedItem();
    if (b.id === 'decor-save') return save();
    if (b.id === 'decor-discard') return discard();
    if (act === 'add') {
      var f = frame();
      if (!S.frameReady || !f) { toast('The preview is still loading.', 'info'); return; }
      f.contentWindow.postMessage({ t: 'decor:add', src: b.dataset.src, name: b.dataset.name }, location.origin);
      return;
    }
    if (act === 'replace' && it) { it.src = safeSrc(b.dataset.src) || it.src; it.name = b.dataset.name || it.name; S.picking = false; queueState(); renderLibrary(); renderList(); renderProps(); renderStatus(); return; }
    if (act === 'unlib') { S.decor.library = S.decor.library.filter(function (l) { return l.url !== b.dataset.src; }); renderLibrary(); renderStatus(); return; }
    if (act === 'select') {
      S.selected = b.dataset.id; S.picking = false; queueState(); renderList(); renderProps();
      var fr = frame(); if (fr && S.frameReady) fr.contentWindow.postMessage({ t: 'decor:focus', id: S.selected }, location.origin);
      return;
    }
    if (act === 'remove') { removeItem(b.dataset.id); return; }
    if (!it) return;
    if (act === 'pick') { S.picking = !S.picking; renderLibrary(); renderProps(); return; }
    if (act === 'front' || act === 'backmost') {
      S.decor.items = S.decor.items.filter(function (x) { return x !== it; });
      if (act === 'front') S.decor.items.push(it); else S.decor.items.unshift(it);
    } else if (act === 'dup' || act === 'copy') {
      if (S.decor.items.length >= MAX_ITEMS) { toast('You can place up to ' + MAX_ITEMS + ' decorations in total.', 'error'); return; }
      var c = normalise(Object.assign({}, it, { id: uid() }));
      if (act === 'dup') { c.x = Math.min(115, c.x + 3); c.y = Math.min(100, c.y + 1); S.decor.items.push(c); S.selected = c.id; }
      else {
        c.side = it.side === 'guest' ? 'customer' : 'guest';
        if (!PAGES[c.side].some(function (p) { return p[0] === c.page; })) { toast(pageLabel(it.side, it.page) + ' is not a ' + c.side + ' page.', 'error'); return; }
        S.decor.items.push(c);
        toast('Copied to the ' + c.side + ' side of ' + pageLabel(c.side, c.page) + '.', 'success');
      }
    }
    queueState(); renderList(); renderProps(); renderStatus();
  }
  function applyProp(el) {
    var it = selectedItem(); if (!it || !el.dataset.prop) return false;
    var p = el.dataset.prop;
    if (p === 'w') it.w = clamp(el.value, 2, 90, it.w);
    else if (p === 'r') it.r = clamp(el.value, -180, 180, it.r);
    else if (p === 'o') it.o = clamp(el.value / 100, 0.1, 1, it.o);
    else if (p === 'x') it.x = clamp(el.value, -20, 120, it.x);
    else if (p === 'y') it.y = clamp(el.value, -5, 105, it.y);
    else if (p === 'layer') it.layer = el.value === 'front' ? 'front' : 'back';
    else if (p === 'motion') it.motion = el.value;
    else if (p === 'flip') it.flip = el.checked;
    else if (p.indexOf('show-') === 0) it.show[p.slice(5)] = el.checked;
    else return false;
    var lab = $(el.id + '-v');
    if (lab) lab.textContent = p === 'o' ? Math.round(it.o * 100) + '%' : p === 'r' ? it.r + '°' : it.w + '%';
    queueState(); renderStatus();
    return true;
  }
  function onInput(e) { if (e.target.type === 'range' || e.target.type === 'number') applyProp(e.target); }
  function onChange(e) {
    if (e.target.id === 'decor-page') { S.page = e.target.value; S.selected = null; S.picking = false; queueState(); renderList(); renderProps(); return; }
    if (applyProp(e.target) && (e.target.type === 'radio' || e.target.type === 'checkbox' || e.target.tagName === 'SELECT')) { renderList(); renderProps(); }
  }

  function onUpload(e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type)) { toast('Upload a PNG, JPG, WebP or GIF image.', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('Image must be smaller than 5 MB.', 'error'); return; }
    if (S.decor.library.length >= MAX_LIBRARY) { toast('Your library is full (' + MAX_LIBRARY + ' images). Remove one first.', 'error'); return; }
    var reader = new FileReader();
    reader.onload = async function () {
      toast('Uploading ' + file.name + '…', 'info');
      var r = await S.app.apiRequest('/api/admin/upload', 'POST', { dataUrl: reader.result, folder: 'decor' });
      var url = r.ok && r.data && safeSrc(r.data.url);
      if (!url) { toast((r.data && r.data.error) || r.error || 'Upload failed. Please try again.', 'error'); return; }
      S.decor.library.unshift({ url: url, name: file.name.replace(/\.[a-z0-9]+$/i, '').slice(0, 80) });
      renderLibrary(); renderStatus();
      toast('Uploaded. Click it to place it on this page, then save.', 'success');
    };
    reader.readAsDataURL(file);
  }

  async function save() {
    if (S.saving) return;
    S.saving = true; renderStatus();
    var decor = cleanDecor(S.decor);
    decor.updatedAt = new Date().toISOString();
    var r = await S.app.apiRequest('/api/admin/settings', 'PUT', { store: { decor: decor } });
    S.saving = false;
    if (r.ok) {
      var savedDecor = r.data && r.data.settings && r.data.settings.store && r.data.settings.store.decor;
      S.decor = cleanDecor(savedDecor || decor);
      S.savedJson = snapshot();
      toast('Decorations saved. They are live on the storefront now.', 'success');
      queueState(); renderLibrary(); renderList(); renderProps();
    } else {
      toast((r.data && r.data.error) || r.error || 'Could not save decorations.', 'error');
    }
    renderStatus();
  }

  async function discard() {
    var ok = window.UI && UI.confirm ? await UI.confirm({ title: 'Discard decoration changes?', message: 'Your unsaved changes will be lost and the last saved decorations restored.', confirmLabel: 'Discard changes', destructive: true }) : true;
    if (!ok) return;
    await load(true);
  }

  async function load(force) {
    if (S.loading || (S.loaded && !force)) return;
    S.loading = true;
    var results = await Promise.all([
      S.app.apiRequest('/api/admin/settings', 'GET'),
      fetch('/api/decoration-images').then(function (r) { return r.ok ? r.json() : { images: [] }; }).catch(function () { return { images: [] }; })
    ]);
    S.loading = false;
    var settings = results[0].ok && results[0].data && results[0].data.settings;
    if (!settings) { toast('Could not load the saved decorations.', 'error'); return; }
    S.decor = cleanDecor(settings.store && settings.store.decor);
    S.savedJson = snapshot();
    S.repo = (results[1].images || []).map(function (i) { return { url: safeSrc(i.url), name: i.name }; }).filter(function (i) { return i.url; });
    S.loaded = true; S.selected = null; S.picking = false;
    if (!$('decor-frame')) renderShell();
    else { queueState(); renderLibrary(); renderList(); renderProps(); renderStatus(); }
  }

  // Admin tab hook (switchTab('decorations') already calls loadDecorationLibrary).
  AdminApp.prototype.loadDecorationLibrary = function () {
    S.app = this;
    if (!S.loaded) load(false); else { fitFrame(); renderStatus(); }
  };

  window.addEventListener('beforeunload', function (e) {
    if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
  });
})();
