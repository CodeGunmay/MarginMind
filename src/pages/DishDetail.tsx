import React, { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { ArrowLeft, ChefHat, FlaskConical, ShieldCheck, ShieldAlert, HelpCircle } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Card, CardHeader, ClsBadge, EmptyState, AILabel } from '../components/ui';
import { trendFor, itemCost } from '../lib/calc';
import { insightFor } from '../lib/ai';

export default function DishDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { analyzed, money, settings } = useApp();
  const d = analyzed.rows.find((r) => r.id === id);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [metric, setMetric] = useState<'units' | 'revenue' | 'contribution'>('units');

  const trend = useMemo(() => (d ? trendFor(d, d.cm, days) : []), [d, days]);
  const ins = useMemo(() => {
    if (!d) return null;
    return insightFor(d, { rows: analyzed.rows, ingMap: analyzed.ingMap, ings: [], settings, popT: analyzed.popT, marT: analyzed.marT, avgCm: analyzed.avgCm, avgUnits: analyzed.avgUnits, totals: analyzed.totals });
  }, [d, analyzed, settings]);

  if (!d) {
    return <EmptyState title="Dish not found" hint="It may have been removed or the link is stale." action={<Link to="/menu" className="text-amber-600 font-semibold text-sm">← Back to Menu Intelligence</Link>} />;
  }

  const stats = [
    { label: 'Selling Price', value: money(d.price) },
    { label: 'Ingredient Cost', value: money(d.cost), sub: `incl. ${d.wastage}% wastage` },
    { label: 'Food Cost %', value: `${d.fcPct.toFixed(1)}%`, tone: d.fcPct > 50 ? 'text-rose-600' : d.fcPct > settings.foodCostTarget ? 'text-amber-600' : 'text-emerald-600', sub: `target ${settings.foodCostTarget}%` },
    { label: 'Units Sold', value: String(d.units), sub: `last month ${d.prevUnits}` },
    { label: 'Revenue', value: money(d.revenue) },
    { label: 'Contribution / Unit', value: money(d.cm), sub: `${d.cmPct.toFixed(1)}% margin` },
    { label: 'Total Contribution', value: money(d.contribution), tone: 'text-emerald-700' },
  ];

  const pie = [
    { name: 'Ingredient cost', value: Math.round(d.cost), color: '#f59e0b' },
    { name: 'Contribution', value: Math.round(Math.max(d.cm, 0)), color: '#059669' },
  ];

  return (
    <div className="space-y-5">
      <button onClick={() => nav(-1)} className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 anim-fade-up">
        <ArrowLeft size={15} /> Back
      </button>

      {/* Header */}
      <Card className="p-6 anim-fade-up">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">{d.name}</h2>
              <ClsBadge cls={d.cls} />
            </div>
            <p className="text-sm text-slate-500 mt-1">{d.cat} · {d.desc}</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/costing?dish=${d.id}`} className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
              <ChefHat size={15} /> Edit recipe
            </Link>
            <Link to={`/simulator?dish=${d.id}`} className="flex items-center gap-1.5 rounded-xl bg-slate-900 text-white px-3.5 py-2.5 text-[13px] font-semibold hover:bg-slate-800">
              <FlaskConical size={15} /> Simulate scenario
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3 mt-6">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-slate-100 bg-slate-50/50 p-3">
              <div className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wide">{s.label}</div>
              <div className={`text-[17px] font-bold mt-1 tracking-tight ${s.tone || 'text-slate-900'}`}>{s.value}</div>
              {s.sub && <div className="text-[10px] text-slate-400 mt-0.5">{s.sub}</div>}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Profitability breakdown */}
        <Card>
          <CardHeader title="Profitability Breakdown" subtitle="Where each rupee of the selling price goes" />
          <div className="p-5 pt-3">
            <div className="h-5 rounded-full overflow-hidden flex w-full bg-slate-100">
              <div className="bg-amber-500 h-full transition-all" style={{ width: `${Math.min(100, d.fcPct)}%` }} />
              <div className="bg-emerald-500 h-full transition-all" style={{ width: `${Math.max(0, 100 - d.fcPct)}%` }} />
            </div>
            <div className="mt-4 space-y-2 text-[13px]">
              <div className="flex justify-between"><span className="text-slate-600">Selling Price</span><b>{money(d.price)}</b></div>
              <div className="flex justify-between"><span className="text-slate-600">− Ingredient Cost</span><b className="text-amber-600">{money(d.cost)}</b></div>
              <div className="flex justify-between border-t border-slate-100 pt-2"><span className="text-slate-700 font-medium">= Contribution Margin</span><b className="text-emerald-600">{money(d.cm)}</b></div>
              <div className="flex justify-between text-[12px] text-slate-500"><span>Food Cost %</span><span className="font-semibold">{d.fcPct.toFixed(1)}%</span></div>
              <div className="flex justify-between text-[12px] text-slate-500"><span>Margin %</span><span className="font-semibold text-emerald-600">{d.cmPct.toFixed(1)}%</span></div>
            </div>
            <div className="h-[150px] mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" innerRadius={42} outerRadius={62} paddingAngle={3} strokeWidth={0}>
                    {pie.map((p) => <Cell key={p.name} fill={p.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Card>

        {/* Trend */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="Sales Trend"
            subtitle="Simulated daily performance from seeded demo data"
            right={
              <div className="flex gap-1.5">
                {[7, 30, 90].map((n) => (
                  <button key={n} onClick={() => setDays(n as 7 | 30 | 90)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border ${days === n ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-500'}`}>{n}d</button>
                ))}
              </div>
            }
          />
          <div className="flex gap-1.5 px-5 pb-1">
            {(['units', 'revenue', 'contribution'] as const).map((m) => (
              <button key={m} onClick={() => setMetric(m)} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border capitalize ${metric === m ? 'bg-amber-500 text-white border-amber-500' : 'border-slate-200 text-slate-500'}`}>{m}</button>
            ))}
          </div>
          <div className="h-[240px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 10, right: 14, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="gdish" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(days / 8))} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => (metric === 'units' ? String(v) : v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`)} />
                <Tooltip formatter={(v: any) => (metric === 'units' ? `${v} units` : money(Number(v)))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Area type="monotone" dataKey={metric} stroke="#f59e0b" strokeWidth={2.2} fill="url(#gdish)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* AI analysis */}
        <Card className="border-amber-200/70 bg-gradient-to-b from-amber-50/60 to-white">
          <CardHeader title={<span className="flex items-center gap-2">Why is this dish classified this way? <AILabel /></span>} />
          <div className="p-5 pt-2 space-y-4">
            <p className="text-[14px] text-slate-700 leading-relaxed">{ins?.why}</p>
            <div>
              <h4 className="text-[13px] font-semibold text-slate-800 mb-1">What should you do?</h4>
              <p className="text-[14px] text-slate-700 leading-relaxed">{ins?.action}</p>
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-amber-100">
              <span className="text-[12px] text-slate-500">Confidence:</span>
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${ins?.confidence === 'High' ? 'bg-emerald-100 text-emerald-700' : ins?.confidence === 'Medium' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                {ins?.confidence === 'High' ? <ShieldCheck size={12} /> : ins?.confidence === 'Medium' ? <ShieldAlert size={12} /> : <HelpCircle size={12} />}
                {ins?.confidence}
              </span>
              <span className="text-[11px] text-slate-400">— distance from classification thresholds (heuristic, not an ML model)</span>
            </div>
          </div>
        </Card>

        {/* Recipe */}
        <Card>
          <CardHeader title="Recipe Cost Structure" subtitle={`${d.recipe.length} ingredients · ${d.wastage}% wastage · yields ${d.servings} serving${d.servings > 1 ? 's' : ''}`} />
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-y border-slate-100 bg-slate-50/60 text-left text-slate-500">
                  <th className="px-5 py-2.5 font-semibold">Ingredient</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Qty</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Rate</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Cost</th>
                </tr>
              </thead>
              <tbody>
                {d.recipe.map((r, i) => {
                  const ing = r.ing ? analyzed.ingMap.get(r.ing) : undefined;
                  const cost = itemCost(r, ing);
                  return (
                    <tr key={i} className="border-b border-slate-50">
                      <td className="px-5 py-2.5 font-medium text-slate-700">{ing?.name || r.name || 'Custom'}</td>
                      <td className="px-4 py-2.5 text-right text-slate-600">{r.qty}{r.unit}</td>
                      <td className="px-4 py-2.5 text-right text-slate-400 text-[12px]">{ing ? `${money(ing.price)}/${ing.unit}` : 'lumpsum'}</td>
                      <td className="px-5 py-2.5 text-right font-medium">{money(cost)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50/70 font-semibold text-slate-800">
                  <td className="px-5 py-2.5" colSpan={3}>Cost per serving (incl. wastage)</td>
                  <td className="px-5 py-2.5 text-right">{money(d.cost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
