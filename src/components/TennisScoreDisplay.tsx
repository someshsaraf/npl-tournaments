import type { ReactNode } from 'react';
import type { MatchState } from '../data/tournamentData';
import { formatTennisGamesLabel, formatTennisStageLabel } from '../utils/tennisMatchState';
import { isTennisDeuce, isTennisGoldenPointActive, isTennisTiebreak } from '../utils/tennisScoring';

type TennisScoreDisplayProps = {
  match: MatchState;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  /** Optional controls rendered on the right (e.g. scorer Audio / Swap) */
  trailing?: ReactNode;
};

/**
 * Tennis status strip — stage + match type + games tally + badges (Tiebreak /
 * Golden Point / Deuce). Analogous to SeriesScoreStrip for badminton.
 */
export function TennisScoreDisplay({
  match,
  size = 'md',
  className = '',
  trailing
}: TennisScoreDisplayProps) {
  if (!match || match.sport !== 'tennis' || !match.tennis) return null;

  const games = formatTennisGamesLabel(match);
  const stageLabel = formatTennisStageLabel(match.tennis.tennisStage);
  const matchTypeLabel = match.tennis.matchType === 'doubles' ? 'Doubles' : 'Singles';
  const tiebreak = isTennisTiebreak(match);
  const golden = isTennisGoldenPointActive(match);
  const deuce = isTennisDeuce(match) && !golden;
  const matchOver = match.matchWinner === 1 || match.matchWinner === 2;

  const text =
    size === 'lg'
      ? 'text-sm sm:text-base'
      : size === 'sm'
        ? 'text-[10px] sm:text-xs'
        : 'text-xs sm:text-sm';

  const statusLine = matchOver
    ? `${stageLabel} · ${matchTypeLabel} · Games ${games} · Match over`
    : `${stageLabel} · ${matchTypeLabel} · Games ${games}`;

  return (
    <div
      className={`flex items-center gap-2 sm:gap-3 ${text} font-mono text-slate-300 ${className}`}
      aria-label={statusLine}
    >
      <span className="shrink-0 font-bold text-amber-300/90 tracking-wide whitespace-nowrap">
        {statusLine}
      </span>

      {tiebreak && (
        <span className="shrink-0 text-xs font-black text-sky-300 bg-sky-500/20 border border-sky-400/50 px-2.5 py-0.5 rounded-full animate-pulse">
          TIEBREAK
        </span>
      )}
      {golden && (
        <span className="shrink-0 text-xs font-black text-amber-300 bg-amber-500/20 border border-amber-400/50 px-2.5 py-0.5 rounded-full animate-pulse">
          GOLDEN POINT
        </span>
      )}
      {deuce && (
        <span className="shrink-0 text-xs font-black text-red-400 bg-red-500/20 border border-red-500/50 px-2.5 py-0.5 rounded-full animate-pulse">
          DEUCE
        </span>
      )}

      {trailing ? (
        <div className="ml-auto flex items-center justify-end gap-1.5 shrink-0 flex-wrap">
          {trailing}
        </div>
      ) : null}
    </div>
  );
}

export default TennisScoreDisplay;
