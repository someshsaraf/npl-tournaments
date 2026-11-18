import { useState } from 'react';
import { ChevronDown, Medal, Trophy } from 'lucide-react';
import { groupByYear, type PastWinner } from '../data/pastWinners';
import type { Sport } from '../data/tournamentData';
import { usePastWinners } from '../hooks/usePastWinners';

/**
 * "Reigning champions" for a sport hub: the latest season's winners as gold
 * cards, with earlier seasons in an expandable list below. Hidden until an
 * admin enters past winners (Admin → sport → Past winners).
 */
export function PastChampions({ sport }: { sport: Sport }) {
  // Category rows still waiting for names stay hidden.
  const winners = usePastWinners(sport).winners.filter((w) => w.winner);
  const [showOlder, setShowOlder] = useState(false);
  if (winners.length === 0) return null;
  const [latest, ...older] = groupByYear(winners);

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-amber-200 bg-gradient-to-br from-amber-50 via-white to-yellow-50 p-5 sm:p-7 shadow-sm space-y-5"
      aria-labelledby="past-champions-heading"
    >
      <Trophy className="pointer-events-none absolute -right-6 -top-6 size-40 text-amber-200/50 rotate-12" aria-hidden />
      <header className="relative space-y-1">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-amber-700">Hall of champions</p>
        <h2 id="past-champions-heading" className="portal-display text-3xl sm:text-4xl text-ink tracking-wide">
          {latest.year} Champions
        </h2>
      </header>

      <ul className="relative grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {latest.winners.map((w) => (
          <ChampionCard key={w.id} w={w} />
        ))}
      </ul>

      {older.length > 0 ? (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowOlder((v) => !v)}
            aria-expanded={showOlder}
            className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-800 hover:text-amber-900"
          >
            Earlier seasons
            <ChevronDown className={`size-3.5 transition-transform ${showOlder ? 'rotate-180' : ''}`} aria-hidden />
          </button>
          {showOlder ? (
            <div className="mt-3 space-y-4">
              {older.map((g) => (
                <div key={g.year} className="space-y-1.5">
                  <h3 className="text-sm font-black text-ink">{g.year}</h3>
                  <ul className="divide-y divide-amber-100 rounded-2xl border border-amber-100 bg-white/80">
                    {g.winners.map((w) => (
                      <li key={w.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-4 py-2 text-sm">
                        <span className="text-slate-500">{w.category || 'Champion'}</span>
                        <span className="font-bold text-ink">
                          <Trophy className="inline size-3.5 mr-1 -mt-0.5 text-amber-500" aria-hidden />
                          {w.winner}
                          {w.runnerUp ? <span className="font-normal text-slate-500"> · runner-up {w.runnerUp}</span> : null}
                          {w.score ? <span className="font-normal text-slate-400 tabular-nums"> · {w.score}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ChampionCard({ w }: { w: PastWinner }) {
  return (
    <li className="flex items-start gap-3 rounded-2xl bg-white border border-amber-200 px-4 py-3 shadow-sm">
      <span className="grid place-items-center size-10 shrink-0 rounded-full bg-gradient-to-br from-amber-300 to-yellow-500 text-white shadow-inner">
        <Trophy className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700">{w.category || 'Champion'}</p>
          {w.score ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold tabular-nums text-amber-900">{w.score}</span>
          ) : null}
        </div>
        <p className="text-lg font-black leading-tight text-ink break-words">{w.winner}</p>
        {w.runnerUp ? (
          <p className="text-xs text-slate-500 inline-flex items-center gap-1">
            <Medal className="size-3 text-slate-400" aria-hidden />
            Runner-up: {w.runnerUp}
          </p>
        ) : null}
      </div>
    </li>
  );
}
