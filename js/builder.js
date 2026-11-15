/**
 * UMAIRA FLORIST — Phase 3: Build Your Own Bouquet
 *
 * Fully functional 5-Step Custom Bouquet Studio:
 *  Step 1 — Choose Your Flowers (13 main flower types, at least 1 stem required, quantity controls)
 *  Step 2 — Choose Fillers & Greenery (10 options, max 3 types, optional, counter X/3)
 *  Step 3 — Choose Your Wrapping (10 options, 1 to 3 types, color selection per layer, counter X/3)
 *  Step 4 — Choose Your Ribbon (5 types, up to 2 types, color selection per ribbon, counter X/2)
 *  Step 5 — Add a Greeting Card (5 card designs, max 1 card, 250-char message with live counter)
 *
 * Connected directly to database inventory via appState and server pricing.
 */

class BouquetBuilderController {
  constructor() {
    this.currentStep = 1;
    this.totalSteps = 5;
    this.flowerCategory = 'all';
    this.flowerSearch = '';
    this._hasRegisteredListener = false;
    this.init();
  }

  init() {
    if (this._hasRegisteredListener) return;
    this._hasRegisteredListener = true;

    appState.on('builder_change', () => {
      this.renderProgressIndicator();
      if (!document.activeElement || document.activeElement.id !== 'builder-card-message') {
        this.renderCurrentStep();
      }
      this.updateSelectedBouquetPanel();
    });

    appState.on('catalog_change', () => {
      this.renderCurrentStep();
      this.updateSelectedBouquetPanel();
    });
  }

  // --------------------------------------------------------------------------
  // Data Helpers & Color Resolvers
  // --------------------------------------------------------------------------
  parseColors(style) {
    if (!style) return [];
    try {
      const parsed = JSON.parse(style);
      if (Array.isArray(parsed)) return parsed;
      if (parsed && Array.isArray(parsed.colors)) return parsed.colors;
    } catch (_) {}
    if (typeof style === 'string' && style.includes(',')) {
      return style.split(',').map(s => {
        const name = s.trim();
        return { name, hex: '#EBF1EC' };
      });
    }
    return [];
  }

  getSelectedWrappings(state = appState.builderState) {
    if (Array.isArray(state.wrappings)) return state.wrappings;
    if (state.wrapping) return [state.wrapping];
    return [];
  }

  getSelectedRibbons(state = appState.builderState) {
    if (Array.isArray(state.ribbons)) return state.ribbons;
    if (state.ribbon) return [state.ribbon];
    return [];
  }

  getSelectedFillers(state = appState.builderState) {
    if (Array.isArray(state.fillers) && state.fillers.length > 0) return state.fillers;
    const list = [];
    if (state.filler) list.push({ id: state.filler, quantity: 1 });
    if (state.greenery) list.push({ id: state.greenery, quantity: 1 });
    return list;
  }

  getTotalMainStems(state = appState.builderState) {
    return (state.mainFlowers || []).reduce((acc, f) => acc + (Number(f.quantity) || 0), 0);
  }

  // Calculate pricing breakdown in real-time
  calculateBreakdown(state = appState.builderState) {
    const items = [];
    let subtotal = 0;

    // 1. Main Flowers
    (state.mainFlowers || []).forEach(item => {
      const fl = getFlowerById(item.id);
      if (fl && item.quantity > 0) {
        const itemTotal = fl.price * item.quantity;
        subtotal += itemTotal;
        items.push({
          type: 'main_flower',
          id: fl.id,
          name: `${fl.name} × ${item.quantity}`,
          rawName: fl.name,
          unitPrice: fl.price,
          quantity: item.quantity,
          total: itemTotal,
          color: fl.color,
          image: fl.image
        });
      }
    });

    // 2. Fillers & Greenery
    const fillers = this.getSelectedFillers(state);
    fillers.forEach(f => {
      const fid = typeof f === 'object' ? f.id : f;
      const fqty = typeof f === 'object' ? (Number(f.quantity) || 1) : 1;
      const fil = getFillerById(fid) || getGreeneryById(fid);
      if (fil) {
        const line = fil.price * fqty;
        subtotal += line;
        items.push({
          type: 'filler',
          id: fil.id,
          name: `${fil.name} × ${fqty}`,
          rawName: fil.name,
          unitPrice: fil.price,
          quantity: fqty,
          total: line,
          image: fil.image
        });
      }
    });

    // 3. Wrapping Materials
    // Entries are ids in the live builder, but {id, color, ...} objects in saved cart specs. Both must
    // price identically, otherwise the cart re-prices a custom bouquet without its wrapping and ribbons.
    const wrappings = this.getSelectedWrappings(state);
    wrappings.forEach(w => {
      const wid = (w && typeof w === 'object') ? w.id : w;
      const wrp = getWrappingById(wid);
      if (wrp) {
        subtotal += wrp.price;
        const chosenColor = (state.wrappingColors && state.wrappingColors[wid]) || ((w && typeof w === 'object' && w.color) || '');
        items.push({
          type: 'wrapping',
          id: wrp.id,
          name: wrp.name + (chosenColor ? ` (${chosenColor})` : ''),
          rawName: wrp.name,
          chosenColor: chosenColor,
          unitPrice: wrp.price,
          quantity: 1,
          total: wrp.price,
          colorHex: wrp.colorHex,
          image: wrp.image
        });
      }
    });

    // 4. Ribbons
    const ribbons = this.getSelectedRibbons(state);
    ribbons.forEach(r => {
      const rid = (r && typeof r === 'object') ? r.id : r;
      const rbn = getRibbonById(rid);
      if (rbn) {
        subtotal += rbn.price;
        const chosenColor = (state.ribbonColors && state.ribbonColors[rid]) || ((r && typeof r === 'object' && r.color) || '');
        items.push({
          type: 'ribbon',
          id: rbn.id,
          name: rbn.name + (chosenColor ? ` (${chosenColor})` : ''),
          rawName: rbn.name,
          chosenColor: chosenColor,
          unitPrice: rbn.price,
          quantity: 1,
          total: rbn.price,
          colorHex: rbn.colorHex,
          image: rbn.image
        });
      }
    });

    // 5. Greeting Card
    if (state.cardDesign && state.cardDesign !== 'crd-none') {
      const crd = getCardDesignById(state.cardDesign);
      if (crd) {
        const cardPrice = crd.price || 0;
        subtotal += cardPrice;
        items.push({
          type: 'card',
          id: crd.id,
          name: crd.name,
          rawName: crd.name,
          unitPrice: cardPrice,
          quantity: 1,
          total: cardPrice,
          message: state.cardMessage || state.message || ''
        });
      }
    }

    // Assembly / arrangement fee is completely excluded from custom bouquet pricing.
    return { items, subtotal };
  }

  // --------------------------------------------------------------------------
  // Navigation & Step Validation
  // --------------------------------------------------------------------------
  validateStep(stepNum) {
    const state = appState.builderState;
    if (stepNum === 1) {
      const minStems = Number(appState.customBuilderSettings?.minStems) || 1;
      const maxStems = Number(appState.customBuilderSettings?.maxStems) || 50;
      const totalStems = this.getTotalMainStems(state);
      if (totalStems < minStems) {
        if (typeof showToast === 'function') {
          showToast(`Please select at least ${minStems} flower stem${minStems !== 1 ? 's' : ''} to continue.`, 'error');
        }
        return false;
      }
      if (totalStems > maxStems) {
        if (typeof showToast === 'function') {
          showToast(`Custom bouquet cannot exceed ${maxStems} stems. Current: ${totalStems}.`, 'error');
        }
        return false;
      }
    }
    if (stepNum === 3) {
      const wrappings = this.getSelectedWrappings(state);
      if (wrappings.length < 1) {
        if (typeof showToast === 'function') showToast('Please select at least 1 wrapping material to continue.', 'error');
        return false;
      }
    }
    return true;
  }

  goToStep(targetStep) {
    if (targetStep === this.currentStep) return;
    // Moving backwards is always allowed
    if (targetStep < this.currentStep) {
      this.currentStep = targetStep;
      this.renderProgressIndicator();
      this.renderCurrentStep();
      this.updateSelectedBouquetPanel();
      window.scrollTo({ top: 120, behavior: 'smooth' });
      return;
    }
    // Moving forward requires validating all intermediate steps
    for (let s = 1; s < targetStep; s++) {
      if (!this.validateStep(s)) return;
    }
    this.currentStep = targetStep;
    this.renderProgressIndicator();
    this.renderCurrentStep();
    this.updateSelectedBouquetPanel();
    window.scrollTo({ top: 120, behavior: 'smooth' });
  }

