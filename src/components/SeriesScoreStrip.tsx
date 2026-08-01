import type { GameScore, MatchState } from '../data/tournamentData';
import {
  formatGamesWonLabel,
  hasSeriesWinner
} from '../utils/matchState';

type SeriesScoreStripProps = {
  match: MatchState;
  /** Larger type for audience scoreboard */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

function slotLabel(index: number, scores: GameScore[]): string {
  const g = scores[index];
  if (!g || !Number.isFinite(g.score1) || !Number.isFinite(g.score2)) {
    return '—';
  }
  return `${g.score1}-${g.score2}`;
}

/**
 * Best-of-3 series strip for /score and /scorer.
 * Always shows three game slots (G1 G2 G3); filled scores appear as games finish.
 * When the series is decided (2 wins), all played game scores remain visible.
 */
export function SeriesScoreStrip({
  match,
  size = 'md',
  className = ''
}: SeriesScoreStripProps) {
  if (!match || typeof match !== 'object') return null;
  if (match.bestOf !== 3) return null;

  const scores = Array.isArray(match.gameScores) ? match.gameScores : [];
  const tally = formatGamesWonLabel(match);
  const gameNum = Number.isFinite(match.gameNumber) ? match.gameNumber : 1;
  const seriesDone = hasSeriesWinner(match);

  const text =
    size === 'lg'
      ? 'text-sm sm:text-base'
      : size === 'sm'
        ? 'text-[10px] sm:text-xs'
        : 'text-xs sm:text-sm';

  const boxPad = size === 'lg' ? 'px-3 py-1.5' : 'px-2 py-1';
  const boxScore =
    size === 'lg'
      ? 'text-base sm:text-lg font-black'
      : size === 'sm'
        ? 'text-xs font-bold'
        : 'text-sm font-bold';

  return (
    <div
      className={`flex flex-col items-center gap-1.5 ${text} font-mono text-slate-300 ${className}`}
      aria-label={`Best of 3 series ${tally}. Games: ${[0, 1, 2]
        .map((i) => `G${i + 1} ${slotLabel(i, scores)}`)
        .join(', ')}`}
    >
      <span className="font-bold text-amber-300/90 tracking-wide">
        BO3 · Games {tally}
        {seriesDone ? ' · Match over' : ` · Game ${gameNum}`}
      </span>

      <div className="flex items-stretch justify-center gap-1.5 sm:gap-2 flex-wrap">
        {[0, 1, 2].map((i) => {
          const filled = !!scores[i];
          const isCurrent = !seriesDone && !filled && gameNum === i + 1;
          return (
            <div
              key={`g${i + 1}`}
              className={`min-w-[4.5rem] sm:min-w-[5.5rem] rounded-lg border text-center ${boxPad} ${
                filled
                  ? 'bg-slate-800/90 border-emerald-500/40 text-emerald-200'
                  : isCurrent
                    ? 'bg-violet-950/50 border-violet-400/50 text-violet-200 animate-pulse'
                    : 'bg-slate-900/60 border-slate-700 text-slate-500'
              }`}
            >
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wider opacity-80">
                Game {i + 1}
              </div>
              <div className={`tabular-nums leading-tight ${boxScore}`}>
                {slotLabel(i, scores)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
