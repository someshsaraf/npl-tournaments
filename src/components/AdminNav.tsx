import { NavLink } from 'react-router-dom';
import { CalendarDays, Monitor, Trophy, Users, BookOpen } from 'lucide-react';

const LOGO_SRC = '/nature-walk-logo-1.png';

const LINKS = [
  { to: '/admin', label: 'Schedule', end: true, accent: false, icon: CalendarDays },
  { to: '/admin/score', label: 'Score Desk', end: false, accent: true, icon: Monitor },
  { to: '/admin/results', label: 'Results', end: false, accent: false, icon: Trophy },
  { to: '/admin/teams', label: 'Teams', end: false, accent: false, icon: Users },
  { to: '/rules', label: 'Rules', end: false, accent: false, icon: BookOpen }
] as const;

/**
 * Shared staff nav for admin pages.
 * Input: optional subtitle string; falls back to Tournament Control.
 */
export function AdminNav({ subtitle = 'Tournament Control' }: { subtitle?: string }) {
  const safeSubtitle =
    typeof subtitle === 'string' && subtitle.trim() ? subtitle.trim() : 'Tournament Control';

  return (
    <header className="admin-panel px-4 sm:px-6 py-4 sm:py-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 size-11 rounded-xl bg-white p-0.5 ring-1 ring-[var(--admin-line)] overflow-hidden">
            <img
              src={LOGO_SRC}
              alt="NPL"
              width={44}
              height={44}
              className="h-full w-full rounded-[0.65rem] object-cover"
              draggable={false}
            />
          </span>
          <div className="min-w-0">
            <p className="admin-display text-2xl sm:text-3xl text-[var(--admin-lime)] leading-none">
              NPL Admin
            </p>
            <p className="text-[11px] text-[var(--admin-muted)] mt-1 font-medium tracking-wide">
              {safeSubtitle}
            </p>
          </div>
        </div>
        <p className="hidden sm:block text-[10px] uppercase tracking-[0.2em] text-[var(--admin-muted)] font-semibold">
          Staff console
        </p>
      </div>

      <nav
        className="flex flex-wrap items-center gap-1.5"
        aria-label="Admin navigation"
      >
        {LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'flex items-center gap-1.5 rounded-lg text-[11px] sm:text-xs font-bold uppercase tracking-wide px-3 py-2 transition-colors',
                  item.accent
                    ? 'bg-[var(--admin-lime)] text-[var(--admin-bg)] hover:brightness-110'
                    : isActive
                      ? 'bg-[var(--admin-teal)] text-[var(--admin-bg)]'
                      : 'border border-[var(--admin-line)] bg-black/20 text-[var(--admin-ink)] hover:bg-white/5'
                ].join(' ')
              }
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </header>
  );
}

export default AdminNav;
