import { ShieldAlert, Award, Dices } from 'lucide-react';

/**
 * Public rules page (portal shell provides nav). Read-only static content.
 */
export default function RulesPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <header className="space-y-1 border-b border-slate-800 pb-4">
        <h1 className="portal-display text-3xl sm:text-4xl text-amber-300 tracking-wide">
          Official Rules
        </h1>
        <p className="text-sm text-slate-400">NPL 2026 regulations for players and spectators.</p>
      </header>

      <section className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-3">
        <h2 className="text-xl font-bold flex items-center gap-2 text-emerald-400">
          <ShieldAlert className="w-5 h-5" /> General Rules & Guidelines
        </h2>
        <ul className="list-disc list-inside space-y-2 text-slate-300 text-sm md:text-base">
          <li>Match referee&apos;s decision is final. Arguing with referee leads to penalties.</li>
          <li>All players must arrive at least 10 minutes prior to scheduled slot.</li>
          <li>Non-marking shoes are strictly required on court.</li>
          <li>Service contact point must be below 1.15m; spin serves are banned.</li>
        </ul>
      </section>

      <section className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-3">
        <h2 className="text-xl font-bold flex items-center gap-2 text-amber-400">
          <Award className="w-5 h-5" /> Team Championship & Trump Rules
        </h2>
        <ul className="list-disc list-inside space-y-2 text-slate-300 text-sm md:text-base">
          <li>5 Teams, 5 players each. Each tie has 5 matches (1 Singles, 4 Ranked Doubles).</li>
          <li>
            Group Stage matches are a race to 15 points. From 14-14, win by 2; at 21-21 the next
            point wins (golden point).
          </li>
          <li>
            <strong className="text-amber-400">Trump Game:</strong> Winning a Trump game gives{' '}
            <strong>+2 points</strong>; losing gives <strong>-1 point</strong>.
          </li>
          <li>Each team must specify exactly 1 Trump Game per match tie.</li>
        </ul>
      </section>

      <section className="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 space-y-3">
        <h2 className="text-xl font-bold flex items-center gap-2 text-sky-400">
          <Dices className="w-5 h-5" /> Category Formats
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <h3 className="font-semibold text-emerald-300">Kids &amp; Women&apos;s Categories</h3>
            <p className="text-slate-400 mt-1">
              Race to 15 points. Deuce from 14-14 (win by 2); at 21-21 the next point wins (golden
              point).
            </p>
          </div>
          <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            <h3 className="font-semibold text-emerald-300">Men&apos;s Categories</h3>
            <p className="text-slate-400 mt-1">
              Race to 21 points. Deuce from 20-20 (win by 2); at 30-30 the next point wins (golden
              point).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
