import { Dish, Ingredient, Settings } from '../types';

/* Musafir Cafe — Dehradun, Uttarakhand (fictional demo dataset) */

export const SEED_INGREDIENTS: Ingredient[] = [
  { id: 'chick', name: 'Chicken (curry cut)', unit: 'kg', price: 280, prev: 252, cat: 'Poultry & Meat' },
  { id: 'paneer', name: 'Paneer', unit: 'kg', price: 340, prev: 340, cat: 'Dairy' },
  { id: 'butter', name: 'Butter', unit: 'kg', price: 520, prev: 505, cat: 'Dairy' },
  { id: 'cream', name: 'Heavy Cream', unit: 'L', price: 240, prev: 225, cat: 'Dairy' },
  { id: 'cheese', name: 'Mozzarella', unit: 'kg', price: 480, prev: 445, cat: 'Dairy' },
  { id: 'milk', name: 'Milk', unit: 'L', price: 60, prev: 56, cat: 'Dairy' },
  { id: 'yogurt', name: 'Yogurt', unit: 'kg', price: 100, prev: 100, cat: 'Dairy' },
  { id: 'tomato', name: 'Tomatoes', unit: 'kg', price: 80, prev: 95, cat: 'Produce' },
  { id: 'onion', name: 'Onions', unit: 'kg', price: 60, prev: 55, cat: 'Produce' },
  { id: 'potato', name: 'Potatoes', unit: 'kg', price: 40, prev: 38, cat: 'Produce' },
  { id: 'veg', name: 'Mixed Vegetables', unit: 'kg', price: 90, prev: 85, cat: 'Produce' },
  { id: 'mushroom', name: 'Mushrooms', unit: 'kg', price: 240, prev: 220, cat: 'Produce' },
  { id: 'herbs', name: 'Fresh Herbs', unit: 'kg', price: 300, prev: 300, cat: 'Produce' },
  { id: 'garlic', name: 'Garlic', unit: 'kg', price: 160, prev: 160, cat: 'Produce' },
  { id: 'ginger', name: 'Ginger', unit: 'kg', price: 140, prev: 140, cat: 'Produce' },
  { id: 'garam', name: 'Garam Masala', unit: 'kg', price: 800, prev: 800, cat: 'Spices' },
  { id: 'tea', name: 'Tea Leaves', unit: 'kg', price: 700, prev: 700, cat: 'Spices' },
  { id: 'coffee', name: 'Coffee Beans', unit: 'kg', price: 900, prev: 900, cat: 'Beverage' },
  { id: 'sugar', name: 'Sugar', unit: 'kg', price: 45, prev: 45, cat: 'Pantry' },
  { id: 'flour', name: 'Maida Flour', unit: 'kg', price: 45, prev: 45, cat: 'Pantry' },
  { id: 'rice', name: 'Basmati Rice', unit: 'kg', price: 140, prev: 135, cat: 'Pantry' },
  { id: 'urad', name: 'Urad Dal', unit: 'kg', price: 130, prev: 125, cat: 'Pantry' },
  { id: 'noodles', name: 'Hakka Noodles', unit: 'kg', price: 120, prev: 115, cat: 'Pantry' },
  { id: 'pasta', name: 'Penne Pasta', unit: 'kg', price: 150, prev: 150, cat: 'Pantry' },
  { id: 'oil', name: 'Cooking Oil', unit: 'L', price: 160, prev: 150, cat: 'Pantry' },
  { id: 'mayo', name: 'Mayonnaise', unit: 'kg', price: 200, prev: 200, cat: 'Pantry' },
  { id: 'soy', name: 'Soy Sauce', unit: 'L', price: 140, prev: 140, cat: 'Pantry' },
  { id: 'bun', name: 'Burger Bun', unit: 'pc', price: 18, prev: 17, cat: 'Bakery' },
];

const W = 3; // default wastage %

