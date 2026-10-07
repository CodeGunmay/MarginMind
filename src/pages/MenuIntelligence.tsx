import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowUpDown, Search, Sparkles, X } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Card, CardHeader, ClsBadge, EmptyState, ActionTag, actionFor, Modal, AILabel } from '../components/ui';
import { CLS_META } from '../lib/calc';
import { Analyzed, Cls } from '../types';

/* ---------- Matrix (interactive 2×2) ---------- */
function Matrix({ rows, popT, marT }: { rows: Analyzed[]; popT: number; marT: number }) {
  const { money } = useApp();
  const nav = useNavigate();
  const [hover, setHover] = useState<Analyzed | null>(null);

  const W = 860, H = 500, PL = 78, PR = 28, PT = 26, PB = 56;
  const xMax = Math.max(...rows.map((r) => r.units), popT) * 1.15;
  const yMax = Math.max(...rows.map((r) => r.cm), marT) * 1.18;
  const rMax = Math.max(...rows.map((r) => r.revenue)) || 1;
  const x = (u: number) => PL + (u / xMax) * (W - PL - PR);
  const y = (c: number) => H - PB - (c / yMax) * (H - PT - PB);
  const rr = (rev: number) => 7 + 26 * Math.sqrt(rev / rMax);

  const quads = [
    { cls: 'puzzle' as Cls, x1: 0, x2: popT, y1: marT, y2: yMax, lx: x(0) + 14, ly: y(yMax) + 20 },
    { cls: 'star' as Cls, x1: popT, x2: xMax, y1: marT, y2: yMax, lx: x(xMax) - 130, ly: y(yMax) + 20 },
    { cls: 'dog' as Cls, x1: 0, x2: popT, y1: 0, y2: marT, lx: x(0) + 14, ly: y(0) - 26 },
    { cls: 'plowhorse' as Cls, x1: popT, x2: xMax, y1: 0, y2: marT, lx: x(xMax) - 160, ly: y(0) - 26 },
  ];
  const fills: Record<Cls, string> = { star: 'rgba(5,150,105,0.07)', plowhorse: 'rgba(217,119,6,0.07)', puzzle: 'rgba(79,70,229,0.07)', dog: 'rgba(225,29,72,0.06)' };

  const ticks = 5;
  return (
    <div className="relative w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="min-w-[640px] w-full">
        {quads.map((q) => (
          <g key={q.cls}>
            <rect x={x(q.x1)} y={y(q.y2)} width={x(q.x2) - x(q.x1)} height={y(q.y1) - y(q.y2)} fill={fills[q.cls]} />
            <text x={q.lx} y={q.ly} fontSize="15" fontWeight={700} fill={CLS_META[q.cls].hex} opacity={0.9}>
              {CLS_META[q.cls].emoji} {CLS_META[q.cls].label}
            </text>
            <text x={q.lx} y={q.ly + 15} fontSize="10" fill="#94a3b8">{CLS_META[q.cls].desc}</text>
          </g>
        ))}
        {/* threshold lines */}
        <line x1={x(popT)} x2={x(popT)} y1={y(0)} y2={y(yMax)} stroke="#475569" strokeWidth="1.5" strokeDasharray="6 5" opacity={0.6} />
        <line x1={x(0)} x2={x(xMax)} y1={y(marT)} y2={y(marT)} stroke="#475569" strokeWidth="1.5" strokeDasharray="6 5" opacity={0.6} />
        {/* axes */}
        <line x1={x(0)} x2={x(xMax)} y1={y(0)} y2={y(0)} stroke="#cbd5e1" strokeWidth="1.5" />
        <line x1={x(0)} x2={x(0)} y1={y(0)} y2={y(yMax)} stroke="#cbd5e1" strokeWidth="1.5" />
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const v = (xMax / ticks) * i;
          return (
            <g key={i}>
              <text x={x(v)} y={y(0) + 20} fontSize="10" fill="#94a3b8" textAnchor="middle">{Math.round(v)}</text>
              <text x={x(0) - 10} y={y((yMax / ticks) * i) + 3} fontSize="10" fill="#94a3b8" textAnchor="end">₹{Math.round((yMax / ticks) * i)}</text>
            </g>
          );
        })}
        <text x={(PL + W - PR) / 2} y={H - 8} fontSize="12" fontWeight={600} fill="#64748b" textAnchor="middle">POPULARITY → units sold / month</text>
        <text x={16} y={(PT + H - PB) / 2} fontSize="12" fontWeight={600} fill="#64748b" textAnchor="middle" transform={`rotate(-90 16 ${(PT + H - PB) / 2})`}>
          PROFITABILITY → contribution / unit
        </text>
        {/* bubbles */}
        {rows.map((d) => (
          <g key={d.id} onMouseEnter={() => setHover(d)} onMouseLeave={() => setHover(null)} onClick={() => nav(`/dish/${d.id}`)} className="cursor-pointer">
            <circle cx={x(d.units)} cy={y(d.cm)} r={rr(d.revenue)} fill={CLS_META[d.cls].hex} opacity={hover?.id === d.id ? 0.85 : 0.55} stroke={CLS_META[d.cls].hex} strokeWidth={hover?.id === d.id ? 2.5 : 1.5} />
            {rr(d.revenue) > 17 && (
              <text x={x(d.units)} y={y(d.cm) + 3.5} fontSize="10" fontWeight={700} fill="white" textAnchor="middle" pointerEvents="none">
                {d.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
              </text>
            )}
          </g>
        ))}
      </svg>
      {hover && (
        <div className="absolute top-3 right-3 bg-white/95 backdrop-blur rounded-xl shadow-pop border border-slate-200 p-3.5 w-60 pointer-events-none anim-fade-in z-10">
          <div className="font-semibold text-sm text-slate-900">{hover.name}</div>
          <div className="mt-1.5 space-y-1 text-[12px] text-slate-600">
            <div className="flex justify-between"><span>Sales</span><b>{hover.units} units/mo</b></div>
            <div className="flex justify-between"><span>Margin</span><b>{money(hover.cm)}/plate</b></div>
            <div className="flex justify-between"><span>Revenue</span><b>{money(hover.revenue)}</b></div>
            <div className="flex justify-between items-center"><span>Class</span><ClsBadge cls={hover.cls} size="sm" /></div>
          </div>
          <div className="text-[10px] text-amber-600 font-semibold mt-2">Click bubble to open full analysis →</div>
        </div>
      )}
      <p className="text-[11px] text-slate-400 mt-1">Bubble size = monthly revenue · dashed lines = Settings thresholds (popularity {Math.round(popT)} units · margin {money(marT)})</p>
    </div>
  );
}

