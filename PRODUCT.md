# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary**: Gift-givers, event celebrators (anniversaries, birthdays, milestones, proposals), and floral patrons in Metro Manila seeking bespoke, heartfelt artisanal flower arrangements.
- **Situation & Job**: Ordering premium fresh floral arrangements online—either choosing curated signature bouquets or hand-crafting a bespoke arrangement stem-by-stem with personalized wrapping, satin ribbons, and custom greeting cards.
- **Secondary**: Atelier staff and administrators managing order fulfillment, bloom conditioning, bouquet assembly, delivery scheduling, and courier dispatch.

## Product Purpose

Umaira Florist provides an intimate, artisanal digital floral boutique experience that elevates gift-giving through full creative customization, sensory botanical education, and reliable white-glove delivery across Metro Manila.

Success means delighting recipients with freshly conditioned highland and imported blooms, granting patrons complete creative agency over their arrangements without complexity, and maintaining transparent delivery tracking from atelier to doorstep.

## Positioning

An artisanal boutique atelier blending stem-level tactile customization (an interactive 3-step builder covering focal blooms, greenery/fillers, wrapping papers, satin ribbons, and embossed cards) and 3D floral storytelling with white-glove Metro Manila delivery.

Unlike generic mass-market flower delivery services offering only pre-packaged catalog photos, Umaira Florist gives patrons granular creative agency over every individual stem and finishing detail while guaranteeing freshly conditioned Benguet and Dutch imports.

## Operating Context

- **E-Commerce & Gifting Rituals**: Responsive mobile and desktop web browsing. Customers frequently purchase for time-sensitive occasions (same-day milestones or scheduled future dates).
- **Guest vs. Member Boundary**: Public visitors can freely explore the Home page, About Us story, and interactive 3D Florist Care Guide. Full catalog browsing, custom bouquet building, cart/checkout, and order tracking require authenticated customer access.
- **Delivery & Fulfillment Logistics**: Local delivery across Manila District IV and V barangays or store pickup at the BGC atelier (`128 Rosa Street, BGC, Taguig City`), with Grab Express courier integration and real-time status progression (Order Placed &rarr; Conditioning Blooms &rarr; Arranging &rarr; Out for Delivery &rarr; Delivered).

## Capabilities and Constraints

- **Public Experience**: Home (hero showcase, artisan promise, collection teasers), Florist Care Guide (interactive 3D scroll-driven rose model with petal-emerging care cards), About Us (atelier heritage, sourcing ethics).
- **Protected Customer Workflows**: Collections catalog, Build Your Bouquet (3-step stem, filler, and wrap selection with live cost computation), Shopping Cart, Multi-step Checkout (sender contact, recipient address, delivery date/time slot, payment method), Order Tracking by Order ID.
- **Authentication**: Secure email and password authentication with salted PBKDF2 hashing in SQLite, plus Google OAuth 2.0 Sign-In; session management and protected route redirection.
- **3D Botanical Rendering**: Interactive Three.js canvas featuring `assets/models/umaira_3d_rosebud.glb`, GSAP ScrollTrigger timeline, petal-anchored SVG vectors, and HTML educational cards.
- **Data Layer**: Node.js HTTP backend (`server.js`) with persistent SQLite database (`data/umaira.db`) storing users, products, orders, and customizations.

## Brand Commitments

- **Name & Identity**: Umaira Florist (Bespoke Floral Atelier).
- **Tone & Voice**: Poetic, warm, sophisticated, respectful, artisanal, and refined. Speaks with the quiet confidence of a master florist rather than transactional e-commerce urgency.
- **Visual & Material Standards**: Committed to natural botanical elegance, soft petal tones, deep floral burgundies, crisp stationery typography, and tactile craft presentation.

## Evidence on Hand

- **3D Asset**: Verified GLB model at `assets/models/umaira_3d_rosebud.glb` integrated in the Florist Care Guide.
- **Product Catalog**: Live database seed (`data/umaira.db`) with focal flowers (Roses, Peonies, Tulips, Hydrangeas, Orchids), greenery/fillers (Baby's Breath, Eucalyptus, Chamomile, Dusty Miller), artisanal wrapping papers, satin ribbons, and greeting cards.
- **Atelier Presence**: Physical studio location established at `128 Rosa Street, BGC, Taguig City, Metro Manila`.

## Product Principles

- **Artisanal Agency**: Every arrangement honors the customer's personal voice through stem-level transparency and tactile customization.
- **Sensory & Educational Depth**: Treat flowers not as disposable commodities, but as living art with dedicated care guidance and petal-level storytelling.
- **Seamless Trust & Discretion**: Clear guest accessibility, secure customer ordering, transparent pricing without hidden fees, and reliable milestone-driven tracking.
- **Quiet Luxury**: Restraint over clutter; elevate high-quality floral photography, smooth responsive motion, and readable typography above aggressive upselling.

## Accessibility & Inclusion

- High-contrast, readable typography over soft neutral backgrounds.
- Semantic HTML and keyboard navigation for modal overlays, form fields, and navigation links.
- Graceful degradation with fallback static visuals and accessible text for devices unable to render WebGL 3D canvas or users with reduced motion preferences.