export const SEED_DISHES: Dish[] = [
  {
    id: 'butter-chicken', name: 'Butter Chicken', cat: 'North Indian', price: 340, servings: 1, wastage: W, units: 180, prevUnits: 165,
    desc: 'Creamy tomato-butter chicken',
    recipe: [
      { ing: 'chick', qty: 250, unit: 'g' }, { ing: 'butter', qty: 40, unit: 'g' }, { ing: 'cream', qty: 60, unit: 'ml' },
      { ing: 'tomato', qty: 150, unit: 'g' }, { ing: 'onion', qty: 50, unit: 'g' }, { ing: 'garam', qty: 8, unit: 'g' }, { ing: 'oil', qty: 20, unit: 'ml' },
    ],
  },
  {
    id: 'paneer-tikka', name: 'Paneer Tikka', cat: 'Starters', price: 280, servings: 1, wastage: W, units: 175, prevUnits: 160,
    desc: 'Char-grilled paneer with spices',
    recipe: [
      { ing: 'paneer', qty: 200, unit: 'g' }, { ing: 'yogurt', qty: 50, unit: 'g' }, { ing: 'garam', qty: 8, unit: 'g' },
      { ing: 'veg', qty: 60, unit: 'g' }, { ing: 'oil', qty: 15, unit: 'ml' },
    ],
  },
  {
    id: 'chicken-tikka', name: 'Chicken Tikka', cat: 'Starters', price: 300, servings: 1, wastage: W, units: 175, prevUnits: 150,
    desc: 'Smoky tandoor-grilled chicken',
    recipe: [
      { ing: 'chick', qty: 220, unit: 'g' }, { ing: 'yogurt', qty: 40, unit: 'g' }, { ing: 'garam', qty: 8, unit: 'g' },
      { ing: 'ginger', qty: 10, unit: 'g' }, { ing: 'garlic', qty: 10, unit: 'g' }, { ing: 'oil', qty: 15, unit: 'ml' },
    ],
  },
  {
    id: 'dal-makhani', name: 'Dal Makhani', cat: 'North Indian', price: 220, servings: 1, wastage: W, units: 190, prevUnits: 175,
    desc: 'Slow-cooked black lentils',
    recipe: [
      { ing: 'urad', qty: 120, unit: 'g' }, { ing: 'butter', qty: 30, unit: 'g' }, { ing: 'cream', qty: 40, unit: 'ml' },
      { ing: 'tomato', qty: 80, unit: 'g' }, { ing: 'garam', qty: 5, unit: 'g' }, { ing: 'onion', qty: 30, unit: 'g' },
    ],
  },
  {
    id: 'chicken-biryani', name: 'Chicken Biryani', cat: 'North Indian', price: 260, servings: 1, wastage: W, units: 185, prevUnits: 168,
    desc: 'Layered basmati with chicken',
    recipe: [
      { ing: 'rice', qty: 150, unit: 'g' }, { ing: 'chick', qty: 150, unit: 'g' }, { ing: 'yogurt', qty: 50, unit: 'g' },
      { ing: 'garam', qty: 6, unit: 'g' }, { ing: 'oil', qty: 25, unit: 'ml' }, { ing: 'onion', qty: 60, unit: 'g' },
    ],
  },
  {
    id: 'veg-biryani', name: 'Veg Biryani', cat: 'North Indian', price: 200, servings: 1, wastage: W, units: 125, prevUnits: 115,
    desc: 'Fragrant rice with vegetables',
    recipe: [
      { ing: 'rice', qty: 150, unit: 'g' }, { ing: 'veg', qty: 120, unit: 'g' }, { ing: 'oil', qty: 25, unit: 'ml' },
      { ing: 'garam', qty: 6, unit: 'g' }, { ing: 'yogurt', qty: 40, unit: 'g' }, { ing: 'onion', qty: 50, unit: 'g' },
    ],
  },
  {
    id: 'chicken-burger', name: 'Chicken Burger', cat: 'Café Bites', price: 180, servings: 1, wastage: W, units: 265, prevUnits: 250,
    desc: 'Crispy chicken patty burger',
    recipe: [
      { ing: 'chick', qty: 180, unit: 'g' }, { ing: 'bun', qty: 1, unit: 'pc' }, { ing: 'cheese', qty: 20, unit: 'g' },
      { ing: 'veg', qty: 40, unit: 'g' }, { ing: 'mayo', qty: 30, unit: 'g' }, { ing: 'oil', qty: 20, unit: 'ml' },
    ],
  },
  {
    id: 'veg-burger', name: 'Veg Burger', cat: 'Café Bites', price: 140, servings: 1, wastage: W, units: 210, prevUnits: 205,
    desc: 'Crispy aloo patty burger',
    recipe: [
      { ing: 'potato', qty: 150, unit: 'g' }, { ing: 'flour', qty: 20, unit: 'g' }, { ing: 'bun', qty: 1, unit: 'pc' },
      { ing: 'veg', qty: 40, unit: 'g' }, { ing: 'mayo', qty: 30, unit: 'g' }, { ing: 'oil', qty: 15, unit: 'ml' },
    ],
  },
  {
    id: 'veg-momos', name: 'Veg Momos', cat: 'Café Bites', price: 120, servings: 1, wastage: W, units: 240, prevUnits: 230,
    desc: 'Steamed dumplings, chutney',
    recipe: [
      { ing: 'flour', qty: 80, unit: 'g' }, { ing: 'veg', qty: 100, unit: 'g' }, { ing: 'oil', qty: 10, unit: 'ml' },
      { ing: 'garam', qty: 4, unit: 'g' }, { ing: 'soy', qty: 20, unit: 'ml' },
    ],
  },
  {
    id: 'hakka-noodles', name: 'Hakka Noodles', cat: 'Café Bites', price: 160, servings: 1, wastage: W, units: 185, prevUnits: 170,
    desc: 'Wok-tossed noodles, veggies',
    recipe: [
      { ing: 'noodles', qty: 120, unit: 'g' }, { ing: 'veg', qty: 80, unit: 'g' }, { ing: 'oil', qty: 20, unit: 'ml' },
      { ing: 'soy', qty: 40, unit: 'ml' }, { ing: 'garam', qty: 2, unit: 'g' },
    ],
  },
  {
    id: 'margherita-pizza', name: 'Margherita Pizza', cat: 'Pizza', price: 300, servings: 1, wastage: W, units: 78, prevUnits: 70,
    desc: 'Classic mozzarella & tomato',
    recipe: [
      { ing: 'flour', qty: 150, unit: 'g' }, { ing: 'cheese', qty: 80, unit: 'g' }, { ing: 'tomato', qty: 100, unit: 'g' },
      { ing: 'herbs', qty: 5, unit: 'g' }, { ing: 'oil', qty: 10, unit: 'ml' },
    ],
  },
  {
    id: 'paneer-pizza', name: 'Paneer Pizza', cat: 'Pizza', price: 340, servings: 1, wastage: W, units: 58, prevUnits: 60,
    desc: 'Tandoori paneer & mozzarella',
    recipe: [
      { ing: 'flour', qty: 150, unit: 'g' }, { ing: 'paneer', qty: 80, unit: 'g' }, { ing: 'cheese', qty: 60, unit: 'g' },
      { ing: 'tomato', qty: 60, unit: 'g' }, { ing: 'veg', qty: 50, unit: 'g' },
    ],
  },
  {
    id: 'farm-veg-pizza', name: 'Farm Veg Pizza', cat: 'Pizza', price: 190, servings: 1, wastage: W, units: 45, prevUnits: 55,
    desc: 'Garden vegetables, light cheese',
    recipe: [
      { ing: 'flour', qty: 150, unit: 'g' }, { ing: 'cheese', qty: 40, unit: 'g' }, { ing: 'veg', qty: 100, unit: 'g' }, { ing: 'tomato', qty: 60, unit: 'g' },
    ],
  },
  {
    id: 'alfredo-pasta', name: 'Chicken Alfredo Pasta', cat: 'Continental', price: 300, servings: 1, wastage: W, units: 75, prevUnits: 95,
    desc: 'Creamy alfredo with chicken',
    recipe: [
      { ing: 'pasta', qty: 150, unit: 'g' }, { ing: 'cream', qty: 220, unit: 'ml' }, { ing: 'cheese', qty: 60, unit: 'g' },
      { ing: 'butter', qty: 35, unit: 'g' }, { ing: 'chick', qty: 100, unit: 'g' }, { ing: 'garlic', qty: 10, unit: 'g' }, { ing: 'herbs', qty: 10, unit: 'g' },
    ],
  },
  {
    id: 'mushroom-soup', name: 'Cream of Mushroom Soup', cat: 'Continental', price: 150, servings: 1, wastage: W, units: 60, prevUnits: 70,
    desc: 'Velvety mushroom soup',
    recipe: [
      { ing: 'mushroom', qty: 100, unit: 'g' }, { ing: 'cream', qty: 60, unit: 'ml' }, { ing: 'butter', qty: 15, unit: 'g' },
      { ing: 'flour', qty: 15, unit: 'g' }, { ing: 'milk', qty: 100, unit: 'ml' }, { ing: 'herbs', qty: 5, unit: 'g' },
    ],
  },
  {
    id: 'masala-chai', name: 'Masala Chai', cat: 'Beverages', price: 60, servings: 1, wastage: W, units: 420, prevUnits: 430,
    desc: 'Spiced mountain chai',
    recipe: [
      { ing: 'milk', qty: 150, unit: 'ml' }, { ing: 'tea', qty: 4, unit: 'g' }, { ing: 'sugar', qty: 15, unit: 'g' }, { ing: 'garam', qty: 2, unit: 'g' },
    ],
  },
  {
    id: 'cold-coffee', name: 'Cold Coffee', cat: 'Beverages', price: 120, servings: 1, wastage: W, units: 300, prevUnits: 270,
    desc: 'Blended coffee over ice',
    recipe: [
      { ing: 'milk', qty: 180, unit: 'ml' }, { ing: 'coffee', qty: 8, unit: 'g' }, { ing: 'sugar', qty: 20, unit: 'g' }, { ing: 'cream', qty: 30, unit: 'ml' },
    ],
  },
];

