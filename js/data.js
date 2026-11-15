/**
 * FLEUR DE L'AMOUR / UMAIRA FLORIST - Botanical Data & Catalogs
 * Contains 40 recommended Philippine florist catalog items:
 * 10 Fresh Flowers, 5 Fillers & Foliage, 5 Wrapping Materials, 5 Ribbon Styles, 5 Message Cards, and 10 Ready-Made Bouquets.
 * All prices in Philippine Peso (₱).
 */

const FLOWER_DATA = {
  mainFlowers: [
  {
    "id": "fl-red-rose",
    "occasions": [
      "anniversary",
      "valentines-day",
      "birthday"
    ],
    "name": "Red Rose",
    "botanicalName": "Rosa grandiflora",
    "category": "Fresh Flowers",
    "price": 120,
    "availability": "available",
    "stockCount": 100,
    "image": "",
    "color": "#dc2626",
    "description": "Classic red rose stem",
    "stemLength": "45-50 cm",
    "fragrance": "Fresh & Floral",
    "vaseLife": "7-10 Days",
    "popular": true
  },
  {
    "id": "fl-pink-rose",
    "occasions": [
      "anniversary",
      "valentines-day",
      "birthday"
    ],
    "name": "Pink Rose",
    "botanicalName": "Rosa x hybrida",
    "category": "Fresh Flowers",
    "price": 110,
    "availability": "available",
    "stockCount": 80,
    "image": "",
    "color": "#ec4899",
    "description": "Gentle pink rose stem",
    "stemLength": "45-50 cm",
    "fragrance": "Fresh & Floral",
    "vaseLife": "7-10 Days",
    "popular": true
  },
  {
    "id": "fl-white-rose",
    "occasions": [
      "anniversary",
      "valentines-day",
      "birthday"
    ],
    "name": "White Rose",
    "botanicalName": "Rosa alba",
    "category": "Fresh Flowers",
    "price": 110,
    "availability": "available",
    "stockCount": 80,
    "image": "",
    "color": "#f8fafc",
    "description": "Pure white rose stem",
    "stemLength": "45-50 cm",
    "fragrance": "Fresh & Floral",
    "vaseLife": "7-10 Days",
    "popular": true
  },
  {
    "id": "fl-sunflower",
    "occasions": [
      "birthday",
      "graduation",
      "congratulations"
    ],
    "name": "Sunflower",
    "botanicalName": "Helianthus annuus",
    "category": "Fresh Flowers",
    "price": 180,
    "availability": "available",
    "stockCount": 60,
    "image": "",
    "color": "#facc15",
    "description": "Bright standard sunflower stem",
    "stemLength": "45-50 cm",
    "fragrance": "Fresh & Floral",
    "vaseLife": "7-10 Days",
    "popular": true
  },
  {
    "id": "fl-gerbera-daisy",
    "occasions": [
      "birthday",
      "anniversary"
    ],
    "name": "Gerbera Daisy",
    "botanicalName": "Gerbera jamesonii",
    "category": "Fresh Flowers",
    "price": 90,
    "availability": "available",
    "stockCount": 80,
    "image": "",
    "color": "#f97316",
    "description": "Vibrant mixed gerbera daisy stem",
    "stemLength": "45-50 cm",
    "fragrance": "Fresh & Floral",
    "vaseLife": "7-10 Days",
    "popular": true
  },
  {
    "id": "fl-carnation",
    "occasions": [
      "mothers-day",
      "birthday",
      "thank-you"
    ],
    "name": "Carnation",
    "botanicalName": "Dianthus caryophyllus",
    "category": "Fresh Flowers",
    "price": 75,
    "availability": "available",
    "stockCount": 100,
    "image": "",
    "color": "#f43f5e",
    "description": "Long-lasting carnation stem",
    "stemLength": "45-50 cm",
    "fragrance": "Fresh & Floral",
    "vaseLife": "7-10 Days",
    "popular": true
  },
  {
    "id": "fl-tulip",
    "occasions": [
      "anniversary",
      "valentines-day",
      "birthday"
    ],
    "name": "Tulip",
    "botanicalName": "Tulipa gesneriana",
    "category": "Fresh Flowers",
    "price": 220,
    "availability": "available",
    "stockCount": 40,
    "image": "",
    "color": "#fb7185",
    "description": "Imported premium tulip stem",
    "stemLength": "45-50 cm",
    "fragrance": "Fresh & Floral",
    "vaseLife": "7-10 Days",
    "popular": true
  },
  {
    "id": "fl-stargazer-lily",
    "occasions": [
      "anniversary",
      "sympathy",
      "congratulations"
    ],
    "name": "Stargazer Lily",
    "botanicalName": "Lilium orientalis",
    "category": "Fresh Flowers",
    "price": 250,
    "availability": "available",
    "stockCount": 35,
    "image": "",
    "color": "#d946ef",
    "description": "Fragrant stargazer lily stem",
    "stemLength": "45-50 cm",
    "fragrance": "Fresh & Floral",
    "vaseLife": "7-10 Days",
    "popular": true
  },
  {
    "id": "fl-chrysanthemum",
    "occasions": [
      "birthday",
      "anniversary"
    ],
    "name": "Chrysanthemum",
    "botanicalName": "Chrysanthemum morifolium",
    "category": "Fresh Flowers",
    "price": 70,
    "availability": "available",
    "stockCount": 100,
    "image": "",
    "color": "#eab308",
    "description": "Fresh locally sourced chrysanthemum",
    "stemLength": "45-50 cm",
    "fragrance": "Fresh & Floral",
    "vaseLife": "7-10 Days",
    "popular": true
  },
  {
    "id": "fl-malaysian-mums",
    "occasions": [
      "birthday",
      "anniversary"
    ],
    "name": "Malaysian Mums",
    "botanicalName": "Chrysanthemum indicum",
    "category": "Fresh Flowers",
    "price": 65,
    "availability": "available",
    "stockCount": 100,
    "image": "",
    "color": "#a855f7",
    "description": "Colorful spray mum stem",
    "stemLength": "45-50 cm",
    "fragrance": "Fresh & Floral",
    "vaseLife": "7-10 Days",
    "popular": true
  }
],
  fillerFlowers: [
  {
    "id": "fil-babys-breath",
    "name": "Baby's Breath",
    "botanicalName": "Gypsophila paniculata",
    "price": 80,
    "availability": "available",
    "stockCount": 60,
    "image": "",
    "description": "Delicate white filler flowers"
  },
  {
    "id": "fil-caspia",
    "name": "Caspia Filler",
    "botanicalName": "Limonium bellidifolium",
    "price": 60,
    "availability": "available",
    "stockCount": 60,
    "image": "",
    "description": "Delicate purple filler"
  }
],
  greenery: [
  {
    "id": "grn-eucalyptus",
    "name": "Eucalyptus",
    "botanicalName": "Eucalyptus cinerea",
    "price": 65,
    "availability": "available",
    "stockCount": 50,
    "image": "",
    "description": "Soft green decorative foliage"
  },
  {
    "id": "grn-ruscus",
    "name": "Ruscus Leaves",
    "botanicalName": "Ruscus aculeatus",
    "price": 50,
    "availability": "available",
    "stockCount": 70,
    "image": "",
    "description": "Structured greenery for bouquets"
  },
  {
    "id": "grn-fern",
    "name": "Leatherleaf Fern",
    "botanicalName": "Rumohra adiantiformis",
    "price": 40,
    "availability": "available",
    "stockCount": 80,
    "image": "",
    "description": "Classic foliage for added volume"
  }
],
  wrappingOptions: [
  {
    "id": "wrp-korean",
    "name": "Korean-Style Wrapping",
    "colorHex": "#fdf2f8",
    "price": 80,
    "availability": "available",
    "stockCount": 100,
    "image": "",
    "description": "Modern matte wrapping paper"
  },
  {
    "id": "wrp-kraft",
    "name": "Kraft Paper",
    "colorHex": "#d97706",
    "price": 40,
    "availability": "available",
    "stockCount": 100,
    "image": "",
    "description": "Rustic and natural paper wrap"
  },
  {
    "id": "wrp-waterproof",
    "name": "Waterproof Wrapping",
    "colorHex": "#e0f2fe",
    "price": 65,
    "availability": "available",
    "stockCount": 100,
    "image": "",
    "description": "Durable moisture-resistant wrap"
  },
  {
    "id": "wrp-translucent",
    "name": "Translucent Wrapping",
    "colorHex": "#f1f5f9",
    "price": 70,
    "availability": "available",
    "stockCount": 80,
    "image": "",
    "description": "Semi-transparent frosted wrap"
  },
  {
    "id": "wrp-pearl",
    "name": "Premium Pearl Wrapping",
    "colorHex": "#fef3c7",
    "price": 90,
    "availability": "available",
    "stockCount": 60,
    "image": "",
    "description": "Elegant pearlescent floral wrap"
  }
],
  ribbonOptions: [
  {
    "id": "rbn-satin",
    "name": "Satin Ribbon",
    "colorHex": "#ec4899",
    "style": "Smooth & Glossy Satin",
    "price": 25,
    "availability": "available",
    "stockCount": 120
  },
  {
    "id": "rbn-organza",
    "name": "Organza Ribbon",
    "colorHex": "#f472b6",
    "style": "Lightweight Sheer Organza",
    "price": 30,
    "availability": "available",
    "stockCount": 100
  },
  {
    "id": "rbn-grosgrain",
    "name": "Grosgrain Ribbon",
    "colorHex": "#6366f1",
    "style": "Textured Woven Grosgrain",
    "price": 30,
    "availability": "available",
    "stockCount": 100
  },
  {
    "id": "rbn-velvet",
    "name": "Velvet Ribbon",
    "colorHex": "#991b1b",
    "style": "Soft Premium Velvet",
    "price": 45,
    "availability": "available",
    "stockCount": 60
  },
  {
    "id": "rbn-burlap",
    "name": "Burlap Ribbon",
    "colorHex": "#b45309",
    "style": "Rustic Natural Jute",
    "price": 25,
    "availability": "available",
    "stockCount": 80
  }
],
  cardDesigns: [
  {
    "id": "crd-birthday",
    "name": "Happy Birthday Card",
    "theme": "Floral Birthday Greeting",
    "price": 35,
    "availability": "available",
    "stockCount": 100,
    "description": "Colorful birthday card"
  },
  {
    "id": "crd-anniversary",
    "name": "Anniversary Card",
    "theme": "Romantic Heartfelt Milestone",
    "price": 35,
    "availability": "available",
    "stockCount": 80,
    "description": "Romantic card for couples"
  },
  {
    "id": "crd-congratulations",
    "name": "Congratulations Card",
    "theme": "Gold Foil Congratulations",
    "price": 35,
    "availability": "available",
    "stockCount": 100,
    "description": "Celebratory message card"
  },
  {
    "id": "crd-thank-you",
    "name": "Thank You Card",
    "theme": "Botanical Appreciation",
    "price": 30,
    "availability": "available",
    "stockCount": 100,
    "description": "Appreciation message card"
  },
  {
    "id": "crd-personalized",
    "name": "Personalized Greeting Card",
    "theme": "Blank Custom Inscription",
    "price": 30,
    "availability": "available",
    "stockCount": 120,
    "description": "Custom text printed on card"
  }
],
  featuredBouquets: [
  {
    "id": "bq-classic-red-rose",
    "name": "Classic Red Rose Bouquet",
    "category": "Ready-Made Bouquets",
    "occasion": "Anniversary, Valentine's",
    "occasions": [
      "Anniversary",
      "Valentine's Day"
    ],
    "price": 1499,
    "stockCount": 10,
    "availability": "available",
    "description": "12 red roses in elegant wrapping",
    "formula": "12× Red Rose, 1× Baby's Breath, 1× Kraft Paper, 1× Satin Ribbon",
    "image": "",
    "specs": {
      "mainFlowers": [
        {
          "id": "fl-red-rose",
          "name": "Red Rose",
          "quantity": 12
        }
      ],
      "filler": "fil-babys-breath",
      "wrapping": "wrp-kraft",
      "ribbon": "rbn-satin",
      "message": "Happy Anniversary / With Love"
    }
  },
  {
    "id": "bq-pink-rose",
    "name": "Pink Rose Bouquet",
    "category": "Ready-Made Bouquets",
    "occasion": "Birthday, Anniversary",
    "occasions": [
      "Birthday",
      "Anniversary"
    ],
    "price": 1299,
    "stockCount": 10,
    "availability": "available",
    "description": "Soft pink roses for thoughtful gifting",
    "formula": "10× Pink Rose, 1× Eucalyptus, 1× Korean-Style Wrapping, 1× Satin Ribbon",
    "image": "",
    "specs": {
      "mainFlowers": [
        {
          "id": "fl-pink-rose",
          "name": "Pink Rose",
          "quantity": 10
        }
      ],
      "greenery": "grn-eucalyptus",
      "wrapping": "wrp-korean",
      "ribbon": "rbn-satin"
    }
  },
  {
    "id": "bq-sunflower-delight",
    "name": "Sunflower Delight",
    "category": "Ready-Made Bouquets",
    "occasion": "Birthday, Graduation",
    "occasions": [
      "Birthday",
      "Graduation"
    ],
    "price": 1199,
    "stockCount": 8,
    "availability": "available",
    "description": "Cheerful sunflower arrangement",
    "formula": "3× Sunflower, 2× Caspia Filler, 1× Kraft Paper, 1× Burlap Ribbon",
    "image": "",
    "specs": {
      "mainFlowers": [
        {
          "id": "fl-sunflower",
          "name": "Sunflower",
          "quantity": 3
        }
      ],
      "filler": "fil-caspia",
      "wrapping": "wrp-kraft",
      "ribbon": "rbn-burlap"
    }
  },
  {
    "id": "bq-white-rose-elegance",
    "name": "White Rose Elegance",
    "category": "Ready-Made Bouquets",
    "occasion": "Sympathy, Anniversary",
    "occasions": [
      "Sympathy",
      "Anniversary"
    ],
    "price": 1399,
    "stockCount": 8,
    "availability": "available",
    "description": "Elegant white rose arrangement",
    "formula": "10× White Rose, 1× Ruscus Leaves, 1× Translucent Wrapping, 1× Organza Ribbon",
    "image": "",
    "specs": {
      "mainFlowers": [
        {
          "id": "fl-white-rose",
          "name": "White Rose",
          "quantity": 10
        }
      ],
      "greenery": "grn-ruscus",
      "wrapping": "wrp-translucent",
      "ribbon": "rbn-organza"
    }
  },
  {
    "id": "bq-mixed-gerbera",
    "name": "Mixed Gerbera Bouquet",
    "category": "Ready-Made Bouquets",
    "occasion": "Birthday, Congratulations",
    "occasions": [
      "Birthday",
      "Congratulations"
    ],
    "price": 999,
    "stockCount": 10,
    "availability": "available",
    "description": "Colorful gerberas in vibrant wrapping",
    "formula": "6× Gerbera Daisy, 1× Leatherleaf Fern, 1× Korean-Style Wrapping, 1× Grosgrain Ribbon",
    "image": "",
    "specs": {
      "mainFlowers": [
        {
          "id": "fl-gerbera-daisy",
          "name": "Gerbera Daisy",
          "quantity": 6
        }
      ],
      "greenery": "grn-fern",
      "wrapping": "wrp-korean",
      "ribbon": "rbn-grosgrain"
    }
  },
  {
    "id": "bq-carnation-sweetheart",
    "name": "Carnation Sweetheart",
    "category": "Ready-Made Bouquets",
    "occasion": "Mother's Day, Birthday",
    "occasions": [
      "Mother's Day",
      "Birthday"
    ],
    "price": 899,
    "stockCount": 12,
    "availability": "available",
    "description": "Pink and white carnations in pastel wrapping",
    "formula": "8× Carnation, 1× Baby's Breath, 1× Korean-Style Wrapping, 1× Satin Ribbon",
    "image": "",
    "specs": {
      "mainFlowers": [
        {
          "id": "fl-carnation",
          "name": "Carnation",
          "quantity": 8
        }
      ],
      "filler": "fil-babys-breath",
      "wrapping": "wrp-korean",
      "ribbon": "rbn-satin"
    }
  },
  {
    "id": "bq-tulip-romance",
    "name": "Tulip Romance",
    "category": "Ready-Made Bouquets",
    "occasion": "Anniversary, Valentine's",
    "occasions": [
      "Anniversary",
      "Valentine's Day"
    ],
    "price": 1899,
    "stockCount": 5,
    "availability": "available",
    "description": "Premium romantic tulip arrangement",
    "formula": "8× Tulip, 1× Eucalyptus, 1× Premium Pearl Wrapping, 1× Velvet Ribbon",
    "image": "",
    "specs": {
      "mainFlowers": [
        {
          "id": "fl-tulip",
          "name": "Tulip",
          "quantity": 8
        }
      ],
      "greenery": "grn-eucalyptus",
      "wrapping": "wrp-pearl",
      "ribbon": "rbn-velvet"
    }
  },
  {
    "id": "bq-lily-grace",
    "name": "Lily Grace Bouquet",
    "category": "Ready-Made Bouquets",
    "occasion": "Anniversary, Sympathy",
    "occasions": [
      "Anniversary",
      "Sympathy"
    ],
    "price": 1799,
    "stockCount": 6,
    "availability": "available",
    "description": "Fragrant lilies with decorative greenery",
    "formula": "5× Stargazer Lily, 1× Ruscus Leaves, 1× Translucent Wrapping, 1× Satin Ribbon",
    "image": "",
    "specs": {
      "mainFlowers": [
        {
          "id": "fl-stargazer-lily",
          "name": "Stargazer Lily",
          "quantity": 5
        }
      ],
      "greenery": "grn-ruscus",
      "wrapping": "wrp-translucent",
      "ribbon": "rbn-satin"
    }
  },
  {
    "id": "bq-mixed-flower-surprise",
    "name": "Mixed Flower Surprise",
    "category": "Ready-Made Bouquets",
    "occasion": "Birthday, Thank You",
    "occasions": [
      "Birthday",
      "Thank You"
    ],
    "price": 1299,
    "stockCount": 10,
    "availability": "available",
    "description": "Seasonal roses, gerberas, and carnations",
    "formula": "3× Red Rose, 3× Gerbera Daisy, 3× Carnation, 1× Baby's Breath, 1× Kraft Paper, 1× Grosgrain Ribbon",
    "image": "",
    "specs": {
      "mainFlowers": [
        {
          "id": "fl-red-rose",
          "name": "Red Rose",
          "quantity": 3
        },
        {
          "id": "fl-gerbera-daisy",
          "name": "Gerbera Daisy",
          "quantity": 3
        },
        {
          "id": "fl-carnation",
          "name": "Carnation",
          "quantity": 3
        }
      ],
      "filler": "fil-babys-breath",
      "wrapping": "wrp-kraft",
      "ribbon": "rbn-grosgrain"
    }
  },
  {
    "id": "bq-graduation-celebration",
    "name": "Graduation Celebration",
    "category": "Ready-Made Bouquets",
    "occasion": "Graduation, Congratulations",
    "occasions": [
      "Graduation",
      "Congratulations"
    ],
    "price": 1499,
    "stockCount": 8,
    "availability": "available",
    "description": "Sunflowers and roses for graduation gifts",
    "formula": "3× Sunflower, 4× Red Rose, 1× Eucalyptus, 1× Waterproof Wrapping, 1× Grosgrain Ribbon",
    "image": "",
    "specs": {
      "mainFlowers": [
        {
          "id": "fl-sunflower",
          "name": "Sunflower",
          "quantity": 3
        },
        {
          "id": "fl-red-rose",
          "name": "Red Rose",
          "quantity": 4
        }
      ],
      "greenery": "grn-eucalyptus",
      "wrapping": "wrp-waterproof",
      "ribbon": "rbn-grosgrain"
    }
  }
],
  occasions: [
  {
    "id": "anniversary",
    "name": "Anniversary",
    "tagline": "Romantic Roses & Dutch Tulips",
    "icon": "heart",
    "image": "",
    "description": "Celebrate your shared milestones with lavish velvety roses and graceful pink tulips that speak eternal devotion.",
    "recommendedBouquetIds": [
      "bq-classic-red-rose",
      "bq-tulip-romance"
    ]
  },
  {
    "id": "birthday",
    "name": "Birthday",
    "tagline": "Bright & Colorful Sunshine Arrangements",
    "icon": "cake",
    "image": "",
    "description": "Surprise them on their special day with joyful pops of sunflowers, pink roses, and gerbera daisies.",
    "recommendedBouquetIds": [
      "bq-pink-rose",
      "bq-sunflower-delight"
    ]
  },
  {
    "id": "valentines-day",
    "name": "Valentine's Day",
    "tagline": "Romantic Red & Blush Pink Masterpieces",
    "icon": "flame",
    "image": "",
    "description": "Express your purest passion with our master-crafted red roses and romantic tulip arrangements.",
    "recommendedBouquetIds": [
      "bq-classic-red-rose",
      "bq-tulip-romance"
    ]
  },
  {
    "id": "graduation",
    "name": "Graduation",
    "tagline": "Fresh & Cheerful Bouquets for New Beginnings",
    "icon": "graduation-cap",
    "image": "",
    "description": "Honor their hard work and triumphant milestone with celebratory sunflowers and vibrant wraps.",
    "recommendedBouquetIds": [
      "bq-graduation-celebration",
      "bq-sunflower-delight"
    ]
  },
  {
    "id": "congratulations",
    "name": "Congratulations",
    "tagline": "Celebrate Milestones & Grand Achievements",
    "icon": "award",
    "image": "",
    "description": "Congratulate friends, family, and colleagues on their momentous occasions and successes.",
    "recommendedBouquetIds": [
      "bq-mixed-gerbera",
      "bq-graduation-celebration"
    ]
  },
  {
    "id": "mothers-day",
    "name": "Mother's Day",
    "tagline": "Heartfelt Carnations & Tender Blooms",
    "icon": "smile",
    "image": "",
    "description": "Show your gratitude and unconditional love with sweet pink and white carnation arrangements.",
    "recommendedBouquetIds": [
      "bq-carnation-sweetheart",
      "bq-pink-rose"
    ]
  },
  {
    "id": "sympathy",
    "name": "Sympathy",
    "tagline": "Elegant & Respectful White Floral Tributes",
    "icon": "feather",
    "image": "",
    "description": "Convey comfort, serenity, and heartfelt condolences with dignified white roses and lilies.",
    "recommendedBouquetIds": [
      "bq-white-rose-elegance",
      "bq-lily-grace"
    ]
  },
  {
    "id": "thank-you",
    "name": "Thank You",
    "tagline": "Appreciation & Gratitude in Every Petal",
    "icon": "sparkles",
    "image": "",
    "description": "Express genuine appreciation with cheerful seasonal floral mixes.",
    "recommendedBouquetIds": [
      "bq-mixed-flower-surprise",
      "bq-carnation-sweetheart"
    ]
  }
]
};

// Helper lookup functions
function getFlowerById(id) {
  return FLOWER_DATA.mainFlowers.find(f => f.id === id);
}

function getFillerById(id) {
  return (FLOWER_DATA.fillerFlowers || []).find(f => f.id === id) || (FLOWER_DATA.greenery || []).find(g => g.id === id);
}

function getGreeneryById(id) {
  return (FLOWER_DATA.greenery || []).find(g => g.id === id) || (FLOWER_DATA.fillerFlowers || []).find(f => f.id === id);
}

function getWrappingById(id) {
  return (FLOWER_DATA.wrappingOptions || []).find(w => w.id === id);
}

function getRibbonById(id) {
  return (FLOWER_DATA.ribbonOptions || []).find(r => r.id === id);
}

function getCardDesignById(id) {
  return (FLOWER_DATA.cardDesigns || []).find(c => c.id === id);
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
