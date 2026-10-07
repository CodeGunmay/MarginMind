import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { Dish, Ingredient, Settings } from '../types';
import { seedData } from '../data/seed';
import { analyze } from '../lib/calc';
import { recommendations, profitLeaks, optimizePlan, alertsFor } from '../lib/ai';
import { money, moneyShort } from '../lib/format';

interface Toast { id: number; msg: string; type: 'success' | 'info' | 'error'; }

interface AppState {
  dishes: Dish[];
  ings: Ingredient[];
  settings: Settings;
  demoMode: boolean;
  range: 7 | 30 | 90;
  setRange: (r: 7 | 30 | 90) => void;
  analyzed: ReturnType<typeof analyze>;
  recs: ReturnType<typeof recommendations>;
  leaks: ReturnType<typeof profitLeaks>;
  plan: ReturnType<typeof optimizePlan>;
  alerts: ReturnType<typeof alertsFor>;
  toasts: Toast[];
  toast: (msg: string, type?: Toast['type']) => void;
  money: (n: number) => string;
  moneyShort: (n: number) => string;
  updateIngredient: (id: string, price: number) => void;
  upsertDish: (d: Dish) => void;
  deleteDish: (id: string) => void;
  updateSettings: (patch: Partial<Settings>) => void;
  setDemoMode: (v: boolean) => void;
  resetDemo: () => void;
}

const AppCtx = createContext<AppState>(null as any);
export const useApp = () => useContext(AppCtx);

const seed = seedData();

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [dishes, setDishes] = useState<Dish[]>(seed.dishes);
  const [ings, setIngs] = useState<Ingredient[]>(seed.ings);
  const [settings, setSettings] = useState<Settings>(() => {
    try {
      const saved = localStorage.getItem('mm_settings_v2');
      if (saved) return { ...seed.settings, ...JSON.parse(saved) };
    } catch {}
    return seed.settings;
  });
  const [demoMode, setDemoMode] = useState(true);
  const [range, setRange] = useState<7 | 30 | 90>(30);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const activeDishes = demoMode ? dishes : [];
  const analyzed = useMemo(() => analyze(activeDishes, ings, settings), [activeDishes, ings, settings]);
  const ctxObj = useMemo(() => ({
    rows: analyzed.rows, ingMap: analyzed.ingMap, ings, settings,
    popT: analyzed.popT, marT: analyzed.marT, avgCm: analyzed.avgCm, avgUnits: analyzed.avgUnits, totals: analyzed.totals,
  }), [analyzed, ings, settings]);
  const recs = useMemo(() => recommendations(ctxObj), [ctxObj]);
  const leaks = useMemo(() => profitLeaks(ctxObj), [ctxObj]);
  const plan = useMemo(() => optimizePlan(ctxObj), [ctxObj]);
  const alerts = useMemo(() => alertsFor(ctxObj), [ctxObj]);

  const updateIngredient = useCallback((id: string, price: number) => {
    setIngs((prev) => prev.map((i) => (i.id === id ? { ...i, prev: i.price, price } : i)));
    const affected = dishes.filter((d) => d.recipe.some((r) => r.ing === id)).length;
    toast(`Ingredient price updated — ${affected} dish${affected === 1 ? '' : 'es'} recalculated automatically.`, 'info');
  }, [dishes, toast]);

  const upsertDish = useCallback((d: Dish) => {
    setDishes((prev) => (prev.some((x) => x.id === d.id) ? prev.map((x) => (x.id === d.id ? d : x)) : [...prev, d]));
    toast(`Recipe saved successfully — ${d.name} re-analyzed.`, 'success');
  }, [toast]);

  const deleteDish = useCallback((id: string) => {
    setDishes((prev) => prev.filter((x) => x.id !== id));
    toast('Dish removed from menu analysis.', 'info');
  }, [toast]);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem('mm_settings_v2', JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const resetDemo = useCallback(() => {
    const s = seedData();
    setDishes(s.dishes);
    setIngs(s.ings);
    setSettings(s.settings);
    try { localStorage.removeItem('mm_settings_v2'); } catch {}
    toast('Demo data reset to Musafir Cafe baseline.', 'info');
  }, [toast]);

  const value: AppState = {
    dishes: activeDishes, ings, settings, demoMode, range, setRange,
    analyzed, recs, leaks, plan, alerts, toasts, toast,
    money: (n) => money(n, settings.currency),
    moneyShort: (n) => moneyShort(n, settings.currency),
    updateIngredient, upsertDish, deleteDish, updateSettings, setDemoMode, resetDemo,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}
