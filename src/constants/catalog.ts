import {
  CrustId,
  SauceId,
  SizeId,
  CheeseId,
  ToppingId,
  SizeOption,
  CrustOption,
  SauceOption,
  CheeseOption,
  ToppingOption,
  ArtisanPreset
} from '../types/pizza';

export const CATALOG: {
  sizes: Record<SizeId, SizeOption>;
  crusts: Record<CrustId, CrustOption>;
  sauces: Record<SauceId, SauceOption>;
  cheeses: Record<CheeseId, CheeseOption>;
  extraCheesePrice: number;
  toppings: ToppingOption[];
  maxVarieties: number;
  maxGrams: number;
} = {
  sizes: {
    '8': { label: '8” Personal', price: 599, f: 0.80 },
    '12': { label: '12” Medium', price: 999, f: 1.0 },
    '15': { label: '15” Large', price: 1399, f: 1.22 },
    '10': { label: '10” Small', price: 799, f: 0.88 },
    '14': { label: '14” Family', price: 1249, f: 1.15 }
  },
  crusts: {
    thin: {
      label: 'Thin Crust',
      price: 0,
      rim: 0.12,
      shine: 0.12,
      desc: 'Crispy Roman style with delicate edge',
      badge: 'Crispy'
    },
    pan: {
      label: 'Pan Crust',
      price: 100,
      rim: 0.22,
      shine: 0.22,
      desc: 'Golden-fried deep dish with thick puffy edge',
      badge: 'Golden & Puffy'
    },
    stuffed: {
      label: 'Cheese Stuffed',
      price: 180,
      rim: 0.28,
      shine: 0.35,
      desc: 'Mozzarella & yak cheese rolled into a molten rim',
      badge: 'Molten Cheese Rim'
    }
  },
  sauces: {
    classic: { label: 'Tomato Herb', price: 0, color: '#B93724' },
    pesto: { label: 'Basil Pesto', price: 75, color: '#4E7B3C' },
    bechamel: { label: 'Creamy Béchamel', price: 80, color: '#E8DFC8' },
    bbq: { label: 'Smoky BBQ', price: 60, color: '#682012' },
    spicy: { label: 'Spicy Arrabiata', price: 50, color: '#9E2A1A' }
  },
  cheeses: {
    blend: {
      label: 'House Blend',
      price: 0,
      desc: 'Signature blend of Mozzarella, Yak & Kanchan',
      badge: 'Chef Signature',
      colors: ['rgba(243,203,119,.95)', 'rgba(238,187,87,.95)', 'rgba(246,212,137,.95)']
    },
    mozzarella: {
      label: 'Fresh Mozzarella',
      price: 60,
      desc: 'Creamy, stretchy fior di latte with sweet dairy finish',
      colors: ['rgba(255,248,228,.95)', 'rgba(245,232,195,.95)', 'rgba(252,243,215,.95)']
    },
    yak: {
      label: 'Himalayan Yak',
      price: 120,
      desc: 'Aged mountain yak cheese with rich savory nuttiness',
      badge: 'Local Special',
      colors: ['rgba(235,175,70,.95)', 'rgba(222,158,52,.95)', 'rgba(245,190,85,.95)']
    },
    kanchan: {
      label: 'Artisan Kanchan',
      price: 80,
      desc: 'Mild alpine-style pressed cheese from eastern Nepal hills',
      colors: ['rgba(246,215,142,.95)', 'rgba(238,198,110,.95)', 'rgba(250,225,160,.95)']
    }
  },
  extraCheesePrice: 100, // Matches client menu add-on: "Extra Cheese Rs. 100"
  toppings: [
    { id: 'chick', label: 'Grilled Chicken', price: 150, max: 10, g: 15, category: 'nonveg', itemsPerUnit: 3 },
    { id: 'pep', label: 'Pepperoni', price: 120, max: 12, g: 12, category: 'nonveg', itemsPerUnit: 3 },
    { id: 'mush', label: 'Mixed Mushrooms', price: 80, max: 10, g: 16, category: 'veg', itemsPerUnit: 3 },
    { id: 'jalap', label: 'Jalapeños / Chilies', price: 60, max: 10, g: 8, category: 'veg', itemsPerUnit: 4 },
    { id: 'prosc', label: 'Ham & Salami', price: 120, max: 8, g: 10, category: 'nonveg', itemsPerUnit: 2 },
    { id: 'onion', label: 'Caramelized Onion', price: 50, max: 10, g: 8, category: 'veg', itemsPerUnit: 4 },
    { id: 'olive', label: 'Black Olives', price: 50, max: 12, g: 10, category: 'veg', itemsPerUnit: 4 },
    { id: 'basil', label: 'Fresh Basil', price: 40, max: 8, g: 3, category: 'veg', itemsPerUnit: 4 }
  ],
  maxVarieties: 5,
  maxGrams: 240
};