export const DEFAULT_SETTINGS: Settings = {
  restaurant: 'Musafir Cafe',
  location: 'Dehradun, Uttarakhand',
  currency: '₹',
  taxPct: 5,
  foodCostTarget: 35,
  popThreshold: null,
  marginThreshold: null,
};

export function seedData() {
  return {
    dishes: JSON.parse(JSON.stringify(SEED_DISHES)) as Dish[],
    ings: JSON.parse(JSON.stringify(SEED_INGREDIENTS)) as Ingredient[],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export const ING_SYNONYMS: Record<string, string[]> = {
  chick: ['chicken', 'murg', 'murgh'],
  paneer: ['paneer', 'cottage cheese'],
  butter: ['butter', 'makhan'],
  cream: ['cream', 'malai', 'heavy cream'],
  cheese: ['cheese', 'mozzarella'],
  milk: ['milk', 'doodh'],
  yogurt: ['yogurt', 'curd', 'dahi'],
  tomato: ['tomato', 'tomatoes', 'tamatar'],
  onion: ['onion', 'onions', 'pyaaz'],
  potato: ['potato', 'potatoes', 'aloo'],
  veg: ['vegetables', 'veggies', 'mixed vegetables', 'capsicum'],
  mushroom: ['mushroom', 'mushrooms'],
  herbs: ['herbs', 'coriander', 'cilantro', 'basil'],
  garlic: ['garlic', 'lehsun'],
  ginger: ['ginger', 'adrak'],
  garam: ['spices', 'masala', 'garam masala', 'spice'],
  tea: ['tea', 'chai patti'],
  coffee: ['coffee'],
  sugar: ['sugar', 'cheeni'],
  flour: ['flour', 'maida', 'atta'],
  rice: ['rice', 'basmati', 'chawal'],
  urad: ['urad', 'dal', 'lentils', 'black dal'],
  noodles: ['noodles', 'hakka'],
  pasta: ['pasta', 'penne'],
  oil: ['oil', 'cooking oil'],
  mayo: ['mayo', 'mayonnaise'],
  soy: ['soy sauce', 'soya sauce', 'soy'],
  bun: ['bun', 'burger bun', 'bread'],
};
