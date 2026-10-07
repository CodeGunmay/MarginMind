import React, { useMemo } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { useApp } from '../store/AppContext';
import { Card, CardHeader, Delta, EmptyState } from '../components/ui';
import { trendFor } from '../lib/calc';

const PALETTE = ['#f59e0b', '#059669', '#4f46e5', '#0284c7', '#e11d48', '#7c3aed', '#0d9488', '#b45309'];

export default function SalesAnalytics() {
  const { analyzed, money, moneyShort, range, setRange } = useApp();
  const rows = analyzed.rows;

  const days = range;
  const scale = days / 30;

  const series = useMemo(() => {
    const acc = new Map<string, { label: string; revenue: number; units: number; contribution: number }>();
    rows.forEach((d) => {
      trendFor(d, d.cm, days).forEach((p) => {
        const cur = acc.get(p.date) || { label: p.label, revenue: 0, units: 0, contribution: 0 };
        cur.revenue += p.revenue; cur.units += p.units; cur.contribution += p.contribution;
        acc.set(p.date, cur);
      });
    });
    return Array.from(acc.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [rows, days]);

  const tot = useMemo(() => ({
    revenue: series.reduce((s, p) => s + p.revenue, 0),
    units: series.reduce((s, p) => s + p.units, 0),
    contribution: series.reduce((s, p) => s + p.contribution, 0),
  }), [series]);

  const orders = tot.units / 2.4; // assumed items per order (demo heuristic)
  const aov = orders ? tot.revenue / orders : 0;
  const cmPct = tot.revenue ? (tot.contribution / tot.revenue) * 100 : 0;

  const top10 = useMemo(() => [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 10).map((d) => ({ name: d.name.length > 16 ? d.name.slice(0, 15) + '…' : d.name, Revenue: Math.round(d.revenue * scale) })), [rows, scale]);
  const bottom10 = useMemo(() => [...rows].sort((a, b) => a.revenue - b.revenue).slice(0, 10).map((d) => ({ name: d.name.length > 16 ? d.name.slice(0, 15) + '…' : d.name, Revenue: Math.round(d.revenue * scale) })), [rows, scale]);

  const byCat = useMemo(() => {
    const m = new Map<string, { revenue: number; contribution: number }>();
    rows.forEach((d) => {
      const c = m.get(d.cat) || { revenue: 0, contribution: 0 };
      c.revenue += d.revenue * scale; c.contribution += d.contribution * scale;
      m.set(d.cat, c);
    });
    return Array.from(m.entries()).map(([name, v], i) => ({ name, ...v, color: PALETTE[i % PALETTE.length] }));
  }, [rows, scale]);

  if (!rows.length) return <EmptyState title="No sales data" hint="Enable Demo Mode to load analytics for Musafir Cafe." />;

  const kpis = [
    { label: `Revenue (${days}d)`, value: moneyShort(tot.revenue) },
    { label: 'Units Sold', value: Math.round(tot.units).toLocaleString('en-IN') },
    { label: 'Avg Order Value', value: money(Math.round(aov)), sub: 'assumes ~2.4 items/order' },
    { label: 'Contribution', value: moneyShort(tot.contribution) },
    { label: 'Contribution Margin', value: `${cmPct.toFixed(1)}%` },
  ];

  const interval = Math.max(0, Math.floor(days / 10));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 anim-fade-up">
        <p className="text-sm text-slate-500">Trends across the whole menu · simulated from monthly seeded volumes.</p>
        <div className="flex gap-1.5">
          {[7, 30, 90].map((n) => (
            <button key={n} onClick={() => setRange(n as 7 | 30 | 90)} className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold border transition-colors ${range === n ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}>
              {n} days
            </button>
          ))}
          <span className="rounded-full px-3.5 py-1.5 text-[12px] font-semibold border border-dashed border-slate-300 text-slate-400 cursor-not-allowed" title="Custom ranges coming soon in demo">Custom</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 stagger">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">{k.label}</div>
            <div className="text-xl font-bold tracking-tight mt-1.5">{k.value}</div>
            {k.sub && <div className="text-[10px] text-slate-400 mt-1">{k.sub}</div>}
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title="Revenue Trend" subtitle={`Daily · ${days} days`} />
          <div className="h-[260px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 10, right: 14, left: -6, bottom: 0 }}>
                <defs>
                  <linearGradient id="grev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} /><stop offset="100%" stopColor="#f59e0b" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={interval} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Area type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2.2} fill="url(#grev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Contribution Trend" subtitle={`Daily · ${days} days`} />
          <div className="h-[260px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 10, right: 14, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={interval * 2} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Line type="monotone" dataKey="contribution" stroke="#059669" strokeWidth={2.2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader title="Units Sold" subtitle={`Daily · ${days} days`} />
          <div className="h-[240px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 10, right: 14, left: -14, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} interval={interval * 2} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="units" fill="#0284c7" radius={[4, 4, 0, 0]} maxBarSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Revenue by Category" />
          <div className="h-[240px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCat} dataKey="revenue" nameKey="name" innerRadius={46} outerRadius={75} paddingAngle={2} strokeWidth={0}>
                  {byCat.map((c) => <Cell key={c.name} fill={c.color} />)}
                </Pie>
                <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Contribution by Category" />
          <div className="h-[240px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCat} dataKey="contribution" nameKey="name" innerRadius={46} outerRadius={75} paddingAngle={2} strokeWidth={0}>
                  {byCat.map((c) => <Cell key={c.name} fill={c.color} />)}
                </Pie>
                <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Top 10 Dishes" subtitle={`By revenue · ${days} days`} />
          <div className="h-[320px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} width={110} />
                <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="Revenue" fill="#059669" radius={[0, 5, 5, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Bottom 10 Dishes" subtitle={`By revenue · candidates for review`} />
          <div className="h-[320px] px-2 pb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bottom10} layout="vertical" margin={{ top: 4, right: 20, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} tickLine={false} axisLine={false} width={110} />
                <Tooltip formatter={(v: any) => money(Number(v))} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
                <Bar dataKey="Revenue" fill="#e11d48" radius={[0, 5, 5, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
