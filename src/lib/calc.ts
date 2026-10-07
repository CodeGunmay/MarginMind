import { Analyzed, Cls, Dish, Ingredient, RecipeItem, Settings, Totals } from '../types';

export const CLS_META: Record<Cls, { label: string; emoji: string; color: string; bg: string; border: string; hex: string; desc: string }> = {
  star: { label: 'STAR', emoji: '⭐', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', hex: '#059669', desc: 'High popularity · High profitability' },
  plowhorse: { label: 'PLOWHORSE', emoji: '🐴', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', hex: '#d97706', desc: 'High popularity · Low profitability' },
  puzzle: { label: 'PUZZLE', emoji: '❓', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', hex: '#4f46e5', desc: 'Low popularity · High profitability' },
  dog: { label: 'DOG', emoji: '🐶', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', hex: '#e11d48', desc: 'Low popularity · Low profitability' },
};

export function itemCost(it: RecipeItem, ing: Ingredient | undefined): number {
  if (it.fixedCost != null) return it.fixedCost;
  if (!ing) return 0;
  return ing.unit === 'pc' ? it.qty * ing.price : (it.qty / 1000) * ing.price;
}

export function itemCostPrev(it: RecipeItem, ing: Ingredient | undefined): number {
  if (it.fixedCost != null) return it.fixedCost;
  if (!ing) return 0;
  return ing.unit === 'pc' ? it.qty * ing.prev : (it.qty / 1000) * ing.prev;
}

export function recipeCost(dish: Dish, ingMap: Map<string, Ingredient>) {
  const sub = dish.recipe.reduce((s, it) => s + itemCost(it, it.ing ? ingMap.get(it.ing) : undefined), 0);
  const subPrev = dish.recipe.reduce((s, it) => s + itemCostPrev(it, it.ing ? ingMap.get(it.ing) : undefined), 0);
  const w = 1 + (dish.wastage || 0) / 100;
  const total = sub * w;
  const totalPrev = subPrev * w;
  const servings = dish.servings || 1;
  return { sub, subPrev, total, totalPrev, perServing: total / servings, perServingPrev: totalPrev / servings };
}

export function analyze(dishes: Dish[], ings: Ingredient[], settings: Settings) {
  const ingMap = new Map(ings.map((i) => [i.id, i]));
  const pre = dishes.map((d) => {
    const rc = recipeCost(d, ingMap);
    const cost = rc.perServing;
    const prevCost = rc.perServingPrev;
    const cm = d.price - cost;
    const prevCm = d.price - prevCost;
    return {
      ...d,
      cost, prevCost, cm, prevCm,
      fcPct: d.price ? (cost / d.price) * 100 : 0,
      cmPct: d.price ? (cm / d.price) * 100 : 0,
      revenue: d.price * d.units,
      contribution: cm * d.units,
      prevRevenue: d.price * d.prevUnits,
      prevContribution: prevCm * d.prevUnits,
    };
  });
  const n = pre.length || 1;
  const avgUnits = pre.reduce((s, r) => s + r.units, 0) / n;
  const avgCm = pre.reduce((s, r) => s + r.cm, 0) / n;
  const popT = settings.popThreshold ?? avgUnits;
  const marT = settings.marginThreshold ?? avgCm;

  const rows: Analyzed[] = pre.map((r) => {
    const pop: 'high' | 'low' = r.units >= popT ? 'high' : 'low';
    const prof: 'high' | 'low' = r.cm >= marT ? 'high' : 'low';
    const cls: Cls = pop === 'high' && prof === 'high' ? 'star' : pop === 'high' ? 'plowhorse' : prof === 'high' ? 'puzzle' : 'dog';
    return { ...r, pop, prof, cls };
  });

  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const prevRevenue = rows.reduce((s, r) => s + r.prevRevenue, 0);
  const contribution = rows.reduce((s, r) => s + r.contribution, 0);
  const prevContribution = rows.reduce((s, r) => s + r.prevContribution, 0);
  const units = rows.reduce((s, r) => s + r.units, 0);
  const costAll = rows.reduce((s, r) => s + r.cost * r.units, 0);
  const costAllPrev = rows.reduce((s, r) => s + r.prevCost * r.prevUnits, 0);

  const totals: Totals = {
    revenue, prevRevenue, contribution, prevContribution, units,
    avgFC: revenue ? (costAll / revenue) * 100 : 0,
    prevAvgFC: prevRevenue ? (costAllPrev / prevRevenue) * 100 : 0,
    avgCmPct: revenue ? (contribution / revenue) * 100 : 0,
    avgCm, avgUnits,
  };

  return { rows, ingMap, popT, marT, avgCm, avgUnits, totals };
}

/* ---------- deterministic sales trends ---------- */
function hash(s: string): number {
  let h = 9;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 387420489);
  return h >>> 0;
}
function rng(seed: number) {
  return function () {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface TrendPoint { date: string; label: string; units: number; revenue: number; contribution: number; }

export function trendFor(dish: { id: string; units: number; price: number }, cm: number, days: number): TrendPoint[] {
  const rand = rng(hash(dish.id));
  const weekly = [0.72, 0.8, 0.88, 1.02, 1.28, 1.42, 1.05]; // Mon..Sun
  const base = dish.units / 30;
  const out: TrendPoint[] = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dow = (d.getDay() + 6) % 7;
    const drift = 1 + ((days - 1 - i) / days) * 0.06;
    const noise = 0.8 + rand() * 0.4;
    const u = Math.max(0, Math.round(base * weekly[dow] * noise * drift));
    out.push({
      date: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      units: u, revenue: u * dish.price, contribution: u * cm,
    });
  }
  return out;
}

/* ---------- CSV export ---------- */
export function downloadCsv(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
