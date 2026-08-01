import { NavLink, Outlet } from 'react-router-dom';

const LOGO_SRC = '/nature-walk-logo-1.png';

const NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/schedule', label: 'Schedule', end: false },
  { to: '/teams', label: 'Teams', end: false },
  { to: '/results', label: 'Results', end: false },
  { to: '/live', label: 'Live', end: false },
  { to: '/rules', label: 'Rules', end: false }
] as const;

/**
 * Public viewer shell — light “Pine Court” theme.
 * Admin/scorer intentionally omitted from nav.
 */
export function PublicLayout() {
  return (
    <div className="npl-portal min-h-full flex flex-col text-[var(--pine-ink)]">
      <header className="sticky top-0 z-40 border-b border-[var(--pine-line)] bg-[color-mix(in_srgb,var(--pine-mist)_92%,transparent)] backdrop-blur-md">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-5 py-3 flex items-center justify-between gap-3">
          <NavLink to="/" className="flex items-center gap-2.5 min-w-0 group" end>
            <span className="shrink-0 rounded-xl bg-white p-0.5 shadow-sm ring-1 ring-[var(--pine-line)] size-10 overflow-hidden">
              <img
                src={LOGO_SRC}
                alt="Renaissance Nature Walk"
                width={40}
                height={40}
                className="h-full w-full rounded-[0.65rem] object-cover transition-transform duration-500 group-hover:scale-105"
                draggable={false}
              />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="portal-display text-[1.65rem] sm:text-[1.85rem] text-[var(--pine-deep)] tracking-tight truncate leading-none">
                NPL 2026
              </p>
              <p className="text-[10px] sm:text-[11px] text-[var(--pine-muted)] font-medium truncate">
                Nature Walk · Badminton
              </p>
            </div>
          </NavLink>

          <nav
            className="hidden md:flex items-center gap-0.5"
            aria-label="Tournament portal"
          >
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'rounded-lg px-3 py-2 text-[12px] font-semibold tracking-wide transition-colors',
                    isActive
                      ? 'bg-[var(--pine-deep)] text-[var(--pine-lime)]'
                      : 'text-[var(--pine-muted)] hover:text-[var(--pine-deep)] hover:bg-white/70'
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <nav
          className="md:hidden flex items-center gap-1 overflow-x-auto px-3 pb-3 -mt-0.5"
          aria-label="Tournament portal mobile"
        >
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-colors',
                  isActive
                    ? 'bg-[var(--pine-deep)] text-[var(--pine-lime)]'
                    : 'bg-white/80 text-[var(--pine-muted)] border border-[var(--pine-line)]'
                ].join(' ')
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="flex-1 w-full">
        <Outlet />
      </main>

      <footer className="border-t border-[var(--pine-line)] py-5 text-center text-[11px] text-[var(--pine-muted)] bg-[var(--pine-mist)]">
        NPL 2026 · Renaissance Nature Walk
      </footer>
    </div>
  );
}

export default PublicLayout;
