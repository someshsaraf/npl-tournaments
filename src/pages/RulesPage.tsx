import { ShieldAlert, Award, Dices } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';

const SECTIONS = [
  {
    icon: ShieldAlert,
    title: 'General Rules & Guidelines',
    color: 'text-[var(--pine-leaf)]',
    items: [
      "Match referee's decision is final. Arguing with referee leads to penalties.",
      'All players must arrive at least 10 minutes prior to scheduled slot.',
      'Non-marking shoes are strictly required on court.',
      'Service contact point must be below 1.15m; spin serves are banned.'
    ]
  },
  {
    icon: Award,
    title: 'Team Championship & Trump Rules',
    color: 'text-[var(--pine-clay)]',
    items: [
      '5 Teams, 5 players each. Each tie has 5 matches (1 Singles, 4 Ranked Doubles).',
      'Group Stage matches are a race to 15 points. From 14-14, win by 2; at 15-15 the next point wins (golden point).',
      'Trump Game: Winning a Trump game gives +2 points; losing gives -1 point.',
      'Each team must specify exactly 1 Trump Game per match tie.'
    ]
  }
] as const;

/**
 * Public rules page. Read-only static content.
 */
export default function RulesPage() {
  return (
    <div className="portal-page space-y-6 max-w-4xl">
      <PageHeader
        title="Official Rules"
        description="NPL 2026 regulations for players and spectators."
      />

      {SECTIONS.map((section) => {
        const Icon = section.icon;
        return (
          <section key={section.title} className="portal-card p-5 sm:p-6 space-y-3">
            <h2 className={`text-lg font-bold flex items-center gap-2 ${section.color}`}>
              <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[var(--pine-mist)]">
                <Icon className="size-4" aria-hidden />
              </span>
              {section.title}
            </h2>
            <ul className="space-y-2.5 text-[var(--pine-ink)] text-sm md:text-base">
              {section.items.map((item) => (
                <li key={item} className="flex gap-2.5 leading-relaxed">
                  <span className="text-[var(--pine-leaf)] font-bold shrink-0 mt-0.5">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="portal-card p-5 sm:p-6 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2 text-[var(--pine-sky)]">
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-[var(--pine-mist)]">
            <Dices className="size-4" aria-hidden />
          </span>
          Category Formats
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-[var(--pine-mist)] p-4 border border-[var(--pine-line)]">
            <h3 className="font-bold text-[var(--pine-deep)]">Kids & Women&apos;s Categories</h3>
            <p className="text-[var(--pine-muted)] mt-2 leading-relaxed">
              Race to 15 points. Deuce from 14-14 (win by 2); at 21-21 the next point wins
              (golden point).
            </p>
          </div>
          <div className="rounded-xl bg-[var(--pine-mist)] p-4 border border-[var(--pine-line)]">
            <h3 className="font-bold text-[var(--pine-deep)]">Men&apos;s Categories</h3>
            <p className="text-[var(--pine-muted)] mt-2 leading-relaxed">
              Race to 21 points. Deuce from 20-20 (win by 2); at 30-30 the next point wins
              (golden point).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
