import { NavLink } from 'react-router-dom';
import { BrandBanner } from './BrandBanner';

const LINKS = [
  { to: '/admin', label: 'Schedule', end: true },
  { to: '/admin/score', label: 'Score Desk', end: false },
  { to: '/admin/results', label: 'Results', end: false },
  { to: '/admin/teams', label: 'Teams', end: false },
  { to: '/rules', label: 'Rules', end: false }
] as const;

/**
 * Shared staff nav for admin pages (schedule / results / teams).
 * /admin/score is linked but renders outside this chrome when opened.
 */
export function AdminNav({ subtitle = 'Tournament Control' }: { subtitle?: string }) {
  const safeSubtitle =
    typeof subtitle === 'string' && subtitle.trim() ? subtitle.trim() : 'Tournament Control';

  return (
    <div className="flex flex-col items-center justify-center gap-3 border-b border-slate-800 pb-5 pt-1">
      <BrandBanner size="lg" subtitle={safeSubtitle} />
      <p className="text-[10px] text-slate-500 font-mono tracking-wider uppercase">Admin Console</p>
      <nav className="flex flex-wrap items-center justify-center gap-2" aria-label="Admin navigation">
        {LINKS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              [
                'rounded-lg text-xs font-bold uppercase tracking-wide px-3 py-2 transition-colors',
                item.to === '/admin/score'
                  ? 'bg-amber-400 text-slate-950 shadow hover:bg-amber-300'
                  : isActive
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
              ].join(' ')
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export default AdminNav;
