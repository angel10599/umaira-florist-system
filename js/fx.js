/**
 * UMAIRA FLORIST - Interactive motion engine (no libraries)
 *
 * Scroll-driven and pointer-driven effects are declared in the markup with data attributes:
 *   data-reveal            fade/rise into place the first time the element scrolls into view
 *   data-parallax="n"      moves vertically with scroll (n > 0 moves faster than the page, n < 0 slower)
 *   data-scroll-x="n"      moves sideways as the page scrolls
 *   data-mouse="px"        shifts with the pointer (depth in px; negative moves the opposite way)
 *   data-tilt="deg"        3D tilt toward the pointer with a soft highlight
 *   data-magnetic          button leans slightly toward the pointer
 *   data-scene             area where clicking releases a few petals
 *   data-hero / data-hero-content / data-hero-card   scroll-linked hero choreography
 *   data-ring              pinned scroll scene: a 3D ring of flowers that turns as you scroll
 * Only transform and opacity are animated, so everything stays on the GPU.
 */
(function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const FX = {};

  let vh = window.innerHeight;
  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  let revealObserver = null;
  let fxEls = [];
  let hero = null, heroContent = null, heroCard = null;
  let ring = null;
  let tiltActive = null, magnetActive = null;
  let raf = 0;
  const progressBar = () => document.getElementById('scroll-progress');

  function request() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  // ----------------------------------------------------------------- reveal
  function setupReveal() {
    if (revealObserver) revealObserver.disconnect();
    const pending = Array.from(document.querySelectorAll('[data-reveal]:not(.is-visible)'));
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !('IntersectionObserver' in window)) { pending.forEach(el => el.classList.add('is-visible')); return; }
    // Read every position first, then write classes (no layout thrashing). Anything already on screen (or just
    // below it) is shown at once; only content further down waits for its entrance.
    const tops = pending.map(el => el.getBoundingClientRect().top);
    const below = [];
    pending.forEach((el, k) => {
      if (tops[k] < window.innerHeight * 0.92) el.classList.add('is-visible');
      else { el.classList.add('reveal-pending'); below.push(el); }
    });
    revealObserver = new IntersectionObserver((entries) => {
      let i = 0;
      entries.filter(e => e.isIntersecting).forEach(entry => {
        const el = entry.target;
        const own = parseFloat(el.getAttribute('data-reveal-delay'));
        // Cards entering together cascade gently (60 ms apart, at most 300 ms).
        el.style.transitionDelay = (isNaN(own) ? Math.min(i * 60, 300) : own) + 'ms';
        el.classList.add('is-visible');
        revealObserver.unobserve(el);
        // Drop the GPU hint and delay once the entrance has finished.
        setTimeout(() => { el.classList.remove('reveal-pending'); el.style.transitionDelay = ''; }, 1200);
        i++;
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.08 });
    below.forEach(el => revealObserver.observe(el));
  }

  // ------------------------------------------------------- parallax / mouse
  function collectFx() {
    fxEls = Array.from(document.querySelectorAll('[data-parallax],[data-mouse],[data-scroll-x]')).map(el => ({
      el,
      py: parseFloat(el.getAttribute('data-parallax')) || 0,
      sx: parseFloat(el.getAttribute('data-scroll-x')) || 0,
      m: parseFloat(el.getAttribute('data-mouse')) || 0
    }));
  }

  // Style writes are skipped when the value has not changed (no needless style recalculation).
  function setStyle(el, prop, value) {
    const cache = el.__fx || (el.__fx = {});
    if (cache[prop] === value) return;
    cache[prop] = value;
    el.style[prop] = value;
  }

  // r = the parent's rectangle, measured in the read phase of tick().
  function applyFx(d, r) {
    if (!r) return;
    if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) return; // far off screen
    const off = r.top + r.height / 2 - vh / 2;
    const x = mouse.x * d.m + off * d.sx;
    const y = mouse.y * d.m - off * d.py;
    setStyle(d.el, 'transform', 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)');
  }

  // ------------------------------------------------------------------- hero
  function tickHero(scrollY, heroH) {
    if (!hero) return;
    const p = clamp(scrollY / (heroH || vh), 0, 1);
    if (p >= 1 && hero.__fxDone) return; // hero scrolled away: nothing left to update
    hero.__fxDone = p >= 1;
    if (heroContent) {
      setStyle(heroContent, 'transform', 'translate3d(0,' + (-p * 30).toFixed(1) + 'px,0)');
      setStyle(heroContent, 'opacity', String(clamp(1 - p * 0.5, 0.6, 1)));
    }
    if (heroCard) {
      setStyle(heroCard, 'transform', 'perspective(1200px) translate3d(0,' + (p * 40).toFixed(1) + 'px,0) scale(' + (1 - p * 0.08).toFixed(3) + ')');
      setStyle(heroCard, 'opacity', String(clamp(1 - p * 0.8, 0.4, 1)));
    }
  }

  // ------------------------------------------------------------------- ring
  function setupRing() {
    ring = null;
    const section = document.querySelector('[data-ring]');
    if (!section) return;
    const el = section.querySelector('.ring');
    const cards = Array.from(section.querySelectorAll('[data-ring-card]'));
    if (!el || cards.length === 0) return;
    ring = {
      section, el, cards,
      tilt: section.querySelector('.ring-tilt'),
      infos: Array.from(section.querySelectorAll('[data-ring-info]')),
      dots: Array.from(section.querySelectorAll('[data-ring-dot]')),
      n: cards.length, step: 360 / cards.length,
      R: 330, angle: 0, target: 0, active: -1
    };
    measureRing();
    ring.angle = ring.target = ringTarget();
    cards.forEach((c, i) => c.addEventListener('click', () => { if (ring.active !== i) ringGoTo(i); }));
    ring.dots.forEach((d, i) => d.addEventListener('click', () => ringGoTo(i)));
  }

  function measureRing() {
    if (!ring) return;
    const w = ring.cards[0].offsetWidth || 230;
    ring.R = Math.round(w * 1.42);
    ring.el.style.setProperty('--r', ring.R + 'px');
  }

  function ringTarget(measured) {
    const rect = measured || ring.section.getBoundingClientRect();
    const total = Math.max(1, rect.height - vh);
    return clamp(-rect.top / total, 0, 1) * (ring.n - 1) * ring.step;
  }

  function ringGoTo(i) {
    const rect = ring.section.getBoundingClientRect();
    const top = rect.top + window.scrollY;
    const total = rect.height - vh;
    window.scrollTo({ top: top + (i / (ring.n - 1)) * total, behavior: 'smooth' });
  }

  function tickRing(rect) {
    if (!ring || !rect) return false;
    if (rect.bottom < -vh * 0.25 || rect.top > vh * 1.25) return false;

    ring.target = ringTarget(rect);
    ring.angle += (ring.target - ring.angle) * 0.14;
    const moving = Math.abs(ring.target - ring.angle) > 0.04;
    if (!moving) ring.angle = ring.target;

    ring.el.style.transform = 'translateZ(' + (-ring.R) + 'px) rotateY(' + (-ring.angle).toFixed(3) + 'deg)';
    if (ring.tilt) ring.tilt.style.transform = 'rotateX(' + (-mouse.y * 4).toFixed(2) + 'deg) rotateY(' + (mouse.x * 6).toFixed(2) + 'deg)';

    ring.cards.forEach((c, i) => {
      let d = ((i * ring.step - ring.angle + 540) % 360) - 180;
      const a = Math.abs(d);
      c.style.opacity = String(clamp(1 - (a - 40) / 60, 0, 1));
      c.style.pointerEvents = a < 100 ? 'auto' : 'none';
    });

    const active = clamp(Math.round(ring.angle / ring.step), 0, ring.n - 1);
    if (active !== ring.active) {
      ring.active = active;
      ring.cards.forEach((c, i) => c.classList.toggle('is-front', i === active));
      ring.infos.forEach((n, i) => n.classList.toggle('is-active', i === active));
      ring.dots.forEach((n, i) => n.classList.toggle('is-active', i === active));
    }
    return moving;
  }

  // ------------------------------------------------------------------- loop
  function tick() {
    raf = 0;
    vh = window.innerHeight;
    let again = false;

    // ---- read phase: every measurement before any style write, so the browser lays out at most once per frame
    // (measuring after each write used to force a fresh layout for every parallax element on every scroll frame).
    const scrollY = window.scrollY;
    const docH = document.documentElement.scrollHeight;
    const rects = fxEls.map(d => (d.el.parentElement ? d.el.parentElement.getBoundingClientRect() : null));
    const heroH = hero ? hero.offsetHeight : 0;
    const ringRect = ring ? ring.section.getBoundingClientRect() : null;

    // ---- write phase

    // smooth the pointer
    const dx = mouse.tx - mouse.x, dy = mouse.ty - mouse.y;
    if (Math.abs(dx) > 0.0005 || Math.abs(dy) > 0.0005) {
      mouse.x += dx * 0.08; mouse.y += dy * 0.08; again = true;
    }

    fxEls.forEach((d, k) => applyFx(d, rects[k]));
    tickHero(scrollY, heroH);
    if (tickRing(ringRect)) again = true;

    const nav = document.getElementById('floating-navbar');
    if (nav) {
      const isScrolled = scrollY > 16;
      nav.classList.toggle('is-scrolled', isScrolled);
      if (nav.parentElement && nav.parentElement.classList.contains('floating-navbar-wrapper')) {
        nav.parentElement.classList.toggle('is-scrolled', isScrolled);
      }
    }

    const bar = progressBar();
    if (bar) {
      const max = docH - vh;
      setStyle(bar, 'transform', 'scaleX(' + (max > 0 ? clamp(scrollY / max, 0, 1) : 0).toFixed(4) + ')');
    }
    if (again) request();
  }

  // ---------------------------------------------------------- pointer input
  function resetTilt(el) {
    if (!el) return;
    el.classList.remove('is-tilting');
    el.style.setProperty('--rx', '0deg');
    el.style.setProperty('--ry', '0deg');
  }

  function onPointerMove(e) {
    if (e.pointerType === 'touch') return;
    mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    request();

    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    // tilt
    const t = target.closest('[data-tilt]');
    if (tiltActive && tiltActive !== t) resetTilt(tiltActive);
    if (t) {
      const max = parseFloat(t.getAttribute('data-tilt')) || 8;
      const r = t.getBoundingClientRect();
      const px = clamp((e.clientX - r.left) / r.width, 0, 1);
      const py = clamp((e.clientY - r.top) / r.height, 0, 1);
      t.classList.add('is-tilting');
      t.style.setProperty('--ry', ((px - 0.5) * 2 * max).toFixed(2) + 'deg');
      t.style.setProperty('--rx', (-(py - 0.5) * 2 * max).toFixed(2) + 'deg');
      t.style.setProperty('--gx', (px * 100).toFixed(1) + '%');
      t.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
    }
    tiltActive = t;

    // magnetic buttons
    const m = target.closest('[data-magnetic]');
    if (magnetActive && magnetActive !== m) magnetActive.style.transform = '';
    if (m) {
      const r = m.getBoundingClientRect();
      const mx = (e.clientX - (r.left + r.width / 2)) * 0.22;
      const my = (e.clientY - (r.top + r.height / 2)) * 0.28;
      m.style.transform = 'translate3d(' + mx.toFixed(1) + 'px,' + my.toFixed(1) + 'px,0)';
    }
    magnetActive = m;

    // liquid bloom button ripple coordinate
    const lb = target.closest('.btn-liquid-bloom');
    if (lb) {
      const r = lb.getBoundingClientRect();
      lb.style.setProperty('--btn-x', (e.clientX - r.left) + 'px');
      lb.style.setProperty('--btn-y', (e.clientY - r.top) + 'px');
    }

    // soft light that follows the pointer inside a scene
    const scene = target.closest('[data-scene]');
    if (scene) {
      const r = scene.getBoundingClientRect();
      scene.style.setProperty('--sx', (e.clientX - r.left) + 'px');
      scene.style.setProperty('--sy', (e.clientY - r.top) + 'px');
    }
  }

  function onPointerLeave() {
    resetTilt(tiltActive); tiltActive = null;
    if (magnetActive) { magnetActive.style.transform = ''; magnetActive = null; }
    mouse.tx = 0; mouse.ty = 0; request();
  }

  // Click effects: disabled (no falling or burst petals)
  function onClick(e) {}

  // ----------------------------------------------------------------- public
  FX.refresh = function () {
    document.documentElement.classList.add('fx-ready');
    hero = document.querySelector('[data-hero]');
    if (hero) hero.__fxDone = false;
    heroContent = document.querySelector('[data-hero-content]');
    heroCard = document.querySelector('[data-hero-card]');
    tiltActive = null; magnetActive = null;
    collectFx();
    setupReveal();
    setupRing();
    request();
  };

  FX.init = function () {
    document.documentElement.classList.add('fx-ready');
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', function () { vh = window.innerHeight; measureRing(); request(); });
    window.addEventListener('load', FX.refresh);
    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onPointerLeave);
    document.addEventListener('click', onClick);
    FX.refresh();
  };

  window.FX = FX;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', FX.init);
  else FX.init();
})();