export const TOPSIZE: Record<ToppingId, number> = {
  chick: 0.11,
  pep: 0.115,
  mush: 0.105,
  jalap: 0.07,
  prosc: 0.125,
  onion: 0.09,
  olive: 0.065,
  basil: 0.12
};

export const CHEESE_C = [
  'rgba(243,203,119,.95)', // Mozzarella
  'rgba(238,187,87,.95)',  // Yak Cheese
  'rgba(246,212,137,.95)'  // Kanchan Cheese
];

export const CRUST_COLOR_STOPS: [number, string][] = [
  [0, '#F0DFB8'],
  [0.5, '#E7C489'],
  [0.72, '#D19755'],
  [0.88, '#A05C2C'],
  [1.05, '#57301A'],
  [1.2, '#26140B']
];

export const SAUCE_NEED = 0.65;

export const fmt = (rupees: number): string => 'Rs. ' + Math.round(rupees).toLocaleString();

export const ARTISAN_PRESETS: ArtisanPreset[] = [
  {
    id: 'margherita',
    name: 'Margherita',
    category: 'veg',
    desc: 'Fresh mozzarella, tomato sauce & basil',
    sauceId: 'classic',
    toppings: [{ id: 'basil', count: 6 }]
  },
  {
    id: 'diavola',
    name: 'Diavola',
    category: 'nonveg',
    desc: 'Pepperoni, chilies, yak cheese & mozzarella',
    sauceId: 'classic',
    badge: 'Popular 🔥',
    toppings: [
      { id: 'pep', count: 6 },
      { id: 'jalap', count: 5 }
    ]
  },
  {
    id: 'al_fungi',
    name: 'Al Fungi',
    category: 'veg',
    desc: 'Mixed mushrooms, mozzarella & tomato sauce',
    sauceId: 'classic',
    toppings: [{ id: 'mush', count: 7 }]
  },
  {
    id: 'chicken_pesto',
    name: 'Chicken Pesto',
    category: 'nonveg',
    desc: 'Grilled chicken, fresh basil pesto & mozzarella',
    sauceId: 'pesto',
    badge: 'Chef Pick ⭐',
    toppings: [
      { id: 'chick', count: 6 },
      { id: 'basil', count: 4 }
    ]
  },
  {
    id: 'spinach_onion',
    name: 'Caramelized Onion',
    category: 'veg',
    desc: 'Creamy béchamel, spinach & caramelized onions',
    sauceId: 'bechamel',
    toppings: [
      { id: 'onion', count: 6 },
      { id: 'mush', count: 4 }
    ]
  },
  {
    id: 'meat_lovers',
    name: 'Meat Lovers',
    category: 'nonveg',
    desc: 'Chicken, salami, ham & mozzarella',
    sauceId: 'classic',
    badge: 'Feast 🍖',
    toppings: [
      { id: 'chick', count: 4 },
      { id: 'pep', count: 4 },
      { id: 'prosc', count: 4 }
    ]
  }
];
