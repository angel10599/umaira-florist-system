// Phase 2: Complete Bouquet Catalog & Inventory Data
// 32 Unique Ready-Made Bouquets (2 assigned to each of 16 flower/foliage types)
// All 16 Flower & Foliage Types, and Complete Bouquet Materials

const PHASE2_CATEGORIES = [
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
    name: 'Greeting Cards',
    type: 'both',
    description: 'Artisanal sentiment cards for birthdays, anniversaries, graduations, and custom messages.'
  }
];

// All 16 Flower and Foliage Types (plus necessary color variants)
// Eucalyptus and Ruscus are foliage items, not blooming flowers.
const PHASE2_FLOWERS = [
  // 1. Roses
  {
    id: 'fl-pink-rose',
    name: 'Pink Rose',
    botanicalName: 'Rosa grandiflora (Pink)',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 110,
    unitCost: 50,
    unitOfMeasure: 'stems',
    color: '#FCD6E9',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 10,
    description: 'Graceful long-stem pastel pink rose with velvety petals and gentle floral fragrance.',
    image: '',
    style: "Occasion: Valentine's Day, Anniversary",
    supplierId: null,
    },
  {
    id: 'fl-red-rose',
    name: 'Red Rose',
    botanicalName: 'Rosa grandiflora (Red)',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 120,
    unitCost: 55,
    unitOfMeasure: 'stems',
    color: '#DC2626',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 10,
    description: 'Classic velvety crimson rose stem expressing timeless passion and devotion.',
    image: '',
    style: "Occasion: Valentine's Day, Anniversary",
    supplierId: null,
    },
  {
    id: 'fl-white-rose',
    name: 'White Rose',
    botanicalName: 'Rosa grandiflora (White)',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 115,
    unitCost: 50,
    unitOfMeasure: 'stems',
    color: '#FFFFFF',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 10,
    description: 'Pristine porcelain white rose stem conveying reverence, purity, and sophistication.',
    image: '',
    style: 'Occasion: Sympathy',
    supplierId: null,
    },

  // 2. Tulips
  {
    id: 'fl-pink-tulip',
    name: 'Pink Tulip',
    botanicalName: 'Tulipa gesneriana (Pink)',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 160,
    unitCost: 75,
    unitOfMeasure: 'stems',
    color: '#F472B6',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 8,
    description: 'Fresh elegant pink tulip stem with clean lines and smooth satin finish.',
    image: '',
    style: "Occasion: Valentine's Day, Anniversary",
    supplierId: null,
    },
  {
    id: 'fl-white-tulip',
    name: 'White Tulip',
    botanicalName: 'Tulipa gesneriana (White)',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 160,
    unitCost: 75,
    unitOfMeasure: 'stems',
    color: '#F8FAFC',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 8,
    description: 'Crisp white tulip bloom symbolizing forgiveness, elegance, and new beginnings.',
    image: '',
    style: 'Occasion: Anniversary',
    supplierId: null,
    },

  // 3. Carnations
  {
    id: 'fl-pink-carnation',
    name: 'Pink Carnation',
    botanicalName: 'Dianthus caryophyllus (Pink)',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 75,
    unitCost: 35,
    unitOfMeasure: 'stems',
    color: '#F9A8D4',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 10,
    description: 'Ruffled blush pink carnation bloom with sweet clove-like fragrance and resilient vase life.',
    image: '',
    style: 'Occasion: ',
    supplierId: null,
    },
  {
    id: 'fl-white-carnation',
    name: 'White Carnation',
    botanicalName: 'Dianthus caryophyllus (White)',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 75,
    unitCost: 35,
    unitOfMeasure: 'stems',
    color: '#F8FAFC',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 10,
    description: 'Fluffy white carnation bloom signifying sweet affection and pure good luck.',
    image: '',
    style: 'Occasion: ',
    supplierId: null,
    },

  // 4. Gerberas
  {
    id: 'fl-gerbera-daisy',
    name: 'Gerbera Daisy',
    botanicalName: 'Gerbera jamesonii',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 90,
    unitCost: 40,
    unitOfMeasure: 'stems',
    color: '#FB923C',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 10,
    description: 'Large, bold daisy flower with vivid orange and coral petals, radiating infectious cheer.',
    image: '',
    style: 'Occasion: Birthday, Graduation',
    supplierId: null,
    },

  // 5. Sunflowers
  {
    id: 'fl-sunflower',
    name: 'Sunflower',
    botanicalName: 'Helianthus annuus',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 150,
    unitCost: 65,
    unitOfMeasure: 'stems',
    color: '#EAB308',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 8,
    description: 'Vibrant golden yellow highland sunflower with rich brown center disc.',
    image: '',
    style: 'Occasion: Birthday, Graduation',
    supplierId: null,
    },

  // 6. Lilies
  {
    id: 'fl-stargazer-lily',
    name: 'Stargazer Lily',
    botanicalName: 'Lilium orientalis',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 180,
    unitCost: 80,
    unitOfMeasure: 'stems',
    color: '#EC4899',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 6,
    description: 'Dramatic oriental lily bloom with outward-facing deep pink petals and sweet exotic perfume.',
    image: '',
    style: 'Occasion: Sympathy',
    supplierId: null,
    },
  {
    id: 'fl-white-lily',
    name: 'White Lily',
    botanicalName: 'Lilium longiflorum',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 185,
    unitCost: 80,
    unitOfMeasure: 'stems',
    color: '#FFFFFF',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 6,
    description: 'Majestic trumpet-shaped white lily expressing peace, majesty, and devotion.',
    image: '',
    style: 'Occasion: Sympathy',
    supplierId: null,
    },

  // 7. Orchids
  {
    id: 'fl-phalaenopsis-orchid',
    name: 'Phalaenopsis Orchid',
    botanicalName: 'Phalaenopsis aphrodite',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 250,
    unitCost: 110,
    unitOfMeasure: 'stems',
    color: '#C084FC',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 5,
    description: 'Exotic moth orchid spray with cascading porcelain blooms of remarkable grace.',
    image: '',
    style: 'Occasion: Anniversary',
    supplierId: null,
    },

  // 8. Peonies
  {
    id: 'fl-pink-peony',
    name: 'Pink Peony',
    botanicalName: 'Paeonia lactiflora (Pink)',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 280,
    unitCost: 130,
    unitOfMeasure: 'stems',
    color: '#F472B6',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 5,
    description: 'Luxuriously dense ruffled peony bloom with intoxicating soft floral perfume.',
    image: '',
    style: 'Occasion: Anniversary',
    supplierId: null,
    },
  {
    id: 'fl-white-peony',
    name: 'White Peony',
    botanicalName: 'Paeonia lactiflora (White)',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 280,
    unitCost: 130,
    unitOfMeasure: 'stems',
    color: '#FFFFFF',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 5,
    description: 'Opulent multi-petaled snowy white peony representing prosperity and romance.',
    image: '',
    style: 'Occasion: Anniversary',
    supplierId: null,
    },

  // 9. Hydrangeas
  {
    id: 'fl-hydrangea',
    name: 'Hydrangea',
    botanicalName: 'Hydrangea macrophylla',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 220,
    unitCost: 95,
    unitOfMeasure: 'stems',
    color: '#60A5FA',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 6,
    description: 'Voluminous cloud-like floral globe with delicate azure and lilac florets.',
    image: '',
    style: 'Occasion: ',
    supplierId: null,
    },

  // 10. Daisies
  {
    id: 'fl-daisy',
    name: 'Daisy',
    botanicalName: 'Bellis perennis',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 65,
    unitCost: 30,
    unitOfMeasure: 'stems',
    color: '#FEF08A',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 12,
    description: 'Sweet meadow daisy with pristine white ray petals and sunny golden center.',
    image: '',
    style: 'Occasion: Birthday, Graduation',
    supplierId: null,
    },

  // 11. Chrysanthemums
  {
    id: 'fl-chrysanthemum',
    name: 'Chrysanthemum',
    botanicalName: 'Chrysanthemum morifolium',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 70,
    unitCost: 32,
    unitOfMeasure: 'stems',
    color: '#F59E0B',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 12,
    description: 'Multi-petal highland button mum with warm golden hues and exceptional longevity.',
    image: '',
    style: 'Occasion: Birthday',
    supplierId: null,
    },

  // 12. Lisianthus
  {
    id: 'fl-lisianthus',
    name: 'Lisianthus',
    botanicalName: 'Eustoma russellianum',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 130,
    unitCost: 60,
    unitOfMeasure: 'stems',
    color: '#A855F7',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 8,
    description: 'Delicate bell-shaped blooms with ruffled rose-like petal edges in purple and blush.',
    image: '',
    style: "Occasion: Valentine's Day, Anniversary",
    supplierId: null,
    },

  // 13. Snapdragons
  {
    id: 'fl-snapdragon',
    name: 'Snapdragon',
    botanicalName: 'Antirrhinum majus',
    category: 'Fresh Flowers',
    itemType: 'flower',
    price: 120,
    unitCost: 55,
    unitOfMeasure: 'stems',
    color: '#F43F5E',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 8,
    description: 'Architectural vertical flower spike with dense tiers of vibrant dragon-mouth florets.',
    image: '',
    style: 'Occasion: Birthday, Graduation',
    supplierId: null,
    },

  // 14. Baby's Breath
  {
    id: 'fil-babys-breath',
    name: 'Baby\'s Breath',
    botanicalName: 'Gypsophila paniculata',
    category: 'Fillers & Foliage',
    itemType: 'filler',
    price: 80,
    unitCost: 35,
    unitOfMeasure: 'stems',
    color: '#FFFFFF',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 10,
    description: 'Abundant sprays of tiny starry white florets creating an airy ethereal mist.',
    image: '',
    style: "Occasion: Valentine's Day, Sympathy",
    supplierId: null,
    },

  // 15. Eucalyptus (Foliage)
  {
    id: 'fol-eucalyptus',
    name: 'Eucalyptus',
    botanicalName: 'Eucalyptus cinerea',
    category: 'Fillers & Foliage',
    itemType: 'foliage',
    price: 60,
    unitCost: 25,
    unitOfMeasure: 'stems',
    color: '#6EE7B7',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 10,
    description: 'Aromatic silver-dollar eucalyptus stems with rounded matte blue-green foliage.',
    image: '',
    style: 'Occasion: Sympathy',
    supplierId: null,
    },

  // 16. Ruscus (Foliage)
  {
    id: 'fol-ruscus',
    name: 'Ruscus',
    botanicalName: 'Ruscus hypoglossum',
    category: 'Fillers & Foliage',
    itemType: 'foliage',
    price: 55,
    unitCost: 22,
    unitOfMeasure: 'stems',
    color: '#15803D',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 10,
    description: 'Glossy deep emerald Italian ruscus stems offering rich structure and contrast.',
    image: '',
    style: 'Occasion: Anniversary',
    supplierId: null,
    }
];

