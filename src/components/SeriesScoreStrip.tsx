import type { MatchState } from '../data/tournamentData';
import {
  formatGameScoresLine,
  formatGamesWonLabel
} from '../utils/matchState';

type SeriesScoreStripProps = {
  match: MatchState;
  /** Larger type for audience scoreboard */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

/**
 * Shows best-of series tally and finished game scores (for /score and scorer).
 * Hidden for best-of-1 until at least one game is recorded (then shows nothing useful — still hide).
 */
export function SeriesScoreStrip({
  match,
  size = 'md',
  className = ''
}: SeriesScoreStripProps) {
  if (!match || typeof match !== 'object') return null;
  if (match.bestOf !== 3) return null;

  const gamesLine = formatGameScoresLine(match);
  const tally = formatGamesWonLabel(match);
  const gameNum = Number.isFinite(match.gameNumber) ? match.gameNumber : 1;
  const seriesDone = match.matchWinner === 1 || match.matchWinner === 2;

  const text =
    size === 'lg'
      ? 'text-sm sm:text-base'
      : size === 'sm'
        ? 'text-[10px] sm:text-xs'
        : 'text-xs sm:text-sm';

  return (
    <div
      className={`flex flex-col items-center gap-0.5 ${text} font-mono text-slate-300 ${className}`}
      aria-label={`Best of 3 series ${tally}`}
    >
      <span className="font-bold text-amber-300/90 tracking-wide">
        BO3 · Games {tally}
        {!seriesDone ? ` · Game ${gameNum}` : ' · Match'}
      </span>
      {gamesLine ? (
        <span className="text-slate-400 text-center leading-snug max-w-[min(96vw,40rem)]">
          {gamesLine}
        </span>
      ) : (
        <span className="text-slate-500">No games completed yet</span>
      )}
    </div>
  );
}
