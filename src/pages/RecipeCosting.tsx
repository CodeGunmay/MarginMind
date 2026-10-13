import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Plus, Trash2, Save, Sparkles, ImagePlus, RefreshCcw, Pencil, Check, X, Loader2, Mic, MicOff, AlertTriangle, CheckCircle2, Lock, PackagePlus } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { api, ExtractedItem } from '../lib/api';
import { Card, CardHeader, EmptyState, ConfirmDialog, AILabel, Modal } from '../components/ui';
import { itemCost, dishWarnings, natUnit } from '../lib/calc';
import { ingredientCost, parseRecipe } from '../lib/recipe';
import { Dish, Ingredient, RecipeItem } from '../types';

const CATS = ['North Indian', 'Starters', 'Café Bites', 'Pizza', 'Continental', 'Beverages', 'Desserts'];

function blankDish(): Dish {
  return { id: `dish-${Date.now()}`, name: '', cat: CATS[0], price: 0, servings: 1, wastage: 3, gasCost: 0, garnishCost: 0, packagingCost: 0, recipe: [], units: 0, prevUnits: 0, desc: 'New dish' };
}

/* ---- local parser fallback (browser, only when backend offline) ---- */
function parseRecipeText(text: string, ings: Ingredient[]): ExtractedItem[] {
  return parseRecipe(text, ings).items;
}

