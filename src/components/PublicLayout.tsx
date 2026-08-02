import { NavLink, Outlet, Link } from 'react-router-dom';
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
    return 'text-[var(--gk-red)]';
  }
  if (highlight) {
    return 'text-[var(--gk-gold)] hover:text-[var(--gk-red)]';
  }
  return 'text-[var(--gk-muted)] hover:text-[var(--gk-ink)]';
}

/**
 * Goalkick-inspired public shell — dark header, red accents, sports club layout.
 */
export function PublicLayout() {
  return (
    <div className="npl-portal min-h-full flex flex-col">
      <header className="sticky top-0 z-40 bg-[var(--gk-surface)] border-b border-[var(--gk-line)] gk-stripe">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="flex items-center justify-between gap-4 py-3">
            <NavLink to="/" className="flex items-center gap-3 min-w-0 group" end>
              <span className="shrink-0 size-11 rounded-sm bg-[var(--gk-surface-2)] p-0.5 ring-1 ring-[var(--gk-line)] overflow-hidden">
                <img
                  src={LOGO_SRC}
                  alt="Renaissance Nature Walk"
                  width={44}
                  height={44}
                  className="h-full w-full rounded-[2px] object-cover"
                  draggable={false}
                />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="portal-display text-xl sm:text-2xl text-[var(--gk-ink)] truncate leading-none">
                  NPL 2026
                </p>
                <p className="text-[10px] text-[var(--gk-muted)] font-semibold uppercase tracking-wider truncate">
                  Nature Walk · Badminton
                </p>
              </div>
            </NavLink>

            <nav className="hidden lg:flex items-center gap-1" aria-label="Tournament portal">
              {NAV.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      [
                        'flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider transition-colors',
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

            <Link to="/live" className="hidden sm:inline-flex portal-btn-primary !py-2 !px-4 !text-xs">
              Watch Live
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full portal-main-with-nav">
        <Outlet />
      </main>

      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-[var(--gk-line)] bg-[var(--gk-surface)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        aria-label="Mobile navigation"
      >
        <div className="grid grid-cols-6 gap-0 px-0.5 pt-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  [
                    'flex flex-col items-center justify-center gap-0.5 py-2 text-[9px] font-bold uppercase tracking-wide min-h-[3.5rem] transition-colors',
                    isActive
                      ? 'text-[var(--gk-red)]'
                      : 'highlight' in item && item.highlight
                        ? 'text-[var(--gk-gold)]'
                        : 'text-[var(--gk-muted)]'
                  ].join(' ')
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={[
                        'flex items-center justify-center size-8 rounded-sm transition-colors',
                        isActive ? 'bg-[var(--gk-red)] text-white' : ''
                      ].join(' ')}
                    >
                      <Icon className="size-[17px]" aria-hidden />
                    </span>
                    <span className="leading-none">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      <footer className="hidden lg:block border-t border-[var(--gk-line)] bg-[var(--gk-surface)]">
        <div className="mx-auto max-w-7xl px-6 py-10 grid grid-cols-3 gap-8">
          <div>
            <p className="portal-display text-lg text-[var(--gk-ink)] mb-2">NPL 2026</p>
            <p className="text-sm text-[var(--gk-muted)] leading-relaxed">
              Renaissance Nature Walk community badminton tournament — live scores, schedule, and
              results.
            </p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gk-red)] mb-3">
              Quick Links
            </p>
            <ul className="space-y-2 text-sm text-[var(--gk-muted)]">
              {NAV.filter((n) => n.to !== '/').map((item) => (
                <li key={item.to}>
                  <Link to={item.to} className="hover:text-[var(--gk-ink)] transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-[var(--gk-red)] mb-3">
              Tournament
            </p>
            <p className="text-sm text-[var(--gk-muted)]">
              Team Championship · Singles · Doubles
            </p>
            <p className="text-sm text-[var(--gk-muted)] mt-2">Renaissance Nature Walk</p>
          </div>
        </div>
        <div className="border-t border-[var(--gk-line)] py-4 text-center text-[11px] text-[var(--gk-muted)] uppercase tracking-wider">
          © NPL 2026 · Renaissance Nature Walk
        </div>
      </footer>
    </div>
  );
}

export default PublicLayout;
