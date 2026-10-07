import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, Sparkles, ImagePlus, RefreshCcw, Pencil, Check, X, Loader2 } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Card, CardHeader, EmptyState, ConfirmDialog, AILabel } from '../components/ui';
import { itemCost } from '../lib/calc';
import { ING_SYNONYMS } from '../data/seed';
import { Dish, RecipeItem } from '../types';

const CATS = ['North Indian', 'Starters', 'Café Bites', 'Pizza', 'Continental', 'Beverages', 'Desserts'];

function blankDish(): Dish {
  return { id: `dish-${Date.now()}`, name: '', cat: CATS[0], price: 200, servings: 1, wastage: 3, recipe: [], units: 60, prevUnits: 60, desc: 'New dish' };
}

/* ---- plain-English recipe parser (simulated AI) ---- */
function parseRecipeText(text: string, ings: any[]): { items: RecipeItem[]; unmatched: string[] } {
  const items: RecipeItem[] = [];
  const unmatched: string[] = [];
  const cleaned = text.replace(/₹/g, ' ').replace(/rupees|rs\.?/gi, 'rupee');
  const segments = cleaned.split(/,|;| and |\n/i).map((s) => s.trim()).filter(Boolean);

  for (const segRaw of segments) {
    const seg = segRaw.toLowerCase();
    const lump = seg.match(/worth\s*(?:of\s*)?(\d+(?:\.\d+)?)/);
    if (lump) {
      const name = seg.replace(/worth\s*(?:of\s*)?\d+(?:\.\d+)?\s*rupee?/i, '').trim();
      items.push({ qty: 1, unit: 'pc', name: name ? name[0].toUpperCase() + name.slice(1) : 'Misc', fixedCost: Number(lump[1]) });
      continue;
    }
    const m = seg.match(/([a-zA-Z ()'-]+?)\s*(\d+(?:\.\d+)?)\s*(kilograms?|kgs?|grams?|gms?|g|litres?|liters?|ltr|l|ml|cups?|pieces?|pcs?|pc)\b/);
    if (!m) { if (seg.length > 2) unmatched.push(segRaw); continue; }
    const name = m[1].trim();
    let qty = Number(m[2]);
    let unitStr = m[3].toLowerCase();
    let unit: 'g' | 'ml' | 'pc' = 'g';
    if (/^(kilogram|kg)/.test(unitStr)) { unit = 'g'; qty *= 1000; }
    else if (/^(litre|liter|ltr|l)$/.test(unitStr)) { unit = 'ml'; qty *= 1000; }
    else if (/^ml/.test(unitStr)) unit = 'ml';
    else if (/^(cup|piece|pcs?|pc)/.test(unitStr)) { unit = 'pc'; if (/^cup/.test(unitStr)) { unit = 'g'; qty *= 100; } }

    const found = ings.find((i) => {
      const syn = ING_SYNONYMS[i.id] || [i.name.toLowerCase()];
      return syn.some((s) => name.includes(s) || s.includes(name));
    });
    if (found) {
      const nat = found.unit === 'pc' ? 'pc' : found.unit === 'L' ? 'ml' : 'g';
      items.push({ ing: found.id, qty, unit: nat as any });
    } else {
      items.push({ qty, unit, name: name[0].toUpperCase() + name.slice(1), fixedCost: Math.max(2, Math.round(qty * (unit === 'pc' ? 8 : 0.15))) });
    }
  }
  return { items, unmatched };
}

const OCR_SAMPLE: RecipeItem[] = [
  { ing: 'chick', qty: 120, unit: 'g' }, { ing: 'flour', qty: 90, unit: 'g' }, { ing: 'onion', qty: 30, unit: 'g' },
  { ing: 'garam', qty: 4, unit: 'g' }, { ing: 'oil', qty: 12, unit: 'ml' }, { name: 'House chutney', qty: 1, unit: 'pc', fixedCost: 6 },
];

export default function RecipeCosting() {
  const { dishes, ings, settings, money, upsertDish, deleteDish, updateIngredient, toast } = useApp();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [selId, setSelId] = useState<string | null>(params.get('dish') || dishes[0]?.id || null);
  const [draft, setDraft] = useState<Dish | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [aiText, setAiText] = useState('Chicken 250 grams, butter 50 grams, cream 100 ml, tomatoes 150 grams and spices worth 20 rupees.');
  const [parsing, setParsing] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [editPrice, setEditPrice] = useState<number | null>(null);
  const [priceVal, setPriceVal] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = dishes.find((x) => x.id === selId);
    setDraft(d ? JSON.parse(JSON.stringify(d)) : selId === 'new' ? blankDish() : null);
  }, [selId, dishes]);

  useEffect(() => {
    const fromUrl = params.get('dish');
    if (fromUrl && dishes.some((d) => d.id === fromUrl)) setSelId(fromUrl);
  }, [params, dishes]);

  const ingMap = useMemo(() => new Map(ings.map((i) => [i.id, i])), [ings]);

  const calc = useMemo(() => {
    if (!draft) return null;
    const sub = draft.recipe.reduce((s, it) => s + itemCost(it, it.ing ? ingMap.get(it.ing) : undefined), 0);
    const wastAmt = sub * ((draft.wastage || 0) / 100);
    const total = sub + wastAmt;
    const perServing = total / (draft.servings || 1);
    const fc = draft.price ? (perServing / draft.price) * 100 : 0;
    const cm = draft.price - perServing;
    return { sub, wastAmt, total, perServing, fc, cm, cmPct: draft.price ? (cm / draft.price) * 100 : 0 };
  }, [draft, ingMap]);

  if (!dishes.length) return <EmptyState title="No dishes yet" hint="Enable Demo Mode or create a new dish to start costing recipes." />;

  const setR = (idx: number, patch: Partial<RecipeItem>) =>
    setDraft((d) => d && ({ ...d, recipe: d.recipe.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));

  const savePrice = (ingId: string) => {
    const v = Number(priceVal);
    if (v > 0) updateIngredient(ingId, v);
    setEditPrice(null);
  };

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-4 items-start">
      {/* dish list */}
      <Card className="lg:sticky lg:top-0">
        <div className="p-3 border-b border-slate-100">
          <button
            onClick={() => setSelId('new')}
            className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-white text-[13px] font-semibold py-2.5 hover:bg-slate-800"
          >
            <Plus size={15} /> New Dish
          </button>
        </div>
        <div className="max-h-[520px] overflow-y-auto p-2">
          {dishes.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelId(d.id)}
              className={`w-full text-left rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${selId === d.id ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}
            >
              {d.name}
              <span className="block text-[10px] text-slate-400 font-normal">{d.cat}</span>
            </button>
          ))}
        </div>
      </Card>

      {!draft || !calc ? (
        <EmptyState title="Select a dish" hint="Pick a dish on the left or create a new one." />
      ) : (
        <div className="space-y-4">
          {/* Editor */}
          <Card>
            <CardHeader
              title={selId === 'new' ? 'Create dish' : `Edit · ${draft.name}`}
              subtitle="Every value recalculates live."
              right={
                <div className="flex gap-2">
                  {selId !== 'new' && (
                    <button onClick={() => setConfirmDel(true)} className="p-2.5 rounded-xl border border-slate-200 text-rose-500 hover:bg-rose-50" aria-label="Delete dish"><Trash2 size={15} /></button>
                  )}
                  <button
                    onClick={() => {
                      if (!draft.name.trim()) { toast('Give the dish a name first.', 'error'); return; }
                      const newId = selId === 'new' ? draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString(36) : draft.id;
                      upsertDish({ ...draft, id: newId });
                      if (selId === 'new') { setSelId(newId); nav('/costing', { replace: true }); }
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 shadow hover:opacity-95"
                  >
                    <Save size={15} /> Save recipe
                  </button>
                </div>
              }
            />
            <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-3 px-5 pb-4">
              <label className="text-[12px] font-medium text-slate-600">Dish name
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400" placeholder="e.g. Butter Chicken" />
              </label>
              <label className="text-[12px] font-medium text-slate-600">Category
                <select value={draft.cat} onChange={(e) => setDraft({ ...draft, cat: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 bg-white">
                  {CATS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="text-[12px] font-medium text-slate-600">Selling price ({settings.currency})
                <input type="number" min={0} value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400" />
              </label>
              <label className="text-[12px] font-medium text-slate-600">Servings per recipe
                <input type="number" min={1} value={draft.servings} onChange={(e) => setDraft({ ...draft, servings: Math.max(1, Number(e.target.value)) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400" />
              </label>
              <label className="text-[12px] font-medium text-slate-600">Wastage %
                <input type="number" min={0} max={30} value={draft.wastage} onChange={(e) => setDraft({ ...draft, wastage: Number(e.target.value) })} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400" />
              </label>
            </div>

            {/* ingredients table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[720px]">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-slate-500">
                    <th className="px-5 py-2.5 font-semibold w-[30%]">Ingredient</th>
                    <th className="px-4 py-2.5 font-semibold w-[14%]">Qty</th>
                    <th className="px-4 py-2.5 font-semibold">Unit</th>
                    <th className="px-4 py-2.5 font-semibold">Price / base unit</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Cost</th>
                    <th className="px-4 py-2.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {draft.recipe.map((r, i) => {
                    const ing = r.ing ? ingMap.get(r.ing) : undefined;
                    return (
                      <tr key={i} className="border-b border-slate-50">
                        <td className="px-5 py-2">
                          {ing ? (
                            <select value={r.ing} onChange={(e) => setR(i, { ing: e.target.value })} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 bg-white outline-none focus:border-amber-400">
                              {ings.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                          ) : (
                            <input value={r.name || ''} onChange={(e) => setR(i, { name: e.target.value })} placeholder="Custom ingredient" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 outline-none focus:border-amber-400" />
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" min={0} value={r.qty} onChange={(e) => setR(i, { qty: Number(e.target.value) })} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 outline-none focus:border-amber-400" />
                        </td>
                        <td className="px-4 py-2 text-slate-500">{ing ? (ing.unit === 'pc' ? 'pc' : ing.unit === 'L' ? 'ml' : 'g') : r.unit}</td>
                        <td className="px-4 py-2">
                          {ing ? (
                            editPrice === i ? (
                              <div className="flex items-center gap-1">
                                <input autoFocus type="number" value={priceVal} onChange={(e) => setPriceVal(e.target.value)} className="w-20 rounded-lg border border-amber-300 px-2 py-1 outline-none" />
                                <button onClick={() => savePrice(ing.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={14} /></button>
                                <button onClick={() => setEditPrice(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded"><X size={14} /></button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditPrice(i); setPriceVal(String(ing.price)); }} className="inline-flex items-center gap-1 text-slate-600 hover:text-amber-700" title="Edit global price — updates all recipes">
                                {money(ing.price)}/{ing.unit} <Pencil size={11} />
                              </button>
                            )
                          ) : (
                            <input type="number" min={0} value={r.fixedCost ?? 0} onChange={(e) => setR(i, { fixedCost: Number(e.target.value) })} className="w-24 rounded-lg border border-slate-200 px-2 py-1 outline-none focus:border-amber-400" title="Lumpsum cost" />
                          )}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold">{money(itemCost(r, ing))}</td>
                        <td className="px-4 py-2 text-right">
                          <button onClick={() => setDraft({ ...draft, recipe: draft.recipe.filter((_, x) => x !== i) })} className="p-1.5 text-slate-300 hover:text-rose-500" aria-label="Remove ingredient"><Trash2 size={14} /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 flex gap-2">
              <button onClick={() => setDraft({ ...draft, recipe: [...draft.recipe, { ing: ings[0].id, qty: 100, unit: 'g' }] })} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">
                <Plus size={13} /> Add ingredient
              </button>
              <button onClick={() => setDraft({ ...draft, recipe: [...draft.recipe, { qty: 1, unit: 'pc', name: 'Custom item', fixedCost: 10 }] })} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">
                <Plus size={13} /> Add custom / lumpsum
              </button>
            </div>
          </Card>

          {/* live totals */}
          <Card className="bg-slate-900 text-white border-slate-800">
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-3 p-5">
              {[
                { l: 'Ingredient subtotal', v: money(calc.sub) },
                { l: `Wastage (${draft.wastage}%)`, v: money(calc.wastAmt) },
                { l: 'Total recipe cost', v: money(calc.total) },
                { l: 'Cost / serving', v: money(calc.perServing) },
                { l: 'Selling price', v: money(draft.price) },
                { l: 'Food Cost %', v: `${calc.fc.toFixed(1)}%`, tone: calc.fc > settings.foodCostTarget ? 'text-rose-400' : 'text-emerald-400' },
                { l: 'Contribution', v: money(calc.cm), tone: 'text-emerald-400' },
                { l: 'Margin %', v: `${calc.cmPct.toFixed(1)}%`, tone: 'text-emerald-400' },
              ].map((x) => (
                <div key={x.l}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{x.l}</div>
                  <div className={`text-lg font-bold mt-0.5 tracking-tight ${x.tone || ''}`}>{x.v}</div>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4">
              <div className="h-2 rounded-full bg-slate-700 overflow-hidden">
                <div className={`h-full rounded-full transition-all ${calc.fc > settings.foodCostTarget ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, (calc.fc / (settings.foodCostTarget * 2)) * 100)}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0%</span><span>Food-cost target {settings.foodCostTarget}%</span><span>{settings.foodCostTarget * 2}%</span>
              </div>
            </div>
          </Card>

          {/* AI extraction */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="border-amber-200/70">
              <CardHeader title={<span className="flex items-center gap-2">Describe your recipe <AILabel /></span>} subtitle="Paste plain-English text — the simulated extractor structures it." />
              <div className="p-5 pt-2 space-y-3">
                <textarea
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-400 resize-none"
                  placeholder="e.g. Paneer 200 grams, yogurt 50 grams, spices worth 12 rupees"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setParsing(true);
                      setTimeout(() => {
                        const { items, unmatched } = parseRecipeText(aiText, ings);
                        if (items.length) {
                          setDraft({ ...draft, recipe: items });
                          toast(`Extracted ${items.length} ingredients${unmatched.length ? ` · ${unmatched.length} unrecognized` : ''} (demo parser).`, 'info');
                        } else toast('No ingredients recognized — try quantities like "250 grams".', 'error');
                        setParsing(false);
                      }, 900);
                    }}
                    disabled={parsing}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 shadow hover:opacity-95 disabled:opacity-60"
                  >
                    {parsing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Extract Ingredients with AI
                  </button>
                  <button onClick={() => setAiText('')} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-500 hover:bg-slate-50">
                    <RefreshCcw size={12} /> Clear
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">Parsed rows replace the current ingredient table above — edit quantities and prices before saving. Unrecognized items become editable lumpsum rows.</p>
              </div>
            </Card>

            <Card className="border-amber-200/70">
              <CardHeader title={<span className="flex items-center gap-2">Upload recipe image <AILabel /></span>} subtitle="Simulated OCR — no real image processing in demo mode." />
              <div className="p-5 pt-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={() => {
                  setOcrBusy(true);
                  setTimeout(() => {
                    setDraft((d) => d && { ...d, recipe: OCR_SAMPLE });
                    setOcrBusy(false);
                    toast('Demo OCR extracted 6 ingredients from the recipe card.', 'info');
                    if (fileRef.current) fileRef.current.value = '';
                  }, 1600);
                }} />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={ocrBusy}
                  className="w-full rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-50 transition-colors py-10 flex flex-col items-center gap-2 text-amber-700"
                >
                  {ocrBusy ? <Loader2 size={26} className="animate-spin" /> : <ImagePlus size={26} />}
                  <span className="text-[13px] font-semibold">{ocrBusy ? 'Reading recipe card…' : 'Click to upload a photo of a recipe card'}</span>
                  <span className="text-[11px] text-amber-600/80">JPG / PNG · demo will return a sample extraction (chicken momos)</span>
                </button>
              </div>
            </Card>
          </div>

          <ConfirmDialog
            open={confirmDel}
            onCancel={() => setConfirmDel(false)}
            onConfirm={() => { if (draft) { deleteDish(draft.id); setConfirmDel(false); setSelId(dishes.find((x) => x.id !== draft.id)?.id || null); } }}
            title={`Delete ${draft.name}?`}
            body="The dish will be removed from the menu and all analytics. This can be undone by resetting demo data."
          />
        </div>
      )}
    </div>
  );
}
