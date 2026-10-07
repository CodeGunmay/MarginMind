import React from 'react';
import { ArrowDownRight, ArrowUpRight, Sparkles, X } from 'lucide-react';
import { Cls } from '../types';
import { CLS_META } from '../lib/calc';

export function Card({ children, className = '', ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-card ${className}`} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, right }: { title: React.ReactNode; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-1">
      <div>
        <h3 className="text-[15px] font-semibold text-slate-900 leading-tight">{title}</h3>
        {subtitle && <p className="text-[13px] text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function ClsBadge({ cls, size = 'md' }: { cls: Cls; size?: 'sm' | 'md' }) {
  const m = CLS_META[cls];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold ${m.bg} ${m.color} border ${m.border} ${size === 'sm' ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2.5 py-1'}`}>
      <span>{m.emoji}</span> {m.label}
    </span>
  );
}

export function Delta({ value, invert = false, suffix = 'vs last month' }: { value: number; invert?: boolean; suffix?: string }) {
  const good = invert ? value <= 0 : value >= 0;
  const Icon = value >= 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${good ? 'text-emerald-600' : 'text-rose-600'}`}>
      <Icon size={13} />
      {value >= 0 ? '+' : ''}{value.toFixed(1)}%
      <span className="text-slate-400 font-normal">{suffix}</span>
    </span>
  );
}

export function Sparkline({ data, color = '#f59e0b', height = 36 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return null;
  const w = 120, h = height;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - 3 - ((v - min) / span) * (h - 6)}`).join(' ');
  const last = data[data.length - 1];
  const lx = w, ly = h - 3 - ((last - min) / span) * (h - 6);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-[110px]" style={{ height }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lx - 1} cy={ly} r="2.6" fill={color} />
    </svg>
  );
}

export function ActionTag({ action }: { action: string }) {
  const map: Record<string, string> = {
    Promote: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    Reprice: 'bg-amber-50 text-amber-700 border-amber-200',
    'Re-engineer': 'bg-amber-50 text-amber-700 border-amber-200',
    Maintain: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Monitor: 'bg-slate-100 text-slate-600 border-slate-200',
    Review: 'bg-rose-50 text-rose-700 border-rose-200',
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${map[action] || map.Monitor}`}>{action}</span>;
}

export function actionFor(cls: Cls): string {
  return { star: 'Maintain', plowhorse: 'Reprice', puzzle: 'Promote', dog: 'Review' }[cls];
}

export function SeverityChip({ sev }: { sev: 'high' | 'medium' | 'low' }) {
  const map = {
    high: 'bg-rose-50 text-rose-700 border-rose-200',
    medium: 'bg-amber-50 text-amber-700 border-amber-200',
    low: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${map[sev]}`}>{sev}</span>;
}

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 anim-fade-in" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={`relative bg-white rounded-2xl shadow-pop max-h-[88vh] overflow-y-auto anim-fade-up ${wide ? 'w-full max-w-3xl' : 'w-full max-w-lg'}`}>
        <div className="sticky top-0 bg-white/95 backdrop-blur border-b border-slate-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <Card className="p-12 text-center">
      <div className="mx-auto w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4"><Sparkles size={22} /></div>
      <h3 className="font-semibold text-slate-800">{title}</h3>
      {hint && <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{hint}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Card>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button onClick={() => onChange(!on)} className="flex items-center gap-2 select-none" aria-pressed={on}>
      <span className={`w-9 h-5 rounded-full transition-colors relative ${on ? 'bg-amber-500' : 'bg-slate-300'}`}>
        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
    </button>
  );
}

export function ConfirmDialog({ open, onCancel, onConfirm, title, body }: { open: boolean; onCancel: () => void; onConfirm: () => void; title: string; body: string }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-slate-600">{body}</p>
      <div className="flex justify-end gap-2 mt-6">
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50">Cancel</button>
        <button onClick={onConfirm} className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700">Confirm</button>
      </div>
    </Modal>
  );
}

export function AILabel() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-semibold px-2 py-0.5">
      <Sparkles size={10} /> AI · Demo insight
    </span>
  );
}
