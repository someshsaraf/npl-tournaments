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
  accent: string;
};

const ITEMS: QuickNavItem[] = [
  {
    to: '/schedule',
    label: 'Schedule',
    description: 'When matches play',
    icon: CalendarDays,
    accent: 'bg-[var(--pine-clay)]/12 text-[var(--pine-clay)]'
  },
  {
    to: '/teams',
    label: 'Teams',
    description: 'Player rosters',
    icon: Users,
    accent: 'bg-[var(--pine-sky)]/12 text-[var(--pine-sky)]'
  },
  {
    to: '/results',
    label: 'Results',
    description: 'Match outcomes',
    icon: Trophy,
    accent: 'bg-[var(--pine-leaf)]/12 text-[var(--pine-leaf)]'
  },
  {
    to: '/live',
    label: 'Live',
    description: 'Stream & scores',
    icon: Radio,
    accent: 'bg-[var(--pine-clay)]/12 text-[var(--pine-clay)]'
  },
  {
    to: '/rules',
    label: 'Rules',
    description: 'How we play',
    icon: BookOpen,
    accent: 'bg-[var(--pine-deep)]/8 text-[var(--pine-deep)]'
  }
];

export function QuickNav() {
  return (
    <nav aria-label="Quick navigation" className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            className="portal-card group flex flex-col gap-3 p-4 hover:border-[var(--pine-leaf)]/40 hover:shadow-md transition-all"
          >
            <span
              className={`inline-flex size-10 items-center justify-center rounded-xl ${item.accent} transition-transform group-hover:scale-105`}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <div>
              <p className="font-bold text-[var(--pine-deep)] text-sm">{item.label}</p>
              <p className="text-xs text-[var(--pine-muted)] mt-0.5 leading-snug">
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
