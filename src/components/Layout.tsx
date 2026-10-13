import React, { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, UtensilsCrossed, ChefHat, BarChart3, ShoppingBasket, Sparkles,
  FlaskConical, FileText, Settings as SettingsIcon, Bell, Search, Menu, X,
  Zap, RotateCcw, ChevronDown, MapPin, BrainCircuit, CheckCircle2, Info, AlertTriangle,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { Toggle, ConfirmDialog } from './ui';
import ChatWidget from './ChatWidget';
import GettingStarted from './GettingStarted';
import {useAuth} from '../store/AuthContext';

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/menu', label: 'Menu Intelligence', icon: UtensilsCrossed },
  { to: '/costing', label: 'Recipe Costing', icon: ChefHat },
  { to: '/sales', label: 'Sales Analytics', icon: BarChart3 },
  { to: '/expenses', label: 'Expenses & Profit', icon: BarChart3 },
  { to: '/ingredients', label: 'Ingredient Costs', icon: ShoppingBasket },
  { to: '/ai', label: 'AI Recommendations', icon: Sparkles },
  { to: '/simulator', label: 'Scenario Simulator', icon: FlaskConical },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const TITLES: [RegExp, string][] = [
  [/^\/$/, 'Dashboard'],
  [/^\/menu/, 'Menu Intelligence'],
  [/^\/dish\//, 'Dish Analysis'],
  [/^\/costing/, 'Recipe Costing'],
  [/^\/sales/, 'Sales Analytics'],
  [/^\/expenses/, 'Expenses & Profit'],
  [/^\/ingredients/, 'Ingredient Cost Intelligence'],
  [/^\/ai/, 'AI Recommendations'],
  [/^\/simulator/, 'Scenario Simulator'],
  [/^\/reports/, 'Reports'],
  [/^\/settings/, 'Settings'],
];

function Toasts() {
  const { toasts } = useApp();
  return (
    <div className="fixed bottom-5 right-5 z-[90] space-y-2 app-chrome pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={`anim-slide-in pointer-events-auto flex items-center gap-2.5 rounded-xl px-4 py-3 shadow-pop text-sm font-medium text-white max-w-sm ${t.type === 'success' ? 'bg-emerald-600' : t.type === 'error' ? 'bg-rose-600' : 'bg-slate-800'}`}>
          {t.type === 'success' ? <CheckCircle2 size={16} /> : t.type === 'error' ? <AlertTriangle size={16} /> : <Info size={16} />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function BackendBadge() {
  const { connected, booting } = useApp();
  if (booting) {
    return (
      <span className="hidden md:flex items-center gap-1.5 rounded-full border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-400" title="Connecting to the backendâ€¦">
        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-pulse" /> Connectingâ€¦
      </span>
    );
  }
  return connected ? (
    <span className="hidden md:flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700" title="API + SQLite connected â€” changes are persisted" data-testid="backend-badge">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Connected
    </span>
  ) : (
    <span className="hidden md:flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700" title="Backend API unreachable â€” data lives in this browser only" data-testid="backend-badge">
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Connection unavailable
    </span>
  );
}

export default function Layout() {
  const {user,logout}=useAuth();
  const { settings, range, setRange, alerts, demoMode, setDemoMode, resetDemo, booting, stale, dataSource } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [q, setQ] = useState('');
  const bellRef = useRef<HTMLDivElement>(null);
  const loc = useLocation();
  const nav = useNavigate();
  const title = TITLES.find(([re]) => re.test(loc.pathname))?.[1] ?? 'MarginMind';

  useEffect(() => { setMobileOpen(false); setBellOpen(false); }, [loc.pathname]);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const sidebar = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/80 w-[238px] shrink-0">
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-100">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white shadow-sm">
          <BrainCircuit size={20} />
        </div>
        <div>
          <div className="font-bold text-[15px] tracking-tight text-slate-900 leading-none">MarginMind</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Know what sells. Know what pays.</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {NAV.map((n) => (
          <NavLink
            key={n.to} to={n.to} end={n.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] font-medium transition-colors ${
                isActive ? 'bg-amber-50 text-amber-800 border border-amber-200/70' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`
            }
          >
            <n.icon size={17} className="shrink-0" />
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-100">
        <div className="rounded-xl bg-slate-50 border border-slate-200/70 p-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold">{settings.restaurant.slice(0,2).toUpperCase()||'MM'}</div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-800 truncate">{settings.restaurant}</div>
              <div className="flex items-center gap-1 text-[10px] text-slate-500"><MapPin size={9} />{settings.location}</div>
            </div>
          </div>
          <div className="mt-2 text-[10px] font-semibold text-amber-600 uppercase tracking-wide">Your restaurant</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex print-root">
      <div className="hidden lg:block app-chrome">{sidebar}</div>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex app-chrome">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <div className="relative anim-slide-in">{sidebar}</div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col h-full">
        {/* Top bar */}
        <header className="h-16 bg-white/90 backdrop-blur border-b border-slate-200/80 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 shrink-0 app-chrome sticky top-0 z-40">
          <button className="lg:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={19} />
          </button>
          <h1 className="text-[15px] sm:text-[17px] font-semibold text-slate-900 tracking-tight whitespace-nowrap">{title}</h1>

          <div className="flex-1" />

          <div className="hidden md:flex items-center relative">
            <Search size={15} className="absolute left-3 text-slate-400" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && q.trim()) nav(`/menu?q=${encodeURIComponent(q.trim())}`); }}
              placeholder="Search dishesâ€¦"
              className="w-44 xl:w-56 rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-sm outline-none focus:border-amber-400 focus:bg-white transition-colors"
            />
          </div>

          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value) as 7 | 30 | 90)}
            className="rounded-xl border border-slate-200 bg-slate-50 text-sm px-2.5 py-2 font-medium text-slate-700 outline-none focus:border-amber-400"
            aria-label="Date range"
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
            <option value={90}>90 days</option>
          </select>

          <div className="relative" ref={bellRef}>
            <button onClick={() => setBellOpen((v) => !v)} className="relative p-2 rounded-xl hover:bg-slate-100 text-slate-600" aria-label="Notifications">
              <Bell size={18} />
              {alerts.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-rose-500 text-white text-[9px] font-bold flex items-center justify-center">
                  {alerts.length}
                </span>
              )}
            </button>
            {bellOpen && (
              <div className="absolute right-0 mt-2 w-[340px] bg-white rounded-2xl shadow-pop border border-slate-200 z-50 anim-fade-up overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 font-semibold text-sm">Alerts</div>
                <div className="max-h-80 overflow-y-auto">
                  {alerts.length === 0 && <div className="p-4 text-sm text-slate-500">All clear â€” no alerts right now.</div>}
                  {alerts.map((a, i) => (
                    <button key={i} onClick={() => nav(a.to)} className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-50 flex gap-3 items-start">
                      <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${a.level === 'high' ? 'bg-rose-500' : a.level === 'attention' ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ animation: 'pulseDot 2s infinite' }} />
                      <span className="text-[13px] text-slate-700 leading-snug">{a.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <BackendBadge /><button onClick={()=>{void logout().catch(()=>alert('Unable to sign out. Check your connection and retry.'));}} className="text-xs font-semibold text-slate-500 hover:text-amber-700 px-2" title={user?.owner}>Sign out</button>



          <button className="hidden sm:flex items-center gap-2 rounded-xl border border-slate-200 pl-1.5 pr-2 py-1.5 hover:bg-slate-50">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white text-[11px] font-bold flex items-center justify-center">{settings.restaurant.slice(0,2).toUpperCase()||'MM'}</span>
            <span className="text-xs font-semibold text-slate-700 hidden lg:inline max-w-[120px] truncate">{settings.restaurant}</span>
            <ChevronDown size={13} className="text-slate-400" />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto">
          {booting ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white animate-pulse">MM</div>
              <p className="text-sm font-medium">Loading menu intelligenceâ€¦</p>
              <p className="text-xs">Checking backend connection</p>
            </div>
          ) : (
            <div className="px-4 sm:px-6 lg:px-8 py-6 max-w-[1440px] mx-auto">
              {stale && <div role="alert" className="mb-4 rounded-xl bg-amber-100 p-3 text-sm text-amber-900">Backend unavailable or refreshing. Showing the last loaded data; wait for reconnection before editing.</div>}<GettingStarted/><Outlet />
            </div>
          )}
        </main>
      </div>

      <ChatWidget />

      <Toasts />

    </div>
  );
}
