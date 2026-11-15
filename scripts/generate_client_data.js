// Script to generate js/data.js synchronized with official Philippine Florist Catalog
const fs = require('fs');
const path = require('path');
const {
  READY_MADE_BOUQUETS,
  FRESH_FLOWERS,
  FILLERS_AND_FOLIAGE,
  WRAPPING_MATERIALS,
  RIBBONS,
  MESSAGE_CARDS
} = require('../server/philippines_catalog');

const mainFlowers = FRESH_FLOWERS.map(f => {
  let occs = ['birthday', 'anniversary'];
  if (f.id.includes('rose') || f.id === 'fl-tulip') occs = ['anniversary', 'valentines-day', 'birthday'];
  else if (f.id === 'fl-sunflower') occs = ['birthday', 'graduation', 'congratulations'];
  else if (f.id === 'fl-carnation') occs = ['mothers-day', 'birthday', 'thank-you'];
  else if (f.id === 'fl-stargazer-lily') occs = ['anniversary', 'sympathy', 'congratulations'];
  else if (f.id === 'fl-white-rose') occs = ['sympathy', 'anniversary', 'wedding'];

  return {
    id: f.id,
    occasions: occs,
    name: f.name,
    botanicalName: f.botanicalName || '',
    category: f.category,
    price: f.price,
    availability: 'available',
    stockCount: f.stockCount,
    image: '',
    color: f.color,
    description: f.description,
    stemLength: '45-50 cm',
    fragrance: 'Fresh & Floral',
    vaseLife: '7-10 Days',
    popular: true
  };
});

const fillerFlowers = FILLERS_AND_FOLIAGE.filter(item => item.itemType === 'filler').map(f => ({
  id: f.id,
  name: f.name,
  botanicalName: f.botanicalName || '',
  price: f.price,
  availability: 'available',
  stockCount: f.stockCount,
  image: '',
  description: f.description
}));

const greenery = FILLERS_AND_FOLIAGE.filter(item => item.itemType === 'foliage').map(g => ({
  id: g.id,
  name: g.name,
  botanicalName: g.botanicalName || '',
  price: g.price,
  availability: 'available',
  stockCount: g.stockCount,
  image: '',
  description: g.description
}));

const wrappingOptions = WRAPPING_MATERIALS.map(w => ({
  id: w.id,
  name: w.name,
  colorHex: w.color,
  price: w.price,
  availability: 'available',
  stockCount: w.stockCount,
  image: '',
  description: w.description
}));

const ribbonOptions = RIBBONS.map(r => ({
  id: r.id,
  name: r.name,
  colorHex: r.color,
  style: r.style || 'Ribbon',
  price: r.price,
  availability: 'available',
  stockCount: r.stockCount
}));

const cardDesigns = MESSAGE_CARDS.map(c => ({
  id: c.id,
  name: c.name,
  theme: c.style || 'Message Card',
  price: c.price,
  availability: 'available',
  stockCount: c.stockCount,
  description: c.description
}));

const featuredBouquets = READY_MADE_BOUQUETS.map(b => ({
  id: b.id,
  name: b.name,
  category: b.category,
  occasion: b.occasion,
  occasions: b.occasions || [b.occasion],
  price: b.price,
  stockCount: b.stockCount,
  availability: b.availability || 'available',
  description: b.description,
  formula: b.formula,
  image: b.image || '',
  specs: b.specs
}));

