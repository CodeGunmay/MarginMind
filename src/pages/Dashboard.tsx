import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { ArrowRight, Layers, TrendingUp, Wallet, Percent, Gauge, AlertTriangle, Sparkles, ChevronRight } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Card, CardHeader, ClsBadge, Delta, Sparkline, EmptyState, SeverityChip } from '../components/ui';
import { CLS_META, trendFor } from '../lib/calc';
import { dashboardInsight, insightFor } from '../lib/ai';
import { fmtPct } from '../lib/format';
import { Cls } from '../types';

export default function Dashboard() {
  const { analyzed, settings, money, moneyShort, range, leaks, recs } = useApp();
  const nav = useNavigate();
  const t = analyzed.totals;
  const rows = analyzed.rows;
  const [metrics, setMetrics] = useState<{ revenue: boolean; contribution: boolean; cost: boolean }>({ revenue: true, contribution: true, cost: false });

  const insight = useMemo(() => dashboardInsight({ rows, ingMap: analyzed.ingMap, ings: [], settings, popT: analyzed.popT, marT: analyzed.marT, avgCm: analyzed.avgCm, avgUnits: analyzed.avgUnits, totals: t }, recs), [analyzed, recs, settings, rows, t]);

  const byCls = useMemo(() => {
    const m: Record<Cls, { count: number; contribution: number }> = {
      star: { count: 0, contribution: 0 }, plowhorse: { count: 0, contribution: 0 }, puzzle: { count: 0, contribution: 0 }, dog: { count: 0, contribution: 0 },
    };
    rows.forEach((r) => { m[r.cls].count++; m[r.cls].contribution += r.contribution; });
    return m;
  }, [rows]);

  const chartData = useMemo(() =>
    [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 8).map((r) => ({
      name: r.name.length > 13 ? r.name.slice(0, 12) + '…' : r.name,
      full: r.name, Revenue: Math.round(r.revenue), Contribution: Math.round(r.contribution), 'Food Cost': Math.round(r.cost * r.units),
    })), [rows]);

  const topLeaks = leaks.slice(0, 4);
  const totalLeak = leaks.reduce((s, l) => s + Math.max(0, l.impact), 0);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const spark = useMemo(() => {
    const trend = trendFor({ id: 'all', units: t.units, price: 1 }, 1, 14);
    return trend.map((p) => p.units);
  }, [t.units]);

  if (!rows.length) {
    return <EmptyState title="No menu data yet" hint="Demo Mode is off or the dataset is empty. Enable Demo Mode to explore Musafir Cafe." />;
  }

  const revDelta = t.prevRevenue ? ((t.revenue - t.prevRevenue) / t.prevRevenue) * 100 : 0;
  const conDelta = t.prevContribution ? ((t.contribution - t.prevContribution) / t.prevContribution) * 100 : 0;
  const fcDelta = t.avgFC - t.prevAvgFC;

  const kpis = [
    { label: 'Total Dishes', value: String(rows.length), sub: `${Object.keys(byCls).filter((k) => byCls[k as Cls].count).length} categories active`, icon: Layers, tint: 'bg-slate-100 text-slate-600', delta: null as React.ReactNode },
    { label: 'Monthly Revenue', value: moneyShort(t.revenue), sub: '', icon: TrendingUp, tint: 'bg-amber-50 text-amber-600', delta: <Delta value={revDelta} /> },
    { label: 'Monthly Contribution', value: moneyShort(t.contribution), sub: '', icon: Wallet, tint: 'bg-emerald-50 text-emerald-600', delta: <Delta value={conDelta} /> },
    { label: 'Avg Food Cost', value: `${t.avgFC.toFixed(1)}%`, sub: `target ${settings.foodCostTarget}%`, icon: Percent, tint: 'bg-indigo-50 text-indigo-600', delta: <Delta value={-fcDelta} /> },
    { label: 'Avg Contribution Margin', value: `${t.avgCmPct.toFixed(1)}%`, sub: `of revenue`, icon: Gauge, tint: 'bg-sky-50 text-sky-600', delta: <Sparkline data={spark} color="#0284c7" height={30} /> },
    { label: 'Profit Leaks', value: String(leaks.length), sub: `${moneyShort(totalLeak)} at risk / mo`, icon: AlertTriangle, tint: 'bg-rose-50 text-rose-600', delta: <span className="text-xs font-medium text-rose-600">needs attention</span> },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="anim-fade-up">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{greet} 👋</h2>
        <p className="text-sm text-slate-500 mt-0.5">Here's how your menu is performing today — MarginMind found <span className="font-semibold text-amber-600">{recs.length} profitability opportunities</span>.</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 stagger">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4 hover:shadow-pop transition-shadow">
            <div className="flex items-center justify-between">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${k.tint}`}><k.icon size={16} /></span>
            </div>
            <div className="mt-3 text-xl font-bold tracking-tight text-slate-900">{k.value}</div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5">{k.label}</div>
            <div className="mt-2 min-h-[20px]">{k.delta}</div>
            {k.sub && <div className="text-[10px] text-slate-400 mt-0.5">{k.sub}</div>}
          </Card>
        ))}
      </div>

      {/* Menu health + AI insight */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Menu Health" subtitle="Dishes grouped by the menu-engineering quadrants — click to explore." />
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 p-5 pt-3">
            {(Object.keys(CLS_META) as Cls[]).map((cls) => {
              const m = CLS_META[cls];
              const d = byCls[cls];
              return (
                <button key={cls} onClick={() => nav(`/menu?cls=${cls}`)} className={`text-left rounded-2xl border ${m.border} ${m.bg} p-4 hover:shadow-card transition-all hover:-translate-y-0.5 group`}>
                  <div className="text-2xl">{m.emoji}</div>
                  <div className={`mt-2 text-2xl font-bold ${m.color}`}>{d.count}</div>
                  <div className="text-[11px] font-semibold text-slate-700 mt-0.5">{m.label}S</div>
                  <div className="text-[10px] text-slate-500 mt-1 leading-snug">{m.desc}</div>
                  <div className="text-[10px] font-medium text-slate-500 mt-2 flex items-center gap-0.5 group-hover:text-slate-700">
                    {moneyShort(d.contribution)} contribution <ChevronRight size={11} />
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="bg-gradient-to-b from-amber-50/80 to-white border-amber-200/70 flex flex-col">
          <CardHeader
            title={<span className="flex items-center gap-2"><Sparkles size={16} className="text-amber-500" /> MarginMind AI</span>}
            subtitle="Simulated AI · derived from your live data"
          />
          <div className="p-5 pt-3 flex-1 flex flex-col">
            <p className="text-[15px] text-slate-700 leading-relaxed flex-1">“{insight.text}”</p>
            <button onClick={() => nav('/ai')} className="mt-4 inline-flex items-center gap-1.5 self-start rounded-xl bg-slate-900 text-white text-sm font-semibold px-4 py-2.5 hover:bg-slate-800 transition-colors">
              View {Math.min(3, recs.length)} recommendations <ArrowRight size={15} />
            </button>
          </div>
        </Card>
      </div>

      {/* Chart + leaks */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Revenue vs Contribution"
            subtitle={`Top 8 dishes by revenue · last ${range} days`}
            right={
              <div className="flex gap-1.5">
                {(['revenue', 'contribution', 'cost'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setMetrics((m) => ({ ...m, [k]: !m[k] }))}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-colors ${metrics[k] ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}
                  >
                    {k === 'cost' ? 'Food Cost' : k[0].toUpperCase() + k.slice(1)}
                  </button>
                ))}
              </div>
            }
          />
          <div className="h-[300px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -6, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                <Tooltip
                  formatter={(v: any) => money(Number(v))}
                  contentStyle={{ borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 12, boxShadow: '0 8px 24px rgb(16 24 40/0.12)' }}
                  labelStyle={{ fontWeight: 700 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {metrics.revenue && <Bar dataKey="Revenue" fill="#f59e0b" radius={[5, 5, 0, 0]} maxBarSize={26} />}
                {metrics.contribution && <Bar dataKey="Contribution" fill="#059669" radius={[5, 5, 0, 0]} maxBarSize={26} />}
                {metrics.cost && <Bar dataKey="Food Cost" fill="#94a3b8" radius={[5, 5, 0, 0]} maxBarSize={26} />}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardHeader title="Top Profit Leaks" subtitle={`${moneyShort(totalLeak)} estimated monthly impact`} />
          <div className="p-4 pt-2 space-y-2.5">
            {topLeaks.map((l, i) => (
              <button key={l.id} onClick={() => (l.dishId ? nav(`/dish/${l.dishId}`) : nav('/ai'))} className="w-full text-left rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 transition-colors p-3.5 group">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[13px] text-slate-800">{i + 1}. {l.title}</span>
                  <SeverityChip sev={l.severity} />
                </div>
                <p className="text-[12px] text-slate-500 mt-1 leading-snug">{l.problem}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[11px] font-semibold text-rose-600">≈ {moneyShort(Math.max(0, l.impact))}/mo</span>
                  <span className="text-[11px] text-slate-400 group-hover:text-amber-700 line-clamp-1 max-w-[60%] text-right">{l.action}</span>
                </div>
              </button>
            ))}
            <button onClick={() => nav('/ai?tab=leaks')} className="w-full text-center text-[12px] font-semibold text-amber-700 hover:text-amber-800 py-1.5">
              Open Profit Leak Detector →
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
