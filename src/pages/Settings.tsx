import React, { useState } from 'react';
import { Store, Coins, Percent, Target, Database, RotateCcw, Save, Eraser, Bot } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Card, CardHeader, Toggle, ConfirmDialog } from '../components/ui';

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
  const { settings, updateSettings, analyzed, resetDemo, demoMode, setDemoMode, toast, connected, dataSource, aiStatus } = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

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
          <Field label="Tax rate (GST)" hint="Prices and contributions are tax-exclusive; tax is recorded for reference.">
            <div className="relative">
              <input type="number" min={0} max={28} className={inputCls} value={settings.taxPct} onChange={(e) => updateSettings({ taxPct: Number(e.target.value) })} />
              <Percent size={13} className="absolute right-3 top-3.5 text-slate-400" />
            </div>
          </Field>
          <Field label="Measurement units">
            <select className={inputCls} defaultValue="metric">
              <option value="metric">Metric (g / ml)</option>
              <option value="imperial" disabled>Imperial (oz) — not supported</option>
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
          <Field label="Popularity Threshold (units/selected period)" hint={`Auto = menu average (${Math.round(analyzed.avgUnits || 0)}).`}>
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
          <button onClick={() => toast('Changes save automatically while connected. Watch for any save error.', 'info')} className="flex items-center gap-1.5 rounded-xl bg-slate-900 text-white text-[13px] font-semibold px-4 py-2.5 hover:bg-slate-800">
            <Save size={14} /> Save
          </button>
        </div>
      </Card>

      <Card><CardHeader title="Your restaurant data" subtitle="Your recipes, prices and sales are stored in your account’s private workspace."/><p className="p-5 pt-1 text-sm text-slate-500">{connected?'Connected — changes are stored securely in your restaurant database.':'Connection unavailable. Reconnect before making changes.'}</p></Card>

      <Card className="border-indigo-200/70">
        <CardHeader
          title={<span className="flex items-center gap-2"><Bot size={16} className="text-indigo-500" /> AI Services</span>}
          subtitle="Exactly which AI capabilities are live right now — no hidden cloud calls."
        />
        <div className="p-5 pt-2 space-y-2.5 text-[13px]">
          {!connected ? (
            <p className="text-slate-500">Backend offline — AI extraction, OCR and AI explanations require the backend (<code className="bg-slate-100 px-1 rounded">npm run server</code>). The local rule-based fallback stays available.</p>
          ) : (
            <>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <div className="font-semibold text-slate-800">Chat explanation model</div>
                  <div className="text-[12px] text-slate-500">Writes dish insights from computed metrics only</div>
                </div>
                {aiStatus?.llmConfigured ? (
                  <span className="rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 px-2.5 py-1 text-[11px] font-bold">🤖 {aiStatus.llmModel}</span>
                ) : (
                  <span className="rounded-full bg-slate-100 border border-slate-200 text-slate-600 px-2.5 py-1 text-[11px] font-bold">⚙️ rules fallback (no key configured)</span>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <div className="font-semibold text-slate-800">Recipe image OCR</div>
                  <div className="text-[12px] text-slate-500">tesseract.js on the server — no key required</div>
                </div>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 text-[11px] font-bold">✓ available</span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <div className="font-semibold text-slate-800">Voice dictation (Hindi / English)</div>
                  <div className="text-[12px] text-slate-500">Browser SpeechRecognition on the recipe page — no key required</div>
                </div>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-1 text-[11px] font-bold">✓ in Chrome/Edge</span>
              </div>
            </>
          )}
        </div>
      </Card>



    </div>
  );
}