// Bouquet Materials, Packaging Supplies, and Customization Items
const PHASE2_MATERIALS = [
  // -------------------------------------------------------------
  // Fillers & Greenery (Phase 3 Customization Additions)
  // -------------------------------------------------------------
  {
    id: 'fil-waxflower',
    name: 'Waxflower',
    category: 'Fillers & Foliage',
    itemType: 'filler',
    price: 65,
    unitCost: 28,
    unitOfMeasure: 'stems',
    color: '#F472B6',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Tiny decorative flowers that add delicate texture and sweet botanical fragrance.',
    botanicalName: 'Chamelaucium uncinatum',
    image: '',
    style: 'Textured Filler'
  },
  {
    id: 'fil-statice',
    name: 'Statice',
    category: 'Fillers & Foliage',
    itemType: 'filler',
    price: 60,
    unitCost: 25,
    unitOfMeasure: 'stems',
    color: '#818CF8',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Small clustered flowers commonly used as colorful, long-lasting fillers.',
    botanicalName: 'Limonium sinuatum',
    image: '',
    style: 'Clustered Filler'
  },
  {
    id: 'fil-solidago',
    name: 'Solidago',
    category: 'Fillers & Foliage',
    itemType: 'filler',
    price: 55,
    unitCost: 22,
    unitOfMeasure: 'stems',
    color: '#FACC15',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Golden-yellow filler flowers that add warmth, vibrancy, and meadow-like flair.',
    botanicalName: 'Solidago canadensis',
    image: '',
    style: 'Warm Meadow Filler'
  },
  {
    id: 'fil-queen-annes-lace',
    name: "Queen Anne's Lace",
    category: 'Fillers & Foliage',
    itemType: 'filler',
    price: 70,
    unitCost: 30,
    unitOfMeasure: 'stems',
    color: '#F8FAFC',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 10,
    description: 'Delicate white, lace-like flower clusters evoking romantic airy elegance.',
    botanicalName: 'Daucus carota',
    image: '',
    style: 'Airy Lace Filler'
  },
  {
    id: 'fol-leatherleaf-fern',
    name: 'Leatherleaf Fern',
    category: 'Fillers & Foliage',
    itemType: 'foliage',
    price: 45,
    unitCost: 18,
    unitOfMeasure: 'stems',
    color: '#15803D',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 20,
    description: 'Deep green foliage that adds fullness, volume, and timeless structure.',
    botanicalName: 'Rumohra adiantiformis',
    image: '',
    style: 'Structural Foliage'
  },
  {
    id: 'fol-italian-ruscus',
    name: 'Italian Ruscus',
    category: 'Fillers & Foliage',
    itemType: 'foliage',
    price: 60,
    unitCost: 25,
    unitOfMeasure: 'stems',
    color: '#166534',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Slender greenery with an elegant trailing appearance and rich glossy leaves.',
    botanicalName: 'Ruscus hypophyllum',
    image: '',
    style: 'Trailing Greenery'
  },
  {
    id: 'fol-silver-dollar-eucalyptus',
    name: 'Silver Dollar Eucalyptus',
    category: 'Fillers & Foliage',
    itemType: 'foliage',
    price: 75,
    unitCost: 32,
    unitOfMeasure: 'stems',
    color: '#84CC16',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Rounded silvery-green leaves for a soft botanical look and calming scent.',
    botanicalName: 'Eucalyptus cinerea',
    image: '',
    style: 'Silvery Greenery'
  },

  // -------------------------------------------------------------
  // 10 Wrapping Options (with color palettes)
  // -------------------------------------------------------------
  {
    id: 'wrp-korean-matte',
    name: 'Korean Matte Wrapping Paper',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    price: 75,
    unitCost: 30,
    unitOfMeasure: 'sheets',
    color: '#FCD6E9',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Premium dual-sided waterproof matte floral wrap with silky petal finish.',
    image: '',
    style: JSON.stringify([
      { name: 'Blush Pink', hex: '#FCD6E9' },
      { name: 'Pearl Cream', hex: '#FBF8F1' },
      { name: 'Warm Sand', hex: '#E6DAC8' },
      { name: 'Midnight Noir', hex: '#2D2228' },
      { name: 'Sage Mist', hex: '#9CAF88' }
    ])
  },
  {
    id: 'wrp-korean-waterproof',
    name: 'Korean Waterproof Wrapping Paper',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    price: 75,
    unitCost: 30,
    unitOfMeasure: 'sheets',
    color: '#F9B4D0',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Durable moisture-resistant Korean wrapping sheets engineered for florist bouquets.',
    image: '',
    style: JSON.stringify([
      { name: 'Petal Pink', hex: '#F9B4D0' },
      { name: 'Cloud White', hex: '#FFFFFF' },
      { name: 'Sky Lilac', hex: '#E8DCF0' },
      { name: 'Slate Charcoal', hex: '#3F3D40' }
    ])
  },
  {
    id: 'wrp-kraft',
    name: 'Kraft Paper',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    price: 50,
    unitCost: 20,
    unitOfMeasure: 'sheets',
    color: '#C2A382',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Eco-friendly natural fibrous kraft wrapping for rustic artisanal presentations.',
    image: '',
    style: JSON.stringify([
      { name: 'Natural Brown', hex: '#C2A382' },
      { name: 'Vintage Oatmeal', hex: '#D9C9B4' },
      { name: 'Dark Coffee', hex: '#5C4033' }
    ])
  },
  {
    id: 'wrp-premium-tissue',
    name: 'Premium Tissue Paper',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    price: 45,
    unitCost: 18,
    unitOfMeasure: 'sheets',
    color: '#FEF08A',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Delicate archival wrapping tissue paper for elegant inner layering and volume.',
    image: '',
    style: JSON.stringify([
      { name: 'Pure White', hex: '#FFFFFF' },
      { name: 'Soft Rose', hex: '#FAD2E1' },
      { name: 'Buttercream', hex: '#FFF5D6' },
      { name: 'Pale Lavender', hex: '#E2D5E8' }
    ])
  },
  {
    id: 'wrp-floral-mesh',
    name: 'Floral Mesh Wrapping',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    price: 65,
    unitCost: 25,
    unitOfMeasure: 'sheets',
    color: '#E8D3A2',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Open-weave decorative floral mesh providing multidimensional texture and modern glamour.',
    image: '',
    style: JSON.stringify([
      { name: 'Golden Champagne', hex: '#E8D3A2' },
      { name: 'Silver Frost', hex: '#E5E7EB' },
      { name: 'Rose Gold', hex: '#E0A899' },
      { name: 'Noir Mesh', hex: '#262626' }
    ])
  },
  {
    id: 'wrp-frosted',
    name: 'Frosted Translucent Wrapping',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    price: 85,
    unitCost: 35,
    unitOfMeasure: 'sheets',
    color: '#E2E8F0',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Translucent semi-opaque frosted film diffusing floral colors with ethereal softness.',
    image: '',
    style: JSON.stringify([
      { name: 'Opal White', hex: '#F3F4F6' },
      { name: 'Muted Rose', hex: '#F7D6E0' },
      { name: 'Frosted Charcoal', hex: '#4B5563' }
    ])
  },
  {
    id: 'wrp-clear-cellophane',
    name: 'Clear Cellophane Wrapping',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    price: 40,
    unitCost: 15,
    unitOfMeasure: 'sheets',
    color: '#E0F2FE',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 20,
    description: 'High-clarity protective cellophane wrap for crisp floral presentation and weather protection.',
    image: '',
    style: JSON.stringify([
      { name: 'Crystal Clear', hex: '#E0F2FE' },
      { name: 'Iridescent Glaze', hex: '#FCE7F3' }
    ])
  },
  {
    id: 'wrp-pearlescent',
    name: 'Pearlescent Wrapping Paper',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    price: 90,
    unitCost: 36,
    unitOfMeasure: 'sheets',
    color: '#FCE7F3',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Luminous shimmering floral paper with soft iridescent sheen catching the ambient light.',
    image: '',
    style: JSON.stringify([
      { name: 'Pearl Pink', hex: '#FAD4E0' },
      { name: 'Luminous Ivory', hex: '#FFFFF0' },
      { name: 'Champagne Shimmer', hex: '#F7E7CE' }
    ])
  },
  {
    id: 'wrp-non-woven',
    name: 'Non-Woven Floral Wrapping',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    price: 60,
    unitCost: 24,
    unitOfMeasure: 'sheets',
    color: '#D8A4B8',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Supple, soft-touch fabric-like non-woven floral wrapping that folds into sculptured pleats.',
    image: '',
    style: JSON.stringify([
      { name: 'Dusty Blush', hex: '#D8A4B8' },
      { name: 'Forest Moss', hex: '#4A5844' },
      { name: 'Warm Mocha', hex: '#7E6351' }
    ])
  },
  {
    id: 'wrp-premium-textured',
    name: 'Premium Textured Wrapping Paper',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    price: 85,
    unitCost: 35,
    unitOfMeasure: 'sheets',
    color: '#FAE8FF',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Embossed luxury art paper providing substantial weight, bespoke tactile feel, and elegance.',
    image: '',
    style: JSON.stringify([
      { name: 'Embossed Ivory', hex: '#FAF8F5' },
      { name: 'Textured Blush', hex: '#F5D0DC' },
      { name: 'Vintage Plum', hex: '#4A2835' }
    ])
  },
  {
    id: 'wrp-black-film',
    name: 'Black Minimalist Wrap',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    price: 80,
    unitCost: 32,
    unitOfMeasure: 'sheets',
    color: '#1C1917',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 10,
    description: 'Dramatic matte black film providing high-contrast editorial backdrops for vibrant blooms.',
    image: '',
    style: JSON.stringify([
      { name: 'Midnight Noir', hex: '#1C1917' }
    ])
  },
  {
    id: 'wrp-blush-wrap',
    name: 'Soft Blush Wrap',
    category: 'Wrapping Materials',
    itemType: 'wrapping',
    price: 75,
    unitCost: 30,
    unitOfMeasure: 'sheets',
    color: '#FFF9FA',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Delicate porcelain blush wrap celebrating soft romantic aesthetics.',
    image: '',
    style: JSON.stringify([
      { name: 'Porcelain Blush', hex: '#FFF9FA' }
    ])
  },

  // -------------------------------------------------------------
  // 5 Ribbon Options (with color palettes)
  // -------------------------------------------------------------
  {
    id: 'rbn-satin',
    name: 'Satin Ribbon',
    category: 'Ribbons',
    itemType: 'ribbon',
    price: 45,
    unitCost: 18,
    unitOfMeasure: 'meters',
    color: '#C7356D',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 20,
    description: 'Double-face lustrous silky satin ribbon tied into flowing formal bows.',
    image: '',
    style: JSON.stringify([
      { name: 'Rose Pink', hex: '#C7356D' },
      { name: 'Champagne Gold', hex: '#D4AF37' },
      { name: 'Pearl White', hex: '#FAFAFA' },
      { name: 'Deep Plum', hex: '#4A154B' },
      { name: 'Burgundy Wine', hex: '#800020' }
    ])
  },
  {
    id: 'rbn-organza',
    name: 'Organza Ribbon',
    category: 'Ribbons',
    itemType: 'ribbon',
    price: 35,
    unitCost: 15,
    unitOfMeasure: 'meters',
    color: '#F472B6',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 20,
    description: 'Translucent, ethereal woven organza ribbon with subtle shimmer and featherweight drape.',
    image: '',
    style: JSON.stringify([
      { name: 'Sheer White', hex: '#FFFFFF' },
      { name: 'Soft Peach', hex: '#FBD5C4' },
      { name: 'Lavender Mist', hex: '#E6E6FA' },
      { name: 'Golden Shimmer', hex: '#F3E5AB' }
    ])
  },
  {
    id: 'rbn-grosgrain',
    name: 'Grosgrain Ribbon',
    category: 'Ribbons',
    itemType: 'ribbon',
    price: 50,
    unitCost: 20,
    unitOfMeasure: 'meters',
    color: '#3B82F6',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Durable ribbed grosgrain band providing neat structured bow accents.',
    image: '',
    style: JSON.stringify([
      { name: 'Cream Beige', hex: '#E8DEC8' },
      { name: 'Blush Rose', hex: '#E49AB0' },
      { name: 'Dusty Navy', hex: '#34495E' },
      { name: 'Forest Pine', hex: '#2D4B39' }
    ])
  },
  {
    id: 'rbn-velvet',
    name: 'Velvet Ribbon',
    category: 'Ribbons',
    itemType: 'ribbon',
    price: 65,
    unitCost: 28,
    unitOfMeasure: 'meters',
    color: '#831843',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Plush velvet ribbon imparting rich tactile warmth to high-end bespoke bouquets.',
    image: '',
    style: JSON.stringify([
      { name: 'Royal Plum', hex: '#4A154B' },
      { name: 'Deep Wine', hex: '#831843' },
      { name: 'Vintage Moss', hex: '#556B2F' },
      { name: 'Rose Quartz', hex: '#C08081' }
    ])
  },
  {
    id: 'rbn-chiffon',
    name: 'Sheer Chiffon Ribbon',
    category: 'Ribbons',
    itemType: 'ribbon',
    price: 55,
    unitCost: 22,
    unitOfMeasure: 'meters',
    color: '#FBCFE8',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 15,
    description: 'Raw-edge frayed silk chiffon ribbon that drifts softly in natural breezes.',
    image: '',
    style: JSON.stringify([
      { name: 'Soft Rosewater', hex: '#FBCFE8' },
      { name: 'Ivory Cream', hex: '#FDFBF7' },
      { name: 'Sage Whisper', hex: '#CBD5C0' },
      { name: 'Smoky Mauve', hex: '#B398A8' }
    ])
  },
  {
    id: 'rbn-beige-jute',
    name: 'Beige Jute Ribbon',
    category: 'Ribbons',
    itemType: 'ribbon',
    price: 40,
    unitCost: 15,
    unitOfMeasure: 'meters',
    color: '#D4C3A3',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 20,
    description: 'Textured natural woven jute ribbon for organic and bohemian bouquets.',
    image: '',
    style: JSON.stringify([
      { name: 'Natural Jute', hex: '#D4C3A3' }
    ])
  },

  // -------------------------------------------------------------
  // 5 Greeting Card Designs (Phase 3 Customization)
  // -------------------------------------------------------------
  {
    id: 'crd-classic-floral',
    name: 'Classic Floral Card',
    category: 'Greeting Cards',
    itemType: 'card',
    price: 35,
    unitCost: 10,
    unitOfMeasure: 'cards',
    color: '#F43F5E',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 50,
    description: 'Artisan greeting card with classic botanical floral foil border and luxury envelope.',
    image: '',
    style: 'Classic Floral Border'
  },
  {
    id: 'crd-minimalist-ivory',
    name: 'Minimalist Ivory Card',
    category: 'Greeting Cards',
    itemType: 'card',
    price: 35,
    unitCost: 10,
    unitOfMeasure: 'cards',
    color: '#FEF3C7',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 50,
    description: 'Clean minimalist heavy ivory cardstock for subtle, refined, heartfelt handwritten notes.',
    image: '',
    style: 'Minimalist Ivory'
  },
  {
    id: 'crd-romantic-blush',
    name: 'Romantic Blush Card',
    category: 'Greeting Cards',
    itemType: 'card',
    price: 35,
    unitCost: 10,
    unitOfMeasure: 'cards',
    color: '#FBCFE8',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 50,
    description: 'Soft blush card with warm embossing designed for heartfelt anniversary and romance notes.',
    image: '',
    style: 'Romantic Blush'
  },
  {
    id: 'crd-elegant-botanical',
    name: 'Elegant Botanical Card',
    category: 'Greeting Cards',
    itemType: 'card',
    price: 35,
    unitCost: 10,
    unitOfMeasure: 'cards',
    color: '#BBF7D0',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 50,
    description: 'Modern botanical card pressed with delicate greenery illustrations and premium texture.',
    image: '',
    style: 'Elegant Botanical'
  },
  {
    id: 'crd-premium-plum',
    name: 'Premium Plum Card',
    category: 'Greeting Cards',
    itemType: 'card',
    price: 45,
    unitCost: 15,
    unitOfMeasure: 'cards',
    color: '#4C0519',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 50,
    description: 'Deep velvet plum card with gold foil Umaira signature emblem and embossed keepsake sleeve.',
    image: '',
    style: 'Signature Velvet Plum'
  },

  // -------------------------------------------------------------
  // Florist Supplies & Accessories
  // -------------------------------------------------------------
  {
    id: 'crd-sentiment',
    name: 'Gift Sentiment Greeting Card',
    category: 'Greeting Cards',
    itemType: 'card',
    price: 35,
    unitCost: 10,
    unitOfMeasure: 'cards',
    color: '#FFF9FA',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 50,
    description: 'Letterpress heavy cotton card stock with embossed gold foil Umaira monogram.',
    image: '',
    style: 'Handwritten Sentiment'
  },
  {
    id: 'mat-flower-sleeve',
    name: 'Flower Protective Sleeve',
    category: 'Wrapping Materials',
    itemType: 'supply',
    price: 30,
    unitCost: 10,
    unitOfMeasure: 'pieces',
    color: '#F1D9E0',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 30,
    description: 'Conical protective sleeve guarding fragile petals and foliage during courier transit.',
    image: '',
    style: 'Protective Packaging'
  },
  {
    id: 'mat-stem-tape',
    name: 'Florist Stem Tape',
    category: 'Wrapping Materials',
    itemType: 'supply',
    price: 35,
    unitCost: 12,
    unitOfMeasure: 'rolls',
    color: '#15803D',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 10,
    description: 'Self-sealing moisture-resistant florist tape securing floral arrangements firmly.',
    image: '',
    style: 'Florist Essential'
  },
  {
    id: 'mat-floral-foam',
    name: 'Wet Floral Foam Block',
    category: 'Wrapping Materials',
    itemType: 'supply',
    price: 60,
    unitCost: 25,
    unitOfMeasure: 'blocks',
    color: '#065F46',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 10,
    description: 'High-density water-absorbing foam block hydrating stems for prolonged flower life.',
    image: '',
    style: 'Hydration Base'
  },
  {
    id: 'mat-delivery-box',
    name: 'Luxury Presentation Box',
    category: 'Wrapping Materials',
    itemType: 'supply',
    price: 180,
    unitCost: 75,
    unitOfMeasure: 'boxes',
    color: '#2D2228',
    stockCount: 0,
    availability: 'sold_out',
    lowStockThreshold: 10,
    description: 'Sturdy upright delivery box keeping floral stems secure and upright during transport.',
    image: '',
    style: 'Gift Box'
  }
];

