import { NavLink } from 'react-router-dom';
import {
  CalendarDays,
  Camera,
  ClipboardPen,
  ScrollText,
  Trophy,
  Users
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BrandBanner } from './BrandBanner';

const LINKS: ReadonlyArray<{
  to: string;
  label: string;
  end: boolean;
  icon: LucideIcon;
}> = [
  { to: '/admin', label: 'Schedule', end: true, icon: CalendarDays },
  { to: '/admin/score', label: 'Score Desk', end: false, icon: ClipboardPen },
  { to: '/admin/results', label: 'Results', end: false, icon: Trophy },
  { to: '/admin/photos', label: 'Photos', end: false, icon: Camera },
  { to: '/admin/teams', label: 'Teams', end: false, icon: Users },
  { to: '/rules', label: 'Rules', end: false, icon: ScrollText }
];

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
        {LINKS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                [
                  'inline-flex items-center gap-1.5 rounded-lg text-xs font-bold uppercase tracking-wide px-3 py-2 transition-colors',
                  item.to === '/admin/score'
                    ? 'bg-amber-400 text-slate-950 shadow hover:bg-amber-300'
                    : isActive
                      ? 'bg-emerald-500 text-slate-950 shadow'
                      : 'border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800'
                ].join(' ')
              }
            >
              <Icon className="size-3.5 shrink-0" aria-hidden />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

export default AdminNav;
