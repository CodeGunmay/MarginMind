import React, { useState } from 'react';
import { BrainCircuit, UtensilsCrossed, ShoppingBasket, BarChart3, Sparkles, ArrowRight, ArrowLeft } from 'lucide-react';
import { useApp } from '../store/AppContext';

const STEPS = [
  {
    icon: UtensilsCrossed,
    title: 'Add your menu & recipes',
    body: 'Enter dishes, recipes, ingredient quantities and selling prices — or let the AI extractor parse plain-English recipes.',
  },
  {
    icon: ShoppingBasket,
    title: 'Track ingredient prices',
    body: 'Keep supplier prices current. MarginMind instantly recalculates every affected recipe and margin.',
  },
  {
    icon: BarChart3,
    title: 'Add sales data',
    body: 'Monthly sales volumes power popularity scoring and contribution analysis for every dish.',
  },
  {
    icon: Sparkles,
    title: 'Analyze & act',
    body: 'Get your menu engineering matrix, profit leak alerts, scenario simulations and prioritized AI recommendations.',
  },
];

export default function Onboarding() {
  const { setDemoMode, demoMode } = useApp();
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(() => {
    try { return !localStorage.getItem('mm_onboarded'); } catch { return true; }
  });

  if (!open || !demoMode) return null;

  const finish = (demo: boolean) => {
    setDemoMode(demo);
    try { localStorage.setItem('mm_onboarded', '1'); } catch {}
    setOpen(false);
  };

  const S = STEPS[step];

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 app-chrome">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-sm" />
      <div className="relative bg-white rounded-3xl shadow-pop w-full max-w-xl overflow-hidden anim-fade-up">
        <div className="bg-gradient-to-br from-amber-500 via-orange-500 to-orange-600 px-8 pt-8 pb-14 text-white relative">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center"><BrainCircuit size={22} /></div>
            <div>
              <div className="font-bold text-lg tracking-tight leading-none">MarginMind</div>
              <div className="text-[11px] text-amber-100 mt-1 italic">Know what sells. Know what pays.</div>
            </div>
          </div>
          <p className="mt-5 text-[15px] text-amber-50 leading-relaxed max-w-md">
            AI-powered menu intelligence that turns recipes, ingredient costs and sales data into smarter restaurant decisions.
          </p>
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-white" style={{ borderRadius: '24px 24px 0 0' }} />
        </div>

        <div className="px-8 pb-8 -mt-2">
          <div className="flex gap-1.5 mb-6">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full flex-1 transition-colors ${i <= step ? 'bg-amber-500' : 'bg-slate-200'}`} />
            ))}
          </div>
          <div className="flex items-start gap-4 min-h-[110px]">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
              <S.icon size={20} />
            </div>
            <div>
              <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Step {step + 1} of {STEPS.length}</div>
              <h3 className="font-semibold text-slate-900 mt-0.5">{S.title}</h3>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{S.body}</p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6">
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-30 px-3 py-2"
            >
              <ArrowLeft size={15} /> Back
            </button>
            <div className="flex gap-2">
              {step === STEPS.length - 1 ? (
                <>
                  <button onClick={() => finish(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 hover:bg-slate-50 text-slate-600">
                    Start empty
                  </button>
                  <button onClick={() => finish(true)} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow hover:opacity-95 flex items-center gap-1.5">
                    Use Demo Restaurant <ArrowRight size={15} />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => finish(true)} className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-800">
                    Skip setup
                  </button>
                  <button onClick={() => setStep((s) => s + 1)} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1.5">
                    Next <ArrowRight size={15} />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