  nextStep() {
    if (!this.validateStep(this.currentStep)) return;
    if (this.currentStep < this.totalSteps) {
      this.currentStep++;
      this.renderProgressIndicator();
      this.renderCurrentStep();
      this.updateSelectedBouquetPanel();
      window.scrollTo({ top: 120, behavior: 'smooth' });
    } else {
      this.proceedToCheckout();
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.currentStep--;
      this.renderProgressIndicator();
      this.renderCurrentStep();
      this.updateSelectedBouquetPanel();
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  }

  resetBuilder(skipConfirm = false) {
    if (skipConfirm || window.confirm('Are you sure you want to reset your custom bouquet? All current selections will be cleared.')) {
      appState.resetBuilder();
      this.currentStep = 1;
      this.flowerCategory = 'all';
      this.flowerSearch = '';
      this.renderProgressIndicator();
      this.renderCurrentStep();
      this.updateSelectedBouquetPanel();
      if (!skipConfirm && typeof showToast === 'function') showToast('Your bouquet has been reset.', 'info');
    }
  }

  // --------------------------------------------------------------------------
  // Selection Handlers
  // --------------------------------------------------------------------------
  // Step 1: Main Flowers
  updateMainFlowerQty(flowerId, delta) {
    const fl = getFlowerById(flowerId);
    if (!fl) return;

    if (delta > 0 && (fl.availability === 'unavailable' || fl.availability === 'sold_out' || (fl.stockCount != null && fl.stockCount <= 0))) {
      if (typeof showToast === 'function') showToast(`${fl.name} is currently unavailable for purchase.`, 'error');
      return;
    }

    const state = { ...appState.builderState };
    const list = Array.isArray(state.mainFlowers) ? [...state.mainFlowers] : [];
    const idx = list.findIndex(item => item.id === flowerId);

    const currentQty = idx >= 0 ? list[idx].quantity : 0;
    let newQty = Math.max(0, currentQty + delta);

    const maxStems = Number(appState.customBuilderSettings?.maxStems) || 50;
    const currentTotal = this.getTotalMainStems(state);
    if (delta > 0 && currentTotal + delta > maxStems) {
      if (typeof showToast === 'function') showToast(`Custom bouquet cannot exceed ${maxStems} stems.`, 'warning');
      return;
    }

    if (fl.stockCount > 0 && newQty > fl.stockCount) {
      newQty = fl.stockCount;
      if (typeof showToast === 'function') showToast(`Only ${fl.stockCount} stem(s) of ${fl.name} available in stock.`, 'info');
    }
    if (newQty > maxStems) newQty = maxStems;

    if (idx >= 0) {
      if (newQty === 0) list.splice(idx, 1);
      else list[idx].quantity = newQty;
    } else if (newQty > 0) {
      list.push({ id: flowerId, quantity: newQty });
    }

    appState.setBuilderState({ mainFlowers: list });
  }

  setFlowerCategory(category) {
    this.flowerCategory = category;
    this.renderCurrentStep();
  }

  setFlowerSearch(query) {
    this.flowerSearch = (query || '').toLowerCase().trim();
    this.renderCurrentStep();
  }

  // Step 2: Fillers & Greenery (Max 3)
  toggleFiller(fillerId) {
    const fil = getFillerById(fillerId) || getGreeneryById(fillerId);
    if (!fil) return;

    const state = { ...appState.builderState };
    const list = this.getSelectedFillers(state);
    const existingIdx = list.findIndex(f => (typeof f === 'object' ? f.id : f) === fillerId);

    if (existingIdx >= 0) {
      list.splice(existingIdx, 1);
    } else {
      if (fil.availability === 'unavailable' || fil.availability === 'sold_out' || (fil.stockCount != null && fil.stockCount <= 0)) {
        if (typeof showToast === 'function') showToast(`${fil.name} is currently unavailable for purchase.`, 'error');
        return;
      }
      if (list.length >= 3) {
        if (typeof showToast === 'function') {
          showToast('You can select up to 3 filler & greenery types. Please remove one first.', 'error');
        }
        return;
      }
      list.push({ id: fillerId, quantity: 1 });
    }

    appState.setBuilderState({ fillers: list, filler: list[0]?.id || '', greenery: list[1]?.id || '' });
  }

  updateFillerQty(fillerId, delta) {
    const state = { ...appState.builderState };
    const list = this.getSelectedFillers(state);
    const idx = list.findIndex(f => (typeof f === 'object' ? f.id : f) === fillerId);
    if (idx < 0) return;

    const item = typeof list[idx] === 'object' ? list[idx] : { id: list[idx], quantity: 1 };
    const newQty = Math.max(1, Math.min(10, (Number(item.quantity) || 1) + delta));
    list[idx] = { id: fillerId, quantity: newQty };

    appState.setBuilderState({ fillers: list, filler: list[0]?.id || '', greenery: list[1]?.id || '' });
  }

  // Step 3: Wrapping (1 to 3, with color selector)
  toggleWrapping(wrappingId) {
    const wrp = getWrappingById(wrappingId);
    if (!wrp) return;

    const state = { ...appState.builderState };
    const list = [...this.getSelectedWrappings(state)];
    const colors = { ...(state.wrappingColors || {}) };
    const idx = list.indexOf(wrappingId);

    if (idx >= 0) {
      if (list.length <= 1) {
        if (typeof showToast === 'function') showToast('Your bouquet requires at least one wrapping paper.', 'info');
        return;
      }
      list.splice(idx, 1);
      delete colors[wrappingId];
    } else {
      if (wrp.availability === 'unavailable' || wrp.availability === 'sold_out' || (wrp.stockCount != null && wrp.stockCount <= 0)) {
        if (typeof showToast === 'function') showToast(`${wrp.name} is currently unavailable for purchase.`, 'error');
        return;
      }
      if (list.length >= 3) {
        if (typeof showToast === 'function') showToast('You may select up to 3 wrapping types for layered wrapping.', 'error');
        return;
      }
      list.push(wrappingId);
      // Pick first color option by default
      const availableColors = this.parseColors(wrp.style);
      if (availableColors.length > 0 && !colors[wrappingId]) {
        colors[wrappingId] = availableColors[0].name;
      }
    }

    appState.setBuilderState({
      wrappings: list,
      wrapping: list[0] || 'wrp-korean-matte',
      wrappingColors: colors
    });
  }

  selectWrappingColor(wrappingId, colorName) {
    const state = { ...appState.builderState };
    const colors = { ...(state.wrappingColors || {}) };
    colors[wrappingId] = colorName;
    appState.setBuilderState({ wrappingColors: colors });
  }

  // Step 4: Ribbon (0 to 2, with color selector)
  toggleRibbon(ribbonId) {
    const rbn = getRibbonById(ribbonId);
    if (!rbn) return;

    const state = { ...appState.builderState };
    const list = [...this.getSelectedRibbons(state)];
    const colors = { ...(state.ribbonColors || {}) };
    const idx = list.indexOf(ribbonId);

    if (idx >= 0) {
      list.splice(idx, 1);
      delete colors[ribbonId];
    } else {
      if (rbn.availability === 'unavailable' || rbn.availability === 'sold_out' || (rbn.stockCount != null && rbn.stockCount <= 0)) {
        if (typeof showToast === 'function') showToast(`${rbn.name} is currently unavailable for purchase.`, 'error');
        return;
      }
      if (list.length >= 2) {
        if (typeof showToast === 'function') showToast('You may select up to 2 ribbon types for decorative finishing.', 'error');
        return;
      }
      list.push(ribbonId);
      const availableColors = this.parseColors(rbn.style);
      if (availableColors.length > 0 && !colors[ribbonId]) {
        colors[ribbonId] = availableColors[0].name;
      }
    }

    appState.setBuilderState({
      ribbons: list,
      ribbon: list[0] || '',
      ribbonColors: colors
    });
  }

  selectRibbonColor(ribbonId, colorName) {
    const state = { ...appState.builderState };
    const colors = { ...(state.ribbonColors || {}) };
    colors[ribbonId] = colorName;
    appState.setBuilderState({ ribbonColors: colors });
  }

  // Step 5: Greeting Card & Message
  selectCardDesign(cardId) {
    if (cardId && cardId !== 'crd-none') {
      const crd = (FLOWER_DATA.cardDesigns || []).find(c => c.id === cardId) || (FLOWER_DATA.allMaterials || []).find(m => m.id === cardId);
      if (crd && (crd.availability === 'unavailable' || crd.availability === 'sold_out' || (crd.stockCount != null && crd.stockCount <= 0))) {
        if (typeof showToast === 'function') showToast(`${crd.name} is currently unavailable for purchase.`, 'error');
        return;
      }
    }
    const state = { ...appState.builderState };
    const next = state.cardDesign === cardId ? '' : cardId;
    appState.setBuilderState({ cardDesign: next });
  }

  handleCardMessageInput(val) {
    const truncated = String(val || '').slice(0, 250);
    appState.setBuilderState({ cardMessage: truncated, message: truncated }, false);
    const counter = document.getElementById('card-char-counter');
    if (counter) counter.innerText = `${truncated.length}/250`;
    const previewText = document.getElementById('card-live-preview-text');
    if (previewText) {
      previewText.innerText = truncated.trim() || 'Your personalized handwritten message will appear here...';
    }
  }

  // --------------------------------------------------------------------------
  // Progress Indicator (5-Step Breadcrumb Bar)
  // --------------------------------------------------------------------------
  renderProgressIndicator() {
    const nav = document.getElementById('builder-nav-tabs');
    if (!nav) return;

    const state = appState.builderState;
    const totalStems = this.getTotalMainStems(state);
    const fillers = this.getSelectedFillers(state);
    const wrappings = this.getSelectedWrappings(state);
    const ribbons = this.getSelectedRibbons(state);
    const hasCard = Boolean(state.cardDesign && state.cardDesign !== 'crd-none') || Boolean(state.cardMessage && state.cardMessage.trim());

    // 5 Steps — Clean navigation without redundant selection counters
    const steps = [
      {
        num: 1,
        label: 'Flowers',
        isCompleted: totalStems > 0
      },
      {
        num: 2,
        label: 'Fillers',
        isCompleted: fillers.length > 0 || this.currentStep > 2
      },
      {
        num: 3,
        label: 'Wrapping',
        isCompleted: wrappings.length > 0
      },
      {
        num: 4,
        label: 'Ribbon',
        isCompleted: ribbons.length > 0 || (this.currentStep > 4 && wrappings.length > 0)
      },
      {
        num: 5,
        label: 'Greeting Card',
        isCompleted: hasCard
      }
    ];

    nav.innerHTML = `
      <div class="grid grid-cols-5 min-w-[560px] sm:min-w-0 gap-1.5 sm:gap-2.5 w-full">
        ${steps.map(s => {
          const isActive = this.currentStep === s.num;
          const isDone = s.isCompleted;
          const isLocked = (s.num >= 2 && totalStems === 0) || (s.num >= 4 && wrappings.length === 0);

          let btnClass = '';
          let circleClass = '';
          if (isActive) {
            btnClass = 'bg-[#647D69] text-white shadow-xs';
            circleClass = 'bg-white text-[#647D69]';
          } else if (isDone) {
            btnClass = 'bg-[#F7FAF8] text-[#302C2A] border border-[#E5ECE6] hover:border-[#647D69] cursor-pointer';
            circleClass = 'bg-[#647D69] text-white';
          } else if (!isLocked) {
            btnClass = 'bg-[#FFF9F5] text-[#302C2A] border border-[#E5ECE6] hover:border-[#647D69] cursor-pointer';
            circleClass = 'bg-stone-200 text-stone-600';
          } else {
            btnClass = 'bg-stone-50 text-stone-400 border border-stone-200 cursor-not-allowed';
            circleClass = 'bg-stone-200 text-stone-400';
          }

          return `
            <button type="button" onclick="window.builderCtrl.goToStep(${s.num})" class="px-2.5 sm:px-3 py-2 rounded-xl text-left transition flex items-center justify-between gap-1.5 min-w-0 ${btnClass}">
              <div class="flex items-center gap-1.5 sm:gap-2 min-w-0">
                <span class="w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center text-[11px] sm:text-xs font-bold shrink-0 ${circleClass}">
                  ${s.num}
                </span>
                <span class="text-xs sm:text-[13px] font-serif font-bold whitespace-nowrap leading-tight">
                  ${s.label}
                </span>
              </div>
              ${isDone ? `
                <span class="w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-white/20 text-white' : 'text-[#647D69]'}" title="Completed">
                  <svg class="w-3 h-3 sm:w-3.5 sm:h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
                </span>
              ` : ''}
            </button>
          `;
        }).join('')}
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // Main Step Views Renderer
  // --------------------------------------------------------------------------
  renderCurrentStep() {
    const container = document.getElementById('builder-tab-content');
    if (!container) return;

    this.renderProgressIndicator();

    switch (this.currentStep) {
      case 1:
        container.innerHTML = this.renderStep1Flowers();
        break;
      case 2:
        container.innerHTML = this.renderStep2Fillers();
        break;
      case 3:
        container.innerHTML = this.renderStep3Wrapping();
        break;
      case 4:
        container.innerHTML = this.renderStep4Ribbon();
        break;
      case 5:
      default:
        container.innerHTML = this.renderStep5Card();
        break;
    }

    container.classList.remove('builder-step-animate');
    void container.offsetWidth;
    container.classList.add('builder-step-animate');
  }

  // --------------------------------------------------------------------------
  // STEP 1: CHOOSE YOUR FLOWERS (13 Flower Types)
  // --------------------------------------------------------------------------
  renderStep1Flowers() {
    const state = appState.builderState;
    const totalStems = this.getTotalMainStems(state);
    const flowers = FLOWER_DATA.mainFlowers || [];

    // 13 Flower Types Defined by Umaira Specification
    const categories = [
      { id: 'all', label: 'All Blooms' },
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
      { id: 'Snapdragons', label: 'Snapdragons' }
    ];

    // Filter by type and search query
    const filtered = flowers.filter(f => {
      if (this.flowerSearch) {
        const q = this.flowerSearch;
        const matchesName = f.name.toLowerCase().includes(q) || (f.botanicalName && f.botanicalName.toLowerCase().includes(q));
        if (!matchesName) return false;
      }
      if (this.flowerCategory === 'all') return true;
      const targetCat = this.flowerCategory.toLowerCase().replace(/s$/, '');
      const flowerName = f.name.toLowerCase();
      const catName = (f.category || '').toLowerCase();
      return flowerName.includes(targetCat) || catName.includes(targetCat);
    });

    return `
      <div class="space-y-6">
        <!-- Step Header -->
        <div class="border-b border-[#E5ECE6] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-[#647D69] text-white text-xs font-bold flex items-center justify-center">1</span>
              <h2 class="font-serif text-2xl font-bold text-[#302C2A]">Choose Your Flowers</h2>
            </div>
            <p class="text-xs sm:text-sm text-[#6E6864] mt-1">Select fresh flower varieties (${Number(appState.customBuilderSettings?.minStems) || 1} to ${Number(appState.customBuilderSettings?.maxStems) || 50} stems allowed).</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold px-3 py-1 rounded-full bg-[#EBF1EC]/60 text-[#647D69] border border-[#E5ECE6]">
              ${totalStems} Stem${totalStems !== 1 ? 's' : ''} Selected
            </span>
          </div>
        </div>

        <!-- Filter Pills & Search Input -->
        <div class="space-y-3">
          <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            ${categories.map(c => `
              <button type="button" onclick="window.builderCtrl.setFlowerCategory('${c.id}')" class="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${this.flowerCategory === c.id ? 'bg-[#302C2A] text-white shadow-xs' : 'bg-[#FFF9F5] text-[#6E6864] border border-[#E5ECE6] hover:border-[#647D69]'}">
                ${c.label}
              </button>
            `).join('')}
          </div>

          <div class="relative">
            <input type="text" placeholder="Search flowers..." value="${escapeHtml(this.flowerSearch)}" oninput="window.builderCtrl.setFlowerSearch(this.value)" class="w-full pl-9 pr-8 py-2 bg-white border border-[#E5ECE6] rounded-xl text-xs text-[#302C2A] focus:outline-none focus:ring-2 focus:ring-[#647D69]/20 focus:border-[#647D69]" />
            <svg class="w-4 h-4 text-[#6E6864] absolute left-3 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            ${this.flowerSearch ? `<button type="button" onclick="window.builderCtrl.setFlowerSearch('')" class="absolute right-3 top-2.5 text-[#6E6864] hover:text-[#302C2A]" aria-label="Clear search"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>` : ''}
          </div>
        </div>

        <!-- Flower Cards Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          ${filtered.length === 0 ? `
            <div class="col-span-full py-12 text-center text-xs text-[#6E6864] bg-[#FFF9F5] rounded-2xl border border-dashed border-[#E5ECE6]">
              No flower varieties match your filter. Try choosing "All Blooms" or clear your search.
            </div>
          ` : filtered.map(fl => {
            const currentItem = (state.mainFlowers || []).find(item => item.id === fl.id);
            const qty = currentItem ? currentItem.quantity : 0;
            const isUnavailable = fl.availability === 'unavailable';
            const isOutOfStock = fl.availability === 'sold_out' || (fl.stockCount != null && fl.stockCount <= 0);
            const isSoldOut = isUnavailable || isOutOfStock;
            const isSelected = qty > 0;

            return `
              <div class="p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${isSelected ? 'border-[#647D69] bg-[#FFF9F5] shadow-xs' : 'border-[#E5ECE6] bg-white hover:border-[#647D69]/50'} ${isSoldOut ? 'opacity-70 bg-stone-50/80' : ''}">
                <div class="flex items-start gap-3">
                  <!-- Image / Placeholder -->
                  <div class="w-16 h-16 rounded-xl overflow-hidden border border-[#E5ECE6] shrink-0 bg-[#FFF9F5] flex items-center justify-center relative">
                    ${fl.image ? `
                      <img src="${escapeHtml(fl.image)}" alt="${escapeHtml(fl.name)}" class="w-full h-full object-cover" />
                    ` : `
                      <div class="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#FFF9F5] to-[#EBF1EC]/40 text-[#647D69]">
                        <span class="w-3.5 h-3.5 rounded-full mb-1 shadow-xs" style="background-color: ${fl.color || '#647D69'}"></span>
                        <svg class="w-5 h-5 opacity-80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>
                      </div>
                    `}
                  </div>

                  <!-- Details -->
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-1">
                      <h3 class="font-serif font-bold text-sm text-[#302C2A] truncate">${escapeHtml(fl.name)}</h3>
                    </div>
                    ${fl.botanicalName ? `<p class="text-[10px] text-[#6E6864] italic truncate">${escapeHtml(fl.botanicalName)}</p>` : ''}
                    <p class="font-mono text-xs font-bold text-[#647D69] mt-1">${formatCurrency(fl.price)} <span class="text-[10px] text-[#6E6864] font-normal">/ stem</span></p>

                    <!-- Stock Badge & Suggested Occasions -->
                    <div class="mt-1 flex flex-wrap items-center gap-1.5">
                      ${isUnavailable ? `
                        <span class="inline-flex items-center text-[9px] font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-1.5 py-0.2 rounded-md">Unavailable</span>
                      ` : isOutOfStock ? `
                        <span class="inline-flex items-center text-[9px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded-md">Out of Stock</span>
                      ` : `
                        <span class="inline-flex items-center text-[9px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded-md">In Stock (${fl.stockCount})</span>
                      `}
                    </div>

                    ${(() => {
                      const occList = (fl.occasions && fl.occasions.length) ? fl.occasions : (fl.style && /occasion:/i.test(fl.style) ? fl.style.replace(/^.*?occasion:\s*/i, '').split(',').map(s => s.trim()).filter(Boolean) : []);
                      if (!occList.length) return '';
                      return `
                        <div class="mt-1.5 flex flex-wrap gap-1">
                          ${occList.slice(0, 3).map(occ => `
                            <span class="inline-flex items-center text-[9px] font-semibold text-[#647D69] bg-[#F7FAF8] border border-[#E5ECE6] px-1.5 py-0.5 rounded-md">
                              ${escapeHtml(occ.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()))}
                            </span>
                          `).join('')}
                        </div>
                      `;
                    })()}
                  </div>
                </div>

                <!-- Quantity Control Stepper -->
                <div class="mt-3 pt-2.5 border-t border-[#E5ECE6]/60 flex items-center justify-between">
                  <span class="text-[11px] text-[#6E6864] font-medium">Quantity</span>
                  ${isSoldOut ? `
                    <button type="button" disabled class="px-3 py-1 rounded-lg bg-stone-100 text-stone-400 text-xs font-semibold cursor-not-allowed">${isUnavailable ? 'Unavailable' : 'Sold Out'}</button>
                  ` : `
                    <div class="flex items-center gap-1.5 bg-white border border-[#E5ECE6] rounded-xl px-1.5 py-0.5 shadow-2xs">
                      <button type="button" onclick="window.builderCtrl.updateMainFlowerQty('${fl.id}', -1)" aria-label="Decrease stem count" class="w-6 h-6 rounded-lg text-[#302C2A] hover:bg-[#EBF1EC]/40 hover:text-[#647D69] font-bold flex items-center justify-center text-sm transition ${qty === 0 ? 'opacity-30 cursor-not-allowed' : ''}">&minus;</button>
                      <span class="w-6 text-center font-bold text-xs font-mono text-[#302C2A]">${qty}</span>
                      <button type="button" onclick="window.builderCtrl.updateMainFlowerQty('${fl.id}', 1)" aria-label="Increase stem count" class="w-6 h-6 rounded-lg text-[#302C2A] hover:bg-[#EBF1EC]/40 hover:text-[#647D69] font-bold flex items-center justify-center text-sm transition">+</button>
                    </div>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Step Navigation Bar -->
        <div class="pt-6 border-t border-[#E5ECE6] flex items-center justify-between">
          <button type="button" onclick="window.appRouter.navigate('collections')" class="text-xs text-[#6E6864] hover:text-[#302C2A] font-semibold">
            <span class="inline-flex items-center gap-1.5"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg><span>Back to Collections</span></span>
          </button>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // STEP 2: CHOOSE FILLERS & GREENERY (Database Driven, Max 3)
  // --------------------------------------------------------------------------
  renderStep2Fillers() {
    const state = appState.builderState;
    const selectedFillers = this.getSelectedFillers(state);
    const count = selectedFillers.length;

    // Retrieve active database fillers & foliage items ONLY (single source of truth)
    const allMaterials = FLOWER_DATA.allMaterials || [];
    const dbFillers = allMaterials.filter(m => (m.itemType === 'filler' || m.itemType === 'foliage' || m.category === 'Fillers & Foliage') && !m.archived);

    const fillerMetadata = {
      'fil-babys-breath': { desc: 'Small white flowers that create a soft, romantic appearance.', fallbackPrice: 80, fallbackColor: '#F8FAFC' },
      'fol-eucalyptus': { desc: 'Muted green foliage with a modern botanical appearance.', fallbackPrice: 60, fallbackColor: '#9CAF88' },
      'fol-ruscus': { desc: 'Deep green leaves that add structure and volume.', fallbackPrice: 55, fallbackColor: '#166534' },
      'fil-waxflower': { desc: 'Tiny decorative flowers that add delicate texture.', fallbackPrice: 65, fallbackColor: '#F472B6' },
      'fil-statice': { desc: 'Small clustered flowers commonly used as colorful fillers.', fallbackPrice: 60, fallbackColor: '#818CF8' },
      'fil-solidago': { desc: 'Golden-yellow filler flowers that add warmth.', fallbackPrice: 55, fallbackColor: '#FACC15' },
      'fil-queen-annes-lace': { desc: 'Delicate white, lace-like flower clusters.', fallbackPrice: 70, fallbackColor: '#F8FAFC' },
      'fol-leatherleaf-fern': { desc: 'Green foliage that adds fullness.', fallbackPrice: 45, fallbackColor: '#15803D' },
      'fol-italian-ruscus': { desc: 'Slender greenery with an elegant trailing appearance.', fallbackPrice: 60, fallbackColor: '#166534' },
      'fol-silver-dollar-eucalyptus': { desc: 'Rounded silvery-green leaves for a soft botanical look.', fallbackPrice: 75, fallbackColor: '#84CC16' }
    };

    const itemsToRender = dbFillers.map(m => {
      const meta = fillerMetadata[m.id] || {};
      return {
        id: m.id,
        name: m.name,
        desc: m.description || meta.desc || 'Premium botanical filler for custom bouquets.',
        price: m.price || meta.fallbackPrice || 50,
        color: m.color || meta.fallbackColor || '#9CAF88',
        image: m.image || '',
        availability: m.availability || 'available',
        stockCount: m.stockCount
      };
    });

    return `
      <div class="space-y-6">
        <!-- Step Header -->
        <div class="border-b border-[#E5ECE6] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-[#647D69] text-white text-xs font-bold flex items-center justify-center">2</span>
              <h2 class="font-serif text-2xl font-bold text-[#302C2A]">Choose Your Fillers &amp; Greenery</h2>
            </div>
            <p class="text-xs sm:text-sm text-[#6E6864] mt-1">Select up to 3 filler or foliage types to add volume, depth, and organic texture. (Optional)</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold px-3 py-1 rounded-full ${count === 3 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-[#EBF1EC]/60 text-[#647D69] border border-[#E5ECE6]'}">
              Fillers: ${count}/3 Selected
            </span>
          </div>
        </div>

        <!-- Filler Cards Grid (strictly populated from active database items) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          ${itemsToRender.length === 0 ? `
            <div class="col-span-full py-10 text-center text-xs text-[#6E6864] bg-stone-50 rounded-2xl border border-stone-200">
              No fillers or foliage are currently available in inventory.
            </div>
          ` : itemsToRender.map(def => {
            const dbItem = dbFillers.find(m => m.id === def.id) || getFillerById(def.id) || getGreeneryById(def.id) || {};
            const price = dbItem.price || def.fallbackPrice;
            const desc = dbItem.description || def.desc;
            const color = dbItem.color || def.fallbackColor;
            const image = dbItem.image || '';

            const selectedItem = selectedFillers.find(f => (typeof f === 'object' ? f.id : f) === def.id);
            const isSelected = Boolean(selectedItem);
            const qty = selectedItem && typeof selectedItem === 'object' ? (Number(selectedItem.quantity) || 1) : 1;
            const isUnavailable = def.availability === 'unavailable';
            const isOutOfStock = def.availability === 'sold_out' || (def.stockCount != null && def.stockCount <= 0);
            const isSoldOut = isUnavailable || isOutOfStock;
            const isLimitReached = count >= 3 && !isSelected;

            return `
              <div class="p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${isSelected ? 'border-[#647D69] bg-[#FFF9F5] shadow-xs' : 'border-[#E5ECE6] bg-white hover:border-[#647D69]/50'} ${isLimitReached || isSoldOut ? 'opacity-60 bg-stone-50 cursor-not-allowed' : ''}">
                <div class="flex items-start gap-3.5">
                  <!-- Visual Icon/Image -->
                  <div class="w-12 h-12 rounded-xl overflow-hidden border border-[#E5ECE6] shrink-0 bg-[#FFF9F5] flex items-center justify-center">
                    ${image ? `
                      <img src="${escapeHtml(image)}" alt="${escapeHtml(def.name)}" class="w-full h-full object-cover" />
                    ` : `
                      <div class="w-full h-full flex items-center justify-center" style="background-color: ${color}20">
                        <span class="w-4 h-4 rounded-full shadow-2xs" style="background-color: ${color}"></span>
                      </div>
                    `}
                  </div>

                  <!-- Details -->
                  <div class="min-w-0 flex-1">
                    <div class="flex items-start justify-between gap-1">
                      <h3 class="font-serif font-bold text-sm text-[#302C2A]">${escapeHtml(def.name)}</h3>
                      <span class="font-mono text-xs font-bold text-[#647D69] shrink-0">+${formatCurrency(price)}</span>
                    </div>
                    <p class="text-xs text-[#6E6864] mt-0.5 leading-relaxed">${escapeHtml(desc)}</p>
                    ${isSoldOut ? `
                      <div class="mt-1">
                        <span class="inline-flex items-center text-[9px] font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-1.5 py-0.2 rounded-md">${isUnavailable ? 'Unavailable' : 'Out of Stock'}</span>
                      </div>
                    ` : ''}
                  </div>
                </div>

                <!-- Action Bar -->
                <div class="mt-3 pt-2.5 border-t border-[#E5ECE6]/60 flex items-center justify-between">
                  <div>
                    ${isSelected ? `
                      <div class="flex items-center gap-1.5 bg-white border border-[#E5ECE6] rounded-xl px-2 py-0.5 shadow-2xs">
                        <span class="text-[11px] text-[#6E6864] mr-1">Qty:</span>
                        <button type="button" onclick="window.builderCtrl.updateFillerQty('${def.id}', -1)" aria-label="Decrease quantity" class="w-5 h-5 rounded text-[#302C2A] hover:bg-[#EBF1EC]/40 font-bold flex items-center justify-center text-xs">&minus;</button>
                        <span class="w-4 text-center font-bold text-xs font-mono text-[#302C2A]">${qty}</span>
                        <button type="button" onclick="window.builderCtrl.updateFillerQty('${def.id}', 1)" aria-label="Increase quantity" class="w-5 h-5 rounded text-[#302C2A] hover:bg-[#EBF1EC]/40 font-bold flex items-center justify-center text-xs">+</button>
                      </div>
                    ` : `
                      <span class="text-[11px] text-[#6E6864] italic">Optional filler</span>
                    `}
                  </div>

                  <button type="button" ${isLimitReached || isSoldOut ? 'disabled title="Unavailable"' : `onclick="window.builderCtrl.toggleFiller('${def.id}')"`} class="px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${isSelected ? 'bg-[#647D69] text-white shadow-2xs' : 'bg-white text-[#302C2A] border border-[#E5ECE6] hover:border-[#647D69]'} ${isLimitReached || isSoldOut ? 'cursor-not-allowed opacity-50' : ''}">
                    ${isSoldOut ? (isUnavailable ? 'Unavailable' : 'Sold Out') : (isSelected ? 'Selected <svg class="w-3.5 h-3.5 inline-block -mt-0.5 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : '+ Select')}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Step Navigation Bar -->
        <div class="pt-6 border-t border-[#E5ECE6] flex items-center justify-between">
          <button type="button" onclick="window.builderCtrl.prevStep()" class="text-xs text-[#6E6864] hover:text-[#302C2A] font-semibold">
            <span class="inline-flex items-center gap-1.5"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg><span>Previous: Flowers</span></span>
          </button>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // STEP 3: CHOOSE YOUR WRAPPING (Database Driven, 1 to 3, Color Selector)
  // --------------------------------------------------------------------------
  renderStep3Wrapping() {
    const state = appState.builderState;
    const selectedWrappings = this.getSelectedWrappings(state);
    const count = selectedWrappings.length;

    // Retrieve active database wrapping items ONLY (single source of truth)
    const allMaterials = FLOWER_DATA.allMaterials || [];
    const dbWrappings = allMaterials.filter(m => (m.itemType === 'wrapping' || m.category === 'Wrapping Materials') && !m.archived);

    const wrappingMetadata = {
      'wrp-korean-matte': { desc: 'Premium dual-sided waterproof matte floral wrap with silky petal finish.', price: 75, colors: [{ name: 'Blush Pink', hex: '#EBF1EC' }, { name: 'Pearl Cream', hex: '#FBF8F1' }, { name: 'Warm Sand', hex: '#E6DAC8' }, { name: 'Midnight Noir', hex: '#302C2A' }, { name: 'Sage Mist', hex: '#9CAF88' }] },
      'wrp-korean-waterproof': { desc: 'Durable moisture-resistant Korean wrapping sheets engineered for florist bouquets.', price: 75, colors: [{ name: 'Petal Pink', hex: '#F9B4D0' }, { name: 'Cloud White', hex: '#FFFFFF' }, { name: 'Sky Lilac', hex: '#E8DCF0' }, { name: 'Slate Charcoal', hex: '#3F3D40' }] },
      'wrp-kraft': { desc: 'Eco-friendly natural fibrous kraft wrapping for rustic artisanal presentations.', price: 50, colors: [{ name: 'Natural Brown', hex: '#C2A382' }, { name: 'Vintage Oatmeal', hex: '#D9C9B4' }, { name: 'Dark Coffee', hex: '#5C4033' }] },
      'wrp-premium-tissue': { desc: 'Delicate archival wrapping tissue paper for elegant inner layering and volume.', price: 45, colors: [{ name: 'Pure White', hex: '#FFFFFF' }, { name: 'Soft Rose', hex: '#FAD2E1' }, { name: 'Buttercream', hex: '#FFF5D6' }, { name: 'Pale Lavender', hex: '#E2D5E8' }] },
      'wrp-floral-mesh': { desc: 'Open-weave decorative floral mesh providing multidimensional texture and modern glamour.', price: 65, colors: [{ name: 'Golden Champagne', hex: '#E8D3A2' }, { name: 'Silver Frost', hex: '#E5E7EB' }, { name: 'Rose Gold', hex: '#E0A899' }, { name: 'Noir Mesh', hex: '#262626' }] },
      'wrp-frosted': { desc: 'Translucent semi-opaque frosted film diffusing floral colors with ethereal softness.', price: 85, colors: [{ name: 'Opal White', hex: '#F3F4F6' }, { name: 'Muted Rose', hex: '#F7D6E0' }, { name: 'Frosted Charcoal', hex: '#4B5563' }] },
      'wrp-clear-cellophane': { desc: 'High-clarity protective cellophane wrap for crisp floral presentation and weather protection.', price: 40, colors: [{ name: 'Crystal Clear', hex: '#E0F2FE' }, { name: 'Iridescent Glaze', hex: '#FCE7F3' }] },
      'wrp-pearlescent': { desc: 'Luminous shimmering floral paper with soft iridescent sheen catching the ambient light.', price: 90, colors: [{ name: 'Pearl Pink', hex: '#FAD4E0' }, { name: 'Luminous Ivory', hex: '#FFFFF0' }, { name: 'Champagne Shimmer', hex: '#F7E7CE' }] },
      'wrp-non-woven': { desc: 'Supple, soft-touch fabric-like non-woven floral wrapping that folds into sculptured pleats.', price: 60, colors: [{ name: 'Dusty Blush', hex: '#D8A4B8' }, { name: 'Forest Moss', hex: '#4A5844' }, { name: 'Warm Mocha', hex: '#7E6351' }] },
      'wrp-premium-textured': { desc: 'Embossed luxury art paper providing substantial weight, bespoke tactile feel, and elegance.', price: 85, colors: [{ name: 'Embossed Ivory', hex: '#FAF8F5' }, { name: 'Textured Blush', hex: '#F5D0DC' }, { name: 'Vintage Plum', hex: '#4A2835' }] }
    };

    const itemsToRender = dbWrappings.map(m => {
      const meta = wrappingMetadata[m.id] || {};
      let colors = meta.colors;
      if (!colors && m.style) {
        colors = this.parseColors(m.style);
      }
      if (!colors || !colors.length) {
        colors = [{ name: m.name, hex: m.color || '#C2A382' }];
      }
      return {
        id: m.id,
        name: m.name,
        desc: m.description || meta.desc || 'Premium boutique floral wrapping material.',
        price: m.price || meta.price || 50,
        colors: colors,
        image: m.image || '',
        availability: m.availability || 'available',
        stockCount: m.stockCount
      };
    });

    return `
      <div class="space-y-6">
        <!-- Step Header -->
        <div class="border-b border-[#E5ECE6] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-[#647D69] text-white text-xs font-bold flex items-center justify-center">3</span>
              <h2 class="font-serif text-2xl font-bold text-[#302C2A]">Choose Your Wrapping</h2>
            </div>
            <p class="text-xs sm:text-sm text-[#6E6864] mt-1">Select 1 to 3 wrapping types for layered bouquet presentation. Pick your preferred colors below.</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold px-3 py-1 rounded-full ${count === 3 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-[#EBF1EC]/60 text-[#647D69] border border-[#E5ECE6]'}">
              Wrapping: ${count}/3 Selected
            </span>
          </div>
        </div>

        <!-- Wrapping Cards Grid (strictly populated from active database items) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          ${itemsToRender.length === 0 ? `
            <div class="col-span-full py-10 text-center text-xs text-[#6E6864] bg-stone-50 rounded-2xl border border-stone-200">
              No wrapping materials are currently available in inventory.
            </div>
          ` : itemsToRender.map(def => {
            const dbItem = dbWrappings.find(m => m.id === def.id) || getWrappingById(def.id) || {};
            const price = dbItem.price || def.price;
            const desc = dbItem.description || def.desc;
            const availableColors = this.parseColors(dbItem.style).length > 0 ? this.parseColors(dbItem.style) : def.colors;

            const isSelected = selectedWrappings.includes(def.id);
            const isUnavailable = def.availability === 'unavailable';
            const isOutOfStock = def.availability === 'sold_out' || (def.stockCount != null && def.stockCount <= 0);
            const isSoldOut = isUnavailable || isOutOfStock;
            const isLimitReached = count >= 3 && !isSelected;
            const chosenColor = (state.wrappingColors && state.wrappingColors[def.id]) || (availableColors[0] ? availableColors[0].name : '');

            return `
              <div class="p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${isSelected ? 'border-[#647D69] bg-[#FFF9F5] shadow-xs' : 'border-[#E5ECE6] bg-white hover:border-[#647D69]/50'} ${isLimitReached || isSoldOut ? 'opacity-60 bg-stone-50 cursor-not-allowed' : ''}">
                <div>
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <h3 class="font-serif font-bold text-sm text-[#302C2A]">${escapeHtml(def.name)}</h3>
                      <p class="text-xs text-[#6E6864] mt-0.5 leading-relaxed">${escapeHtml(desc)}</p>
                    </div>
                    <span class="font-mono text-xs font-bold text-[#647D69] shrink-0">+${formatCurrency(price)}</span>
                  </div>
                  ${isSoldOut ? `
                    <div class="mt-1">
                      <span class="inline-flex items-center text-[9px] font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-1.5 py-0.2 rounded-md">${isUnavailable ? 'Unavailable' : 'Out of Stock'}</span>
                    </div>
                  ` : ''}

                  <!-- Color Selection Swatches (visible when selected) -->
                  ${isSelected ? `
                    <div class="mt-3 p-2.5 rounded-xl bg-white border border-[#E5ECE6] space-y-1.5 animate-fade-in">
                      <div class="flex items-center justify-between text-[11px]">
                        <span class="text-[#6E6864] font-medium">Selected Color:</span>
                        <span class="font-bold text-[#302C2A]">${escapeHtml(chosenColor || 'Default')}</span>
                      </div>
                      <div class="flex items-center gap-2 flex-wrap pt-0.5">
                        ${availableColors.map(c => `
                          <button type="button" onclick="window.builderCtrl.selectWrappingColor('${def.id}', '${escapeHtml(c.name)}')" title="${escapeHtml(c.name)}" class="w-6 h-6 rounded-full border-2 transition-transform ${chosenColor === c.name ? 'border-[#647D69] scale-110 shadow-xs' : 'border-white hover:scale-105'}" style="background-color: ${c.hex}"></button>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}
                </div>

                <!-- Action Button -->
                <div class="mt-3 pt-2.5 border-t border-[#E5ECE6]/60 flex items-center justify-between">
                  <span class="text-[11px] text-[#6E6864]">${isSelected ? 'Layer active' : `${availableColors.length} colors available`}</span>
                  <button type="button" ${isLimitReached || isSoldOut ? 'disabled title="Unavailable"' : `onclick="window.builderCtrl.toggleWrapping('${def.id}')"`} class="px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${isSelected ? 'bg-[#647D69] text-white shadow-2xs' : 'bg-white text-[#302C2A] border border-[#E5ECE6] hover:border-[#647D69]'} ${isLimitReached || isSoldOut ? 'cursor-not-allowed opacity-50' : ''}">
                    ${isSoldOut ? (isUnavailable ? 'Unavailable' : 'Sold Out') : (isSelected ? 'Selected <svg class="w-3.5 h-3.5 inline-block -mt-0.5 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : '+ Select')}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Step Navigation Bar -->
        <div class="pt-6 border-t border-[#E5ECE6] flex items-center justify-between">
          <button type="button" onclick="window.builderCtrl.prevStep()" class="text-xs text-[#6E6864] hover:text-[#302C2A] font-semibold">
            <span class="inline-flex items-center gap-1.5"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg><span>Previous: Fillers</span></span>
          </button>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // STEP 4: CHOOSE YOUR RIBBON (Database Driven, 0 to 2, Color Selector)
  // --------------------------------------------------------------------------
  renderStep4Ribbon() {
    const state = appState.builderState;
    const selectedRibbons = this.getSelectedRibbons(state);
    const count = selectedRibbons.length;

    // Retrieve active database ribbon items ONLY (single source of truth)
    const allMaterials = FLOWER_DATA.allMaterials || [];
    const dbRibbons = allMaterials.filter(m => (m.itemType === 'ribbon' || m.category === 'Ribbons') && !m.archived);

    const ribbonMetadata = {
      'rbn-satin': { desc: 'Double-face lustrous silky satin ribbon tied into flowing formal bows.', price: 45, colors: [{ name: 'Rose Pink', hex: '#647D69' }, { name: 'Champagne Gold', hex: '#D4AF37' }, { name: 'Pearl White', hex: '#FAFAFA' }, { name: 'Deep Plum', hex: '#4A154B' }, { name: 'Burgundy Wine', hex: '#800020' }] },
      'rbn-organza': { desc: 'Translucent, ethereal woven organza ribbon with subtle shimmer and featherweight drape.', price: 35, colors: [{ name: 'Sheer White', hex: '#FFFFFF' }, { name: 'Soft Peach', hex: '#FBD5C4' }, { name: 'Lavender Mist', hex: '#E6E6FA' }, { name: 'Golden Shimmer', hex: '#F3E5AB' }] },
      'rbn-grosgrain': { desc: 'Durable ribbed grosgrain band providing neat structured bow accents.', price: 50, colors: [{ name: 'Cream Beige', hex: '#E8DEC8' }, { name: 'Blush Rose', hex: '#E49AB0' }, { name: 'Dusty Navy', hex: '#34495E' }, { name: 'Forest Pine', hex: '#2D4B39' }] },
      'rbn-velvet': { desc: 'Plush velvet ribbon imparting rich tactile warmth to high-end bespoke bouquets.', price: 65, colors: [{ name: 'Royal Plum', hex: '#4A154B' }, { name: 'Deep Wine', hex: '#831843' }, { name: 'Vintage Moss', hex: '#556B2F' }, { name: 'Rose Quartz', hex: '#C08081' }] },
      'rbn-chiffon': { desc: 'Raw-edge frayed silk chiffon ribbon that drifts softly in natural breezes.', price: 55, colors: [{ name: 'Soft Rosewater', hex: '#FBCFE8' }, { name: 'Ivory Cream', hex: '#FDFBF7' }, { name: 'Sage Whisper', hex: '#CBD5C0' }, { name: 'Smoky Mauve', hex: '#B398A8' }] }
    };

    const itemsToRender = dbRibbons.map(m => {
      const meta = ribbonMetadata[m.id] || {};
      let colors = meta.colors;
      if (!colors && m.style) {
        colors = this.parseColors(m.style);
      }
      if (!colors || !colors.length) {
        colors = [{ name: m.name, hex: m.color || '#F472B6' }];
      }
      return {
        id: m.id,
        name: m.name,
        desc: m.description || meta.desc || 'Premium luxury ribbon accent for custom bouquets.',
        price: m.price || meta.price || 45,
        colors: colors,
        image: m.image || '',
        availability: m.availability || 'available',
        stockCount: m.stockCount
      };
    });

    return `
      <div class="space-y-6">
        <!-- Step Header -->
        <div class="border-b border-[#E5ECE6] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-[#647D69] text-white text-xs font-bold flex items-center justify-center">4</span>
              <h2 class="font-serif text-2xl font-bold text-[#302C2A]">Choose Your Ribbon</h2>
            </div>
            <p class="text-xs sm:text-sm text-[#6E6864] mt-1">Select up to 2 ribbon styles for layered decorative finishing. Pick your preferred colors below. (Optional)</p>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-semibold px-3 py-1 rounded-full ${count === 2 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-[#EBF1EC]/60 text-[#647D69] border border-[#E5ECE6]'}">
              Ribbons: ${count}/2 Selected
            </span>
          </div>
        </div>

        <!-- Ribbon Cards Grid (strictly populated from active database items) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          ${itemsToRender.length === 0 ? `
            <div class="col-span-full py-10 text-center text-xs text-[#6E6864] bg-stone-50 rounded-2xl border border-stone-200">
              No ribbons are currently available in inventory.
            </div>
          ` : itemsToRender.map(def => {
            const dbItem = dbRibbons.find(m => m.id === def.id) || {};
            const price = def.price;
            const desc = def.desc;
            const availableColors = def.colors || [];

            const isSelected = selectedRibbons.includes(def.id);
            const isUnavailable = def.availability === 'unavailable';
            const isOutOfStock = def.availability === 'sold_out' || (def.stockCount != null && def.stockCount <= 0);
            const isSoldOut = isUnavailable || isOutOfStock;
            const isLimitReached = count >= 2 && !isSelected;
            const chosenColor = (state.ribbonColors && state.ribbonColors[def.id]) || (availableColors[0] ? availableColors[0].name : '');

            return `
              <div class="p-4 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${isSelected ? 'border-[#647D69] bg-[#FFF9F5] shadow-xs' : 'border-[#E5ECE6] bg-white hover:border-[#647D69]/50'} ${isLimitReached || isSoldOut ? 'opacity-60 bg-stone-50 cursor-not-allowed' : ''}">
                <div>
                  <div class="flex items-start justify-between gap-2">
                    <div>
                      <h3 class="font-serif font-bold text-sm text-[#302C2A]">${escapeHtml(def.name)}</h3>
                      <p class="text-xs text-[#6E6864] mt-0.5 leading-relaxed">${escapeHtml(desc)}</p>
                    </div>
                    <span class="font-mono text-xs font-bold text-[#647D69] shrink-0">+${formatCurrency(price)}</span>
                  </div>
                  ${isSoldOut ? `
                    <div class="mt-1">
                      <span class="inline-flex items-center text-[9px] font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-1.5 py-0.2 rounded-md">${isUnavailable ? 'Unavailable' : 'Out of Stock'}</span>
                    </div>
                  ` : ''}

                  <!-- Color Selection Swatches (visible when selected) -->
                  ${isSelected ? `
                    <div class="mt-3 p-2.5 rounded-xl bg-white border border-[#E5ECE6] space-y-1.5 animate-fade-in">
                      <div class="flex items-center justify-between text-[11px]">
                        <span class="text-[#6E6864] font-medium">Selected Color:</span>
                        <span class="font-bold text-[#302C2A]">${escapeHtml(chosenColor || 'Default')}</span>
                      </div>
                      <div class="flex items-center gap-2 flex-wrap pt-0.5">
                        ${availableColors.map(c => `
                          <button type="button" onclick="window.builderCtrl.selectRibbonColor('${def.id}', '${escapeHtml(c.name)}')" title="${escapeHtml(c.name)}" class="w-6 h-6 rounded-full border-2 transition-transform ${chosenColor === c.name ? 'border-[#647D69] scale-110 shadow-xs' : 'border-white hover:scale-105'}" style="background-color: ${c.hex}"></button>
                        `).join('')}
                      </div>
                    </div>
                  ` : ''}
                </div>

                <!-- Action Button -->
                <div class="mt-3 pt-2.5 border-t border-[#E5ECE6]/60 flex items-center justify-between">
                  <span class="text-[11px] text-[#6E6864]">${isSelected ? 'Ribbon added' : `${availableColors.length} colors available`}</span>
                  <button type="button" ${isLimitReached || isSoldOut ? 'disabled title="Unavailable"' : `onclick="window.builderCtrl.toggleRibbon('${def.id}')"`} class="px-3.5 py-1.5 rounded-full text-xs font-semibold transition ${isSelected ? 'bg-[#647D69] text-white shadow-2xs' : 'bg-white text-[#302C2A] border border-[#E5ECE6] hover:border-[#647D69]'} ${isLimitReached || isSoldOut ? 'cursor-not-allowed opacity-50' : ''}">
                    ${isSoldOut ? (isUnavailable ? 'Unavailable' : 'Sold Out') : (isSelected ? 'Selected <svg class="w-3.5 h-3.5 inline-block -mt-0.5 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : '+ Select')}
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Step Navigation Bar -->
        <div class="pt-6 border-t border-[#E5ECE6] flex items-center justify-between">
          <button type="button" onclick="window.builderCtrl.prevStep()" class="text-xs text-[#6E6864] hover:text-[#302C2A] font-semibold">
            <span class="inline-flex items-center gap-1.5"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg><span>Previous: Wrapping</span></span>
          </button>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // STEP 5: ADD A GREETING CARD & REVIEW (5 Card Designs, Max 1)
  // --------------------------------------------------------------------------
  renderStep5Card() {
    const state = appState.builderState;
    const liveMsgInput = document.getElementById('builder-card-message');
    const cardMsg = (liveMsgInput ? liveMsgInput.value.slice(0, 250) : '') || state.cardMessage || state.message || '';
    if (liveMsgInput && liveMsgInput.value) {
      appState.setBuilderState({ cardMessage: cardMsg, message: cardMsg }, false);
    }
    const charCount = cardMsg.length;

    // Retrieve active database card items ONLY (single source of truth)
    const allMaterials = FLOWER_DATA.allMaterials || [];
    const dbCards = allMaterials.filter(m => (m.itemType === 'card' || m.category === 'Greeting Cards' || m.category === 'Message Cards') && !m.archived);

    const cardMetadata = {
      'crd-classic-floral': { desc: 'Artisan greeting card with classic botanical floral foil border and luxury envelope.', price: 35, color: '#F43F5E' },
      'crd-minimalist-ivory': { desc: 'Clean minimalist heavy ivory cardstock for subtle, refined, heartfelt handwritten notes.', price: 35, color: '#FEF3C7' },
      'crd-romantic-blush': { desc: 'Soft blush card with warm embossing designed for heartfelt anniversary and romance notes.', price: 35, color: '#FBCFE8' },
      'crd-elegant-botanical': { desc: 'Modern botanical card pressed with delicate greenery illustrations and premium texture.', price: 35, color: '#BBF7D0' },
      'crd-premium-plum': { desc: 'Deep velvet plum card with gold foil Umaira signature emblem and embossed keepsake sleeve.', price: 45, color: '#4C0519' }
    };

    const itemsToRender = dbCards.map(m => {
      const meta = cardMetadata[m.id] || {};
      return {
        id: m.id,
        name: m.name,
        desc: m.description || meta.desc || 'Bespoke artisanal sentiment greeting card.',
        price: m.price || meta.price || 35,
        color: m.color || meta.color || '#F43F5E',
        image: m.image || '',
        availability: m.availability || 'available',
        stockCount: m.stockCount
      };
    });

    const currentCard = itemsToRender.find(c => c.id === state.cardDesign);

    return `
      <div class="space-y-6">
        <!-- Step Header -->
        <div class="border-b border-[#E5ECE6] pb-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-full bg-[#647D69] text-white text-xs font-bold flex items-center justify-center">5</span>
              <h2 class="font-serif text-2xl font-bold text-[#302C2A]">Add a Personalized Greeting Card</h2>
            </div>
            <p class="text-xs sm:text-sm text-[#6E6864] mt-1">Select 1 bespoke greeting card and write a personalized message up to 250 characters. (Optional)</p>
          </div>
          <div>
            <span class="text-xs font-semibold px-3 py-1 rounded-full ${state.cardDesign ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-[#FFF9F5] text-[#6E6864] border border-[#E5ECE6]'}">
              ${state.cardDesign ? 'Card Selected' : 'No Card Selected'}
            </span>
          </div>
        </div>

        <!-- Card Designs Grid (strictly populated from active database items) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <!-- Option: No Card -->
          <div onclick="window.builderCtrl.selectCardDesign('')" class="p-3.5 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${!state.cardDesign ? 'border-[#647D69] bg-[#FFF9F5] ring-2 ring-[#647D69]/15' : 'border-[#E5ECE6] bg-white hover:border-[#647D69]/50'}">
            <div>
              <div class="flex items-center justify-between">
                <h3 class="font-serif font-bold text-sm text-[#302C2A]">No Greeting Card</h3>
                <span class="font-mono text-xs text-[#6E6864]">₱0</span>
              </div>
              <p class="text-xs text-[#6E6864] mt-1">Deliver bouquet without a personalized greeting card.</p>
            </div>
            <div class="mt-3 pt-2 border-t border-[#E5ECE6]/50 flex justify-end">
              <span class="text-xs font-bold ${!state.cardDesign ? 'text-[#647D69]' : 'text-[#6E6864]'}">${!state.cardDesign ? 'Selected <svg class="w-3.5 h-3.5 inline-block -mt-0.5 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : 'Select'}</span>
            </div>
          </div>

          ${itemsToRender.map(def => {
            const dbItem = dbCards.find(m => m.id === def.id) || getCardDesignById(def.id) || {};
            const price = dbItem.price || def.price;
            const desc = dbItem.description || def.desc;
            const isSelected = state.cardDesign === def.id;
            const isUnavailable = def.availability === 'unavailable';
            const isOutOfStock = def.availability === 'sold_out' || (def.stockCount != null && def.stockCount <= 0);
            const isSoldOut = isUnavailable || isOutOfStock;

            return `
              <div ${isSoldOut ? '' : `onclick="window.builderCtrl.selectCardDesign('${def.id}')"`} class="p-3.5 rounded-2xl border transition-all duration-200 flex flex-col justify-between ${isSelected ? 'border-[#647D69] bg-[#FFF9F5] ring-2 ring-[#647D69]/15 shadow-xs' : 'border-[#E5ECE6] bg-white hover:border-[#647D69]/50'} ${isSoldOut ? 'opacity-60 bg-stone-50 cursor-not-allowed' : 'cursor-pointer'}">
                <div>
                  <div class="flex items-center justify-between gap-1">
                    <h3 class="font-serif font-bold text-sm text-[#302C2A]">${escapeHtml(def.name)}</h3>
                    <span class="font-mono text-xs font-bold text-[#647D69]">+${formatCurrency(price)}</span>
                  </div>
                  <p class="text-xs text-[#6E6864] mt-1 leading-relaxed">${escapeHtml(desc)}</p>
                  ${isSoldOut ? `
                    <div class="mt-1">
                      <span class="inline-flex items-center text-[9px] font-semibold text-stone-600 bg-stone-100 border border-stone-200 px-1.5 py-0.2 rounded-md">${isUnavailable ? 'Unavailable' : 'Out of Stock'}</span>
                    </div>
                  ` : ''}
                </div>
                <div class="mt-3 pt-2 border-t border-[#E5ECE6]/50 flex items-center justify-between">
                  <span class="w-3.5 h-3.5 rounded-full border border-stone-200" style="background-color: ${def.color}"></span>
                  <span class="text-xs font-bold ${isSelected ? 'text-[#647D69]' : 'text-[#6E6864]'}">${isSoldOut ? (isUnavailable ? 'Unavailable' : 'Out of Stock') : (isSelected ? 'Selected <svg class="w-3.5 h-3.5 inline-block -mt-0.5 ml-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>' : 'Select')}</span>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <!-- Personalized Message Box (when card is selected) -->
        ${state.cardDesign ? `
          <div class="p-4 sm:p-5 rounded-2xl bg-white border border-[#E5ECE6] space-y-3 shadow-xs animate-fade-in">
            <div class="flex items-center justify-between">
              <label for="builder-card-message" class="font-serif font-bold text-sm text-[#302C2A] flex items-center gap-2">
                <span>Personalized Card Inscription</span>
                <span class="text-[11px] font-sans font-normal text-[#6E6864]">(${escapeHtml(currentCard ? currentCard.name : 'Greeting Card')})</span>
              </label>
              <span id="card-char-counter" class="text-xs font-mono font-bold text-[#647D69]">${charCount}/250</span>
            </div>

            <textarea id="builder-card-message" rows="3" maxlength="250" oninput="window.builderCtrl.handleCardMessageInput(this.value)" placeholder="Write your heartfelt message here... (e.g. Happy Anniversary my love, wishing you endless joy and blooming memories!)" class="w-full p-3 bg-[#FFF9F5] border border-[#E5ECE6] rounded-xl text-xs sm:text-sm text-[#302C2A] focus:outline-none focus:ring-2 focus:ring-[#647D69]/20 focus:border-[#647D69] leading-relaxed resize-none">${escapeHtml(cardMsg)}</textarea>

            <!-- Live Card Calligraphy Preview -->
            <div class="p-4 rounded-xl bg-gradient-to-br from-[#FFF9F5] to-[#EBF1EC]/30 border border-[#E5ECE6] text-center space-y-1">
              <span class="text-[10px] font-bold uppercase tracking-wider text-[#647D69]">Letterpress Card Preview</span>
              <p id="card-live-preview-text" class="font-serif italic text-sm sm:text-base text-[#302C2A] leading-relaxed max-w-md mx-auto">
                ${escapeHtml(cardMsg.trim() || 'Your personalized handwritten message will appear here...')}
              </p>
              <span class="text-[10px] text-[#6E6864] block pt-1">— Hand-inscribed by Umaira Calligraphy Atelier</span>
            </div>
          </div>
        ` : ''}

        <!-- Final Step Navigation -->
        <div class="pt-6 border-t border-[#E5ECE6] flex items-center justify-between gap-3">
          <button type="button" onclick="window.builderCtrl.prevStep()" class="text-xs text-[#6E6864] hover:text-[#302C2A] font-semibold">
            <span class="inline-flex items-center gap-1.5"><svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg><span>Previous: Ribbon</span></span>
          </button>
        </div>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // Persistent Bouquet Summary Panel (Right Side Sticky Panel)
  // --------------------------------------------------------------------------
  updateSelectedBouquetPanel() {
    const container = document.getElementById('builder-selected-flowers');
    const liveTotalEl = document.getElementById('builder-live-total');
    const stemCountEl = document.getElementById('builder-live-stem-count');
    const checkoutBtn = document.getElementById('builder-checkout-btn') || document.getElementById('builder-add-to-cart-btn');

    const state = appState.builderState;
    const breakdown = this.calculateBreakdown(state);
    const totalStems = this.getTotalMainStems(state);
    const wrappings = this.getSelectedWrappings(state);

    if (liveTotalEl) liveTotalEl.innerText = formatCurrency(totalStems === 0 ? 0 : breakdown.subtotal);
    if (stemCountEl) stemCountEl.innerText = `${totalStems} Stem${totalStems !== 1 ? 's' : ''}`;

    // Update CTA button based on progress
    if (checkoutBtn) {
      if (totalStems === 0) {
        checkoutBtn.disabled = true;
        checkoutBtn.className = 'w-full py-3.5 px-6 rounded-2xl bg-stone-200 text-stone-400 font-serif font-bold text-sm cursor-not-allowed transition flex items-center justify-center gap-2';
        checkoutBtn.innerHTML = '<span>Pick Flowers to Continue</span>';
      } else if (wrappings.length === 0) {
        checkoutBtn.disabled = false;
        checkoutBtn.className = 'w-full py-3.5 px-6 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white font-serif font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer';
        checkoutBtn.innerHTML = `<span>Select Wrapping (Step 3)</span><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
      } else if (this.currentStep < 5) {
        checkoutBtn.disabled = false;
        checkoutBtn.className = 'w-full py-3.5 px-6 rounded-2xl bg-[#647D69] hover:bg-[#526B57] text-white font-serif font-bold text-sm shadow-md transition flex items-center justify-center gap-2 cursor-pointer';
        checkoutBtn.innerHTML = `<span>Continue (Step ${this.currentStep + 1} of 5)</span><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;
      } else {
        checkoutBtn.disabled = false;
        checkoutBtn.className = 'w-full py-3.5 px-6 rounded-full bg-[#647D69] hover:bg-[#526B57] text-white font-bold text-sm shadow-lg shadow-[#647D69]/25 transition flex items-center justify-center gap-2 cursor-pointer';
        checkoutBtn.innerHTML = `
          <svg class="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
          <span>Add Custom Bouquet to Cart</span>
          <span class="font-mono text-xs opacity-90">(${formatCurrency(breakdown.subtotal)})</span>
        `;
      }
    }

    if (!container) return;

    if (totalStems === 0) {
      container.innerHTML = `
        <div class="py-10 px-4 text-center rounded-2xl bg-stone-50 border border-dashed border-stone-200 space-y-2">
          <p class="font-serif font-bold text-stone-800 text-sm">Your Bouquet is Empty</p>
          <p class="text-xs text-stone-500 leading-relaxed max-w-xs mx-auto">Choose at least 1 flower stem in Step 1 to begin crafting your bespoke arrangement.</p>
        </div>
      `;
      return;
    }

    // 1. Flowers Items List
    const flowersHtml = (state.mainFlowers || []).filter(f => f.quantity > 0).map(f => {
      const fl = getFlowerById(f.id);
      if (!fl) return '';
      const lineTotal = fl.price * f.quantity;
      return `
        <div class="p-2 rounded-xl bg-[#FFF9F5] border border-[#E5ECE6] flex items-center justify-between gap-2 text-xs">
          <div class="flex items-center gap-2 min-w-0">
            <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: ${fl.color || '#647D69'}"></span>
            <div class="min-w-0">
              <p class="font-bold text-[#302C2A] truncate text-xs">${escapeHtml(fl.name)}</p>
              <p class="text-[10px] text-[#6E6864] font-mono">${formatCurrency(fl.price)} × ${f.quantity}</p>
            </div>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="font-mono font-bold text-[#302C2A] text-xs">${formatCurrency(lineTotal)}</span>
            <button type="button" onclick="window.builderCtrl.updateMainFlowerQty('${fl.id}', -${f.quantity})" aria-label="Remove item" class="text-stone-400 hover:text-red-600 transition p-0.5">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // 2. Fillers List
    const fillers = this.getSelectedFillers(state);
    const fillersHtml = fillers.map(f => {
      const fid = typeof f === 'object' ? f.id : f;
      const fqty = typeof f === 'object' ? (Number(f.quantity) || 1) : 1;
      const fil = getFillerById(fid) || getGreeneryById(fid);
      if (!fil) return '';
      const lineTotal = fil.price * fqty;
      return `
        <div class="p-2 rounded-xl bg-[#FFF9F5] border border-[#E5ECE6] flex items-center justify-between gap-2 text-xs">
          <div class="min-w-0">
            <p class="font-bold text-[#302C2A] truncate text-xs">${escapeHtml(fil.name)} × ${fqty}</p>
            <span class="text-[10px] text-[#6E6864] font-mono">${formatCurrency(fil.price)} / bunch</span>
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="font-mono font-bold text-[#302C2A] text-xs">${formatCurrency(lineTotal)}</span>
            <button type="button" onclick="window.builderCtrl.toggleFiller('${fil.id}')" aria-label="Remove filler" class="text-stone-400 hover:text-red-600 transition p-0.5">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // 3. Wrappings List
    const wrappingsHtml = wrappings.map(wid => {
      const wrp = getWrappingById(wid);
      if (!wrp) return '';
      const color = (state.wrappingColors && state.wrappingColors[wid]) || '';
      return `
        <div class="p-2 rounded-xl bg-[#FFF9F5] border border-[#E5ECE6] flex items-center justify-between gap-2 text-xs">
          <div class="min-w-0">
            <p class="font-bold text-[#302C2A] truncate text-xs">${escapeHtml(wrp.name)}</p>
            ${color ? `<span class="text-[10px] text-[#647D69] font-medium block">Color: ${escapeHtml(color)}</span>` : ''}
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="font-mono font-bold text-[#302C2A] text-xs">${formatCurrency(wrp.price)}</span>
            <button type="button" onclick="window.builderCtrl.toggleWrapping('${wrp.id}')" aria-label="Remove wrapping" class="text-stone-400 hover:text-red-600 transition p-0.5">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // 4. Ribbons List
    const ribbons = this.getSelectedRibbons(state);
    const ribbonsHtml = ribbons.map(rid => {
      const rbn = getRibbonById(rid);
      if (!rbn) return '';
      const color = (state.ribbonColors && state.ribbonColors[rid]) || '';
      return `
        <div class="p-2 rounded-xl bg-[#FFF9F5] border border-[#E5ECE6] flex items-center justify-between gap-2 text-xs">
          <div class="min-w-0">
            <p class="font-bold text-[#302C2A] truncate text-xs">${escapeHtml(rbn.name)}</p>
            ${color ? `<span class="text-[10px] text-[#647D69] font-medium block">Color: ${escapeHtml(color)}</span>` : ''}
          </div>
          <div class="flex items-center gap-1.5 shrink-0">
            <span class="font-mono font-bold text-[#302C2A] text-xs">${formatCurrency(rbn.price)}</span>
            <button type="button" onclick="window.builderCtrl.toggleRibbon('${rbn.id}')" aria-label="Remove ribbon" class="text-stone-400 hover:text-red-600 transition p-0.5">
              <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // 5. Card
    let cardHtml = '';
    if (state.cardDesign && state.cardDesign !== 'crd-none') {
      const crd = getCardDesignById(state.cardDesign);
      if (crd) {
        cardHtml = `
          <div class="p-2 rounded-xl bg-[#FFF9F5] border border-[#E5ECE6] flex items-center justify-between gap-2 text-xs">
            <div class="min-w-0">
              <p class="font-bold text-[#302C2A] truncate text-xs">${escapeHtml(crd.name)}</p>
              ${(state.cardMessage || state.message) ? `<span class="text-[10px] text-[#6E6864] italic truncate block">"${escapeHtml((state.cardMessage || state.message).slice(0, 30))}..."</span>` : ''}
            </div>
            <div class="flex items-center gap-1.5 shrink-0">
              <span class="font-mono font-bold text-[#302C2A] text-xs">${formatCurrency(crd.price || 0)}</span>
              <button type="button" onclick="window.builderCtrl.selectCardDesign('')" aria-label="Remove card" class="text-stone-400 hover:text-red-600 transition p-0.5">
                <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          </div>
        `;
      }
    }

    container.innerHTML = `
      <div class="space-y-4">
        <!-- Flowers Section -->
        <div>
          <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#6E6864] mb-1.5">
            <span>Focal Blooms (${totalStems})</span>
          </div>
          <div class="space-y-1.5">${flowersHtml}</div>
        </div>

        <!-- Fillers Section -->
        ${fillersHtml ? `
          <div>
            <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#6E6864] mb-1.5">
              <span>Fillers &amp; Greenery (${fillers.length}/3)</span>
            </div>
            <div class="space-y-1.5">${fillersHtml}</div>
          </div>
        ` : ''}

        <!-- Wrapping Section -->
        ${wrappingsHtml ? `
          <div>
            <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#6E6864] mb-1.5">
              <span>Wrapping Materials (${wrappings.length}/3)</span>
            </div>
            <div class="space-y-1.5">${wrappingsHtml}</div>
          </div>
        ` : ''}

        <!-- Ribbons Section -->
        ${ribbonsHtml ? `
          <div>
            <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#6E6864] mb-1.5">
              <span>Ribbons (${ribbons.length}/2)</span>
            </div>
            <div class="space-y-1.5">${ribbonsHtml}</div>
          </div>
        ` : ''}

        <!-- Greeting Card Section -->
        ${cardHtml ? `
          <div>
            <div class="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#6E6864] mb-1.5">
              <span>Greeting Card</span>
            </div>
            <div class="space-y-1.5">${cardHtml}</div>
          </div>
        ` : ''}
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // Add Custom Bouquet to Cart & Checkout Workflow
  // --------------------------------------------------------------------------
  proceedToCheckout() {
    if (this.currentStep < 5) {
      this.nextStep();
      return;
    }
    this.addCustomBouquetToCart();
  }

  addCustomBouquetToCart() {
    const state = appState.builderState;
    const totalStems = this.getTotalMainStems(state);
    const minStems = Number(appState.customBuilderSettings?.minStems) || 1;
    const maxStems = Number(appState.customBuilderSettings?.maxStems) || 50;

    if (totalStems < minStems) {
      if (typeof showToast === 'function') {
        showToast(minStems === 1 ? 'Please select at least 1 flower stem to create a bouquet.' : `Please select at least ${minStems} flower stems to create a bouquet.`, 'error');
      }
      this.goToStep(1);
      return;
    }

    if (totalStems > maxStems) {
      if (typeof showToast === 'function') {
        showToast(`Custom bouquet cannot exceed ${maxStems} flower stems. Current: ${totalStems}.`, 'error');
      }
      this.goToStep(1);
      return;
    }

    const wrappings = this.getSelectedWrappings(state);
    if (wrappings.length < 1) {
      if (typeof showToast === 'function') showToast('Please choose at least 1 wrapping material.', 'error');
      this.goToStep(3);
      return;
    }

    const fillers = this.getSelectedFillers(state);
    const ribbons = this.getSelectedRibbons(state);

    for (const f of (state.mainFlowers || [])) {
      if (f.quantity > 0) {
        const fl = getFlowerById(f.id);
        if (!fl || fl.availability === 'unavailable' || fl.availability === 'sold_out' || (fl.stockCount != null && fl.stockCount <= 0)) {
          if (typeof showToast === 'function') showToast(`${fl ? fl.name : 'A selected flower'} is currently unavailable for purchase.`, 'error');
          this.goToStep(1);
          return;
        }
      }
    }
    for (const f of fillers) {
      const fid = typeof f === 'object' ? f.id : f;
      const fil = getFillerById(fid) || getGreeneryById(fid);
      if (fil && (fil.availability === 'unavailable' || fil.availability === 'sold_out' || (fil.stockCount != null && fil.stockCount <= 0))) {
        if (typeof showToast === 'function') showToast(`${fil.name} is currently unavailable for purchase.`, 'error');
        this.goToStep(2);
        return;
      }
    }
    for (const wid of wrappings) {
      const wrp = getWrappingById(wid);
      if (wrp && (wrp.availability === 'unavailable' || wrp.availability === 'sold_out' || (wrp.stockCount != null && wrp.stockCount <= 0))) {
        if (typeof showToast === 'function') showToast(`${wrp.name} is currently unavailable for purchase.`, 'error');
        this.goToStep(3);
        return;
      }
    }
    for (const rid of ribbons) {
      const rbn = getRibbonById(rid);
      if (rbn && (rbn.availability === 'unavailable' || rbn.availability === 'sold_out' || (rbn.stockCount != null && rbn.stockCount <= 0))) {
        if (typeof showToast === 'function') showToast(`${rbn.name} is currently unavailable for purchase.`, 'error');
        this.goToStep(4);
        return;
      }
    }
    if (state.cardDesign && state.cardDesign !== 'crd-none') {
      const crd = (FLOWER_DATA.cardDesigns || []).find(c => c.id === state.cardDesign) || (FLOWER_DATA.allMaterials || []).find(m => m.id === state.cardDesign);
      if (crd && (crd.availability === 'unavailable' || crd.availability === 'sold_out' || (crd.stockCount != null && crd.stockCount <= 0))) {
        if (typeof showToast === 'function') showToast(`${crd.name} is currently unavailable for purchase.`, 'error');
        this.goToStep(5);
        return;
      }
    }

    const breakdown = this.calculateBreakdown(state);
    const liveMsgInput = document.getElementById('builder-card-message');
    const cardMsg = (liveMsgInput ? liveMsgInput.value.slice(0, 250) : '') || state.cardMessage || state.message || '';
    if (liveMsgInput && liveMsgInput.value) {
      appState.setBuilderState({ cardMessage: cardMsg, message: cardMsg }, false);
    }

    const flSummary = (state.mainFlowers || []).filter(f => f.quantity > 0).map(f => {
      const fl = getFlowerById(f.id);
      return `${f.quantity}× ${fl ? fl.name : f.id}`;
    }).join(', ');
    const firstFl = (state.mainFlowers || []).find(f => f.quantity > 0);
    const flObj = firstFl ? getFlowerById(firstFl.id) : null;

    // Build structured cart item conforming to server/pricing specs
    const customCartItem = {
      id: 'custom-' + Date.now(),
      cartItemId: 'custom-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7),
      name: state.name || 'Artisan Bespoke Bouquet',
      summary: flSummary || 'Custom Floral Arrangement',
      customKey: '',
      price: breakdown.subtotal,
      quantity: 1,
      isCustom: true,
      image: (flObj && flObj.image) || '',
      message: cardMsg,
      isUnavailable: false,
      specs: {
        mainFlowers: (state.mainFlowers || []).filter(f => f.quantity > 0).map(f => {
          const fl = getFlowerById(f.id);
          return { id: f.id, name: fl ? fl.name : f.id, quantity: f.quantity, price: fl ? fl.price : 0, color: fl ? fl.color : '' };
        }),
        fillers: fillers.map(f => {
          const fid = typeof f === 'object' ? f.id : f;
          const fqty = typeof f === 'object' ? (Number(f.quantity) || 1) : 1;
          const fil = getFillerById(fid) || getGreeneryById(fid);
          return { id: fid, name: fil ? fil.name : fid, quantity: fqty, price: fil ? fil.price : 0 };
        }),
        filler: fillers[0] ? (typeof fillers[0] === 'object' ? fillers[0].id : fillers[0]) : '',
        greenery: fillers[1] ? (typeof fillers[1] === 'object' ? fillers[1].id : fillers[1]) : '',
        wrappings: wrappings.map(wid => {
          const wrp = getWrappingById(wid);
          const col = (state.wrappingColors && state.wrappingColors[wid]) || '';
          return { id: wid, name: wrp ? wrp.name : wid, color: col, price: wrp ? wrp.price : 0 };
        }),
        wrapping: wrappings[0] || 'wrp-korean-matte',
        ribbons: ribbons.map(rid => {
          const rbn = getRibbonById(rid);
          const col = (state.ribbonColors && state.ribbonColors[rid]) || '';
          return { id: rid, name: rbn ? rbn.name : rid, color: col, price: rbn ? rbn.price : 0 };
        }),
        ribbon: ribbons[0] || '',
        cardDesign: state.cardDesign || '',
        cardMessage: cardMsg
      }
    };
    customCartItem.customKey = JSON.stringify(customCartItem.specs);

    if (appState.isAuthenticated && !appState.isAuthenticated()) {
      appState.setPendingAction({ type: 'add_custom_bouquet', item: customCartItem });
      if (window.appRouter && typeof window.appRouter.promptGuestSignIn === 'function') {
        window.appRouter.promptGuestSignIn('Please sign in or create an account to save your bespoke bouquet to your cart.');
      } else if (typeof showToast === 'function') {
        showToast('Please sign in to save your bespoke bouquet.', 'info');
      }
      return;
    }

    // 2. Successfully save customized bouquet to customer's shopping cart
    appState.addToCart(customCartItem);

    // 3. Display success notification confirming bouquet was added
    if (typeof showToast === 'function') {
      showToast('Bespoke bouquet added to your cart!', 'success');
    }

    // 4. Automatically clear all selections from the bouquet builder
    // 5. Return customer to Step 1 — Choose Your Flowers
    // 6. Reset Live Summary, selected quantities, selection counters, and total price
    this.resetBuilder(true);

    // 7. Scroll smoothly to the beginning of the bouquet builder
    const builderContainer = document.getElementById('view-builder') || document.getElementById('builder-nav-tabs');
    if (builderContainer) {
      builderContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  }

  loadPresetIntoBuilder(specs, customName = '') {
    appState.loadPresetIntoBuilder(specs, customName);
    this.currentStep = 1;
    this.renderProgressIndicator();
    this.renderCurrentStep();
    this.updateSelectedBouquetPanel();
    if (window.appRouter) window.appRouter.navigate('builder');
  }
}

// Global Controller Singleton
window.builderCtrl = new BouquetBuilderController();
