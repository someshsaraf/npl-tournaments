import { NavLink, Outlet } from 'react-router-dom';
import {
  Home,
  CalendarDays,
  Users,
  Trophy,
  Radio,
  BookOpen
} from 'lucide-react';

const LOGO_SRC = '/nature-walk-logo-1.png';

const NAV = [
  { to: '/', label: 'Home', end: true, icon: Home },
  { to: '/schedule', label: 'Schedule', end: false, icon: CalendarDays },
  { to: '/teams', label: 'Teams', end: false, icon: Users },
  { to: '/results', label: 'Results', end: false, icon: Trophy },
  { to: '/live', label: 'Live', end: false, icon: Radio, highlight: true },
  { to: '/rules', label: 'Rules', end: false, icon: BookOpen }
] as const;

function navClass(isActive: boolean, highlight?: boolean) {
  if (isActive) {
    return 'bg-[var(--pine-deep)] text-[var(--pine-lime)]';
  }
  if (highlight) {
    return 'text-[var(--pine-clay)] hover:bg-[var(--pine-clay)]/10';
  }
  return 'text-[var(--pine-muted)] hover:text-[var(--pine-deep)] hover:bg-white/70';
}

/**
 * Public viewer shell — light “Pine Court” theme.
 * Desktop: top nav with icons. Mobile: bottom tab bar for thumb-friendly access.
 */
export function PublicLayout() {
  return (
    <div className="npl-portal min-h-full flex flex-col text-[var(--pine-ink)]">
      <header className="sticky top-0 z-40 border-b border-[var(--pine-line)] bg-[color-mix(in_srgb,var(--pine-mist)_94%,transparent)] backdrop-blur-md">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <NavLink to="/" className="flex items-center gap-3 min-w-0 group" end>
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
              <p className="portal-display text-xl sm:text-2xl text-[var(--pine-deep)] tracking-tight truncate leading-none">
                NPL 2026
              </p>
              <p className="text-[10px] sm:text-[11px] text-[var(--pine-muted)] font-medium truncate">
                Nature Walk · Badminton
              </p>
            </div>
          </NavLink>

          <nav
            className="hidden md:flex items-center gap-1"
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
                      'flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors',
                      navClass(isActive, 'highlight' in item && item.highlight)
                    ].join(' ')
                  }
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full portal-main-with-nav">
        <Outlet />
      </main>

      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t border-[var(--pine-line)] bg-[color-mix(in_srgb,var(--pine-paper)_96%,transparent)] backdrop-blur-md"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-6 gap-0.5 px-1 pt-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl text-[10px] font-semibold transition-colors min-h-[3.25rem]',
                    isActive
                      ? 'text-[var(--pine-deep)]'
                      : 'highlight' in item && item.highlight
                        ? 'text-[var(--pine-clay)]'
                        : 'text-[var(--pine-muted)]'
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={[
                        'flex items-center justify-center size-8 rounded-xl transition-colors',
                        isActive ? 'bg-[var(--pine-deep)] text-[var(--pine-lime)]' : ''
                      ].join(' ')}
                    >
                      <Icon className="size-[18px]" aria-hidden />
                    </span>
                    <span className="leading-none">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <footer className="hidden md:block border-t border-[var(--pine-line)] py-5 text-center text-[11px] text-[var(--pine-muted)] bg-[var(--pine-mist)]">
        NPL 2026 · Renaissance Nature Walk
      </footer>
    </div>
  );
}

export default PublicLayout;
