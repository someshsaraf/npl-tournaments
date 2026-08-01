import type { MatchState } from '../data/tournamentData';
import { hasSeriesWinner } from '../utils/matchState';

type Bo3BigScoresProps = {
  match: MatchState;
  /** Side 1 (left) or 2 (right) */
  side: 1 | 2;
  /** Audience boards use larger type */
  variant?: 'scorer' | 'audience';
  className?: string;
};

/**
 * Resolve this side's score for game index 0..2.
 * Finished games use gameScores; the live game uses current point score.
 * Input: match + side validated; returns null if that game has not started.
 */
export function scoreForBo3Game(
  match: MatchState,
  gameIndex: number,
  side: 1 | 2
): number | null {
  if (!match || typeof match !== 'object') return null;
  if (gameIndex < 0 || gameIndex > 2) return null;
  if (side !== 1 && side !== 2) return null;

  const scores = Array.isArray(match.gameScores) ? match.gameScores : [];
  const finished = scores[gameIndex];
  if (finished) {
    const n = side === 1 ? Number(finished.score1) : Number(finished.score2);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }

  if (hasSeriesWinner(match)) return null;

  const gameNum = Number.isFinite(match.gameNumber) ? match.gameNumber : 1;
  if (gameNum !== gameIndex + 1) return null;

  const live = side === 1 ? Number(match.score1) : Number(match.score2);
  return Number.isFinite(live) ? Math.trunc(live) : 0;
}

/**
 * Stacked big scores for one side across Game 1–3 (best-of-3).
 * Live game is highlighted; unplayed games show an em dash.
 */
export function Bo3BigScores({
  match,
  side,
  variant = 'scorer',
  className = ''
}: Bo3BigScoresProps) {
  if (!match || match.bestOf !== 3) return null;
  if (side !== 1 && side !== 2) return null;

  const seriesDone = hasSeriesWinner(match);
  const gameNum = Number.isFinite(match.gameNumber) ? match.gameNumber : 1;
  const color = side === 1 ? 'text-indigo-300' : 'text-rose-300';
  const liveRing =
    side === 1
      ? 'ring-2 ring-indigo-400/50 bg-indigo-950/40'
      : 'ring-2 ring-rose-400/50 bg-rose-950/40';

  const scoreSize =
    variant === 'audience'
      ? 'clamp(2.75rem, min(14vw, 22dvh), 9rem)'
      : 'clamp(2.25rem, min(12vw, 18dvh), 6.5rem)';
  const labelSize =
    variant === 'audience'
      ? 'clamp(0.7rem, 1.8vw, 1.1rem)'
      : 'clamp(0.65rem, 1.5vw, 0.9rem)';

  return (
    <div
      className={`flex-1 min-h-0 w-full flex flex-col items-stretch justify-center gap-1 sm:gap-2 px-1 sm:px-3 py-1 ${className}`}
      aria-label={`Side ${side} game scores`}
    >
      {[0, 1, 2].map((i) => {
        const value = scoreForBo3Game(match, i, side);
        const isLive = !seriesDone && value !== null && gameNum === i + 1;
        const filled = value !== null;
        return (
          <div
            key={`bo3-s${side}-g${i + 1}`}
            className={`flex items-center justify-center gap-2 sm:gap-3 rounded-xl px-2 py-0.5 sm:py-1 ${
              isLive ? liveRing : filled ? 'bg-slate-900/40' : 'opacity-40'
            }`}
          >
            <span
              className="shrink-0 font-bold uppercase tracking-wider text-slate-500"
              style={{ fontSize: labelSize }}
            >
              G{i + 1}
            </span>
            <span
              className={`font-black font-mono tabular-nums leading-none select-none ${
                filled ? color : 'text-slate-600'
              }`}
              style={{ fontSize: scoreSize }}
            >
              {filled ? value : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
