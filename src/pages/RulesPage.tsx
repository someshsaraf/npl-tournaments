import { ShieldAlert, Award, Dices } from 'lucide-react';

/**
 * Public rules page. Read-only static content.
 */
export default function RulesPage() {
  return (
    <div className="portal-page space-y-6 max-w-4xl">
      <header className="space-y-1 pb-2">
        <h1 className="portal-display text-4xl sm:text-5xl text-[var(--pine-deep)]">
          Official Rules
        </h1>
        <p className="text-sm text-[var(--pine-muted)]">
          NPL 2026 regulations for players and spectators.
        </p>
      </header>

      <section className="bg-[var(--pine-paper)] p-5 sm:p-6 rounded-2xl border border-[var(--pine-line)] space-y-3 shadow-sm">
        <h2 className="text-lg font-bold flex items-center gap-2 text-[var(--pine-leaf)]">
          <ShieldAlert className="w-5 h-5" /> General Rules &amp; Guidelines
        </h2>
        <ul className="list-disc list-inside space-y-2 text-[var(--pine-ink)] text-sm md:text-base">
          <li>Match referee&apos;s decision is final. Arguing with referee leads to penalties.</li>
          <li>All players must arrive at least 10 minutes prior to scheduled slot.</li>
          <li>Non-marking shoes are strictly required on court.</li>
          <li>Service contact point must be below 1.15m; spin serves are banned.</li>
        </ul>
      </section>

      <section className="bg-[var(--pine-paper)] p-5 sm:p-6 rounded-2xl border border-[var(--pine-line)] space-y-3 shadow-sm">
        <h2 className="text-lg font-bold flex items-center gap-2 text-[var(--pine-clay)]">
          <Award className="w-5 h-5" /> Team Championship &amp; Trump Rules
        </h2>
        <ul className="list-disc list-inside space-y-2 text-[var(--pine-ink)] text-sm md:text-base">
          <li>5 Teams, 5 players each. Each tie has 5 matches (1 Singles, 4 Ranked Doubles).</li>
          <li>
            Group Stage matches are a race to 15 points. From 14-14, win by 2; at{' '}
            <strong className="text-[var(--pine-clay)]">15-15</strong> the next point wins
            (golden point).
          </li>
          <li>
            <strong className="text-[var(--pine-clay)]">Trump Game:</strong> Winning a Trump
            game gives <strong>+2 points</strong>; losing gives <strong>-1 point</strong>.
          </li>
          <li>Each team must specify exactly 1 Trump Game per match tie.</li>
        </ul>
      </section>

      <section className="bg-[var(--pine-paper)] p-5 sm:p-6 rounded-2xl border border-[var(--pine-line)] space-y-3 shadow-sm">
        <h2 className="text-lg font-bold flex items-center gap-2 text-[var(--pine-sky)]">
          <Dices className="w-5 h-5" /> Category Formats
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-[var(--pine-mist)] p-4 rounded-xl border border-[var(--pine-line)]">
            <h3 className="font-semibold text-[var(--pine-deep)]">
              Kids &amp; Women&apos;s Categories
            </h3>
            <p className="text-[var(--pine-muted)] mt-1.5 leading-relaxed">
              Race to 15 points. Deuce from 14-14 (win by 2); at 21-21 the next point wins
              (golden point).
            </p>
          </div>
          <div className="bg-[var(--pine-mist)] p-4 rounded-xl border border-[var(--pine-line)]">
            <h3 className="font-semibold text-[var(--pine-deep)]">Men&apos;s Categories</h3>
            <p className="text-[var(--pine-muted)] mt-1.5 leading-relaxed">
              Race to 21 points. Deuce from 20-20 (win by 2); at 30-30 the next point wins
              (golden point).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
