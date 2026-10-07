import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Sparkles, Copy, RefreshCcw, Check, AlertTriangle, ArrowRight, ListOrdered, Replace, Type } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Card, CardHeader, EmptyState, SeverityChip, AILabel, ClsBadge } from '../components/ui';
import { substitutionsFor, substitutableIngredients, describeDish } from '../lib/ai';
import { Rec } from '../types';

const TYPES = [
  { k: 'all', label: 'All' },
  { k: 'pricing', label: 'Pricing' },
  { k: 'recipe', label: 'Recipe' },
  { k: 'promotion', label: 'Promotion' },
  { k: 'placement', label: 'Menu Placement' },
  { k: 'ingredient', label: 'Ingredient Optimization' },
  { k: 'removal', label: 'Removal / Repositioning' },
];

function RecCard({ rec, onApply }: { rec: Rec; onApply: (rec: Rec) => void }) {
  const { money } = useApp();
  const nav = useNavigate();
  return (
    <Card className="p-5 hover:shadow-pop transition-shadow anim-fade-up">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900">{rec.title}</h3>
            <SeverityChip sev={rec.severity} />
            <span className="rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wide">{rec.type}</span>
          </div>
        </div>
        {rec.dishId && (
          <button onClick={() => nav(`/dish/${rec.dishId}`)} className="text-[12px] font-semibold text-amber-700 hover:text-amber-800 whitespace-nowrap">
            View dish →
          </button>
        )}
      </div>
      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Problem</div>
          <p className="text-[13px] text-slate-700 mt-1 leading-relaxed">{rec.problem}</p>
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400 mt-3">Evidence</div>
          <ul className="text-[13px] text-slate-600 mt-1 space-y-1 list-disc list-inside">
            {rec.evidence.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Recommendation</div>
          <p className="text-[13px] text-slate-700 mt-1 leading-relaxed">{rec.action}</p>
          <div className="mt-3 rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wide text-emerald-600">Estimated impact</div>
            <div className="text-[13px] font-semibold text-emerald-700 mt-0.5">{rec.impactText}</div>
          </div>
          {rec.apply && (
            <button onClick={() => onApply(rec)} className="mt-3 w-full rounded-xl bg-slate-900 text-white text-[13px] font-semibold py-2.5 hover:bg-slate-800">
              Apply price → {money(rec.apply.price)}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function Recommendations() {
  const { analyzed, recs, leaks, plan, ings, settings, money, upsertDish, dishes, toast } = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'recs';
  const [type, setType] = useState('all');
  const [subIng, setSubIng] = useState('cream');
  const [descDish, setDescDish] = useState(analyzed.rows[0]?.id || '');
  const [descVariant, setDescVariant] = useState(0);
  const [copied, setCopied] = useState(false);

  const filtered = useMemo(() => (type === 'all' ? recs : recs.filter((r) => r.type === type)), [recs, type]);
  const subIngs = useMemo(() => substitutableIngredients({ rows: analyzed.rows, ingMap: analyzed.ingMap, ings, settings, popT: analyzed.popT, marT: analyzed.marT, avgCm: analyzed.avgCm, avgUnits: analyzed.avgUnits, totals: analyzed.totals }), [analyzed, ings, settings]);
  const d = analyzed.rows.find((x) => x.id === descDish);

  const tabs = [
    { k: 'recs', label: 'Recommendations', icon: Sparkles, count: recs.length },
    { k: 'leaks', label: 'Profit Leak Detector', icon: AlertTriangle, count: leaks.length },
    { k: 'plan', label: 'Optimize My Menu', icon: ListOrdered },
    { k: 'subs', label: 'Ingredient Alternatives', icon: Replace },
    { k: 'desc', label: 'Menu Descriptions', icon: Type },
  ];

  if (!analyzed.rows.length) return <EmptyState title="No data to analyze" hint="Enable Demo Mode to generate AI recommendations." />;

  const setTab = (k: string) => setParams(k === 'recs' ? {} : { tab: k }, { replace: true });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 anim-fade-up">
        {tabs.map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)} className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold border transition-colors ${tab === t.k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
            <t.icon size={14} /> {t.label}
            {t.count != null && <span className={`rounded-full px-1.5 text-[10px] font-bold ${tab === t.k ? 'bg-white/20' : 'bg-slate-100'}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {tab === 'recs' && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => (
              <button key={t.k} onClick={() => setType(t.k)} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold border transition-colors ${type === t.k ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-slate-200 text-slate-600'}`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <AILabel /> Ranked by estimated monthly contribution impact, derived from your live menu metrics — not random.
          </div>
          <div className="space-y-4">
            {filtered.map((r) => (
              <RecCard key={r.id} rec={r} onApply={(rec) => {
                const dish = dishes.find((x) => x.id === rec.dishId);
                if (dish && rec.apply) upsertDish({ ...dish, price: rec.apply.price });
              }} />
            ))}
            {!filtered.length && <EmptyState title="Nothing here" hint="No recommendations of this type right now — your menu looks healthy in this area." />}
          </div>
        </>
      )}

      {tab === 'leaks' && (
        <>
          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <AILabel /> Detects high food cost, rising ingredient prices, high-volume low-margin dishes and declining contribution.
          </div>
          <div className="space-y-3">
            {leaks.map((l) => (
              <Card key={l.id} className="p-4 flex items-start gap-4 hover:shadow-pop transition-shadow">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${l.severity === 'high' ? 'bg-rose-50 text-rose-500' : 'bg-amber-50 text-amber-500'}`}>
                  <AlertTriangle size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-slate-900">{l.title}</h3>
                    <SeverityChip sev={l.severity} />
                  </div>
                  <p className="text-[13px] text-slate-600 mt-1">{l.problem}</p>
                  <p className="text-[13px] text-slate-700 mt-1.5"><span className="font-semibold text-slate-500">Action:</span> {l.action}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Est. monthly impact</div>
                  <div className="text-lg font-bold text-rose-600 mt-0.5">−{money(Math.round(Math.max(0, l.impact)))}</div>
                  {l.dishId && <button onClick={() => nav(`/dish/${l.dishId}`)} className="text-[12px] font-semibold text-amber-700 hover:text-amber-800 mt-1">Analyze <ArrowRight size={11} className="inline" /></button>}
                </div>
              </Card>
            ))}
            {!leaks.length && <EmptyState title="No leaks detected 🎉" hint="All dishes are within healthy cost and margin ranges." />}
          </div>
        </>
      )}

      {tab === 'plan' && (
        <div className="space-y-4">
          <Card className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-slate-800">
            <div className="flex items-center gap-2"><Sparkles size={16} className="text-amber-400" /><h3 className="font-semibold">Prioritized Action Plan</h3><AILabel /></div>
            <ol className="mt-4 space-y-3">
              <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-amber-500 text-slate-900 text-[12px] font-bold flex items-center justify-center shrink-0">1</span><p className="text-[14px] text-slate-200">Re-engineer <b className="text-white">{plan.reeng.length} high-volume, low-margin dishes</b> — the fastest margin recovery ({plan.reeng.slice(0, 3).map((x) => x.name).join(', ') || 'none'}).</p></li>
              <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-amber-500 text-slate-900 text-[12px] font-bold flex items-center justify-center shrink-0">2</span><p className="text-[14px] text-slate-200">Promote <b className="text-white">{plan.puzz.length} high-margin, low-volume dishes</b> ({plan.puzz.slice(0, 3).map((x) => x.name).join(', ') || 'none'}) with placement and server push.</p></li>
              <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-amber-500 text-slate-900 text-[12px] font-bold flex items-center justify-center shrink-0">3</span><p className="text-[14px] text-slate-200">Review <b className="text-white">{plan.dogs.length} low-volume, low-margin dishes</b> ({plan.dogs.slice(0, 3).map((x) => x.name).join(', ') || 'none'}) for repositioning or removal.</p></li>
            </ol>
          </Card>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[
              { t: '⭐ Promote', l: plan.puzz, note: 'High margin, low popularity' },
              { t: '💰 Reprice', l: plan.plow, note: 'Strong demand, thin margin' },
              { t: '🧪 Re-engineer', l: plan.reeng, note: 'Above food-cost target' },
              { t: '📍 Reposition', l: plan.puzz.slice(0, 3), note: 'Move to high-visibility menu zones' },
              { t: '👀 Monitor', l: plan.monitor, note: 'Close to the margin line' },
              { t: '🗑 Consider removing', l: plan.dogs, note: 'Low volume + low margin' },
            ].map((g) => (
              <Card key={g.t} className="p-4">
                <h4 className="font-semibold text-slate-800 text-sm">{g.t}</h4>
                <p className="text-[11px] text-slate-400 mt-0.5">{g.note}</p>
                <div className="mt-3 space-y-2">
                  {g.l.slice(0, 4).map((x) => (
                    <button key={x.id} onClick={() => nav(`/dish/${x.id}`)} className="w-full flex items-center justify-between rounded-lg border border-slate-100 hover:border-amber-300 hover:bg-amber-50/40 px-3 py-2 text-[13px] transition-colors">
                      <span className="font-medium text-slate-700">{x.name}</span>
                      <span className="flex items-center gap-2"><ClsBadge cls={x.cls} size="sm" /></span>
                    </button>
                  ))}
                  {!g.l.length && <div className="text-[12px] text-slate-400 py-1">None right now.</div>}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {tab === 'subs' && (
        <div className="space-y-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-slate-600">Expensive ingredient:</label>
              <select value={subIng} onChange={(e) => setSubIng(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white outline-none focus:border-amber-400">
                {subIngs.map((i) => <option key={i.id} value={i.id}>{i.name} — {money(i.price)}/{i.unit} (used in {i.usedIn})</option>)}
              </select>
              <AILabel />
            </div>
          </Card>
          {(() => {
            const ing = subIngs.find((x) => x.id === subIng) || ings.find((x) => x.id === subIng);
            const subs = substitutionsFor(subIng);
            if (!ing) return null;
            if (!subs.length) return <EmptyState title="No alternatives on file" hint="This ingredient has no validated substitute suggestions in the demo knowledge base." />;
            const users = analyzed.rows.filter((dd) => dd.recipe.some((r) => r.ing === ing.id));
            return (
              <div className="grid md:grid-cols-2 gap-4">
                {subs.map((s, i) => {
                  const savingBase = ing.price - s.price;
                  const monthly = users.reduce((sum, dd) => {
                    const it = dd.recipe.find((r) => r.ing === ing.id)!;
                    const perUnit = ing.unit === 'pc' ? it.qty * savingBase : (it.qty / 1000) * savingBase;
                    return sum + perUnit * dd.units;
                  }, 0);
                  const perDish = users[0] ? (ing.unit === 'pc' ? users[0].recipe.find((r) => r.ing === ing.id)!.qty * savingBase : (users[0].recipe.find((r) => r.ing === ing.id)!.qty / 1000) * savingBase) : 0;
                  return (
                    <Card key={i} className="p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-slate-900">{s.alt}</h3>
                          <div className="text-[12px] text-slate-500 mt-0.5">vs {ing.name} at {money(ing.price)}/{ing.unit}</div>
                        </div>
                        <span className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold px-3 py-1.5 text-sm">{money(s.price)}/{s.unit}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-4 text-center">
                        <div className="rounded-xl bg-slate-50 p-2.5"><div className="text-[10px] font-bold uppercase text-slate-400">Saving / unit</div><div className="font-bold text-emerald-600 text-sm mt-0.5">{money(Math.max(0, savingBase))}</div></div>
                        <div className="rounded-xl bg-slate-50 p-2.5"><div className="text-[10px] font-bold uppercase text-slate-400">≈ Per dish</div><div className="font-bold text-emerald-600 text-sm mt-0.5">{money(Math.max(0, Math.round(perDish)))}</div></div>
                        <div className="rounded-xl bg-slate-50 p-2.5"><div className="text-[10px] font-bold uppercase text-slate-400">≈ Monthly</div><div className="font-bold text-emerald-600 text-sm mt-0.5">{money(Math.max(0, Math.round(monthly)))}</div></div>
                      </div>
                      <p className="text-[12px] text-slate-600 mt-3"><span className="font-semibold">Taste / quality:</span> {s.note}</p>
                      <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5 mt-2">⚠️ Substitution suggestion only — requires chef validation before menu use.</p>
                    </Card>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {tab === 'desc' && (
        <Card className="p-5 max-w-2xl">
          <CardHeader title={<span className="flex items-center gap-2">Menu Description Generator <AILabel /></span>} subtitle="Template-based copy generation from the dish's real ingredient profile." />
          <div className="flex flex-wrap gap-3 items-center mt-2">
            <select value={descDish} onChange={(e) => { setDescDish(e.target.value); setDescVariant(0); }} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white outline-none focus:border-amber-400 min-w-[220px]">
              {analyzed.rows.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <button onClick={() => setDescVariant((v) => v + 1)} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 hover:opacity-95">
              <Sparkles size={14} /> {descVariant === 0 ? 'Generate' : 'Regenerate'}
            </button>
            <button
              onClick={() => { if (d) { navigator.clipboard?.writeText(describeDish(d, { rows: analyzed.rows, ingMap: analyzed.ingMap, ings, settings, popT: analyzed.popT, marT: analyzed.marT, avgCm: analyzed.avgCm, avgUnits: analyzed.avgUnits, totals: analyzed.totals }, descVariant)).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); } }}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 text-[13px] font-semibold px-4 py-2.5 text-slate-600 hover:bg-slate-50"
            >
              {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />} {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {d && (
            <div className="mt-4 rounded-2xl bg-slate-50 border border-slate-200 p-5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{d.name} · menu copy</div>
              <p className="text-[16px] text-slate-800 leading-relaxed mt-2 font-medium">
                “{describeDish(d, { rows: analyzed.rows, ingMap: analyzed.ingMap, ings, settings, popT: analyzed.popT, marT: analyzed.marT, avgCm: analyzed.avgCm, avgUnits: analyzed.avgUnits, totals: analyzed.totals }, descVariant)}”
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
