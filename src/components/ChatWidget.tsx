import React, { useEffect, useRef, useState } from 'react';
import { MessageSquareText, X, Send, Sparkles } from 'lucide-react';
import { useApp } from '../store/AppContext';
import { askAI } from '../lib/ai';

interface Msg { who: 'me' | 'ai'; text: string; }

const QUICK = [
  'Which dishes should I promote?',
  'Why is my food cost high?',
  'Which dishes are losing money?',
  'What happens if chicken prices increase 10%?',
  'Which dish should I reprice?',
  'What are my biggest profit leaks?',
  'Which three dishes should I focus on first?',
];

export default function ChatWidget() {
  const { analyzed, ings, settings, recs, leaks } = useApp();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([
    { who: 'ai', text: "Hi, I'm MarginMind AI 👋 I analyze your live menu data — dishes, costs, sales and margins. Ask me anything, or tap a suggestion below." },
  ]);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bodyRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }); }, [msgs, thinking, open]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || thinking) return;
    setMsgs((m) => [...m, { who: 'me', text: t }]);
    setInput('');
    setThinking(true);
    const ctx = { rows: analyzed.rows, ingMap: analyzed.ingMap, ings, settings, popT: analyzed.popT, marT: analyzed.marT, avgCm: analyzed.avgCm, avgUnits: analyzed.avgUnits, totals: analyzed.totals };
    setTimeout(() => {
      const ans = askAI(t, ctx, recs, leaks);
      setMsgs((m) => [...m, { who: 'ai', text: ans }]);
      setThinking(false);
    }, 650);
  };

  return (
    <div className="app-chrome">
      {open && (
        <div className="fixed bottom-20 right-4 sm:right-5 z-[80] w-[calc(100vw-2rem)] max-w-[400px] h-[540px] max-h-[70vh] bg-white rounded-2xl shadow-pop border border-slate-200 flex flex-col overflow-hidden anim-fade-up">
          <div className="flex items-center gap-2.5 px-4 py-3.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white shrink-0">
            <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center"><Sparkles size={16} /></div>
            <div className="flex-1">
              <div className="font-semibold text-sm leading-none">Ask MarginMind</div>
              <div className="text-[10px] text-amber-100 mt-1">Simulated AI · answers based on your demo dataset</div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg hover:bg-white/15" aria-label="Close chat"><X size={16} /></button>
          </div>

          <div ref={bodyRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/60">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.who === 'me' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap ${m.who === 'me' ? 'bg-amber-500 text-white rounded-br-md' : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-md px-3.5 py-2.5 shadow-sm flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400" style={{ animation: `pulseDot 1s ${i * 0.18}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            {msgs.length <= 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK.slice(0, 4).map((q) => (
                  <button key={q} onClick={() => send(q)} className="text-[11px] font-medium bg-white border border-amber-200 text-amber-700 rounded-full px-2.5 py-1.5 hover:bg-amber-50 transition-colors">
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-100 bg-white shrink-0">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && send(input)}
                placeholder="Ask about dishes, costs, margins…"
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-amber-400"
              />
              <button onClick={() => send(input)} className="p-2.5 rounded-xl bg-amber-500 text-white hover:bg-amber-600 transition-colors" aria-label="Send">
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-5 z-[75] flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-600 text-white pl-3.5 pr-4 py-3 shadow-pop hover:scale-[1.03] active:scale-95 transition-transform"
        aria-label="Ask MarginMind"
      >
        {open ? <X size={18} /> : <MessageSquareText size={18} />}
        <span className="text-sm font-semibold">{open ? 'Close' : 'Ask MarginMind'}</span>
      </button>
    </div>
  );
}
