// Official 40 Philippine Florist Catalog Items and Standard Categories
// Specification: 10 Ready-Made Bouquets, 10 Fresh Flowers, 5 Fillers & Foliage,
// 5 Wrapping Materials, 5 Ribbon Styles, 5 Message Cards.

const PHILIPPINE_CATEGORIES = [
  {
    id: 'cat-ready-made-bouquets',
    name: 'Ready-Made Bouquets',
    type: 'bouquet',
    description: 'Curated artisanal floral arrangements ready for immediate gifting and celebrations.'
  },
  {
    id: 'cat-fresh-flowers',
    name: 'Fresh Flowers',
    type: 'flower',
    description: 'Individual fresh-cut flower stems sourced from Benguet highlands and international growers.'
  },
  {
    id: 'cat-fillers-foliage',
    name: 'Fillers & Foliage',
    type: 'both',
    description: 'Delicate filler flowers and lush green foliage for volume, texture, and bespoke crafting.'
  },
  {
    id: 'cat-wrapping-materials',
    name: 'Wrapping Materials',
    type: 'both',
    description: 'Modern Korean matte wrapping, natural rustic kraft paper, and premium waterproof sheets.'
  },
  {
    id: 'cat-ribbons',
    name: 'Ribbons',
    type: 'both',
    description: 'Glossy satin, sheer organza, textured grosgrain, velvet, and rustic burlap ribbons.'
  },
  {
    id: 'cat-message-cards',
    name: 'Message Cards',
    type: 'both',
    description: 'Artisanal sentiment cards for birthdays, anniversaries, graduations, and custom messages.'
  }
];

