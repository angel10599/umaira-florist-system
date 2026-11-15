/* Shared UI helpers for the storefront and the admin console:
   UI.confirm  - one accessible confirmation dialog for every sensitive action
   UI.undo     - lightweight "Undo" snackbar for reversible actions
   dropdown menus - any [data-menu-toggle="panel-id"] button controls a [role="menu"] panel */
(function () {
  if (window.UI) return;

  var style = document.createElement('style');
  style.textContent =
    '@keyframes ui-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}' +
    '@keyframes ui-dlg{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}' +
    '@keyframes ui-fade{from{opacity:0}to{opacity:1}}' +
    '.ui-pop,.ui-snack{animation:ui-pop .16s ease-out}.ui-dlg{animation:ui-dlg .18s ease-out}.ui-scrim{animation:ui-fade .18s ease-out}' +
    '@media (prefers-reduced-motion:reduce){.ui-pop,.ui-snack,.ui-dlg,.ui-scrim{animation:none}}';
  document.head.appendChild(style);

  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var FOCUSABLE = 'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[href],[tabindex]:not([tabindex="-1"])';

  // ------------------------------------------------------------------ confirmation dialog
  // opts: title, message, details [[label,value]], confirmLabel, cancelLabel, busyLabel, destructive,
  //       input {label, type, value, placeholder, required, min, rows, validate(v) -> error text}
//       checkbox {label, checked, hint} (its state is passed as the 2nd argument of onConfirm)
  //       onConfirm(inputValue) -> {ok:true} | {ok:false, error} (stays open) | {ok:false, close:true}
  // Resolves true when the action completed (or was confirmed, if there is no onConfirm), false otherwise.
  var active = false;
  function confirmDialog(o) {
    return new Promise(function (resolve) {
      if (active) { resolve(false); return; } // one dialog at a time: no stacked or repeated prompts
      active = true;
      var prev = document.activeElement;
      var uid = 'ui-dlg-' + Date.now();
      var inp = o.input || null;
      var tone = o.destructive ? 'bg-red-700 hover:bg-red-800 focus-visible:ring-red-300' : 'bg-[#647D69] hover:bg-[#526B57] focus-visible:ring-[#647D69]/40 text-white font-bold';
      var details = (o.details || []).map(function (d) {
        return '<div class="flex justify-between gap-4 py-2 text-xs"><dt class="text-[#6E6864]">' + esc(d[0]) + '</dt><dd class="font-semibold text-[#302C2A] text-right">' + esc(d[1]) + '</dd></div>';
      }).join('');
      var field = '';
      if (inp) {
        var common = 'id="' + uid + '-in" class="w-full mt-1 px-3 py-2 text-sm rounded-xl border border-[#E5ECE6] focus:outline-none focus:ring-2 focus:ring-[#647D69]/25 focus:border-[#647D69]" placeholder="' + esc(inp.placeholder || '') + '"';
        field = '<label class="block text-xs font-semibold text-[#302C2A]" for="' + uid + '-in">' + esc(inp.label || '') +
          (inp.type === 'number'
            ? '<input type="number" inputmode="numeric" min="' + esc(inp.min == null ? '' : inp.min) + '" value="' + esc(inp.value == null ? '' : inp.value) + '" ' + common + '>'
            : '<textarea rows="' + (inp.rows || 3) + '" maxlength="200" ' + common + '>' + esc(inp.value || '') + '</textarea>') + '</label>';
      }

      var root = document.createElement('div');
      root.className = 'fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4';
      root.innerHTML =
        '<div class="ui-scrim absolute inset-0 bg-[#302C2A]/25 backdrop-blur-md"></div>' +
        '<div role="' + (o.destructive ? 'alertdialog' : 'dialog') + '" aria-modal="true" aria-labelledby="' + uid + '-t" aria-describedby="' + uid + '-d" class="ui-dlg relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#E5ECE6] p-6 space-y-4">' +
          '<h2 id="' + uid + '-t" class="font-serif text-xl font-bold text-[#302C2A]">' + esc(o.title) + '</h2>' +
          '<p id="' + uid + '-d" class="text-sm text-[#6E6864] leading-relaxed">' + esc(o.message || '') + '</p>' +
          (details ? '<dl class="divide-y divide-[#E5ECE6] border-y border-[#E5ECE6]">' + details + '</dl>' : '') +
          field +
          (o.checkbox ? '<label class="flex items-start gap-2 text-xs text-[#302C2A] cursor-pointer"><input type="checkbox" id="' + uid + '-cb" class="mt-0.5 w-4 h-4 accent-[#647D69]"' + (o.checkbox.checked ? ' checked' : '') + '><span><span class="font-semibold">' + esc(o.checkbox.label || '') + '</span>' + (o.checkbox.hint ? '<span class="block text-[#6E6864]">' + esc(o.checkbox.hint) + '</span>' : '') + '</span></label>' : '') +
          '<p id="' + uid + '-e" role="alert" class="hidden text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3"></p>' +
          '<div class="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">' +
            '<button type="button" data-ui-cancel class="px-4 py-2.5 rounded-xl border border-[#E5ECE6] text-[#302C2A] text-xs font-semibold hover:bg-[#FFF9F5] transition disabled:opacity-50">' + esc(o.cancelLabel || 'Cancel') + '</button>' +
            '<button type="button" data-ui-ok class="px-4 py-2.5 rounded-xl text-white text-xs font-bold transition disabled:opacity-60 focus:outline-none focus-visible:ring-2 ' + tone + '">' + esc(o.confirmLabel || 'Confirm') + '</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(root);

      var box = root.querySelector('[role$="dialog"]');
      var okBtn = root.querySelector('[data-ui-ok]');
      var cancelBtn = root.querySelector('[data-ui-cancel]');
      var errEl = root.querySelector('#' + uid + '-e');
      var inputEl = inp ? root.querySelector('#' + uid + '-in') : null;
      var busy = false;

      function showError(msg) { errEl.textContent = msg; errEl.classList.remove('hidden'); }
      function setBusy(b) {
        busy = b; okBtn.disabled = b; cancelBtn.disabled = b;
        okBtn.textContent = b ? (o.busyLabel || 'Working…') : (o.confirmLabel || 'Confirm');
        box.setAttribute('aria-busy', b ? 'true' : 'false');
      }
      function close(result) {
        document.removeEventListener('keydown', onKey, true);
        root.remove();
        active = false;
        if (prev && prev.isConnected && prev.focus) prev.focus();
        resolve(result);
      }
      async function submit() {
        if (busy) return; // blocks double clicks and Enter-key repeats
        var val = inputEl ? inputEl.value.trim() : undefined;
        if (inp) {
          var bad = inp.required && !val ? 'This field is required.' : (inp.validate ? inp.validate(val) : '');
          if (bad) { showError(bad); inputEl.focus(); return; }
        }
        if (!o.onConfirm) { close(true); return; }
        errEl.classList.add('hidden');
        setBusy(true);
        var r;
        var cb = o.checkbox ? root.querySelector('#' + uid + '-cb') : null;
        try { r = await o.onConfirm(val, cb ? cb.checked : undefined); } catch (e) { r = { ok: false, error: 'Something went wrong. Please try again.' }; }
        if (r && r.ok === false) {
          if (r.close) { close(false); return; }
          setBusy(false); showError(r.error || 'Something went wrong. Please try again.'); (inputEl || okBtn).focus();
          return;
        }
        close(true);
      }
      function onKey(e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (!busy) close(false); return; }
        if (e.key !== 'Tab') return;
        var items = Array.prototype.filter.call(box.querySelectorAll(FOCUSABLE), function (el) { return el.offsetParent !== null; });
        if (!items.length) return;
        var first = items[0], last = items[items.length - 1];
        if (!box.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
        else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
      document.addEventListener('keydown', onKey, true);
      okBtn.addEventListener('click', submit);
      cancelBtn.addEventListener('click', function () { if (!busy) close(false); });
      root.querySelector('.ui-scrim').addEventListener('click', function () { if (!busy) close(false); });
      if (inputEl) inputEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' && inp.type === 'number') { e.preventDefault(); submit(); } });
      // Destructive prompts start on Cancel so a stray Enter cannot confirm them.
      (inputEl || (o.destructive ? cancelBtn : okBtn)).focus();
    });
  }

  // ------------------------------------------------------------------ undo snackbar
  var snackTimer;
  function undo(message, onUndo) {
    var old = document.getElementById('ui-snack'); if (old) old.remove();
    clearTimeout(snackTimer);
    var el = document.createElement('div');
    el.id = 'ui-snack'; el.setAttribute('role', 'status');
    el.className = 'ui-snack fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-4 pl-4 pr-2 py-2 rounded-xl bg-[#22181E] text-white text-xs shadow-2xl border border-[#382832] max-w-[calc(100vw-2rem)]';
    el.innerHTML = '<span></span><button type="button" class="px-3 py-1.5 rounded-lg font-bold text-[#EBF1EC] hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#647D69]">Undo</button>';
    el.firstChild.textContent = message;
    el.querySelector('button').addEventListener('click', function () { clearTimeout(snackTimer); el.remove(); onUndo(); });
    document.body.appendChild(el);
    snackTimer = setTimeout(function () { el.remove(); }, 6000);
  }

  // ------------------------------------------------------------------ dropdown menus
  function toggles() { return document.querySelectorAll('[data-menu-toggle][aria-expanded="true"]'); }
  function panelOf(btn) { return document.getElementById(btn.getAttribute('data-menu-toggle')); }
  function closeMenus(restoreFocus) {
    toggles().forEach(function (b) {
      b.setAttribute('aria-expanded', 'false');
      var p = panelOf(b); if (p) p.hidden = true;
      if (restoreFocus) b.focus();
    });
  }
  function openMenu(btn, focusFirst) {
    closeMenus();
    var p = panelOf(btn); if (!p) return;
    p.hidden = false; btn.setAttribute('aria-expanded', 'true');
    if (focusFirst) { var f = p.querySelector('[role="menuitem"]'); if (f) f.focus(); }
  }
  // Capture phase: close (and return focus to the toggle) before an item's own handler opens a dialog.
  document.addEventListener('click', function (e) {
    if (e.target.closest && e.target.closest('[role="menuitem"]')) closeMenus(true);
  }, true);
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-menu-toggle]');
    if (t) {
      var wasOpen = t.getAttribute('aria-expanded') === 'true';
      if (wasOpen) closeMenus(); else openMenu(t, e.detail === 0); // detail 0 = keyboard activation
    } else if (!e.target.closest('[role="menu"]')) closeMenus();
  });
  document.addEventListener('keydown', function (e) {
    var t = e.target.closest && e.target.closest('[data-menu-toggle]');
    if (t && e.key === 'ArrowDown' && t.getAttribute('aria-expanded') !== 'true') { e.preventDefault(); openMenu(t, true); return; }
    var open = toggles()[0]; if (!open) return;
    var items = Array.prototype.slice.call(panelOf(open).querySelectorAll('[role="menuitem"]'));
    var i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); closeMenus(true); }
    else if (e.key === 'Tab') closeMenus();
    else if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
    else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
    else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
  });

  // ------------------------------------------------------------------ elegant blush & ivory placeholder
  function renderPlaceholder(size, altText) {
    var isThumb = size === 'thumb' || size === 'sm';
    var isLarge = size === 'large' || size === 'modal';
    var label = esc(altText || 'Bouquet photography in preparation');
    if (isThumb) {
      return '<div class="w-full h-full bg-gradient-to-br from-[#FFF9F5] to-[#EBF1EC]/40 border border-[#E5ECE6] flex items-center justify-center text-[#647D69] select-none rounded-[inherit]" role="img" aria-label="' + label + '">' +
        '<svg class="w-4 h-4 text-[#647D69]/80 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">' +
          '<path stroke-linecap="round" stroke-linejoin="round" d="M12 21V11m0 0C10.5 8 7 7 7 3c3.5 0 4.5 3.5 5 8zm0 0c1.5-3 5-4 5-8-3.5 0-4.5 3.5-5 8z"/>' +
        '</svg>' +
      '</div>';
    }
    return '<div class="w-full h-full min-h-[160px] bg-gradient-to-br from-[#FFF9F5] via-[#FFF9F5] to-[#EBF1EC]/60 border border-[#E5ECE6]/80 flex flex-col items-center justify-center text-stone-500 p-5 select-none relative overflow-hidden rounded-[inherit]" role="img" aria-label="' + label + '">' +
      '<div class="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-rose-200/25 pointer-events-none blur-xl"></div>' +
      '<div class="absolute -left-8 -bottom-8 w-28 h-28 rounded-full bg-rose-200/25 pointer-events-none blur-xl"></div>' +
      '<div class="relative z-10 w-12 h-12 rounded-2xl bg-white/95 border border-[#E5ECE6] shadow-xs flex items-center justify-center text-[#647D69] mb-2.5">' +
        '<svg class="w-6 h-6 stroke-[1.4]" viewBox="0 0 24 24" fill="none" stroke="currentColor">' +
          '<path stroke-linecap="round" stroke-linejoin="round" d="M12 21V11m0 0C10.5 8 7 7 7 3c3.5 0 4.5 3.5 5 8zm0 0c1.5-3 5-4 5-8-3.5 0-4.5 3.5-5 8zm0 4c-2-1.5-4-1-5 1 2 0 4 .5 5-1zm0 3c2-1.5 4-1 5 1-2 0-4 .5-5-1z"/>' +
        '</svg>' +
      '</div>' +
      '<span class="relative z-10 font-serif text-[11px] font-bold tracking-widest text-[#647D69] uppercase">UMAIRA FLORIST</span>' +
      '<span class="relative z-10 text-[10px] text-stone-500 mt-1 font-medium tracking-wide">Photography in Preparation</span>' +
    '</div>';
  }

  function placeholderElement(size, altText) {
    var div = document.createElement('div');
    div.innerHTML = renderPlaceholder(size, altText);
    return div.firstElementChild;
  }

  function renderImage(src, alt, cls, size) {
    if (src && typeof src === 'string' && src.trim() !== '' && src !== 'null' && src !== 'undefined' && src !== '/image/placeholder.png') {
      return '<img src="' + esc(src) + '" alt="' + esc(alt || '') + '" class="' + esc(cls || '') + '" loading="lazy" onerror="this.onerror=null;if(window.UI){this.replaceWith(window.UI.placeholderElement(\'' + esc(size || 'card') + '\',\'' + esc(alt || '') + '\'));}">';
    }
    return renderPlaceholder(size, alt);
  }

  window.UI = { confirm: confirmDialog, undo: undo, closeMenus: closeMenus, esc: esc, renderPlaceholder: renderPlaceholder, placeholderElement: placeholderElement, renderImage: renderImage };
})();
