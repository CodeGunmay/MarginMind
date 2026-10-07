import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Pencil, TrendingUp, TrendingDown, Minus, ChevronDown, ArrowRight } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Card, CardHeader, EmptyState } from '../components/ui';

export default function Ingredients() {
  const { ings, analyzed, money, updateIngredient } = useApp();
  const nav = useNavigate();
  const [editId, setEditId] = useState<string | null>(null);
  const [priceVal, setPriceVal] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const usage = useMemo(() => {
    const m = new Map<string, any[]>();
    ings.forEach((ing) => {
      const arr: any[] = [];
      analyzed.rows.forEach((d) => {
        const it = d.recipe.find((r) => r.ing === ing.id);
        if (!it) return;
        const perUnit = ing.unit === 'pc' ? it.qty * (ing.price - ing.prev) : (it.qty / 1000) * (ing.price - ing.prev);
        const share = ing.unit === 'pc' ? it.qty * ing.price : (it.qty / 1000) * ing.price;
        arr.push({ dish: d, perUnit, impact: perUnit * d.units, share });
      });
      m.set(ing.id, arr);
    });
    return m;
  }, [ings, analyzed.rows]);

  if (!analyzed.rows.length) return <EmptyState title="No ingredient data" hint="Enable Demo Mode to load the pantry of Musafir Cafe." />;

  const risers = ings.filter((i) => i.prev && ((i.price - i.prev) / i.prev) * 100 >= 5);

  return (
    <div className="space-y-4">
      {risers.length > 0 && (
        <Card className="border-amber-300/70 bg-amber-50/60 p-4 flex items-start gap-3 anim-fade-up">
          <TrendingUp size={18} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-[13px] text-amber-900">
            <b>{risers.length} ingredient price{risers.length > 1 ? 's' : ''} moved ≥5%</b> — {risers.map((r) => r.name).join(', ')}.
            Affected recipes were recalculated automatically; expand any row to see dish-level margin impact.
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Ingredient Costs" subtitle="Edit a price — every affected dish, margin and classification updates instantly." />
        <div className="overflow-x-auto">
          <table className="w-full text-[13px] min-w-[860px]">
            <thead>
              <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-slate-500">
                <th className="px-5 py-2.5 font-semibold">Ingredient</th>
                <th className="px-4 py-2.5 font-semibold text-right">Current Price</th>
                <th className="px-4 py-2.5 font-semibold text-right">Previous</th>
                <th className="px-4 py-2.5 font-semibold text-right">Change</th>
                <th className="px-4 py-2.5 font-semibold text-right">Used In</th>
                <th className="px-4 py-2.5 font-semibold text-right">Cost Impact / mo</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-5 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {ings.map((ing) => {
                const chg = ing.prev ? ((ing.price - ing.prev) / ing.prev) * 100 : 0;
                const used = usage.get(ing.id) || [];
                const impact = used.reduce((s, u) => s + u.impact, 0);
                const status = chg >= 8 ? { l: 'High impact', c: 'bg-rose-50 text-rose-700 border-rose-200' }
                  : chg >= 4 ? { l: 'Watch', c: 'bg-amber-50 text-amber-700 border-amber-200' }
                  : chg <= -4 ? { l: 'Cheaper', c: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
                  : { l: 'Stable', c: 'bg-slate-100 text-slate-500 border-slate-200' };
                const open = openId === ing.id;
                return (
                  <React.Fragment key={ing.id}>
                    <tr className={`border-b border-slate-50 ${open ? 'bg-amber-50/40' : 'hover:bg-slate-50/60'}`}>
                      <td className="px-5 py-3">
                        <div className="font-semibold text-slate-800">{ing.name}</div>
                        <div className="text-[11px] text-slate-400">{ing.cat}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {editId === ing.id ? (
                          <div className="inline-flex items-center gap-1">
                            <input autoFocus type="number" min={0} value={priceVal} onChange={(e) => setPriceVal(e.target.value)} className="w-20 rounded-lg border border-amber-300 px-2 py-1 outline-none text-right" />
                            <button onClick={() => { if (Number(priceVal) > 0) updateIngredient(ing.id, Number(priceVal)); setEditId(null); }} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={14} /></button>
                            <button onClick={() => setEditId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={14} /></button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditId(ing.id); setPriceVal(String(ing.price)); }} className="inline-flex items-center gap-1 font-medium hover:text-amber-700" title="Edit price">
                            {money(ing.price)}/{ing.unit} <Pencil size={11} className="text-slate-400" />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500">{money(ing.prev)}/{ing.unit}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${chg > 0.5 ? 'text-rose-600' : chg < -0.5 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        <span className="inline-flex items-center gap-0.5 justify-end">
                          {chg > 0.5 ? <TrendingUp size={13} /> : chg < -0.5 ? <TrendingDown size={13} /> : <Minus size={13} />}
                          {chg >= 0 ? '+' : ''}{chg.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{used.length} dish{used.length === 1 ? '' : 'es'}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${impact > 1 ? 'text-rose-600' : impact < -1 ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {Math.abs(impact) > 1 ? `${impact > 0 ? '−' : '+'}${money(Math.abs(Math.round(impact)))}` : '—'}
                      </td>
                      <td className="px-4 py-3"><span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${status.c}`}>{status.l}</span></td>
                      <td className="px-5 py-3 text-right">
                        <button onClick={() => setOpenId(open ? null : ing.id)} className={`p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} aria-label="Show affected dishes">
                          <ChevronDown size={15} />
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <tr className="border-b border-slate-100 bg-amber-50/30">
                        <td colSpan={8} className="px-6 py-4 anim-fade-in">
                          <div className="text-[12px] font-semibold text-slate-700 mb-2">
                            Affected dishes — {ing.name} {chg >= 0 ? '+' : ''}{chg.toFixed(1)}%
                          </div>
                          {used.length === 0 ? (
                            <div className="text-[12px] text-slate-400">No dish currently uses this ingredient.</div>
                          ) : (
                            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
                              {used.sort((a: any, b: any) => b.impact - a.impact).map((u: any) => (
                                <button key={u.dish.id} onClick={() => nav(`/dish/${u.dish.id}`)} className="text-left rounded-xl bg-white border border-slate-200 hover:border-amber-300 p-3 transition-colors group">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-[13px] text-slate-800">{u.dish.name}</span>
                                    <ArrowRight size={13} className="text-slate-300 group-hover:text-amber-500" />
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-1">
                                    {u.perUnit >= 0 ? '−' : '+'}{money(Math.abs(u.perUnit))}/plate · new food cost {u.dish.fcPct.toFixed(1)}%
                                  </div>
                                  <div className={`text-[11px] font-semibold mt-0.5 ${u.impact > 1 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    ≈ {u.impact >= 0 ? '−' : '+'}{money(Math.abs(Math.round(u.impact)))} margin / mo
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