const READY_MADE_BOUQUETS = [
  {
    id: 'bq-classic-red-rose',
    name: 'Classic Red Rose Bouquet',
    category: 'Ready-Made Bouquets',
    occasion: "Anniversary, Valentine's",
    occasions: ['Anniversary', "Valentine's Day"],
    price: 1499,
    stockCount: 10,
    availability: 'available',
    description: '12 red roses in elegant wrapping',
    formula: '12× Red Rose, 1× Baby\'s Breath, 1× Kraft Paper, 1× Satin Ribbon',
    image: '',
    specs: {
      mainFlowers: [{ id: 'fl-red-rose', name: 'Red Rose', quantity: 12 }],
      filler: 'fil-babys-breath',
      wrapping: 'wrp-kraft',
      ribbon: 'rbn-satin',
      message: 'Happy Anniversary / With Love'
    }
  },
  {
    id: 'bq-pink-rose',
    name: 'Pink Rose Bouquet',
    category: 'Ready-Made Bouquets',
    occasion: 'Birthday, Anniversary',
    occasions: ['Birthday', 'Anniversary'],
    price: 1299,
    stockCount: 10,
    availability: 'available',
    description: 'Soft pink roses for thoughtful gifting',
    formula: '10× Pink Rose, 1× Eucalyptus, 1× Korean-Style Wrapping, 1× Satin Ribbon',
    image: '',
    specs: {
      mainFlowers: [{ id: 'fl-pink-rose', name: 'Pink Rose', quantity: 10 }],
      greenery: 'grn-eucalyptus',
      wrapping: 'wrp-korean',
      ribbon: 'rbn-satin'
    }
  },
  {
    id: 'bq-sunflower-delight',
    name: 'Sunflower Delight',
    category: 'Ready-Made Bouquets',
    occasion: 'Birthday, Graduation',
    occasions: ['Birthday', 'Graduation'],
    price: 1199,
    stockCount: 8,
    availability: 'available',
    description: 'Cheerful sunflower arrangement',
    formula: '3× Sunflower, 2× Caspia Filler, 1× Kraft Paper, 1× Burlap Ribbon',
    image: '',
    specs: {
      mainFlowers: [{ id: 'fl-sunflower', name: 'Sunflower', quantity: 3 }],
      filler: 'fil-caspia',
      wrapping: 'wrp-kraft',
      ribbon: 'rbn-burlap'
    }
  },
  {
    id: 'bq-white-rose-elegance',
    name: 'White Rose Elegance',
    category: 'Ready-Made Bouquets',
    occasion: 'Sympathy, Anniversary',
    occasions: ['Sympathy', 'Anniversary'],
    price: 1399,
    stockCount: 8,
    availability: 'available',
    description: 'Elegant white rose arrangement',
    formula: '10× White Rose, 1× Ruscus Leaves, 1× Translucent Wrapping, 1× Organza Ribbon',
    image: '',
    specs: {
      mainFlowers: [{ id: 'fl-white-rose', name: 'White Rose', quantity: 10 }],
      greenery: 'grn-ruscus',
      wrapping: 'wrp-translucent',
      ribbon: 'rbn-organza'
    }
  },
  {
    id: 'bq-mixed-gerbera',
    name: 'Mixed Gerbera Bouquet',
    category: 'Ready-Made Bouquets',
    occasion: 'Birthday, Congratulations',
    occasions: ['Birthday', 'Congratulations'],
    price: 999,
    stockCount: 10,
    availability: 'available',
    description: 'Colorful gerberas in vibrant wrapping',
    formula: '6× Gerbera Daisy, 1× Leatherleaf Fern, 1× Korean-Style Wrapping, 1× Grosgrain Ribbon',
    image: '',
    specs: {
      mainFlowers: [{ id: 'fl-gerbera-daisy', name: 'Gerbera Daisy', quantity: 6 }],
      greenery: 'grn-fern',
      wrapping: 'wrp-korean',
      ribbon: 'rbn-grosgrain'
    }
  },
  {
    id: 'bq-carnation-sweetheart',
    name: 'Carnation Sweetheart',
    category: 'Ready-Made Bouquets',
    occasion: "Mother's Day, Birthday",
    occasions: ["Mother's Day", 'Birthday'],
    price: 899,
    stockCount: 12,
    availability: 'available',
    description: 'Pink and white carnations in pastel wrapping',
    formula: '8× Carnation, 1× Baby\'s Breath, 1× Korean-Style Wrapping, 1× Satin Ribbon',
    image: '',
    specs: {
      mainFlowers: [{ id: 'fl-carnation', name: 'Carnation', quantity: 8 }],
      filler: 'fil-babys-breath',
      wrapping: 'wrp-korean',
      ribbon: 'rbn-satin'
    }
  },
  {
    id: 'bq-tulip-romance',
    name: 'Tulip Romance',
    category: 'Ready-Made Bouquets',
    occasion: "Anniversary, Valentine's",
    occasions: ['Anniversary', "Valentine's Day"],
    price: 1899,
    stockCount: 5,
    availability: 'available',
    description: 'Premium romantic tulip arrangement',
    formula: '8× Tulip, 1× Eucalyptus, 1× Premium Pearl Wrapping, 1× Velvet Ribbon',
    image: '',
    specs: {
      mainFlowers: [{ id: 'fl-tulip', name: 'Tulip', quantity: 8 }],
      greenery: 'grn-eucalyptus',
      wrapping: 'wrp-pearl',
      ribbon: 'rbn-velvet'
    }
  },
  {
    id: 'bq-lily-grace',
    name: 'Lily Grace Bouquet',
    category: 'Ready-Made Bouquets',
    occasion: 'Anniversary, Sympathy',
    occasions: ['Anniversary', 'Sympathy'],
    price: 1799,
    stockCount: 6,
    availability: 'available',
    description: 'Fragrant lilies with decorative greenery',
    formula: '5× Stargazer Lily, 1× Ruscus Leaves, 1× Translucent Wrapping, 1× Satin Ribbon',
    image: '',
    specs: {
      mainFlowers: [{ id: 'fl-stargazer-lily', name: 'Stargazer Lily', quantity: 5 }],
      greenery: 'grn-ruscus',
      wrapping: 'wrp-translucent',
      ribbon: 'rbn-satin'
    }
  },
  {
    id: 'bq-mixed-flower-surprise',
    name: 'Mixed Flower Surprise',
    category: 'Ready-Made Bouquets',
    occasion: 'Birthday, Thank You',
    occasions: ['Birthday', 'Thank You'],
    price: 1299,
    stockCount: 10,
    availability: 'available',
    description: 'Seasonal roses, gerberas, and carnations',
    formula: '3× Red Rose, 3× Gerbera Daisy, 3× Carnation, 1× Baby\'s Breath, 1× Kraft Paper, 1× Grosgrain Ribbon',
    image: '',
    specs: {
      mainFlowers: [
        { id: 'fl-red-rose', name: 'Red Rose', quantity: 3 },
        { id: 'fl-gerbera-daisy', name: 'Gerbera Daisy', quantity: 3 },
        { id: 'fl-carnation', name: 'Carnation', quantity: 3 }
      ],
      filler: 'fil-babys-breath',
      wrapping: 'wrp-kraft',
      ribbon: 'rbn-grosgrain'
    }
  },
  {
    id: 'bq-graduation-celebration',
    name: 'Graduation Celebration',
    category: 'Ready-Made Bouquets',
    occasion: 'Graduation, Congratulations',
    occasions: ['Graduation', 'Congratulations'],
    price: 1499,
    stockCount: 8,
    availability: 'available',
    description: 'Sunflowers and roses for graduation gifts',
    formula: '3× Sunflower, 4× Red Rose, 1× Eucalyptus, 1× Waterproof Wrapping, 1× Grosgrain Ribbon',
    image: '',
    specs: {
      mainFlowers: [
        { id: 'fl-sunflower', name: 'Sunflower', quantity: 3 },
        { id: 'fl-red-rose', name: 'Red Rose', quantity: 4 }
      ],
      greenery: 'grn-eucalyptus',
      wrapping: 'wrp-waterproof',
      ribbon: 'rbn-grosgrain'
    }
  }
];

