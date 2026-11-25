import { ShieldAlert, Award, Dices, Trophy } from 'lucide-react';
import type { Sport } from '../../data/tournamentData';

/** Official rules for one sport, embedded inside that sport's event detail page. */
export function RulesView({ sport }: { sport: Sport }) {
  return sport === 'tennis' ? <TennisRules /> : <BadmintonRules />;
}

function BadmintonRules() {
  return (
    <div className="space-y-6">
      <section className="bg-paper-soft p-5 rounded-2xl border border-line space-y-3">
        <h3 className="text-xl font-bold flex items-center gap-2 text-emerald-700">
          <ShieldAlert className="w-5 h-5" /> General Rules & Guidelines
        </h3>
        <ul className="list-disc list-inside space-y-2 text-ink-soft text-sm md:text-base">
          <li>Match referee&apos;s decision is final. Arguing with referee leads to penalties.</li>
          <li>All players must arrive at least 10 minutes prior to scheduled slot.</li>
          <li>Non-marking shoes are strictly required on court.</li>
          <li>Service contact point must be below 1.15m; spin serves are banned.</li>
        </ul>
      </section>

      <section className="bg-paper-soft p-5 rounded-2xl border border-line space-y-3">
        <h3 className="text-xl font-bold flex items-center gap-2 text-amber-700">
          <Award className="w-5 h-5" /> Team Championship & Trump Rules
        </h3>
        <ul className="list-disc list-inside space-y-2 text-ink-soft text-sm md:text-base">
          <li>5 Teams, 5 players each. Each tie has 5 matches (1 Singles, 4 Ranked Doubles).</li>
          <li>
            Group Stage matches are a race to 15 points. From 14-14, win by 2; at{' '}
            <strong className="text-amber-700">15-15</strong> the next point wins (golden point).
          </li>
          <li>
            <strong className="text-amber-700">Trump Game:</strong> Winning a Trump game gives{' '}
            <strong>+2 points</strong>; losing gives <strong>-1 point</strong>.
          </li>
          <li>Each team must specify exactly 1 Trump Game per match tie.</li>
        </ul>
      </section>

      <section className="bg-paper-soft p-5 rounded-2xl border border-line space-y-3">
        <h3 className="text-xl font-bold flex items-center gap-2 text-sky-700">
          <Dices className="w-5 h-5" /> Category Formats
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="bg-white p-3 rounded-lg border border-line">
            <h4 className="font-semibold text-emerald-700">Kids &amp; Women&apos;s Categories</h4>
            <p className="text-slate-500 mt-1">
              Race to 15 points. Deuce from 14-14 (win by 2); at 21-21 the next point wins (golden
              point).
            </p>
          </div>
          <div className="bg-white p-3 rounded-lg border border-line">
            <h4 className="font-semibold text-emerald-700">Men&apos;s Categories</h4>
            <p className="text-slate-500 mt-1">
              Race to 21 points. Deuce from 20-20 (win by 2); at 30-30 the next point wins (golden
              point).
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function TennisRules() {
  return (
    <section className="bg-paper-soft p-5 rounded-2xl border border-line space-y-3">
      <h3 className="text-xl font-bold flex items-center gap-2 text-sky-700">
        <Trophy className="w-5 h-5" /> Tennis Formats — Singles &amp; Doubles
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
        <div className="bg-white p-3 rounded-lg border border-line">
          <h4 className="font-semibold text-emerald-700">Qualifiers</h4>
          <p className="text-slate-500 mt-1">
            Race to 4 games — no win-by-2 requirement. At 3-3, the next game wins the match
            outright. Regular deuce scoring within each game (win by 2, no cap).
          </p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-line">
          <h4 className="font-semibold text-amber-700">Semifinals</h4>
          <p className="text-slate-500 mt-1">
            A single set to 6 games, win by 2, with a 7-point tiebreak at 6-6.{' '}
            <strong className="text-amber-700">Golden Point:</strong> the first deuce in a game
            plays out normally (advantage), but if it returns to deuce a second time, the next
            point wins the game outright — no further advantage.
          </p>
        </div>
        <div className="bg-white p-3 rounded-lg border border-line">
          <h4 className="font-semibold text-emerald-700">Final</h4>
          <p className="text-slate-500 mt-1">
            A single set to 6 games, win by 2, with a 7-point tiebreak at 6-6. Regular deuce
            throughout — no golden point; every deuce requires a 2-point advantage to win the
            game.
          </p>
        </div>
      </div>
    </section>
  );
}
