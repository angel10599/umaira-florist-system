/**
 * UMAIRA FLORIST - Navigation, Collections, Care Guide and clean Home page
 * Load this file LAST (after app.js and fx.js). It upgrades the existing router in place.
 *
 *  - Header pages: Home, Collections, Build Your Bouquet, Florist Care Guide, About Us
 *  - Collections page (ready-made bouquets) replaces the old Flowers page
 *  - Florist Care Guide page
 *  - Clean Home page: wave-framed flower-name marquee + subtle petals only
 */
(function () {
  'use strict';

  var router = window.appRouter;
  if (!router) { console.error('site-update.js: appRouter not found. Load this file after app.js.'); return; }
  var proto = Object.getPrototypeOf(router);

  /* =====================================================================
     1. STYLES
     ===================================================================== */
  var css = `
  #main-content { position: relative; z-index: 1; }

  body[data-view="home"] {
    background-color: #FAF6F0;
  }
  body[data-view="home"] .ring-stage { background: transparent; }

  /* ---- Hero ---- */
  .su-hero { position: relative; display: flex; align-items: center; width: 100%; }
  .su-hero-word { display: inline; opacity: 1 !important; filter: none !important; }
  .su-hero-fade { opacity: 1 !important; }

  .su-hero-figure-wrap { position: relative; width: 100%; max-width: 740px; display: flex; align-items: center; justify-content: center; margin: 0 auto; }
  @media (min-width: 1280px) { .su-hero-figure-wrap { max-width: 820px; } }
  .su-hero-halo {
    position: absolute;
    inset: -14% -10% -10% -10%;
    background: radial-gradient(ellipse 65% 55% at 65% 48%, rgba(254, 205, 222, 0.48) 0%, rgba(255, 230, 238, 0.25) 42%, rgba(255, 241, 243, 0) 72%);
    pointer-events: none;
    filter: blur(34px);
    z-index: 0;
  }
  .su-hero-figure {
    position: relative;
    z-index: 1;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    opacity: 0;
    transform: translateY(16px);
    animation: suHeroImgIn 1s cubic-bezier(0.16, 1, 0.3, 1) 0.35s forwards, suHeroFloat 7.5s ease-in-out 1.4s infinite alternate;
    will-change: transform, opacity;
  }
  .su-hero-img {
    display: block;
    width: 100%;
    max-width: 100%;
    height: auto;
    max-height: clamp(360px, 52vw, 660px);
    object-fit: contain;
    aspect-ratio: 1535 / 1024;
    pointer-events: none;
    user-select: none;
    -webkit-mask-image: linear-gradient(to bottom, #000 86%, rgba(0, 0, 0, 0) 100%);
    mask-image: linear-gradient(to bottom, #000 86%, rgba(0, 0, 0, 0) 100%);
    filter: drop-shadow(0 20px 40px rgba(216, 69, 124, 0.12)) drop-shadow(0 4px 14px rgba(60, 20, 30, 0.05));
  }
  @keyframes suHeroImgIn {
    from { opacity: 0; transform: translateY(18px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes suHeroFloat {
    0% { transform: translateY(0); }
    50% { transform: translateY(-7px); }
    100% { transform: translateY(0); }
  }
  @media (prefers-reduced-motion: reduce) {
    .su-hero-figure {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
    .su-hero-word, .su-hero-fade {
      animation: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
  }

  /* ---- Editorial About Page & Typewriter ---- */
  body[data-view="about"] {
    background-image: radial-gradient(circle at 10% 8%, rgba(254, 230, 238, 0.6) 0%, transparent 45%),
                      radial-gradient(circle at 90% 32%, rgba(252, 214, 233, 0.45) 0%, transparent 50%),
                      radial-gradient(circle at 20% 70%, rgba(255, 235, 242, 0.5) 0%, transparent 40%),
                      linear-gradient(180deg, #FFF9F5 0%, #FFFFFF 38%, #FFF8FA 78%, #FFF5F7 100%);
    background-attachment: fixed;
  }
  .su-typewriter { position: relative; display: inline-block; max-width: 100%; }
  .typewriter-ghost { visibility: hidden !important; pointer-events: none !important; user-select: none !important; display: block; }
  .typewriter-visible { position: absolute; inset: 0; left: 0; top: 0; width: 100%; height: 100%; display: block; }
  .typewriter-cursor { display: inline-block; margin-left: 2px; color: #647D69; font-weight: 300; animation: typeBlink 0.75s step-end infinite; opacity: 1; transition: opacity 0.35s ease; vertical-align: baseline; }
  .typewriter-cursor-done { opacity: 0 !important; }
  @keyframes typeBlink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
  .about-editorial-p { font-size: clamp(0.95rem, 1.08vw, 1.06rem); line-height: 1.85; color: #302C2A; }
  .about-eyebrow { display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.72rem; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: #647D69; }
  .about-divider { position: relative; display: flex; align-items: center; justify-content: center; margin: 5rem 0; }
  .about-divider::before { content: ''; position: absolute; left: 8%; right: 8%; height: 1px; background: linear-gradient(90deg, transparent, #F3DDE4 25%, #F3DDE4 75%, transparent); }
  .about-divider-glyph { position: relative; z-index: 1; background: #FFF9F5; padding: 0 1.25rem; color: #647D69; font-size: 0.8rem; opacity: 0.75; }
  .about-image-frame { position: relative; border-radius: 2rem; overflow: hidden; box-shadow: 0 24px 48px -18px rgba(60, 20, 30, 0.12); border: 1px solid rgba(241, 217, 224, 0.85); background: #FFF9F5; transition: transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.6s ease; }
  .about-image-frame:hover { transform: translateY(-3px) scale(1.01); box-shadow: 0 32px 56px -16px rgba(216, 69, 124, 0.16); }
  .about-owner-portrait { aspect-ratio: 4 / 5; border-radius: 1.75rem; position: relative; overflow: hidden; background: linear-gradient(145deg, #FFF7F9 0%, #FDEBF1 50%, #F9DBE5 100%); border: 1px solid rgba(241, 217, 224, 0.9); box-shadow: 0 16px 36px -12px rgba(80, 25, 40, 0.08); transition: transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.5s ease; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 1.5rem; text-align: center; }
  .about-owner-portrait:hover { transform: translateY(-4px); box-shadow: 0 24px 44px -12px rgba(216, 69, 124, 0.18); }

  /* ---- Wave-framed flower names ---- */
  .su-wave { position: relative; height: clamp(150px, 17vw, 190px); overflow: hidden; margin: 1rem 0; }
  .su-wave-back { position: absolute; left: 0; top: 0; height: 100%; width: 5760px; animation: suWaveDrift 70s linear infinite; will-change: transform; }
  .su-wave-back svg { display: block; width: 100%; height: 100%; }
  .su-wave-front { position: absolute; inset: 0; }
  .su-wave-front svg { display: block; width: 100%; height: 100%; }
  @keyframes suWaveDrift { from { transform: translate3d(-2880px, 0, 0); } to { transform: translate3d(0, 0, 0); } }

  .su-marquee { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); overflow: hidden;
    -webkit-mask-image: linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent);
            mask-image: linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent); }
  .su-marquee-track { display: flex; width: max-content; animation: suMarquee 110s linear infinite; will-change: transform; }
  .su-marquee-group { display: flex; flex-shrink: 0; align-items: center; }
  .su-marquee-item { font-family: 'Cormorant Garamond', Garamond, Georgia, serif; font-size: clamp(.9rem, 1.35vw, 1.1rem); font-weight: 600; letter-spacing: .2em;
    text-transform: uppercase; color: #7d2f3f; white-space: nowrap; }
  .su-marquee-dot { width: 5px; height: 5px; border-radius: 9999px; background: #d98a97; margin: 0 1.6rem; flex-shrink: 0; }
  /* Moves left to right. The track holds two identical groups, so shifting by exactly one group is invisible. */
  @keyframes suMarquee { from { transform: translate3d(-50%, 0, 0); } to { transform: translate3d(0, 0, 0); } }

  /* ---- Collections Soft UI Chips ---- */
  .su-anchor { scroll-margin-top: 110px; }
  .su-chip {
    padding: .6rem 1.35rem;
    border-radius: 9999px;
    font-size: .8rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
    background: #ffffff;
    color: #4a3e44;
    border: 1.5px solid #E5ECE6;
    box-shadow: 0 2px 6px -1px rgba(216, 69, 124, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
    transition: all .25s cubic-bezier(0.16, 1, 0.3, 1);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }
  .su-chip:hover {
    border-color: #647D69;
    color: #647D69;
    background: #FFF9F5;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px -2px rgba(216, 69, 124, 0.15);
  }
  .su-chip.is-active {
    background: linear-gradient(135deg, #647D69 0%, #526B57 100%);
    border-color: #647D69;
    color: #ffffff;
    box-shadow: 0 4px 14px 0 rgba(216, 69, 124, 0.32), inset 0 1px 1px rgba(255, 255, 255, 0.25);
    transform: translateY(-1px);
  }

  /* ---- Bouquet details window ---- */
  #su-bq-modal { position: fixed; inset: 0; z-index: 80; display: none; align-items: center; justify-content: center; padding: 1.25rem; background: rgba(40,12,18,.55); backdrop-filter: blur(4px); }
  #su-bq-modal.is-open { display: flex; animation: suFade .25s ease-out both; }

  /* ---- 3D Petal-Based Scroll Storytelling ---- */
  #care-story-stage {
    position: sticky;
    top: 0;
    height: 100vh;
    width: 100%;
    overflow: hidden;
    background: radial-gradient(circle at 50% 45%, #fff0f3 0%, #fde8ee 55%, #fbdfe6 100%);
  }
  .su-story-dot.is-active {
    background-color: #647D69 !important;
    color: #ffffff !important;
    border-color: #647D69 !important;
    box-shadow: 0 4px 12px rgba(216, 69, 124, 0.35);
  }
  #care-emerging-card {
    will-change: transform, opacity;
  }
  #care-connecting-line {
    filter: drop-shadow(0 2px 6px rgba(178, 68, 84, 0.35));
  }
  `;
  var style = document.createElement('style');
  style.id = 'site-update-css';
  style.textContent = css;
  document.head.appendChild(style);

  /* =====================================================================
     2. SUBTLE PETALS (home page only, behind the content)
     ===================================================================== */
  function buildPetals() {
    var old = document.getElementById('su-petals');
    if (old) old.remove();
    var canvas = document.getElementById('canvas-petals');
    if (canvas) canvas.remove();
  }

  /* =====================================================================
     3. WAVE FRAME + FLOWER NAME MARQUEE
     ===================================================================== */
  // Builds one smooth sine-like wave line across `width`, then closes the shape.
  function waveShape(width, height, topY, bottomY, amp, periodPx, topPhase, bottomPhase) {
    var half = periodPx / 2;
    var n = Math.round(width / half);
    var d = 'M0,' + topY;
    var i, x, sign;
    for (i = 0; i < n; i++) {
      x = i * half;
      sign = ((i + topPhase) % 2 === 0) ? -1 : 1;
      d += ' Q' + (x + half / 2) + ',' + (topY + sign * amp * 2) + ' ' + (x + half) + ',' + topY;
    }
    d += ' L' + width + ',' + bottomY;
    for (i = n - 1; i >= 0; i--) {
      x = i * half;
      sign = ((i + bottomPhase) % 2 === 0) ? 1 : -1;
      d += ' Q' + (x + half / 2) + ',' + (bottomY + sign * amp * 2) + ' ' + x + ',' + bottomY;
    }
    return d + ' Z';
  }

  function renderWaveMarquee() {
    var names = ['Roses', 'Tulips', 'Lilies', 'Sunflowers', 'Peonies', 'Orchids', 'Hydrangeas', 'Carnations',
                 "Baby's Breath", 'Daisies', 'Wax Flower', 'Eucalyptus', 'Ruscus', 'Ferns'];
    var group = names.concat(names).map(function (n) {
      return '<span class="su-marquee-item">' + n + '</span><span class="su-marquee-dot"></span>';
    }).join('');

    // Soft back wave (drifts very slowly) and front wave (static). Both are full-height bands with wavy top and bottom edges.
    var back = waveShape(5760, 190, 34, 160, 12, 720, 0, 1);
    var front = waveShape(1440, 190, 46, 146, 10, 720, 1, 0);

    return '' +
      '<section class="su-wave" aria-label="Our flowers">' +
        '<div class="su-wave-back" aria-hidden="true"><svg viewBox="0 0 5760 190" preserveAspectRatio="none"><path d="' + back + '" fill="#fde9ed"/></svg></div>' +
        '<div class="su-wave-front" aria-hidden="true"><svg viewBox="0 0 1440 190" preserveAspectRatio="none">' +
          '<defs><linearGradient id="su-wave-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fbd3da"/><stop offset=".5" stop-color="#fde0e5"/><stop offset="1" stop-color="#fbd3da"/></linearGradient></defs>' +
          '<path d="' + front + '" fill="url(#su-wave-g)"/></svg></div>' +
        '<div class="su-marquee"><div class="su-marquee-track">' +
          '<div class="su-marquee-group">' + group + '</div>' +
          '<div class="su-marquee-group" aria-hidden="true">' + group + '</div>' +
        '</div></div>' +
      '</section>';
  }

  /* =====================================================================
     4. HOME PAGE (clean: no floating pictures, no leaves)
     ===================================================================== */
  function wrapTypewriterText(text) {
    var safeText = String(text || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    return '' +
      '<span class="su-typewriter" data-typewriter="' + safeText + '">' +
        '<span class="typewriter-ghost" aria-hidden="true">' + safeText + '</span>' +
        '<span class="typewriter-visible" aria-hidden="true"><span class="typewriter-text"></span><span class="typewriter-cursor">|</span></span>' +
      '</span>';
  }

  function renderHero() {
    var st = window.appState;
    var isAuth = Boolean(st && st.isAuthenticated && st.isAuthenticated());
    var fmt = function (n) { return typeof formatCurrency === 'function' ? formatCurrency(n) : '₱' + Number(n).toLocaleString(); };

    // Service chips come from the saved Shop Settings (delivery fee / free-delivery minimum, pickup preparation time).
    var chips = [];
    var deliveryOn = !(st && st.deliverySettings && st.deliverySettings.enabled === false);
    if (deliveryOn) {
      var fee = st ? st.getDeliveryFee(1, 'delivery') : 0;
      var thr = st ? st.getFreeDeliveryThreshold() : 0;
      var deliveryText = !(fee > 0) ? '<b>Free delivery</b>across the City of Manila'
        : (thr > 0 ? '<b>Free delivery</b>on <span class="announcement-threshold-val">' + fmt(thr) + '</span>+ in Manila'
          : '<b>Manila delivery</b>flat ' + fmt(fee) + ' fee');
      chips.push('<div class="pt-hero-chip pt-glass"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg><span>' + deliveryText + '</span></div>');
    }
    var pickupOn = !(st && st.pickupSettings && st.pickupSettings.enabled === false);
    if (pickupOn) {
      var lead = Number(st && st.pickupSettings && st.pickupSettings.leadTimeHours);
      var pickupText = Number.isFinite(lead) && lead > 0
        ? '<b>Store pickup</b>ready in ' + lead + ' hour' + (lead === 1 ? '' : 's')
        : '<b>Store pickup</b>at our flower shop';
      chips.push('<div class="pt-hero-chip pt-glass"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/></svg><span>' + pickupText + '</span></div>');
    }

    var guest = isAuth ? '' : (
      '<p class="pt-hero-guest"><span class="pt-dot" aria-hidden="true"></span><span>Guests are welcome to browse.</span> ' +
        '<button type="button" onclick="window.appRouter.navigate(\'signin\')">Sign in</button> <span>to order and track deliveries.</span></p>'
    );

    return '' +
    '<section class="pt-hero" id="home-hero" data-hero>' +
      '<div class="pt-hero-copy" data-hero-content>' +
        '<span class="pt-kick">Umaira Florist &middot; Botanical Atelier</span>' +
        '<h1 class="pt-hero-title" aria-label="Flowers, thoughtfully made.">' +
          '<span class="pt-w" style="--i:0" aria-hidden="true">Flowers,</span> ' +
          '<em aria-hidden="true"><span class="pt-w" style="--i:1">thoughtfully</span> <span class="pt-w" style="--i:2">made.</span></em>' +
        '</h1>' +
        '<p class="pt-lede">Handcrafted bouquets and single stems sourced daily, arranged with love, and delivered across Manila.</p>' +
        '<div class="pt-hero-ctas">' +
          '<button type="button" data-magnetic onclick="window.appRouter.navigate(\'collections\')" class="pt-btn pt-btn-ink">' +
            '<span>Explore Collections</span>' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>' +
          '</button>' +
          '<button type="button" data-magnetic onclick="window.appRouter.navigate(\'builder\')" class="pt-btn pt-btn-prism">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>' +
            '<span>Build Your Bouquet</span>' +
          '</button>' +
        '</div>' +
        (chips.length ? '<div class="pt-hero-chips">' + chips.join('') + '</div>' : '') +
        guest +
      '</div>' +
      '<div class="pt-hero-art" data-hero-card>' +
        '<div class="pt-arch">' +
          '<img src="/image/taniman.jpg?v=20261103-v2" alt="Rows of flowers in bloom" fetchpriority="high" decoding="async">' +
          '<div class="pt-arch-cap pt-glass">' +
            '<span class="pt-disc" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-9"/><path d="M12 13c-3.5 0-6-2.5-6-6 3.5 0 6 2.5 6 6Z"/><path d="M12 13c3.5 0 6-2.5 6-6-3.5 0-6 2.5-6 6Z"/><path d="M9 22h6"/></svg></span>' +
            '<div><b>Arranged by hand</b><small>Delivery across the City of Manila, or pick up at the shop</small></div>' +
          '</div>' +
        '</div>' +
        '<div class="pt-stamp-wrap" aria-hidden="true">' +
          '<div class="pt-stamp pt-glass">' +
            '<svg class="pt-stamp-ring" viewBox="0 0 120 120"><defs><path id="pt-stamp-path" d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0"/></defs><text font-family="Nunito, sans-serif" font-size="10.5" font-weight="800" letter-spacing="3.2" fill="#4f8a5d"><textPath href="#pt-stamp-path">HAND-TIED &#183; FRESH DAILY &#183; MANILA &#183; </textPath></text></svg>' +
            '<span class="pt-stamp-core"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.6"/><path d="M12 9.4C10 6 10.4 3 12 3s2 3 0 6.4M14.6 12c3.4-2 6.4-1.6 6.4 0s-3 2-6.4 0M12 14.6c2 3.4 1.6 6.4 0 6.4s-2-3 0-6.4M9.4 12C6 14 3 13.6 3 12s3-2 6.4 0"/></svg></span>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  function isBouquetPublished(b) {
    if (!b || b.archived) return false;
    if (!b.price || Number(b.price) <= 0) return false;
    return true;
  }

  /* Guest Shop Preview (Bouquets & Single Stems preview for visitors) */
  function renderGuestShopPreviewSection() {
    var bouquets = (FLOWER_DATA && FLOWER_DATA.featuredBouquets) || [];
    var publishedBouquets = bouquets.filter(isBouquetPublished);
    var previewBouquets = publishedBouquets.slice(0, 4);

    var flowers = (FLOWER_DATA && (FLOWER_DATA.mainFlowers || FLOWER_DATA.flowers)) || [];
    var previewFlowers = flowers.slice(0, 6);

    var bouquetCardsHtml = previewBouquets.map(function (b) {
      return '' +
        '<div class="group relative rounded-3xl bg-white border border-stone-200/90 shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col">' +
          '<div class="relative aspect-[4/5] overflow-hidden bg-[#EBF1EC]">' +
            window.UI.renderImage(b.image, b.name, 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-500', 'card') +
            '<span class="absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/90 backdrop-blur-xs text-rose-950 shadow-xs">Ready-Made</span>' +
          '</div>' +
          '<div class="p-4 flex-1 flex flex-col justify-between space-y-3">' +
            '<div>' +
              '<h4 class="font-serif font-bold text-stone-900 text-sm sm:text-base leading-snug line-clamp-1 cursor-pointer" onclick="window.suOpenBouquet(\'' + b.id + '\')">' + b.name + '</h4>' +
            '</div>' +
            '<div class="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">' +
              '<span class="font-bold text-[#647D69] text-sm sm:text-base price">' + formatCurrency(b.price) + '</span>' +
              '<div class="flex items-center gap-1.5">' +
                '<button type="button" onclick="window.suOpenBouquet(\'' + b.id + '\')" class="px-2.5 py-1 text-[11px] font-semibold text-stone-600 hover:text-[#647D69] rounded-lg hover:bg-stone-100 transition">' +
                  'View Details' +
                '</button>' +
                '<button type="button" onclick="window.appRouter.promptGuestSignIn(\'Sign in to order this handcrafted bouquet.\', { type: \'add_bouquet\', id: \'' + b.id + '\' })" class="px-3 py-1 text-[11px] font-semibold text-white bg-rose-900 hover:bg-rose-800 rounded-lg transition shadow-2xs">' +
                  'Order' +
                '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    var flowerCardsHtml = previewFlowers.map(function (f) {
      return '' +
        '<div class="group relative rounded-2xl bg-white border border-stone-200/90 shadow-2xs hover:shadow-md transition-all duration-300 overflow-hidden flex flex-col p-3">' +
          '<div class="relative aspect-square rounded-xl overflow-hidden bg-[#EBF1EC] mb-2.5">' +
            window.UI.renderImage(f.image, f.name, 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-500', 'card') +
            '<span class="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider bg-white/90 text-stone-800">' + (f.category || 'Fresh') + '</span>' +
          '</div>' +
          '<div class="flex-1 flex flex-col justify-between space-y-2">' +
            '<div>' +
              '<h5 class="font-serif font-semibold text-stone-900 text-xs sm:text-sm line-clamp-1">' + f.name + '</h5>' +
              '<span class="text-[10px] text-stone-500 block">' + (f.origin || 'Imported / Local') + '</span>' +
            '</div>' +
            '<div class="pt-1.5 border-t border-stone-100 flex items-center justify-between">' +
              '<span class="font-sans font-bold text-[#647D69] text-xs">' + formatCurrency(f.price) + '<span class="text-[9px] text-stone-500 font-normal"> / stem</span></span>' +
              '<button type="button" onclick="window.appRouter.promptGuestSignIn(\'Sign in to customize bouquets and order individual stems.\', { type: \'add_stem\', id: \'' + f.id + '\' })" class="px-2 py-0.5 text-[10px] font-semibold text-[#647D69] hover:bg-[#FFF9F5] rounded-md border border-[#E5ECE6] transition">' +
                'Order' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
    }).join('');

    return '' +
    '<section class="py-14 sm:py-18 bg-white/80 border-b border-stone-200" id="guest-shop-preview">' +
      '<div class="max-w-7xl mx-auto px-6 space-y-12">' +
        
        '<!-- Header -->' +
        '<div class="text-center max-w-2xl mx-auto space-y-2">' +
          '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#EBF1EC] text-[#647D69] border border-[#E5ECE6]">Bouquet Preview</span>' +
          '<h2 class="font-serif text-3xl sm:text-4xl font-bold text-stone-900">A Glimpse of Our Blooms</h2>' +
          '<p class="text-stone-600 text-xs sm:text-sm">A preview of our ready-made bouquets and fresh flowers, available for Manila delivery or store pickup.</p>' +
        '</div>' +

        (previewBouquets.length > 0 ?
        '<!-- 1. Ready-Made Bouquets Preview -->' +
        '<div class="space-y-4">' +
          '<div class="flex items-center justify-between">' +
            '<h3 class="font-serif font-bold text-stone-900 text-lg sm:text-xl">Featured Ready-Made Bouquets</h3>' +
            '<span class="text-xs text-stone-500">' + previewBouquets.length + ' of ' + publishedBouquets.length + ' bouquets</span>' +
          '</div>' +
          '<div class="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">' +
            bouquetCardsHtml +
          '</div>' +
        '</div>' : '') +

        '<!-- 2. Individual Fresh Stems Preview -->' +
        '<div class="space-y-4">' +
          '<div class="flex items-center justify-between">' +
            '<h3 class="font-serif font-bold text-stone-900 text-lg sm:text-xl">Fresh Stems Currently in Studio</h3>' +
            '<span class="text-xs text-stone-500">6 of ' + (flowers.length || 20) + ' varieties</span>' +
          '</div>' +
          '<div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">' +
            flowerCardsHtml +
          '</div>' +
        '</div>' +

        '<!-- 3. Guest Sign-In Callout -->' +
        '<div class="rounded-3xl bg-gradient-to-r from-white via-[#FFF9F5] to-[#F9DFE8]/40 p-6 sm:p-8 border border-[#E5ECE6] text-center space-y-3.5 max-w-2xl mx-auto shadow-xs">' +
          '<h4 class="font-serif font-bold text-stone-900 text-lg sm:text-xl">Ready to Order?</h4>' +
          '<p class="text-stone-600 text-xs sm:text-sm max-w-md mx-auto leading-relaxed">' +
            'Sign in to explore our full bouquet catalog, save your favorites, and place an order.' +
          '</p>' +
          '<div class="pt-1">' +
            '<button type="button" onclick="window.appRouter.navigate(\'auth\', false, { mode: \'signin\' })" class="py-3 px-8 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-xs sm:text-sm shadow-md shadow-rose-900/20 transition">' +
              'Sign In to Browse Full Shop' +
            '</button>' +
          '</div>' +
        '</div>' +

      '</div>' +
    '</section>';
  }

  function cardEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // Every occasion a bouquet is tagged with (database `occasion` text + `occasions` + specs), de-duplicated.
  function bouquetOccasionTags(bq) {
    var raw = [].concat(
      Array.isArray(bq.occasions) ? bq.occasions : [],
      bq.occasion ? String(bq.occasion).split(',') : [],
      (bq.specs && Array.isArray(bq.specs.occasions)) ? bq.specs.occasions : []
    );
    var seen = {};
    return raw.map(function (o) { return String(o).trim(); }).filter(function (o) {
      var k = o.toLowerCase();
      if (!o || seen[k]) return false;
      seen[k] = true;
      return true;
    });
  }

  // The single category label shown on a card. Bouquets can carry many occasions, so the card shows ONE
  // (the occasion being browsed when it applies, otherwise the first); the full list is in the tooltip
  // and in the details modal.
  function bouquetCategoryLabel(bq, activeOccasion) {
    var tags = bouquetOccasionTags(bq);
    if (!tags.length) return { label: bq.category || '', title: bq.category || '' };
    var label = tags[0];
    if (activeOccasion && activeOccasion !== 'all') {
      var hit = tags.filter(function (t) { return t.toLowerCase() === String(activeOccasion).toLowerCase(); })[0];
      if (hit) label = hit;
    }
    return { label: label, title: tags.join(', ') };
  }

  // The one bouquet card used everywhere (Home "Featured Bouquets" and the Collections grid):
  // image (price bottom-right; the image itself opens the details modal), category, name, Add to Cart / Buy Now.
  function compactBouquetCard(bq, opts) {
    var cat = bouquetCategoryLabel(bq, opts && opts.activeOccasion);
    var idArg = '\'' + String(bq.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + '\'';
    var openCall = 'window.suOpenBouquet(' + idArg + ')';

    var maxStock = 50;
    if (window.appState && typeof window.appState.maxQuantityFor === 'function') {
      maxStock = window.appState.maxQuantityFor({ id: bq.id, isCustom: false });
    }
    var isSoldOut = bq.availability === 'unavailable' || bq.availability === 'sold_out' || maxStock <= 0;
    if (!isSoldOut && window.appRouter && typeof window.appRouter.isBouquetAvailable === 'function') {
      isSoldOut = !window.appRouter.isBouquetAvailable(bq);
    }

    // Prism-Terra arch card. Handlers are the same as before: open details, Add to Cart, Buy Now.
    return '' +
    '<article data-reveal class="pt-pc' + (isSoldOut ? ' is-sold-out' : '') + '">' +
      '<div role="button" tabindex="0" aria-label="Open details for ' + cardEsc(bq.name) + '" class="pt-pc-art" onclick="' + openCall + '" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();' + openCall + ';}">' +
        window.UI.renderImage(bq.image, bq.name, 'w-full h-full object-cover', 'card') +
        (isSoldOut ? '<div class="pt-pc-out"><span>Sold out</span></div>' : '') +
        '<span class="pt-pc-price price">' + formatCurrency(bq.price) + '</span>' +
      '</div>' +
      '<div class="pt-pc-bd">' +
        (cat.label ? '<span class="pt-pc-tag" title="' + cardEsc(cat.title) + '">' + cardEsc(cat.label) + '</span>' : '') +
        '<h3 class="pt-pc-name" title="' + cardEsc(bq.name) + '" onclick="' + openCall + '">' + cardEsc(bq.name) + '</h3>' +
        '<button type="button" onclick="' + openCall + '" class="pt-pc-more" title="View Details">View details</button>' +
      '</div>' +
      (isSoldOut ?
        '<button disabled class="pt-pc-sold w-full">Sold Out</button>' :
        '<div class="pt-pc-acts">' +
          '<button type="button" onclick="window.appRouter.addPreMadeBouquetToCart(\'' + bq.id + '\')" class="pt-btn pt-btn-glass" title="Add to Cart" aria-label="Add ' + cardEsc(bq.name) + ' to cart">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' +
            '<span class="pt-l-long">Add to Cart</span><span class="pt-l-short" aria-hidden="true">Add</span>' +
          '</button>' +
          '<button type="button" onclick="window.appRouter.buyNowBouquet(\'' + bq.id + '\')" class="pt-btn pt-btn-ink" title="Buy Now">' +
            '<span>Buy Now</span>' +
          '</button>' +
        '</div>') +
    '</article>';
  }

  /* Section: Shop by Occasion (Clean White Background) */
  // The 4 occasions featured on the Home page. Each one is a name from the shop's official occasion
  // list (SHOP_RULES.OFFICIAL_OCCASIONS): the same list that feeds the Collections "Occasion" filter and
  // the admin Add/Edit Bouquet occasion chips. Only the icon and the blurb live here; to feature a
  // different occasion, change `occasion` to any other official name.
  var FEATURED_OCCASIONS = [
    {
      occasion: 'Birthday',
      desc: 'Bright and cheerful flowers for life\'s happy celebrations',
      icon: '<svg class="w-6 h-6 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>'
    },
    {
      occasion: 'Anniversary',
      desc: 'Classic roses and romantic arrangements to celebrate lasting love',
      icon: '<svg class="w-6 h-6 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>'
    },
    {
      occasion: 'Graduation',
      desc: 'Sunflowers and vibrant blooms to celebrate accomplishments',
      icon: '<svg class="w-6 h-6 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>'
    },
    {
      occasion: 'Sympathy',
      desc: 'Gentle white lilies, orchids, and peaceful arrangements',
      icon: '<svg class="w-6 h-6 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>'
    }
  ];

  /* Section: Shop by Occasion (Clean White Background) */
  function renderShopByOccasionSection() {
    // Cards are built from the official occasion list, so a name that is not (or no longer) an official
    // occasion can never produce a card that filters nothing.
    var occasions = FEATURED_OCCASIONS.filter(function (o) {
      return OFFICIAL_OCCASIONS.indexOf(o.occasion) >= 0;
    });

    var cards = occasions.map(function (o) {
      // The occasion name travels in a data attribute so names with apostrophes ("Valentine's Day") are safe.
      var occName = String(o.occasion).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
      return '' +
        '<div role="button" tabindex="0" data-reveal data-tilt="4" data-occasion="' + occName + '" onclick="window.suShopByOccasion(this.getAttribute(\'data-occasion\'))" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();window.suShopByOccasion(this.getAttribute(\'data-occasion\'));}" aria-label="Shop ' + occName + ' bouquets" class="group atelier-card cursor-pointer p-6 rounded-3xl bg-white border border-[#E5ECE6] hover:border-[#647D69]/60 shadow-xs hover:shadow-floral transition-all duration-300 flex flex-col justify-between space-y-4">' +
          '<div class="flex items-center justify-between">' +
            '<div class="w-12 h-12 rounded-2xl bg-[#F9DFE8] border border-[#E5ECE6]/40 shadow-2xs flex items-center justify-center group-hover:scale-105 transition-transform">' +
              o.icon +
            '</div>' +
            '<span class="text-xs font-bold text-[#647D69] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-serif">Explore <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></span>' +
          '</div>' +
          '<div>' +
            '<h3 class="font-serif font-bold text-[#302C2A] text-base group-hover:text-[#647D69] transition-colors">' + o.occasion + '</h3>' +
            '<p class="text-[11px] text-[#6E6864] mt-1 leading-relaxed line-clamp-2">' + o.desc + '</p>' +
          '</div>' +
        '</div>';
    }).join('');

    return '' +
      '<section class="py-16 sm:py-20 bg-transparent border-b border-[#E5ECE6]/60 relative z-10" id="home-occasions">' +
        '<div class="max-w-7xl mx-auto px-6 space-y-8">' +
          '<div data-reveal class="flex flex-col sm:flex-row sm:items-end justify-between gap-3 text-center sm:text-left">' +
            '<div>' +
              '<span class="inline-block px-3.5 py-1 rounded-full bg-[#F9DFE8] text-[#526B57] text-xs font-bold tracking-wider uppercase">Curated Occasions</span>' +
              '<h2 class="font-serif text-3xl sm:text-4xl font-bold text-[#302C2A] mt-2" aria-label="Shop by Occasion">' + wrapTypewriterText('Shop by Occasion') + '</h2>' +
              '<p class="text-[#6E6864] text-xs sm:text-sm mt-1">Thoughtfully arranged bouquets for birthdays, anniversaries, and special moments.</p>' +
            '</div>' +
            '<button type="button" onclick="window.suViewFullCatalog()" class="text-xs font-bold text-[#647D69] hover:underline self-center sm:self-end flex items-center gap-1"><span>View Full Catalog</span><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg></button>' +
          '</div>' +
          '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">' +
            cards +
          '</div>' +
        '</div>' +
      '</section>';
  }

  /* Section 2: The Atelier Curation (Featured Bouquets) */
  function renderFeaturedFlowersSection() {
    var bouquets = (FLOWER_DATA && FLOWER_DATA.featuredBouquets) || [];
    var published = bouquets.filter(isBouquetPublished);

    if (!published.length) {
      return '' +
      '<section class="py-14 sm:py-16 bg-white/80 border-b border-stone-200" id="home-featured">' +
        '<div class="max-w-5xl mx-auto px-6">' +
          '<div class="bg-[#EBF1EC]/50 rounded-3xl p-8 sm:p-10 border border-[#E5ECE6] text-center space-y-4">' +
            '<span class="text-xs font-bold text-[#647D69] uppercase tracking-widest block">SEASONAL CURATION</span>' +
            '<h2 class="font-serif text-2xl sm:text-3xl font-bold text-stone-900">New Ready-Made Arrangements Coming Soon</h2>' +
            '<p class="text-stone-600 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">' +
              'Our florists hand-condition fresh stems daily. Explore our bespoke studio to compose your own custom bouquet stem by stem with same-day Manila delivery.' +
            '</p>' +
            '<div class="pt-2">' +
              '<button type="button" onclick="window.appRouter.navigate(\'builder\')" class="py-3 px-6 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-xs shadow-sm transition inline-flex items-center gap-1.5">' +
                '<span>Open Bouquet Studio</span><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</section>';
    }

    var featured = published.filter(function (b) {
      return b.isBestSeller || (b.categories && b.categories.indexOf('Best Sellers') >= 0);
    });
    if (featured.length < 6) {
      featured = published.slice(0, 6);
    } else {
      featured = featured.slice(0, 6);
    }

    var cards = featured.map(function (b) {
      return compactBouquetCard(b);
    }).join('');

    return '' +
    '<section class="py-16 sm:py-20 bg-transparent border-b border-[#E5ECE6]/70 relative z-10" id="home-featured">' +
      '<div class="max-w-7xl mx-auto px-6">' +
        '<div data-reveal class="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4 text-center sm:text-left">' +
          '<div>' +
            '<span class="text-xs font-bold text-[#647D69] uppercase tracking-widest block">Featured Bouquets</span>' +
            '<h2 class="font-serif text-3xl sm:text-4xl font-bold text-stone-900 mt-1" aria-label="Customer Favorites">' + wrapTypewriterText('Customer Favorites') + '</h2>' +
            '<p class="text-stone-500 text-xs sm:text-sm mt-1 max-w-xl">Our most-loved floral arrangements, handpicked for their beauty and lasting freshness.</p>' +
          '</div>' +
          '<button type="button" onclick="window.appRouter.navigate(\'collections\')" class="inline-flex items-center justify-center gap-1.5 py-2.5 px-5 rounded-2xl bg-white border border-stone-300 hover:bg-[#FFF9F5] text-stone-900 text-xs font-bold transition shadow-xs">' +
            '<span>View All Collections</span><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>' +
          '</button>' +
        '</div>' +
        '<div class="pt-grid pt-grid-3">' +
          cards +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* Section: Why Choose Umaira Florist (White with Soft Pink Accents) */
  // Delivery fee wording from the saved Shop Settings (never hard-coded amounts).
  function deliveryFeeCopy() {
    var st = window.appState;
    var fee = st ? st.getDeliveryFee(1, 'delivery') : 0;
    var thr = st ? st.getFreeDeliveryThreshold() : 0;
    var fmt = function (n) { return typeof formatCurrency === 'function' ? formatCurrency(n) : '₱' + Number(n).toLocaleString(); };
    if (!(fee > 0) || !(thr > 0)) return fee > 0 ? 'a flat ' + fmt(fee) + ' delivery fee' : 'free delivery';
    return 'a flat ' + fmt(fee) + ' delivery fee (free on orders of <span class="announcement-threshold-val">' + fmt(thr) + '</span> and up)';
  }

  function renderWhyChooseUsSection() {
    var reasons = [
      {
        icon: '<svg class="w-6 h-6 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>',
        title: 'Fresh Daily Stems',
        desc: 'Every morning, our florists carefully inspect and hydrate fresh flowers sourced from Benguet farms and premium international growers.'
      },
      {
        icon: '<svg class="w-6 h-6 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/></svg>',
        title: 'Custom Bouquet Builder',
        desc: 'Create an arrangement that is truly personal. Choose your favorite flowers, fillers, wrapping papers, ribbons, and greeting cards in our 5-step studio.'
      },
      {
        icon: '<svg class="w-6 h-6 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
        title: 'Reliable Manila Delivery',
        desc: 'Fast delivery across Manila Districts 1–6 with real-time status updates, ' + deliveryFeeCopy() + ', and free pickup at our boutique atelier.'
      }
    ];

    var cards = reasons.map(function (r) {
      return '' +
        '<div data-reveal data-tilt="4" class="atelier-card p-8 rounded-3xl bg-white border border-[#E5ECE6] hover:border-[#647D69]/60 shadow-xs hover:shadow-floral transition-all duration-300 space-y-4">' +
          '<div class="w-12 h-12 rounded-2xl bg-[#F9DFE8] border border-[#E5ECE6]/40 flex items-center justify-center">' +
            r.icon +
          '</div>' +
          '<h3 class="font-serif font-bold text-[#302C2A] text-xl">' + r.title + '</h3>' +
          '<p class="text-xs sm:text-sm text-[#6E6864] leading-relaxed">' + r.desc + '</p>' +
        '</div>';
    }).join('');

    return '' +
      '<section class="py-16 sm:py-20 bg-transparent border-b border-[#E5ECE6]/60 relative z-10" id="home-why-choose-us">' +
        '<div class="max-w-6xl mx-auto px-6 space-y-10">' +
          '<div data-reveal class="text-center max-w-2xl mx-auto space-y-2">' +
            '<span class="inline-block px-3.5 py-1 rounded-full bg-[#F9DFE8] text-[#526B57] text-xs font-bold tracking-wider uppercase">Craft &amp; Excellence</span>' +
            '<h2 class="font-serif text-3xl sm:text-4xl font-bold text-[#302C2A] mt-1" aria-label="The Umaira Florist Difference">' + wrapTypewriterText('The Umaira Florist Difference') + '</h2>' +
            '<p class="text-[#6E6864] text-xs sm:text-sm">Thoughtfully handcrafted bouquets and lasting freshness in every arrangement.</p>' +
          '</div>' +
          '<div class="grid grid-cols-1 md:grid-cols-3 gap-6">' +
            cards +
          '</div>' +
        '</div>' +
      '</section>';
  }

  /* Section: How to Order & Manila Delivery (Subtle Soft Ivory Background) */
  function renderHowToOrderSection() {
    var steps = [
      {
        num: '01',
        title: 'Choose Your Flowers',
        desc: 'Browse our ready-made bouquets or create your own custom arrangement stem by stem in our Bouquet Builder.'
      },
      {
        num: '02',
        title: 'Personalize Your Gift',
        desc: 'Choose your wrapping paper, add a ribbon, and write a personal greeting card for your recipient.'
      },
      {
        num: '03',
        title: 'Delivery or Pickup',
        desc: 'Enjoy ' + deliveryFeeCopy() + ' across Manila Districts 1–6, or pick up for free at our boutique atelier.'
      },
      {
        num: '04',
        title: 'Pay Easily & Securely',
        desc: 'Pay using GCash, Cash on Delivery, or BDO / BPI bank transfer.'
      }
    ];

    var cards = steps.map(function (s) {
      return '' +
      '<div data-reveal data-tilt="4" class="atelier-card p-6 rounded-3xl bg-white border border-[#E5ECE6] shadow-xs space-y-3 text-center sm:text-left">' +
        '<div class="w-10 h-10 rounded-2xl bg-[#F9DFE8] text-[#647D69] flex items-center justify-center font-serif text-base font-bold mx-auto sm:mx-0">' + s.num + '</div>' +
        '<h3 class="font-serif font-bold text-[#302C2A] text-lg">' + s.title + '</h3>' +
        '<p class="text-xs text-[#6E6864] leading-relaxed">' + s.desc + '</p>' +
      '</div>';
    }).join('');

    return '' +
    '<section class="py-16 sm:py-20 bg-transparent border-b border-[#E5ECE6]/60 relative z-10" id="home-how-to-order">' +
      '<div class="max-w-6xl mx-auto px-6">' +
        '<div data-reveal class="text-center max-w-2xl mx-auto mb-12 space-y-2">' +
          '<span class="inline-block px-3.5 py-1 rounded-full bg-[#F9DFE8] text-[#526B57] text-xs font-bold tracking-wider uppercase">Simple &amp; Fast</span>' +
          '<h2 class="font-serif text-3xl sm:text-4xl font-bold text-[#302C2A] mt-1" aria-label="How to Order">' + wrapTypewriterText('How to Order') + '</h2>' +
          '<p class="text-[#6E6864] text-xs sm:text-sm">Four easy steps from selecting your blooms to doorstep delivery.</p>' +
        '</div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">' +
          cards +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* Section: Visit Our Atelier (Clean White Background) */
  function renderAtelierLocationSection() {
    var state = window.appState;
    var rules = window.SHOP_RULES;
    var info = {
      address: (state && state.getStoreAddress && state.getStoreAddress()) || (rules && rules.info && rules.info.address) || '128 Rosa Street, BGC, Taguig City, Metro Manila',
      hoursText: (rules && rules.info && rules.info.hoursText) || 'Monday – Sunday: 8:00 AM – 8:00 PM',
      phone: (state && state.getStorePhone && state.getStorePhone()) || (rules && rules.info && rules.info.phone) || '+63 9915309337',
      landline: '+63 (2) 8812-3456',
      email: (state && state.getStoreEmail && state.getStoreEmail()) || (rules && rules.info && rules.info.email) || 'concierge@umairaflorist.com'
    };

    return '' +
    '<section class="py-16 sm:py-20 bg-transparent border-t border-[#E5ECE6]/60 relative z-10" id="home-atelier">' +
      '<div class="max-w-6xl mx-auto px-6 space-y-10">' +
        '<div data-reveal class="text-center max-w-2xl mx-auto space-y-2">' +
          '<span class="inline-block px-3.5 py-1 rounded-full bg-[#F9DFE8] text-[#526B57] text-xs font-bold tracking-wider uppercase">Visit Us</span>' +
          '<h2 class="font-serif text-3xl sm:text-4xl font-bold text-[#302C2A] mt-1" aria-label="Our BGC Flower Shop">' + wrapTypewriterText('Our BGC Flower Shop') + '</h2>' +
          '<p class="text-[#6E6864] text-xs sm:text-sm">Drop by our shop to see our blooms in person or pick up your pre-ordered bouquet.</p>' +
        '</div>' +
        '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-xs text-[#6E6864]">' +
          '<div data-reveal data-tilt="3" class="atelier-card p-6 bg-[#FFF9F7] rounded-3xl border border-[#E5ECE6] shadow-2xs space-y-2">' +
            '<span class="w-9 h-9 rounded-xl bg-[#F9DFE8] text-[#647D69] flex items-center justify-center font-bold mb-2">' +
              '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>' +
            '</span>' +
            '<strong class="text-[#302C2A] block font-semibold text-sm">Shop Address</strong>' +
            '<p class="leading-relaxed store-address-val">' + info.address + '</p>' +
          '</div>' +
          '<div data-reveal data-tilt="3" class="atelier-card p-6 bg-[#FFF9F7] rounded-3xl border border-[#E5ECE6] shadow-2xs space-y-2">' +
            '<span class="w-9 h-9 rounded-xl bg-[#F9DFE8] text-[#647D69] flex items-center justify-center font-bold mb-2">' +
              '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
            '</span>' +
            '<strong class="text-[#302C2A] block font-semibold text-sm">Opening Hours</strong>' +
            '<p class="leading-relaxed store-hours-val">' + info.hoursText + '</p>' +
          '</div>' +
          '<div data-reveal data-tilt="3" class="atelier-card p-6 bg-[#FFF9F7] rounded-3xl border border-[#E5ECE6] shadow-2xs space-y-2">' +
            '<span class="w-9 h-9 rounded-xl bg-[#F9DFE8] text-[#647D69] flex items-center justify-center font-bold mb-2">' +
              '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>' +
            '</span>' +
            '<strong class="text-[#302C2A] block font-semibold text-sm">Contact Us</strong>' +
            '<p class="leading-relaxed"><a href="tel:' + info.phone + '" class="hover:text-[#647D69] transition store-phone-val">' + info.phone + '</a><br><a href="mailto:' + info.email + '" class="hover:text-[#647D69] transition store-email-val">' + info.email + '</a></p>' +
          '</div>' +
          '<div data-reveal data-tilt="3" class="atelier-card p-6 bg-[#FFF9F7] rounded-3xl border border-[#E5ECE6] shadow-2xs space-y-2">' +
            '<span class="w-9 h-9 rounded-xl bg-[#F9DFE8] text-[#647D69] flex items-center justify-center font-bold mb-2">' +
              '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>' +
            '</span>' +
            '<strong class="text-[#302C2A] block font-semibold text-sm">Store Pickup</strong>' +
            '<p class="leading-relaxed">Free pickup at our shop, ready within 2 hours of order confirmation.</p>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</section>';
  }

  /* =====================================================================
     BOTANICAL BUTTERFLIES & CURATED FLORAL COMBINATIONS PER PAGE
     ===================================================================== */

  function renderButterfly(posCls) {
    return '' +
      '<div class="botanical-butterfly ' + (posCls || '') + '" aria-hidden="true">' +
        '<svg class="butterfly-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<g class="butterfly-wing wing-left">' +
            '<path d="M32 28 C26 14, 10 12, 6 22 C3 30, 12 40, 28 35 Z" fill="url(#bf-grad-top)" opacity="0.9"/>' +
            '<path d="M30 35 C20 36, 12 46, 16 54 C20 60, 29 55, 32 40 Z" fill="url(#bf-grad-bot)" opacity="0.85"/>' +
            '<path d="M30 31 C22 22, 14 20, 10 24" stroke="#FFF9F5" stroke-width="0.8" opacity="0.6"/>' +
            '<path d="M30 33 C20 28, 14 32, 12 36" stroke="#FFF9F5" stroke-width="0.7" opacity="0.5"/>' +
            '<path d="M30 37 C24 42, 18 47, 18 52" stroke="#FFF9F5" stroke-width="0.7" opacity="0.5"/>' +
            '<circle cx="8" cy="22" r="1.2" fill="#FFF9F5" opacity="0.8"/>' +
            '<circle cx="12" cy="17" r="1" fill="#FFF9F5" opacity="0.8"/>' +
            '<circle cx="18" cy="14" r="1" fill="#FFF9F5" opacity="0.8"/>' +
          '</g>' +
          '<g class="butterfly-wing wing-right">' +
            '<path d="M32 28 C38 14, 54 12, 58 22 C61 30, 52 40, 36 35 Z" fill="url(#bf-grad-top)" opacity="0.9"/>' +
            '<path d="M34 35 C44 36, 52 46, 48 54 C44 60, 35 55, 32 40 Z" fill="url(#bf-grad-bot)" opacity="0.85"/>' +
            '<path d="M34 31 C42 22, 50 20, 54 24" stroke="#FFF9F5" stroke-width="0.8" opacity="0.6"/>' +
            '<path d="M34 33 C44 28, 50 32, 52 36" stroke="#FFF9F5" stroke-width="0.7" opacity="0.5"/>' +
            '<path d="M34 37 C40 42, 46 47, 46 52" stroke="#FFF9F5" stroke-width="0.7" opacity="0.5"/>' +
            '<circle cx="56" cy="22" r="1.2" fill="#FFF9F5" opacity="0.8"/>' +
            '<circle cx="52" cy="17" r="1" fill="#FFF9F5" opacity="0.8"/>' +
            '<circle cx="46" cy="14" r="1" fill="#FFF9F5" opacity="0.8"/>' +
          '</g>' +
          '<ellipse cx="32" cy="35" rx="1.6" ry="9" fill="#302C2A"/>' +
          '<circle cx="32" cy="24" r="2" fill="#302C2A"/>' +
          '<path d="M31 23 Q27 16 23 15" stroke="#302C2A" stroke-width="0.9" stroke-linecap="round"/>' +
          '<path d="M33 23 Q37 16 41 15" stroke="#302C2A" stroke-width="0.9" stroke-linecap="round"/>' +
          '<circle cx="23" cy="15" r="0.8" fill="#B88746"/>' +
          '<circle cx="41" cy="15" r="0.8" fill="#B88746"/>' +
          '<defs>' +
            '<linearGradient id="bf-grad-top" x1="0" y1="0" x2="1" y2="1">' +
              '<stop offset="0%" stop-color="#EAA6B8"/>' +
              '<stop offset="45%" stop-color="#D9822B"/>' +
              '<stop offset="100%" stop-color="#8E2D45"/>' +
            '</linearGradient>' +
            '<linearGradient id="bf-grad-bot" x1="0" y1="0" x2="1" y2="1">' +
              '<stop offset="0%" stop-color="#E89D71"/>' +
              '<stop offset="70%" stop-color="#B76E79"/>' +
              '<stop offset="100%" stop-color="#4A1E29"/>' +
            '</linearGradient>' +
          '</defs>' +
        '</svg>' +
      '</div>';
  }

  // Curated designer preset configurations (Available to restore anytime via the Floral Arranger)
  var ATELIER_DESIGNER_PRESETS = {
    home: {
      name: "The Atelier Grand Garden",
      corners: {
        tl: '/image/backgound/image-removebg-preview%20(1).png',
        tr: '/image/backgound/image-removebg-preview%20(2).png',
        bl: '/image/backgound/download.png',
        br: '/image/backgound/image-removebg-preview%20(8).png'
      },
      flanks: [
        { src: '/image/backgound/image-removebg-preview.png', cls: 'decor-side-hero-left' },
        { src: '/image/backgound/image-removebg-preview%20(4).png', cls: 'decor-side-atelier-right' },
        { src: '/image/backgound/image-removebg-preview%20(5).png', cls: 'decor-side-blooms-left' },
        { src: '/image/backgound/image-removebg-preview%20(7).png', cls: 'decor-side-occasion-left' },
        { src: '/image/backgound/image-removebg-preview%20(6).png', cls: 'decor-side-studio-right' },
        { src: '/image/backgound/background1.png', cls: 'decor-side-works-left' }
      ],
      butterflies: [
        { posCls: 'butterfly-pos-hero butterfly-drift-1' },
        { posCls: 'butterfly-pos-mid-left butterfly-drift-2' }
      ]
    },
    collections: {
      name: "The Fresh Bloom Market",
      corners: {
        tl: '/image/backgound/image-removebg-preview%20(1).png',
        tr: '/image/backgound/image-removebg-preview%20(7).png',
        bl: '/image/backgound/download.png',
        br: '/image/backgound/image-removebg-preview%20(5).png'
      },
      flanks: [
        { src: '/image/backgound/image-removebg-preview.png', cls: 'decor-flank-mid-left' },
        { src: '/image/backgound/image-removebg-preview%20(4).png', cls: 'decor-flank-mid-right' }
      ],
      butterflies: [
        { posCls: 'butterfly-pos-catalog-tr butterfly-drift-1' }
      ]
    },
    builder: {
      name: "The Florist Craft Studio",
      corners: {
        tl: '/image/backgound/image-removebg-preview%20(2).png',
        tr: '/image/backgound/image-removebg-preview%20(7).png',
        bl: '/image/backgound/background1.png',
        br: '/image/backgound/image-removebg-preview%20(8).png'
      },
      flanks: [
        { src: '/image/backgound/image-removebg-preview.png', cls: 'decor-flank-mid-left' },
        { src: '/image/backgound/image-removebg-preview%20(6).png', cls: 'decor-flank-mid-right' }
      ],
      butterflies: [
        { posCls: 'butterfly-pos-builder-tr butterfly-drift-2' }
      ]
    },
    cart: {
      name: "Blush & Peony Basket",
      corners: {
        tl: '',
        tr: '/image/backgound/image-removebg-preview%20(2).png',
        bl: '/image/backgound/download.png',
        br: '/image/backgound/image-removebg-preview%20(8).png'
      },
      flanks: [
        { src: '/image/backgound/image-removebg-preview%20(5).png', cls: 'decor-flank-mid-left' }
      ],
      butterflies: [
        { posCls: 'butterfly-pos-cart-tl butterfly-drift-1' }
      ]
    },
    checkout: {
      name: "Minimalist Atelier Olive & Ivory",
      corners: {
        tl: '/image/backgound/image-removebg-preview%20(7).png',
        tr: '/image/backgound/image-removebg-preview%20(2).png',
        bl: '/image/backgound/image-removebg-preview.png',
        br: '/image/backgound/download.png'
      },
      flanks: [
        ],
      butterflies: [
        { posCls: 'butterfly-pos-mid-right butterfly-drift-2' }
      ]
    },
    account: {
      name: "Botanical Heritage & Monogram",
      corners: {
        tl: '/image/backgound/image-removebg-preview%20(1).png',
        tr: '/image/backgound/image-removebg-preview%20(6).png',
        bl: '/image/backgound/background1.png',
        br: '/image/backgound/image-removebg-preview%20(8).png'
      },
      flanks: [
        ],
      butterflies: [
        { posCls: 'butterfly-pos-account-tr butterfly-drift-1' }
      ]
    },
    tracking: {
      name: "The Courier Garden Pathway",
      corners: {
        tl: '/image/backgound/image-removebg-preview.png',
        tr: '/image/backgound/image-removebg-preview%20(4).png',
        bl: '/image/backgound/download.png',
        br: '/image/backgound/image-removebg-preview%20(6).png'
      },
      flanks: [
        { src: '/image/backgound/image-removebg-preview%20(5).png', cls: 'decor-flank-mid-left' }
      ],
      butterflies: [
        { posCls: 'butterfly-pos-mid-right butterfly-drift-2' }
      ]
    },
    confirmation: {
      name: "Celebration of Blooms",
      corners: {
        tl: '/image/backgound/image-removebg-preview%20(1).png',
        tr: '/image/backgound/image-removebg-preview%20(8).png',
        bl: '/image/backgound/download.png',
        br: '/image/backgound/image-removebg-preview%20(5).png'
      },
      flanks: [
        { src: '/image/backgound/image-removebg-preview%20(7).png', cls: 'decor-flank-mid-left' }
      ],
      butterflies: [
        { posCls: 'butterfly-pos-hero butterfly-drift-1' }
      ]
    },
    auth: {
      name: "Quiet Atelier Entrance",
      corners: {
        tl: '/image/backgound/image-removebg-preview%20(2).png',
        tr: '',
        bl: '/image/backgound/image-removebg-preview.png',
        br: '/image/backgound/download.png'
      },
      flanks: [
        { src: '/image/backgound/image-removebg-preview%20(7).png', cls: 'decor-flank-mid-left' }
      ],
      butterflies: [
        { posCls: 'butterfly-pos-hero butterfly-drift-2' }
      ]
    },
    about: {
      name: "The Florist's Botanical Journal",
      corners: {
        tl: '/image/backgound/image-removebg-preview%20(1).png',
        tr: '/image/backgound/image-removebg-preview%20(2).png',
        bl: '/image/backgound/background1.png',
        br: '/image/backgound/image-removebg-preview%20(8).png'
      },
      flanks: [
        { src: '/image/backgound/image-removebg-preview%20(5).png', cls: 'decor-flank-mid-left' },
        ],
      butterflies: [
        { posCls: 'butterfly-pos-mid-left butterfly-drift-1' },
        { posCls: 'butterfly-pos-mid-right butterfly-drift-2' }
      ]
    },
    care: {
      name: "Preservation & Life",
      corners: {
        tl: '/image/backgound/image-removebg-preview%20(2).png',
        tr: '/image/backgound/image-removebg-preview%20(1).png',
        bl: '/image/backgound/download.png',
        br: '/image/backgound/image-removebg-preview%20(5).png'
      },
      flanks: [
        { src: '/image/backgound/background1.png', cls: 'decor-flank-mid-left' },
        { src: '/image/backgound/image-removebg-preview%20(6).png', cls: 'decor-flank-mid-right' }
      ],
      butterflies: [
        { posCls: 'butterfly-pos-hero butterfly-drift-1' }
      ]
    }
  };

  // Homepage has built-in corner + flank decorations; other pages remain blank for manual studio arrangement
  var BLANK_PAGE_CONFIGS = {
    home: {
      name: "Homepage",
      corners: { tl: '', tr: '', bl: '', br: '' },
      flanks: [],
      butterflies: []
    },
    account:      { name: "Account", corners: { tl: '', tr: '', bl: '', br: '' }, flanks: [], butterflies: [] },
    collections:  { name: "Collections", corners: { tl: '', tr: '', bl: '', br: '' }, flanks: [], butterflies: [] },
    builder:      { name: "Bouquet Studio", corners: { tl: '', tr: '', bl: '', br: '' }, flanks: [], butterflies: [] },
    cart:         { name: "Cart", corners: { tl: '', tr: '', bl: '', br: '' }, flanks: [], butterflies: [] },
    checkout:     { name: "Checkout", corners: { tl: '', tr: '', bl: '', br: '' }, flanks: [], butterflies: [] },
    tracking:     { name: "Tracking", corners: { tl: '', tr: '', bl: '', br: '' }, flanks: [], butterflies: [] },
    confirmation: { name: "Confirmation", corners: { tl: '', tr: '', bl: '', br: '' }, flanks: [], butterflies: [] },
    auth:         { name: "Auth", corners: { tl: '', tr: '', bl: '', br: '' }, flanks: [], butterflies: [] },
    about:        { name: "About", corners: { tl: '', tr: '', bl: '', br: '' }, flanks: [], butterflies: [] },
    care:         { name: "Care Guide", corners: { tl: '', tr: '', bl: '', br: '' }, flanks: [], butterflies: [] }
  };

  // Active configurations: start with completely clean canvas
  var PAGE_BOTANICAL_CONFIGS = JSON.parse(JSON.stringify(BLANK_PAGE_CONFIGS));

  // Clear legacy auto-decorations to guarantee a 100% clean canvas on initial load
  try {
    if (localStorage.getItem('umaira_clean_canvas_v2') !== 'true') {
      localStorage.removeItem('umaira_custom_botanical_configs');
      localStorage.setItem('umaira_clean_canvas_v2', 'true');
    } else {
      var savedArrangements = localStorage.getItem('umaira_custom_botanical_configs');
      if (savedArrangements) {
        var customMap = JSON.parse(savedArrangements);
        Object.keys(customMap).forEach(function (k) {
          if (PAGE_BOTANICAL_CONFIGS[k]) {
            if (customMap[k].corners) {
              PAGE_BOTANICAL_CONFIGS[k].corners = Object.assign({}, PAGE_BOTANICAL_CONFIGS[k].corners, customMap[k].corners);
            }
            if (customMap[k].flanks) {
              PAGE_BOTANICAL_CONFIGS[k].flanks = customMap[k].flanks;
            }
            if (customMap[k].butterflies) {
              PAGE_BOTANICAL_CONFIGS[k].butterflies = customMap[k].butterflies;
            }
          }
        });
      }
    }
  } catch (e) {}

  // Scrub the sunflower (image 3) from botanical configs loaded out of localStorage
  try {
    Object.keys(PAGE_BOTANICAL_CONFIGS).forEach(function (k) {
      var cfg = PAGE_BOTANICAL_CONFIGS[k];
      if (cfg.corners) {
        Object.keys(cfg.corners).forEach(function (pos) {
          if (isRemovedDecor(cfg.corners[pos])) cfg.corners[pos] = '';
        });
      }
      if (Array.isArray(cfg.flanks)) {
        cfg.flanks = cfg.flanks.filter(function (f) { return !isRemovedDecor(f && f.src); });
      }
    });
    // Persist the cleaned configs so the next load is already clean
    var savedArr2 = localStorage.getItem('umaira_custom_botanical_configs');
    if (savedArr2) {
      var cm2 = JSON.parse(savedArr2);
      var dirty = false;
      Object.keys(cm2).forEach(function (k) {
        if (cm2[k].corners) {
          Object.keys(cm2[k].corners).forEach(function (p) {
            if (isRemovedDecor(cm2[k].corners[p])) { cm2[k].corners[p] = ''; dirty = true; }
          });
        }
        if (Array.isArray(cm2[k].flanks)) {
          var before = cm2[k].flanks.length;
          cm2[k].flanks = cm2[k].flanks.filter(function (f) { return !isRemovedDecor(f && f.src); });
          if (cm2[k].flanks.length !== before) dirty = true;
        }
      });
      if (dirty) localStorage.setItem('umaira_custom_botanical_configs', JSON.stringify(cm2));
    }
  } catch (e) {}

  function renderCornerImg(src, cls, isHome) {
    if (!src || isRemovedDecor(src)) return '';
    var baseCls = isHome ? 'homepage-decor-img ' : 'customer-decor-img ';
    return '<img src="' + src + '" alt="" class="' + baseCls + cls + '" />';
  }

  function renderHomepageDecorations() {
    var cfg = (PAGE_BOTANICAL_CONFIGS && PAGE_BOTANICAL_CONFIGS.home) || {};
    var corners = '';
    if (cfg.corners) {
      corners += renderCornerImg(cfg.corners.tl, 'decor-corner-tl', true);
      corners += renderCornerImg(cfg.corners.tr, 'decor-corner-tr', true);
      corners += renderCornerImg(cfg.corners.bl, 'decor-corner-bl', true);
      corners += renderCornerImg(cfg.corners.br, 'decor-corner-br', true);
    }

    var flanks = (cfg.flanks || []).filter(function (f) { return f && f.src && !isRemovedDecor(f.src); }).map(function (f) {
      return '<img src="' + f.src + '" alt="" class="homepage-decor-img ' + f.cls + '" />';
    }).join('');

    var butterflies = (cfg.butterflies || []).filter(function (b) { return b && b.posCls; }).map(function (b) {
      return renderButterfly(b.posCls);
    }).join('');

    var freeform = renderFreeformDecorItems('home');

    if (!corners && !flanks && !butterflies && !freeform) {
      return '<div class="homepage-decor-wrapper" aria-hidden="true"></div>';
    }

    return '' +
      '<div class="homepage-decor-wrapper" aria-hidden="true">' +
        corners +
        flanks +
        butterflies +
        freeform +
      '</div>';
  }

  /* ---------------------------------------------------------------------
     Home, signed in: the customer's account at a glance (cart, latest order, builder, details).
     Values are filled from the existing app state by suHydrateMemberStrip (orders via appState.refreshOrders).
     --------------------------------------------------------------------- */
  var PT_ICON = {
    bag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
    truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>',
    flower: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="2.6"/><path d="M12 9.4C10 6 10.4 3 12 3s2 3 0 6.4M14.6 12c3.4-2 6.4-1.6 6.4 0s-3 2-6.4 0M12 14.6c2 3.4 1.6 6.4 0 6.4s-2-3 0-6.4M9.4 12C6 14 3 13.6 3 12s3-2 6.4 0"/></svg>',
    user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>'
  };
  window.PT_ICON = PT_ICON;

  function renderMemberStrip() {
    var st = window.appState;
    var u = (st && st.currentUser) || {};
    var first = String(u.name || '').trim().split(/\s+/)[0] || '';
    var tile = function (id, cls, go, onclick, icon, label, extra) {
      return '<button type="button" id="' + id + '" class="pt-mtile' + (cls ? ' ' + cls : '') + '" data-go="' + go + '" onclick="' + onclick + '">' +
        '<span class="pt-disc" aria-hidden="true">' + PT_ICON[icon] + '</span>' +
        '<span class="pt-mtile-label">' + label + '</span>' + extra +
      '</button>';
    };
    var goNav = "window.appRouter.navigate(this.getAttribute('data-go'))";
    return '' +
      '<section class="pt-mstrip" id="home-member" aria-label="Your account at a glance">' +
        '<div class="pt-member-head">' +
          '<div><span class="pt-kick">Your Umaira</span>' +
          '<h2 class="pt-member-title">Welcome back' + (first ? ', <em>' + cardEsc(first) + '</em>' : '') + '.</h2></div>' +
        '</div>' +
        '<div class="pt-member-grid">' +
          tile('pt-mtile-cart', 'is-ink', 'cart', goNav, 'bag', 'Your cart',
            '<span class="pt-mtile-value" data-slot="value">&nbsp;</span><span class="pt-mtile-meta" data-slot="meta"></span>' +
            '<span class="pt-mtile-go"><span data-slot="go">Review cart</span>' + PT_ICON.arrow + '</span>') +
          tile('pt-mtile-order', '', 'tracking', goNav, 'truck', 'Latest order',
            '<span class="pt-mtile-value" data-slot="value"><span class="pt-skel" aria-hidden="true"></span><span class="sr-only">Loading your latest order</span></span>' +
            '<span class="pt-mtile-meta" data-slot="meta"></span>' +
            '<span class="pt-mtile-go"><span data-slot="go">Track order</span>' + PT_ICON.arrow + '</span>') +
          tile('pt-mtile-builder', '', 'builder', goNav, 'flower', 'Design a bouquet',
            '<span class="pt-mtile-value">Build your own</span><span class="pt-mtile-meta">Choose the flowers, wrapping, ribbon and a card.</span>' +
            '<span class="pt-mtile-go"><span>Open the builder</span>' + PT_ICON.arrow + '</span>') +
          tile('pt-mtile-account', '', 'account', "window.appRouter.openAccount('profile')", 'user', 'Your details',
            '<span class="pt-mtile-value">' + cardEsc(u.name || 'My account') + '</span><span class="pt-mtile-meta">Name, mobile number and delivery address.</span>' +
            '<span class="pt-mtile-go"><span>Open my account</span>' + PT_ICON.arrow + '</span>') +
        '</div>' +
      '</section>';
  }

  var memberOrdersRequested = false;
  window.suHydrateMemberStrip = function () {
    var st = window.appState;
    if (!st || !st.isAuthenticated || !st.isAuthenticated()) return;
    var fmt = function (n) { return typeof formatCurrency === 'function' ? formatCurrency(n) : '₱' + Number(n || 0).toLocaleString(); };
    var set = function (tile, slot, html) { var el = tile && tile.querySelector('[data-slot="' + slot + '"]'); if (el) el.innerHTML = html; };

    var cart = document.getElementById('pt-mtile-cart');
    if (cart) {
      var n = st.getCartCount ? st.getCartCount() : 0;
      cart.setAttribute('data-go', n > 0 ? 'cart' : 'collections');
      set(cart, 'value', n > 0 ? n + ' item' + (n === 1 ? '' : 's') + ' &middot; ' + fmt(st.getCartSubtotal ? st.getCartSubtotal() : 0) : 'Your cart is empty');
      set(cart, 'meta', n > 0 ? 'Saved to your account, ready when you are.' : 'Find something lovely in our collections.');
      set(cart, 'go', n > 0 ? 'Review cart' : 'Browse collections');
    }

    var orderTile = document.getElementById('pt-mtile-order');
    if (!orderTile) return;
    if (!st.ordersLoaded && !st.ordersError) {
      if (!memberOrdersRequested && st.refreshOrders) {
        memberOrdersRequested = true;
        st.refreshOrders().catch(function () {}).then(function () { memberOrdersRequested = false; window.suHydrateMemberStrip(); });
      }
      return;
    }
    if (st.ordersError) {
      set(orderTile, 'value', 'Your orders');
      set(orderTile, 'meta', 'We could not load your latest order just now.');
      set(orderTile, 'go', 'Open order tracking');
      return;
    }
    var o = (st.orders || [])[0];
    if (!o) {
      orderTile.setAttribute('data-go', 'collections');
      set(orderTile, 'value', 'No orders yet');
      set(orderTile, 'meta', 'Your orders and their progress will appear here.');
      set(orderTile, 'go', 'Start shopping');
      return;
    }
    var s = String(o.status || 'Pending Confirmation');
    var tone = /Delivered — Confirmed|Picked Up|Completed/i.test(s) ? 'is-done'
      : /Rejected|Cancel|Disputed|Failed/i.test(s) ? 'is-issue'
      : /Pending|Awaiting/i.test(s) ? 'is-wait' : '';
    orderTile.setAttribute('data-go', 'tracking');
    set(orderTile, 'value', cardEsc(o.orderNumber || ''));
    set(orderTile, 'meta', '<span class="pt-status ' + tone + '">' + cardEsc(s) + '</span>' +
      (o.total ? ' <span>' + fmt(o.total) + (o.fulfillment ? ' &middot; ' + (o.fulfillment === 'pickup' ? 'Store pickup' : 'Delivery') : '') + '</span>' : ''));
    set(orderTile, 'go', 'Track order');
  };

  /* Home, guests: what an account adds, with gentle sign-in / create-account entry points */
  function renderGuestJoinSection() {
    var perk = function (icon, title, text) {
      return '<li data-reveal><span class="pt-disc" aria-hidden="true">' + PT_ICON[icon] + '</span><b>' + title + '</b><span>' + text + '</span></li>';
    };
    return '' +
      '<section class="pt-join" id="home-join" aria-label="Create an account">' +
        '<div class="pt-join-band" data-reveal>' +
          '<div>' +
            '<span class="pt-kick">Your Umaira account</span>' +
            '<h2 class="pt-join-title">Order in a few taps, <em>follow every bloom.</em></h2>' +
            '<p class="pt-join-lede">Browse as long as you like. When you are ready to order, an account keeps your cart, your address and your orders in one place.</p>' +
            '<div class="pt-join-ctas">' +
              '<button type="button" onclick="window.appRouter.navigate(\'signup\')" class="pt-btn pt-btn-prism">Create account</button>' +
              '<button type="button" onclick="window.appRouter.navigate(\'signin\')" class="pt-btn pt-btn-glass">I already have one</button>' +
            '</div>' +
          '</div>' +
          '<ul class="pt-join-perks">' +
            perk('bag', 'Delivery or pickup', 'Order for delivery across the City of Manila, or pick up at the shop.') +
            perk('flower', 'Your own designs', 'Bouquets you build go straight into your cart.') +
            perk('truck', 'Every step, live', 'Follow each order from confirmed to delivered.') +
            perk('user', 'Remembered for you', 'Your cart and delivery address stay with your account.') +
          '</ul>' +
        '</div>' +
      '</section>';
  }

  function renderHomeView() {
    var isAuth = Boolean(window.appState && window.appState.isAuthenticated && window.appState.isAuthenticated());
    return '' +
      '<div class="homepage-canvas relative overflow-x-hidden bg-[#FAF6F0] w-full min-h-screen">' +
        renderHomepageDecorations() +
        '<div class="homepage-content-layer relative z-10 w-full">' +
          renderHero() +
          (isAuth ? renderMemberStrip() : '') +
          renderShopByOccasionSection() +
          renderFeaturedFlowersSection() +
          (isAuth ? '' : renderGuestJoinSection()) +
          renderWhyChooseUsSection() +
          renderHowToOrderSection() +
          renderAtelierLocationSection() +
        '</div>' +
      '</div>';
  }

  function renderCustomerPageDecor(view) {
    var normView = view || 'collections';
    if (normView === 'flowers' || normView === 'occasions') normView = 'collections';
    if (normView === 'care-guide' || normView === 'guide' || normView === 'florist-guide') normView = 'care';
    if (normView === 'signin' || normView === 'signup') normView = 'auth';

    var cfg = (PAGE_BOTANICAL_CONFIGS && PAGE_BOTANICAL_CONFIGS[normView]) || {};

    var corners = '';
    if (cfg.corners) {
      corners += renderCornerImg(cfg.corners.tl, 'decor-corner-tl', false);
      corners += renderCornerImg(cfg.corners.tr, 'decor-corner-tr', false);
      corners += renderCornerImg(cfg.corners.bl, 'decor-corner-bl', false);
      corners += renderCornerImg(cfg.corners.br, 'decor-corner-br', false);
    }

    var flanks = (cfg.flanks || []).filter(function (f) { return f && f.src && !isRemovedDecor(f.src); }).map(function (f) {
      return '<img src="' + f.src + '" alt="" class="customer-decor-img ' + f.cls + '" />';
    }).join('');

    var butterflies = (cfg.butterflies || []).filter(function (b) { return b && b.posCls; }).map(function (b) {
      return renderButterfly(b.posCls);
    }).join('');

    var freeform = renderFreeformDecorItems(normView);

    if (!corners && !flanks && !butterflies && !freeform) {
      return '<div class="customer-decor-wrapper" aria-hidden="true"></div>';
    }

    return '<div class="customer-decor-wrapper" aria-hidden="true">' + corners + flanks + butterflies + freeform + '</div>';
  }

  function wrapCustomerViewWithDecor(view, innerHtml) {
    if (!innerHtml) return '';
    if (innerHtml.indexOf('homepage-canvas') !== -1 || innerHtml.indexOf('customer-page-canvas') !== -1) {
      return innerHtml;
    }
    return '' +
      '<div class="customer-page-canvas relative overflow-x-hidden bg-[#FAF6F0] w-full min-h-screen" data-page-view="' + (view || '') + '">' +
        renderCustomerPageDecor(view) +
        '<div class="customer-page-content relative z-10 w-full">' +
          innerHtml +
        '</div>' +
      '</div>';
  }

  // Safe decorative arrangement shuffle (purely updates background visual composition, never touches store state or products)
  window.suShuffleFloralPalette = function () {
    var views = Object.keys(PAGE_BOTANICAL_CONFIGS).filter(function (k) { return k !== 'home'; });
    var cur = (window.appRouter && window.appRouter.currentView) || 'collections';
    var canvas = document.querySelector('.customer-page-canvas');
    if (!canvas) return;

    var currentWrapper = canvas.querySelector('.customer-decor-wrapper');
    if (!currentWrapper) return;

    // Pick an alternative decorative combination from another complementary view
    var others = views.filter(function (v) { return v !== cur; });
    var randomAlt = others[Math.floor(Math.random() * others.length)];
    currentWrapper.outerHTML = renderCustomerPageDecor(randomAlt);
  };

  window.renderButterfly = renderButterfly;
  window.PAGE_BOTANICAL_CONFIGS = PAGE_BOTANICAL_CONFIGS;
  window.renderCustomerPageDecor = renderCustomerPageDecor;
  window.wrapCustomerViewWithDecor = wrapCustomerViewWithDecor;

  /* =====================================================================
     4B. ATELIER FLORAL DESIGN STUDIO — DIRECT MANIPULATION GRAPHIC TOOL
     Allows manual dragging, rotating, resizing, layering, duplicating,
     and deleting of every floral illustration across all customer pages.
     ===================================================================== */
  var BOTANICAL_FLOWERS = [
    { id: '1', num: 1, name: 'Arching Roses & Foliage', file: 'image-removebg-preview (1).png', src: '/image/backgound/image-removebg-preview%20(1).png', desc: 'Curving blush roses with eucalyptus foliage' },
    { id: '2', num: 2, name: 'Delicate Top Leafy Branch', file: 'image-removebg-preview (2).png', src: '/image/backgound/image-removebg-preview%20(2).png', desc: 'High-arching branch with gentle white-pink blossoms' },
    { id: '4', num: 4, name: 'Tall Blooming Wildflowers', file: 'image-removebg-preview (4).png', src: '/image/backgound/image-removebg-preview%20(4).png', desc: 'Upright botanical spray with lilac buds' },
    { id: '5', num: 5, name: 'Rose & Eucalyptus Bouquet', file: 'image-removebg-preview (5).png', src: '/image/backgound/image-removebg-preview%20(5).png', desc: 'Hand-crafted rose bouquet with silver dollar eucalyptus' },
    { id: '6', num: 6, name: 'Artisan Blossom Branch', file: 'image-removebg-preview (6).png', src: '/image/backgound/image-removebg-preview%20(6).png', desc: 'Spreading blossom branch with pink spring petals' },
    { id: '7', num: 7, name: 'Petite Delicate Florets Sprig', file: 'image-removebg-preview (7).png', src: '/image/backgound/image-removebg-preview%20(7).png', desc: 'Airy, minimalist sprig of dainty florets' },
    { id: '8', num: 8, name: 'Grand Celebratory Bouquet', file: 'image-removebg-preview (8).png', src: '/image/backgound/image-removebg-preview%20(8).png', desc: 'Full, lush celebratory floral arrangement' },
    { id: '9', num: 9, name: 'Slender Vertical Botanical Stem', file: 'image-removebg-preview.png', src: '/image/backgound/image-removebg-preview.png', desc: 'Minimalist vertical greenery stem' },
    { id: '10', num: 10, name: 'Botanical Leaf Flourish', file: 'background1.png', src: '/image/backgound/background1.png', desc: 'Curving organic garden foliage flourish' },
    { id: '11', num: 11, name: 'Grounding Watercolor Blooms', file: 'download.png', src: '/image/backgound/download.png', desc: 'Soft grounding watercolor pastel bouquet' }
  ];

  // Fetches images from the server and merges any new ones into BOTANICAL_FLOWERS
  function syncDecorationLibrary(callback) {
    try {
      var existingFiles = {};
      BOTANICAL_FLOWERS.forEach(function (f) { existingFiles[f.file] = true; });
      fetch('/api/decoration-images').then(function (r) {
        return r.ok ? r.json() : null;
      }).then(function (data) {
        if (data && Array.isArray(data.images)) {
          data.images.filter(function (img) { return !existingFiles[img.name] && !isRemovedDecor(img.url); }).forEach(function (img) {
            var base = img.name.replace(/\.[^.]+$/, '').replace(/[-_()]/g, ' ').replace(/\s+/g, ' ').trim();
            BOTANICAL_FLOWERS.push({
              id: 'dyn_' + BOTANICAL_FLOWERS.length,
              num: BOTANICAL_FLOWERS.length + 1,
              name: base || img.name,
              file: img.name,
              src: img.url,
              desc: 'Decoration image'
            });
          });
        }
        if (typeof callback === 'function') callback();
      }).catch(function () { if (typeof callback === 'function') callback(); });
    } catch (e) { if (typeof callback === 'function') callback(); }
  }

  // Posts the current page's decoration list to the server (requires admin token in storage)
  function syncDecorationsToServer(pageKey) {
    try {
      var adminToken = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('umaira_admin_token') : null)
        || localStorage.getItem('umaira_admin_token');
      if (!adminToken) return;
      var flowers = getPageFlowers(pageKey);
      fetch('/api/admin/decorations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Token': adminToken },
        body: JSON.stringify({ page: pageKey || studioState.page, decorations: flowers })
      }).catch(function () {});
    } catch (e) {}
  }

  var STUDIO_PAGES = [
    { id: 'home', label: 'Homepage (Overview)' },
    { id: 'account', label: 'Account (Hello, ANGEL)' },
    { id: 'collections', label: 'Fresh Bloom Market' },
    { id: 'builder', label: 'Bouquet Studio' },
    { id: 'cart', label: 'Shopping Cart' },
    { id: 'checkout', label: 'Checkout' },
    { id: 'tracking', label: 'Order Tracking' },
    { id: 'confirmation', label: 'Confirmation' },
    { id: 'auth', label: 'Login / Register' },
    { id: 'care', label: 'Flower Care Guide' }
  ];

  var PAGE_FREEFORM_FLOWERS = {
    home: [],
    account: [],
    collections: [],
    builder: [],
    cart: [],
    checkout: [],
    tracking: [],
    confirmation: [],
    auth: [],
    care: [],
    about: []
  };

  // Load freeform flowers from localStorage (immediate fallback)
  try {
    var savedFreeform = localStorage.getItem('umaira_freeform_decorations');
    if (savedFreeform) {
      var parsedFreeform = JSON.parse(savedFreeform);
      Object.keys(parsedFreeform).forEach(function (k) {
        if (Array.isArray(parsedFreeform[k])) {
          PAGE_FREEFORM_FLOWERS[k] = parsedFreeform[k];
        }
      });
    }
  } catch (e) {}

  // Also load server-saved decorations (overrides localStorage when present) and sync image library
  try {
    fetch('/api/decorations').then(function (r) {
      return r.ok ? r.json() : null;
    }).then(function (data) {
      if (data && data.decorations) {
        Object.keys(data.decorations).forEach(function (k) {
          if (Array.isArray(data.decorations[k])) {
            // Empty array explicitly clears the page (overrides localStorage)
            PAGE_FREEFORM_FLOWERS[k] = data.decorations[k].filter(function (f) { return !isRemovedDecor(f && f.src); });
          }
        });
        refreshActivePageDecor();
      }
    }).catch(function () {});
  } catch (e) {}

  // Sync the decoration image library from server on startup
  syncDecorationLibrary(null);

  // Sunflower illustration permanently removed from all decorations
  function isRemovedDecor(src) { return /removebg-preview(%20|\s)\(3\)\.png/i.test(String(src || '')); }
  Object.keys(PAGE_FREEFORM_FLOWERS).forEach(function (k) {
    PAGE_FREEFORM_FLOWERS[k] = (PAGE_FREEFORM_FLOWERS[k] || []).filter(function (f) { return !isRemovedDecor(f && f.src); });
  });
  try { localStorage.setItem('umaira_freeform_decorations', JSON.stringify(PAGE_FREEFORM_FLOWERS)); } catch (e) {}

  function renderFreeformDecorItems(view) {
    var normView = view || 'collections';
    if (normView === 'flowers' || normView === 'occasions') normView = 'collections';
    if (normView === 'care-guide' || normView === 'guide' || normView === 'florist-guide') normView = 'care';
    if (normView === 'signin' || normView === 'signup') normView = 'auth';

    var list = ((PAGE_FREEFORM_FLOWERS && PAGE_FREEFORM_FLOWERS[normView]) || []).filter(function (f) { return !isRemovedDecor(f && f.src); });
    if (!list.length) return '';
    return list.map(function (f) {
      var op = (f.opacity !== undefined && f.opacity !== null) ? f.opacity : 0.65;
      var rot = (f.rotation !== undefined && f.rotation !== null) ? f.rotation : 0;
      var w = f.width || 240;
      var z = f.zIndex || 1;
      return '<img src="' + f.src + '" alt="" class="freeform-decor-item" style="' +
        'position: absolute; ' +
        'left: ' + f.x + '%; ' +
        'top: ' + f.y + '%; ' +
        'width: ' + w + 'px; ' +
        'transform: translate(-50%, -50%) rotate(' + rot + 'deg); ' +
        'opacity: ' + op + '; ' +
        'z-index: ' + z + '; ' +
        'pointer-events: none; user-select: none; object-fit: contain; max-width: none;' +
      '" />';
    }).join('');
  }

  function refreshActivePageDecor() {
    var cur = (window.appRouter && window.appRouter.currentView) || 'home';
    if (cur === 'home') {
      var homeWrapper = document.querySelector('.homepage-decor-wrapper');
      if (homeWrapper) homeWrapper.outerHTML = renderHomepageDecorations();
    } else {
      var canvas = document.querySelector('.customer-page-canvas');
      if (canvas) {
        var custWrapper = canvas.querySelector('.customer-decor-wrapper');
        if (custWrapper) custWrapper.outerHTML = renderCustomerPageDecor(cur);
      }
    }
  }

  // ── STUDIO STATE & INTERACTION ENGINE ─────────────────────────────────────
  var studioState = {
    page: 'home',
    activeFlowerId: null,
    isInteracting: false,
    interactionType: null, // 'move' | 'resize' | 'rotate'
    resizeHandle: null,
    startMouseX: 0,
    startMouseY: 0,
    startFlowerX: 0,
    startFlowerY: 0,
    startFlowerW: 240,
    startDist: 0,
    centerClientX: 0,
    centerClientY: 0
  };

  function getPageFlowers(page) {
    var p = page || studioState.page;
    if (!PAGE_FREEFORM_FLOWERS[p]) PAGE_FREEFORM_FLOWERS[p] = [];
    return PAGE_FREEFORM_FLOWERS[p];
  }

  function getActiveStudioFlower() {
    var list = getPageFlowers();
    return list.find(function (f) { return f.id === studioState.activeFlowerId; }) || null;
  }

  // Page Mockup Wireframes for Artboard Reference
  function getStudioPageWireframe(pageKey) {
    if (pageKey === 'account') {
      return '' +
        '<div class="p-8 max-w-4xl mx-auto space-y-6 select-none opacity-40">' +
          '<div class="flex items-center justify-between border-b border-stone-300 pb-4">' +
            '<div>' +
              '<h2 class="font-serif text-3xl font-bold text-stone-800">Hello, ANGEL</h2>' +
              '<p class="text-xs text-stone-500 mt-1">Google Account &bull; Member since Nov 2026</p>' +
            '</div>' +
            '<div class="flex gap-2">' +
              '<div class="px-4 py-1.5 rounded-xl bg-white border border-stone-300 text-xs font-bold text-stone-800">Profile Details</div>' +
              '<div class="px-4 py-1.5 rounded-xl bg-stone-100 text-xs text-stone-500">Order History</div>' +
            '</div>' +
          '</div>' +
          '<div class="grid grid-cols-2 gap-6">' +
            '<div class="p-5 rounded-2xl bg-white border border-stone-200 space-y-3">' +
              '<div class="h-3 w-32 bg-stone-200 rounded"></div>' +
              '<div class="h-8 bg-stone-100 rounded-xl"></div>' +
              '<div class="h-8 bg-stone-100 rounded-xl"></div>' +
              '<div class="h-8 bg-stone-100 rounded-xl"></div>' +
            '</div>' +
            '<div class="p-5 rounded-2xl bg-white border border-stone-200 space-y-3">' +
              '<div class="h-3 w-36 bg-stone-200 rounded"></div>' +
              '<div class="h-20 bg-stone-50 rounded-xl border border-dashed border-stone-200"></div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }

    if (pageKey === 'collections') {
      return '' +
        '<div class="p-8 max-w-4xl mx-auto space-y-6 select-none opacity-40">' +
          '<div class="text-center space-y-2">' +
            '<span class="text-[10px] uppercase font-bold tracking-widest text-[#647D69]">FRESH BLOOM MARKET</span>' +
            '<h2 class="font-serif text-3xl font-bold text-stone-800">Handcrafted Floral Collections</h2>' +
            '<div class="flex justify-center gap-2 pt-2">' +
              '<span class="px-3 py-1 rounded-full bg-[#647D69] text-white text-xs">All Bouquets</span>' +
              '<span class="px-3 py-1 rounded-full bg-white border border-stone-200 text-stone-600 text-xs">Best Sellers</span>' +
              '<span class="px-3 py-1 rounded-full bg-white border border-stone-200 text-stone-600 text-xs">Romance</span>' +
            '</div>' +
          '</div>' +
          '<div class="grid grid-cols-3 gap-4 pt-2">' +
            '<div class="h-44 bg-white rounded-2xl border border-stone-200 p-3 space-y-2"><div class="h-24 bg-stone-100 rounded-xl"></div><div class="h-3 w-20 bg-stone-200 rounded"></div></div>' +
            '<div class="h-44 bg-white rounded-2xl border border-stone-200 p-3 space-y-2"><div class="h-24 bg-stone-100 rounded-xl"></div><div class="h-3 w-20 bg-stone-200 rounded"></div></div>' +
            '<div class="h-44 bg-white rounded-2xl border border-stone-200 p-3 space-y-2"><div class="h-24 bg-stone-100 rounded-xl"></div><div class="h-3 w-20 bg-stone-200 rounded"></div></div>' +
          '</div>' +
        '</div>';
    }

    if (pageKey === 'builder') {
      return '' +
        '<div class="p-8 max-w-4xl mx-auto space-y-6 select-none opacity-40">' +
          '<div class="text-center space-y-1">' +
            '<span class="text-[10px] uppercase font-bold tracking-widest text-[#647D69]">CUSTOM BOUQUET STUDIO</span>' +
            '<h2 class="font-serif text-2xl font-bold text-stone-800">Compose Your Bespoke Arrangement</h2>' +
          '</div>' +
          '<div class="h-60 bg-white rounded-3xl border border-stone-200 flex items-center justify-center">' +
            '<div class="w-20 h-40 border-2 border-dashed border-stone-300 rounded-b-3xl"></div>' +
          '</div>' +
        '</div>';
    }

    if (pageKey === 'cart' || pageKey === 'checkout') {
      return '' +
        '<div class="p-8 max-w-4xl mx-auto space-y-6 select-none opacity-40">' +
          '<h2 class="font-serif text-2xl font-bold text-stone-800">' + (pageKey === 'cart' ? 'Your Atelier Basket' : 'Checkout & Delivery') + '</h2>' +
          '<div class="grid grid-cols-3 gap-6">' +
            '<div class="col-span-2 h-52 bg-white rounded-2xl border border-stone-200 p-4 space-y-3"><div class="h-10 bg-stone-100 rounded-xl"></div><div class="h-10 bg-stone-100 rounded-xl"></div></div>' +
            '<div class="h-52 bg-white rounded-2xl border border-stone-200 p-4 space-y-3"><div class="h-6 bg-stone-100 rounded"></div><div class="h-10 bg-[#647D69]/20 rounded-xl"></div></div>' +
          '</div>' +
        '</div>';
    }

    // Default / Homepage wireframe
    return '' +
      '<div class="p-8 max-w-4xl mx-auto space-y-8 select-none opacity-40">' +
        '<div class="text-center space-y-2 pt-4">' +
          '<span class="text-[10px] uppercase font-bold tracking-widest text-[#647D69]">UMAIRA FLORIST &bull; BOTANICAL ATELIER</span>' +
          '<h1 class="font-serif text-3xl sm:text-4xl font-bold text-stone-800">Flowers, <em>thoughtfully made.</em></h1>' +
          '<p class="text-xs text-stone-500 max-w-md mx-auto">Handcrafted bouquets and single stems sourced daily with same-day Manila delivery.</p>' +
          '<div class="flex justify-center gap-2 pt-2">' +
            '<span class="px-4 py-2 rounded-xl bg-[#647D69] text-white text-xs font-bold">Explore Collections</span>' +
            '<span class="px-4 py-2 rounded-xl bg-white border border-stone-300 text-stone-700 text-xs font-bold">Build Your Bouquet</span>' +
          '</div>' +
        '</div>' +
        '<div class="space-y-3 pt-2">' +
          '<div class="flex items-center justify-between"><span class="font-serif font-bold text-sm text-stone-700">Shop by Occasion</span><span class="text-xs text-[#647D69]">View All &rarr;</span></div>' +
          '<div class="grid grid-cols-4 gap-3">' +
            '<div class="h-20 bg-white rounded-2xl border border-stone-200 p-2.5 space-y-1"><div class="w-6 h-6 rounded-lg bg-pink-100"></div><div class="h-2.5 w-12 bg-stone-200 rounded"></div></div>' +
            '<div class="h-20 bg-white rounded-2xl border border-stone-200 p-2.5 space-y-1"><div class="w-6 h-6 rounded-lg bg-pink-100"></div><div class="h-2.5 w-12 bg-stone-200 rounded"></div></div>' +
            '<div class="h-20 bg-white rounded-2xl border border-stone-200 p-2.5 space-y-1"><div class="w-6 h-6 rounded-lg bg-pink-100"></div><div class="h-2.5 w-12 bg-stone-200 rounded"></div></div>' +
            '<div class="h-20 bg-white rounded-2xl border border-stone-200 p-2.5 space-y-1"><div class="w-6 h-6 rounded-lg bg-pink-100"></div><div class="h-2.5 w-12 bg-stone-200 rounded"></div></div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function renderStudioFlowersHtml() {
    var flowers = getPageFlowers();
    return flowers.map(function (f) {
      var isSel = f.id === studioState.activeFlowerId;
      var rot = f.rotation || 0;
      var op = (f.opacity !== undefined && f.opacity !== null) ? f.opacity : 0.50;
      var w = f.width || 240;
      var z = f.zIndex || 10;

      var handlesHtml = '';
      if (isSel) {
        handlesHtml = '' +
          '<div class="studio-resize-handle studio-handle-nw" data-handle="nw"></div>' +
          '<div class="studio-resize-handle studio-handle-ne" data-handle="ne"></div>' +
          '<div class="studio-resize-handle studio-handle-sw" data-handle="sw"></div>' +
          '<div class="studio-resize-handle studio-handle-se" data-handle="se"></div>' +
          '<div class="studio-rotation-stem"></div>' +
          '<div class="studio-rotation-knob" title="Drag to rotate flower"></div>';
      }

      return '' +
        '<div id="studio-flower-' + f.id + '" ' +
          'class="studio-flower-wrapper ' + (isSel ? 'is-selected' : '') + '" ' +
          'data-id="' + f.id + '" ' +
          'style="' +
            'left: ' + f.x + '%; ' +
            'top: ' + f.y + '%; ' +
            'width: ' + w + 'px; ' +
            'transform: translate(-50%, -50%) rotate(' + rot + 'deg); ' +
            'opacity: ' + op + '; ' +
            'z-index: ' + z + ';' +
          '">' +
          '<img src="' + f.src + '" alt="' + f.name + '" class="w-full h-auto object-contain pointer-events-none select-none" />' +
          handlesHtml +
        '</div>';
    }).join('');
  }

  function renderStudioInspectorHtml() {
    var flower = getActiveStudioFlower();
    var flowers = getPageFlowers();

    if (!flower) {
      return '' +
        '<div class="p-6 text-center space-y-4 text-stone-500">' +
          '<div class="w-14 h-14 rounded-2xl bg-[#FAF6F0] border border-[#E5ECE6] mx-auto flex items-center justify-center text-2xl shadow-2xs">🌸</div>' +
          '<div>' +
            '<h4 class="font-serif font-bold text-stone-800 text-sm">No Flower Selected</h4>' +
            '<p class="text-xs text-stone-500 mt-1 leading-relaxed">Click any flower on the canvas to move, rotate, resize, or adjust layers. Or choose a flower from the library on the left to add it.</p>' +
          '</div>' +
          '<div class="p-3 bg-[#FAF6F0] rounded-xl text-left border border-[#E5ECE6] space-y-1 text-[11px] text-stone-600">' +
            '<p class="font-bold text-[#647D69]">💡 Direct Manipulation Controls:</p>' +
            '<p>&bull; <strong>Drag:</strong> Move flower anywhere on canvas</p>' +
            '<p>&bull; <strong>Corner Handles:</strong> Drag to scale & resize</p>' +
            '<p>&bull; <strong>Top Knob:</strong> Drag around center to rotate</p>' +
            '<p>&bull; <strong>Delete / Backspace:</strong> Delete flower</p>' +
          '</div>' +
        '</div>';
    }

    var rot = flower.rotation || 0;
    var w = flower.width || 240;
    var opPct = Math.round(((flower.opacity !== undefined ? flower.opacity : 0.50)) * 100);

    return '' +
      '<div class="p-5 space-y-5">' +
        '<!-- Selected Flower Info -->' +
        '<div class="flex items-center gap-3 pb-3 border-b border-[#E5ECE6]">' +
          '<div class="w-12 h-12 rounded-xl bg-[#FAF6F0] border border-[#E5ECE6] p-1 flex items-center justify-center shrink-0">' +
            '<img src="' + flower.src + '" alt="" class="max-h-full max-w-full object-contain" />' +
          '</div>' +
          '<div class="overflow-hidden">' +
            '<h4 class="font-serif font-bold text-stone-900 text-xs truncate">' + flower.name + '</h4>' +
            '<p class="text-[10px] font-mono text-stone-400 truncate mt-0.5">' + flower.file + '</p>' +
          '</div>' +
        '</div>' +

        '<!-- Size Control -->' +
        '<div>' +
          '<div class="flex items-center justify-between text-xs font-bold text-stone-700 mb-1.5">' +
            '<label>Size (Width)</label>' +
            '<span class="font-mono text-stone-500">' + w + 'px</span>' +
          '</div>' +
          '<input type="range" min="60" max="600" step="2" value="' + w + '" ' +
            'oninput="window.suUpdateActiveFlowerProp(\'width\', parseInt(this.value, 10))" ' +
            'class="w-full accent-[#647D69] cursor-pointer" />' +
        '</div>' +

        '<!-- Rotation Control -->' +
        '<div>' +
          '<div class="flex items-center justify-between text-xs font-bold text-stone-700 mb-1.5">' +
            '<label>Rotation Angle</label>' +
            '<span class="font-mono text-stone-500">' + rot + '&deg;</span>' +
          '</div>' +
          '<input type="range" min="-180" max="180" step="1" value="' + rot + '" ' +
            'oninput="window.suUpdateActiveFlowerProp(\'rotation\', parseInt(this.value, 10))" ' +
            'class="w-full accent-[#B76E79] cursor-pointer" />' +
          '<div class="grid grid-cols-4 gap-1 mt-2">' +
            '<button type="button" onclick="window.suUpdateActiveFlowerProp(\'rotation\', ' + (rot - 90) + ')" class="py-1 px-1.5 text-[10px] rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold">&minus;90&deg;</button>' +
            '<button type="button" onclick="window.suUpdateActiveFlowerProp(\'rotation\', 0)" class="py-1 px-1.5 text-[10px] rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold">0&deg;</button>' +
            '<button type="button" onclick="window.suUpdateActiveFlowerProp(\'rotation\', ' + (rot + 90) + ')" class="py-1 px-1.5 text-[10px] rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold">+90&deg;</button>' +
            '<button type="button" onclick="window.suUpdateActiveFlowerProp(\'rotation\', ' + (rot + 180) + ')" class="py-1 px-1.5 text-[10px] rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold">180&deg;</button>' +
          '</div>' +
        '</div>' +

        '<!-- Position Coordinates -->' +
        '<div class="space-y-2">' +
          '<label class="block text-xs font-bold text-stone-700">Position (% of page)</label>' +
          '<div class="grid grid-cols-2 gap-2">' +
            '<div>' +
              '<span class="text-[10px] text-stone-500 block mb-0.5">Horizontal (X)</span>' +
              '<input type="number" min="0" max="100" step="1" value="' + Math.round(flower.x) + '" ' +
                'oninput="window.suUpdateActiveFlowerProp(\'x\', parseFloat(this.value))" ' +
                'class="w-full p-1.5 text-xs rounded-lg border border-stone-300 font-mono" />' +
            '</div>' +
            '<div>' +
              '<span class="text-[10px] text-stone-500 block mb-0.5">Vertical (Y)</span>' +
              '<input type="number" min="0" max="100" step="1" value="' + Math.round(flower.y) + '" ' +
                'oninput="window.suUpdateActiveFlowerProp(\'y\', parseFloat(this.value))" ' +
                'class="w-full p-1.5 text-xs rounded-lg border border-stone-300 font-mono" />' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<!-- Opacity Control -->' +
        '<div>' +
          '<div class="flex items-center justify-between text-xs font-bold text-stone-700 mb-1.5">' +
            '<label>Opacity</label>' +
            '<span class="font-mono text-stone-500">' + opPct + '%</span>' +
          '</div>' +
          '<input type="range" min="10" max="100" step="5" value="' + opPct + '" ' +
            'oninput="window.suUpdateActiveFlowerProp(\'opacity\', parseInt(this.value, 10) / 100)" ' +
            'class="w-full accent-[#647D69] cursor-pointer" />' +
        '</div>' +

        '<!-- Layer Order Controls -->' +
        '<div>' +
          '<label class="block text-xs font-bold text-stone-700 mb-1.5">Layer Arrangement</label>' +
          '<div class="grid grid-cols-2 gap-1.5">' +
            '<button type="button" onclick="window.suAdjustActiveFlowerLayer(\'forward\')" class="py-1.5 px-2 text-xs rounded-xl border border-stone-200 hover:bg-stone-100 font-semibold text-stone-700 flex items-center justify-center gap-1 shadow-2xs">' +
              '<span>&uarr; Forward</span>' +
            '</button>' +
            '<button type="button" onclick="window.suAdjustActiveFlowerLayer(\'backward\')" class="py-1.5 px-2 text-xs rounded-xl border border-stone-200 hover:bg-stone-100 font-semibold text-stone-700 flex items-center justify-center gap-1 shadow-2xs">' +
              '<span>&darr; Backward</span>' +
            '</button>' +
            '<button type="button" onclick="window.suAdjustActiveFlowerLayer(\'front\')" class="py-1.5 px-2 text-[11px] rounded-xl border border-stone-200 hover:bg-stone-100 font-semibold text-stone-700 flex items-center justify-center gap-1 shadow-2xs">' +
              '<span>Bring to Front</span>' +
            '</button>' +
            '<button type="button" onclick="window.suAdjustActiveFlowerLayer(\'back\')" class="py-1.5 px-2 text-[11px] rounded-xl border border-stone-200 hover:bg-stone-100 font-semibold text-stone-700 flex items-center justify-center gap-1 shadow-2xs">' +
              '<span>Send to Back</span>' +
            '</button>' +
          '</div>' +
        '</div>' +

        '<!-- Action Buttons: Duplicate & Delete -->' +
        '<div class="pt-3 border-t border-[#E5ECE6] space-y-2">' +
          '<button type="button" onclick="window.suDuplicateActiveFlower()" class="w-full py-2 px-3 rounded-xl border border-[#647D69] bg-[#EBF1EC] hover:bg-[#647D69] text-[#526B57] hover:text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-2xs">' +
            '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>' +
            '<span>Duplicate Flower (Ctrl+D)</span>' +
          '</button>' +
          '<button type="button" onclick="window.suDeleteActiveFlower()" class="w-full py-2 px-3 rounded-xl border border-red-200 bg-red-50 hover:bg-red-600 text-red-700 hover:text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-2xs">' +
            '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>' +
            '<span>Delete Flower (Del)</span>' +
          '</button>' +
        '</div>' +
      '</div>';
  }

  function renderStudioModal() {
    var modal = document.getElementById('atelier-design-studio-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'atelier-design-studio-modal';
      document.body.appendChild(modal);
      bindStudioGlobalEvents();
    }

    var flowers = getPageFlowers();
    var curPageObj = STUDIO_PAGES.find(function (p) { return p.id === studioState.page; }) || STUDIO_PAGES[0];

    var pageOptions = STUDIO_PAGES.map(function (p) {
      return '<option value="' + p.id + '" ' + (p.id === studioState.page ? 'selected' : '') + '>' + p.label + '</option>';
    }).join('');

    var libraryItems = BOTANICAL_FLOWERS.map(function (f, idx) {
      return '' +
        '<div onclick="window.suAddFlowerToStudio(' + idx + ')" ' +
          'class="p-2.5 rounded-2xl border border-[#E5ECE6] hover:border-[#647D69] bg-white hover:bg-[#FAF6F0] transition cursor-pointer flex items-center gap-3 group shadow-2xs">' +
          '<div class="w-12 h-12 rounded-xl bg-[#FAF6F0] border border-[#E5ECE6] p-1 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">' +
            '<img src="' + f.src + '" alt="' + f.name + '" class="max-h-full max-w-full object-contain" />' +
          '</div>' +
          '<div class="overflow-hidden flex-1">' +
            '<p class="font-serif font-bold text-xs text-[#302C2A] truncate">' + f.num + '. ' + f.name + '</p>' +
            '<p class="text-[10px] text-stone-500 line-clamp-1 mt-0.5">' + f.desc + '</p>' +
          '</div>' +
          '<button type="button" class="w-6 h-6 rounded-lg bg-[#EBF1EC] group-hover:bg-[#647D69] text-[#526B57] group-hover:text-white flex items-center justify-center text-xs font-bold transition shrink-0" title="Add to page">' +
            '+' +
          '</button>' +
        '</div>';
    }).join('');

    modal.innerHTML = '' +
      '<!-- Top Toolbar (Height 64px) -->' +
      '<header class="h-16 bg-white border-b border-[#E5ECE6] px-4 sm:px-6 flex items-center justify-between gap-3 shrink-0 z-20 shadow-xs">' +
        '<div class="flex items-center gap-3">' +
          '<div class="w-10 h-10 rounded-2xl bg-[#F9DFE8] flex items-center justify-center text-lg shadow-2xs">🌸</div>' +
          '<div>' +
            '<h2 class="font-serif font-bold text-stone-900 text-sm sm:text-base leading-tight">Atelier Floral Design Studio</h2>' +
            '<p class="text-[11px] text-[#6E6864] hidden sm:block">Full manual canvas controls: drag, rotate, resize & arrange flowers</p>' +
          '</div>' +
        '</div>' +

        '<div class="flex items-center gap-2 sm:gap-3">' +
          '<!-- Page Selector -->' +
          '<div class="flex items-center gap-1.5 bg-[#FAF6F0] p-1 rounded-xl border border-[#E5ECE6]">' +
            '<span class="text-xs font-bold text-stone-600 pl-2 hidden md:inline">Page:</span>' +
            '<select onchange="window.suSetStudioPage(this.value)" class="bg-transparent text-xs font-bold text-stone-800 pr-2 py-1 outline-hidden cursor-pointer">' +
              pageOptions +
            '</select>' +
          '</div>' +

          '<!-- Save & Actions -->' +
          '<button type="button" onclick="window.suSaveStudioChanges()" class="py-2 px-4 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs">' +
            '<svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>' +
            '<span>Save Changes</span>' +
          '</button>' +

          '<button type="button" onclick="window.suClearCurrentPageFlowers()" class="py-2 px-3 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-700 text-xs font-semibold transition hidden lg:inline-flex items-center gap-1 shadow-2xs" title="Clear flowers on this page">' +
            '<span>Clear Page</span>' +
          '</button>' +

          '<button type="button" onclick="window.suExportStudioCode()" class="py-2 px-3 rounded-xl border border-[#E5ECE6] hover:bg-[#FAF6F0] text-stone-700 text-xs font-semibold transition hidden lg:inline-flex items-center gap-1 shadow-2xs" title="Copy JavaScript configuration code">' +
            '<span>Export Code</span>' +
          '</button>' +

          '<button type="button" onclick="window.suCloseFloralStudio()" class="w-8 h-8 rounded-full bg-[#FAF6F0] hover:bg-stone-200 text-stone-600 flex items-center justify-center transition shadow-2xs" title="Close Studio">' +
            '<svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
          '</button>' +
        '</div>' +
      '</header>' +

      '<!-- Main Studio Body -->' +
      '<div class="flex-1 flex overflow-hidden">' +
        '<!-- Left Panel: Floral Library (Width: 280px) -->' +
        '<aside class="w-72 bg-white border-r border-[#E5ECE6] p-4 flex flex-col shrink-0 overflow-y-auto space-y-3 z-10">' +
          '<div class="pb-2 border-b border-[#E5ECE6]">' +
            '<h3 class="font-serif font-bold text-xs uppercase tracking-wider text-stone-800">Floral Library</h3>' +
            '<p class="text-[11px] text-stone-500 mt-0.5">Click any flower below to place it onto the page canvas.</p>' +
          '</div>' +
          '<div class="space-y-2">' +
            libraryItems +
          '</div>' +
        '</aside>' +

        '<!-- Center Panel: Interactive Artboard Stage -->' +
        '<main class="studio-artboard-stage" onclick="window.suHandleArtboardBackgroundClick(event)">' +
          '<div id="studio-artboard" class="studio-artboard">' +
            '<!-- Background Silhouette Wireframe for Visual Reference -->' +
            '<div class="studio-artboard-wireframe">' +
              getStudioPageWireframe(studioState.page) +
            '</div>' +
            '<!-- Interactive Flower Layer -->' +
            '<div id="studio-flower-layer" class="absolute inset-0 z-10">' +
              renderStudioFlowersHtml() +
            '</div>' +
          '</div>' +
        '</main>' +

        '<!-- Right Panel: Flower Inspector (Width: 300px) -->' +
        '<aside id="studio-inspector-panel" class="w-76 bg-white border-l border-[#E5ECE6] shrink-0 overflow-y-auto z-10">' +
          renderStudioInspectorHtml() +
        '</aside>' +
      '</div>';
  }

  // ── DIRECT MANIPULATION EVENT BINDINGS ────────────────────────────────────
  function bindStudioGlobalEvents() {
    var modal = document.getElementById('atelier-design-studio-modal');
    if (!modal) return;

    // Mouse / Touch Start on Artboard
    modal.addEventListener('mousedown', onStudioMouseDown);
    modal.addEventListener('touchstart', onStudioTouchStart, { passive: false });

    // Global Move & Up
    window.addEventListener('mousemove', onStudioMouseMove);
    window.addEventListener('touchmove', onStudioTouchMove, { passive: false });
    window.addEventListener('mouseup', onStudioMouseUp);
    window.addEventListener('touchend', onStudioMouseUp);

    // Keyboard Shortcuts
    window.addEventListener('keydown', onStudioKeyDown);
  }

  function getClientCoords(e) {
    if (e.touches && e.touches.length) {
      return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  }

  function onStudioMouseDown(e) {
    handleStudioStart(e, getClientCoords(e));
  }

  function onStudioTouchStart(e) {
    if (e.touches && e.touches.length === 1) {
      handleStudioStart(e, getClientCoords(e));
    }
  }

  function handleStudioStart(e, coords) {
    var target = e.target;
    var flowerWrap = target.closest('.studio-flower-wrapper');
    var resizeHandle = target.closest('.studio-resize-handle');
    var rotateKnob = target.closest('.studio-rotation-knob');

    // 1. Rotation knob clicked
    if (rotateKnob && flowerWrap) {
      e.preventDefault();
      e.stopPropagation();
      var fId = flowerWrap.getAttribute('data-id');
      studioState.activeFlowerId = fId;
      studioState.isInteracting = true;
      studioState.interactionType = 'rotate';

      var rect = flowerWrap.getBoundingClientRect();
      studioState.centerClientX = rect.left + rect.width / 2;
      studioState.centerClientY = rect.top + rect.height / 2;
      renderStudioSelectionOnly();
      return;
    }

    // 2. Resize handle clicked
    if (resizeHandle && flowerWrap) {
      e.preventDefault();
      e.stopPropagation();
      var fId = flowerWrap.getAttribute('data-id');
      var handleType = resizeHandle.getAttribute('data-handle') || 'se';
      studioState.activeFlowerId = fId;
      studioState.isInteracting = true;
      studioState.interactionType = 'resize';
      studioState.resizeHandle = handleType;

      var flw = getActiveStudioFlower();
      var rect = flowerWrap.getBoundingClientRect();
      studioState.centerClientX = rect.left + rect.width / 2;
      studioState.centerClientY = rect.top + rect.height / 2;
      studioState.startDist = Math.hypot(coords.clientX - studioState.centerClientX, coords.clientY - studioState.centerClientY);
      studioState.startFlowerW = flw ? (flw.width || 240) : 240;
      renderStudioSelectionOnly();
      return;
    }

    // 3. Flower body clicked (Drag Move)
    if (flowerWrap) {
      var fId = flowerWrap.getAttribute('data-id');
      studioState.activeFlowerId = fId;
      studioState.isInteracting = true;
      studioState.interactionType = 'move';

      var flw = getActiveStudioFlower();
      studioState.startMouseX = coords.clientX;
      studioState.startMouseY = coords.clientY;
      studioState.startFlowerX = flw ? flw.x : 50;
      studioState.startFlowerY = flw ? flw.y : 50;
      renderStudioSelectionOnly();
    }
  }

  function onStudioMouseMove(e) {
    handleStudioMove(e, getClientCoords(e));
  }

  function onStudioTouchMove(e) {
    if (studioState.isInteracting && e.touches && e.touches.length === 1) {
      e.preventDefault();
      handleStudioMove(e, getClientCoords(e));
    }
  }

  function handleStudioMove(e, coords) {
    if (!studioState.isInteracting) return;
    var flower = getActiveStudioFlower();
    if (!flower) return;

    var artboard = document.getElementById('studio-artboard');
    if (!artboard) return;
    var abRect = artboard.getBoundingClientRect();

    // Handle Moving
    if (studioState.interactionType === 'move') {
      var dx = ((coords.clientX - studioState.startMouseX) / abRect.width) * 100;
      var dy = ((coords.clientY - studioState.startMouseY) / abRect.height) * 100;
      flower.x = Math.max(0, Math.min(100, Math.round((studioState.startFlowerX + dx) * 10) / 10));
      flower.y = Math.max(0, Math.min(100, Math.round((studioState.startFlowerY + dy) * 10) / 10));
      updateActiveFlowerDom();
      updateInspectorValues();
      return;
    }

    // Handle Resizing
    if (studioState.interactionType === 'resize') {
      var currDist = Math.hypot(coords.clientX - studioState.centerClientX, coords.clientY - studioState.centerClientY);
      var scale = currDist / (studioState.startDist || 1);
      var newW = Math.max(60, Math.min(800, Math.round(studioState.startFlowerW * scale)));
      flower.width = newW;
      updateActiveFlowerDom();
      updateInspectorValues();
      return;
    }

    // Handle Rotating
    if (studioState.interactionType === 'rotate') {
      var rad = Math.atan2(coords.clientY - studioState.centerClientY, coords.clientX - studioState.centerClientX);
      var deg = rad * (180 / Math.PI);
      var angle = Math.round(deg + 90);
      while (angle > 180) angle -= 360;
      while (angle <= -180) angle += 360;
      flower.rotation = angle;
      updateActiveFlowerDom();
      updateInspectorValues();
      return;
    }
  }

  function onStudioMouseUp() {
    if (studioState.isInteracting) {
      studioState.isInteracting = false;
      studioState.interactionType = null;
      studioState.resizeHandle = null;
      // Auto-sync preview
      refreshActivePageDecor();
    }
  }

  function onStudioKeyDown(e) {
    var modal = document.getElementById('atelier-design-studio-modal');
    if (!modal || modal.classList.contains('hidden')) return;

    // Ignore if typing inside input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;

    var flower = getActiveStudioFlower();

    // Deselect
    if (e.key === 'Escape') {
      studioState.activeFlowerId = null;
      renderStudioSelectionOnly();
      return;
    }

    if (!flower) return;

    // Delete
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      window.suDeleteActiveFlower();
      return;
    }

    // Duplicate (Ctrl+D / Cmd+D)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
      e.preventDefault();
      window.suDuplicateActiveFlower();
      return;
    }

    // Arrow keys nudge
    var step = e.shiftKey ? 3 : 1;
    if (e.key === 'ArrowLeft')  { e.preventDefault(); flower.x = Math.max(0, flower.x - step); updateActiveFlowerDom(); updateInspectorValues(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); flower.x = Math.min(100, flower.x + step); updateActiveFlowerDom(); updateInspectorValues(); }
    if (e.key === 'ArrowUp')    { e.preventDefault(); flower.y = Math.max(0, flower.y - step); updateActiveFlowerDom(); updateInspectorValues(); }
    if (e.key === 'ArrowDown')  { e.preventDefault(); flower.y = Math.min(100, flower.y + step); updateActiveFlowerDom(); updateInspectorValues(); }
  }

  function updateActiveFlowerDom() {
    var flower = getActiveStudioFlower();
    if (!flower) return;
    var el = document.getElementById('studio-flower-' + flower.id);
    if (!el) return;

    var rot = flower.rotation || 0;
    var op = (flower.opacity !== undefined && flower.opacity !== null) ? flower.opacity : 0.50;
    var w = flower.width || 240;
    var z = flower.zIndex || 10;

    el.style.left = flower.x + '%';
    el.style.top = flower.y + '%';
    el.style.width = w + 'px';
    el.style.transform = 'translate(-50%, -50%) rotate(' + rot + 'deg)';
    el.style.opacity = op;
    el.style.zIndex = z;
  }

  function updateInspectorValues() {
    var flower = getActiveStudioFlower();
    var panel = document.getElementById('studio-inspector-panel');
    if (!panel || !flower) return;
    panel.innerHTML = renderStudioInspectorHtml();
  }

  function renderStudioSelectionOnly() {
    var layer = document.getElementById('studio-flower-layer');
    if (layer) layer.innerHTML = renderStudioFlowersHtml();
    var panel = document.getElementById('studio-inspector-panel');
    if (panel) panel.innerHTML = renderStudioInspectorHtml();
  }

  // ── PUBLIC STUDIO API METHODS ─────────────────────────────────────────────
  window.suOpenFloralStudio = function (targetPage) {
    var cur = (window.appRouter && window.appRouter.currentView) || 'home';
    if (targetPage && STUDIO_PAGES.some(function (p) { return p.id === targetPage; })) {
      studioState.page = targetPage;
    } else if (STUDIO_PAGES.some(function (p) { return p.id === cur; })) {
      studioState.page = cur;
    } else {
      studioState.page = 'home';
    }

    // Sync new images from server then render (images already cached after first open)
    syncDecorationLibrary(function () {
      renderStudioModal();
      var modal = document.getElementById('atelier-design-studio-modal');
      if (modal) modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    });
  };

  // Backwards compatible alias
  window.suOpenFloralArranger = window.suOpenFloralStudio;

  window.suCloseFloralStudio = function () {
    var modal = document.getElementById('atelier-design-studio-modal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
    refreshActivePageDecor();
  };

  window.suCloseFloralArranger = window.suCloseFloralStudio;

  window.suSetStudioPage = function (pageKey) {
    studioState.page = pageKey;
    studioState.activeFlowerId = null;
    renderStudioModal();
  };

  window.suHandleArtboardBackgroundClick = function (e) {
    if (e.target.id === 'studio-artboard' || e.target.classList.contains('studio-artboard-stage') || e.target.classList.contains('studio-artboard-wireframe')) {
      studioState.activeFlowerId = null;
      renderStudioSelectionOnly();
    }
  };

  window.suAddFlowerToStudio = function (flowerIdx) {
    var asset = BOTANICAL_FLOWERS[flowerIdx];
    if (!asset) return;

    var list = getPageFlowers();
    var maxZ = list.reduce(function (max, f) { return Math.max(max, f.zIndex || 10); }, 10);

    // Stagger position slightly if multiple flowers placed
    var count = list.length;
    var posX = 50 + ((count % 5) - 2) * 6;
    var posY = 45 + ((count % 4) - 1.5) * 6;

    var newFlower = {
      id: 'flr_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      src: asset.src,
      file: asset.file,
      name: asset.name,
      x: Math.max(10, Math.min(90, posX)),
      y: Math.max(10, Math.min(90, posY)),
      width: 240,
      rotation: 0,
      opacity: 0.65,
      zIndex: maxZ + 1
    };

    list.push(newFlower);
    studioState.activeFlowerId = newFlower.id;
    renderStudioModal();
    refreshActivePageDecor();
    if (typeof window.showToast === 'function') {
      window.showToast('Added ' + asset.name + ' to ' + studioState.page + '!', 'success');
    }
  };

  window.suUpdateActiveFlowerProp = function (prop, val) {
    var flower = getActiveStudioFlower();
    if (!flower) return;
    flower[prop] = val;
    updateActiveFlowerDom();
    updateInspectorValues();
    refreshActivePageDecor();
  };

  window.suDuplicateActiveFlower = function () {
    var flower = getActiveStudioFlower();
    if (!flower) return;

    var list = getPageFlowers();
    var clone = JSON.parse(JSON.stringify(flower));
    clone.id = 'flr_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    clone.x = Math.min(95, clone.x + 4);
    clone.y = Math.min(95, clone.y + 4);
    clone.zIndex = (flower.zIndex || 10) + 1;

    list.push(clone);
    studioState.activeFlowerId = clone.id;
    renderStudioModal();
    refreshActivePageDecor();
    if (typeof window.showToast === 'function') {
      window.showToast('Duplicated flower!', 'info');
    }
  };

  window.suDeleteActiveFlower = function () {
    var flower = getActiveStudioFlower();
    if (!flower) return;

    var list = getPageFlowers();
    PAGE_FREEFORM_FLOWERS[studioState.page] = list.filter(function (f) { return f.id !== flower.id; });
    studioState.activeFlowerId = null;
    renderStudioModal();
    refreshActivePageDecor();
    if (typeof window.showToast === 'function') {
      window.showToast('Deleted flower decoration.', 'info');
    }
  };

  window.suAdjustActiveFlowerLayer = function (action) {
    var flower = getActiveStudioFlower();
    if (!flower) return;
    var list = getPageFlowers();

    if (action === 'forward') {
      flower.zIndex = (flower.zIndex || 10) + 1;
    } else if (action === 'backward') {
      flower.zIndex = Math.max(1, (flower.zIndex || 10) - 1);
    } else if (action === 'front') {
      var maxZ = list.reduce(function (m, f) { return Math.max(m, f.zIndex || 10); }, 10);
      flower.zIndex = maxZ + 2;
    } else if (action === 'back') {
      var minZ = list.reduce(function (m, f) { return Math.min(m, f.zIndex || 10); }, 10);
      flower.zIndex = Math.max(1, minZ - 1);
    }

    renderStudioModal();
    refreshActivePageDecor();
  };

  window.suClearCurrentPageFlowers = function () {
    if (!confirm('Clear all floral decorations on ' + studioState.page + '?')) return;
    PAGE_FREEFORM_FLOWERS[studioState.page] = [];
    studioState.activeFlowerId = null;
    try {
      localStorage.setItem('umaira_freeform_decorations', JSON.stringify(PAGE_FREEFORM_FLOWERS));
    } catch (e) {}
    syncDecorationsToServer(studioState.page);
    renderStudioModal();
    refreshActivePageDecor();
    if (typeof window.showToast === 'function') {
      window.showToast('Cleared all flowers on ' + studioState.page + '.', 'success');
    }
  };

  window.suClearAllFlowersSiteWide = function () {
    if (!confirm('Remove all floral decorations across every page?')) return;
    Object.keys(PAGE_FREEFORM_FLOWERS).forEach(function (k) {
      PAGE_FREEFORM_FLOWERS[k] = [];
    });
    studioState.activeFlowerId = null;
    try {
      localStorage.setItem('umaira_freeform_decorations', JSON.stringify(PAGE_FREEFORM_FLOWERS));
    } catch (e) {}
    Object.keys(PAGE_FREEFORM_FLOWERS).forEach(function (k) { syncDecorationsToServer(k); });
    renderStudioModal();
    refreshActivePageDecor();
    if (typeof window.showToast === 'function') {
      window.showToast('All floral decorations cleared site-wide.', 'success');
    }
  };

  window.suSaveStudioChanges = function () {
    try {
      localStorage.setItem('umaira_freeform_decorations', JSON.stringify(PAGE_FREEFORM_FLOWERS));
    } catch (e) {}
    syncDecorationsToServer(studioState.page);
    refreshActivePageDecor();
    if (typeof window.showToast === 'function') {
      window.showToast('Saved floral customizations for ' + studioState.page + '!', 'success');
    } else {
      alert('Saved floral customizations!');
    }
  };

  window.suExportStudioCode = function () {
    var snippet = 'var PAGE_FREEFORM_FLOWERS = ' + JSON.stringify(PAGE_FREEFORM_FLOWERS, null, 2) + ';';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(snippet).then(function () {
        if (typeof window.showToast === 'function') {
          window.showToast('Exported JavaScript configuration copied to clipboard!', 'success');
        } else {
          alert('Configuration copied to clipboard!');
        }
      });
    } else {
      prompt('Copy your custom freeform floral configuration:', snippet);
    }
  };

  // Keyboard shortcut Alt + F to toggle Floral Studio
  window.addEventListener('keydown', function (e) {
    if (e.altKey && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault();
      var modal = document.getElementById('atelier-design-studio-modal');
      if (modal && !modal.classList.contains('hidden')) {
        window.suCloseFloralStudio();
      } else {
        window.suOpenFloralStudio();
      }
    }
  });

  /* =====================================================================
     5. COLLECTIONS PAGE — MAIN FLOWER SHOP & READY-MADE BOUQUETS
     ===================================================================== */
  /* =====================================================================
     5. COLLECTIONS PAGE — READY-MADE BOUQUET CATALOG & FILTER SYSTEM
     ===================================================================== */
  var MAIN_COLLECTION_CATEGORIES = [
    'All Bouquets',
    'Best Sellers',
    'Romance',
    'Celebrations',
    'Sympathy'
  ];

  var FLOWER_TYPE_OPTIONS = [
    { id: 'all', label: 'All Flower Types' },
    { id: 'Roses', label: 'Roses' },
    { id: 'Tulips', label: 'Tulips' },
    { id: 'Carnations', label: 'Carnations' },
    { id: 'Gerberas', label: 'Gerberas' },
    { id: 'Sunflowers', label: 'Sunflowers' },
    { id: 'Lilies', label: 'Lilies' },
    { id: 'Orchids', label: 'Orchids' },
    { id: 'Peonies', label: 'Peonies' },
    { id: 'Hydrangeas', label: 'Hydrangeas' },
    { id: 'Daisies', label: 'Daisies' },
    { id: 'Chrysanthemums', label: 'Chrysanthemums' },
    { id: 'Lisianthus', label: 'Lisianthus' },
    { id: 'Snapdragons', label: 'Snapdragons' },
    { id: "Baby's Breath", label: "Baby's Breath" },
    { id: 'Eucalyptus', label: 'Eucalyptus' },
    { id: 'Ruscus', label: 'Ruscus' },
    { id: 'Ferns', label: 'Ferns' }
  ];

  var OFFICIAL_OCCASIONS = (typeof window !== 'undefined' && window.SHOP_RULES && Array.isArray(window.SHOP_RULES.OFFICIAL_OCCASIONS))
    ? window.SHOP_RULES.OFFICIAL_OCCASIONS
    : [
        'Birthday',
        'Anniversary',
        "Valentine's Day",
        "Mother's Day",
        'Graduation',
        'Congratulations',
        'Sympathy',
        'Thank You'
      ];

  var OCCASION_OPTIONS = [{ id: 'all', label: 'All Occasions' }].concat(
    OFFICIAL_OCCASIONS.map(function (o) {
      return { id: o, label: o };
    })
  );

  var SOURCE_OPTIONS = [
    { id: 'all', label: 'All Flower Sources' },
    { id: 'Local', label: 'Local (Benguet / Highland Farms)' },
    { id: 'Imported', label: 'Imported (Ecuador, Holland)' }
  ];

  var BUDGET_OPTIONS = [
    { id: 'all', label: 'All Price Ranges' },
    { id: '500-1000', label: '₱500 – ₱1,000' },
    { id: '1000-2000', label: '₱1,000 – ₱2,000' },
    { id: '2000-3000', label: '₱2,000 – ₱3,000' },
    { id: '3000+', label: '₱3,000+' }
  ];

  var SORT_OPTIONS = [
    { id: 'popular', label: 'Most Popular' },
    { id: 'bestselling', label: 'Best Selling' },
    { id: 'price_asc', label: 'Price: Low to High' },
    { id: 'price_desc', label: 'Price: High to Low' },
    { id: 'newest', label: 'Newest First' }
  ];

  var collectionFilterState = {
    category: 'All Bouquets',
    flowerType: 'all',
    occasion: 'all',
    source: 'all',
    budget: 'all',
    sortBy: 'popular',
    searchQuery: '',
    minCustomPrice: '',
    maxCustomPrice: ''
  };

  function findBouquet(id) {
    return (FLOWER_DATA.featuredBouquets || []).filter(function (b) { return b.id === id; })[0];
  }

  function getFilteredBouquets() {
    var allBouquets = FLOWER_DATA.featuredBouquets || [];
    var bouquets = allBouquets.filter(isBouquetPublished);

    return bouquets.filter(function (b) {
      // 1. Category Filter (Category = What collection does the customer want?)
      if (collectionFilterState.category !== 'All Bouquets') {
        var cat = collectionFilterState.category;
        var matchCat = false;
        var bOccs = (b.occasions || []).concat(
          (b.occasion ? b.occasion.split(',').map(function (s) { return s.trim(); }) : [])
        );
        var bCats = (b.categories || []).concat(b.category ? [b.category] : []);

        if (cat === 'Best Sellers') {
          if (b.isBestSeller || bCats.some(function (c) { return /best\s*seller/i.test(c); })) matchCat = true;
        } else if (cat === 'Romance') {
          var romanceMatches = ['romance', "valentine's", 'valentines', 'anniversary', 'monthsary', 'love'];
          if (bOccs.some(function (o) { return romanceMatches.indexOf(o.toLowerCase()) >= 0; }) ||
              bCats.some(function (c) { return romanceMatches.indexOf(c.toLowerCase()) >= 0; })) {
            matchCat = true;
          }
        } else if (cat === 'Celebrations') {
          var celebMatches = ['celebrations', 'celebration', 'birthday', 'wedding', 'graduation', 'gifts', 'congratulations', "mother's day", 'mothers day'];
          if (bOccs.some(function (o) { return celebMatches.indexOf(o.toLowerCase()) >= 0; }) ||
              bCats.some(function (c) { return celebMatches.indexOf(c.toLowerCase()) >= 0; })) {
            matchCat = true;
          }
        } else if (cat === 'Sympathy') {
          var sympMatches = ['sympathy', 'funeral', 'pampatay'];
          if (bOccs.some(function (o) { return sympMatches.some(function (m) { return o.toLowerCase().indexOf(m) >= 0; }); }) ||
              bCats.some(function (c) { return sympMatches.some(function (m) { return c.toLowerCase().indexOf(m) >= 0; }); })) {
            matchCat = true;
          }
        } else {
          var catLower = cat.toLowerCase();
          if (bCats.some(function (c) { return c.toLowerCase() === catLower; }) ||
              bOccs.some(function (o) { return o.toLowerCase() === catLower; })) {
            matchCat = true;
          }
        }
        if (!matchCat) return false;
      }

      // 2. Flower Type Filter (Specific flower used in bouquet)
      if (collectionFilterState.flowerType !== 'all') {
        var flType = collectionFilterState.flowerType.toLowerCase();
        var flRoots = [flType];
        if (flType.endsWith('ies')) flRoots.push(flType.slice(0, -3) + 'y');
        if (flType.endsWith('s')) flRoots.push(flType.slice(0, -1));

        var matchFlower = false;
        var bFlowers = (b.flowerTypes || []).map(function (f) { return f.toLowerCase(); });
        if (b.primaryFlower) bFlowers.push(b.primaryFlower.toLowerCase());

        for (var rIdx = 0; rIdx < flRoots.length; rIdx++) {
          var root = flRoots[rIdx];
          if (bFlowers.some(function (f) { return f === root || f.indexOf(root) >= 0 || root.indexOf(f) >= 0; })) {
            matchFlower = true;
            break;
          }
          if (b.mainFlowersText && b.mainFlowersText.toLowerCase().indexOf(root) >= 0) { matchFlower = true; break; }
          if (b.formula && b.formula.toLowerCase().indexOf(root) >= 0) { matchFlower = true; break; }
          if (b.name && b.name.toLowerCase().indexOf(root) >= 0) { matchFlower = true; break; }
          if (b.description && b.description.toLowerCase().indexOf(root) >= 0) { matchFlower = true; break; }
        }
        if (!matchFlower) return false;
      }

      // 3. Occasion Filter
      if (collectionFilterState.occasion !== 'all') {
        var occ = String(collectionFilterState.occasion).toLowerCase().trim();
        var matchOcc = false;
        var bOccasionList = (Array.isArray(b.occasions) ? b.occasions : []).concat(
          (b.occasion ? b.occasion.split(',').map(function (s) { return s.trim(); }) : [])
        ).concat(
          (b.specs && Array.isArray(b.specs.occasions) ? b.specs.occasions : [])
        );
        if (bOccasionList.some(function (o) {
          if (!o) return false;
          var lo = String(o).toLowerCase().trim();
          if (lo === occ) return true;
          if (occ === "valentine's day" || occ === "valentines day" || occ === "valentine's") {
            if (lo.indexOf('valentin') >= 0) return true;
          }
          if (occ === "mother's day" || occ === "mothers day") {
            if (lo.indexOf('mother') >= 0) return true;
          }
          if (occ === "thank you") {
            if (lo.indexOf('thank') >= 0) return true;
          }
          if (occ === "sympathy") {
            if (lo.indexOf('sympath') >= 0 || lo.indexOf('funeral') >= 0) return true;
          }
          return lo.indexOf(occ) >= 0 || occ.indexOf(lo) >= 0;
        })) {
          matchOcc = true;
        }
        if (!matchOcc) return false;
      }

      // 4. Flower Source Filter (Local vs Imported)
      if (collectionFilterState.source !== 'all') {
        var srcFilter = collectionFilterState.source.toLowerCase();
        var bSrc = (b.source || '').toLowerCase();
        var bSources = (Array.isArray(b.sources) ? b.sources : (b.source ? b.source.split(',').map(function (s) { return s.trim(); }) : [])).map(function (s) { return s.toLowerCase(); });
        var matchSrc = bSrc === srcFilter ||
                       bSources.indexOf(srcFilter) >= 0 ||
                       (srcFilter === 'local' && (bSrc.indexOf('local') >= 0 || bSources.some(function (s) { return s.indexOf('local') >= 0; }))) ||
                       (srcFilter === 'imported' && (bSrc.indexOf('imported') >= 0 || bSources.some(function (s) { return s.indexOf('imported') >= 0; }))) ||
                       (bSrc === 'mixed' || bSrc === 'both' || (bSources.indexOf('local') >= 0 && bSources.indexOf('imported') >= 0));
        if (!matchSrc) return false;
      }

      // 5. Budget / Price Range Filter
      if (collectionFilterState.minCustomPrice !== '' && !isNaN(Number(collectionFilterState.minCustomPrice))) {
        if (b.price < Number(collectionFilterState.minCustomPrice)) return false;
      }
      if (collectionFilterState.maxCustomPrice !== '' && !isNaN(Number(collectionFilterState.maxCustomPrice))) {
        if (b.price > Number(collectionFilterState.maxCustomPrice)) return false;
      }
      if (collectionFilterState.budget !== 'all') {
        if (collectionFilterState.budget === '500-1000' && (b.price < 500 || b.price > 1000)) return false;
        if (collectionFilterState.budget === '1000-2000' && (b.price < 1000 || b.price > 2000)) return false;
        if (collectionFilterState.budget === '2000-3000' && (b.price < 2000 || b.price > 3000)) return false;
        if (collectionFilterState.budget === '3000+' && b.price < 3000) return false;
      }

      // 6. Search Query
      if (collectionFilterState.searchQuery) {
        var q = collectionFilterState.searchQuery.toLowerCase();
        var matchQ = (b.name && b.name.toLowerCase().indexOf(q) >= 0) ||
                     (b.tagline && b.tagline.toLowerCase().indexOf(q) >= 0) ||
                     (b.description && b.description.toLowerCase().indexOf(q) >= 0) ||
                     (b.mainFlowersText && b.mainFlowersText.toLowerCase().indexOf(q) >= 0) ||
                     (b.formula && b.formula.toLowerCase().indexOf(q) >= 0) ||
                     (b.flowerTypes && b.flowerTypes.some(function (f) { return f.toLowerCase().indexOf(q) >= 0; }));
        if (!matchQ) return false;
      }

      return true;
    }).sort(function (a, b) {
      switch (collectionFilterState.sortBy) {
        case 'bestselling':
          var diffBs = (b.salesCount || 0) - (a.salesCount || 0);
          if (diffBs !== 0) return diffBs;
          return a.name.localeCompare(b.name);
        case 'price_asc':
        case 'price-asc':
        case 'price_low_high':
          return a.price - b.price;
        case 'price_desc':
        case 'price-desc':
        case 'price_high_low':
          return b.price - a.price;
        case 'newest':
          // Most recently created first; bouquets created at the same time keep a stable A–Z order.
          var diffNew = new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
          if (diffNew !== 0) return diffNew;
          return a.name.localeCompare(b.name);
        case 'popular':
        default:
          var diffPop = (b.salesCount || 0) - (a.salesCount || 0);
          if (diffPop !== 0) return diffPop;
          return a.name.localeCompare(b.name);
      }
    });
  }

  // Collections grid card: the same card as Home "Featured Bouquets" (see compactBouquetCard).
  // While an occasion filter is active, the card's category label shows that occasion.
  function bouquetCard(bq) {
    return compactBouquetCard(bq, { activeOccasion: collectionFilterState.occasion });
  }

  function categorySelectorHtml() {
    return '';
  }

  function filterBarHtml() {
    var selectCls = 'py-2.5 px-3.5 bg-white/95 hover:bg-white border border-[#E5ECE6] rounded-xl text-stone-800 text-xs font-medium focus:ring-2 focus:ring-[#647D69] focus:border-[#647D69] focus:bg-white transition-all shadow-xs cursor-pointer';

    var flowerOpts = FLOWER_TYPE_OPTIONS.map(function (f) {
      return '<option value="' + f.id + '" ' + (collectionFilterState.flowerType === f.id ? 'selected' : '') + '>' + f.label + '</option>';
    }).join('');

    var occasionOpts = OCCASION_OPTIONS.map(function (o) {
      return '<option value="' + o.id + '" ' + (collectionFilterState.occasion === o.id ? 'selected' : '') + '>' + o.label + '</option>';
    }).join('');

    var sourceOpts = SOURCE_OPTIONS.map(function (s) {
      return '<option value="' + s.id + '" ' + (collectionFilterState.source === s.id ? 'selected' : '') + '>' + s.label + '</option>';
    }).join('');

    var budgetOpts = BUDGET_OPTIONS.map(function (b) {
      return '<option value="' + b.id + '" ' + (collectionFilterState.budget === b.id ? 'selected' : '') + '>' + b.label + '</option>';
    }).join('');

    var sortOpts = SORT_OPTIONS.map(function (s) {
      return '<option value="' + s.id + '" ' + (collectionFilterState.sortBy === s.id ? 'selected' : '') + '>' + s.label + '</option>';
    }).join('');

    // The Flower Source filter only makes sense once bouquets carry a source; otherwise every choice
    // would return zero results, so it is hidden until the admin records sources.
    var hasSourceData = (FLOWER_DATA.featuredBouquets || []).filter(isBouquetPublished).some(function (b) {
      return !!(b.source || (Array.isArray(b.sources) && b.sources.length));
    });
    if (!hasSourceData && collectionFilterState.source !== 'all') collectionFilterState.source = 'all';

    return '' +
    '<div class="backdrop-blur-md bg-white/95 p-5 sm:p-6 rounded-3xl border border-[#E5ECE6] shadow-xs space-y-4">' +
      '<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3">' +
        '<!-- Search Bar -->' +
        '<div class="relative flex-1 max-w-md">' +
          '<input type="text" id="su-bouquet-search-input" value="' + (collectionFilterState.searchQuery || '') + '" oninput="window.suSetSearchQuery(this.value)" placeholder="Search bouquets..." class="w-full pl-10 pr-4 py-2.5 text-xs bg-white border border-[#E5ECE6] rounded-xl focus:ring-2 focus:ring-[#647D69] focus:border-[#647D69] focus:bg-white transition-all shadow-xs">' +
          '<span class="absolute left-3.5 top-3 text-[#647D69]/70"><svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/></svg></span>' +
        '</div>' +
        '<!-- Sort By -->' +
        '<div class="flex items-center gap-2 text-xs">' +
          '<span class="text-stone-500 font-medium whitespace-nowrap">Sort:</span>' +
          '<select id="su-filter-sort" onchange="window.suSetSortBy(this.value)" class="' + selectCls + '">' + sortOpts + '</select>' +
        '</div>' +
      '</div>' +

      '<!-- 4 Core Filter Selects (Flower Type, Occasion, Source, Budget) -->' +
      '<div class="pt-3 border-t border-stone-100 grid grid-cols-2 ' + (hasSourceData ? 'md:grid-cols-4' : 'md:grid-cols-3') + ' gap-2.5">' +
        '<div>' +
          '<label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" for="su-filter-flower">Flower Type</label>' +
          '<select id="su-filter-flower" onchange="window.suSetFlowerType(this.value)" class="w-full ' + selectCls + '">' + flowerOpts + '</select>' +
        '</div>' +
        '<div>' +
          '<label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" for="su-filter-occasion">Occasion</label>' +
          '<select id="su-filter-occasion" onchange="window.suSetOccasion(this.value)" class="w-full ' + selectCls + '">' + occasionOpts + '</select>' +
        '</div>' +
        (hasSourceData ?
        '<div>' +
          '<label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" for="su-filter-source">Flower Source</label>' +
          '<select id="su-filter-source" onchange="window.suSetSource(this.value)" class="w-full ' + selectCls + '">' + sourceOpts + '</select>' +
        '</div>' : '') +
        '<div>' +
          '<label class="block text-[10px] font-bold text-stone-400 uppercase tracking-wider mb-1" for="su-filter-budget">Budget</label>' +
          '<select id="su-filter-budget" onchange="window.suSetPriceRange(this.value)" class="w-full ' + selectCls + '">' + budgetOpts + '</select>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function activeFiltersHtml(matchingCount) {
    var chips = [];
    var closeChipIcon = '<svg class="w-3 h-3 inline-block" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
    if (collectionFilterState.category !== 'All Bouquets') {
      chips.push('<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#F9DFE8] text-[#647D69]">Category: ' + collectionFilterState.category + ' <button type="button" onclick="window.suSetBouquetCategory(\'All Bouquets\')" class="hover:text-red-700 font-bold" aria-label="Remove category filter">' + closeChipIcon + '</button></span>');
    }
    if (collectionFilterState.flowerType !== 'all') {
      chips.push('<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-800">Flower: ' + collectionFilterState.flowerType + ' <button type="button" onclick="window.suSetFlowerType(\'all\')" class="hover:text-red-700 font-bold" aria-label="Remove flower filter">' + closeChipIcon + '</button></span>');
    }
    if (collectionFilterState.occasion !== 'all') {
      chips.push('<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-800">Occasion: ' + collectionFilterState.occasion + ' <button type="button" onclick="window.suSetOccasion(\'all\')" class="hover:text-red-700 font-bold" aria-label="Remove occasion filter">' + closeChipIcon + '</button></span>');
    }
    if (collectionFilterState.source !== 'all') {
      chips.push('<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-800">Source: ' + collectionFilterState.source + ' <button type="button" onclick="window.suSetSource(\'all\')" class="hover:text-red-700 font-bold" aria-label="Remove source filter">' + closeChipIcon + '</button></span>');
    }
    if (collectionFilterState.budget !== 'all') {
      var budgetLabel = (BUDGET_OPTIONS.filter(function (b) { return b.id === collectionFilterState.budget; })[0] || {}).label || collectionFilterState.budget;
      chips.push('<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-800">Budget: ' + budgetLabel + ' <button type="button" onclick="window.suSetPriceRange(\'all\')" class="hover:text-red-700 font-bold" aria-label="Remove budget filter">' + closeChipIcon + '</button></span>');
    }
    if (collectionFilterState.searchQuery) {
      chips.push('<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-stone-100 text-stone-800">Search: \u201C' + collectionFilterState.searchQuery + '\u201D <button type="button" onclick="window.suSetSearchQuery(\'\')" class="hover:text-red-700 font-bold" aria-label="Clear search">' + closeChipIcon + '</button></span>');
    }

    var hasActiveFilters = chips.length > 0;

    return '' +
    '<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 text-xs">' +
      '<div class="flex items-center gap-2">' +
        '<span class="font-bold text-stone-900 text-sm">Showing ' + matchingCount + ' ready-made bouquet' + (matchingCount !== 1 ? 's' : '') + '</span>' +
        (collectionFilterState.category !== 'All Bouquets' ? '<span class="text-[#647D69] font-medium font-sans">in ' + collectionFilterState.category + '</span>' : '') +
      '</div>' +
      (hasActiveFilters ?
        '<div class="flex flex-wrap items-center gap-2">' +
          chips.join('') +
          '<button type="button" onclick="window.suClearAllFilters()" class="text-xs text-[#647D69] font-bold hover:underline ml-1">Clear Filters</button>' +
        '</div>' : '') +
    '</div>';
  }

  function bouquetGridHtml() {
    var allBouquets = FLOWER_DATA.featuredBouquets || [];
    var publishedCount = allBouquets.filter(isBouquetPublished).length;
    var list = getFilteredBouquets();

    if (publishedCount === 0) {
      return '' +
      '<div class="py-16 sm:py-20 px-6 sm:px-12 text-center bg-white rounded-3xl border border-stone-200/80 shadow-xs space-y-6 max-w-xl mx-auto my-8">' +
        '<div class="w-16 h-16 rounded-full bg-[#EBF1EC] border border-[#E5ECE6]/60 text-[#647D69] flex items-center justify-center mx-auto shadow-xs">' +
          '<svg class="w-8 h-8 stroke-[1.2]" viewBox="0 0 24 24" fill="none" stroke="currentColor">' +
            '<path stroke-linecap="round" stroke-linejoin="round" d="M12 21V11m0 0C10.5 8 7 7 7 3c3.5 0 4.5 3.5 5 8zm0 0c1.5-3 5-4 5-8-3.5 0-4.5 3.5-5 8zm0 4c-2-1.5-4-1-5 1 2 0 4 .5 5-1zm0 3c2-1.5 4-1 5 1-2 0-4 .5-5-1z"/>' +
          '</svg>' +
        '</div>' +
        '<div class="space-y-2">' +
          '<span class="text-[11px] font-bold uppercase tracking-widest text-[#647D69] block">Atelier Seasonal Curation</span>' +
          '<h3 class="font-serif font-bold text-stone-900 text-2xl sm:text-3xl">Curating Our Next Collection</h3>' +
          '<p class="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-md mx-auto">' +
            'Our master florists are hand-selecting and conditioning fresh blooms for our upcoming seasonal collection. In the meantime, you can compose a bespoke arrangement in our Bouquet Studio or contact our florists directly.' +
          '</p>' +
        '</div>' +
        '<div class="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">' +
          '<button type="button" onclick="window.appRouter.navigate(\'builder\')" class="w-full sm:w-auto py-3 px-6 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-xs shadow-md shadow-rose-900/20 transition inline-flex items-center justify-center gap-1.5">' +
            '<span>Design Bespoke Bouquet</span><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>' +
          '</button>' +
          '<button type="button" onclick="window.appRouter.navigate(\'care\')" class="w-full sm:w-auto py-3 px-5 rounded-2xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-700 text-xs font-semibold transition">' +
            'Florist Care Guide' +
          '</button>' +
        '</div>' +
      '</div>';
    }

    if (!list.length) {
      return '' +
      '<div class="col-span-full py-16 px-6 text-center bg-stone-50 rounded-3xl border border-stone-200/80 space-y-4 max-w-lg mx-auto">' +
        '<div class="w-14 h-14 rounded-2xl bg-[#F9DFE8] text-[#647D69] flex items-center justify-center mx-auto">' +
          '<svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"/></svg>' +
        '</div>' +
        '<div class="space-y-1">' +
          '<h3 class="font-serif font-bold text-stone-900 text-xl">No bouquets match these filters</h3>' +
          '<p class="text-xs text-stone-500 leading-relaxed">Try adjusting your filters or explore another collection category.</p>' +
        '</div>' +
        '<div class="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">' +
          '<button type="button" onclick="window.suClearAllFilters()" class="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold transition">' +
            'Clear Filters' +
          '</button>' +
          '<button type="button" onclick="window.appRouter.navigate(\'builder\')" class="w-full sm:w-auto py-2.5 px-5 rounded-xl bg-white border border-stone-300 hover:bg-[#FFF9F5] text-[#647D69] text-xs font-bold transition inline-flex items-center justify-center gap-1.5">' +
            '<span>Build a Custom Bouquet Instead</span><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>';
    }

    return '<div class="pt-grid">' + list.map(bouquetCard).join('') + '</div>';
  }

  function renderCollectionsView() {
    var filtered = getFilteredBouquets();

    return '' +
      '<div class="py-12 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">' +
        '<!-- Header -->' +
        '<div class="text-center max-w-3xl mx-auto space-y-3">' +
          '<span class="inline-flex items-center px-4 py-1.5 rounded-full bg-[#EBF1EC] border border-[#E5ECE6]/80 text-[#647D69] text-xs font-bold tracking-wider uppercase">Umaira Florist &middot; Ready-Made Catalog</span>' +
          '<h1 class="font-serif text-4xl sm:text-5xl font-bold text-stone-900 tracking-tight" aria-label="Bouquet Collections">' + wrapTypewriterText('Bouquet Collections') + '</h1>' +
          '<p class="text-stone-600 text-sm sm:text-base leading-relaxed max-w-2xl mx-auto">' +
            'Fresh, ready-made bouquets handcrafted daily in Manila. Pick your favorite arrangement for delivery or pickup, or use our <button type="button" onclick="window.appRouter.navigate(\'builder\')" class="text-[#647D69] font-semibold underline underline-offset-4 decoration-rose-300 hover:decoration-rose-900">Bouquet Builder</button> to design your own custom bouquet.' +
          '</p>' +
        '</div>' +

        '<!-- Multi-Filter Bar -->' +
        '<section class="space-y-4">' +
          filterBarHtml() +
          '<div id="su-active-filters-container">' +
            activeFiltersHtml(filtered.length) +
          '</div>' +
        '</section>' +

        '<!-- Ready-Made Bouquets Grid (5 columns on desktop) -->' +
        '<section id="su-bouquet-grid">' +
          bouquetGridHtml() +
        '</section>' +
      '</div>';
  }

  // Interactive filter helpers for Collections
  window.suRefreshCollections = function () {
    var chips = document.getElementById('su-bouquet-chips');
    var activeContainer = document.getElementById('su-active-filters-container');
    var grid = document.getElementById('su-bouquet-grid');
    var filtered = getFilteredBouquets();

    if (chips) chips.innerHTML = categorySelectorHtml();
    if (activeContainer) activeContainer.innerHTML = activeFiltersHtml(filtered.length);
    if (grid) {
      grid.innerHTML = bouquetGridHtml();
      grid.classList.remove('animate-fade-in');
      void grid.offsetWidth;
      grid.classList.add('animate-fade-in');
    }
    if (window.FX) window.FX.refresh();
  };

  window.suSetBouquetCategory = function (cat) {
    collectionFilterState.category = cat;
    window.suRefreshCollections();
  };

  window.suSetFlowerType = function (flower) {
    collectionFilterState.flowerType = flower;
    window.suRefreshCollections();
  };

  window.suSetOccasion = function (occ) {
    collectionFilterState.occasion = occ;
    window.suRefreshCollections();
  };

  window.suSetSource = function (source) {
    collectionFilterState.source = source;
    window.suRefreshCollections();
  };

  window.suSetPriceRange = function (range) {
    collectionFilterState.budget = range;
    collectionFilterState.minCustomPrice = '';
    collectionFilterState.maxCustomPrice = '';
    window.suRefreshCollections();
  };

  window.suSetSortBy = function (sort) {
    collectionFilterState.sortBy = sort;
    window.suRefreshCollections();
  };

  window.suSetSearchQuery = function (query) {
    collectionFilterState.searchQuery = query;
    window.suRefreshCollections();
  };

  // Back to the unfiltered catalog (state only; the screen is redrawn by whoever calls this).
  function resetCollectionFilterState() {
    collectionFilterState.category = 'All Bouquets';
    collectionFilterState.flowerType = 'all';
    collectionFilterState.occasion = 'all';
    collectionFilterState.source = 'all';
    collectionFilterState.budget = 'all';
    collectionFilterState.sortBy = 'popular';
    collectionFilterState.searchQuery = '';
    collectionFilterState.minCustomPrice = '';
    collectionFilterState.maxCustomPrice = '';
  }

  window.suClearAllFilters = function () {
    resetCollectionFilterState();

    var searchInput = document.getElementById('su-bouquet-search-input');
    if (searchInput) searchInput.value = '';
    var flowerSelect = document.getElementById('su-filter-flower');
    if (flowerSelect) flowerSelect.value = 'all';
    var occSelect = document.getElementById('su-filter-occasion');
    if (occSelect) occSelect.value = 'all';
    var srcSelect = document.getElementById('su-filter-source');
    if (srcSelect) srcSelect.value = 'all';
    var bgSelect = document.getElementById('su-filter-budget');
    if (bgSelect) bgSelect.value = 'all';
    var sortSelect = document.getElementById('su-filter-sort');
    if (sortSelect) sortSelect.value = 'popular';

    window.suRefreshCollections();
  };

  // "Shop by Occasion" cards on the Home page: open the Ready-Made Bouquet catalog filtered to ONE
  // official occasion. It sets the same `occasion` filter as the catalog's Occasion dropdown, and clears
  // every other filter first so a leftover search/price filter can't hide that occasion's bouquets.
  window.suShopByOccasion = function (occasion) {
    if (OFFICIAL_OCCASIONS.indexOf(occasion) < 0) occasion = 'all';
    resetCollectionFilterState();
    collectionFilterState.occasion = occasion;
    if (window.appRouter) window.appRouter.navigate('collections');
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
  };

  // "View Full Catalog": the complete Ready-Made Bouquet catalog, with no filter applied.
  window.suViewFullCatalog = function () {
    resetCollectionFilterState();
    if (window.appRouter) window.appRouter.navigate('collections');
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
  };

  window.getFilteredBouquets = getFilteredBouquets;
  window.collectionFilterState = collectionFilterState;

  // Add stem to builder straight from Home flower archive
  window.suAddFlowerToBouquet = function (flowerId) {
    if (window.appState && window.appState.isAuthenticated && !window.appState.isAuthenticated()) {
      if (window.appRouter) window.appRouter.promptGuestSignIn('Please sign in to add flowers to your custom bouquet.', { type: 'add_stem', id: flowerId });
      return;
    }
    var fl = getFlowerById(flowerId);
    if (!fl) return;
    if (fl.availability === 'unavailable' || fl.availability === 'sold_out' || (fl.stockCount != null && fl.stockCount <= 0)) {
      if (typeof showToast === 'function') showToast('Sorry, ' + fl.name + ' is currently unavailable.', 'error');
      return;
    }
    if (window.builderCtrl) {
      window.builderCtrl.updateMainFlowerQty(flowerId, 1);
    }
    if (typeof showToast === 'function') {
      showToast('Added 1 stem of ' + fl.name + ' to your Custom Bouquet!', 'success');
    }
    if (window.appRouter) {
      window.appRouter.navigate('builder');
    }
  };

  window.suJump = function (id) {
    var el = document.getElementById('col-' + id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ---- Botanical Flower details window ---- */
  function closeFlowerModal() {
    var m = document.getElementById('su-flower-modal');
    if (m) m.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  window.suCloseFlowerModal = closeFlowerModal;

  window.suOpenFlowerModal = function (flowerId) {
    var fl = getFlowerById(flowerId);
    if (!fl) return;

    var modal = document.getElementById('su-flower-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'su-flower-modal';
      modal.className = 'fixed inset-0 z-80 hidden items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs';
      modal.addEventListener('click', function (e) { if (e.target === modal) closeFlowerModal(); });
      document.body.appendChild(modal);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeFlowerModal(); });
    }

    var isUnavailable = fl.availability === 'unavailable';
    var isOutOfStock = fl.availability === 'sold_out' || (fl.stockCount != null && fl.stockCount <= 0);
    var isSoldOut = isUnavailable || isOutOfStock;

    modal.innerHTML = '' +
      '<div class="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2" role="dialog" aria-modal="true" aria-label="' + fl.name + '">' +
        '<button type="button" onclick="window.suCloseFlowerModal()" aria-label="Close" class="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/95 border border-stone-200 text-stone-700 hover:bg-[#FFF9F5] flex items-center justify-center shadow-xs">' +
          '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M18 6L6 18"></path></svg></button>' +
        '<div class="bg-stone-100 md:rounded-l-3xl overflow-hidden min-h-[260px] flex items-center justify-center">' + window.UI.renderImage(fl.image, fl.name, 'w-full h-full object-cover', 'large') + '</div>' +
        '<div class="p-6 sm:p-7 space-y-3 flex flex-col justify-between">' +
          '<div>' +
            '<div class="flex items-center gap-2 mb-1">' +
              '<span class="px-2 py-0.5 rounded-md bg-[#EBF1EC] text-[#647D69] text-[10px] font-bold uppercase tracking-wider">' + fl.category + '</span>' +
              '<span class="text-xs text-stone-400 font-medium">' + fl.availability.replace('_', ' ') + '</span>' +
            '</div>' +
            '<h3 class="font-serif text-2xl font-bold text-stone-900 leading-tight">' + fl.name + '</h3>' +
            '<p class="text-xs text-stone-500 italic mt-0.5">' + fl.botanicalName + '</p>' +
            '<p class="font-bold text-[#647D69] text-2xl mt-2 price">' + formatCurrency(fl.price) + ' <span class="text-xs font-normal text-stone-500">/ stem</span></p>' +
            '<p class="text-xs text-stone-600 leading-relaxed mt-2">' + fl.description + '</p>' +
            '<div class="grid grid-cols-2 gap-2 text-xs text-stone-600 bg-stone-50 p-3 rounded-xl border border-stone-100 mt-3">' +
              '<div><strong>Stem:</strong> ' + fl.stemLength + '</div>' +
              '<div><strong>Vase Life:</strong> ' + fl.vaseLife + '</div>' +
              '<div><strong>Fragrance:</strong> ' + fl.fragrance + '</div>' +
              '<div><strong>Color:</strong> <span class="inline-block w-2.5 h-2.5 rounded-full align-middle ml-1" style="background-color: ' + (fl.color || '#f43f5e') + '"></span></div>' +
            '</div>' +
          '</div>' +
          '<div class="pt-3 border-t border-stone-100 flex flex-col gap-2">' +
            (isSoldOut ?
              '<button disabled class="w-full py-3 rounded-xl bg-stone-100 text-stone-400 font-bold text-xs cursor-not-allowed">' + (isUnavailable ? 'Currently Unavailable' : 'Currently Sold Out') + '</button>' :
              '<button type="button" onclick="window.suAddFlowerToBouquet(\'' + fl.id + '\'); window.suCloseFlowerModal();" class="w-full py-3 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold font-bold text-xs shadow-xs transition">+ Add to Bouquet</button>') +
            '<button type="button" onclick="window.suCloseFlowerModal(); window.appRouter.navigate(\'builder\');" class="w-full py-2.5 rounded-xl bg-white border border-stone-300 hover:bg-stone-50 text-stone-800 font-bold text-xs transition">Open Bouquet Studio</button>' +
          '</div>' +
        '</div>' +
      '</div>';

    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  };

  window.suBqQtyChange = function (delta) {
    var inp = document.getElementById('su-bq-qty');
    if (!inp) return;
    var current = parseInt(inp.value, 10) || 1;
    var max = parseInt(inp.getAttribute('max'), 10) || 50;
    var next = Math.max(1, Math.min(max, current + delta));
    inp.value = next;
  };

  /* ---- Bouquet details window ---- */
  function closeBouquet() {
    var m = document.getElementById('su-bq-modal');
    if (m) m.classList.remove('is-open');
    document.body.style.overflow = '';
  }
  window.suCloseBouquet = closeBouquet;

  window.suOpenBouquet = function (id) {
    var bq = findBouquet(id);
    if (!bq) return;
    var s = bq.specs || {};
    var rows = [];

    if (s.mainFlowers && Array.isArray(s.mainFlowers) && s.mainFlowers.length) {
      s.mainFlowers.forEach(function (f) {
        var fl = getFlowerById(f.id) || getGreeneryById(f.id) || getFillerById(f.id);
        var name = (fl && fl.name) || f.name || f.id;
        var qty = f.quantity ? f.quantity + '× ' : '';
        rows.push(qty + name);
      });
    }
    if (s.filler && getFillerById(s.filler)) {
      var fil = getFillerById(s.filler);
      if (!rows.some(function (r) { return r.indexOf(fil.name) >= 0; })) {
        rows.push(fil.name);
      }
    }
    if (s.greenery && getGreeneryById(s.greenery)) {
      var grn = getGreeneryById(s.greenery);
      if (!rows.some(function (r) { return r.indexOf(grn.name) >= 0; })) {
        rows.push(grn.name);
      }
    }
    if (s.materials && Array.isArray(s.materials) && s.materials.length) {
      s.materials.forEach(function (m) {
        var name = m.name || m.id;
        var qty = m.quantity ? m.quantity + '× ' : '';
        if (!rows.some(function (r) { return r.indexOf(name) >= 0; })) {
          rows.push(qty + name);
        }
      });
    }
    if (s.wrapping && typeof getWrappingById === 'function' && getWrappingById(s.wrapping)) {
      var wrp = getWrappingById(s.wrapping);
      if (!rows.some(function (r) { return r.indexOf(wrp.name) >= 0; })) {
        rows.push('Wrapping: ' + wrp.name);
      }
    }
    if (s.ribbon && typeof getRibbonById === 'function' && getRibbonById(s.ribbon)) {
      var rib = getRibbonById(s.ribbon);
      if (!rows.some(function (r) { return r.indexOf(rib.name) >= 0; })) {
        rows.push('Ribbon: ' + rib.name);
      }
    }
    if (s.card && typeof getCardDesignById === 'function' && getCardDesignById(s.card)) {
      var crd = getCardDesignById(s.card);
      if (!rows.some(function (r) { return r.indexOf(crd.name) >= 0; })) {
        rows.push('Greeting Card: ' + crd.name);
      }
    }

    if (!rows.length && bq.formula) {
      var parts = bq.formula.split(',').map(function (p) { return p.trim(); }).filter(Boolean);
      parts.forEach(function (p) {
        rows.push(p);
      });
    } else if (!rows.length && bq.mainFlowersText) {
      rows = bq.mainFlowersText.split(',').map(function (p) { return p.trim(); }).filter(Boolean);
    }

    var maxStock = 50;
    if (window.appState && typeof window.appState.maxQuantityFor === 'function') {
      maxStock = window.appState.maxQuantityFor({ id: bq.id, isCustom: false });
    }
    var isUnavailable = bq.availability === 'unavailable';
    var isSoldOut = isUnavailable || bq.availability === 'sold_out' || maxStock <= 0;
    var lowThreshold = (window.appState && typeof window.appState.getLowStockThreshold === 'function') ? window.appState.getLowStockThreshold() : 20;
    var isLimited = !isSoldOut && maxStock <= lowThreshold;

    var stockBadge = isUnavailable ?
      '<span class="px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-700 text-[11px] font-bold">Unavailable</span>' :
      (isSoldOut ?
        '<span class="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 text-[11px] font-bold">Sold Out</span>' :
        (isLimited ?
          '<span class="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 text-[11px] font-bold">Only ' + maxStock + ' left in stock</span>' :
          '<span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 text-[11px] font-bold">In Stock &middot; Fresh Daily</span>'));

    var occasionTags = bouquetOccasionTags(bq);
    var modal = document.getElementById('su-bq-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'su-bq-modal';
      modal.addEventListener('click', function (e) { if (e.target === modal) closeBouquet(); });
      document.body.appendChild(modal);
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeBouquet(); });
    }
    modal.innerHTML = '' +
      '<div class="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto grid grid-cols-1 md:grid-cols-2" role="dialog" aria-modal="true" aria-label="' + cardEsc(bq.name) + '">' +
        '<img src="/image/backgound/image-removebg-preview%20(2).png" alt="" class="decor-modal-tr" />' +
        '<img src="/image/backgound/image-removebg-preview%20(1).png" alt="" class="decor-modal-bl" />' +
        '<button type="button" onclick="window.suCloseBouquet()" aria-label="Close" class="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-white/95 border border-stone-200 text-stone-700 hover:bg-[#FFF9F5] flex items-center justify-center shadow-xs transition">' +
          '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 6l12 12M18 6L6 18"></path></svg></button>' +
        '<div class="bg-stone-100 md:rounded-l-3xl overflow-hidden min-h-[280px] relative">' +
          window.UI.renderImage(bq.image, bq.name, 'w-full h-full object-cover', 'large') +
          '<div class="absolute top-3 left-3 flex flex-wrap gap-1.5">' +
            (bq.badge ? '<span class="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-xs text-[#647D69] text-[11px] font-bold shadow-xs">' + bq.badge + '</span>' : '') +
            (bq.source && !bq.source.includes('Unverified') && !bq.source.includes('To Be Confirmed') ? '<span class="px-2 py-0.5 rounded-full bg-stone-900/85 backdrop-blur-xs text-white text-[10px] font-semibold">' + bq.source + '</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="p-6 sm:p-8 space-y-3.5 flex flex-col justify-between">' +
          '<div>' +
            '<div class="flex items-center gap-2 mb-1 flex-wrap">' +
              '<span class="px-2 py-0.5 rounded-md bg-[#EBF1EC] text-[#647D69] text-[10px] font-bold uppercase tracking-wider">' + cardEsc(bq.category || 'Curated Bouquet') + '</span>' +
            '</div>' +
            '<h3 class="font-serif text-2xl font-bold text-stone-900 leading-tight">' + cardEsc(bq.name) + '</h3>' +
            '<div class="flex items-center justify-between mt-2">' +
              '<p class="font-bold text-[#647D69] text-2xl price">' + formatCurrency(bq.price) + '</p>' +
              stockBadge +
            '</div>' +
            '<p class="text-xs text-stone-600 leading-relaxed mt-2">' + cardEsc(bq.description) + '</p>' +
            (occasionTags.length ?
              '<div class="mt-3 flex flex-wrap items-center gap-1.5">' +
                '<span class="text-[10px] font-bold text-stone-500 uppercase tracking-wider mr-1">Perfect for</span>' +
                occasionTags.map(function (t) {
                  return '<span class="px-2 py-0.5 rounded-full bg-[#F9DFE8] text-[#526B57] text-[10px] font-bold">' + cardEsc(t) + '</span>';
                }).join('') +
              '</div>' : '') +
            '<div class="mt-3.5 p-3.5 rounded-2xl bg-stone-50 border border-stone-100 space-y-2">' +
              '<span class="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">Bouquet Composition &amp; Arrangement</span>' +
              '<ul class="text-xs text-stone-700 space-y-1.5">' + rows.map(function (r) {
                return '<li class="flex items-center gap-2"><span class="w-1.5 h-1.5 rounded-full bg-[#647D69] shrink-0"></span><span>' + cardEsc(r) + '</span></li>';
              }).join('') + '</ul>' +
            '</div>' +
            '<p class="mt-3 inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-800"><span class="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0"></span>Manila Delivery &amp; Pickup available</p>' +
            (isSoldOut ? '' :
              '<div class="flex items-center gap-3 pt-3">' +
                '<span class="text-xs font-semibold text-stone-700">Quantity:</span>' +
                '<div class="flex items-center border border-stone-200 rounded-xl bg-stone-50 p-1">' +
                  '<button type="button" onclick="window.suBqQtyChange(-1)" class="w-8 h-8 rounded-lg bg-white border border-stone-200 text-stone-800 hover:bg-[#FFF9F5] font-bold transition flex items-center justify-center text-sm shadow-2xs">−</button>' +
                  '<input type="number" id="su-bq-qty" value="1" min="1" max="' + maxStock + '" readonly class="w-10 text-center font-bold text-stone-900 text-sm bg-transparent border-0 focus:ring-0">' +
                  '<button type="button" onclick="window.suBqQtyChange(1)" class="w-8 h-8 rounded-lg bg-[#647D69] text-white hover:bg-[#526B57] font-bold transition flex items-center justify-center text-sm shadow-2xs">+</button>' +
                '</div>' +
                '<span class="text-[11px] text-stone-400">Max ' + maxStock + '</span>' +
              '</div>') +
          '</div>' +
          '<div class="pt-3 border-t border-stone-100">' +
            (isSoldOut ?
              '<button disabled class="w-full py-3 rounded-xl bg-stone-100 text-stone-400 text-xs font-bold cursor-not-allowed">' + (isUnavailable ? 'Unavailable' : 'Sold Out') + '</button>' :
              '<div class="grid grid-cols-2 gap-2.5">' +
                '<button type="button" onclick="var q = parseInt(document.getElementById(\'su-bq-qty\').value, 10) || 1; window.suCloseBouquet(); window.appRouter.addPreMadeBouquetToCart(\'' + bq.id + '\', q);" class="w-full py-3 px-3 rounded-xl bg-white hover:bg-[#EBF1EC] text-[#647D69] hover:text-[#526B57] border border-[#647D69] hover:border-[#526B57] font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-2 hover:-translate-y-0.5 btn-tactile" title="Add to Cart">' +
                  '<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>' +
                  '<span>Add to Cart</span>' +
                '</button>' +
                '<button type="button" onclick="var q = parseInt(document.getElementById(\'su-bq-qty\').value, 10) || 1; window.suCloseBouquet(); window.appRouter.buyNowBouquet(\'' + bq.id + '\', q);" class="w-full py-3 px-3 rounded-xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-2 hover:-translate-y-0.5 btn-tactile" title="Buy Now">' +
                  '<svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' +
                  '<span>Buy Now</span>' +
                '</button>' +
              '</div>') +
          '</div>' +
        '</div>' +
      '</div>';
    modal.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };

  /* =====================================================================
     6. FLORIST CARE GUIDE — 3D PETAL-BASED SCROLL STORYTELLING EXPERIENCE
     ===================================================================== */
  function vase(id) { var f = getFlowerById(id); return f ? f.vaseLife : ''; }

  var CARE_STORY_STEPS = [
    {
      step: 1,
      meshName: 'rose_petal_4_0',
      petalName: 'Outer Rose Petal',
      badge: 'Step 01 &bull; Unboxing & Resting',
      title: 'Meet Your Flowers',
      subtitle: 'Welcome Your Bouquet Home',
      desc: 'When your bouquet arrives, carefully untie the wrapping so fresh air can circulate around the stems. Give your flowers 15 to 30 minutes in a cool room to rest before placing them in water.',
      secret: 'Don\'t remove the outer guard petals unless they are damaged. They naturally protect the inner bloom as the flower opens in your vase.'
    },
    {
      step: 2,
      meshName: 'sepal_0',
      petalName: 'Rose Sepal & Base',
      badge: 'Step 02 &bull; Fresh Water',
      title: 'Watering',
      subtitle: 'How Often to Change the Water',
      desc: 'Replace the vase water every 1 to 2 days. Freshly cut flowers drink a lot of water during their first couple of days. Use clean, room-temperature water and mix in the flower food packet provided.',
      secret: 'Rinse your vase with mild soap before adding fresh water. Clean water keeps bacteria away and helps the stems drink easily.'
    },
    {
      step: 3,
      meshName: 'rose_petal_4_2',
      petalName: 'Middle Petal Layer',
      badge: 'Step 03 &bull; Light & Placement',
      title: 'Sunlight',
      subtitle: 'Where to Place Your Flowers',
      desc: 'Place your vase in a cool spot with bright, indirect light. Direct sunlight can scorch delicate petals and cause them to wilt faster. Keep your bouquet away from air conditioners, electric fans, and direct heat.',
      secret: 'Keep your flowers away from ripening fruit like bananas and apples, which release natural gases that make flowers age faster.'
    },
    {
      step: 4,
      meshName: 'stem',
      petalName: 'Stem & Water Channel',
      badge: 'Step 04 &bull; Trimming Stems',
      title: 'Trimming Stems',
      subtitle: 'How to Trim Stems Correctly',
      desc: 'Trim about 1 to 2 cm off the bottom of each stem at a 45-degree angle. Use clean, sharp scissors or floral shears. Dull scissors can crush the stems and make it hard for the flowers to absorb water.',
      secret: 'Trimming the stems under running water prevents tiny air bubbles from blocking water flow into the blooms.'
    },
    {
      step: 5,
      meshName: 'rose_petal_1_2',
      petalName: 'Inner Bloom Core',
      badge: 'Step 05 &bull; Long-Lasting Freshness',
      title: 'Keeping Flowers Fresh',
      subtitle: 'Simple Daily Habits',
      desc: 'Remove any leaves that sit below the waterline so the water stays clean. Lightly mist the petals in the morning and gently pinch off any fading petals to let newer blooms open.',
      secret: 'Moving your arrangement to a cooler room overnight helps slow wilting and keeps your bouquet looking fresh for days longer.'
    }
  ];

  var care3d = {
    active: false,
    animId: null,
    renderer: null,
    scene: null,
    camera: null,
    rosePivot: null,
    roseModel: null,
    clock: null,
    baseRotX: -Math.PI / 2 + 0.12,
    basePosY: 0.1,
    targetScrollAngle: 0,
    currentScrollAngle: 0,
    manualRotY: 0,
    manualRotX: 0,
    dragVelX: 0,
    dragVelY: 0,
    isDragging: false,
    lastPointerX: 0,
    lastPointerY: 0,
    currentStep: 0,
    currentGlowingMesh: null,
    canvas: null,
    stageEl: null,
    cardEl: null,
    beaconEl: null,
    lineEl: null,
    dotEl: null,
    promptEl: null
  };

  function setupCareScene(scene, THREE) {
    var hemi = new THREE.HemisphereLight(0xfff8f8, 0xd8cccc, 0.42);
    scene.add(hemi);

    var ambient = new THREE.AmbientLight(0xffffff, 0.22);
    scene.add(ambient);

    var keyLight = new THREE.DirectionalLight(0xfff6ee, 2.4);
    keyLight.position.set(5, 8, 6);
    keyLight.castShadow = true;
    if (keyLight.shadow) {
      keyLight.shadow.mapSize.width = 1024;
      keyLight.shadow.mapSize.height = 1024;
      keyLight.shadow.camera.near = 0.5;
      keyLight.shadow.camera.far = 25;
      keyLight.shadow.camera.left = -3;
      keyLight.shadow.camera.right = 3;
      keyLight.shadow.camera.top = 3;
      keyLight.shadow.camera.bottom = -3;
      keyLight.shadow.bias = -0.0003;
    }
    scene.add(keyLight);

    var fillLight = new THREE.DirectionalLight(0xffffff, 0.55);
    fillLight.position.set(-6, 3, 2);
    scene.add(fillLight);

    var rimLight = new THREE.DirectionalLight(0xfff0f0, 0.70);
    rimLight.position.set(0, 6, -6);
    scene.add(rimLight);

    var bounceLight = new THREE.DirectionalLight(0xffffff, 0.30);
    bounceLight.position.set(0, -6, 2);
    scene.add(bounceLight);

    var shadowGeo = new THREE.PlaneGeometry(4.5, 4.5);
    var shadowMat = new THREE.ShadowMaterial({ opacity: 0.14 });
    var shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -1.6;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);
  }

  function applyRoseMaterials(root, THREE) {
    var matOuter = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#C41E3A'),
      roughness: 0.44,
      metalness: 0.03,
      side: THREE.DoubleSide
    });
    var matMid = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#A01830'),
      roughness: 0.40,
      metalness: 0.03,
      side: THREE.DoubleSide
    });
    var matInner = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#7B0D22'),
      roughness: 0.36,
      metalness: 0.03,
      side: THREE.DoubleSide
    });
    var matSepal = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#2E5916'),
      roughness: 0.52,
      metalness: 0.04,
      side: THREE.DoubleSide
    });
    var matLeaf = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#1E4A10'),
      roughness: 0.50,
      metalness: 0.05,
      side: THREE.DoubleSide
    });
    var matStem = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#244E12'),
      roughness: 0.60,
      metalness: 0.04,
      side: THREE.DoubleSide
    });

    root.traverse(function (child) {
      if (child.isMesh) {
        if (child.geometry && !child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
        }
        child.castShadow = true;
        child.receiveShadow = true;

        var name = (child.name || '').toLowerCase();
        var mat;
        if (name.indexOf('rose_petal_0_') === 0 || name.indexOf('rose_petal_1_') === 0) {
          mat = matInner.clone();
        } else if (name.indexOf('rose_petal_2_') === 0) {
          mat = matMid.clone();
        } else if (name.indexOf('rose_petal_') === 0) {
          mat = matOuter.clone();
        } else if (name.indexOf('sepal_') === 0) {
          mat = matSepal.clone();
        } else if (name.indexOf('leaf_') === 0) {
          mat = matLeaf.clone();
        } else if (name === 'stem' || name === 'receptacle') {
          mat = matStem.clone();
        } else {
          mat = matOuter.clone();
        }
        child.material = mat;
      }
    });
  }

  function loadRoseModel(pivot, onLoadComplete) {
    if (!window.THREE || !window.THREE.GLTFLoader) return;
    var loader = new window.THREE.GLTFLoader();
    loader.load('assets/models/Red_Rose_3D_Model.glb', function (gltf) {
      var model = gltf.scene;

      model.traverse(function (c) {
        if (c.isMesh && c.geometry) {
          c.geometry.computeVertexNormals();
        }
      });

      applyRoseMaterials(model, window.THREE);

      model.rotation.x = -Math.PI / 2 + 0.14;
      model.rotation.z = 0.05;

      var box = new window.THREE.Box3().setFromObject(model);
      var center = new window.THREE.Vector3();
      box.getCenter(center);
      model.position.sub(center);
      model.position.y += 0.2;

      var size = new window.THREE.Vector3();
      box.getSize(size);
      var maxDim = Math.max(size.x, size.y, size.z);
      var targetSize = 3.35;
      pivot.scale.setScalar(targetSize / (maxDim || 1));

      pivot.add(model);
      care3d.roseModel = model;

      if (typeof onLoadComplete === 'function') onLoadComplete();
    }, undefined, function (err) {
      console.warn('Could not load 3D rosebud model:', err);
      if (typeof onLoadComplete === 'function') onLoadComplete(err);
    });
  }

  function highlightPetal(meshName) {
    if (care3d.currentGlowingMesh && care3d.currentGlowingMesh.material) {
      if (window.gsap) {
        window.gsap.to(care3d.currentGlowingMesh.material.emissive, {
          r: 0, g: 0, b: 0, duration: 0.4
        });
      } else {
        care3d.currentGlowingMesh.material.emissive.setHex(0x000000);
        care3d.currentGlowingMesh.material.emissiveIntensity = 0;
      }
    }

    care3d.currentGlowingMesh = null;
    if (!meshName || !care3d.roseModel) return;

    var found = null;
    care3d.roseModel.traverse(function (c) {
      if (c.isMesh && c.name === meshName) found = c;
    });

    if (found && found.material) {
      care3d.currentGlowingMesh = found;
      found.material.emissive.set('#ff85a1');
      found.material.emissiveIntensity = 0;
      if (window.gsap) {
        window.gsap.to(found.material, { emissiveIntensity: 0.75, duration: 0.5 });
      } else {
        found.material.emissiveIntensity = 0.75;
      }
    }
  }

  function buildCardContent(s) {
    return '' +
      '<div class="p-6 sm:p-7 rounded-3xl bg-white/95 backdrop-blur-md border border-[#E5ECE6]/90 shadow-2xl space-y-3.5 max-w-sm sm:max-w-md">' +
        '<div class="flex items-center justify-between gap-3 border-b border-[#E5ECE6] pb-3">' +
          '<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase bg-[#EBF1EC] text-[#647D69] border border-[#E5ECE6]/80">' +
            '<svg class="w-3.5 h-3.5 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"/><path d="M12 6v6l4 2"/></svg>' +
            s.badge +
          '</span>' +
          '<span class="text-[11px] font-semibold text-rose-950 font-serif italic">' + s.petalName + '</span>' +
        '</div>' +
        '<div>' +
          '<h3 class="font-serif text-2xl sm:text-3xl font-bold text-stone-900 leading-tight">' + s.title + '</h3>' +
          '<p class="text-xs font-semibold text-[#647D69]/85 mt-1 tracking-wide">' + s.subtitle + '</p>' +
        '</div>' +
        '<p class="text-xs sm:text-sm text-stone-600 leading-relaxed">' + s.desc + '</p>' +
        '<div class="p-3.5 rounded-2xl bg-gradient-to-r from-rose-50 via-rose-50/60 to-white border border-[#E5ECE6] flex items-start gap-3">' +
          '<div class="w-7 h-7 rounded-xl bg-[#647D69] text-white font-bold flex items-center justify-center shrink-0 shadow-xs">' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>' +
          '</div>' +
          '<div class="text-xs text-stone-700 leading-relaxed">' +
            '<strong class="text-rose-950 font-semibold block mb-0.5">Florist Secret</strong>' +
            s.secret +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function updatePetalProjection() {
    if (!care3d.active || !care3d.camera || !care3d.roseModel) return;
    var stage = care3d.stageEl || document.getElementById('care-story-stage');
    if (!stage) return;
    var stageRect = stage.getBoundingClientRect();
    if (!stageRect.width || !stageRect.height) return;

    var currentStep = care3d.currentStep;
    var stepData = CARE_STORY_STEPS[currentStep - 1];

    var cardEl = care3d.cardEl || document.getElementById('care-emerging-card');
    var beaconEl = care3d.beaconEl || document.getElementById('care-petal-beacon');
    var lineEl = care3d.lineEl || document.getElementById('care-connecting-line');
    var dotEl = care3d.dotEl || document.getElementById('care-line-end-dot');
    var promptEl = care3d.promptEl || document.getElementById('care-scroll-prompt');

    if (currentStep === 0 || !stepData) {
      if (cardEl) {
        cardEl.style.opacity = '0';
        cardEl.style.transform = 'scale(0.15)';
        cardEl.style.pointerEvents = 'none';
      }
      if (beaconEl) beaconEl.style.opacity = '0';
      if (lineEl) lineEl.style.opacity = '0';
      if (dotEl) dotEl.style.opacity = '0';
      if (promptEl) promptEl.style.opacity = '1';
      return;
    }

    if (promptEl) promptEl.style.opacity = '0';

    var targetMesh = null;
    care3d.roseModel.traverse(function (c) {
      if (c.isMesh && c.name === stepData.meshName) targetMesh = c;
    });

    var worldPos = new window.THREE.Vector3();
    if (targetMesh) {
      var box = new window.THREE.Box3().setFromObject(targetMesh);
      box.getCenter(worldPos);
    } else {
      worldPos.set(0, 0.4, 0);
    }

    var proj = worldPos.clone().project(care3d.camera);
    if (proj.z >= 1.0) {
      if (lineEl) lineEl.style.opacity = '0';
      if (dotEl) dotEl.style.opacity = '0';
      if (beaconEl) beaconEl.style.opacity = '0';
      return;
    }

    var x = (proj.x * 0.5 + 0.5) * stageRect.width;
    var y = (-proj.y * 0.5 + 0.5) * stageRect.height;

    if (beaconEl) {
      beaconEl.style.transform = 'translate3d(' + x.toFixed(1) + 'px, ' + y.toFixed(1) + 'px, 0)';
      beaconEl.style.opacity = '1';
    }

    var isMobile = stageRect.width < 960;
    var cardAnchorX = 0, cardAnchorY = 0;

    if (cardEl) {
      cardEl.style.pointerEvents = 'auto';
      if (isMobile) {
        cardEl.style.left = '16px';
        cardEl.style.right = '16px';
        cardEl.style.bottom = '16px';
        cardEl.style.top = 'auto';
        cardEl.style.maxWidth = 'calc(100% - 32px)';

        cardAnchorX = stageRect.width * 0.5;
        cardAnchorY = Math.max(10, stageRect.height - (cardEl.offsetHeight || 260));
      } else {
        cardEl.style.bottom = 'auto';
        cardEl.style.maxWidth = '420px';

        if (x < stageRect.width * 0.5) {
          var cLeft = Math.min(stageRect.width - 450, Math.max(stageRect.width * 0.52, x + 120));
          var cTop = Math.max(70, Math.min(stageRect.height - 360, y - 100));
          cardEl.style.left = cLeft + 'px';
          cardEl.style.top = cTop + 'px';
          cardEl.style.right = 'auto';

          cardAnchorX = cLeft;
          cardAnchorY = cTop + 60;
        } else {
          var cLeft = Math.max(30, Math.min(stageRect.width * 0.44 - 420, x - 460));
          var cTop = Math.max(70, Math.min(stageRect.height - 360, y - 100));
          cardEl.style.left = cLeft + 'px';
          cardEl.style.top = cTop + 'px';
          cardEl.style.right = 'auto';

          cardAnchorX = cLeft + 420;
          cardAnchorY = cTop + 60;
        }
      }
    }

    if (lineEl && dotEl && cardAnchorX && cardAnchorY) {
      var cx = (x + cardAnchorX) * 0.5;
      var cy = Math.min(y, cardAnchorY) - (isMobile ? 30 : 55);
      var d = 'M ' + x.toFixed(1) + ' ' + y.toFixed(1) + ' Q ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + cardAnchorX.toFixed(1) + ' ' + cardAnchorY.toFixed(1);
      lineEl.setAttribute('d', d);
      lineEl.style.opacity = '1';

      dotEl.setAttribute('cx', cardAnchorX.toFixed(1));
      dotEl.setAttribute('cy', cardAnchorY.toFixed(1));
      dotEl.style.opacity = '1';
    }
  }

  function transitionToStoryStep(newStep) {
    if (care3d.currentStep === newStep) return;
    care3d.currentStep = newStep;

    var dots = document.querySelectorAll('.su-story-dot');
    dots.forEach(function (dot) {
      var stepNum = parseInt(dot.getAttribute('data-step'), 10);
      if (stepNum === newStep) dot.classList.add('is-active');
      else dot.classList.remove('is-active');
    });

    var cardEl = care3d.cardEl || document.getElementById('care-emerging-card');

    if (newStep === 0) {
      highlightPetal(null);
      if (cardEl) {
        if (window.gsap) {
          window.gsap.to(cardEl, { scale: 0.15, opacity: 0, duration: 0.35, ease: 'power2.in' });
        } else {
          cardEl.style.opacity = '0';
          cardEl.style.transform = 'scale(0.15)';
        }
      }
      return;
    }

    var stepData = CARE_STORY_STEPS[newStep - 1];
    if (!stepData) return;

    highlightPetal(stepData.meshName);

    if (cardEl) {
      cardEl.innerHTML = buildCardContent(stepData);

      if (window.gsap) {
        window.gsap.fromTo(cardEl,
          { scale: 0.2, opacity: 0 },
          { scale: 1.0, opacity: 1, duration: 0.55, ease: 'back.out(1.4)' }
        );
      } else {
        cardEl.style.opacity = '1';
        cardEl.style.transform = 'scale(1)';
      }
    }

    updatePetalProjection();
  }

  function onCareScroll() {
    var track = document.getElementById('care-story-track');
    if (!track) return;
    var rect = track.getBoundingClientRect();
    var windowH = window.innerHeight || 800;
    var maxScroll = rect.height - windowH;
    if (maxScroll <= 0) maxScroll = 1;
    var scrolled = -rect.top;
    var progress = Math.max(0, Math.min(1, scrolled / maxScroll));

    var step = 0;
    if (progress < 0.10) {
      step = 0;
    } else if (progress < 0.28) {
      step = 1;
    } else if (progress < 0.46) {
      step = 2;
    } else if (progress < 0.64) {
      step = 3;
    } else if (progress < 0.82) {
      step = 4;
    } else {
      step = 5;
    }

    care3d.targetScrollAngle = progress * Math.PI * 2 * 1.05;
    transitionToStoryStep(step);
  }

  window.suJumpToCareStoryStep = function (stepNum) {
    var track = document.getElementById('care-story-track');
    if (!track) return;
    var rect = track.getBoundingClientRect();
    var currentScrollY = window.pageYOffset || document.documentElement.scrollTop;
    var trackTop = currentScrollY + rect.top;
    var maxScroll = (track.offsetHeight || (window.innerHeight * 4)) - window.innerHeight;
    var fractions = [0.18, 0.36, 0.54, 0.72, 0.90];
    var frac = fractions[stepNum - 1] || 0.18;
    var targetY = trackTop + (maxScroll * frac);
    try {
      window.scrollTo({ top: targetY, behavior: 'smooth' });
    } catch (e) {
      window.scrollTo(0, targetY);
    }
  };

  function onCareResize() {
    if (!care3d.active || !care3d.renderer || !care3d.camera || !care3d.canvas) return;
    var stage = care3d.stageEl || document.getElementById('care-story-stage');
    if (!stage) return;
    var width = stage.clientWidth;
    var height = stage.clientHeight;
    if (!width || !height) return;
    care3d.camera.aspect = width / height;
    care3d.camera.updateProjectionMatrix();
    care3d.renderer.setSize(width, height);
    updatePetalProjection();
  }

  function setupDragInteraction(canvas) {
    if (!canvas) return;

    canvas.addEventListener('pointerdown', function (e) {
      care3d.isDragging = true;
      care3d.lastPointerX = e.clientX;
      care3d.lastPointerY = e.clientY;
      care3d.dragVelX = 0;
      care3d.dragVelY = 0;
      canvas.classList.add('cursor-grabbing');
      if (typeof canvas.setPointerCapture === 'function') {
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      }
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!care3d.isDragging) return;
      var deltaX = e.clientX - care3d.lastPointerX;
      var deltaY = e.clientY - care3d.lastPointerY;
      care3d.lastPointerX = e.clientX;
      care3d.lastPointerY = e.clientY;

      var speed = 0.008;
      care3d.manualRotY += deltaX * speed;
      care3d.manualRotX += deltaY * speed * 0.45;
      care3d.dragVelX = deltaX * speed;
      care3d.dragVelY = deltaY * speed * 0.45;
    });

    function endDrag(e) {
      if (!care3d.isDragging) return;
      care3d.isDragging = false;
      canvas.classList.remove('cursor-grabbing');
      if (typeof canvas.releasePointerCapture === 'function' && e && e.pointerId) {
        try { canvas.releasePointerCapture(e.pointerId); } catch (err) {}
      }
    }

    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
  }

  function animateCare3D() {
    if (!care3d.active) return;
    care3d.animId = requestAnimationFrame(animateCare3D);

    var elapsed = care3d.clock ? care3d.clock.getElapsedTime() : 0;

    care3d.currentScrollAngle += (care3d.targetScrollAngle - care3d.currentScrollAngle) * 0.08;

    if (!care3d.isDragging) {
      care3d.dragVelX *= 0.92;
      care3d.dragVelY *= 0.92;
      care3d.manualRotY += care3d.dragVelX;
      care3d.manualRotX += care3d.dragVelY;
      care3d.manualRotX *= 0.95;
    }

    if (care3d.rosePivot) {
      var totalY = care3d.currentScrollAngle + care3d.manualRotY;
      care3d.rosePivot.rotation.y = totalY;

      var breath = Math.sin(elapsed * 1.5) * 0.025;
      care3d.rosePivot.rotation.x = care3d.manualRotX + breath;
      care3d.rosePivot.position.y = care3d.basePosY + Math.sin(elapsed * 1.8) * 0.035;
    }

    updatePetalProjection();

    if (care3d.renderer && care3d.scene && care3d.camera) {
      care3d.renderer.render(care3d.scene, care3d.camera);
    }
  }

  function destroyCareGuide3D() {
    care3d.active = false;
    if (care3d.animId) {
      cancelAnimationFrame(care3d.animId);
      care3d.animId = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', onCareScroll);
      window.removeEventListener('resize', onCareResize);
    }
    if (care3d.renderer) {
      try {
        care3d.renderer.dispose();
      } catch (e) {}
      care3d.renderer = null;
    }
    care3d.scene = null;
    care3d.camera = null;
    care3d.rosePivot = null;
    care3d.roseModel = null;
    care3d.currentGlowingMesh = null;
    care3d.currentStep = 0;
  }

  function initCareGuide3D(attempt) {
    attempt = attempt || 0;
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    var canvas = document.getElementById('care-rose-canvas');
    if (!canvas || !canvas.getContext) return;

    if (!window.THREE || !window.THREE.GLTFLoader) {
      if (attempt < 12) {
        setTimeout(function () { initCareGuide3D(attempt + 1); }, 150);
        return;
      }
      var loading = document.getElementById('care-rose-loading');
      if (loading) {
        loading.innerHTML = '<div class="text-stone-500 text-xs text-center px-4">3D Viewer running in high-resolution photo mode.<br>Navigate steps using the buttons above.</div>';
      }
      return;
    }

    destroyCareGuide3D();

    var THREE = window.THREE;
    var stage = document.getElementById('care-story-stage');
    var width = (stage && stage.clientWidth) || window.innerWidth || 800;
    var height = (stage && stage.clientHeight) || window.innerHeight || 700;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.18, 4.8);
    camera.lookAt(0, 0, 0);

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
    } catch (e) {
      console.warn('WebGL initialization failed:', e);
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if (renderer.shadowMap) {
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    if (THREE.ACESFilmicToneMapping) {
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.0;
    }
    if (THREE.sRGBEncoding) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }

    setupCareScene(scene, THREE);

    var rosePivot = new THREE.Group();
    scene.add(rosePivot);

    care3d.active = true;
    care3d.renderer = renderer;
    care3d.scene = scene;
    care3d.camera = camera;
    care3d.rosePivot = rosePivot;
    care3d.canvas = canvas;
    care3d.clock = new THREE.Clock();
    care3d.stageEl = stage;
    care3d.cardEl = document.getElementById('care-emerging-card');
    care3d.beaconEl = document.getElementById('care-petal-beacon');
    care3d.lineEl = document.getElementById('care-connecting-line');
    care3d.dotEl = document.getElementById('care-line-end-dot');
    care3d.promptEl = document.getElementById('care-scroll-prompt');
    care3d.targetScrollAngle = 0;
    care3d.currentScrollAngle = 0;
    care3d.manualRotY = 0;
    care3d.manualRotX = 0;
    care3d.dragVelX = 0;
    care3d.dragVelY = 0;
    care3d.currentStep = 0;

    setupDragInteraction(canvas);

    loadRoseModel(rosePivot, function (err) {
      var loading = document.getElementById('care-rose-loading');
      if (loading) {
        loading.style.opacity = '0';
        setTimeout(function () { loading.style.display = 'none'; }, 400);
      }
    });

    window.addEventListener('scroll', onCareScroll, { passive: true });
    window.addEventListener('resize', onCareResize);

    onCareScroll();
    animateCare3D();
  }

  /* =====================================================================
     6. FLORIST GUIDE PAGE — EDUCATIONAL, INTERACTIVE & 3D READY
     ===================================================================== */
  var GUIDE_FLOWER_MEANINGS = [
    {
      id: 'red-rose',
      name: 'Red Rose',
      meaning: 'Love and romance.',
      definition: 'Red roses are the timeless symbol of deep love, passion, and heartfelt commitment. Giving a red rose is one of the most universal ways to express romantic feelings to someone truly special.',
      image: 'image/Fresh%20Flower/Red%20Rose.jpg'
    },
    {
      id: 'pink-rose',
      name: 'Pink Rose',
      meaning: 'Admiration and appreciation.',
      definition: 'Pink roses convey gentle affection, gratitude, and sincere joy. They are a thoughtful way to celebrate someone you cherish, say thank you, or express heartfelt admiration.',
      image: 'image/Fresh%20Flower/Pink%20Rose.jpg'
    },
    {
      id: 'white-rose',
      name: 'White Rose',
      meaning: 'Purity and new beginnings.',
      definition: 'White roses symbolize innocence, peace, and fresh chapters. Their clean elegance conveys sincere respect and harmony, making them perfect for weddings and meaningful milestones.',
      image: 'image/Fresh%20Flower/White%20Rose.jpg'
    },
    {
      id: 'sunflower',
      name: 'Sunflower',
      meaning: 'Happiness and positivity.',
      definition: 'Sunflowers radiate warmth, optimism, and joyful energy. Turning toward the sunlight, they bring an uplifting spirit to any arrangement and remind us to look on the bright side.',
      image: 'image/Fresh%20Flower/Sunflower.jpg'
    },
    {
      id: 'pink-tulip',
      name: 'Pink Tulip',
      meaning: 'Affection and elegance.',
      definition: 'Pink tulips represent effortless elegance, renewed joy, and heartfelt care. Their graceful blooms make them a lovely expression of warm affection and sincere appreciation.',
      image: 'image/Fresh%20Flower/Pink%20Tulip.jpg'
    },
    {
      id: 'stargazer-lily',
      name: 'Stargazer Lily',
      meaning: 'Ambition and prosperity.',
      definition: 'Stargazer lilies symbolize ambition, prosperity, and high aspirations. Their bold fragrance and striking appearance make them a powerful way to celebrate achievement and encourage dreams.',
      image: 'image/Fresh%20Flower/Stargazer%20Lily.jpg'
    },
    {
      id: 'hydrangea',
      name: 'Hydrangea',
      meaning: 'Gratitude and heartfelt emotion.',
      definition: 'Hydrangeas express deep gratitude, heartfelt emotion, and sincere understanding. Their full, lush clusters of petals are a beautiful way to show how much you truly appreciate someone.',
      image: 'image/Fresh%20Flower/Hydrangea.jpg'
    },
    {
      id: 'pink-peony',
      name: 'Pink Peony',
      meaning: 'Romance and good fortune.',
      definition: 'Pink peonies are associated with romance, prosperity, and good fortune. Their lush, full blooms symbolize a happy life and are often given to bring joy, blessings, and lasting love.',
      image: 'image/Fresh%20Flower/Pink%20Peony.jpg'
    },
    {
      id: 'gerbera-daisy',
      name: 'Gerbera Daisy',
      meaning: 'Cheerfulness and innocence.',
      definition: 'Gerbera daisies symbolize cheerfulness, innocent beauty, and pure joy. Their vibrant colors and simple petals bring an instant smile, perfect for celebrating life\'s brightest moments.',
      image: 'image/Fresh%20Flower/Gerbera%20Daisy.jpg'
    },
    {
      id: 'white-lily',
      name: 'White Lily',
      meaning: 'Elegance and purity.',
      definition: 'White lilies represent purity, refined elegance, and deep devotion. Their luminous petals have long been associated with grace and virtue, making them perfect for life\'s most meaningful ceremonies.',
      image: 'image/Fresh%20Flower/White%20Lily.jpg'
    }
  ];

  var GUIDE_CARE_TIPS = [
    {
      step: 1,
      title: 'Trim the Stems',
      tagline: 'Hydration Foundation',
      instruction: 'Cut approximately 1\u20132 cm from the stems at an angle using clean scissors or floral shears.',
      detail: 'Cutting at a 45-degree angle exposes more vascular channels and prevents stems from resting flat against the vase bottom, allowing continuous water absorption.',
      icon: '<svg class="w-5 h-5 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" x2="8.12" y1="4" y2="15.88"/><line x1="14.47" x2="20" y1="14.48" y2="20"/><line x1="8.12" x2="12" y1="8.12" y2="12"/></svg>'
    },
    {
      step: 2,
      title: 'Use Fresh Water',
      tagline: 'Clean Vessel',
      instruction: 'Place your flowers in a clean vase filled with fresh water.',
      detail: 'Wash your vase thoroughly with mild soap before filling with cool, clean tap water. Stir in the included flower food packet to provide vital nourishment and keep water fresh.',
      icon: '<svg class="w-5 h-5 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/></svg>'
    },
    {
      step: 3,
      title: 'Change the Water Regularly',
      tagline: 'Every 1 to 2 Days',
      instruction: 'Replace the water every one to two days to help prevent bacterial growth.',
      detail: 'Stagnant water quickly breeds bacteria that clog stem uptake channels. Rinsing your vase and refreshing the water every 24 to 48 hours keeps blooms radiant and long-lasting.',
      icon: '<svg class="w-5 h-5 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>'
    },
    {
      step: 4,
      title: 'Avoid Direct Sunlight',
      tagline: 'Optimal Placement',
      instruction: 'Keep your bouquet away from direct sunlight, heaters, and excessive heat.',
      detail: 'Intense noon sunlight, heaters, and air-conditioning drafts accelerate petal evaporation and wilting. Position your arrangement in a cool room with gentle, indirect natural light.',
      icon: '<svg class="w-5 h-5 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>'
    },
    {
      step: 5,
      title: 'Remove Submerged Leaves',
      tagline: 'Waterline Hygiene',
      instruction: 'Remove any leaves below the waterline to help keep the water clean.',
      detail: 'Any foliage sitting underwater quickly decays, releasing bacteria that cloud the water and cause unpleasant odors. Strip the lower stems bare before placing them into the vase.',
      icon: '<svg class="w-5 h-5 text-[#647D69]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg>'
    }
  ];

  var GUIDE_GIFTING_TIPS = [
    {
      num: '01',
      title: 'Consider Their Favorites',
      desc: 'Choose flowers or colors the recipient loves. Noticing their preferred shade or flower variety makes the gift feel personal and deeply considerate.'
    },
    {
      num: '02',
      title: 'Think About the Occasion',
      desc: 'Match the bouquet\u2019s style to the moment you\u2019re celebrating. Vibrant colors bring joy to celebrations, while pastel tones offer elegance and calm.'
    },
    {
      num: '03',
      title: 'Add a Personal Message',
      desc: 'A heartfelt note can make a simple bouquet more meaningful. Even a few sincere words written by hand turn fresh flowers into a cherished memory.'
    },
    {
      num: '04',
      title: 'Choose the Right Size',
      desc: 'Pick an arrangement that suits the occasion and your budget. From petite handheld posies to lavish centerpieces, balance and quality matter most.'
    },
    {
      num: '05',
      title: 'Plan Your Surprise',
      desc: 'Consider the best time and place to give your flowers. Whether hand-delivered in person or scheduled as a doorstep delivery, timing creates the magic.'
    }
  ];

  function renderFloristGuideView() {
    // 1. 3D Coverflow Flower Carousel Slides & Dots
    var carouselSlidesHtml = GUIDE_FLOWER_MEANINGS.map(function (f, i) {
      var n = GUIDE_FLOWER_MEANINGS.length;
      var d = i % n;
      if (d > Math.floor(n / 2)) d -= n;
      var initialPos = (d >= -2 && d <= 2) ? 'pos-' + d : 'pos-hidden';
      return '' +
        '<div role="tab" tabindex="' + (i === 0 ? '0' : '-1') + '" aria-selected="' + (i === 0 ? 'true' : 'false') + '" class="flower-coverflow-card ' + initialPos + '" data-slide-index="' + i + '" aria-label="' + f.name + ' \u2014 ' + f.meaning + '">' +
          '<img src="' + f.image + '" alt="' + f.name + '" loading="lazy" decoding="async" />' +
          '<div class="flower-card-sheen" aria-hidden="true"></div>' +
          '<div class="flower-carousel-slide-name">' +
            '<h4 class="font-serif font-bold text-base sm:text-lg tracking-tight drop-shadow-xs">' + f.name + '</h4>' +
          '</div>' +
        '</div>';
    }).join('');

    var carouselDotsHtml = GUIDE_FLOWER_MEANINGS.map(function (f, i) {
      var isFirst = i === 0;
      return '' +
        '<button type="button" onclick="window.selectCarouselFlower(' + i + ')" role="tab" class="flower-carousel-dot ' + (isFirst ? 'is-active' : '') + '" aria-label="Select ' + f.name + '" data-dot-index="' + i + '"></button>';
    }).join('');

    // 2. Care Tips Botanical Timeline Cards
    var careCardsHtml = GUIDE_CARE_TIPS.map(function (t, i) {
      var numStr = (t.step < 10 ? '0' : '') + t.step;
      var isFirst = i === 0;
      return '' +
        '<div class="care-step-row ' + (isFirst ? 'is-reached is-highlighted' : '') + '" data-step-row="' + t.step + '">' +
          '<div class="care-step-node" aria-hidden="true">' + numStr + '</div>' +
          '<article role="button" tabindex="0" aria-pressed="' + (isFirst ? 'true' : 'false') + '" onclick="window.selectGuide3DHotspot(' + t.step + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();window.selectGuide3DHotspot(' + t.step + ');}" data-reveal data-reveal-delay="' + (i * 80) + '" class="guide-care-step p-5 sm:p-6 rounded-2xl space-y-2.5 ' + (isFirst ? 'is-highlighted' : '') + '">' +
            '<div class="flex items-start justify-between gap-3">' +
              '<div class="flex items-center gap-3">' +
                '<span class="care-step-icon w-9 h-9 rounded-xl bg-[#EBF1EC] border border-[#E5ECE6] flex items-center justify-center text-[#647D69] shrink-0" data-step="' + t.step + '" aria-hidden="true">' +
                  t.icon +
                '</span>' +
                '<div>' +
                  '<h4 class="font-serif font-bold text-[#302C2A] text-lg sm:text-xl leading-snug tracking-tight">' + t.title + '</h4>' +
                  '<p class="font-serif italic text-xs sm:text-[13px] text-[#647D69] leading-tight">' + t.tagline + '</p>' +
                '</div>' +
              '</div>' +
            '</div>' +
            '<p class="text-[13.5px] sm:text-sm text-[#302C2A] leading-relaxed font-medium pt-0.5">' + t.instruction + '</p>' +
            '<p class="care-florist-note text-xs text-[#6E6864] leading-relaxed">' + t.detail + '</p>' +
          '</article>' +
        '</div>';
    }).join('');

    // 3. Gifting Tips Cards
    var giftingCardsHtml = GUIDE_GIFTING_TIPS.map(function (g, i) {
      return '' +
        '<div data-reveal data-reveal-delay="' + (i * 80) + '" class="guide-gifting-card p-6 rounded-3xl bg-white border border-[#E5ECE6] shadow-xs space-y-3">' +
          '<div class="w-10 h-10 rounded-2xl bg-[#EBF1EC] text-[#647D69] border border-[#E5ECE6] flex items-center justify-center font-serif font-bold text-sm shadow-2xs">' +
            g.num +
          '</div>' +
          '<h3 class="font-serif font-bold text-stone-900 text-base leading-snug">' + g.title + '</h3>' +
          '<p class="text-xs text-stone-600 leading-relaxed">' + g.desc + '</p>' +
        '</div>';
    }).join('');

    return '' +
      '<div class="py-8 sm:py-12 lg:py-16 px-4 sm:px-6 max-w-7xl mx-auto space-y-16 lg:space-y-24">' +

        '<!-- ===================================================================== -->' +
        '<!-- 3D COVERFLOW FLOWER MEANINGS CAROUSEL -->' +
        '<!-- ===================================================================== -->' +
        '<section id="guide-meanings" class="scroll-mt-28 space-y-8">' +
          '<div data-reveal class="text-center max-w-2xl mx-auto space-y-3">' +
            '<h2 class="su-typewriter font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 leading-[1.18] relative inline-block" data-typewriter="Every Flower Has a Meaning" aria-label="Every Flower Has a Meaning">' +
              '<span class="typewriter-ghost" aria-hidden="true">Every Flower Has a Meaning</span>' +
              '<span class="typewriter-visible" aria-hidden="true"><span class="typewriter-text"></span><span class="typewriter-cursor">|</span></span>' +
            '</h2>' +
            '<p class="text-stone-600 text-xs sm:text-sm leading-relaxed">' +
              'Flowers can express feelings that words sometimes cannot. Whether you\'re celebrating someone special or simply showing appreciation, choosing the right flowers can make your gift more meaningful.' +
            '</p>' +
          '</div>' +

          '<!-- 3D Coverflow Carousel Container -->' +
          '<div class="flower-carousel-outer relative max-w-5xl mx-auto px-2 sm:px-4">' +
            '<!-- Navigation Arrows (Smooth Infinite Looping) -->' +
            '<button type="button" id="flower-carousel-prev" onclick="window.carouselSlide(-1)" class="carousel-nav-btn absolute left-2 sm:left-5 top-[48%] -translate-y-1/2 z-30 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-white/95 text-[#302C2A] hover:text-[#647D69] border border-[#E5ECE6] hover:border-[#647D69] shadow-lg flex items-center justify-center transition-all cursor-pointer group backdrop-blur-sm" aria-label="Previous flower">' +
              '<svg class="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M15 19l-7-7 7-7"/></svg>' +
            '</button>' +

            '<button type="button" id="flower-carousel-next" onclick="window.carouselSlide(1)" class="carousel-nav-btn absolute right-2 sm:right-5 top-[48%] -translate-y-1/2 z-30 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-white/95 text-[#302C2A] hover:text-[#647D69] border border-[#E5ECE6] hover:border-[#647D69] shadow-lg flex items-center justify-center transition-all cursor-pointer group backdrop-blur-sm" aria-label="Next flower">' +
              '<svg class="w-5 h-5 sm:w-6 sm:h-6 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M9 5l7 7-7 7"/></svg>' +
            '</button>' +

            '<!-- 3D Coverflow Stage -->' +
            '<div id="flower-coverflow-stage" class="flower-coverflow-stage" role="region" aria-roledescription="carousel" aria-label="Flower meanings gallery" tabindex="0">' +
              carouselSlidesHtml +
            '</div>' +

            '<!-- Pagination Indicators -->' +
            '<div id="flower-carousel-dots" class="flex items-center justify-center gap-2 mt-4" role="tablist" aria-label="Flower carousel pagination">' +
              carouselDotsHtml +
            '</div>' +
          '</div>' +

          '<!-- Flower Information Directly Below Carousel (Editorial, No Card Box) -->' +
          '<div id="guide-flower-info" class="text-center max-w-2xl mx-auto pt-6 pb-2 space-y-2.5 guide-info-fade" aria-live="polite">' +
            '<p id="guide-info-counter" class="text-[11px] font-bold uppercase tracking-[0.22em] text-[#647D69]">' +
              'Botanical Symbolism &middot; 01 / ' + (GUIDE_FLOWER_MEANINGS.length < 10 ? '0' : '') + GUIDE_FLOWER_MEANINGS.length +
            '</p>' +
            '<h3 id="guide-info-name" class="font-serif font-bold text-3xl sm:text-4xl text-stone-900 tracking-tight leading-tight">' +
              GUIDE_FLOWER_MEANINGS[0].name +
            '</h3>' +
            '<p id="guide-info-meaning" class="text-base sm:text-lg font-serif italic text-[#647D69] font-semibold">' +
              GUIDE_FLOWER_MEANINGS[0].meaning +
            '</p>' +
            '<div class="w-10 h-px bg-[#647D69]/35 mx-auto my-1" aria-hidden="true"></div>' +
            '<p id="guide-info-desc" class="text-sm sm:text-base text-stone-600 leading-relaxed max-w-xl mx-auto pt-1">' +
              GUIDE_FLOWER_MEANINGS[0].definition +
            '</p>' +
          '</div>' +
        '</section>' +

        '<!-- DELICATE FLORAL DIVIDER -->' +
        '<div class="about-divider" aria-hidden="true"><span class="about-divider-glyph">&#10022;</span></div>' +

        '<!-- ===================================================================== -->' +
        '<!-- FLOWER CARE TIPS & 3D INTEGRATION AREA -->' +
        '<!-- ===================================================================== -->' +
        '<section id="guide-care" class="scroll-mt-28 space-y-10">' +
          '<div data-reveal class="text-center max-w-2xl mx-auto space-y-3">' +
            '<h2 class="su-typewriter font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 leading-[1.18] relative inline-block" data-typewriter="Keep Your Flowers Fresh" aria-label="Keep Your Flowers Fresh">' +
              '<span class="typewriter-ghost" aria-hidden="true">Keep Your Flowers Fresh</span>' +
              '<span class="typewriter-visible" aria-hidden="true"><span class="typewriter-text"></span><span class="typewriter-cursor">|</span></span>' +
            '</h2>' +
            '<p class="text-stone-600 text-xs sm:text-sm leading-relaxed">' +
              'Taking care of your flowers doesn\'t have to be complicated. A few simple steps can help your bouquet stay fresh and beautiful for longer.' +
            '</p>' +
          '</div>' +

          '<!-- 5 Flower Care Steps (Botanical Stem Timeline) -->' +
          '<div class="care-journey-timeline max-w-2xl mx-auto">' +
            '<div class="care-stem-track" aria-hidden="true"><div class="care-stem-fill"></div></div>' +
            careCardsHtml +
          '</div>' +
        '</section>' +

        '<!-- DELICATE FLORAL DIVIDER -->' +
        '<div class="about-divider" aria-hidden="true"><span class="about-divider-glyph">&#10022;</span></div>' +

        '<!-- ===================================================================== -->' +
        '<!-- FLOWER GIFTING TIPS -->' +
        '<!-- ===================================================================== -->' +
        '<section id="guide-gifting" class="scroll-mt-28 space-y-10">' +
          '<div data-reveal class="text-center max-w-2xl mx-auto space-y-3">' +
            '<h2 class="su-typewriter font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 leading-[1.18] relative inline-block" data-typewriter="Make Every Bouquet More Meaningful" aria-label="Make Every Bouquet More Meaningful">' +
              '<span class="typewriter-ghost" aria-hidden="true">Make Every Bouquet More Meaningful</span>' +
              '<span class="typewriter-visible" aria-hidden="true"><span class="typewriter-text"></span><span class="typewriter-cursor">|</span></span>' +
            '</h2>' +
            '<p class="text-stone-600 text-xs sm:text-sm leading-relaxed">' +
              'Giving flowers is about more than choosing a beautiful arrangement. A few thoughtful details can make your gift feel even more special.' +
            '</p>' +
          '</div>' +

          '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">' +
            giftingCardsHtml +
          '</div>' +

          '<!-- Closing Invitation -->' +
          '<div data-reveal class="p-8 sm:p-10 rounded-3xl bg-white border border-[#E5ECE6] text-center max-w-3xl mx-auto shadow-xs space-y-4">' +
            '<p class="font-serif italic text-base sm:text-lg text-stone-800">' +
              '\u201cFlowers are little reminders of the people, memories, and moments that matter most.\u201d' +
            '</p>' +
            '<div class="flex flex-wrap items-center justify-center gap-3 pt-2">' +
              '<button type="button" onclick="window.appRouter.navigate(\'collections\')" class="py-3 px-6 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-xs sm:text-sm shadow-xs transition">' +
                'Browse Ready-Made Bouquets' +
              '</button>' +
              '<button type="button" onclick="window.appRouter.navigate(\'builder\')" class="py-3 px-6 rounded-2xl bg-white hover:bg-[#FFF9F5] border border-[#E5ECE6] text-stone-800 text-xs sm:text-sm font-semibold transition">' +
                'Start a Custom Bouquet' +
              '</button>' +
            '</div>' +
          '</div>' +
        '</section>' +

      '</div>';
  }

  function initFloristGuidePage() {
    initAboutTypewriter();

    // Smooth guide scroll helper
    window.scrollGuideTo = function (sectionId) {
      var el = document.getElementById(sectionId);
      if (!el) return;
      var navOffset = 180;
      var bodyRect = document.body.getBoundingClientRect().top;
      var elementRect = el.getBoundingClientRect().top;
      var elementPosition = elementRect - bodyRect;
      var offsetPosition = elementPosition - navOffset;
      try {
        window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
      } catch (e) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    };

    // Flower meaning selection helper with sliding selector & sliding info panel
    var currentGuideFlowerId = (GUIDE_FLOWER_MEANINGS[0] && GUIDE_FLOWER_MEANINGS[0].id) || 'red-rose';
    var isTransitioningGuideFlower = false;

    // =========================================================================
    // 3D Coverflow Flower Carousel Controller (Infinite Smooth Loop)
    // =========================================================================
    var currentCarouselIndex = 0;

    function updateCoverflowCards() {
      var stage = document.getElementById('flower-coverflow-stage');
      if (!stage) return;
      var cards = stage.querySelectorAll('.flower-coverflow-card');
      if (!cards || !cards.length) return;

      var total = GUIDE_FLOWER_MEANINGS.length;
      cards.forEach(function (card, i) {
        var diff = (i - currentCarouselIndex + total) % total;
        if (diff > Math.floor(total / 2)) diff -= total;

        card.classList.remove('pos--2', 'pos--1', 'pos-0', 'pos-1', 'pos-2', 'pos-hidden');
        if (diff !== 0) {
          card.style.removeProperty('--card-rx');
          card.style.removeProperty('--card-ry');
        }
        if (diff >= -2 && diff <= 2) {
          card.classList.add('pos-' + diff);
          card.setAttribute('aria-selected', diff === 0 ? 'true' : 'false');
          card.setAttribute('tabindex', diff === 0 ? '0' : '-1');
        } else {
          card.classList.add('pos-hidden');
          card.setAttribute('aria-selected', 'false');
          card.setAttribute('tabindex', '-1');
        }
      });
    }

    window.selectCarouselFlower = function (index) {
      if (index < 0 || index >= GUIDE_FLOWER_MEANINGS.length) return;
      currentCarouselIndex = (index + GUIDE_FLOWER_MEANINGS.length) % GUIDE_FLOWER_MEANINGS.length;
      var flower = GUIDE_FLOWER_MEANINGS[currentCarouselIndex];

      // Update 3D card layout and depth
      updateCoverflowCards();

      // Update pagination indicators
      var dotsContainer = document.getElementById('flower-carousel-dots');
      if (dotsContainer) {
        var dots = dotsContainer.querySelectorAll('.flower-carousel-dot');
        dots.forEach(function (dot, i) {
          if (i === currentCarouselIndex) {
            dot.classList.add('is-active');
            dot.setAttribute('aria-current', 'true');
          } else {
            dot.classList.remove('is-active');
            dot.removeAttribute('aria-current');
          }
        });
      }

      // Update the editorial meaning display directly underneath
      var infoContainer = document.getElementById('guide-flower-info');
      var counterEl = document.getElementById('guide-info-counter');
      var nameEl = document.getElementById('guide-info-name');
      var meaningEl = document.getElementById('guide-info-meaning');
      var descEl = document.getElementById('guide-info-desc');

      if (infoContainer && nameEl && meaningEl && descEl) {
        infoContainer.classList.remove('guide-info-fade');
        void infoContainer.offsetWidth; // Reflow to re-trigger smooth transition
        if (counterEl) {
          var totalLen = GUIDE_FLOWER_MEANINGS.length;
          var posNum = currentCarouselIndex + 1;
          counterEl.innerHTML = 'Botanical Symbolism &middot; ' + (posNum < 10 ? '0' : '') + posNum + ' / ' + (totalLen < 10 ? '0' : '') + totalLen;
        }
        nameEl.textContent = flower.name;
        meaningEl.textContent = flower.meaning;
        descEl.textContent = flower.definition;
        infoContainer.classList.add('guide-info-fade');
      }
    };

    window.carouselSlide = function (dir) {
      var nextIdx = (currentCarouselIndex + dir + GUIDE_FLOWER_MEANINGS.length) % GUIDE_FLOWER_MEANINGS.length;
      window.selectCarouselFlower(nextIdx);
    };

    // Backward compatibility aliases
    window.selectGuideFlower = function (id) {
      var idx = GUIDE_FLOWER_MEANINGS.findIndex(function (f) {
        return f.id === id || f.name.toLowerCase() === (id || '').toLowerCase();
      });
      if (idx !== -1) window.selectCarouselFlower(idx);
    };
    window.slideGuideFlower = window.carouselSlide;

    function initFlowerCarouselGestures() {
      var stage = document.getElementById('flower-coverflow-stage');
      if (!stage || stage._hasTouchInit) return;
      stage._hasTouchInit = true;

      var startX = 0;
      var currentX = 0;
      var isDragging = false;
      var suppressNextClick = false;
      var pointerDownCard = null;
      var reducedMotion = false;
      var finePointer = false;
      try {
        reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
      } catch (e) {}

      function startDrag(x, target) {
        startX = x;
        currentX = x;
        isDragging = true;
        suppressNextClick = false;
        pointerDownCard = target && target.closest ? target.closest('.flower-coverflow-card') : null;
        stage.classList.add('is-dragging');
      }

      function moveDrag(x) {
        if (!isDragging) return;
        currentX = x;
        if (Math.abs(currentX - startX) > 12) {
          suppressNextClick = true;
        }
      }

      function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        stage.classList.remove('is-dragging');
        var deltaX = currentX - startX;
        if (deltaX < -35) {
          window.carouselSlide(1);
        } else if (deltaX > 35) {
          window.carouselSlide(-1);
        } else if (!suppressNextClick && pointerDownCard) {
          var idx = parseInt(pointerDownCard.getAttribute('data-slide-index'), 10);
          if (!isNaN(idx)) window.selectCarouselFlower(idx);
        }
        pointerDownCard = null;
      }

      // Unified Pointer Events when supported (mouse drag + touch swipe), fallback to touch/mouse
      if (window.PointerEvent) {
        stage.addEventListener('pointerdown', function (e) {
          if (e.button && e.button !== 0) return;
          startDrag(e.clientX, e.target);
        });
        window.addEventListener('pointermove', function (e) {
          if (isDragging) moveDrag(e.clientX);
        }, { passive: true });
        window.addEventListener('pointerup', endDrag, { passive: true });
        window.addEventListener('pointercancel', endDrag, { passive: true });
      } else {
        stage.addEventListener('touchstart', function (e) {
          if (e.touches && e.touches[0]) startDrag(e.touches[0].clientX, e.target);
        }, { passive: true });
        stage.addEventListener('touchmove', function (e) {
          if (e.touches && e.touches[0]) moveDrag(e.touches[0].clientX);
        }, { passive: true });
        stage.addEventListener('touchend', endDrag, { passive: true });
      }

      // Desktop micro-tilt on the active front flower card following cursor
      if (finePointer && !reducedMotion) {
        stage.addEventListener('mousemove', function (e) {
          if (isDragging) return;
          var activeCard = stage.querySelector('.flower-coverflow-card.pos-0');
          if (!activeCard) return;
          var rect = activeCard.getBoundingClientRect();
          if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
            activeCard.style.setProperty('--card-rx', '0deg');
            activeCard.style.setProperty('--card-ry', '0deg');
            return;
          }
          var nx = ((e.clientX - rect.left) / Math.max(1, rect.width) - 0.5) * 2;
          var ny = ((e.clientY - rect.top) / Math.max(1, rect.height) - 0.5) * 2;
          activeCard.style.setProperty('--card-ry', (nx * 3.5).toFixed(2) + 'deg');
          activeCard.style.setProperty('--card-rx', (-ny * 3).toFixed(2) + 'deg');
        }, { passive: true });

        stage.addEventListener('mouseleave', function () {
          var activeCard = stage.querySelector('.flower-coverflow-card.pos-0');
          if (activeCard) {
            activeCard.style.setProperty('--card-rx', '0deg');
            activeCard.style.setProperty('--card-ry', '0deg');
          }
        }, { passive: true });
      }

      // Keyboard Arrow / Home / End navigation
      stage.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          window.carouselSlide(1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          window.carouselSlide(-1);
        } else if (e.key === 'Home') {
          e.preventDefault();
          window.selectCarouselFlower(0);
        } else if (e.key === 'End') {
          e.preventDefault();
          window.selectCarouselFlower(GUIDE_FLOWER_MEANINGS.length - 1);
        }
      });
    }

    setTimeout(function () {
      window.selectCarouselFlower(0);
      initFlowerCarouselGestures();
    }, 50);

    // Care step highlighter (highlight the active card & node in the journey timeline)
    window.selectGuide3DHotspot = function (stepNum) {
      document.querySelectorAll('.care-step-row').forEach(function (row, idx) {
        var active = idx + 1 === stepNum;
        var card = row.querySelector('.guide-care-step');
        row.classList.toggle('is-highlighted', active);
        if (card) {
          card.classList.toggle('is-highlighted', active);
          card.setAttribute('aria-pressed', active ? 'true' : 'false');
        }
      });
    };

    // =========================================================================
    // Interactive 3D Viewer for guide-3d-flower-viewport
    // =========================================================================
    var guide3d = {
      active: false,
      animId: null,
      renderer: null,
      scene: null,
      camera: null,
      pivot: null,
      model: null,
      clock: null,
      rotX: 0.15,  rotY: 0.0,
      targetRotX: 0.15, targetRotY: 0.0,
      zoom: 5.0, targetZoom: 5.0,
      pivotY: 0.0, targetPivotY: 0.0,
      isAnimating: false,
      isDragging: false,
      lastX: 0, lastY: 0,
      velX: 0, velY: 0,
      idleRot: true
    };
    window._guide3d = guide3d;

    function destroyGuide3D() {
      guide3d.active = false;
      if (guide3d.animId) { cancelAnimationFrame(guide3d.animId); guide3d.animId = null; }
      if (guide3d.renderer) { guide3d.renderer.dispose(); guide3d.renderer = null; }
      guide3d.scene = null; guide3d.camera = null; guide3d.pivot = null; guide3d.model = null;
    }

    function initGuide3DViewer(attempt) {
      attempt = attempt || 0;
      var canvas = document.getElementById('guide3d-canvas');
      if (!canvas) return;

      if (!window.THREE || !window.THREE.GLTFLoader) {
        if (attempt < 15) { setTimeout(function () { initGuide3DViewer(attempt + 1); }, 200); return; }
        // Fallback
        var fb = document.getElementById('guide3d-fallback');
        var ld = document.getElementById('guide3d-loading');
        if (fb) { fb.style.display = 'flex'; }
        if (ld) { ld.style.opacity = '0'; setTimeout(function () { if (ld) ld.style.display = 'none'; }, 400); }
        return;
      }

      destroyGuide3D();

      var THREE = window.THREE;
      var W = canvas.clientWidth || 420;
      var H = canvas.clientHeight || 360;

      var scene = new THREE.Scene();

      var camera = new THREE.PerspectiveCamera(36, W / H, 0.05, 100);
      camera.position.set(0, 0, guide3d.zoom);
      camera.lookAt(0, 0, 0);

      var renderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
      } catch (e) { return; }

      renderer.setSize(W, H);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if (renderer.shadowMap) { renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap; }
      if (THREE.ACESFilmicToneMapping) { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0; }
      if (THREE.sRGBEncoding) { renderer.outputEncoding = THREE.sRGBEncoding; }

      // Lighting — keep ambient low so dark reds stay saturated
      scene.add(new THREE.AmbientLight(0xffffff, 0.22));
      var hemi = new THREE.HemisphereLight(0xfff8f8, 0xd8cccc, 0.42); scene.add(hemi);
      var key = new THREE.DirectionalLight(0xfff6ee, 2.4); key.position.set(4, 7, 5); key.castShadow = true; scene.add(key);
      var fill = new THREE.DirectionalLight(0xffffff, 0.55); fill.position.set(-5, 2, 2); scene.add(fill);
      var rim = new THREE.DirectionalLight(0xfff0f0, 0.70); rim.position.set(0, 5, -5); scene.add(rim);

      var pivot = new THREE.Group();
      scene.add(pivot);

      guide3d.active = true;
      guide3d.renderer = renderer;
      guide3d.scene = scene;
      guide3d.camera = camera;
      guide3d.pivot = pivot;
      guide3d.clock = new THREE.Clock();

      // Load model
      var loader = new THREE.GLTFLoader();
      loader.load('assets/models/Red_Rose_3D_Model.glb', function (gltf) {
        var model = gltf.scene;
        model.traverse(function (c) {
          if (c.isMesh) {
            if (c.geometry && !c.geometry.attributes.normal) c.geometry.computeVertexNormals();
            c.castShadow = true; c.receiveShadow = true;
          }
        });
        applyRoseMaterials(model, THREE);

        // Auto-fit
        var box = new THREE.Box3().setFromObject(model);
        var center = new THREE.Vector3(); box.getCenter(center);
        var size = new THREE.Vector3(); box.getSize(size);
        var maxDim = Math.max(size.x, size.y, size.z);
        model.position.sub(center);
        pivot.scale.setScalar(3.4 / (maxDim || 1));

        pivot.add(model);
        guide3d.model = model;

        // Hide loading
        var ld = document.getElementById('guide3d-loading');
        if (ld) { ld.style.opacity = '0'; setTimeout(function () { if (ld) ld.style.display = 'none'; }, 400); }

        // Auto-select hotspot 1 to initialize display
        window.selectGuide3DHotspot(1);

      }, undefined, function () {
        var ld = document.getElementById('guide3d-loading');
        var fb = document.getElementById('guide3d-fallback');
        if (ld) { ld.style.opacity = '0'; setTimeout(function () { if (ld) ld.style.display = 'none'; }, 300); }
        if (fb) fb.style.display = 'flex';
      });

      // Animation loop
      function animate() {
        if (!guide3d.active) return;
        guide3d.animId = requestAnimationFrame(animate);

        var dt = Math.min(guide3d.clock.getDelta(), 0.05);

        // Smooth lerp camera rotation and zoom
        var ease = 1 - Math.pow(0.04, dt);
        guide3d.rotX    += (guide3d.targetRotX  - guide3d.rotX)    * ease;
        guide3d.rotY    += (guide3d.targetRotY  - guide3d.rotY)    * ease;
        guide3d.zoom    += (guide3d.targetZoom  - guide3d.zoom)    * ease;
        guide3d.pivotY  += (guide3d.targetPivotY - guide3d.pivotY) * ease;

        // Idle slow rotation when not interacting
        if (guide3d.idleRot && !guide3d.isDragging && !guide3d.isAnimating) {
          guide3d.targetRotY += 0.0025;
        }

        // Apply inertia after drag
        if (!guide3d.isDragging) {
          guide3d.targetRotY += guide3d.velX;
          guide3d.targetRotX += guide3d.velY;
          guide3d.velX *= 0.90;
          guide3d.velY *= 0.90;
          if (Math.abs(guide3d.velX) < 0.0001 && Math.abs(guide3d.velY) < 0.0001) {
            guide3d.velX = 0; guide3d.velY = 0;
          }
        }

        // Clamp X rotation
        guide3d.targetRotX = Math.max(-0.65, Math.min(0.75, guide3d.targetRotX));

        // Apply to pivot
        pivot.rotation.x = guide3d.rotX;
        pivot.rotation.y = guide3d.rotY;
        pivot.position.y = guide3d.pivotY * pivot.scale.x;

        // Camera distance
        camera.position.z = guide3d.zoom;
        camera.lookAt(0, guide3d.pivotY * 0.3, 0);

        renderer.render(scene, camera);
      }
      animate();

      // Drag interaction
      var hintTimeout;
      function hideHint() {
        var h = document.getElementById('guide3d-hint');
        if (h) h.style.opacity = '0';
      }

      function onPointerDown(e) {
        // Only begin drag when the touch/click starts on the canvas itself
        guide3d.isDragging = true;
        guide3d.idleRot = false;
        guide3d.isAnimating = false;
        guide3d.velX = 0; guide3d.velY = 0;
        guide3d.lastX = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
        guide3d.lastY = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
        canvas.style.cursor = 'grabbing';
        clearTimeout(hintTimeout);
        hideHint();
        // Prevent the initial touch from triggering a page scroll
        if (e.cancelable) e.preventDefault();
      }
      function onPointerMove(e) {
        if (!guide3d.isDragging) return;
        var cx = e.clientX || (e.touches && e.touches[0] && e.touches[0].clientX) || 0;
        var cy = e.clientY || (e.touches && e.touches[0] && e.touches[0].clientY) || 0;
        var dx = cx - guide3d.lastX;
        var dy = cy - guide3d.lastY;
        guide3d.velX = dx * 0.008;
        guide3d.velY = dy * 0.006;
        guide3d.targetRotY += dx * 0.008;
        guide3d.targetRotX += dy * 0.006;
        guide3d.lastX = cx; guide3d.lastY = cy;
        // Prevent page scroll only while actively dragging the rose
        if (e.cancelable) e.preventDefault();
      }
      function onPointerUp() {
        guide3d.isDragging = false;
        canvas.style.cursor = 'grab';
        hintTimeout = setTimeout(function () { guide3d.idleRot = true; }, 3500);
      }
      // No wheel/scroll handler — mouse wheel scrolls the page normally

      canvas.addEventListener('mousedown', onPointerDown);
      canvas.addEventListener('touchstart', onPointerDown, { passive: false });
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('touchmove', onPointerMove, { passive: false });
      window.addEventListener('mouseup', onPointerUp);
      window.addEventListener('touchend', onPointerUp);

      // Reset button
      var resetBtn = document.getElementById('guide3d-reset');
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          guide3d.targetRotX = 0.15;
          guide3d.targetRotY = 0.0;
          guide3d.targetZoom = 5.0;
          guide3d.targetPivotY = 0.0;
          guide3d.idleRot = true;
        });
      }

      // Zoom buttons — independent of scroll
      var zoomInBtn  = document.getElementById('guide3d-zoom-in');
      var zoomOutBtn = document.getElementById('guide3d-zoom-out');
      function stepZoom(delta) {
        guide3d.targetZoom = Math.max(2.5, Math.min(9.0, guide3d.targetZoom + delta));
        guide3d.idleRot = false;
        clearTimeout(hintTimeout);
        hintTimeout = setTimeout(function () { guide3d.idleRot = true; }, 3500);
      }
      if (zoomInBtn)  zoomInBtn.addEventListener('click',  function () { stepZoom(-0.6); });
      if (zoomOutBtn) zoomOutBtn.addEventListener('click', function () { stepZoom( 0.6); });

      // Resize
      window.addEventListener('resize', function () {
        if (!guide3d.renderer) return;
        var w = canvas.clientWidth || 420;
        var h = canvas.clientHeight || 360;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
    }

    // Scroll-linked botanical stem progress + node bloom for the care timeline
    function initCareJourneyScroll() {
      var timeline = document.querySelector('.care-journey-timeline');
      var stemFill = document.querySelector('.care-stem-fill');
      var rows = Array.prototype.slice.call(document.querySelectorAll('.care-step-row'));
      if (!timeline || !rows.length) return;

      var prefersReduced = false;
      try { prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
      if (prefersReduced) {
        rows.forEach(function (r) { r.classList.add('is-reached'); });
        if (stemFill) stemFill.style.transform = 'scaleY(1)';
        return;
      }

      var ticking = false;
      function clamp(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

      function updateProgress() {
        var viewH = window.innerHeight || 800;
        var triggerY = viewH * 0.68;

        var firstRect = rows[0].getBoundingClientRect();
        var lastRect = rows[rows.length - 1].getBoundingClientRect();
        var startY = firstRect.top + 28;
        var endY = lastRect.top + 28;
        var span = Math.max(1, endY - startY);
        var stemProgress = clamp((triggerY - startY) / span);

        if (stemFill) {
          stemFill.style.transform = 'scaleY(' + stemProgress.toFixed(4) + ')';
        }

        rows.forEach(function (row) {
          var rect = row.getBoundingClientRect();
          var nodeY = rect.top + 28;
          if (nodeY <= triggerY + 24) row.classList.add('is-reached');
          else row.classList.remove('is-reached');
        });

        ticking = false;
      }

      function onScroll() {
        if (!ticking) {
          requestAnimationFrame(updateProgress);
          ticking = true;
        }
      }

      if (window._careScrollOff) { try { window._careScrollOff(); } catch (e) {} }
      window.addEventListener('scroll', onScroll, { passive: true });
      window._careScrollOff = function () { window.removeEventListener('scroll', onScroll); };

      updateProgress();
    }
    initCareJourneyScroll();

    if (window.FX) {
      window.FX.refresh();
    }
  }

  /* =====================================================================
     6.5 ABOUT US PAGE — DEDICATED BRAND STORY, PHILOSOPHY & WORKSHOP
     ===================================================================== */
  /* =====================================================================
     6.5 ABOUT US PAGE — EDITORIAL BRAND STORY & CRAFT
     ===================================================================== */
  function renderAboutView() {
    return '' +
      '<div class="py-12 sm:py-16 lg:py-24 px-6 max-w-6xl mx-auto space-y-20 lg:space-y-28">' +

        '<!-- SECTION 1: OUR STORY -->' +
        '<section class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">' +
          '<div data-reveal class="lg:col-span-7 space-y-6 text-left">' +
            '<div class="about-eyebrow">' +
              '<span class="w-2 h-2 rounded-full bg-[#647D69] animate-pulse"></span>' +
              '<span>Our Story &middot; Umaira Florist</span>' +
            '</div>' +
            '<h1 class="su-typewriter font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 leading-[1.18] relative inline-block" data-typewriter="Every Bloom Has a Story" aria-label="Every Bloom Has a Story">' +
              '<span class="typewriter-ghost" aria-hidden="true">Every Bloom Has a Story</span>' +
              '<span class="typewriter-visible" aria-hidden="true"><span class="typewriter-text"></span><span class="typewriter-cursor">|</span></span>' +
            '</h1>' +
            '<div class="space-y-5 text-stone-600 about-editorial-p">' +
              '<p>' +
                'At Umaira Florist, we believe that flowers have a beautiful way of expressing what words sometimes cannot. Whether it\u2019s love, appreciation, congratulations, or simply a thoughtful gesture, every bouquet carries a story worth sharing.' +
              '</p>' +
              '<p>' +
                'Umaira Florist was created with the idea of making floral gifting more personal and meaningful. We wanted to create a space where people could find thoughtfully arranged flowers and express their feelings through something beautiful.' +
              '</p>' +
              '<p class="border-l-2 border-[#647D69]/40 pl-4 sm:pl-5 italic text-stone-700 bg-[#EBF1EC]/30 py-2 rounded-r-xl">' +
                'From carefully selected blooms to personalized arrangements, we aim to make every bouquet feel special. Because to us, flowers are not just gifts. They are little reminders of the people, memories, and moments that matter most.' +
              '</p>' +
            '</div>' +
          '</div>' +
          '<div data-reveal class="lg:col-span-5 flex justify-center">' +
            '<div class="relative w-full max-w-md">' +
              '<div class="su-hero-halo" aria-hidden="true" style="inset:-15% -10% -10% -10%;"></div>' +
              '<div class="about-image-frame relative z-10">' +
                '<img src="image/flower_content/login%20screen.jpg" alt="Colorful fresh flower arrangements on display at Umaira Florist" class="w-full h-80 sm:h-96 lg:h-[420px] object-cover object-center transition-transform duration-700 hover:scale-105" loading="lazy">' +
                '<div class="p-4 bg-white/95 backdrop-blur-xs border-t border-[#E5ECE6] flex items-center justify-between text-xs text-[#6E6864]">' +
                  '<span class="font-serif italic font-medium text-stone-800 store-name-val">' + ((window.appState && window.appState.getStoreName && window.appState.getStoreName()) || 'Umaira Florist') + ' Atelier</span>' +
                  '<span class="store-address-val">' + ((window.appState && window.appState.getStoreAddress && window.appState.getStoreAddress()) || '128 Rosa St, BGC, Taguig') + '</span>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<!-- DELICATE FLORAL DIVIDER -->' +
        '<div class="about-divider" aria-hidden="true">' +
          '<span class="about-divider-glyph">&#10022;</span>' +
        '</div>' +

        '<!-- SECTION 2: WHAT MAKES UMAIRA FLORIST SPECIAL -->' +
        '<section class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">' +
          '<div data-reveal class="lg:col-span-5 flex justify-center order-2 lg:order-1">' +
            '<div class="relative w-full max-w-md flex items-center justify-center">' +
              '<div class="su-hero-halo" aria-hidden="true" style="inset:-20% -15% -15% -15%;"></div>' +
              '<div class="relative z-10 w-full flex flex-col items-center">' +
                '<img src="/image/holding%20a%20flower.png" alt="Handcrafted pink rose bouquet at Umaira Florist" class="su-hero-img max-h-[440px] drop-shadow-xl" loading="lazy" style="filter:drop-shadow(0 16px 28px rgba(216,69,124,0.12));">' +
                '<span class="text-[11px] font-serif italic text-[#6E6864] mt-2 block tracking-wider">Conditioned daily &middot; Hand-tied with love</span>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div data-reveal class="lg:col-span-7 space-y-6 text-left order-1 lg:order-2">' +
            '<div class="about-eyebrow">' +
              '<span class="w-2 h-2 rounded-full bg-[#647D69]"></span>' +
              '<span>The Art of Floral Gifting</span>' +
            '</div>' +
            '<h2 class="su-typewriter font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 leading-[1.18] relative inline-block" data-typewriter="Thoughtfully Made, Beautifully Given" aria-label="Thoughtfully Made, Beautifully Given">' +
              '<span class="typewriter-ghost" aria-hidden="true">Thoughtfully Made, Beautifully Given</span>' +
              '<span class="typewriter-visible" aria-hidden="true"><span class="typewriter-text"></span><span class="typewriter-cursor">|</span></span>' +
            '</h2>' +
            '<div class="space-y-5 text-stone-600 about-editorial-p">' +
              '<p>' +
                'What makes Umaira Florist special is our focus on creating arrangements that feel <span class="text-[#647D69] font-semibold">personal rather than ordinary</span>. We believe that every customer has a different story to tell, and their flowers should reflect that.' +
              '</p>' +
              '<p>' +
                'Our ready-made collections offer thoughtfully designed bouquets for birthdays, anniversaries, graduations, and other meaningful occasions. For customers who want something more personal, our <strong class="text-stone-900 font-serif font-bold">Build Your Bouquet</strong> experience allows them to choose their preferred flowers, fillers, wrapping materials, ribbons, and greeting cards.' +
              '</p>' +
              '<p>' +
                'We also believe that the smallest details can make the biggest difference. From the combination of colors to the finishing touches, every element contributes to making a bouquet feel memorable and thoughtfully given.' +
              '</p>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<!-- DELICATE FLORAL DIVIDER -->' +
        '<div class="about-divider" aria-hidden="true">' +
          '<span class="about-divider-glyph">&#10022;</span>' +
        '</div>' +

        '<!-- SECTION 3: THE FOUNDER BEHIND THE BLOOMS -->' +
        '<section class="space-y-10 sm:space-y-12">' +
          '<div data-reveal class="text-center max-w-2xl mx-auto space-y-3">' +
            '<div class="about-eyebrow justify-center">' +
              '<span class="w-2 h-2 rounded-full bg-[#647D69]"></span>' +
              '<span>The Founder Behind the Blooms</span>' +
            '</div>' +
            '<h2 class="su-typewriter font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 leading-[1.18] relative inline-block" data-typewriter="Meet the Heart Behind Umaira Florist Atelier" aria-label="Meet the Heart Behind Umaira Florist Atelier">' +
              '<span class="typewriter-ghost" aria-hidden="true">Meet the Heart Behind Umaira Florist Atelier</span>' +
              '<span class="typewriter-visible" aria-hidden="true"><span class="typewriter-text"></span><span class="typewriter-cursor">|</span></span>' +
            '</h2>' +
            '<p class="text-stone-500 text-sm max-w-lg mx-auto leading-relaxed">' +
              'The creative vision, dedication, and personal care guiding every handcrafted arrangement at our atelier.' +
            '</p>' +
          '</div>' +

          '<div data-reveal data-tilt="1" class="max-w-4xl mx-auto bg-white/95 backdrop-blur-xs p-7 sm:p-10 lg:p-12 rounded-[2.5rem] border border-[#E5ECE6] shadow-sm hover:shadow-floral-lg transition-all duration-500">' +
            '<div class="flex flex-col md:flex-row items-center md:items-start gap-8 lg:gap-11">' +
              '<div class="w-48 sm:w-56 md:w-64 shrink-0">' +
                '<div class="group relative aspect-square rounded-[2rem] overflow-hidden border border-[#E5ECE6] shadow-sm bg-[#FFF9F5] transition-all duration-500 hover:shadow-floral hover:border-[#647D69]/50">' +
                  '<img src="image/flower_content/myprofile.jpg" alt="Angel M. Baldonado - Owner &amp; Founder" class="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105" loading="lazy" />' +
                  '<div class="absolute inset-0 rounded-[2rem] ring-1 ring-inset ring-black/5 pointer-events-none"></div>' +
                '</div>' +
              '</div>' +
              '<div class="flex-1 space-y-4 text-center md:text-left">' +
                '<div class="space-y-1.5">' +
                  '<span class="inline-block text-[11px] uppercase tracking-[0.22em] font-bold text-[#647D69] bg-[#EBF1EC] px-3.5 py-1 rounded-full">' +
                    'Owner &amp; Founder' +
                  '</span>' +
                  '<h3 class="font-serif text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight pt-1">' +
                    'Angel M. Baldonado' +
                  '</h3>' +
                '</div>' +
                '<div class="space-y-3.5 text-stone-600 text-sm sm:text-[15px] leading-relaxed">' +
                  '<p class="about-editorial-p">' +
                    'Angel M. Baldonado is the founder of Umaira Florist Atelier, a floral boutique built on the belief that every flower arrangement tells a meaningful story. With a passion for creativity and thoughtful presentation, Angel envisioned a floral atelier where every bouquet becomes more than just a gift\u2014it becomes a personal expression of love, appreciation, and celebration.' +
                  '</p>' +
                  '<p class="about-editorial-p">' +
                    'Through Umaira Florist Atelier, Angel aims to bring beautiful floral arrangements closer to every customer by combining creativity, attention to detail, and personalized service. Every arrangement reflects the atelier\u2019s commitment to making meaningful moments even more special through the beauty of flowers.' +
                  '</p>' +
                '</div>' +
                '<div class="pt-4 mt-4 border-t border-[#E5ECE6]/80">' +
                  '<blockquote class="relative pl-4 border-l-2 border-[#647D69] text-stone-800 font-serif italic text-sm sm:text-base leading-snug text-left">' +
                    '&ldquo;Every bloom has a story, and every bouquet deserves to make someone feel special.&rdquo;' +
                  '</blockquote>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<!-- DELICATE FLORAL DIVIDER -->' +
        '<div class="about-divider" aria-hidden="true">' +
          '<span class="about-divider-glyph">&#10022;</span>' +
        '</div>' +

        '<!-- SECTION 4: CLOSING INVITATION -->' +
        '<section data-reveal class="text-center max-w-3xl mx-auto py-10 space-y-6">' +
          '<div class="space-y-4">' +
            '<h2 class="su-typewriter font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-stone-900 leading-[1.18] relative inline-block" data-typewriter="Let Flowers Tell Your Story" aria-label="Let Flowers Tell Your Story">' +
              '<span class="typewriter-ghost" aria-hidden="true">Let Flowers Tell Your Story</span>' +
              '<span class="typewriter-visible" aria-hidden="true"><span class="typewriter-text"></span><span class="typewriter-cursor">|</span></span>' +
            '</h2>' +
            '<p class="text-stone-600 text-base sm:text-lg max-w-xl mx-auto leading-relaxed">' +
              'Whether you are celebrating a milestone, comforting a loved one, or simply brightening someone\u2019s day, we invite you to explore our handcrafted collections or compose your own bouquet stem by stem.' +
            '</p>' +
          '</div>' +
          '<div class="flex flex-wrap items-center justify-center gap-4 pt-2">' +
            '<button type="button" data-magnetic onclick="window.appRouter.navigate(\'collections\')" class="py-4 px-8 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-base shadow-lg shadow-[#647D69]/25 transition duration-300 hover:shadow-xl hover:-translate-y-0.5 flex items-center gap-2">' +
              '<span>Explore Collections</span>' +
              '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>' +
            '</button>' +
            '<button type="button" data-magnetic onclick="window.appRouter.navigate(\'builder\')" class="py-4 px-8 rounded-2xl bg-white hover:bg-[#FFF9F5] text-stone-900 border border-stone-300 font-bold text-base shadow-xs transition duration-300 hover:border-[#647D69]/40 hover:-translate-y-0.5 flex items-center gap-2">' +
              '<svg class="w-4 h-4 text-[#647D69]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/></svg>' +
              '<span>Build Your Bouquet</span>' +
            '</button>' +
          '</div>' +
        '</section>' +

      '</div>';
  }

  /* =====================================================================
     6.6 PRIVACY POLICY PAGE
     ===================================================================== */
  function renderPrivacyPolicyView() {
    var _st = window.appState;
    var _email = (_st && _st.getStoreEmail && _st.getStoreEmail()) || 'concierge@umairaflorist.com';
    var _phone = (_st && _st.getStorePhone && _st.getStorePhone()) || '+63 917 892 4310';
    var sec = function (num, title, body) {
      return '<section class="space-y-3">' +
        '<h2 class="font-serif text-xl sm:text-2xl font-bold text-stone-900 flex items-start gap-2">' +
          '<span class="text-[#647D69] font-serif">' + num + '.</span>' +
          '<span>' + title + '</span>' +
        '</h2>' +
        '<div class="text-stone-700 leading-relaxed space-y-3 pl-6">' + body + '</div>' +
      '</section>';
    };
    var p = function (t) { return '<p>' + t + '</p>'; };
    var ul = function (items) { return '<ul class="list-disc list-outside pl-5 space-y-1.5">' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>'; };

    return '' +
      '<div class="py-12 sm:py-16 lg:py-20 px-6 max-w-3xl mx-auto">' +

        '<button type="button" onclick="window.appRouter.navigate(\'home\')" ' +
          'class="inline-flex items-center gap-2 text-sm text-[#647D69] hover:text-[#526B57] font-semibold mb-10 group transition-colors">' +
          '<svg class="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 12H5m7-7-7 7 7 7"/>' +
          '</svg>' +
          'Return to Store' +
        '</button>' +

        '<div class="text-center mb-12 sm:mb-16">' +
          '<div class="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-[#647D69] mb-4">' +
            '<span class="w-6 h-px bg-[#647D69]/40"></span>' +
            '<span>Umaira Florist Atelier</span>' +
            '<span class="w-6 h-px bg-[#647D69]/40"></span>' +
          '</div>' +
          '<h1 class="font-serif text-4xl sm:text-5xl font-bold text-stone-900 leading-tight">Privacy Policy</h1>' +
          '<p class="mt-4 text-stone-500 text-sm">Effective: November 2026 &nbsp;&middot;&nbsp; Philippines</p>' +
          '<p class="mt-3 text-stone-600 text-sm max-w-xl mx-auto leading-relaxed">' +
            'Umaira Florist Atelier is committed to protecting your personal information in accordance with Republic Act No. 10173, the Data Privacy Act of 2012, and its implementing rules.' +
          '</p>' +
        '</div>' +

        '<div class="space-y-10 divide-y divide-stone-200">' +

          sec('1', 'Information We Collect',
            p('When you use our website, create an account, or place an order, we collect the following information:') +
            ul([
              '<strong>Account details:</strong> Full name, email address, Philippine mobile number, and password (hashed — never stored in plaintext).',
              '<strong>Delivery addresses:</strong> Street address, barangay, city, and district provided during checkout.',
              '<strong>Order details:</strong> Items ordered, quantities, fulfillment method (pickup or delivery), preferred date and time, gift messages, and special notes.',
              '<strong>Payment information:</strong> Your chosen payment method. For GCash payments, we receive the screenshot or proof of payment that you upload.',
              '<strong>Google account information:</strong> If you sign in using Google, we receive your name and email address from Google as permitted by their OAuth consent screen.',
              '<strong>Technical data:</strong> Server-side session tokens used to keep you signed in. These are not shared with third parties.'
            ])
          ) +

          '<div class="pt-10">' + sec('2', 'How We Use Your Information',
            p('We use the information we collect solely to operate and improve our online flower shop. Specifically, we use it to:') +
            ul([
              'Process and fulfill your orders (bouquet preparation, delivery coordination, or store pickup).',
              'Send order status notifications and updates within your account.',
              'Verify GCash payment proofs submitted during checkout.',
              'Provide access to your order history and account settings.',
              'Send password-reset links when requested (only if email is configured).',
              'Respond to your questions or concerns.',
              'Maintain the security of our website and prevent fraud.'
            ]) +
            p('We do not use your information for automated profiling, targeted advertising, or any purpose unrelated to fulfilling your order.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('3', 'Order and Payment Information',
            p('Orders and payment records are stored in our secure database. All GCash payment proof images you upload are transferred to and stored on Cloudinary, a secure cloud media service, solely for payment verification by our team. Payment records are retained as part of your order history.') +
            p('Payment verification is performed manually by an authorized member of our team. We do not store your GCash account credentials, card numbers, or online banking details.') +
            p('Bank Transfer (BDO) was a previously accepted payment method. Historical records of such orders are retained for order history purposes only. This payment method is no longer available for new orders.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('4', 'Uploaded Files and Images',
            p('Payment proof images (screenshots or photos of GCash transactions) are uploaded directly to Cloudinary, our cloud image hosting provider. These files are:') +
            ul([
              'Accessible only to authorized Umaira Florist team members.',
              'Used exclusively to verify that payment has been made.',
              'Not shared publicly or used for any other purpose.'
            ]) +
            p('Product photos displayed on the website are managed by our admin team and are not related to customer-uploaded files.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('5', 'Data Storage and Security',
            p('Your personal information is stored on our secure server. We implement reasonable administrative, technical, and physical safeguards to protect your information from unauthorized access, disclosure, alteration, and destruction. These include:') +
            ul([
              'Password hashing (plain-text passwords are never stored).',
              'Server-side session tokens that expire after inactivity.',
              'Rate limiting on sign-in and order placement to prevent abuse.',
              'HTTPS encryption in transit (required when hosted on a production server).'
            ]) +
            p('While we take these precautions, no data transmission over the internet is completely secure. We encourage you to protect your account by using a strong, unique password.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('6', 'Third-Party Services',
            p('We work with the following third-party services to operate our website. Each is governed by its own privacy policy:') +
            ul([
              '<strong>Google (OAuth sign-in):</strong> Used if you choose to sign in with your Google account. We receive only your name and email. <em>google.com/privacy</em>',
              '<strong>Cloudinary:</strong> Cloud image storage for payment proof uploads. <em>cloudinary.com/privacy</em>',
              '<strong>Firebase / Google Firestore:</strong> Used for backend data synchronization. <em>firebase.google.com/support/privacy</em>',
              '<strong>Email provider:</strong> Used only to deliver password-reset links when you request one, if email is configured by the shop administrator.'
            ]) +
            p('We do not sell, rent, or trade your personal information to any third party for marketing purposes.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('7', 'Cookies and Similar Technologies',
            p('Our website uses browser session storage and local storage to maintain your sign-in session, remember items in your cart, and preserve your preferences between pages. We do not use third-party tracking cookies or advertising cookies.') +
            p('You may clear your browser\'s local storage at any time through your browser settings, which will sign you out of your account.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('8', 'Your Rights Under RA 10173',
            p('As a data subject under the Philippine Data Privacy Act, you have the following rights:') +
            ul([
              '<strong>Right to be informed</strong> — to know how your personal data is being processed.',
              '<strong>Right to access</strong> — to obtain a copy of your personal data we hold.',
              '<strong>Right to rectification</strong> — to correct inaccurate or incomplete personal data.',
              '<strong>Right to erasure</strong> — to request deletion of your personal data, subject to legal and operational requirements.',
              '<strong>Right to data portability</strong> — to receive your data in a structured, commonly used format.',
              '<strong>Right to object</strong> — to object to the processing of your personal data in certain circumstances.'
            ]) +
            p('To exercise any of these rights, please contact us using the details in Section 9.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('9', 'Contact Us',
            p('If you have questions about this Privacy Policy or wish to exercise your data privacy rights, please contact us:') +
            '<div class="bg-[#EBF1EC]/40 border border-[#647D69]/20 rounded-2xl p-5 mt-3 space-y-1.5 text-sm">' +
              '<p><strong>Umaira Florist Atelier</strong></p>' +
              '<p>Email: <a href="mailto:' + _email + '" class="store-email-val text-[#647D69] font-medium hover:underline">' + _email + '</a></p>' +
              '<p>Phone: <a href="tel:' + _phone.replace(/[^+\d]/g, '') + '" class="store-phone-val text-[#647D69] font-medium hover:underline">' + _phone + '</a></p>' +
              '<p class="text-stone-500 italic">[BUSINESS ADDRESS &#8212; to be confirmed by shop owner]</p>' +
            '</div>'
          ) + '</div>' +

          '<div class="pt-10">' + sec('10', 'Policy Updates',
            p('We may update this Privacy Policy from time to time to reflect changes in our practices or applicable law. The updated policy will be posted on this page with a revised effective date. We encourage you to review this page periodically. Your continued use of our website after any changes constitutes acceptance of the updated policy.')
          ) + '</div>' +

        '</div>' +

        '<div class="mt-16 pt-8 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4">' +
          '<button type="button" onclick="window.appRouter.navigate(\'home\')" ' +
            'class="inline-flex items-center gap-2 py-3 px-6 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-sm transition shadow-md shadow-[#647D69]/20">' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 12H5m7-7-7 7 7 7"/>' +
            '</svg>' +
            'Return to Store' +
          '</button>' +
          '<button type="button" onclick="window.appRouter.navigate(\'terms\')" ' +
            'class="inline-flex items-center gap-2 py-3 px-6 rounded-2xl bg-white border border-stone-300 hover:bg-[#FFF9F5] text-stone-800 font-bold text-sm transition">' +
            'View Terms of Service' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14m-7-7 7 7-7 7"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +

      '</div>';
  }

  /* =====================================================================
     6.7 TERMS OF SERVICE PAGE
     ===================================================================== */
  function renderTermsOfServiceView() {
    var _st = window.appState;
    var _email = (_st && _st.getStoreEmail && _st.getStoreEmail()) || 'concierge@umairaflorist.com';
    var _phone = (_st && _st.getStorePhone && _st.getStorePhone()) || '+63 917 892 4310';
    var sec = function (num, title, body) {
      return '<section class="space-y-3">' +
        '<h2 class="font-serif text-xl sm:text-2xl font-bold text-stone-900 flex items-start gap-2">' +
          '<span class="text-[#647D69] font-serif">' + num + '.</span>' +
          '<span>' + title + '</span>' +
        '</h2>' +
        '<div class="text-stone-700 leading-relaxed space-y-3 pl-6">' + body + '</div>' +
      '</section>';
    };
    var p = function (t) { return '<p>' + t + '</p>'; };
    var ul = function (items) { return '<ul class="list-disc list-outside pl-5 space-y-1.5">' + items.map(function (i) { return '<li>' + i + '</li>'; }).join('') + '</ul>'; };
    var note = function (t) {
      return '<div class="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">' + t + '</div>';
    };

    return '' +
      '<div class="py-12 sm:py-16 lg:py-20 px-6 max-w-3xl mx-auto">' +

        '<button type="button" onclick="window.appRouter.navigate(\'home\')" ' +
          'class="inline-flex items-center gap-2 text-sm text-[#647D69] hover:text-[#526B57] font-semibold mb-10 group transition-colors">' +
          '<svg class="w-4 h-4 transition-transform group-hover:-translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
            '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 12H5m7-7-7 7 7 7"/>' +
          '</svg>' +
          'Return to Store' +
        '</button>' +

        '<div class="text-center mb-12 sm:mb-16">' +
          '<div class="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-[#647D69] mb-4">' +
            '<span class="w-6 h-px bg-[#647D69]/40"></span>' +
            '<span>Umaira Florist Atelier</span>' +
            '<span class="w-6 h-px bg-[#647D69]/40"></span>' +
          '</div>' +
          '<h1 class="font-serif text-4xl sm:text-5xl font-bold text-stone-900 leading-tight">Terms of Service</h1>' +
          '<p class="mt-4 text-stone-500 text-sm">Effective: November 2026 &nbsp;&middot;&nbsp; Philippines</p>' +
          '<p class="mt-3 text-stone-600 text-sm max-w-xl mx-auto leading-relaxed">' +
            'Please read these terms carefully before using the Umaira Florist Atelier website or placing an order. By accessing our website or completing a purchase, you agree to be bound by these terms.' +
          '</p>' +
        '</div>' +

        '<div class="space-y-10 divide-y divide-stone-200">' +

          sec('1', 'General Use of Our Website',
            p('Umaira Florist Atelier (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) operates an online flower shop serving customers in the Philippines. By accessing this website, you agree to use it only for lawful purposes and in a manner that does not infringe the rights of others.') +
            p('We reserve the right to modify or discontinue any part of the website at any time without prior notice.')
          ) +

          '<div class="pt-10">' + sec('2', 'Account Registration and Security',
            p('You may browse our collections as a guest. Creating an account allows you to track orders, manage your profile, and access your purchase history. When registering, you must provide accurate information including your full name, a valid email address, and a Philippine mobile number.') +
            p('You are responsible for maintaining the confidentiality of your account credentials. If you sign in using Google, your account is additionally governed by Google’s Terms of Service. You must not share your account with others.') +
            p('We reserve the right to suspend or terminate accounts found to be misused, providing false information, or engaging in prohibited activities.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('3', 'Product Descriptions, Availability, and Pricing',
            p('All products are described to the best of our ability. Product photos are representative; actual flowers may vary slightly in shape, shade, and size depending on seasonal availability.') +
            p('All prices are in Philippine Pesos (₱) and are inclusive of applicable charges as displayed at checkout. Prices are subject to change without prior notice, but changes will never apply to orders already placed and confirmed.') +
            p('Product availability is subject to stock. We reserve the right to adjust availability at any time. If an item in your order becomes unavailable after placement, we will contact you to discuss alternatives.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('4', 'Ready-Made and Customized Bouquet Orders',
            p('Our shop offers two types of floral products:') +
            ul([
              '<strong>Ready-Made Bouquets:</strong> Pre-designed arrangements available for immediate order from our Collections page.',
              '<strong>Custom Bouquets:</strong> Arrangements built stem by stem using our Bouquet Studio, allowing you to select specific flowers, colors, and sizes.'
            ]) +
            p('Custom bouquet prices are calculated based on your selections. You will see the final price before confirming your order. Because custom bouquets are prepared specifically for you, additional lead time may be required.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('5', 'Order Placement, Confirmation, and Cancellation',
            p('An order is considered placed once you complete checkout and receive an order number. Your order enters &ldquo;Confirmed&rdquo; status only after payment is verified (for GCash orders) or upon our acknowledgment (for cash orders).') +
            p('Order modifications are only possible before preparation has begun. To request a change or cancellation, please contact us immediately using the details provided in Section 12.') +
            p('Orders that are delivered or made ready for pickup are considered fulfilled. Once an order has been prepared or is out for delivery, cancellation may not be possible.') +
            note('If you do not confirm delivery or report a concern within <strong>48 hours</strong> of a delivery attempt, or within <strong>24 hours</strong> of a pickup notification, the order will be automatically marked as confirmed.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('6', 'Payment Methods and Verification',
            p('We currently accept the following payment methods:') +
            ul([
              '<strong>GCash (Online Payment):</strong> Payment is required in advance. After completing your order, you will be shown the GCash account details to pay to. You must upload a clear screenshot or photo of your confirmed GCash transaction as proof of payment. Orders will not be confirmed or prepared until payment is verified by our team.',
              '<strong>Cash on Pickup:</strong> Payment is collected in cash at our shop at the time of pickup.',
              '<strong>Cash on Delivery:</strong> Payment is collected in cash upon delivery.'
            ]) +
            p('Payment proofs are reviewed by our team. We reserve the right to reject proofs that are unclear, edited, or do not match the required amount. You will be notified if your proof is rejected and given the opportunity to resubmit.') +
            p('Bank Transfer (BDO) is no longer available for new orders.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('7', 'Pickup and Delivery Policies',
            p('We offer two fulfillment options:') +
            ul([
              '<strong>Store Pickup:</strong> Free of charge. A minimum preparation time applies (typically 2 hours for same-day pickups, subject to change). You will be notified when your order is ready.',
              '<strong>Delivery:</strong> Available within our service area. A delivery fee applies, as shown at checkout. Free delivery is available for qualifying order amounts, as displayed at the time of purchase. Delivery is conducted during scheduled time slots (morning and afternoon).'
            ]) +
            p('Delivery addresses must be within our service area. We are not responsible for failed deliveries caused by incorrect addresses, unavailability of the recipient, or inaccessible locations. In the event of a failed delivery attempt, we will contact you to arrange a resolution.') +
            note('Delivery availability, fees, and operating hours are subject to change. The most current information will always be shown during checkout.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('8', 'Refunds, Returns, and Order Concerns',
            p('Because flowers are perishable products, we do not accept returns. All sales are considered final once an order has been prepared and fulfilled.') +
            p('If you have a concern about the quality of your order — such as flowers that arrived wilted, damaged, or significantly different from what was ordered — please contact us within <strong>[TIMEFRAME — to be confirmed by shop owner]</strong> of receiving the order and provide clear photos. We will assess each concern on a case-by-case basis.') +
            p('Any replacement or resolution offered is at the discretion of Umaira Florist Atelier and is not guaranteed.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('9', 'Product Substitutions',
            p('Due to the natural and seasonal nature of flowers, specific stems, foliage, or decorative elements included in a bouquet may occasionally be unavailable. In such cases, we reserve the right to substitute with comparable flowers or materials of equal or greater value and similar aesthetic quality.') +
            p('We will make every effort to maintain the overall style, color palette, and size of the arrangement. If a substitution significantly changes the composition of your order, we will notify you in advance whenever time permits.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('10', 'Prohibited Activities',
            p('When using our website, you agree not to:') +
            ul([
              'Submit false, fraudulent, or misleading information during checkout or account registration.',
              'Upload manipulated or fake payment proofs.',
              'Attempt to circumvent or interfere with website security features.',
              'Use automated tools, bots, or scripts to access, scrape, or submit data to our website.',
              'Impersonate another person or use another person’s account without authorization.',
              'Engage in any activity that disrupts the normal operation of our website or its users.'
            ]) +
            p('Violation of these terms may result in immediate account suspension and, where applicable, referral to appropriate legal authorities.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('11', 'Limitation of Liability',
            p('Umaira Florist Atelier shall not be held liable for any indirect, incidental, or consequential damages arising from your use of our website or the fulfillment of orders. Our maximum liability for any claim arising from an order shall not exceed the amount paid for that specific order.') +
            p('We are not responsible for damages resulting from events beyond our reasonable control, including natural disasters, supply chain disruptions, delivery partner failures, or other force majeure events.')
          ) + '</div>' +

          '<div class="pt-10">' + sec('12', 'Changes to These Terms and Contact Information',
            p('We reserve the right to update these Terms of Service at any time. Changes will take effect immediately upon posting to this page with a revised effective date. Your continued use of the website after changes are posted constitutes acceptance of the updated terms.') +
            p('For questions about these terms, to request order changes, or to raise any concerns, please contact us:') +
            '<div class="bg-[#EBF1EC]/40 border border-[#647D69]/20 rounded-2xl p-5 mt-3 space-y-1.5 text-sm">' +
              '<p><strong>Umaira Florist Atelier</strong></p>' +
              '<p>Email: <a href="mailto:' + _email + '" class="store-email-val text-[#647D69] font-medium hover:underline">' + _email + '</a></p>' +
              '<p>Phone: <a href="tel:' + _phone.replace(/[^+\d]/g, '') + '" class="store-phone-val text-[#647D69] font-medium hover:underline">' + _phone + '</a></p>' +
              '<p class="text-stone-500 italic">[BUSINESS ADDRESS &#8212; to be confirmed by shop owner]</p>' +
            '</div>'
          ) + '</div>' +

        '</div>' +

        '<div class="mt-16 pt-8 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-4">' +
          '<button type="button" onclick="window.appRouter.navigate(\'home\')" ' +
            'class="inline-flex items-center gap-2 py-3 px-6 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-sm transition shadow-md shadow-[#647D69]/20">' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 12H5m7-7-7 7 7 7"/>' +
            '</svg>' +
            'Return to Store' +
          '</button>' +
          '<button type="button" onclick="window.appRouter.navigate(\'privacy\')" ' +
            'class="inline-flex items-center gap-2 py-3 px-6 rounded-2xl bg-white border border-stone-300 hover:bg-[#FFF9F5] text-stone-800 font-bold text-sm transition">' +
            'View Privacy Policy' +
            '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">' +
              '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14m-7-7 7 7-7 7"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +

      '</div>';
  }

  var activeTypewriterObserver = null;

  function getTypewriterSegments(el) {
    var segNodes = el.querySelectorAll('.typewriter-text[data-tw-text]');
    if (segNodes.length) {
      var list = [];
      segNodes.forEach(function (span) {
        list.push({ span: span, text: span.getAttribute('data-tw-text') || '' });
      });
      return list;
    }
    var singleSpan = el.querySelector('.typewriter-text');
    return singleSpan ? [{ span: singleSpan, text: el.getAttribute('data-typewriter') || '' }] : [];
  }

  function completeTypewriterImmediate(el) {
    el.dataset.typewriterDone = 'true';
    var segs = getTypewriterSegments(el);
    segs.forEach(function (seg) {
      seg.span.textContent = seg.text;
    });
    var cursorSpan = el.querySelector('.typewriter-cursor');
    if (cursorSpan) cursorSpan.remove();
  }

  function initAboutTypewriter() {
    if (activeTypewriterObserver) {
      activeTypewriterObserver.disconnect();
      activeTypewriterObserver = null;
    }

    var headings = document.querySelectorAll('.su-typewriter[data-typewriter]');
    if (!headings.length) return;

    var prefersReduced = false;
    try {
      prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) {}

    if (prefersReduced || !('IntersectionObserver' in window)) {
      headings.forEach(completeTypewriterImmediate);
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        observer.unobserve(el);

        if (el.dataset.typewriterDone === 'true') return;
        el.dataset.typewriterDone = 'true';

        var segments = getTypewriterSegments(el);
        var cursorSpan = el.querySelector('.typewriter-cursor');
        if (!segments.length) return;

        segments.forEach(function (seg) { seg.span.textContent = ''; });
        if (cursorSpan) {
          cursorSpan.style.display = 'inline-block';
          if (segments[0].span.nextSibling !== cursorSpan && segments[0].span.parentNode) {
            segments[0].span.parentNode.insertBefore(cursorSpan, segments[0].span.nextSibling);
          }
        }

        var segIdx = 0;
        var charIdx = 0;
        var idx = 0;
        var baseSpeed = 55;

        function step() {
          if (!document.body.contains(el)) return;
          while (segIdx < segments.length && charIdx >= segments[segIdx].text.length) {
            segIdx++;
            charIdx = 0;
          }
          if (segIdx < segments.length) {
            var activeSeg = segments[segIdx];
            if (cursorSpan && activeSeg.span.nextSibling !== cursorSpan && activeSeg.span.parentNode) {
              activeSeg.span.parentNode.insertBefore(cursorSpan, activeSeg.span.nextSibling);
            }
            activeSeg.span.textContent += activeSeg.text.charAt(charIdx);
            charIdx++;
            idx++;
            var jitter = (idx % 3 === 0) ? 15 : (idx % 2 === 0 ? -10 : 0);
            setTimeout(step, Math.max(40, baseSpeed + jitter));
          } else {
            setTimeout(function () {
              if (!document.body.contains(el)) return;
              if (cursorSpan) {
                cursorSpan.classList.add('typewriter-cursor-done');
                setTimeout(function () {
                  if (cursorSpan && cursorSpan.parentNode) {
                    cursorSpan.remove();
                  }
                }, 400);
              }
            }, 450);
          }
        }

        setTimeout(step, 180);
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });

    activeTypewriterObserver = observer;

    headings.forEach(function (h) {
      if (h.dataset.typewriterDone === 'true') {
        completeTypewriterImmediate(h);
      } else {
        observer.observe(h);
      }
    });
  }

  function initAboutPage() {
    initAboutTypewriter();
    if (window.FX) {
      window.FX.refresh();
    }
  }

  /* =====================================================================
     7. ROUTER WIRING & HELPERS
     ===================================================================== */
  window.suSetOccasionFilter = function (occ) {
    collectionFilterState.occasion = occ;
    router.navigate('collections');
    setTimeout(function () {
      var occSelect = document.getElementById('su-filter-occasion');
      if (occSelect) {
        occSelect.value = occ;
      }
      var grid = document.getElementById('su-bouquet-grid-container');
      if (grid) grid.innerHTML = bouquetGridHtml();
      var active = document.getElementById('su-active-filters-container');
      if (active) active.innerHTML = activeFiltersHtml(getFilteredBouquets().length);
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {}
    }, 50);
  };

  proto.renderHomeView = renderHomeView;
  proto.renderCollectionsView = function () {
    return wrapCustomerViewWithDecor('collections', renderCollectionsView.apply(this, arguments));
  };
  proto.renderCareGuideView = function () {
    return wrapCustomerViewWithDecor('care', renderFloristGuideView.apply(this, arguments));
  };
  proto.renderFloristGuideView = proto.renderCareGuideView;
  proto.renderAboutView = function () {
    return wrapCustomerViewWithDecor('about', renderAboutView.apply(this, arguments));
  };
  proto.renderPrivacyPolicyView = function () {
    return wrapCustomerViewWithDecor('privacy', renderPrivacyPolicyView.apply(this, arguments));
  };
  proto.renderTermsOfServiceView = function () {
    return wrapCustomerViewWithDecor('terms', renderTermsOfServiceView.apply(this, arguments));
  };

  // Wrap all other standard customer view renderers with 50% visibility botanical framing
  ['renderBuilderView', 'renderCartView', 'renderCheckoutView', 'renderConfirmationView',
   'renderTrackingView', 'renderAuthView'].forEach(function (fnName) {
    if (typeof proto[fnName] === 'function') {
      var origFn = proto[fnName];
      var vName = fnName.replace('render', '').replace('View', '').toLowerCase();
      proto[fnName] = function () {
        var html = origFn.apply(this, arguments);
        return wrapCustomerViewWithDecor(vName, html);
      };
    }
  });

  var origNavigate = proto.navigate;
  proto.navigate = function (view, replace, options) {
    if (view === 'flowers' || view === 'occasions') view = 'collections';
    if (view === 'care-guide' || view === 'guide' || view === 'florist-guide') view = 'care';
    return origNavigate.call(this, view, replace, options);
  };

  var origRenderView = proto.renderView;
  proto.renderView = function (view) {
    if (view === 'flowers' || view === 'occasions') view = 'collections';
    if (view === 'care-guide' || view === 'guide' || view === 'florist-guide') view = 'care';
    document.body.setAttribute('data-view', view);
    closeBouquet();
    var main = document.getElementById('main-content');
    if (!main) return;

    if (view === 'collections') {
      destroyCareGuide3D();
      main.innerHTML = this.renderCollectionsView();
      initAboutTypewriter();
    } else if (view === 'care') {
      destroyCareGuide3D();
      main.innerHTML = typeof this.renderFloristGuideView === 'function' ? this.renderFloristGuideView() : this.renderCareGuideView();
      if (typeof initFloristGuidePage === 'function') initFloristGuidePage();
    } else if (view === 'about') {
      destroyCareGuide3D();
      main.innerHTML = this.renderAboutView();
      initAboutPage();
    } else if (view === 'privacy') {
      destroyCareGuide3D();
      main.innerHTML = this.renderPrivacyPolicyView();
      main.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (view === 'terms') {
      destroyCareGuide3D();
      main.innerHTML = this.renderTermsOfServiceView();
      main.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      destroyCareGuide3D();
      origRenderView.call(this, view);
      initAboutTypewriter();
    }
    if (window.FX) window.FX.refresh();
  };

  // Automatically update customer storefront in real-time when Admin updates catalog
  if (window.appState && typeof window.appState.on === 'function') {
    window.appState.on('catalog_change', function () {
      if (window.appRouter) {
        if (window.appRouter.currentView === 'collections') {
          if (typeof window.suRefreshCollections === 'function') {
            window.suRefreshCollections();
          } else {
            var main = document.getElementById('main-content');
            if (main && typeof window.appRouter.renderCollectionsView === 'function') {
              main.innerHTML = window.appRouter.renderCollectionsView();
              initAboutTypewriter();
            }
          }
        } else if (window.appRouter.currentView === 'home') {
          var main = document.getElementById('main-content');
          if (main && typeof window.appRouter.renderHomeView === 'function') {
            main.innerHTML = window.appRouter.renderHomeView();
            initAboutTypewriter();
            if (window.FX) window.FX.refresh();
          }
        }
      }
    });
  }

  // Filter occasion: open the Ready-Made Bouquet catalog filtered to that specific occasion
  proto.filterOccasion = function (occId) {
    if (typeof window.suShopByOccasion === 'function') {
      window.suShopByOccasion(occId);
    } else {
      this.navigate('collections');
    }
  };

  buildPetals();

  if (window.location.hash === '#about') {
    setTimeout(initAboutPage, 200);
  } else if (window.location.hash === '#care' || window.location.hash === '#guide' || window.location.hash === '#care-guide' || window.location.hash === '#florist-guide') {
    setTimeout(initFloristGuidePage, 200);
  }

  // app.js has already drawn the first page with the old layout. Draw it again with the new one.
  // The first page is drawn by js/account.js once the live catalog has loaded.
})();