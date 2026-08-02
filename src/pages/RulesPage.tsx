import { ShieldAlert, Award, Dices } from 'lucide-react';
import { PageHeader } from '../components/ui/PageHeader';

const SECTIONS = [
  {
    icon: ShieldAlert,
    title: 'General Rules & Guidelines',
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
    items: [
      '5 Teams, 5 players each. Each tie has 5 matches (1 Singles, 4 Ranked Doubles).',
      'Group Stage matches are a race to 15 points. From 14-14, win by 2; at 15-15 the next point wins (golden point).',
      'Trump Game: Winning a Trump game gives +2 points; losing gives -1 point.',
      'Each team must specify exactly 1 Trump Game per match tie.'
    ]
  }
] as const;

/**
 * Goalkick-style rules page with dark cards.
 */
export default function RulesPage() {
  return (
    <div className="portal-page space-y-8 max-w-4xl">
      <PageHeader
        label="Regulations"
        title="Official Rules"
        description="NPL 2026 regulations for players and spectators."
      />

      {SECTIONS.map((section) => {
        const Icon = section.icon;
        return (
          <section key={section.title} className="portal-card p-6 space-y-4 gk-stripe">
            <h2 className="flex items-center gap-3">
              <span className="inline-flex size-10 items-center justify-center rounded-sm bg-[var(--gk-red)]/15 text-[var(--gk-red)]">
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="portal-display text-xl text-[var(--gk-ink)]">{section.title}</span>
            </h2>
            <ul className="space-y-3 text-[var(--gk-muted)] text-sm md:text-base">
              {section.items.map((item) => (
                <li key={item} className="flex gap-3 leading-relaxed">
                  <span className="text-[var(--gk-red)] font-bold shrink-0">▸</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <section className="portal-card p-6 space-y-4 gk-stripe">
        <h2 className="flex items-center gap-3">
          <span className="inline-flex size-10 items-center justify-center rounded-sm bg-[var(--gk-gold)]/15 text-[var(--gk-gold)]">
            <Dices className="size-5" aria-hidden />
          </span>
          <span className="portal-display text-xl text-[var(--gk-ink)]">Category Formats</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-sm bg-[var(--gk-surface-2)] border border-[var(--gk-line)] p-5">
            <h3 className="portal-display text-base text-[var(--gk-ink)]">
              Kids & Women&apos;s
            </h3>
            <p className="text-[var(--gk-muted)] mt-2 leading-relaxed">
              Race to 15 points. Deuce from 14-14 (win by 2); at 21-21 the next point wins
              (golden point).
            </p>
          </div>
          <div className="rounded-sm bg-[var(--gk-surface-2)] border border-[var(--gk-line)] p-5">
            <h3 className="portal-display text-base text-[var(--gk-ink)]">Men&apos;s</h3>
            <p className="text-[var(--gk-muted)] mt-2 leading-relaxed">
              Race to 21 points. Deuce from 20-20 (win by 2); at 30-30 the next point wins
              (golden point).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
