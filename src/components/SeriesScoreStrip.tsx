import type { ReactNode } from 'react';
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
  /** Optional controls rendered on the right (e.g. scorer Audio / points / Swap) */
  trailing?: ReactNode;
};

function slotLabel(index: number, scores: GameScore[]): string {
  const g = scores[index];
  if (!g || !Number.isFinite(g.score1) || !Number.isFinite(g.score2)) {
    return '—';
  }
  return `${g.score1}-${g.score2}`;
}

/**
 * Best-of-3 series strip — single row: status + G1/G2/G3 boxes (+ optional trailing).
 */
export function SeriesScoreStrip({
  match,
  size = 'md',
  className = '',
  trailing
}: SeriesScoreStripProps) {
  if (!match || typeof match !== 'object') return null;
  if (match.bestOf !== 3) return null;

  const scores = Array.isArray(match.gameScores) ? match.gameScores : [];
  const tally = formatGamesWonLabel(match);
  const gameNum = Number.isFinite(match.gameNumber) ? match.gameNumber : 1;
  const seriesDone = hasSeriesWinner(match);
  const matchWinner =
    match.matchWinner === 1 || match.matchWinner === 2 ? match.matchWinner : null;
  const maxPts = Number.isFinite(match.maxPoints) ? match.maxPoints : 11;

  const text =
    size === 'lg'
      ? 'text-sm sm:text-base'
      : size === 'sm'
        ? 'text-[10px] sm:text-xs'
        : 'text-xs sm:text-sm';

  const boxPad = size === 'lg' ? 'px-3 py-1' : 'px-2 py-0.5';
  const boxScore =
    size === 'lg'
      ? 'text-sm sm:text-base font-black'
      : size === 'sm'
        ? 'text-xs font-bold'
        : 'text-sm font-bold';

  const statusLine = seriesDone
    ? `Race to ${maxPts} · BO3 · Games ${tally} · Match over`
    : `Race to ${maxPts} · BO3 · Games ${tally} · Game ${gameNum}`;

  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 ${text} font-mono text-slate-300 ${className}`}
      aria-label={`Best of 3 series ${tally}. Games: ${[0, 1, 2]
        .map((i) => `G${i + 1} ${slotLabel(i, scores)}`)
        .join(', ')}`}
    >
      <span className="shrink-0 font-bold text-amber-300/90 tracking-wide whitespace-nowrap">
        {statusLine}
      </span>

      <div className="flex items-stretch justify-center gap-1 sm:gap-1.5 flex-wrap min-w-0">
        {[0, 1, 2].map((i) => {
          const g = scores[i];
          const filled = !!g;
          const isCurrent = !seriesDone && !filled && gameNum === i + 1;
          const wonByMatchWinner =
            seriesDone && matchWinner !== null && filled && g.winner === matchWinner;
          const wonBySide1 = filled && g.winner === 1;
          const wonBySide2 = filled && g.winner === 2;

          let boxClass = 'bg-slate-900/60 border-slate-700 text-slate-500';
          if (isCurrent) {
            boxClass =
              'bg-violet-950/50 border-violet-400/50 text-violet-200 animate-pulse';
          } else if (wonByMatchWinner) {
            boxClass =
              'bg-emerald-500/30 border-emerald-400 text-emerald-100 shadow-md shadow-emerald-500/20';
          } else if (wonBySide1) {
            boxClass = 'bg-indigo-500/20 border-indigo-400/50 text-indigo-100';
          } else if (wonBySide2) {
            boxClass = 'bg-rose-500/20 border-rose-400/50 text-rose-100';
          }

          return (
            <div
              key={`g${i + 1}`}
              className={`min-w-[3.75rem] sm:min-w-[4.75rem] rounded-lg border text-center ${boxPad} ${boxClass}`}
            >
              <div className="text-[9px] sm:text-[10px] uppercase tracking-wider opacity-80">
                G{i + 1}
                {wonByMatchWinner ? ' · W' : ''}
              </div>
              <div className={`tabular-nums leading-tight ${boxScore}`}>
                {slotLabel(i, scores)}
              </div>
            </div>
          );
        })}
      </div>

      {trailing ? (
        <div className="ml-auto flex items-center justify-end gap-1.5 shrink-0 flex-wrap">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}