const FRESH_FLOWERS = [
  {
    id: 'fl-red-rose',
    name: 'Red Rose',
    category: 'Fresh Flowers',
    itemType: 'flower',
    botanicalName: 'Rosa grandiflora',
    price: 120,
    stockCount: 100,
    unitOfMeasure: 'stems',
    color: '#dc2626',
    unitCost: 55,
    style: 'Long Stem Premium',
    description: 'Classic red rose stem'
  },
  {
    id: 'fl-pink-rose',
    name: 'Pink Rose',
    category: 'Fresh Flowers',
    itemType: 'flower',
    botanicalName: 'Rosa x hybrida',
    price: 110,
    stockCount: 80,
    unitOfMeasure: 'stems',
    color: '#ec4899',
    unitCost: 50,
    style: 'Pastel Long Stem',
    description: 'Gentle pink rose stem'
  },
  {
    id: 'fl-white-rose',
    name: 'White Rose',
    category: 'Fresh Flowers',
    itemType: 'flower',
    botanicalName: 'Rosa alba',
    price: 110,
    stockCount: 80,
    unitOfMeasure: 'stems',
    color: '#f8fafc',
    unitCost: 50,
    style: 'Pure White Stem',
    description: 'Pure white rose stem'
  },
  {
    id: 'fl-sunflower',
    name: 'Sunflower',
    category: 'Fresh Flowers',
    itemType: 'flower',
    botanicalName: 'Helianthus annuus',
    price: 180,
    stockCount: 60,
    unitOfMeasure: 'stems',
    color: '#facc15',
    unitCost: 80,
    style: 'Vibrant Golden Bloom',
    description: 'Bright standard sunflower stem'
  },
  {
    id: 'fl-gerbera-daisy',
    name: 'Gerbera Daisy',
    category: 'Fresh Flowers',
    itemType: 'flower',
    botanicalName: 'Gerbera jamesonii',
    price: 90,
    stockCount: 80,
    unitOfMeasure: 'stems',
    color: '#f97316',
    unitCost: 40,
    style: 'Assorted Vibrant Bloom',
    description: 'Vibrant mixed gerbera daisy stem'
  },
  {
    id: 'fl-carnation',
    name: 'Carnation',
    category: 'Fresh Flowers',
    itemType: 'flower',
    botanicalName: 'Dianthus caryophyllus',
    price: 75,
    stockCount: 100,
    unitOfMeasure: 'stems',
    color: '#f43f5e',
    unitCost: 35,
    style: 'Ruffled Petal Stem',
    description: 'Long-lasting carnation stem'
  },
  {
    id: 'fl-tulip',
    name: 'Tulip',
    category: 'Fresh Flowers',
    itemType: 'flower',
    botanicalName: 'Tulipa gesneriana',
    price: 220,
    stockCount: 40,
    unitOfMeasure: 'stems',
    color: '#fb7185',
    unitCost: 100,
    style: 'Imported Premium Dutch',
    description: 'Imported premium tulip stem'
  },
  {
    id: 'fl-stargazer-lily',
    name: 'Stargazer Lily',
    category: 'Fresh Flowers',
    itemType: 'flower',
    botanicalName: 'Lilium orientalis',
    price: 250,
    stockCount: 35,
    unitOfMeasure: 'stems',
    color: '#d946ef',
    unitCost: 115,
    style: 'Aromatic Oriental Stem',
    description: 'Fragrant stargazer lily stem'
  },
  {
    id: 'fl-chrysanthemum',
    name: 'Chrysanthemum',
    category: 'Fresh Flowers',
    itemType: 'flower',
    botanicalName: 'Chrysanthemum morifolium',
    price: 70,
    stockCount: 100,
    unitOfMeasure: 'stems',
    color: '#eab308',
    unitCost: 30,
    style: 'Full Decorative Bloom',
    description: 'Fresh locally sourced chrysanthemum'
  },
  {
    id: 'fl-malaysian-mums',
    name: 'Malaysian Mums',
    category: 'Fresh Flowers',
    itemType: 'flower',
    botanicalName: 'Chrysanthemum indicum',
    price: 65,
    stockCount: 100,
    unitOfMeasure: 'stems',
    color: '#a855f7',
    unitCost: 28,
    style: 'Colorful Spray Mum',
    description: 'Colorful spray mum stem'
  }
];

