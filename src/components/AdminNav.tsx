import { NavLink, useNavigate } from 'react-router-dom';
import { Camera, LogOut, PartyPopper, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { BrandBanner } from './BrandBanner';
import { useAuth } from '../contexts/AuthContext';

/**
 * Score Desk / Results / Teams / (badminton/tennis) Schedule are sport-specific
 * — reached from a sports event's own config page (its "Tournament Admin"
 * section), not from this general nav. Only whole-site tools live here.
 */
const LINKS: ReadonlyArray<{
  to: string;
  label: string;
  end: boolean;
  icon: LucideIcon;
}> = [
  { to: '/admin/events', label: 'Events', end: false, icon: PartyPopper },
  { to: '/admin/photos', label: 'Photos', end: false, icon: Camera },
  { to: '/admin/users', label: 'Accounts', end: false, icon: Users }
];

/**
 * Shared staff nav for admin pages. Sport-specific tools (Score Desk,
 * Results, Teams, fixtures) are reached from each sports event's own
 * config page instead of this general nav.
 */
export function AdminNav({ subtitle = 'Tournament Control' }: { subtitle?: string }) {
  const safeSubtitle =
    typeof subtitle === 'string' && subtitle.trim() ? subtitle.trim() : 'Tournament Control';
  const navigate = useNavigate();
  const { admin, logout } = useAuth();

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
                  isActive
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
        {admin ? (
          <button
            type="button"
            onClick={() => {
              void logout().then(() => navigate('/admin/login'));
            }}
            className="inline-flex items-center gap-1.5 rounded-lg text-xs font-bold uppercase tracking-wide px-3 py-2 border border-red-900/60 bg-red-950/30 text-red-300 hover:bg-red-950/60 transition-colors"
          >
            <LogOut className="size-3.5 shrink-0" aria-hidden />
            Log out
          </button>
        ) : null}
      </nav>
    </div>
  );
}

export default AdminNav;
