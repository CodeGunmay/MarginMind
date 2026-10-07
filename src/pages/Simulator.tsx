import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { FlaskConical, RotateCcw, ArrowRight } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Card, CardHeader, EmptyState, ClsBadge } from '../components/ui';

interface Params { price: number; infl: number; portion: number; volume: number; }

const PRESETS: { label: string; p: Params }[] = [
  { label: '+5% price', p: { price: 5, infl: 0, portion: 0, volume: 0 } },
  { label: '+10% price', p: { price: 10, infl: 0, portion: 0, volume: 0 } },
  { label: 'Ingredient inflation +10%', p: { price: 0, infl: 10, portion: 0, volume: 0 } },
  { label: 'Portion reduction −5%', p: { price: 0, infl: 0, portion: -5, volume: 0 } },
  { label: 'Sales increase +15%', p: { price: 0, infl: 0, portion: 0, volume: 15 } },
  { label: '+₹20 price', p: { price: -999, infl: 0, portion: 0, volume: 0 } },
];

function Slider({ label, value, min, max, step = 1, onChange, fmt }: { label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void; fmt: (v: number) => string }) {
  return (
    <div>
      <div className="flex justify-between text-[12px] font-medium text-slate-600 mb-1.5">
        <span>{label}</span><span className="font-bold text-slate-900">{fmt(value)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-amber-500" />
      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5"><span>{fmt(min)}</span><span>{fmt(max)}</span></div>
    </div>
  );
}

export default function Simulator() {
  const { analyzed, money } = useApp();
  const [params, setParams] = useSearchParams();
  const dishId = params.get('dish') || analyzed.rows[0]?.id || '';
  const d = analyzed.rows.find((x) => x.id === dishId);
  const [p, setP] = useState<Params>({ price: 0, infl: 0, portion: 0, volume: 0 });
  const [compared, setCompared] = useState(false);

  const sim = useMemo(() => {
    if (!d) return null;
    const price2 = p.price === -999 ? d.price + 20 : d.price * (1 + p.price / 100);
    const cost2 = d.cost * (1 + p.infl / 100) * (1 + p.portion / 100);
    const units2 = Math.round(d.units * (1 + p.volume / 100));
    const cur = { price: d.price, cost: d.cost, units: d.units, revenue: d.revenue, contribution: d.contribution, cm: d.cm, margin: d.price ? (d.cm / d.price) * 100 : 0, fc: d.fcPct };
    const cm2 = price2 - cost2;
    const pro = { price: price2, cost: cost2, units: units2, revenue: price2 * units2, contribution: cm2 * units2, cm: cm2, margin: price2 ? (cm2 / price2) * 100 : 0, fc: price2 ? (cost2 / price2) * 100 : 0 };
    return { cur, pro };
  }, [d, p]);

  if (!analyzed.rows.length) return <EmptyState title="Nothing to simulate" hint="Enable Demo Mode to run scenarios on Musafir Cafe's menu." />;
  if (!d || !sim) return null;

  const chart = [
    { name: 'Revenue', Current: Math.round(sim.cur.revenue), Projected: Math.round(sim.pro.revenue) },
    { name: 'Food Cost', Current: Math.round(sim.cur.cost * sim.cur.units), Projected: Math.round(sim.pro.cost * sim.pro.units) },
    { name: 'Contribution', Current: Math.round(sim.cur.contribution), Projected: Math.round(sim.pro.contribution) },
  ];
  const delta = sim.pro.contribution - sim.cur.contribution;

  return (
    <div className="space-y-4">
      <Card className="p-4 anim-fade-up">
        <div className="flex flex-wrap items-center gap-3">
          <FlaskConical size={18} className="text-amber-500" />
          <label className="text-sm font-medium text-slate-600">Dish:</label>
          <select value={dishId} onChange={(e) => setParams({ dish: e.target.value }, { replace: true })} onClick={() => setCompared(false)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm bg-white outline-none focus:border-amber-400 min-w-[220px]">
            {analyzed.rows.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
          </select>
          <ClsBadge cls={d.cls} />
          <div className="flex-1" />
          <button onClick={() => { setP({ price: 0, infl: 0, portion: 0, volume: 0 }); setCompared(false); }} className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-500 hover:text-slate-800">
            <RotateCcw size={13} /> Reset
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5 mt-3">
          {PRESETS.map((pr) => (
            <button key={pr.label} onClick={() => { setP(pr.p); setCompared(false); }} className={`rounded-full px-3 py-1.5 text-[11px] font-semibold border transition-colors ${JSON.stringify(p) === JSON.stringify(pr.p) ? 'bg-amber-500 text-white border-amber-500' : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'}`}>
              {pr.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-[380px_1fr] gap-4 items-start">
        <Card>
          <CardHeader title="Scenario Controls" subtitle="Adjust levers — projections update live" />
          <div className="p-5 pt-2 space-y-5">
            <Slider label="Selling price change" value={p.price === -999 ? 0 : p.price} min={-20} max={25} onChange={(v) => { setP({ ...p, price: v }); setCompared(false); }} fmt={(v) => (p.price === -999 ? '+₹20 (preset)' : `${v >= 0 ? '+' : ''}${v}%`)} />
            <Slider label="Ingredient price change" value={p.infl} min={-15} max={30} onChange={(v) => { setP({ ...p, infl: v }); setCompared(false); }} fmt={(v) => `${v >= 0 ? '+' : ''}${v}%`} />
            <Slider label="Portion / quantity change" value={p.portion} min={-20} max={15} onChange={(v) => { setP({ ...p, portion: v }); setCompared(false); }} fmt={(v) => `${v >= 0 ? '+' : ''}${v}%`} />
            <Slider label="Sales volume change" value={p.volume} min={-30} max={50} onChange={(v) => { setP({ ...p, volume: v }); setCompared(false); }} fmt={(v) => `${v >= 0 ? '+' : ''}${v}%`} />
            <button onClick={() => setCompared(true)} className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white text-sm font-semibold py-3 shadow hover:opacity-95">
              Compare Scenario <ArrowRight size={15} />
            </button>
            <p className="text-[11px] text-slate-400 text-center">Projections are demo estimates — actual demand response may differ.</p>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] min-w-[560px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/60 text-slate-500 text-left">
                    <th className="px-5 py-3 font-semibold">Metric</th>
                    <th className="px-4 py-3 font-semibold text-right">Current</th>
                    <th className="px-4 py-3 font-semibold text-right">Projected</th>
                    <th className="px-5 py-3 font-semibold text-right">Δ Change</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { l: 'Selling price / plate', c: money(sim.cur.price), pr: money(Math.round(sim.pro.price)), d: sim.pro.price - sim.cur.price, f: (v: number) => `${v >= 0 ? '+' : '−'}${money(Math.abs(Math.round(v)))}` },
                    { l: 'Ingredient cost / plate', c: money(sim.cur.cost), pr: money(Math.round(sim.pro.cost)), d: sim.pro.cost - sim.cur.cost, inv: true, f: (v: number) => `${v >= 0 ? '+' : '−'}${money(Math.abs(Math.round(v)))}` },
                    { l: 'Food Cost %', c: `${sim.cur.fc.toFixed(1)}%`, pr: `${sim.pro.fc.toFixed(1)}%`, d: sim.pro.fc - sim.cur.fc, inv: true, f: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}pp` },
                    { l: 'Margin %', c: `${sim.cur.margin.toFixed(1)}%`, pr: `${sim.pro.margin.toFixed(1)}%`, d: sim.pro.margin - sim.cur.margin, f: (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}pp` },
                    { l: 'Units / month', c: String(sim.cur.units), pr: String(sim.pro.units), d: sim.pro.units - sim.cur.units, f: (v: number) => `${v >= 0 ? '+' : ''}${Math.round(v)}` },
                    { l: 'Monthly revenue', c: money(sim.cur.revenue), pr: money(Math.round(sim.pro.revenue)), d: sim.pro.revenue - sim.cur.revenue, f: (v: number) => `${v >= 0 ? '+' : '−'}${money(Math.abs(Math.round(v)))}` },
                    { l: 'Monthly contribution', c: money(sim.cur.contribution), pr: money(Math.round(sim.pro.contribution)), d: delta, f: (v: number) => `${v >= 0 ? '+' : '−'}${money(Math.abs(Math.round(v)))}`, big: true },
                  ].map((r) => {
                    const good = r.inv ? r.d <= 0.001 : r.d >= -0.001;
                    return (
                      <tr key={r.l} className={`border-b border-slate-50 ${(r as any).big ? 'bg-amber-50/50' : ''}`}>
                        <td className="px-5 py-3 font-medium text-slate-700">{r.l}</td>
                        <td className="px-4 py-3 text-right text-slate-600">{r.c}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{r.pr}</td>
                        <td className={`px-5 py-3 text-right font-bold ${Math.abs(r.d) < 0.001 ? 'text-slate-300' : good ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {Math.abs(r.d) < 0.001 ? '—' : r.f(r.d)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {compared && (
            <Card className="anim-fade-up">
              <CardHeader title="Current vs Projected" subtitle="Monthly totals" />
              <div className="h-[260px] px-2 pb-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 10, right: 14, left: -4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="Current" fill="#cbd5e1" radius={[5, 5, 0, 0]} maxBarSize={36} />
                    <Bar dataKey="Projected" fill="#f59e0b" radius={[5, 5, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className={`mx-5 mb-5 rounded-xl px-4 py-3 text-[13px] font-semibold ${delta >= 0 ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700'}`}>
                {delta >= 0
                  ? `This scenario projects +${money(Math.round(delta))} additional monthly contribution (estimated, ${sim.pro.units} units).`
                  : `This scenario would reduce monthly contribution by ${money(Math.abs(Math.round(delta)))} — reconsider the levers.`}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