const FILLERS_AND_FOLIAGE = [
  {
    id: 'fil-babys-breath',
    name: "Baby's Breath",
    category: 'Fillers & Foliage',
    itemType: 'filler',
    botanicalName: 'Gypsophila paniculata',
    price: 80,
    stockCount: 60,
    unitOfMeasure: 'stems',
    color: '#ffffff',
    unitCost: 35,
    style: 'Delicate Sprigs',
    description: 'Delicate white filler flowers'
  },
  {
    id: 'grn-eucalyptus',
    name: 'Eucalyptus',
    category: 'Fillers & Foliage',
    itemType: 'foliage',
    botanicalName: 'Eucalyptus cinerea',
    price: 65,
    stockCount: 50,
    unitOfMeasure: 'stems',
    color: '#10b981',
    unitCost: 28,
    style: 'Muted Green Foliage',
    description: 'Soft green decorative foliage'
  },
  {
    id: 'grn-ruscus',
    name: 'Ruscus Leaves',
    category: 'Fillers & Foliage',
    itemType: 'foliage',
    botanicalName: 'Ruscus aculeatus',
    price: 50,
    stockCount: 70,
    unitOfMeasure: 'stems',
    color: '#059669',
    unitCost: 22,
    style: 'Structured Stems',
    description: 'Structured greenery for bouquets'
  },
  {
    id: 'grn-fern',
    name: 'Leatherleaf Fern',
    category: 'Fillers & Foliage',
    itemType: 'foliage',
    botanicalName: 'Rumohra adiantiformis',
    price: 40,
    stockCount: 80,
    unitOfMeasure: 'stems',
    color: '#047857',
    unitCost: 18,
    style: 'Textural Fronds',
    description: 'Classic foliage for added volume'
  },
  {
    id: 'fil-caspia',
    name: 'Caspia Filler',
    category: 'Fillers & Foliage',
    itemType: 'filler',
    botanicalName: 'Limonium bellidifolium',
    price: 60,
    stockCount: 60,
    unitOfMeasure: 'stems',
    color: '#8b5cf6',
    unitCost: 25,
    style: 'Colorful Accent Sprigs',
    description: 'Delicate purple filler'
  }
];

const WRAPPING_MATERIALS = [
  {
    id: 'wrp-korean',
    name: 'Korean-Style Wrapping',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    botanicalName: '',
    price: 80,
    stockCount: 100,
    unitOfMeasure: 'sheets',
    color: '#fdf2f8',
    unitCost: 35,
    style: 'Modern Matte Finish',
    description: 'Modern matte wrapping paper'
  },
  {
    id: 'wrp-kraft',
    name: 'Kraft Paper',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    botanicalName: '',
    price: 40,
    stockCount: 100,
    unitOfMeasure: 'sheets',
    color: '#d97706',
    unitCost: 18,
    style: 'Natural Rustic Kraft',
    description: 'Rustic and natural paper wrap'
  },
  {
    id: 'wrp-waterproof',
    name: 'Waterproof Wrapping',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    botanicalName: '',
    price: 65,
    stockCount: 100,
    unitOfMeasure: 'sheets',
    color: '#e0f2fe',
    unitCost: 28,
    style: 'Water-Resistant Film',
    description: 'Durable moisture-resistant wrap'
  },
  {
    id: 'wrp-translucent',
    name: 'Translucent Wrapping',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    botanicalName: '',
    price: 70,
    stockCount: 80,
    unitOfMeasure: 'sheets',
    color: '#f1f5f9',
    unitCost: 30,
    style: 'Semi-Transparent Layered Veil',
    description: 'Semi-transparent frosted wrap'
  },
  {
    id: 'wrp-pearl',
    name: 'Premium Pearl Wrapping',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    botanicalName: '',
    price: 90,
    stockCount: 60,
    unitOfMeasure: 'sheets',
    color: '#fef3c7',
    unitCost: 40,
    style: 'Luxurious Pearl Finish',
    description: 'Elegant pearlescent floral wrap'
  }
];

