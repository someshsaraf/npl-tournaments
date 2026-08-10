import { NavLink, Outlet } from 'react-router-dom';
import {
  BarChart3,
  CalendarDays,
  Camera,
  Film,
  Home,
  MessageCircleQuestion,
  Radio,
  ScrollText,
  Trophy,
  Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const LOGO_SRC = '/nature-walk-logo-1.png';

const NAV: ReadonlyArray<{
  to: string;
  label: string;
  end: boolean;
  icon: LucideIcon;
}> = [
  { to: '/', label: 'Home', end: true, icon: Home },
  { to: '/schedule', label: 'Schedule', end: false, icon: CalendarDays },
  { to: '/teams', label: 'Teams', end: false, icon: Users },
  { to: '/results', label: 'Results', end: false, icon: Trophy },
  { to: '/stats', label: 'Stats', end: false, icon: BarChart3 },
  { to: '/photos', label: 'Photos', end: false, icon: Camera },
  { to: '/live', label: 'Live Stream', end: false, icon: Radio },
  { to: '/recordings', label: 'Recordings', end: false, icon: Film },
  { to: '/rules', label: 'Rules', end: false, icon: ScrollText },
  { to: '/ask', label: 'Ask', end: false, icon: MessageCircleQuestion }
];

/**
 * Public viewer shell. Admin (/admin) and scorer (/scorer) are intentionally
 * omitted from this nav — staff reach them by direct URL only.
 * Stateless layout; route state via React Router.
 */
export function PublicLayout() {
  return (
    <div className="npl-portal min-h-full flex flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-40 border-b border-emerald-900/40 bg-slate-950/90 backdrop-blur-md">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-5 pt-3 pb-2 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="shrink-0 rounded-xl bg-white p-1 shadow-md ring-1 ring-emerald-400/40 size-12 sm:size-14">
                <img
                  src={LOGO_SRC}
                  alt="Renaissance Nature Walk"
                  width={56}
                  height={56}
                  className="h-full w-full rounded-lg object-cover"
                  draggable={false}
                />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="portal-display text-4xl sm:text-5xl text-white tracking-wide truncate">
                  NPL 2026
                </p>
              </div>
            </div>
            <p className="hidden sm:block text-[10px] uppercase tracking-[0.18em] text-emerald-400/80 font-semibold shrink-0">
              Nature Walk
            </p>
          </div>

          <nav
            className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1"
            aria-label="Tournament portal"
          >
            {NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    [
                      'shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold uppercase tracking-wide transition-colors',
                      isActive
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                    ].join(' ')
                  }
                >
                  <Icon className="size-3.5 sm:size-4 shrink-0" aria-hidden />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-6xl px-3 sm:px-5 py-5 sm:py-7">
        <Outlet />
      </main>

      <footer className="border-t border-slate-800/80 py-4 text-center text-[11px] text-slate-500">
        NPL 2026 · Renaissance Nature Walk
      </footer>
    </div>
  );
}

export default PublicLayout;