/* ---------- Main page ---------- */
type SortKey = 'name' | 'price' | 'cost' | 'fcPct' | 'units' | 'revenue' | 'cm' | 'contribution';

export default function MenuIntelligence() {
  const { analyzed, money, plan } = useApp();
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') || 'table';
  const q = (params.get('q') || '').toLowerCase();
  const clsFilter = params.get('cls') || 'all';
  const [cat, setCat] = useState('all');
  const [prof, setProf] = useState('all');
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: 'revenue', dir: -1 });
  const [search, setSearch] = useState(params.get('q') || '');
  const [strategyOpen, setStrategyOpen] = useState(false);

  React.useEffect(() => { setSearch(params.get('q') || ''); }, [params]);

  const cats = useMemo(() => ['all', ...Array.from(new Set(analyzed.rows.map((r) => r.cat)))], [analyzed.rows]);

  const rows = useMemo(() => {
    let r = analyzed.rows.filter((d) =>
      (clsFilter === 'all' || d.cls === clsFilter) &&
      (cat === 'all' || d.cat === cat) &&
      (prof === 'all' || d.prof === prof) &&
      (!q || d.name.toLowerCase().includes(q) || d.cat.toLowerCase().includes(q))
    );
    r = [...r].sort((a, b) => {
      const av = a[sort.k] as any, bv = b[sort.k] as any;
      return (typeof av === 'string' ? av.localeCompare(bv) : av - bv) * sort.dir;
    });
    return r;
  }, [analyzed.rows, clsFilter, cat, prof, q, sort]);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v === 'all' || v === '') p.delete(k); else p.set(k, v);
    setParams(p, { replace: true });
  };

  const cols: { k: SortKey; label: string; num?: boolean }[] = [
    { k: 'name', label: 'Dish' }, { k: 'price', label: 'Price', num: true }, { k: 'cost', label: 'Ing. Cost', num: true },
    { k: 'fcPct', label: 'Food Cost %', num: true }, { k: 'units', label: 'Units', num: true }, { k: 'revenue', label: 'Revenue', num: true },
    { k: 'cm', label: 'CM/Unit', num: true }, { k: 'contribution', label: 'Contribution', num: true },
  ];

  if (!analyzed.rows.length) return <EmptyState title="No dishes to analyze" hint="Enable Demo Mode to load Musafir Cafe's menu." />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between anim-fade-up">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
          {[['table', 'Dishes'], ['matrix', 'Menu Engineering Matrix']].map(([v, l]) => (
            <button key={v} onClick={() => setParam('view', v)} className={`rounded-lg px-4 py-2 text-[13px] font-semibold transition-colors ${view === v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              {l}
            </button>
          ))}
        </div>
        {view === 'matrix' && (
          <button onClick={() => setStrategyOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-[13px] font-semibold px-4 py-2.5 shadow hover:opacity-95">
            <Sparkles size={15} /> Generate AI Strategy
          </button>
        )}
      </div>

      {view === 'matrix' ? (
        <Card className="p-4">
          <Matrix rows={analyzed.rows} popT={analyzed.popT} marT={analyzed.marT} />
        </Card>
      ) : (
        <Card>
          <CardHeader
            title={`All Dishes (${rows.length})`}
            subtitle="Full menu engineering table — sortable, filterable, clickable rows."
            right={
              <div className="relative hidden sm:block">
                <Search size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setParam('q', e.target.value); }}
                  placeholder="Search…"
                  className="rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-7 py-1.5 text-[13px] outline-none focus:border-amber-400 w-44"
                />
                {search && <button className="absolute right-2 top-2.5 text-slate-400 hover:text-slate-600" onClick={() => { setSearch(''); setParam('q', ''); }}><X size={13} /></button>}
              </div>
            }
          />
          <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
            {(['all', 'star', 'plowhorse', 'puzzle', 'dog'] as const).map((c) => (
              <button key={c} onClick={() => setParam('cls', c)} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold border transition-colors ${clsFilter === c ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                {c === 'all' ? 'All' : `${CLS_META[c as Cls].emoji} ${CLS_META[c as Cls].label}S`}
              </button>
            ))}
            <select value={cat} onChange={(e) => setCat(e.target.value)} className="ml-auto rounded-lg border border-slate-200 bg-white text-[12px] px-2 py-1.5 font-medium text-slate-600 outline-none">
              {cats.map((c) => <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>)}
            </select>
            <select value={prof} onChange={(e) => setProf(e.target.value)} className="rounded-lg border border-slate-200 bg-white text-[12px] px-2 py-1.5 font-medium text-slate-600 outline-none">
              <option value="all">All profitability</option>
              <option value="high">High margin</option>
              <option value="low">Low margin</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            {rows.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">No dishes match these filters. <button className="text-amber-600 font-semibold" onClick={() => { setParams({}); setSearch(''); setCat('all'); setProf('all'); }}>Clear filters</button></div>
            ) : (
              <table className="w-full text-[13px] min-w-[980px]">
                <thead>
                  <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-slate-500">
                    {cols.map((c) => (
                      <th key={c.k} className={`px-4 py-2.5 font-semibold whitespace-nowrap ${c.num ? 'text-right' : ''}`}>
                        <button className="inline-flex items-center gap-1 hover:text-slate-800" onClick={() => setSort((s) => ({ k: c.k, dir: s.k === c.k ? (s.dir === 1 ? -1 : 1) : -1 }))}>
                          {c.label} <ArrowUpDown size={11} className={sort.k === c.k ? 'text-amber-500' : 'text-slate-300'} />
                        </button>
                      </th>
                    ))}
                    <th className="px-4 py-2.5 font-semibold">Popularity</th>
                    <th className="px-4 py-2.5 font-semibold">Class</th>
                    <th className="px-4 py-2.5 font-semibold">AI Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((d) => (
                    <tr key={d.id} onClick={() => nav(`/dish/${d.id}`)} className="border-b border-slate-50 hover:bg-amber-50/40 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{d.name}</div>
                        <div className="text-[11px] text-slate-400">{d.cat}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium">{money(d.price)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{money(d.cost)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${d.fcPct > 50 ? 'text-rose-600' : d.fcPct > 40 ? 'text-amber-600' : 'text-emerald-600'}`}>{d.fcPct.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right">{d.units}</td>
                      <td className="px-4 py-3 text-right font-medium">{money(d.revenue)}</td>
                      <td className="px-4 py-3 text-right">{money(d.cm)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{money(d.contribution)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${d.pop === 'high' ? 'text-emerald-600' : 'text-slate-400'}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${d.pop === 'high' ? 'bg-emerald-500' : 'bg-slate-300'}`} />{d.pop === 'high' ? 'High' : 'Low'}
                        </span>
                      </td>
                      <td className="px-4 py-3"><ClsBadge cls={d.cls} size="sm" /></td>
                      <td className="px-4 py-3"><ActionTag action={actionFor(d.cls)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      {/* AI strategy modal */}
      <Modal open={strategyOpen} onClose={() => setStrategyOpen(false)} title={<span className="flex items-center gap-2"><Sparkles size={16} className="text-amber-500" /> AI Menu Strategy <AILabel /></span>} wide>
        <div className="space-y-5">
          {[
            { title: `Promote ${plan.puzz.length} high-margin, low-visibility dishes`, list: plan.puzz.slice(0, 4), why: 'Puzzles already earn strong margins — they need visibility, not discounts.', color: 'text-indigo-600' },
            { title: `Re-engineer ${plan.reeng.length} high-food-cost recipes`, list: plan.reeng.slice(0, 4), why: 'These exceed your food-cost target; portion or supplier fixes are lower-risk than price hikes.', color: 'text-amber-600' },
            { title: `Protect ${plan.stars.length} stars`, list: plan.stars.slice(0, 4), why: 'Stars drive both traffic and margin — keep placement and quality consistent.', color: 'text-emerald-600' },
            { title: `Decide on ${plan.dogs.length} dogs`, list: plan.dogs.slice(0, 4), why: 'One rescue cycle (reposition + reprice), then retire what does not improve.', color: 'text-rose-600' },
          ].map((g) => (
            <div key={g.title}>
              <h4 className={`font-semibold text-sm ${g.color}`}>{g.title}</h4>
              <p className="text-[12px] text-slate-500 mt-0.5">{g.why}</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {g.list.map((d) => (
                  <button key={d.id} onClick={() => { setStrategyOpen(false); nav(`/dish/${d.id}`); }} className="rounded-full border border-slate-200 bg-slate-50 hover:bg-white hover:border-amber-300 px-3 py-1.5 text-[12px] font-medium text-slate-700 transition-colors">
                    {d.name}
                  </button>
                ))}
                {!g.list.length && <span className="text-[12px] text-slate-400">None right now — good news.</span>}
              </div>
            </div>
          ))}
          <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-3">Simulated strategy generated from current menu metrics. Recommendations are directional estimates, not guaranteed outcomes.</p>
        </div>
      </Modal>
    </div>
  );
}
