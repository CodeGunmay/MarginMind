import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { PlusCircle, Upload, Loader2, Trash2, AlertTriangle, Database } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { api } from '../lib/api';
import { Card, CardHeader, EmptyState, Modal } from '../components/ui';
import { trendFor } from '../lib/calc';
import { SalePoint } from '../types';
import { businessDate } from '../lib/dates';

const PALETTE = ['#f59e0b', '#059669', '#4f46e5', '#0284c7', '#e11d48', '#7c3aed', '#0d9488', '#b45309'];

interface DryRun {
  dryRun: boolean; validRows: number; errorRows: number;
  errors: { row: number; message: string }[];
  perDish: { dish: string; units: number }[];
  demoBaselineWillBeReplaced: string[];
}

export default function SalesAnalytics() {
  const { analyzed, money, moneyShort, range, setRange, connected, dishes, toast, refreshBackend, demoMode, dataSource } = useApp();
  const rows = analyzed.rows;
  const days = range;
  const scale = dataSource==='backend' ? 1 : days / 30;

  const [summary, setSummary] = useState<{ series: any[]; totals: any; demoDishes: number } | null>(null);
  const [entryOpen, setEntryOpen] = useState(false);
  const [entry, setEntry] = useState({ dishId: '', date: businessDate(), units: '' });
  const [existingSale, setExistingSale] = useState<SalePoint | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [csv, setCsv] = useState('');
  const [dry, setDry] = useState<DryRun | null>(null);
  const [committing, setCommitting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadSummary = async () => {
    if (!connected) return;
    try { setSummary(await api.salesSummary(days)); } catch { /* Keep last successful summary; never replace it with generated sales. */ }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadSummary(); }, [connected, days, analyzed]);

  const usingServer = !!summary;

  const series = useMemo(() => {
    if (usingServer) {
      return summary!.series.map((p: any) => ({
        label: p.date.slice(5).split('-').reverse().join('/'),
        revenue: p.revenue, units: p.units, contribution: p.contribution,
      }));
    }
    if(dataSource==='backend') return [];
    const acc = new Map<string, { label: string; revenue: number; units: number; contribution: number }>();
    rows.forEach((d) => {
      trendFor(d, d.cm, days).forEach((p) => {
        const cur = acc.get(p.date) || { label: p.label, revenue: 0, units: 0, contribution: 0 };
        cur.revenue += p.revenue; cur.units += p.units; cur.contribution += p.contribution;
        acc.set(p.date, cur);
      });
    });
    return Array.from(acc.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [rows, days, usingServer, summary, dataSource]);

  const tot = useMemo(() => usingServer
    ? { revenue: summary!.totals.revenue, units: summary!.totals.units, contribution: summary!.totals.contribution }
    : {
      revenue: series.reduce((s, p) => s + p.revenue, 0),
      units: series.reduce((s, p) => s + p.units, 0),
      contribution: series.reduce((s, p) => s + p.contribution, 0),
    }, [series, summary, usingServer]);

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

  const demoActive = false;
  const inputCls = 'w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-amber-400 bg-white';

  /* look up an existing sale for edit/delete */
  useEffect(() => {
    setExistingSale(null);
    if (!entryOpen || !connected || !entry.dishId || !entry.date) return;
    api.dishSales(entry.dishId, 400).then((r) => {
      const p = r.points.find((x) => x.date === entry.date && x.source !== 'demo');
      setExistingSale(p || null);
    }).catch(() => {});
  }, [entryOpen, entry.dishId, entry.date, connected]);

  const submitEntry = async () => {
    const units = Number(entry.units);
    if (!entry.dishId) { toast('Pick a dish.', 'error'); return; }
    if (!Number.isFinite(units) || units < 0) { toast('Units must be a non-negative number.', 'error'); return; }
    setSaving(true);
    try {
      const r = await api.addSale({ dishId: entry.dishId, date: entry.date, units });
      toast(r.replacedDemoBaseline
        ? `Sales saved to your restaurant workspace.`
        : `Saved ${units} units for ${entry.date} — totals and popularity updated.`);
      await refreshBackend();
      await loadSummary();
      setEntryOpen(false);
      setEntry({ ...entry, units: '' });
    } catch (e: any) {
      toast(e.message || 'Could not save sale', 'error');
    } finally {
      setSaving(false);
    }
  };

  const doCommit = async () => {
    setCommitting(true);
    try {
      const r = await api.importSales(csv, true);
      toast(`Imported ${r.imported} sales rows (${r.skipped} skipped). Popularity and charts updated.`);
      await refreshBackend();
      await loadSummary();
      setImportOpen(false); setDry(null); setCsv('');
    } catch (e: any) {
      toast(e.message || 'Import failed', 'error');
    } finally {
      setCommitting(false);
    }
  };

  if (!rows.length && demoMode) return <EmptyState title="No dishes yet" hint="Add dishes and record sales to see analytics here." />;
  if (!rows.length) return <EmptyState title="No sales data" hint="Add your menu and record sales to see analytics." />;

  const kpis = [
    { label: `Revenue (${days}d)`, value: moneyShort(tot.revenue) },
    { label: 'Units Sold', value: Math.round(tot.units).toLocaleString('en-IN') },
    { label: 'Average Item Revenue', value: money(tot.units ? tot.revenue/tot.units : 0), sub: 'recorded revenue ÷ units sold' },
    { label: 'Contribution', value: moneyShort(tot.contribution) },
    { label: 'Contribution Margin', value: `${cmPct.toFixed(1)}%` },
  ];

  const interval = Math.max(0, Math.floor(days / 10));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2 anim-fade-up">
        <p className="text-sm text-slate-500">
          {usingServer ? 'Computed from persisted sales in the database.' : 'Simulated daily trends from menu volumes (backend offline).'}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1.5">
            {[7, 30, 90].map((n) => (
              <button key={n} onClick={() => setRange(n as 7 | 30 | 90)} className={`rounded-full px-3.5 py-1.5 text-[12px] font-semibold border transition-colors ${range === n ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600'}`}>
                {n} days
              </button>
            ))}
          </div>
          <button
            onClick={() => { setEntry((e) => ({ ...e, dishId: dishes[0]?.id || '' })); setEntryOpen(true); }}
            disabled={!connected || !dishes.length}
            title={connected ? 'Record units sold' : 'Needs the backend to persist sales'}
            className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-600 text-white px-3.5 py-1.5 text-[12px] font-semibold shadow hover:opacity-95 disabled:opacity-50"
          >
            <PlusCircle size={14} /> Record sales
          </button>
          <button
            onClick={() => { setImportOpen(true); setDry(null); }}
            disabled={!connected}
            title={connected ? 'Import a CSV of daily sales' : 'Needs the backend to persist sales'}
            className="flex items-center gap-1.5 rounded-full border border-slate-300 px-3.5 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <Upload size={14} /> Import CSV
          </button>
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
          <CardHeader title={<>Revenue Trend {usingServer ? '' : <span className="text-[10px] text-slate-400 font-normal">(awaiting sales data)</span>}</>} subtitle={`Daily · ${days} days`} />
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
          <CardHeader title="Top 10 Dishes" subtitle={`By revenue · ${days} days · from recorded sales`} />
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

      {/* record / edit sales modal */}
      <Modal open={entryOpen} onClose={() => setEntryOpen(false)} title="Record daily sales">
        <div className="space-y-3">
          <p className="text-[12.5px] text-slate-500">Saving the same dish and date updates that day. Sales quantities and recorded revenue feed your popularity and contribution analysis.</p>
          <label className="block text-[12px] font-medium text-slate-600">Dish
            <select value={entry.dishId} onChange={(e) => setEntry({ ...entry, dishId: e.target.value })} className={`mt-1 ${inputCls}`}>
              {dishes.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[12px] font-medium text-slate-600">Date
              <input type="date" max={businessDate()} value={entry.date} onChange={(e) => setEntry({ ...entry, date: e.target.value })} className={`mt-1 ${inputCls}`} />
            </label>
            <label className="block text-[12px] font-medium text-slate-600">Units sold
              <input type="number" min={0} value={entry.units} onChange={(e) => setEntry({ ...entry, units: e.target.value })} className={`mt-1 ${inputCls}`} placeholder="e.g. 34" />
            </label>
          </div>
          {existingSale && (
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">
              <span>Existing entry: <b>{existingSale.units} units</b> ({money(existingSale.revenue)})</span>
              <button
                onClick={async () => {
                  try {
                    await api.deleteSale(entry.dishId, entry.date);
                    toast('Sale deleted — totals updated.', 'info');
                    await refreshBackend(); await loadSummary();
                    setExistingSale(null);
                  } catch (e: any) { toast(e.message, 'error'); }
                }}
                className="flex items-center gap-1 text-rose-600 font-semibold hover:text-rose-700"
              >
                <Trash2 size={13} /> Delete
              </button>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEntryOpen(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50">Cancel</button>
            <button onClick={submitEntry} disabled={saving} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow disabled:opacity-60">
              {saving && <Loader2 size={14} className="animate-spin" />} Save to database
            </button>
          </div>
        </div>
      </Modal>

      {/* CSV import modal */}
      <Modal open={importOpen} onClose={() => { setImportOpen(false); setDry(null); }} title="Import sales from CSV" wide={!!dry}>
        <input
          ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            const r = new FileReader();
            r.onload = () => { setCsv(String(r.result)); setDry(null); };
            r.readAsText(f);
          }}
        />
        {!dry ? (
          <div className="space-y-3">
            <p className="text-[12.5px] text-slate-500">Required columns: <code className="bg-slate-100 rounded px-1">dish, date, units</code>. <code className="bg-slate-100 rounded px-1">dish</code> matches a dish id or exact name (case-insensitive), <code className="bg-slate-100 rounded px-1">date</code> is YYYY-MM-DD (no future dates). You get a validation preview before anything is written.</p>
            <button onClick={() => fileRef.current?.click()} className="w-full rounded-2xl border-2 border-dashed border-slate-300 hover:border-amber-400 hover:bg-amber-50/40 py-7 flex flex-col items-center gap-1.5 text-slate-500">
              <Upload size={22} /> <span className="text-[13px] font-semibold">Choose a .csv file</span>
            </button>
            <p className="text-center text-[11px] text-slate-400">— or paste CSV below —</p>
            <textarea value={csv} onChange={(e) => setCsv(e.target.value)} rows={5} className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-[12px] outline-none focus:border-amber-400" placeholder={'dish,date,units\nButter Chicken,2026-10-10,34\ndal-makhani,2026-10-10,28'} />
            <div className="flex justify-end gap-2">
              <button onClick={() => setImportOpen(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50">Cancel</button>
              <button
                disabled={!csv.trim()}
                onClick={async () => {
                  try { setDry(await api.importSales(csv, false)); } catch (e: any) { toast(e.message || 'Validation failed', 'error'); }
                }}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Validate & preview
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3"><div className="text-xl font-bold text-emerald-700">{dry.validRows}</div><div className="text-[11px] text-emerald-600 font-semibold">valid rows</div></div>
              <div className="rounded-xl bg-rose-50 border border-rose-200 p-3"><div className="text-xl font-bold text-rose-700">{dry.errorRows}</div><div className="text-[11px] text-rose-600 font-semibold">rows with errors</div></div>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 col-span-2"><div className="text-xl font-bold">{dry.perDish.length}</div><div className="text-[11px] text-slate-500 font-semibold">dishes affected</div></div>
            </div>
            {dry.errors.length > 0 && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3.5 max-h-40 overflow-y-auto">
                <div className="text-[12px] font-bold text-rose-700 mb-1.5 flex items-center gap-1"><AlertTriangle size={13} /> These rows will be skipped:</div>
                {dry.errors.slice(0, 30).map((e, i) => <div key={i} className="text-[12px] text-rose-600">Row {e.row}: {e.message}</div>)}
                {dry.errors.length > 30 && <div className="text-[12px] text-rose-500">…and {dry.errors.length - 30} more</div>}
              </div>
            )}

            <div className="rounded-xl border border-slate-200 overflow-hidden max-h-40 overflow-y-auto">
              <table className="w-full text-[12.5px]">
                <thead className="bg-slate-50 text-left text-slate-500"><tr><th className="px-3 py-2 font-semibold">Dish</th><th className="px-3 py-2 font-semibold text-right">Units to import</th></tr></thead>
                <tbody>{dry.perDish.map((p) => <tr key={p.dish} className="border-t border-slate-100"><td className="px-3 py-1.5">{p.dish}</td><td className="px-3 py-1.5 text-right font-semibold">{p.units}</td></tr>)}</tbody>
              </table>
            </div>
            <div className="flex justify-between items-center gap-2">
              <button onClick={() => setDry(null)} className="text-[12.5px] font-semibold text-slate-500 hover:text-slate-700">← back to edit CSV</button>
              <div className="flex gap-2">
                <button onClick={() => { setImportOpen(false); setDry(null); }} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50">Cancel</button>
                <button onClick={doCommit} disabled={!dry.validRows || committing} className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow disabled:opacity-50">
                  {committing && <Loader2 size={14} className="animate-spin" />} Commit {dry.validRows} rows
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