// 32 Unique Ready-Made Bouquets
// 2 bouquets per flower type across all 16 flower types
// Each with structured ingredients, formula, sample prices, occasion tags, and empty image
const PHASE2_BOUQUETS = [
  // ---------------------------------------------------- 1. ROSES
  {
    id: 'bq-blushing-romance',
    name: 'Blushing Romance',
    primaryFlower: 'Roses',
    category: 'Ready-Made Bouquets',
    price: 1950,
    occasion: "Valentine's Day",
    occasions: ["Valentine's Day"],
    description: 'A dreamy romance arrangement featuring soft blush pink roses paired with delicate lisianthus, cloud-like baby\'s breath, and silver dollar eucalyptus.',
    formula: '10× Pink Rose, 4× Lisianthus, 2× Baby\'s Breath, 3× Eucalyptus, Korean Matte Wrap, Satin Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Roses',
      flowerTypes: ['Roses', 'Lisianthus', 'Baby\'s Breath', 'Eucalyptus'],
      mainFlowers: [
        { id: 'fl-pink-rose', name: 'Pink Rose', quantity: 10, type: 'Roses' },
        { id: 'fl-lisianthus', name: 'Lisianthus', quantity: 4, type: 'Lisianthus' },
        { id: 'fil-babys-breath', name: 'Baby\'s Breath', quantity: 2, type: 'Baby\'s Breath' },
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 3, type: 'Eucalyptus' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-satin', name: 'Satin Ribbon', quantity: 1 }
      ],
      occasions: ["Valentine's Day"],
      }
  },
  {
    id: 'bq-crimson-devotion',
    name: 'Crimson Devotion',
    primaryFlower: 'Roses',
    category: 'Ready-Made Bouquets',
    price: 2500,
    occasion: "Valentine's Day, Anniversary",
    occasions: ["Valentine's Day","Anniversary"],
    description: 'An intense statement of classic devotion pairing velvety deep red roses with porcelain white roses, airy baby\'s breath, and deep green Italian ruscus.',
    formula: '12× Red Rose, 6× White Rose, 2× Baby\'s Breath, 4× Ruscus, Korean Matte Wrap, Satin Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Roses',
      flowerTypes: ['Roses', 'Baby\'s Breath', 'Ruscus'],
      mainFlowers: [
        { id: 'fl-red-rose', name: 'Red Rose', quantity: 12, type: 'Roses' },
        { id: 'fl-white-rose', name: 'White Rose', quantity: 6, type: 'Roses' },
        { id: 'fil-babys-breath', name: 'Baby\'s Breath', quantity: 2, type: 'Baby\'s Breath' },
        { id: 'fol-ruscus', name: 'Ruscus', quantity: 4, type: 'Ruscus' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-satin', name: 'Satin Ribbon', quantity: 1 }
      ],
      occasions: ["Valentine's Day","Anniversary"],
      }
  },

  // ---------------------------------------------------- 2. TULIPS
  {
    id: 'bq-springtime-whisper',
    name: 'Springtime Whisper',
    primaryFlower: 'Tulips',
    category: 'Ready-Made Bouquets',
    price: 2300,
    occasion: "",
    occasions: [],
    description: 'Fresh Dutch tulips nestled among cheerful daisies and soft lisianthus with aromatic eucalyptus, bringing the gentle lightness of spring.',
    formula: '8× Pink Tulip, 5× Daisy, 4× Lisianthus, 3× Eucalyptus, Korean Matte Wrap, French Chiffon Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Tulips',
      flowerTypes: ['Tulips', 'Daisies', 'Lisianthus', 'Eucalyptus'],
      mainFlowers: [
        { id: 'fl-pink-tulip', name: 'Pink Tulip', quantity: 8, type: 'Tulips' },
        { id: 'fl-daisy', name: 'Daisy', quantity: 5, type: 'Daisies' },
        { id: 'fl-lisianthus', name: 'Lisianthus', quantity: 4, type: 'Lisianthus' },
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 3, type: 'Eucalyptus' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-chiffon', name: 'French Chiffon Ribbon', quantity: 1 }
      ],
      occasions: [],
      }
  },
  {
    id: 'bq-tulip-serenade',
    name: 'Tulip Serenade',
    primaryFlower: 'Tulips',
    category: 'Ready-Made Bouquets',
    price: 3450,
    occasion: "Valentine's Day, Anniversary",
    occasions: ["Valentine's Day","Anniversary"],
    description: 'A graceful harmony of pristine white and blushing pink tulips accented with delicate baby\'s breath for timeless romantic celebrations.',
    formula: '10× Pink Tulip, 10× White Tulip, 3× Baby\'s Breath, Korean Matte Wrap, Satin Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Tulips',
      flowerTypes: ['Tulips', 'Baby\'s Breath'],
      mainFlowers: [
        { id: 'fl-pink-tulip', name: 'Pink Tulip', quantity: 10, type: 'Tulips' },
        { id: 'fl-white-tulip', name: 'White Tulip', quantity: 10, type: 'Tulips' },
        { id: 'fil-babys-breath', name: 'Baby\'s Breath', quantity: 3, type: 'Baby\'s Breath' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-satin', name: 'Satin Ribbon', quantity: 1 }
      ],
      occasions: ["Valentine's Day","Anniversary"],
      }
  },

  // ---------------------------------------------------- 3. CARNATIONS
  {
    id: 'bq-sweet-affection',
    name: 'Sweet Affection',
    primaryFlower: 'Carnations',
    category: 'Ready-Made Bouquets',
    price: 1350,
    occasion: "",
    occasions: [],
    description: 'Ruffled pastel carnations complemented by blushing roses and wisps of baby\'s breath, embodying tender and heartfelt everyday affection.',
    formula: '8× Pink Carnation, 4× Pink Rose, 2× Baby\'s Breath, 3× Ruscus, Natural Kraft Paper, Beige Jute Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Carnations',
      flowerTypes: ['Carnations', 'Roses', 'Baby\'s Breath', 'Ruscus'],
      mainFlowers: [
        { id: 'fl-pink-carnation', name: 'Pink Carnation', quantity: 8, type: 'Carnations' },
        { id: 'fl-pink-rose', name: 'Pink Rose', quantity: 4, type: 'Roses' },
        { id: 'fil-babys-breath', name: 'Baby\'s Breath', quantity: 2, type: 'Baby\'s Breath' },
        { id: 'fol-ruscus', name: 'Ruscus', quantity: 3, type: 'Ruscus' }
      ],
      materials: [
        { id: 'wrp-kraft', name: 'Natural Kraft Paper', quantity: 1 },
        { id: 'rbn-beige-jute', name: 'Beige Jute Ribbon', quantity: 1 }
      ],
      occasions: [],
      }
  },
  {
    id: 'bq-carnation-charm',
    name: 'Carnation Charm',
    primaryFlower: 'Carnations',
    category: 'Ready-Made Bouquets',
    price: 1300,
    occasion: "",
    occasions: [],
    description: 'A charming blend of two-tone carnations framed by fragrant silver eucalyptus stems, perfect for simple moments of gratitude.',
    formula: '8× Pink Carnation, 6× White Carnation, 4× Eucalyptus, Korean Matte Wrap, Satin Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Carnations',
      flowerTypes: ['Carnations', 'Eucalyptus'],
      mainFlowers: [
        { id: 'fl-pink-carnation', name: 'Pink Carnation', quantity: 8, type: 'Carnations' },
        { id: 'fl-white-carnation', name: 'White Carnation', quantity: 6, type: 'Carnations' },
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 4, type: 'Eucalyptus' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-satin', name: 'Satin Ribbon', quantity: 1 }
      ],
      occasions: [],
      }
  },

  // ---------------------------------------------------- 4. GERBERAS
  {
    id: 'bq-sunshine-smiles',
    name: 'Sunshine Smiles',
    primaryFlower: 'Gerberas',
    category: 'Ready-Made Bouquets',
    price: 1550,
    occasion: "Birthday, Graduation",
    occasions: ["Birthday","Graduation"],
    description: 'Vibrant gerbera daisies and cheerful sunflowers bursting with radiant energy to brighten birthdays and celebrate proud milestones.',
    formula: '6× Gerbera Daisy, 3× Sunflower, 6× Daisy, 3× Eucalyptus, Natural Kraft Paper, Beige Jute Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Gerberas',
      flowerTypes: ['Gerberas', 'Sunflowers', 'Daisies', 'Eucalyptus'],
      mainFlowers: [
        { id: 'fl-gerbera-daisy', name: 'Gerbera Daisy', quantity: 6, type: 'Gerberas' },
        { id: 'fl-sunflower', name: 'Sunflower', quantity: 3, type: 'Sunflowers' },
        { id: 'fl-daisy', name: 'Daisy', quantity: 6, type: 'Daisies' },
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 3, type: 'Eucalyptus' }
      ],
      materials: [
        { id: 'wrp-kraft', name: 'Natural Kraft Paper', quantity: 1 },
        { id: 'rbn-beige-jute', name: 'Beige Jute Ribbon', quantity: 1 }
      ],
      occasions: ["Birthday","Graduation"],
      }
  },
  {
    id: 'bq-pastel-happiness',
    name: 'Pastel Happiness',
    primaryFlower: 'Gerberas',
    category: 'Ready-Made Bouquets',
    price: 1650,
    occasion: "Birthday",
    occasions: ["Birthday"],
    description: 'A delightfully joyful composition of pastel gerberas, ruffled carnations, and lisianthus wrapped in modern Korean matte blush paper.',
    formula: '6× Gerbera Daisy, 6× Pink Carnation, 4× Lisianthus, 2× Baby\'s Breath, Korean Matte Wrap, Satin Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Gerberas',
      flowerTypes: ['Gerberas', 'Carnations', 'Lisianthus', 'Baby\'s Breath'],
      mainFlowers: [
        { id: 'fl-gerbera-daisy', name: 'Gerbera Daisy', quantity: 6, type: 'Gerberas' },
        { id: 'fl-pink-carnation', name: 'Pink Carnation', quantity: 6, type: 'Carnations' },
        { id: 'fl-lisianthus', name: 'Lisianthus', quantity: 4, type: 'Lisianthus' },
        { id: 'fil-babys-breath', name: 'Baby\'s Breath', quantity: 2, type: 'Baby\'s Breath' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-satin', name: 'Satin Ribbon', quantity: 1 }
      ],
      occasions: ["Birthday"],
      }
  },

  // ---------------------------------------------------- 5. SUNFLOWERS
  {
    id: 'bq-golden-hour',
    name: 'Golden Hour',
    primaryFlower: 'Sunflowers',
    category: 'Ready-Made Bouquets',
    price: 1700,
    occasion: "Birthday, Graduation",
    occasions: ["Birthday","Graduation"],
    description: 'Warm, golden-hued highland sunflowers paired with rich bronze chrysanthemums and fiery gerberas capturing the warmth of sunset.',
    formula: '5× Sunflower, 6× Chrysanthemum, 4× Gerbera Daisy, 3× Ruscus, Natural Kraft Paper, Grosgrain Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Sunflowers',
      flowerTypes: ['Sunflowers', 'Chrysanthemums', 'Gerberas', 'Ruscus'],
      mainFlowers: [
        { id: 'fl-sunflower', name: 'Sunflower', quantity: 5, type: 'Sunflowers' },
        { id: 'fl-chrysanthemum', name: 'Chrysanthemum', quantity: 6, type: 'Chrysanthemums' },
        { id: 'fl-gerbera-daisy', name: 'Gerbera Daisy', quantity: 4, type: 'Gerberas' },
        { id: 'fol-ruscus', name: 'Ruscus', quantity: 3, type: 'Ruscus' }
      ],
      materials: [
        { id: 'wrp-kraft', name: 'Natural Kraft Paper', quantity: 1 },
        { id: 'rbn-grosgrain', name: 'Grosgrain Ribbon', quantity: 1 }
      ],
      occasions: ["Birthday","Graduation"],
      }
  },
  {
    id: 'bq-sunshine-embrace',
    name: 'Sunshine Embrace',
    primaryFlower: 'Sunflowers',
    category: 'Ready-Made Bouquets',
    price: 1600,
    occasion: "Graduation",
    occasions: ["Graduation"],
    description: 'Sun-drenched sunflowers surrounded by meadow daisies, airy baby\'s breath, and eucalyptus for enthusiastic graduation cheer.',
    formula: '5× Sunflower, 6× Daisy, 3× Baby\'s Breath, 4× Eucalyptus, Korean Matte Wrap, Beige Jute Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Sunflowers',
      flowerTypes: ['Sunflowers', 'Daisies', 'Baby\'s Breath', 'Eucalyptus'],
      mainFlowers: [
        { id: 'fl-sunflower', name: 'Sunflower', quantity: 5, type: 'Sunflowers' },
        { id: 'fl-daisy', name: 'Daisy', quantity: 6, type: 'Daisies' },
        { id: 'fil-babys-breath', name: 'Baby\'s Breath', quantity: 3, type: 'Baby\'s Breath' },
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 4, type: 'Eucalyptus' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-beige-jute', name: 'Beige Jute Ribbon', quantity: 1 }
      ],
      occasions: ["Graduation"],
      }
  },

  // ---------------------------------------------------- 6. LILIES
  {
    id: 'bq-lily-elegance',
    name: 'Lily Elegance',
    primaryFlower: 'Lilies',
    category: 'Ready-Made Bouquets',
    price: 2150,
    occasion: "Sympathy",
    occasions: ["Sympathy"],
    description: 'Regal stargazer lilies accompanied by pristine white roses and purple lisianthus in frosted translucent wrap for solemn or formal occasions.',
    formula: '4× Stargazer Lily, 6× White Rose, 4× Lisianthus, 4× Eucalyptus, Luxury Frosted Film, Satin Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Lilies',
      flowerTypes: ['Lilies', 'Roses', 'Lisianthus', 'Eucalyptus'],
      mainFlowers: [
        { id: 'fl-stargazer-lily', name: 'Stargazer Lily', quantity: 4, type: 'Lilies' },
        { id: 'fl-white-rose', name: 'White Rose', quantity: 6, type: 'Roses' },
        { id: 'fl-lisianthus', name: 'Lisianthus', quantity: 4, type: 'Lisianthus' },
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 4, type: 'Eucalyptus' }
      ],
      materials: [
        { id: 'wrp-frosted', name: 'Luxury Frosted Film', quantity: 1 },
        { id: 'rbn-satin', name: 'Satin Ribbon', quantity: 1 }
      ],
      occasions: ["Sympathy"],
      }
  },
  {
    id: 'bq-pure-serenity',
    name: 'Pure Serenity',
    primaryFlower: 'Lilies',
    category: 'Ready-Made Bouquets',
    price: 2300,
    occasion: "Sympathy",
    occasions: ["Sympathy"],
    description: 'An exquisite all-white arrangement of oriental lilies, snowy roses, and Italian ruscus radiating peace, honor, and purity.',
    formula: '5× White Lily, 8× White Rose, 3× Baby\'s Breath, 4× Ruscus, Luxury Frosted Film, French Chiffon Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Lilies',
      flowerTypes: ['Lilies', 'Roses', 'Baby\'s Breath', 'Ruscus'],
      mainFlowers: [
        { id: 'fl-white-lily', name: 'White Lily', quantity: 5, type: 'Lilies' },
        { id: 'fl-white-rose', name: 'White Rose', quantity: 8, type: 'Roses' },
        { id: 'fil-babys-breath', name: 'Baby\'s Breath', quantity: 3, type: 'Baby\'s Breath' },
        { id: 'fol-ruscus', name: 'Ruscus', quantity: 4, type: 'Ruscus' }
      ],
      materials: [
        { id: 'wrp-frosted', name: 'Luxury Frosted Film', quantity: 1 },
        { id: 'rbn-chiffon', name: 'French Chiffon Ribbon', quantity: 1 }
      ],
      occasions: ["Sympathy"],
      }
  },

  // ---------------------------------------------------- 7. ORCHIDS
  {
    id: 'bq-orchid-grace',
    name: 'Orchid Grace',
    primaryFlower: 'Orchids',
    category: 'Ready-Made Bouquets',
    price: 1900,
    occasion: "Anniversary, Sympathy",
    occasions: ["Anniversary","Sympathy"],
    description: 'Opulent phalaenopsis orchid stems arching gracefully over sky-blue hydrangeas and violet lisianthus for elevated luxury gifting.',
    formula: '3× Phalaenopsis Orchid, 2× Hydrangea, 4× Lisianthus, 3× Ruscus, Luxury Frosted Film, Velvet Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Orchids',
      flowerTypes: ['Orchids', 'Hydrangeas', 'Lisianthus', 'Ruscus'],
      mainFlowers: [
        { id: 'fl-phalaenopsis-orchid', name: 'Phalaenopsis Orchid', quantity: 3, type: 'Orchids' },
        { id: 'fl-hydrangea', name: 'Hydrangea', quantity: 2, type: 'Hydrangeas' },
        { id: 'fl-lisianthus', name: 'Lisianthus', quantity: 4, type: 'Lisianthus' },
        { id: 'fol-ruscus', name: 'Ruscus', quantity: 3, type: 'Ruscus' }
      ],
      materials: [
        { id: 'wrp-frosted', name: 'Luxury Frosted Film', quantity: 1 },
        { id: 'rbn-velvet', name: 'Velvet Ribbon', quantity: 1 }
      ],
      occasions: ["Anniversary","Sympathy"],
      }
  },
  {
    id: 'bq-enchanted-orchid',
    name: 'Enchanted Orchid',
    primaryFlower: 'Orchids',
    category: 'Ready-Made Bouquets',
    price: 2100,
    occasion: "Anniversary",
    occasions: ["Anniversary"],
    description: 'Breathtaking exotic orchids layered with long-stem blush roses and eucalyptus, designed for signature executive and milestone gifting.',
    formula: '4× Phalaenopsis Orchid, 8× Pink Rose, 4× Eucalyptus, Korean Matte Wrap, Velvet Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Orchids',
      flowerTypes: ['Orchids', 'Roses', 'Eucalyptus'],
      mainFlowers: [
        { id: 'fl-phalaenopsis-orchid', name: 'Phalaenopsis Orchid', quantity: 4, type: 'Orchids' },
        { id: 'fl-pink-rose', name: 'Pink Rose', quantity: 8, type: 'Roses' },
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 4, type: 'Eucalyptus' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-velvet', name: 'Velvet Ribbon', quantity: 1 }
      ],
      occasions: ["Anniversary"],
      }
  },

  // ---------------------------------------------------- 8. PEONIES
  {
    id: 'bq-peony-dreams',
    name: 'Peony Dreams',
    primaryFlower: 'Peonies',
    category: 'Ready-Made Bouquets',
    price: 2950,
    occasion: "Anniversary",
    occasions: ["Anniversary"],
    description: 'Lush Dutch peonies paired with garden roses and cloud-soft hydrangeas, creating an unforgettable haute-couture floral masterpiece.',
    formula: '6× Pink Peony, 6× White Rose, 2× Hydrangea, 2× Baby\'s Breath, Korean Matte Wrap, Velvet Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Peonies',
      flowerTypes: ['Peonies', 'Roses', 'Hydrangeas', 'Baby\'s Breath'],
      mainFlowers: [
        { id: 'fl-pink-peony', name: 'Pink Peony', quantity: 6, type: 'Peonies' },
        { id: 'fl-white-rose', name: 'White Rose', quantity: 6, type: 'Roses' },
        { id: 'fl-hydrangea', name: 'Hydrangea', quantity: 2, type: 'Hydrangeas' },
        { id: 'fil-babys-breath', name: 'Baby\'s Breath', quantity: 2, type: 'Baby\'s Breath' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-velvet', name: 'Velvet Ribbon', quantity: 1 }
      ],
      occasions: ["Anniversary"],
      }
  },
  {
    id: 'bq-blush-peony-garden',
    name: 'Blush Peony Garden',
    primaryFlower: 'Peonies',
    category: 'Ready-Made Bouquets',
    price: 2700,
    occasion: "Anniversary",
    occasions: ["Anniversary"],
    description: 'Voluminous pink peonies and delicate lisianthus in a romantic garden arrangement finished with sheer flowing chiffon.',
    formula: '6× Pink Peony, 6× Lisianthus, 4× Eucalyptus, Korean Matte Wrap, French Chiffon Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Peonies',
      flowerTypes: ['Peonies', 'Lisianthus', 'Eucalyptus'],
      mainFlowers: [
        { id: 'fl-pink-peony', name: 'Pink Peony', quantity: 6, type: 'Peonies' },
        { id: 'fl-lisianthus', name: 'Lisianthus', quantity: 6, type: 'Lisianthus' },
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 4, type: 'Eucalyptus' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-chiffon', name: 'French Chiffon Ribbon', quantity: 1 }
      ],
      occasions: ["Anniversary"],
      }
  },

  // ---------------------------------------------------- 9. HYDRANGEAS
  {
    id: 'bq-cloud-nine',
    name: 'Cloud Nine',
    primaryFlower: 'Hydrangeas',
    category: 'Ready-Made Bouquets',
    price: 2500,
    occasion: "",
    occasions: [],
    description: 'Sumptuous hydrangea globes resting on a bed of pastel peonies and lisianthus, evoking the dreamy serenity of cloud nine.',
    formula: '3× Hydrangea, 4× Pink Peony, 4× Lisianthus, 3× Eucalyptus, Luxury Frosted Film, Satin Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Hydrangeas',
      flowerTypes: ['Hydrangeas', 'Peonies', 'Lisianthus', 'Eucalyptus'],
      mainFlowers: [
        { id: 'fl-hydrangea', name: 'Hydrangea', quantity: 3, type: 'Hydrangeas' },
        { id: 'fl-pink-peony', name: 'Pink Peony', quantity: 4, type: 'Peonies' },
        { id: 'fl-lisianthus', name: 'Lisianthus', quantity: 4, type: 'Lisianthus' },
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 3, type: 'Eucalyptus' }
      ],
      materials: [
        { id: 'wrp-frosted', name: 'Luxury Frosted Film', quantity: 1 },
        { id: 'rbn-satin', name: 'Satin Ribbon', quantity: 1 }
      ],
      occasions: [],
      }
  },
  {
    id: 'bq-hydrangea-haven',
    name: 'Hydrangea Haven',
    primaryFlower: 'Hydrangeas',
    category: 'Ready-Made Bouquets',
    price: 1800,
    occasion: "",
    occasions: [],
    description: 'Cool azure hydrangeas framed with pristine white roses and starlight baby\'s breath, offering an oasis of calm elegance.',
    formula: '3× Hydrangea, 8× White Rose, 3× Baby\'s Breath, Korean Matte Wrap, French Chiffon Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Hydrangeas',
      flowerTypes: ['Hydrangeas', 'Roses', 'Baby\'s Breath'],
      mainFlowers: [
        { id: 'fl-hydrangea', name: 'Hydrangea', quantity: 3, type: 'Hydrangeas' },
        { id: 'fl-white-rose', name: 'White Rose', quantity: 8, type: 'Roses' },
        { id: 'fil-babys-breath', name: 'Baby\'s Breath', quantity: 3, type: 'Baby\'s Breath' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-chiffon', name: 'French Chiffon Ribbon', quantity: 1 }
      ],
      occasions: [],
      }
  },

  // ---------------------------------------------------- 10. DAISIES
  {
    id: 'bq-daisy-delight',
    name: 'Daisy Delight',
    primaryFlower: 'Daisies',
    category: 'Ready-Made Bouquets',
    price: 1250,
    occasion: "Birthday",
    occasions: ["Birthday"],
    description: 'An unpretentious, cheerful gathering of sunny daisies and sweet pink carnations wrapped in rustic brown paper.',
    formula: '10× Daisy, 6× Pink Carnation, 2× Baby\'s Breath, Natural Kraft Paper, Beige Jute Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Daisies',
      flowerTypes: ['Daisies', 'Carnations', 'Baby\'s Breath'],
      mainFlowers: [
        { id: 'fl-daisy', name: 'Daisy', quantity: 10, type: 'Daisies' },
        { id: 'fl-pink-carnation', name: 'Pink Carnation', quantity: 6, type: 'Carnations' },
        { id: 'fil-babys-breath', name: 'Baby\'s Breath', quantity: 2, type: 'Baby\'s Breath' }
      ],
      materials: [
        { id: 'wrp-kraft', name: 'Natural Kraft Paper', quantity: 1 },
        { id: 'rbn-beige-jute', name: 'Beige Jute Ribbon', quantity: 1 }
      ],
      occasions: ["Birthday"],
      }
  },
  {
    id: 'bq-meadow-wishes',
    name: 'Meadow Wishes',
    primaryFlower: 'Daisies',
    category: 'Ready-Made Bouquets',
    price: 1450,
    occasion: "Graduation",
    occasions: ["Graduation"],
    description: 'A wildflower meadow arrangement of open daisies, tall snapdragons, and carnations whispering heartfelt good wishes.',
    formula: '8× Daisy, 4× Snapdragon, 4× White Carnation, 3× Ruscus, Natural Kraft Paper, Grosgrain Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Daisies',
      flowerTypes: ['Daisies', 'Snapdragons', 'Carnations', 'Ruscus'],
      mainFlowers: [
        { id: 'fl-daisy', name: 'Daisy', quantity: 8, type: 'Daisies' },
        { id: 'fl-snapdragon', name: 'Snapdragon', quantity: 4, type: 'Snapdragons' },
        { id: 'fl-white-carnation', name: 'White Carnation', quantity: 4, type: 'Carnations' },
        { id: 'fol-ruscus', name: 'Ruscus', quantity: 3, type: 'Ruscus' }
      ],
      materials: [
        { id: 'wrp-kraft', name: 'Natural Kraft Paper', quantity: 1 },
        { id: 'rbn-grosgrain', name: 'Grosgrain Ribbon', quantity: 1 }
      ],
      occasions: ["Graduation"],
      }
  },

  // ---------------------------------------------------- 11. CHRYSANTHEMUMS
  {
    id: 'bq-golden-petals',
    name: 'Golden Petals',
    primaryFlower: 'Chrysanthemums',
    category: 'Ready-Made Bouquets',
    price: 1100,
    occasion: "Birthday",
    occasions: ["Birthday"],
    description: 'Bright golden chrysanthemum blooms paired with vivid gerberas and eucalyptus, conveying warmth, loyalty, and optimism.',
    formula: '8× Chrysanthemum, 4× Gerbera Daisy, 3× Eucalyptus, Natural Kraft Paper, Satin Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Chrysanthemums',
      flowerTypes: ['Chrysanthemums', 'Gerberas', 'Eucalyptus'],
      mainFlowers: [
        { id: 'fl-chrysanthemum', name: 'Chrysanthemum', quantity: 8, type: 'Chrysanthemums' },
        { id: 'fl-gerbera-daisy', name: 'Gerbera Daisy', quantity: 4, type: 'Gerberas' },
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 3, type: 'Eucalyptus' }
      ],
      materials: [
        { id: 'wrp-kraft', name: 'Natural Kraft Paper', quantity: 1 },
        { id: 'rbn-satin', name: 'Satin Ribbon', quantity: 1 }
      ],
      occasions: ["Birthday"],
      }
  },
  {
    id: 'bq-autumn-grace',
    name: 'Autumn Grace',
    primaryFlower: 'Chrysanthemums',
    category: 'Ready-Made Bouquets',
    price: 1500,
    occasion: "Birthday",
    occasions: ["Birthday"],
    description: 'Warm amber chrysanthemums blended with cheerful sunflowers and soft carnations in a rich autumnal palette.',
    formula: '6× Chrysanthemum, 3× Sunflower, 6× Pink Carnation, 3× Eucalyptus, Korean Matte Wrap, Grosgrain Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Chrysanthemums',
      flowerTypes: ['Chrysanthemums', 'Sunflowers', 'Carnations', 'Eucalyptus'],
      mainFlowers: [
        { id: 'fl-chrysanthemum', name: 'Chrysanthemum', quantity: 6, type: 'Chrysanthemums' },
        { id: 'fl-sunflower', name: 'Sunflower', quantity: 3, type: 'Sunflowers' },
        { id: 'fl-pink-carnation', name: 'Pink Carnation', quantity: 6, type: 'Carnations' },
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 3, type: 'Eucalyptus' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-grosgrain', name: 'Grosgrain Ribbon', quantity: 1 }
      ],
      occasions: ["Birthday"],
      }
  },

  // ---------------------------------------------------- 12. LISIANTHUS
  {
    id: 'bq-soft-whispers',
    name: 'Soft Whispers',
    primaryFlower: 'Lisianthus',
    category: 'Ready-Made Bouquets',
    price: 1800,
    occasion: "Sympathy",
    occasions: ["Sympathy"],
    description: 'Velvety purple and lavender lisianthus ruffled like garden roses, accented with mist-like baby\'s breath for gentle sentiments.',
    formula: '10× Lisianthus, 3× Baby\'s Breath, 4× Eucalyptus, Korean Matte Wrap, French Chiffon Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Lisianthus',
      flowerTypes: ['Lisianthus', 'Baby\'s Breath', 'Eucalyptus'],
      mainFlowers: [
        { id: 'fl-lisianthus', name: 'Lisianthus', quantity: 10, type: 'Lisianthus' },
        { id: 'fil-babys-breath', name: 'Baby\'s Breath', quantity: 3, type: 'Baby\'s Breath' },
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 4, type: 'Eucalyptus' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-chiffon', name: 'French Chiffon Ribbon', quantity: 1 }
      ],
      occasions: ["Sympathy"],
      }
  },
  {
    id: 'bq-lisianthus-romance',
    name: 'Lisianthus Romance',
    primaryFlower: 'Lisianthus',
    category: 'Ready-Made Bouquets',
    price: 2250,
    occasion: "Valentine's Day, Anniversary",
    occasions: ["Valentine's Day","Anniversary"],
    description: 'A deeply romantic courtship bouquet uniting ruffled lisianthus, sweet blush roses, and fresh pink tulips.',
    formula: '6× Lisianthus, 6× Pink Rose, 4× Pink Tulip, 3× Ruscus, Korean Matte Wrap, Satin Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Lisianthus',
      flowerTypes: ['Lisianthus', 'Roses', 'Tulips', 'Ruscus'],
      mainFlowers: [
        { id: 'fl-lisianthus', name: 'Lisianthus', quantity: 6, type: 'Lisianthus' },
        { id: 'fl-pink-rose', name: 'Pink Rose', quantity: 6, type: 'Roses' },
        { id: 'fl-pink-tulip', name: 'Pink Tulip', quantity: 4, type: 'Tulips' },
        { id: 'fol-ruscus', name: 'Ruscus', quantity: 3, type: 'Ruscus' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-satin', name: 'Satin Ribbon', quantity: 1 }
      ],
      occasions: ["Valentine's Day","Anniversary"],
      }
  },

  // ---------------------------------------------------- 13. SNAPDRAGONS
  {
    id: 'bq-garden-whimsy',
    name: 'Garden Whimsy',
    primaryFlower: 'Snapdragons',
    category: 'Ready-Made Bouquets',
    price: 1600,
    occasion: "Birthday, Graduation",
    occasions: ["Birthday","Graduation"],
    description: 'Stately tall snapdragons intermingled with playful daisies and ruffled carnations for spirited and whimsical celebrations.',
    formula: '6× Snapdragon, 6× Daisy, 4× White Carnation, 3× Eucalyptus, Natural Kraft Paper, Beige Jute Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Snapdragons',
      flowerTypes: ['Snapdragons', 'Daisies', 'Carnations', 'Eucalyptus'],
      mainFlowers: [
        { id: 'fl-snapdragon', name: 'Snapdragon', quantity: 6, type: 'Snapdragons' },
        { id: 'fl-daisy', name: 'Daisy', quantity: 6, type: 'Daisies' },
        { id: 'fl-white-carnation', name: 'White Carnation', quantity: 4, type: 'Carnations' },
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 3, type: 'Eucalyptus' }
      ],
      materials: [
        { id: 'wrp-kraft', name: 'Natural Kraft Paper', quantity: 1 },
        { id: 'rbn-beige-jute', name: 'Beige Jute Ribbon', quantity: 1 }
      ],
      occasions: ["Birthday","Graduation"],
      }
  },
  {
    id: 'bq-snapdragon-symphony',
    name: 'Snapdragon Symphony',
    primaryFlower: 'Snapdragons',
    category: 'Ready-Made Bouquets',
    price: 2050,
    occasion: "",
    occasions: [],
    description: 'An architectural floral symphony of towering snapdragons, fragrant roses, and lisianthus wrapped in luxury porcelain paper.',
    formula: '6× Snapdragon, 6× Pink Rose, 4× Lisianthus, 2× Baby\'s Breath, Korean Matte Wrap, Satin Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Snapdragons',
      flowerTypes: ['Snapdragons', 'Roses', 'Lisianthus', 'Baby\'s Breath'],
      mainFlowers: [
        { id: 'fl-snapdragon', name: 'Snapdragon', quantity: 6, type: 'Snapdragons' },
        { id: 'fl-pink-rose', name: 'Pink Rose', quantity: 6, type: 'Roses' },
        { id: 'fl-lisianthus', name: 'Lisianthus', quantity: 4, type: 'Lisianthus' },
        { id: 'fil-babys-breath', name: 'Baby\'s Breath', quantity: 2, type: 'Baby\'s Breath' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-satin', name: 'Satin Ribbon', quantity: 1 }
      ],
      occasions: [],
      }
  },

  // ---------------------------------------------------- 14. BABY'S BREATH
  {
    id: 'bq-cloud-of-love',
    name: 'Cloud of Love',
    primaryFlower: 'Baby\'s Breath',
    category: 'Ready-Made Bouquets',
    price: 950,
    occasion: "Sympathy",
    occasions: ["Sympathy"],
    description: 'An ethereal cloud of pure white gypsophila cradling pristine white roses, wrapped in minimalist blush-toned matte film.',
    formula: '6× Baby\'s Breath, 4× White Rose, Korean Matte Wrap, French Chiffon Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Baby\'s Breath',
      flowerTypes: ['Baby\'s Breath', 'Roses'],
      mainFlowers: [
        { id: 'fil-babys-breath', name: 'Baby\'s Breath', quantity: 6, type: 'Baby\'s Breath' },
        { id: 'fl-white-rose', name: 'White Rose', quantity: 4, type: 'Roses' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-chiffon', name: 'French Chiffon Ribbon', quantity: 1 }
      ],
      occasions: ["Sympathy"],
      }
  },
  {
    id: 'bq-forever-in-bloom',
    name: 'Forever in Bloom',
    primaryFlower: 'Baby\'s Breath',
    category: 'Ready-Made Bouquets',
    price: 2050,
    occasion: "Valentine's Day",
    occasions: ["Valentine's Day"],
    description: 'Fluffy everlasting baby\'s breath embracing vivid red roses, pink tulips, and purple lisianthus for enduring love.',
    formula: '5× Baby\'s Breath, 4× Red Rose, 4× Pink Tulip, 4× Lisianthus, Korean Matte Wrap, Satin Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Baby\'s Breath',
      flowerTypes: ['Baby\'s Breath', 'Roses', 'Tulips', 'Lisianthus'],
      mainFlowers: [
        { id: 'fil-babys-breath', name: 'Baby\'s Breath', quantity: 5, type: 'Baby\'s Breath' },
        { id: 'fl-red-rose', name: 'Red Rose', quantity: 4, type: 'Roses' },
        { id: 'fl-pink-tulip', name: 'Pink Tulip', quantity: 4, type: 'Tulips' },
        { id: 'fl-lisianthus', name: 'Lisianthus', quantity: 4, type: 'Lisianthus' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-satin', name: 'Satin Ribbon', quantity: 1 }
      ],
      occasions: ["Valentine's Day"],
      }
  },

  // ---------------------------------------------------- 15. EUCALYPTUS (FOLIAGE)
  {
    id: 'bq-botanical-serenity',
    name: 'Botanical Serenity',
    primaryFlower: 'Eucalyptus',
    category: 'Ready-Made Bouquets',
    price: 1850,
    occasion: "Sympathy",
    occasions: ["Sympathy"],
    description: 'Lush aromatic silver dollar eucalyptus combined with crisp white lilies, white roses, and ruscus in a calming botanical composition.',
    formula: '6× Eucalyptus, 6× White Rose, 3× White Lily, 4× Ruscus, Luxury Frosted Film, Satin Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Eucalyptus',
      flowerTypes: ['Eucalyptus', 'Roses', 'Lilies', 'Ruscus'],
      mainFlowers: [
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 6, type: 'Eucalyptus' },
        { id: 'fl-white-rose', name: 'White Rose', quantity: 6, type: 'Roses' },
        { id: 'fl-white-lily', name: 'White Lily', quantity: 3, type: 'Lilies' },
        { id: 'fol-ruscus', name: 'Ruscus', quantity: 4, type: 'Ruscus' }
      ],
      materials: [
        { id: 'wrp-frosted', name: 'Luxury Frosted Film', quantity: 1 },
        { id: 'rbn-satin', name: 'Satin Ribbon', quantity: 1 }
      ],
      occasions: ["Sympathy"],
      }
  },
  {
    id: 'bq-eucalyptus-garden',
    name: 'Eucalyptus Garden',
    primaryFlower: 'Eucalyptus',
    category: 'Ready-Made Bouquets',
    price: 1650,
    occasion: "Sympathy",
    occasions: ["Sympathy"],
    description: 'A refreshing rustic garden bouquet starring aromatic eucalyptus greenery intertwined with sweet lisianthus and sunny daisies.',
    formula: '6× Eucalyptus, 6× Lisianthus, 8× Daisy, Natural Kraft Paper, Beige Jute Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Eucalyptus',
      flowerTypes: ['Eucalyptus', 'Lisianthus', 'Daisies'],
      mainFlowers: [
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 6, type: 'Eucalyptus' },
        { id: 'fl-lisianthus', name: 'Lisianthus', quantity: 6, type: 'Lisianthus' },
        { id: 'fl-daisy', name: 'Daisy', quantity: 8, type: 'Daisies' }
      ],
      materials: [
        { id: 'wrp-kraft', name: 'Natural Kraft Paper', quantity: 1 },
        { id: 'rbn-beige-jute', name: 'Beige Jute Ribbon', quantity: 1 }
      ],
      occasions: ["Sympathy"],
      }
  },

  // ---------------------------------------------------- 16. RUSCUS (FOLIAGE)
  {
    id: 'bq-woodland-charm',
    name: 'Woodland Charm',
    primaryFlower: 'Ruscus',
    category: 'Ready-Made Bouquets',
    price: 1200,
    occasion: "",
    occasions: [],
    description: 'Glossy Italian ruscus sprigs accentuating vibrant chrysanthemums and pink carnations in an earthy woodland presentation.',
    formula: '6× Ruscus, 6× Pink Carnation, 6× Chrysanthemum, Natural Kraft Paper, Beige Jute Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Ruscus',
      flowerTypes: ['Ruscus', 'Carnations', 'Chrysanthemums'],
      mainFlowers: [
        { id: 'fol-ruscus', name: 'Ruscus', quantity: 6, type: 'Ruscus' },
        { id: 'fl-pink-carnation', name: 'Pink Carnation', quantity: 6, type: 'Carnations' },
        { id: 'fl-chrysanthemum', name: 'Chrysanthemum', quantity: 6, type: 'Chrysanthemums' }
      ],
      materials: [
        { id: 'wrp-kraft', name: 'Natural Kraft Paper', quantity: 1 },
        { id: 'rbn-beige-jute', name: 'Beige Jute Ribbon', quantity: 1 }
      ],
      occasions: [],
      }
  },
  {
    id: 'bq-evergreen-elegance',
    name: 'Evergreen Elegance',
    primaryFlower: 'Ruscus',
    category: 'Ready-Made Bouquets',
    price: 1750,
    occasion: "Anniversary",
    occasions: ["Anniversary"],
    description: 'Sophisticated emerald ruscus and silver foliage elevating exotic orchids and classic white roses with timeless modern flair.',
    formula: '6× Ruscus, 4× Eucalyptus, 2× Phalaenopsis Orchid, 6× White Rose, Korean Matte Wrap, Satin Ribbon',
    image: '',
    availability: 'sold_out',
    specs: {
      primaryFlower: 'Ruscus',
      flowerTypes: ['Ruscus', 'Eucalyptus', 'Orchids', 'Roses'],
      mainFlowers: [
        { id: 'fol-ruscus', name: 'Ruscus', quantity: 6, type: 'Ruscus' },
        { id: 'fol-eucalyptus', name: 'Eucalyptus', quantity: 4, type: 'Eucalyptus' },
        { id: 'fl-phalaenopsis-orchid', name: 'Phalaenopsis Orchid', quantity: 2, type: 'Orchids' },
        { id: 'fl-white-rose', name: 'White Rose', quantity: 6, type: 'Roses' }
      ],
      materials: [
        { id: 'wrp-korean-matte', name: 'Korean Matte Wrap', quantity: 1 },
        { id: 'rbn-satin', name: 'Satin Ribbon', quantity: 1 }
      ],
      occasions: ["Anniversary"],
      }
  }
];

module.exports = {
  PHASE2_CATEGORIES,
  PHASE2_FLOWERS,
  PHASE2_MATERIALS,
  PHASE2_BOUQUETS
};