const occasions = [
  {
    id: 'anniversary',
    name: 'Anniversary',
    tagline: 'Romantic Roses & Dutch Tulips',
    icon: 'heart',
    image: '',
    description: 'Celebrate your shared milestones with lavish velvety roses and graceful pink tulips that speak eternal devotion.',
    recommendedBouquetIds: ['bq-classic-red-rose', 'bq-tulip-romance']
  },
  {
    id: 'birthday',
    name: 'Birthday',
    tagline: 'Bright & Colorful Sunshine Arrangements',
    icon: 'cake',
    image: '',
    description: 'Surprise them on their special day with joyful pops of sunflowers, pink roses, and gerbera daisies.',
    recommendedBouquetIds: ['bq-pink-rose', 'bq-sunflower-delight']
  },
  {
    id: 'valentines-day',
    name: "Valentine's Day",
    tagline: 'Romantic Red & Blush Pink Masterpieces',
    icon: 'flame',
    image: '',
    description: 'Express your purest passion with our master-crafted red roses and romantic tulip arrangements.',
    recommendedBouquetIds: ['bq-classic-red-rose', 'bq-tulip-romance']
  },
  {
    id: 'graduation',
    name: 'Graduation',
    tagline: 'Fresh & Cheerful Bouquets for New Beginnings',
    icon: 'graduation-cap',
    image: '',
    description: 'Honor their hard work and triumphant milestone with celebratory sunflowers and vibrant wraps.',
    recommendedBouquetIds: ['bq-graduation-celebration', 'bq-sunflower-delight']
  },
  {
    id: 'congratulations',
    name: 'Congratulations',
    tagline: 'Celebrate Milestones & Grand Achievements',
    icon: 'award',
    image: '',
    description: 'Congratulate friends, family, and colleagues on their momentous occasions and successes.',
    recommendedBouquetIds: ['bq-mixed-gerbera', 'bq-graduation-celebration']
  },
  {
    id: 'mothers-day',
    name: "Mother's Day",
    tagline: 'Heartfelt Carnations & Tender Blooms',
    icon: 'smile',
    image: '',
    description: 'Show your gratitude and unconditional love with sweet pink and white carnation arrangements.',
    recommendedBouquetIds: ['bq-carnation-sweetheart', 'bq-pink-rose']
  },
  {
    id: 'sympathy',
    name: 'Sympathy',
    tagline: 'Elegant & Respectful White Floral Tributes',
    icon: 'feather',
    image: '',
    description: 'Convey comfort, serenity, and heartfelt condolences with dignified white roses and lilies.',
    recommendedBouquetIds: ['bq-white-rose-elegance', 'bq-lily-grace']
  },
  {
    id: 'thank-you',
    name: 'Thank You',
    tagline: 'Appreciation & Gratitude in Every Petal',
    icon: 'sparkles',
    image: '',
    description: 'Express genuine appreciation with cheerful seasonal floral mixes.',
    recommendedBouquetIds: ['bq-mixed-flower-surprise', 'bq-carnation-sweetheart']
  }
];

const fileContent = `/**
 * FLEUR DE L'AMOUR / UMAIRA FLORIST - Botanical Data & Catalogs
 * Contains 40 recommended Philippine florist catalog items:
 * 10 Fresh Flowers, 5 Fillers & Foliage, 5 Wrapping Materials, 5 Ribbon Styles, 5 Message Cards, and 10 Ready-Made Bouquets.
 * All prices in Philippine Peso (₱).
 */

const FLOWER_DATA = {
  mainFlowers: ${JSON.stringify(mainFlowers, null, 2)},
  fillerFlowers: ${JSON.stringify(fillerFlowers, null, 2)},
  greenery: ${JSON.stringify(greenery, null, 2)},
  wrappingOptions: ${JSON.stringify(wrappingOptions, null, 2)},
  ribbonOptions: ${JSON.stringify(ribbonOptions, null, 2)},
  cardDesigns: ${JSON.stringify(cardDesigns, null, 2)},
  featuredBouquets: ${JSON.stringify(featuredBouquets, null, 2)},
  occasions: ${JSON.stringify(occasions, null, 2)}
};

// Helper lookup functions
function getFlowerById(id) {
  return FLOWER_DATA.mainFlowers.find(f => f.id === id);
}

function getFillerById(id) {
  return FLOWER_DATA.fillerFlowers.find(f => f.id === id);
}

function getGreeneryById(id) {
  return FLOWER_DATA.greenery.find(g => g.id === id);
}

function getWrappingById(id) {
  return FLOWER_DATA.wrappingOptions.find(w => w.id === id);
}

function getRibbonById(id) {
  return FLOWER_DATA.ribbonOptions.find(r => r.id === id);
}

function getCardDesignById(id) {
  return FLOWER_DATA.cardDesigns.find(c => c.id === id);
}

function formatCurrency(amount) {
  return '₱' + Number(amount || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

// Expose to global window
if (typeof window !== 'undefined') {
  window.FLOWER_DATA = FLOWER_DATA;
  window.getFlowerById = getFlowerById;
  window.getFillerById = getFillerById;
  window.getGreeneryById = getGreeneryById;
  window.getWrappingById = getWrappingById;
  window.getRibbonById = getRibbonById;
  window.getCardDesignById = getCardDesignById;
  window.formatCurrency = formatCurrency;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FLOWER_DATA,
    getFlowerById,
    getFillerById,
    getGreeneryById,
    getWrappingById,
    getRibbonById,
    getCardDesignById,
    formatCurrency
  };
}
`;

fs.writeFileSync(path.join(__dirname, '..', 'js', 'data.js'), fileContent, 'utf8');
console.log('js/data.js successfully generated!');