const RIBBONS = [
  {
    id: 'rbn-satin',
    name: 'Satin Ribbon',
    category: 'Ribbons',
    itemType: 'ribbon',
    botanicalName: '',
    price: 25,
    stockCount: 120,
    unitOfMeasure: 'rolls',
    color: '#ec4899',
    unitCost: 10,
    style: 'Smooth & Glossy Satin',
    description: 'Smooth and glossy ribbon'
  },
  {
    id: 'rbn-organza',
    name: 'Organza Ribbon',
    category: 'Ribbons',
    itemType: 'ribbon',
    botanicalName: '',
    price: 30,
    stockCount: 100,
    unitOfMeasure: 'rolls',
    color: '#f472b6',
    unitCost: 12,
    style: 'Lightweight Sheer Organza',
    description: 'Sheer and delicate ribbon'
  },
  {
    id: 'rbn-grosgrain',
    name: 'Grosgrain Ribbon',
    category: 'Ribbons',
    itemType: 'ribbon',
    botanicalName: '',
    price: 30,
    stockCount: 100,
    unitOfMeasure: 'rolls',
    color: '#6366f1',
    unitCost: 12,
    style: 'Textured Woven Grosgrain',
    description: 'Textured ribbed ribbon'
  },
  {
    id: 'rbn-velvet',
    name: 'Velvet Ribbon',
    category: 'Ribbons',
    itemType: 'ribbon',
    botanicalName: '',
    price: 45,
    stockCount: 60,
    unitOfMeasure: 'rolls',
    color: '#991b1b',
    unitCost: 20,
    style: 'Soft Premium Velvet',
    description: 'Luxurious soft ribbon'
  },
  {
    id: 'rbn-burlap',
    name: 'Burlap Ribbon',
    category: 'Ribbons',
    itemType: 'ribbon',
    botanicalName: '',
    price: 25,
    stockCount: 80,
    unitOfMeasure: 'rolls',
    color: '#b45309',
    unitCost: 10,
    style: 'Rustic Natural Jute',
    description: 'Rustic natural fiber ribbon'
  }
];

const MESSAGE_CARDS = [
  {
    id: 'crd-birthday',
    name: 'Happy Birthday Card',
    category: 'Message Cards',
    itemType: 'card',
    botanicalName: '',
    price: 35,
    stockCount: 100,
    unitOfMeasure: 'cards',
    color: '#ec4899',
    unitCost: 12,
    style: 'Floral Birthday Greeting',
    description: 'Colorful birthday card'
  },
  {
    id: 'crd-anniversary',
    name: 'Anniversary Card',
    category: 'Message Cards',
    itemType: 'card',
    botanicalName: '',
    price: 35,
    stockCount: 80,
    unitOfMeasure: 'cards',
    color: '#dc2626',
    unitCost: 12,
    style: 'Romantic Heartfelt Milestone',
    description: 'Romantic card for couples'
  },
  {
    id: 'crd-congratulations',
    name: 'Congratulations Card',
    category: 'Message Cards',
    itemType: 'card',
    botanicalName: '',
    price: 35,
    stockCount: 100,
    unitOfMeasure: 'cards',
    color: '#eab308',
    unitCost: 12,
    style: 'Gold Foil Congratulations',
    description: 'Celebratory message card'
  },
  {
    id: 'crd-thank-you',
    name: 'Thank You Card',
    category: 'Message Cards',
    itemType: 'card',
    botanicalName: '',
    price: 30,
    stockCount: 100,
    unitOfMeasure: 'cards',
    color: '#10b981',
    unitCost: 10,
    style: 'Botanical Appreciation',
    description: 'Appreciation message card'
  },
  {
    id: 'crd-personalized',
    name: 'Personalized Message Card',
    category: 'Message Cards',
    itemType: 'card',
    botanicalName: '',
    price: 30,
    stockCount: 120,
    unitOfMeasure: 'cards',
    color: '#64748b',
    unitCost: 10,
    style: 'Blank Custom Inscription',
    description: 'Custom text printed on card'
  }
];

const ALL_FLOWERS_AND_MATERIALS = [
  ...FRESH_FLOWERS,
  ...FILLERS_AND_FOLIAGE,
  ...WRAPPING_MATERIALS,
  ...RIBBONS,
  ...MESSAGE_CARDS
];

module.exports = {
  PHILIPPINE_CATEGORIES,
  READY_MADE_BOUQUETS,
  FRESH_FLOWERS,
  FILLERS_AND_FOLIAGE,
  WRAPPING_MATERIALS,
  RIBBONS,
  MESSAGE_CARDS,
  ALL_FLOWERS_AND_MATERIALS
};
