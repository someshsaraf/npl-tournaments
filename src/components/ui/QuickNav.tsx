import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import {
  CalendarDays,
  Users,
  Trophy,
  Radio,
  BookOpen
} from 'lucide-react';

type QuickNavItem = {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const ITEMS: QuickNavItem[] = [
  { to: '/schedule', label: 'Schedule', description: 'Match fixtures', icon: CalendarDays },
  { to: '/teams', label: 'Teams', description: 'Player rosters', icon: Users },
  { to: '/results', label: 'Results', description: 'Match outcomes', icon: Trophy },
  { to: '/live', label: 'Live', description: 'Stream & scores', icon: Radio },
  { to: '/rules', label: 'Rules', description: 'Regulations', icon: BookOpen }
];

export function QuickNav() {
  return (
    <nav
      aria-label="Quick navigation"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3"
    >
      {ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className="portal-card group flex flex-col items-center text-center gap-3 p-5 hover:border-[var(--gk-red)]/60 hover:bg-[var(--gk-surface-2)] transition-all"
          >
            <span className="inline-flex size-12 items-center justify-center rounded-sm bg-[var(--gk-red)]/15 text-[var(--gk-red)] transition-transform group-hover:scale-110">
              <Icon className="size-6" aria-hidden />
            </span>
            <div>
              <p className="portal-display text-base text-[var(--gk-ink)]">{item.label}</p>
              <p className="text-[11px] text-[var(--gk-muted)] mt-0.5 uppercase tracking-wide">
                {item.description}
              </p>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

export default QuickNav;
