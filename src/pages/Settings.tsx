import React, { useState } from 'react';
import { Store, Coins, Percent, Target, Ruler, Database, RotateCcw, Save } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Card, CardHeader, Toggle, ConfirmDialog, EmptyState } from '../components/ui';

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block">
      <div className="text-[13px] font-medium text-slate-700">{label}</div>
      <div className="mt-1.5">{children}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
    </label>
  );
}

const inputCls = 'w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-400 bg-white';

export default function SettingsPage() {
  const { settings, updateSettings, analyzed, resetDemo, demoMode, setDemoMode, toast } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);

  const num = (v: number | null) => (v == null ? '' : String(v));

  return (
    <div className="max-w-3xl space-y-4">
      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Store size={16} className="text-slate-400" /> Restaurant Profile</span>} />
        <div className="grid sm:grid-cols-2 gap-4 p-5 pt-3">
          <Field label="Restaurant name">
            <input className={inputCls} value={settings.restaurant} onChange={(e) => updateSettings({ restaurant: e.target.value })} />
          </Field>
          <Field label="Location">
            <input className={inputCls} value={settings.location} onChange={(e) => updateSettings({ location: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Coins size={16} className="text-slate-400" /> Currency, Tax & Units</span>} />
        <div className="grid sm:grid-cols-3 gap-4 p-5 pt-3">
          <Field label="Currency">
            <select className={inputCls} value={settings.currency} onChange={(e) => updateSettings({ currency: e.target.value })}>
              <option value="₹">₹ INR — Indian Rupee</option>
              <option value="$">$ USD — US Dollar</option>
              <option value="€">€ EUR — Euro</option>
              <option value="£">£ GBP — Pound Sterling</option>
            </select>
          </Field>
          <Field label="Tax rate (GST)" hint="Display only in demo — pricing is tax-exclusive.">
            <div className="relative">
              <input type="number" min={0} max={28} className={inputCls} value={settings.taxPct} onChange={(e) => updateSettings({ taxPct: Number(e.target.value) })} />
              <Percent size={13} className="absolute right-3 top-3.5 text-slate-400" />
            </div>
          </Field>
          <Field label="Measurement units">
            <select className={inputCls} defaultValue="metric">
              <option value="metric">Metric (g / ml)</option>
              <option value="imperial" disabled>Imperial (oz) — n/a in demo</option>
            </select>
          </Field>
        </div>
      </Card>

      <Card className="border-amber-200/70">
        <CardHeader
          title={<span className="flex items-center gap-2"><Target size={16} className="text-amber-500" /> Classification Thresholds</span>}
          subtitle="These drive every Star / Plowhorse / Puzzle / Dog classification. Clear a field to return to automatic (menu average)."
        />
        <div className="grid sm:grid-cols-3 gap-4 p-5 pt-3">
          <Field label="Food Cost Target (%)" hint="Used by leak detection and re-engineering alerts.">
            <div>
              <input type="range" min={20} max={50} value={settings.foodCostTarget} onChange={(e) => updateSettings({ foodCostTarget: Number(e.target.value) })} className="w-full accent-amber-500" />
              <div className="text-center font-bold text-slate-800">{settings.foodCostTarget}%</div>
            </div>
          </Field>
          <Field label="Popularity Threshold (units/month)" hint={`Auto = menu average (${Math.round(analyzed.avgUnits || 0)}).`}>
            <input
              type="number" min={0} className={inputCls} placeholder={`Auto · ${Math.round(analyzed.avgUnits || 0)}`}
              value={num(settings.popThreshold)}
              onChange={(e) => updateSettings({ popThreshold: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </Field>
          <Field label={`Profitability Threshold (CM/unit)`} hint={`Auto = menu average (${analyzed.avgCm ? analyzed.avgCm.toFixed(0) : 0}).`}>
            <input
              type="number" min={0} className={inputCls} placeholder={`Auto · ${analyzed.avgCm ? analyzed.avgCm.toFixed(0) : 0}`}
              value={num(settings.marginThreshold)}
              onChange={(e) => updateSettings({ marginThreshold: e.target.value === '' ? null : Number(e.target.value) })}
            />
          </Field>
        </div>
        <div className="px-5 pb-4 flex items-center justify-between">
          <div className="text-[12px] text-slate-500">
            Effective thresholds → Popularity: <b>{Math.round(analyzed.popT)} units</b> · Margin: <b>{settings.currency}{Math.round(analyzed.marT)}/plate</b>
          </div>
          <button onClick={() => toast('Settings saved — classifications recalculated live.', 'success')} className="flex items-center gap-1.5 rounded-xl bg-slate-900 text-white text-[13px] font-semibold px-4 py-2.5 hover:bg-slate-800">
            <Save size={14} /> Save
          </button>
        </div>
      </Card>

      <Card>
        <CardHeader title={<span className="flex items-center gap-2"><Database size={16} className="text-slate-400" /> Demo Data</span>} subtitle="MarginMind ships with the seeded Musafir Cafe dataset (Dehradun)." />
        <div className="p-5 pt-3 flex flex-wrap items-center gap-4">
          <Toggle on={demoMode} onChange={setDemoMode} label="Demo Mode (seeded data)" />
          <div className="flex-1" />
          <button onClick={() => setConfirmReset(true)} className="flex items-center gap-1.5 rounded-xl border border-rose-200 text-rose-600 text-[13px] font-semibold px-4 py-2.5 hover:bg-rose-50">
            <RotateCcw size={14} /> Reset Demo Data
          </button>
        </div>
        <p className="px-5 pb-5 text-[12px] text-slate-500">
          Turning Demo Mode off shows empty states (your real dataset would load here in production). Resetting restores the original seeded dishes, ingredient prices and settings.
          This application uses local demo data only — no logins, API keys or databases required.
        </p>
      </Card>

      <ConfirmDialog
        open={confirmReset}
        onCancel={() => setConfirmReset(false)}
        onConfirm={() => { resetDemo(); setConfirmReset(false); }}
        title="Reset demo data?"
        body="This restores the original Musafir Cafe dataset and default settings. Your edits will be discarded."
      />
    </div>
  );
}
