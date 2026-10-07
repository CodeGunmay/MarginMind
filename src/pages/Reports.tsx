import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileDown, FileSpreadsheet, Printer, BrainCircuit } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Card, CardHeader, ClsBadge, EmptyState, SeverityChip } from '../components/ui';
import { CLS_META, downloadCsv } from '../lib/calc';
import { Cls } from '../types';

export default function Reports() {
  const { analyzed, recs, leaks, money, moneyShort, settings, ings, toast } = useApp();
  const nav = useNavigate();
  const rows = analyzed.rows;
  const t = analyzed.totals;

  if (!rows.length) return <EmptyState title="No data" hint="Enable Demo Mode to generate a report." />;

  const top5 = [...rows].sort((a, b) => b.contribution - a.contribution).slice(0, 5);
  const bottom5 = [...rows].sort((a, b) => a.contribution - b.contribution).slice(0, 5);
  const byCls = (c: Cls) => rows.filter((r) => r.cls === c);
  const movers = ings.filter((i) => i.prev && Math.abs((i.price - i.prev) / i.prev) * 100 >= 4);
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  const revDelta = t.prevRevenue ? ((t.revenue - t.prevRevenue) / t.prevRevenue) * 100 : 0;
  const conDelta = t.prevContribution ? ((t.contribution - t.prevContribution) / t.prevContribution) * 100 : 0;

  const exportCsv = () => {
    downloadCsv('marginmind-menu-report.csv', rows.map((d) => ({
      Dish: d.name, Category: d.cat, 'Selling Price': d.price, 'Ingredient Cost': d.cost.toFixed(2),
      'Food Cost %': d.fcPct.toFixed(1), 'Units Sold': d.units, Revenue: Math.round(d.revenue),
      'Contribution/Unit': d.cm.toFixed(2), 'Total Contribution': Math.round(d.contribution),
      Popularity: d.pop, Profitability: d.prof, Classification: CLS_META[d.cls].label,
    })));
    toast('CSV exported — menu profitability report downloaded.', 'success');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 anim-fade-up app-chrome">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Monthly Menu Profitability Report</h2>
          <p className="text-[13px] text-slate-500">{settings.restaurant} · {settings.location} · Generated {today} · Demo data</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
            <FileSpreadsheet size={15} /> Export CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 text-white px-4 py-2.5 text-[13px] font-semibold shadow hover:opacity-95">
            <Printer size={15} /> Download PDF / Print
          </button>
        </div>
      </div>

      {/* printable report */}
      <Card className="print-area overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white px-8 py-7">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center"><BrainCircuit size={19} /></div>
            <div>
              <div className="font-bold text-lg tracking-tight leading-none">MarginMind Report</div>
              <div className="text-[11px] text-slate-300 mt-1">Menu Profitability Intelligence · {settings.restaurant}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {[
              { l: 'Monthly Revenue', v: moneyShort(t.revenue), d: revDelta },
              { l: 'Monthly Contribution', v: moneyShort(t.contribution), d: conDelta },
              { l: 'Avg Food Cost', v: `${t.avgFC.toFixed(1)}%` },
              { l: 'Units Sold', v: t.units.toLocaleString('en-IN') },
            ].map((k) => (
              <div key={k.l} className="rounded-xl bg-white/10 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-300">{k.l}</div>
                <div className="text-xl font-bold mt-1">{k.v}</div>
                {k.d != null && <div className={`text-[11px] font-semibold ${k.d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{k.d >= 0 ? '+' : ''}{k.d.toFixed(1)}% vs last month</div>}
              </div>
            ))}
          </div>
        </div>

        <div className="p-8 space-y-8">
          <section>
            <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2">Executive Summary</h3>
            <p className="text-[13.5px] text-slate-700 leading-relaxed mt-3">
              {settings.restaurant} generated <b>{money(t.revenue)}</b> in revenue and <b>{money(t.contribution)}</b> in contribution across {t.units.toLocaleString('en-IN')} plates this month
              ({conDelta >= 0 ? '+' : ''}{conDelta.toFixed(1)}% contribution vs last month). Average food cost stands at <b>{t.avgFC.toFixed(1)}%</b> against a {settings.foodCostTarget}% target.
              The menu currently holds <b>{byCls('star').length} Stars</b>, <b>{byCls('plowhorse').length} Plowhorses</b>, <b>{byCls('puzzle').length} Puzzles</b> and <b>{byCls('dog').length} Dogs</b>.
              MarginMind detected <b>{leaks.length} profit leaks</b> totalling ≈{moneyShort(leaks.reduce((s, l) => s + Math.max(0, l.impact), 0))}/month and produced <b>{recs.length} ranked recommendations</b>.
            </p>
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            <section>
              <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2">Top 5 Dishes by Contribution</h3>
              <table className="w-full text-[12.5px] mt-2">
                <tbody>
                  {top5.map((d, i) => (
                    <tr key={d.id} className="border-b border-slate-100">
                      <td className="py-2 pr-2 text-slate-400 w-6">{i + 1}</td>
                      <td className="py-2 font-medium text-slate-800">{d.name} <ClsBadge cls={d.cls} size="sm" /></td>
                      <td className="py-2 text-right text-slate-600">{d.units} units</td>
                      <td className="py-2 text-right font-bold text-emerald-700">{money(d.contribution)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
            <section>
              <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2">Bottom 5 Dishes by Contribution</h3>
              <table className="w-full text-[12.5px] mt-2">
                <tbody>
                  {bottom5.map((d, i) => (
                    <tr key={d.id} className="border-b border-slate-100">
                      <td className="py-2 pr-2 text-slate-400 w-6">{i + 1}</td>
                      <td className="py-2 font-medium text-slate-800">{d.name} <ClsBadge cls={d.cls} size="sm" /></td>
                      <td className="py-2 text-right text-slate-600">{d.units} units</td>
                      <td className="py-2 text-right font-bold text-slate-700">{money(d.contribution)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>

          <section>
            <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2">Menu Engineering Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              {(Object.keys(CLS_META) as Cls[]).map((c) => {
                const l = byCls(c);
                return (
                  <div key={c} className={`rounded-xl border ${CLS_META[c].border} ${CLS_META[c].bg} p-3.5`}>
                    <div className="text-lg">{CLS_META[c].emoji} <span className={`text-sm font-bold ${CLS_META[c].color}`}>{CLS_META[c].label}S</span></div>
                    <div className="text-2xl font-bold mt-1 text-slate-800">{l.length}</div>
                    <div className="text-[11px] text-slate-500 truncate mt-1">{l.map((x) => x.name).join(', ') || '—'}</div>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-6">
            <section>
              <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2">Top Profit Leaks</h3>
              <div className="mt-2 space-y-2">
                {leaks.slice(0, 4).map((l) => (
                  <div key={l.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 p-3">
                    <div>
                      <div className="flex items-center gap-2"><span className="font-semibold text-[13px]">{l.title}</span><SeverityChip sev={l.severity} /></div>
                      <p className="text-[12px] text-slate-500 mt-0.5">{l.problem}</p>
                    </div>
                    <div className="text-[12px] font-bold text-rose-600 whitespace-nowrap">−{money(Math.round(Math.max(0, l.impact)))}</div>
                  </div>
                ))}
                {!leaks.length && <p className="text-[12.5px] text-slate-500">No leaks detected this month.</p>}
              </div>
            </section>
            <section>
              <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2">Ingredient Cost Changes</h3>
              <table className="w-full text-[12.5px] mt-2">
                <tbody>
                  {movers.map((i) => {
                    const chg = ((i.price - i.prev) / i.prev) * 100;
                    return (
                      <tr key={i.id} className="border-b border-slate-100">
                        <td className="py-2 font-medium text-slate-800">{i.name}</td>
                        <td className="py-2 text-right text-slate-500">{money(i.prev)} → {money(i.price)}/{i.unit}</td>
                        <td className={`py-2 text-right font-bold ${chg > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{chg > 0 ? '+' : ''}{chg.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                  {!movers.length && <tr><td className="py-2 text-slate-500" colSpan={3}>No significant price movements.</td></tr>}
                </tbody>
              </table>
            </section>
          </div>

          <section>
            <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2">AI Recommendations (Top 5)</h3>
            <div className="mt-2 space-y-2">
              {recs.slice(0, 5).map((r, i) => (
                <div key={r.id} className="rounded-xl border border-slate-100 p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[13px]">{i + 1}. {r.title}</span>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 whitespace-nowrap">{r.impactText}</span>
                  </div>
                  <p className="text-[12px] text-slate-500 mt-1">{r.action}</p>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-3">All projections are labelled estimates generated by the demo rules engine from this dataset — not guarantees. Scenario opportunities: price tests on plowhorses, substitution trials on cream/cheese, and visibility pushes on puzzles.</p>
          </section>
        </div>
      </Card>

      <div className="app-chrome">
        <Card className="p-5">
          <CardHeader title="Full data export" subtitle="Every analyzed metric for every dish." />
          <div className="px-5 pb-5">
            <button onClick={exportCsv} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 hover:bg-slate-50">
              <FileDown size={15} /> Download full menu dataset (CSV)
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
