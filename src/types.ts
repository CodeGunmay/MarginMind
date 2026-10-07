export type Cls = 'star' | 'plowhorse' | 'puzzle' | 'dog';

export interface Ingredient {
  id: string;
  name: string;
  unit: 'kg' | 'L' | 'pc';
  price: number;      // price per base unit (kg / L / pc)
  prev: number;       // previous price per base unit
  cat: string;
}

export interface RecipeItem {
  ing?: string;        // ingredient id (undefined for custom lumpsum rows)
  qty: number;         // quantity in g / ml / pc
  unit: 'g' | 'ml' | 'pc';
  name?: string;       // custom ingredient display name
  fixedCost?: number;  // custom lumpsum cost (overrides computed)
}

export interface Dish {
  id: string;
  name: string;
  cat: string;
  price: number;       // selling price per serving
  servings: number;    // servings this recipe batch yields
  wastage: number;     // wastage %
  recipe: RecipeItem[];
  units: number;       // units sold this month
  prevUnits: number;   // units sold last month
  desc: string;
}

export interface Settings {
  restaurant: string;
  location: string;
  currency: string;
  taxPct: number;
  foodCostTarget: number;
  popThreshold: number | null;    // null = auto (menu average)
  marginThreshold: number | null; // null = auto (menu average)
}

export interface Analyzed extends Dish {
  cost: number;            // ingredient cost per serving (incl wastage)
  prevCost: number;
  fcPct: number;           // food cost %
  cm: number;              // contribution margin / unit
  prevCm: number;
  cmPct: number;           // contribution margin %
  revenue: number;
  contribution: number;
  prevRevenue: number;
  prevContribution: number;
  pop: 'high' | 'low';
  prof: 'high' | 'low';
  cls: Cls;
}

export interface Totals {
  revenue: number;
  prevRevenue: number;
  contribution: number;
  prevContribution: number;
  units: number;
  avgFC: number;
  prevAvgFC: number;
  avgCmPct: number;
  avgCm: number;
  avgUnits: number;
}

export interface Rec {
  id: string;
  type: 'pricing' | 'recipe' | 'promotion' | 'placement' | 'ingredient' | 'removal';
  dishId?: string;
  dish?: string;
  title: string;
  problem: string;
  evidence: string[];
  action: string;
  impact: number;          // estimated monthly contribution impact (₹)
  impactText: string;
  severity: 'high' | 'medium' | 'low';
  apply?: { price: number };
}

export interface Leak {
  id: string;
  severity: 'high' | 'medium' | 'low';
  dishId?: string;
  title: string;
  problem: string;
  impact: number;
  action: string;
}

export interface Ctx {
  rows: Analyzed[];
  ingMap: Map<string, Ingredient>;
  ings: Ingredient[];
  settings: Settings;
  popT: number;
  marT: number;
  avgCm: number;
  avgUnits: number;
  totals: Totals;
}
