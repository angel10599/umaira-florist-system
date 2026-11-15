// scripts/test-ui-redesign.js
// Automated verification for Umaira Florist Customer Website UI/UX Redesign

const fs = require('fs');
const path = require('path');
const assert = require('assert');

function runTests() {
  console.log('=== UMAIRA FLORIST UI/UX REDESIGN VERIFICATION ===\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  const stylesCss = fs.readFileSync(path.join(__dirname, '..', 'styles.css'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
  const siteUpdateJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'site-update.js'), 'utf8');

  console.log('[1] Background Design & Layered Glow Gradients:');
  test('.layered-glow class is defined in styles.css with radial-gradient and blush pink #F2AFC8', () => {
    assert(stylesCss.includes('.layered-glow {'), 'Missing .layered-glow class');
    assert(stylesCss.includes('radial-gradient'), 'Missing radial-gradient in .layered-glow');
    assert(stylesCss.includes('#F2AFC8'), 'Missing blush pink #F2AFC8 base in .layered-glow');
  });





  test('Home View renders its sections in the approved order', () => {
    const homeViewMatch = siteUpdateJs.match(/function renderHomeView\(\)\s*\{[\s\S]*?return\s*''\s*\+([\s\S]*?);\s*\}/);
    assert(homeViewMatch, 'Could not find renderHomeView');
    const sequenceBody = homeViewMatch[1];
    const expectedCalls = ['renderHero', 'renderShopByOccasionSection', 'renderFeaturedFlowersSection',
      'renderWhyChooseUsSection', 'renderHowToOrderSection', 'renderAtelierLocationSection'];
    let lastIdx = -1;
    for (const fn of expectedCalls) {
      const idx = sequenceBody.indexOf(fn);
      assert(idx > -1, `Missing ${fn} in renderHomeView sequence`);
      assert(idx > lastIdx, `${fn} is out of order in renderHomeView sequence`);
      lastIdx = idx;
    }
  });

  test('Shop by Occasion section is rendered on the home page', () => {
    assert(siteUpdateJs.includes('function renderShopByOccasionSection('), 'Missing section renderer');
  });

  test('Featured Bouquets section is rendered on the home page', () => {
    assert(siteUpdateJs.includes('function renderFeaturedFlowersSection('), 'Missing section renderer');
  });

  test('Why Choose Us section is rendered on the home page', () => {
    assert(siteUpdateJs.includes('function renderWhyChooseUsSection('), 'Missing section renderer');
  });

  test('How to Order section is rendered on the home page', () => {
    assert(siteUpdateJs.includes('function renderHowToOrderSection('), 'Missing section renderer');
  });

  test('Atelier Location section is rendered on the home page', () => {
    assert(siteUpdateJs.includes('function renderAtelierLocationSection('), 'Missing section renderer');
  });

  console.log('\n[2] Floating Navigation Bar Redesign:');
  test('Floating navbar container has compact height (64px - 72px) and pill shape', () => {
    assert(stylesCss.includes('min-height: 64px;'), 'styles.css missing min-height: 64px');
    assert(stylesCss.includes('height: 64px;'), 'styles.css missing height: 64px');
    assert(stylesCss.includes('border-radius: 9999px;'), 'styles.css missing border-radius: 9999px');
    assert(indexHtml.includes('h-[64px] sm:h-[72px]'), 'index.html navbar missing compact height');
  });

  test('Floating navbar has glassmorphic backdrop-filter blur and soft pink shadow', () => {
    assert(stylesCss.includes('backdrop-filter: blur('), 'Missing backdrop-filter blur in floating navbar');
    assert(stylesCss.includes('--nav-shadow-glass'), 'Missing --nav-shadow-glass in styles.css');
    assert(stylesCss.includes('box-shadow: var(--nav-shadow-glass);'), 'Navbar does not use --nav-shadow-glass');
  });

  test('Floating navbar scroll effect (.is-scrolled) increases opacity and elevation', () => {
    assert(stylesCss.includes('.floating-navbar.is-scrolled'), 'Missing .floating-navbar.is-scrolled');
    assert(stylesCss.includes('--nav-shadow-scrolled'), 'Missing --nav-shadow-scrolled');
  });

  test('Pill-shaped nav links have a distinct active state', () => {
    assert(stylesCss.includes('.nav-link-pill.is-active'), 'Missing .nav-link-pill.is-active');
  });

  test('Floating navbar includes all required sections: Logo, Home, Collections, Builder, About, Contact, Search, Cart, Notifs, Account', () => {
    assert(indexHtml.includes('alt="Umaira Florist"'), 'Missing logo');
    assert(indexHtml.includes('data-view="home"'), 'Missing Home link');
    assert(indexHtml.includes('data-view="collections"'), 'Missing Collections link');
    assert(indexHtml.includes('data-view="builder"'), 'Missing Builder link');
    assert(indexHtml.includes('id="about-dropdown-btn"'), 'Missing About dropdown button');
    assert(indexHtml.includes('data-view="contact"'), 'Missing Contact link');
    assert(indexHtml.includes('id="nav-search-btn"'), 'Missing Search button');
    assert(indexHtml.includes('id="nav-cart-btn"'), 'Missing Cart button');
    assert(indexHtml.includes('id="customer-notif-container"'), 'Missing Notifications container');
    assert(indexHtml.includes('id="nav-auth-container"'), 'Missing Account / Sign In container');
  });

  console.log('\n[3] Mobile Navigation:');
  test('Mobile hamburger menu toggle exists with aria-expanded attribute', () => {
    assert(indexHtml.includes('id="mobile-menu-btn"'), 'Missing #mobile-menu-btn');
    assert(indexHtml.includes('aria-label="Toggle navigation menu"'), 'Missing aria-label on mobile menu button');
  });

  test('Mobile nav drawer exists with mobile links and close helpers', () => {
    assert(indexHtml.includes('id="mobile-nav-drawer"'), 'Missing #mobile-nav-drawer');
    assert(indexHtml.includes('class="mobile-nav-link"'), 'Missing .mobile-nav-link elements');
  });

  test('appRouter includes toggleMobileMenu, closeMobileMenu, and navigateToContact', () => {
    assert(appJs.includes('toggleMobileMenu()'), 'Missing toggleMobileMenu in app.js');
    assert(appJs.includes('closeMobileMenu()'), 'Missing closeMobileMenu in app.js');
    assert(appJs.includes('navigateToContact()'), 'Missing navigateToContact in app.js');
  });

  test('updateNavBar updates both desktop and mobile active links', () => {
    assert(appJs.includes("document.querySelectorAll('.nav-link, .mobile-nav-link')"), 'updateNavBar does not query mobile links');
    assert(appJs.includes("link.classList.toggle('is-active', Boolean(isActive))"), 'updateNavBar does not toggle is-active');
  });

  console.log('\n[4] Color Palette & Typography Consistency:');
  test('Cormorant Garamond font-serif and Manrope font-sans are configured', () => {
    assert(indexHtml.includes('Cormorant+Garamond'), 'Missing Cormorant Garamond font link');
    assert(indexHtml.includes('Manrope'), 'Missing Manrope font link');
    assert(stylesCss.includes('--font-display') && stylesCss.includes('Cormorant Garamond'), 'Missing --font-display');
    assert(stylesCss.includes('--font-body') && stylesCss.includes('Manrope'), 'Missing --font-body');
  });



  console.log('\n[5] Simplified Bouquet Builder Step Navigation:');
  const builderJs = fs.readFileSync(path.join(__dirname, '..', 'js', 'builder.js'), 'utf8');

  test('Redundant small "Step X" labels are removed from step navigation', () => {
    assert(!builderJs.includes('Step ${s.num}'), 'builder.js still contains redundant "Step ${s.num}" label');
  });

  test('Numbered circles (1, 2, 3, 4, 5) are retained, with a checkmark when a step is complete', () => {
    assert(builderJs.includes('${s.num}'), 'Numbered circle step number missing');
    assert(builderJs.includes('${isDone ?') && builderJs.includes('title="Completed"'), 'Completed checkmark missing');
  });

  test('Step titles (Flowers, Fillers, Wrapping, Ribbon, Card) are retained', () => {
    assert(builderJs.includes('${s.label}'), 'Step title label missing');
  });

  test('Steps that cannot be used yet are shown as locked (no stems, or no wrapping)', () => {
    assert(builderJs.includes('const isLocked = (s.num >= 2 && totalStems === 0) || (s.num >= 4 && wrappings.length === 0)'), 'Locked-step rule missing');
    assert(builderJs.includes('cursor-not-allowed'), 'Locked steps must look disabled');
  });

  console.log(`\n======================================================`);
  console.log(`UI/UX REDESIGN SUMMARY: ${passed} passed, ${failed} failed`);
  console.log(`======================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