/* ---- Hindi/English voice input (browser SpeechRecognition — real on-device/LWT transcription) ---- */
function VoiceButton({ onText, toast }: { onText: (t: string) => void; toast: (m: string, t?: any) => void }) {
  const [recording, setRecording] = useState(false);
  const [lang, setLang] = useState<'hi-IN' | 'en-IN'>('hi-IN');
  const recRef = useRef<any>(null);
  const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) {
    return <span className="text-[11px] text-slate-400 italic" title="Speech recognition is supported in Chrome/Edge">🎙️ Voice input needs Chrome/Edge</span>;
  }
  const toggle = () => {
    if (recording) { recRef.current?.stop(); setRecording(false); return; }
    const rec = new SR();
    recRef.current = rec;
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';
    rec.onresult = (e: any) => {
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
    };
    rec.onerror = (e: any) => { setRecording(false); toast(`Transcription failed (${e.error}) — try again or type.`, 'error'); };
    rec.onend = () => {
      setRecording(false);
      if (finalText.trim()) { onText(finalText.trim()); } else toast('No speech recognized — try speaking closer to the mic.', 'error');
    };
    rec.start();
    setRecording(true);
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <select value={lang} onChange={(e) => setLang(e.target.value as any)} className="rounded-lg border border-slate-200 text-[11px] px-1.5 py-1.5 bg-white outline-none" title="Transcription language">
        <option value="hi-IN">हिंदी</option>
        <option value="en-IN">English</option>
      </select>
      <button
        onClick={toggle}
        className={`flex items-center gap-1 rounded-lg px-3 py-2 text-[12px] font-semibold border transition-colors ${recording ? 'bg-rose-50 border-rose-300 text-rose-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        title={`Dictate the recipe in ${lang === 'hi-IN' ? 'Hindi' : 'English'} — browser SpeechRecognition`}
      >
        {recording ? <MicOff size={14} className="animate-pulse" /> : <Mic size={14} />} {recording ? 'Stop' : 'Dictate'}
      </button>
    </span>
  );
}

export default function RecipeCosting() {
  const { dishes, ings, settings, money, upsertDish, deleteDish, updateIngredient, addIngredient, toast, connected } = useApp();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [selId, setSelId] = useState<string | null>(params.get('dish') || dishes[0]?.id || null);
  const [draft, setDraft] = useState<Dish | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const [confirmSaveWarn, setConfirmSaveWarn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiText, setAiText] = useState('Chicken 250 grams, butter 50 grams, cream 100 ml, tomatoes 150 grams and spices worth 20 rupees.');
  const [parsing, setParsing] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrPreview, setOcrPreview] = useState<string | null>(null);
  const [review, setReview] = useState<{ items: (ExtractedItem & { confirmed?: boolean })[]; engine: string; warnings: string[]; rawText?: string } | null>(null);
  const [extractErr, setExtractErr] = useState('');
  const [showRaw, setShowRaw] = useState(false);
  const [addIngOpen, setAddIngOpen] = useState(false);
  const [newIng, setNewIng] = useState({ name: '', unit: 'kg' as 'kg' | 'L' | 'pc', price: 0, cat: 'Pantry' });
  const [editPrice, setEditPrice] = useState<number | null>(null);
  const [priceVal, setPriceVal] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const loadedSelection = useRef<string|null|undefined>(undefined);

  useEffect(() => {
    const d = dishes.find((x) => x.id === selId);
    if(selId && selId!=='new' && !d)return;
    if(loadedSelection.current===selId)return;
    loadedSelection.current=selId;
    setDraft(d ? JSON.parse(JSON.stringify(d)) : selId !== null && selId !== 'new' ? null : selId === 'new' ? blankDish() : null);
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
    const perOv = (draft.gasCost || 0) + (draft.garnishCost || 0) + (draft.packagingCost || 0);
    const perServing = total / (draft.servings || 1) + perOv;
    const fc = draft.price ? (perServing / draft.price) * 100 : 0;
    const cm = draft.price - perServing;
    return { sub, wastAmt, total, perOv, perServing, fc, cm, cmPct: draft.price ? (cm / draft.price) * 100 : 0 };
  }, [draft, ingMap]);

  const warnings = useMemo(() => (draft && calc ? dishWarnings(draft, ingMap, calc.perServing) : []), [draft, calc, ingMap]);

  const setR = (idx: number, patch: Partial<RecipeItem>) =>
    setDraft((d) => d && ({ ...d, recipe: d.recipe.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));

  const doSave = async () => {
    if (!draft || saving) return;
    setSaving(true);
    try {
      const id = selId === 'new' ? (draft.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g,'') || 'dish') + '-' + Date.now().toString(36) : draft.id;
      const saved = await upsertDish({ ...draft, id });
      if (!saved) return;
      setSelId(saved.id);
      setDraft(saved);
      nav(`/costing?dish=${encodeURIComponent(saved.id)}`, { replace: true });
      setConfirmSaveWarn(false);
    } catch { /* provider reports the failed save; retain draft for retry */ }
    finally { setSaving(false); }
  };

  const attemptSave = () => {
    if (!draft || !calc) return;
    if (!draft.name.trim()) { toast('Give the dish a name first.', 'error'); return; }
    const hard = warnings.filter((w) => !w.startsWith('No overhead') && !w.startsWith('Contribution negative'));
    if(hard.length){toast('Complete the recipe first: '+hard.join('; '),'error');return;}
    if (warnings.length) { setConfirmSaveWarn(true); return; }
    void hard;
    doSave();
  };

  if (!dishes.length && !draft) {
    return (
      <EmptyState
        title="No dishes yet"
        hint={connected ? 'Your menu is empty. Create the first dish to start costing recipes.' : 'Connect to your restaurant workspace, then create your first dish.'}
        action={<button onClick={() => setSelId('new')} className="rounded-xl bg-slate-900 text-white text-sm font-semibold px-4 py-2.5">Create first dish</button>}
      />
    );
  }

  const inputCls = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 bg-white';

  return (
    <div className="grid lg:grid-cols-[260px_1fr] gap-4 items-start">
      {/* dish list */}
      <Card className="lg:sticky lg:top-0">
        <div className="p-3 border-b border-slate-100">
          <button onClick={() => setSelId('new')} className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-white text-[13px] font-semibold py-2.5 hover:bg-slate-800">
            <Plus size={15} /> New Dish
          </button>
        </div>
        <div className="max-h-[520px] overflow-y-auto p-2">
          {dishes.map((d) => (
            <button key={d.id} onClick={() => setSelId(d.id)} className={`w-full text-left rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors ${selId === d.id ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'text-slate-600 hover:bg-slate-50 border border-transparent'}`}>
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
          <Card>
            <CardHeader
              title={selId === 'new' ? 'Create dish' : `Edit · ${draft.name}`}
              subtitle="Every value recalculates live. Incomplete recipes are flagged, never silently completed."
              right={
                <div className="flex gap-2">
                  {selId !== 'new' && (
                    <button onClick={() => setConfirmDel(true)} className="p-2.5 rounded-xl border border-slate-200 text-rose-500 hover:bg-rose-50" aria-label="Delete dish"><Trash2 size={15} /></button>
                  )}
                  <button onClick={attemptSave} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 shadow hover:opacity-95">
                    <Save size={15} /> Save recipe
                  </button>
                </div>
              }
            />
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3 px-5 pb-4">
              <label className="text-[12px] font-medium text-slate-600">Dish name
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`mt-1 ${inputCls}`} placeholder="e.g. Butter Chicken" />
              </label>
              <label className="text-[12px] font-medium text-slate-600">Category
                <select value={draft.cat} onChange={(e) => setDraft({ ...draft, cat: e.target.value })} className={`mt-1 ${inputCls}`}>
                  {CATS.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="text-[12px] font-medium text-slate-600">Selling price ({settings.currency}) <span className="text-rose-500">*</span>
                <input type="number" min={0} value={draft.price} onChange={(e) => setDraft({ ...draft, price: Number(e.target.value) })} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="text-[12px] font-medium text-slate-600">Yield (portions per recipe)
                <input type="number" min={1} value={draft.servings} onChange={(e) => setDraft({ ...draft, servings: Math.max(1, Number(e.target.value)) })} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="text-[12px] font-medium text-slate-600">Wastage %
                <input type="number" min={0} max={30} value={draft.wastage} onChange={(e) => setDraft({ ...draft, wastage: Number(e.target.value) })} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="text-[12px] font-medium text-slate-600">Gas / energy ({settings.currency}/serving)
                <input type="number" min={0} value={draft.gasCost ?? 0} onChange={(e) => setDraft({ ...draft, gasCost: Number(e.target.value) })} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="text-[12px] font-medium text-slate-600">Garnish ({settings.currency}/serving)
                <input type="number" min={0} value={draft.garnishCost ?? 0} onChange={(e) => setDraft({ ...draft, garnishCost: Number(e.target.value) })} className={`mt-1 ${inputCls}`} />
              </label>
              <label className="text-[12px] font-medium text-slate-600">Packaging ({settings.currency}/serving)
                <input type="number" min={0} value={draft.packagingCost ?? 0} onChange={(e) => setDraft({ ...draft, packagingCost: Number(e.target.value) })} className={`mt-1 ${inputCls}`} />
              </label>
            </div>

            {/* completeness flags */}
            <div className="mx-5 mb-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5" data-testid="recipe-completeness">
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1.5">Recipe completeness</div>
              {warnings.length === 0 ? (
                <div className="flex items-center gap-1.5 text-[12.5px] text-emerald-700 mt-1.5"><CheckCircle2 size={14} /> Complete — ingredients, units, yield, price and overhead costs all recorded.</div>
              ) : (
                <ul className="mt-1.5 space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[12.5px] text-amber-800">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0 text-amber-500" /> {w}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* ingredients table */}
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[760px]">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-slate-500">
                    <th className="px-5 py-2.5 font-semibold w-[28%]">Ingredient</th>
                    <th className="px-4 py-2.5 font-semibold w-[13%]">Qty</th>
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
                            <select value={r.ing} onChange={(e) => setR(i, { ing: e.target.value, unit: natUnit(ingMap.get(e.target.value)!) })} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 bg-white outline-none focus:border-amber-400">
                              {ings.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                            </select>
                          ) : (
                            <input value={r.name || ''} onChange={(e) => setR(i, { name: e.target.value })} placeholder="Custom ingredient" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 outline-none focus:border-amber-400" />
                          )}
                        </td>
                        <td className="px-4 py-2">
                          <input type="number" min={0} value={r.qty} onChange={(e) => setR(i, { qty: Number(e.target.value) })} className="w-full rounded-lg border border-slate-200 px-2 py-1.5 outline-none focus:border-amber-400" />
                        </td>
                        <td className="px-4 py-2 text-slate-500">
                          {ing ? (
                            <span className="inline-flex items-center gap-1 text-slate-500" title={`${ing.name} is priced per ${ing.unit} — quantity is captured in ${r.unit}`}>
                              <Lock size={11} className="text-slate-300" /> {r.unit}
                            </span>
                          ) : (
                            <select value={r.unit} onChange={(e) => setR(i, { unit: e.target.value as any })} className="rounded-lg border border-slate-200 px-1.5 py-1 bg-white outline-none">
                              <option value="g">g</option><option value="ml">ml</option><option value="pc">pc</option>
                            </select>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {ing ? (
                            editPrice === i ? (
                              <div className="flex items-center gap-1">
                                <input autoFocus type="number" value={priceVal} onChange={(e) => setPriceVal(e.target.value)} className="w-20 rounded-lg border border-amber-300 px-2 py-1 outline-none" />
                                <button onClick={() => { const v = Number(priceVal); if (v > 0) updateIngredient(ing.id, v); setEditPrice(null); }} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"><Check size={14} /></button>
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
            <div className="px-5 py-3 flex flex-wrap gap-2">
              {ings.length > 0 && (
                <button onClick={() => setDraft({ ...draft, recipe: [...draft.recipe, { ing: ings[0].id, qty: 100, unit: natUnit(ings[0]) }] })} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">
                  <Plus size={13} /> Add ingredient
                </button>
              )}
              <button onClick={() => setDraft({ ...draft, recipe: [...draft.recipe, { qty: 1, unit: 'pc', name: 'Custom item', fixedCost: 10 }] })} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-600 hover:bg-slate-50">
                <Plus size={13} /> Custom / lumpsum
              </button>
              <button onClick={() => setAddIngOpen(true)} className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 px-3 py-2 text-[12px] font-semibold hover:bg-amber-100">
                <PackagePlus size={13} /> New ingredient (database)
              </button>
            </div>
          </Card>

          {/* live totals */}
          <Card className="bg-slate-900 text-white border-slate-800">
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-9 gap-3 p-5">
              {[
                { l: 'Ingredient subtotal', v: money(calc.sub) },
                { l: `Wastage (${draft.wastage}%)`, v: money(calc.wastAmt) },
                { l: 'Recipe batch cost', v: money(calc.total) },
                { l: 'Overheads/serving', v: money(calc.perOv) },
                { l: 'True cost/serving', v: money(calc.perServing) },
                { l: 'Selling price', v: money(draft.price) },
                { l: 'Food Cost %', v: `${calc.fc.toFixed(1)}%`, tone: calc.fc > settings.foodCostTarget ? 'text-rose-400' : 'text-emerald-400' },
                { l: 'Contribution', v: money(calc.cm), tone: calc.cm < 0 ? 'text-rose-400' : 'text-emerald-400' },
                { l: 'Margin %', v: `${calc.cmPct.toFixed(1)}%`, tone: calc.cm < 0 ? 'text-rose-400' : 'text-emerald-400' },
              ].map((x) => (
                <div key={x.l}>
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{x.l}</div>
                  <div className={`text-lg font-bold mt-0.5 tracking-tight ${x.tone || ''}`}>{x.v}</div>
                </div>
              ))}
            </div>
            {calc.cm < 0 && (
              <div className="mx-5 mb-4 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-[12.5px] font-semibold px-3.5 py-2.5 flex items-center gap-2">
                <AlertTriangle size={15} /> Negative contribution — this dish loses {money(-calc.cm)} on every plate sold.
              </div>
            )}
          </Card>

          {/* AI extraction */}
          <div className="grid lg:grid-cols-2 gap-4">
            <Card className="border-amber-200/70">
              <CardHeader
                title={<span className="flex items-center gap-2">Describe your recipe <AILabel /></span>}
                subtitle={connected ? 'Server-side extraction — ambiguous items require your confirmation before applying.' : 'Backend offline: local parser with confirmation.'}
              />
              <div className="p-5 pt-2 space-y-3">
                <textarea
                  value={aiText}
                  onChange={(e) => setAiText(e.target.value)}
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-400 resize-none"
                  placeholder='e.g. Paneer 200 grams, yogurt 50 grams, spices worth 12 rupees — or dictate it in Hindi 🎙️'
                />
                <div className="flex flex-wrap gap-2 items-center">
                  <button
                    onClick={async () => {
                      setParsing(true);
                      setExtractErr('');
                      if (connected) {
                        try {
                          const res = await api.extractRecipe(aiText);
                          setReview({ ...res, items: res.items.map((i) => ({ ...i, confirmed: !i.needsConfirmation })) });
                        } catch (e: any) {
                          setExtractErr(e.message || 'Extraction failed');
                        }
                        setParsing(false);
                        return;
                      }
                      setTimeout(() => {
                        const items = parseRecipeText(aiText, ings);
                        setReview({ items: items.map((i) => ({ ...i, confirmed: !i.needsConfirmation })), engine: 'rules (browser)', warnings: ['Local parser — backend unavailable', ...parseRecipe(aiText, ings).warnings] });
                        setParsing(false);
                      }, 500);
                    }}
                    disabled={parsing || !aiText.trim()}
                    className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 shadow hover:opacity-95 disabled:opacity-60"
                  >
                    {parsing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Extract Ingredients with AI
                  </button>
                  <VoiceButton toast={toast} onText={(t) => setAiText((prev) => (prev ? prev + ', ' : '') + t)} />
                  <button onClick={() => setAiText('')} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-500 hover:bg-slate-50">
                    <RefreshCcw size={12} /> Clear
                  </button>
                </div>
                {extractErr && <p className="text-[12px] text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-2.5 py-1.5">⚠️ {extractErr}</p>}
                <p className="text-[11px] text-slate-400">Ambiguous quantities and unmatched ingredients must be explicitly confirmed in the review step — nothing is silently invented. Dictation uses your browser's SpeechRecognition ({`hi-IN/en-IN`}), no audio leaves the device except to the browser's speech service.</p>
              </div>
            </Card>

            <Card className="border-amber-200/70">
              <CardHeader title={<span className="flex items-center gap-2">Upload recipe image <AILabel /></span>} subtitle={connected ? 'Real OCR (tesseract.js on the server) → review & confirm every item.' : 'Requires the backend (OCR runs server-side).'} />
              <div className="p-5 pt-2">
                <input
                  ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (!connected) { toast('Image extraction needs the backend — start it with `npm run server`.', 'error'); return; }
                    if (f.size > 6 * 1024 * 1024) { toast('Image too large — keep under 6MB.', 'error'); return; }
                    const reader = new FileReader();
                    reader.onload = async () => {
                      const dataUrl = String(reader.result);
                      setOcrPreview(dataUrl);
                      setOcrBusy(true);
                      setExtractErr('');
                      try {
                        const res = await api.extractImage(dataUrl);
                        setReview({ ...res, items: res.items.map((i) => ({ ...i, confirmed: false })) });
                      } catch (err: any) {
                        setExtractErr(err.message || 'OCR failed');
                      } finally {
                        setOcrBusy(false);
                        if (fileRef.current) fileRef.current.value = '';
                      }
                    };
                    reader.readAsDataURL(f);
                  }}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={ocrBusy || !connected}
                  className="w-full rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-50 transition-colors py-8 flex flex-col items-center gap-2 text-amber-700 disabled:opacity-60"
                >
                  {ocrBusy ? <Loader2 size={26} className="animate-spin" /> : ocrPreview ? <img src={ocrPreview} alt="uploaded" className="max-h-24 rounded-lg" /> : <ImagePlus size={26} />}
                  <span className="text-[13px] font-semibold">{ocrBusy ? 'Running OCR on the server…' : 'Click to upload a photo of a recipe card'}</span>
                  <span className="text-[11px] text-amber-600/80">{connected ? 'JPG/PNG ≤6MB · real tesseract.js OCR · every extracted item needs confirmation' : 'Backend offline — OCR unavailable'}</span>
                </button>
                {ocrPreview && !ocrBusy && !review && <img src={ocrPreview} alt="" className="hidden" />}
              </div>
            </Card>
          </div>

          {/* review & confirm extracted items */}
          <Modal open={!!review} onClose={() => setReview(null)} title={<span className="flex items-center gap-2">Review & confirm extracted ingredients <AILabel /></span>} wide>
            {review && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 text-[12px] text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold">engine: {review.engine}</span>
                  <span className="font-semibold text-amber-700">{review.items.filter((i) => !i.confirmed).length} of {review.items.length} items still need confirmation</span>
                </div>
                {review.warnings.length > 0 && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2.5 text-[12px] text-amber-800 space-y-0.5">
                    {review.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
                  </div>
                )}
                {review.rawText && (
                  <div>
                    <button onClick={() => setShowRaw((v) => !v)} className="text-[12px] font-semibold text-amber-700 hover:text-amber-800">{showRaw ? 'Hide' : 'Show'} raw OCR text</button>
                    {showRaw && <pre className="mt-2 whitespace-pre-wrap text-[11.5px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl p-3 max-h-40 overflow-y-auto">{review.rawText}</pre>}
                  </div>
                )}
                <div className="overflow-x-auto max-h-[45vh] overflow-y-auto rounded-xl border border-slate-200">
                  <table className="w-full text-[13px] min-w-[720px]">
                    <thead className="sticky top-0 bg-slate-50 text-left text-slate-500">
                      <tr>
                        <th className="px-4 py-2.5 font-semibold">Extracted</th>
                        <th className="px-4 py-2.5 font-semibold">Match</th>
                        <th className="px-4 py-2.5 font-semibold w-24">Qty</th>
                        <th className="px-4 py-2.5 font-semibold w-14">Unit</th>
                        <th className="px-4 py-2.5 font-semibold text-right">Est. cost</th>
                        <th className="px-4 py-2.5 font-semibold">Confidence</th>
                        <th className="px-4 py-2.5 font-semibold text-center">Confirm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {review.items.map((it, i) => (
                        <tr key={i} className={`border-t border-slate-100 ${!it.confirmed ? 'bg-amber-50/50' : ''}`}>
                          <td className="px-4 py-2.5 font-medium text-slate-800">
                            {it.name}
                            {it.note && <div className="text-[10px] text-amber-600 font-normal">{it.note}</div>}
                          </td>
                          <td className="px-4 py-2.5">
                            <select aria-label={`Ingredient match for ${it.name}`} value={it.ingredientId || ''} onChange={e => { const ing=ings.find(x=>x.id===e.target.value); setReview({...review,items:review.items.map((x,xi)=>xi===i?{...x,ingredientId:ing?.id || null,unit:ing?natUnit(ing):x.unit,estimatedCost:ing?ingredientCost(x.qty,ing):null,confirmed:false}:x)}); }} className="max-w-40 border rounded p-1"><option value="">Custom: enter cost</option>{ings.map(ing=><option key={ing.id} value={ing.id}>{ing.name}</option>)}</select>
                          </td>
                          <td className="px-4 py-2.5">
                            <input
                              type="number" min={0} value={it.qty}
                              onChange={(e) => setReview({ ...review, items: review.items.map((x, xi) => (xi === i ? { ...x, qty: Number(e.target.value), confirmed:false, estimatedCost:x.ingredientId?ingredientCost(Number(e.target.value),ings.find(g=>g.id===x.ingredientId)!):x.estimatedCost } : x)) })}
                              className="w-20 rounded-lg border border-slate-200 px-2 py-1 outline-none focus:border-amber-400"
                            />
                          </td>
                          <td className="px-4 py-2.5"><select aria-label={`Unit for ${it.name}`} value={it.unit} onChange={e=>setReview({...review,items:review.items.map((x,xi)=>xi===i?{...x,unit:e.target.value as 'g'|'ml'|'pc',confirmed:false}:x)})}>{['g','ml','pc'].map(u=><option key={u}>{u}</option>)}</select></td>
                          <td className="px-4 py-2.5 text-right">{it.ingredientId ? (it.estimatedCost != null ? money(it.estimatedCost) : '—') : <input aria-label={`Cost for ${it.name}`} type="number" min="0" step="0.01" value={it.estimatedCost ?? ''} onChange={e=>setReview({...review,items:review.items.map((x,xi)=>xi===i?{...x,estimatedCost:e.target.value===''?null:Number(e.target.value),confirmed:false}:x)})} className="w-20 border rounded p-1" />}</td>
                          <td className="px-4 py-2.5">
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${it.confidence === 'high' ? 'bg-emerald-100 text-emerald-700' : it.confidence === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                              {it.confidence.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-center">
                            <input
                              type="checkbox" checked={!!it.confirmed} disabled={it.qty<=0 || it.estimatedCost==null || !Number.isFinite(it.estimatedCost) || it.estimatedCost<0 || (!!it.ingredientId && (it.unit!==natUnit(ings.find(g=>g.id===it.ingredientId)!) || it.estimatedCost<=0))}
                              onChange={(e) => setReview({ ...review, items: review.items.map((x, xi) => (xi === i ? { ...x, confirmed: e.target.checked } : x)) })}
                              className="w-4 h-4 accent-amber-500"
                              aria-label={`confirm ${it.name}`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setReview(null)} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50">Cancel</button>
                  <button
                    disabled={review.items.some((i) => !i.confirmed)}
                    onClick={() => {
                      const items: RecipeItem[] = review.items.map((it) =>
                        it.ingredientId
                          ? { ing: it.ingredientId, qty: it.qty, unit: it.unit }
                          : { qty: it.qty, unit: it.unit, name: it.name, fixedCost: Math.max(0, it.estimatedCost ?? 0) }
                      );
                      setDraft((d) => d && { ...d, recipe: items });
                      setReview(null);
                      toast(`Applied ${items.length} confirmed ingredients to the recipe.`, 'success');
                    }}
                    className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow hover:opacity-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={review.items.some((i) => !i.confirmed) ? 'Confirm every item first' : 'Apply to recipe'}
                  >
                    Confirm & apply {review.items.length} items
                  </button>
                </div>
              </div>
            )}
          </Modal>

          {/* add ingredient modal */}
          <Modal open={addIngOpen} onClose={() => setAddIngOpen(false)} title="Add ingredient to database">
            <div className="space-y-3">
              <label className="block text-[12px] font-medium text-slate-600">Name
                <input value={newIng.name} onChange={(e) => setNewIng({ ...newIng, name: e.target.value })} className={`mt-1 ${inputCls}`} placeholder="e.g. Ghee" />
              </label>
              <div className="grid grid-cols-3 gap-3">
                <label className="block text-[12px] font-medium text-slate-600">Priced per
                  <select value={newIng.unit} onChange={(e) => setNewIng({ ...newIng, unit: e.target.value as any })} className={`mt-1 ${inputCls}`}>
                    <option value="kg">kg</option><option value="L">L</option><option value="pc">piece</option>
                  </select>
                </label>
                <label className="block text-[12px] font-medium text-slate-600">Price ({settings.currency})
                  <input type="number" min={0} value={newIng.price} onChange={(e) => setNewIng({ ...newIng, price: Number(e.target.value) })} className={`mt-1 ${inputCls}`} />
                </label>
                <label className="block text-[12px] font-medium text-slate-600">Category
                  <input value={newIng.cat} onChange={(e) => setNewIng({ ...newIng, cat: e.target.value })} className={`mt-1 ${inputCls}`} />
                </label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setAddIngOpen(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50">Cancel</button>
                <button
                  onClick={async () => {
                    if (!newIng.name.trim()) { toast('Name the ingredient first.', 'error'); return; }
                    const created = await addIngredient(newIng);
                    if (created && draft) {
                      setDraft({ ...draft, recipe: [...draft.recipe, { ing: created.id, qty: created.unit === 'pc' ? 1 : 100, unit: natUnit(created) }] });
                      setAddIngOpen(false);
                      setNewIng({ name: '', unit: 'kg', price: 0, cat: 'Pantry' });
                    }
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800"
                >
                  Add & insert into recipe
                </button>
              </div>
            </div>
          </Modal>

          {/* save-with-warnings confirmation */}
          <Modal open={confirmSaveWarn} onClose={() => setConfirmSaveWarn(false)} title="Save flagged recipe?">
            {draft && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">This recipe has unresolved flags. You can still save, but they stay visible on the dish until fixed:</p>
                <ul className="space-y-1.5">
                  {warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-500" /> {w}
                    </li>
                  ))}
                </ul>
                <div className="flex justify-end gap-2 pt-2">
                  <button onClick={() => setConfirmSaveWarn(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50">Keep editing</button>
                  <button disabled={saving} onClick={doSave} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-amber-600 text-white hover:bg-amber-700">Save anyway</button>
                </div>
              </div>
            )}
          </Modal>

          <ConfirmDialog
            open={confirmDel}
            onCancel={() => setConfirmDel(false)}
            onConfirm={() => { if (draft) { deleteDish(draft.id); setConfirmDel(false); setSelId(dishes.find((x) => x.id !== draft.id)?.id || null); } }}
            title={`Delete ${draft.name}?`}
            body="The dish is removed from the database along with its recipe and sales history."
          />
        </div>
      )}
    </div>
  );
}
