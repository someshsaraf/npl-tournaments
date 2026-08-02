import { NavLink, Outlet } from 'react-router-dom';

const LOGO_SRC = '/nature-walk-logo-1.png';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/schedule', label: 'Schedule', end: false },
  { to: '/teams', label: 'Teams', end: false },
  { to: '/results', label: 'Results', end: false },
  { to: '/live', label: 'Live Stream', end: false },
  { to: '/rules', label: 'Rules', end: false },
  { to: '/ask', label: 'Ask', end: false }
] as const;

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
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="shrink-0 rounded-lg bg-white p-0.5 shadow-md ring-1 ring-emerald-400/40 size-10">
                <img
                  src={LOGO_SRC}
                  alt="Renaissance Nature Walk"
                  width={40}
                  height={40}
                  className="h-full w-full rounded-md object-cover"
                  draggable={false}
                />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="portal-display text-2xl sm:text-3xl text-white tracking-wide truncate">
                  NPL 2026
                </p>
                <p className="text-[10px] sm:text-xs text-slate-400 truncate">
                  Badminton Live Portal
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
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'shrink-0 rounded-lg px-3 py-2 text-xs sm:text-sm font-bold uppercase tracking-wide transition-colors',
                    isActive
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'bg-slate-900/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
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
