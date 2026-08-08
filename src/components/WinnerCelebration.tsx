import type { ReactNode } from 'react';
import type { GameScore } from '../data/tournamentData';
import { formatWinnerFirstScore } from '../utils/matchState';
import { FireworksCanvas } from './FireworksCanvas';

type WinnerCelebrationProps = {
  winnerName: string;
  /** Losing side display name — shown under the winner */
  opponentName?: string;
  scoreLabel: string;
  onDismiss: () => void;
  /** Optional save action shown on the celebration screen */
  onSave?: () => void;
  isSaving?: boolean;
  alreadySaved?: boolean;
  /** Open the new-match form after a finished game */
  onNewMatch?: () => void;
  /** Continue to next game in a best-of-3 series */
  onNextGame?: () => void;
  /** Larger type for audience /score displays */
  variant?: 'default' | 'audience';
  /** Optional subtitle (e.g. series status) */
  subtitle?: string;
  /**
   * Best-of-3 finished game scores — when provided (1–3 entries), shown as
   * large G1/G2/G3 instead of a single last-game score.
   */
  gameScores?: GameScore[];
  /** Series games won label, e.g. "2-1" */
  seriesLabel?: string;
  /** Match/series winner (1|2) — their games get a distinct background */
  matchWinner?: 1 | 2 | null;
  /** Extra links/actions under the primary buttons (e.g. Schedule / Rules / Admin) */
  extraActions?: ReactNode;
};

/**
 * Full-viewport winner banner with canvas fireworks.
 * Audience variant: single vertical stack (label → winner → def. → score → actions)
 * so text never overlaps; opaque backdrop hides the live scoreboard.
 *
 * Concurrency: mount-local only; fireworks cleaned up on unmount.
 * Input validation: trims strings; ignores malformed game score entries.
 */
export function WinnerCelebration({
  winnerName,
  opponentName,
  scoreLabel,
  onDismiss,
  onSave,
  isSaving = false,
  alreadySaved = false,
  onNewMatch,
  onNextGame,
  variant = 'default',
  subtitle,
  gameScores,
  seriesLabel,
  matchWinner,
  extraActions
}: WinnerCelebrationProps) {
  const safeName =
    typeof winnerName === 'string' && winnerName.trim() ? winnerName.trim() : 'Winner';
  const safeOpponent =
    typeof opponentName === 'string' && opponentName.trim() ? opponentName.trim() : '';
  const safeScore =
    typeof scoreLabel === 'string' && scoreLabel.trim() ? scoreLabel.trim() : '—';
  const safeSubtitle =
    typeof subtitle === 'string' && subtitle.trim() ? subtitle.trim() : '';
  const safeSeries =
    typeof seriesLabel === 'string' && seriesLabel.trim() ? seriesLabel.trim() : '';
  const bo3Scores = Array.isArray(gameScores)
    ? gameScores.filter(
        (g) =>
          g &&
          Number.isFinite(g.score1) &&
          Number.isFinite(g.score2)
      )
    : [];
  const showBo3Games = bo3Scores.length > 0;
  const canSaveOrShare = typeof onSave === 'function';
  const canNewMatch = typeof onNewMatch === 'function';
  const canNextGame = typeof onNextGame === 'function';
  const audience = variant === 'audience';

  // Audience: capped sizes so long doubles names + score fit one viewport without overlap.
  const titleSize = audience
    ? 'clamp(0.85rem, 2.4vw, 1.35rem)'
    : 'clamp(0.85rem, 2.5vw, 1.25rem)';
  const nameSize = audience
    ? 'clamp(2.25rem, min(8.5vw, 11dvh), 5.5rem)'
    : showBo3Games
      ? 'clamp(3.5rem, min(20vw, 26dvh), 12rem)'
      : 'clamp(4rem, min(22vw, 32dvh), 14rem)';
  const opponentSize = audience
    ? 'clamp(1.15rem, min(4.2vw, 5.5dvh), 2.25rem)'
    : showBo3Games
      ? 'clamp(1.75rem, min(9vw, 12dvh), 5rem)'
      : 'clamp(2rem, min(10vw, 14dvh), 6rem)';
  const scoreSize = audience
    ? 'clamp(3.5rem, min(16vw, 18dvh), 9rem)'
    : 'clamp(3rem, 14vw, 9rem)';
  const gameScoreSize = audience
    ? 'clamp(1.5rem, min(8vw, 9dvh), 3.5rem)'
    : 'clamp(1.75rem, min(11vw, 12dvh), 4.5rem)';
  const gameLabelSize = audience
    ? 'clamp(0.65rem, 1.5vw, 0.95rem)'
    : 'clamp(0.65rem, 1.5vw, 0.9rem)';

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: audience
          ? 'rgba(2, 6, 23, 0.97)'
          : 'radial-gradient(ellipse at center, rgba(15,23,42,0.72) 0%, rgba(2,6,23,0.94) 70%)'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="winner-celebration-title"
    >
      <FireworksCanvas />

      <div
        className={
          audience
            ? 'relative z-10 flex h-full w-full max-w-[min(96vw,56rem)] flex-col items-center justify-center gap-3 sm:gap-4 px-4 py-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] text-center'
            : 'relative z-10 flex flex-col items-center justify-center gap-4 sm:gap-6 px-4 text-center max-w-[96vw]'
        }
      >
        <p
          className="shrink-0 font-black uppercase tracking-[0.35em] text-amber-300"
          style={{
            fontSize: titleSize,
            animation: 'winner-pulse 1.4s ease-in-out infinite'
          }}
        >
          Winner
        </p>

        <h1
          id="winner-celebration-title"
          className="shrink-0 w-full font-black text-white leading-[1.05] px-1"
          style={{
            fontSize: nameSize,
            textShadow: '0 0 48px rgba(52,211,153,0.55), 0 6px 28px rgba(0,0,0,0.65)',
            animation: 'winner-pop 0.7s cubic-bezier(0.22, 1.2, 0.36, 1) both',
            display: '-webkit-box',
            WebkitLineClamp: audience ? 3 : undefined,
            WebkitBoxOrient: audience ? ('vertical' as const) : undefined,
            overflow: audience ? 'hidden' : undefined
          }}
        >
          {safeName}
        </h1>

        {safeOpponent ? (
          <p
            className="shrink-0 w-full max-w-[95vw] font-bold text-emerald-100/95 leading-snug px-1"
            style={{
              fontSize: opponentSize,
              textShadow: '0 0 28px rgba(16,185,129,0.45), 0 4px 18px rgba(0,0,0,0.7)',
              display: '-webkit-box',
              WebkitLineClamp: audience ? 2 : undefined,
              WebkitBoxOrient: audience ? ('vertical' as const) : undefined,
              overflow: audience ? 'hidden' : undefined
            }}
          >
            <span className="uppercase tracking-[0.18em] text-amber-300/90 font-black mr-2">
              def.
            </span>
            {safeOpponent}
          </p>
        ) : null}

        {showBo3Games ? (
          <div
            className="shrink-0 flex w-full max-w-[96vw] items-center justify-center gap-2 sm:gap-3"
            aria-label={`Game scores ${bo3Scores.map((g, i) => `G${i + 1} ${g.score1}-${g.score2}`).join(', ')}`}
          >
            {[0, 1, 2].map((i) => {
              const g = bo3Scores[i];
              const filled = !!g;
              const winnerSide =
                matchWinner === 1 || matchWinner === 2 ? matchWinner : null;
              const wonByMatchWinner =
                filled && winnerSide !== null && g.winner === winnerSide;
              const wonByOther =
                filled && winnerSide !== null && g.winner !== winnerSide;

              return (
                <div
                  key={`win-g${i + 1}`}
                  className={`flex min-w-0 flex-1 flex-col items-center justify-center rounded-2xl border px-1 py-2 sm:px-3 sm:py-3 ${
                    wonByMatchWinner
                      ? 'border-emerald-400 bg-emerald-500/30 shadow-lg shadow-emerald-500/25'
                      : wonByOther
                        ? 'border-slate-600/60 bg-slate-900/40 opacity-70'
                        : filled
                          ? 'border-amber-400/50 bg-slate-950/50'
                          : 'border-slate-700/40 bg-slate-950/20 opacity-35'
                  }`}
                  style={{
                    animation: filled
                      ? `winner-pop 0.7s ${0.08 + i * 0.1}s cubic-bezier(0.22, 1.2, 0.36, 1) both`
                      : undefined
                  }}
                >
                  <span
                    className={`font-black uppercase tracking-[0.2em] ${
                      wonByMatchWinner ? 'text-emerald-200' : 'text-slate-400'
                    }`}
                    style={{ fontSize: gameLabelSize }}
                  >
                    G{i + 1}
                    {wonByMatchWinner ? ' · W' : ''}
                  </span>
                  <span
                    className={`font-black font-mono tabular-nums leading-none ${
                      wonByMatchWinner
                        ? 'text-emerald-200'
                        : filled
                          ? 'text-amber-300'
                          : 'text-slate-600'
                    }`}
                    style={{
                      fontSize: gameScoreSize,
                      textShadow: filled
                        ? wonByMatchWinner
                          ? '0 0 36px rgba(52,211,153,0.55), 0 4px 16px rgba(0,0,0,0.5)'
                          : '0 0 36px rgba(251,191,36,0.45), 0 4px 16px rgba(0,0,0,0.5)'
                        : undefined
                    }}
                  >
                    {filled
                      ? formatWinnerFirstScore(g.score1, g.score2, g.winner)
                      : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p
            className="shrink-0 font-black font-mono tabular-nums text-amber-300 leading-none"
            style={{
              fontSize: scoreSize,
              textShadow: '0 0 40px rgba(251,191,36,0.5), 0 4px 20px rgba(0,0,0,0.5)',
              animation: 'winner-pop 0.7s 0.12s cubic-bezier(0.22, 1.2, 0.36, 1) both'
            }}
          >
            {safeScore}
          </p>
        )}

        {safeSeries ? (
          <p className="shrink-0 text-sm sm:text-base font-black text-emerald-300 tracking-wide">
            Games {safeSeries}
          </p>
        ) : null}
        {safeSubtitle && !showBo3Games ? (
          <p className="shrink-0 text-xs sm:text-sm font-bold text-slate-300 max-w-[92vw] text-center px-2">
            {safeSubtitle}
          </p>
        ) : null}

        <div
          className={
            audience
              ? 'mt-2 flex shrink-0 flex-wrap items-center justify-center gap-3'
              : 'mt-6 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3 w-full max-w-lg'
          }
        >
          {canNextGame && (
            <button
              type="button"
              onClick={onNextGame}
              disabled={isSaving}
              className="rounded-2xl bg-amber-400 text-slate-950 font-black text-sm sm:text-base px-8 py-3.5 active:scale-95 shadow-lg shadow-amber-400/30 disabled:opacity-50"
            >
              Next Game
            </button>
          )}
          {canSaveOrShare && (
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="rounded-2xl bg-emerald-500 text-slate-950 font-black text-sm sm:text-base px-8 py-3.5 active:scale-95 shadow-lg shadow-emerald-500/30 disabled:opacity-50"
            >
              {isSaving
                ? alreadySaved
                  ? 'Sharing…'
                  : 'Saving…'
                : alreadySaved
                  ? 'Share Result'
                  : 'Save & Share'}
            </button>
          )}
          {alreadySaved && (
            <p className="text-sm font-bold text-emerald-300 self-center">
              Result saved to Completed
            </p>
          )}
          {canNewMatch && (
            <button
              type="button"
              onClick={onNewMatch}
              disabled={isSaving}
              className="rounded-2xl bg-violet-500 text-slate-950 font-black text-sm sm:text-base px-8 py-3.5 active:scale-95 shadow-lg shadow-violet-500/30 disabled:opacity-50"
            >
              New Match
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            disabled={isSaving}
            className={
              audience
                ? 'rounded-xl bg-slate-800/90 text-white font-bold text-xs sm:text-sm px-5 py-2.5 border border-slate-600 active:scale-95 disabled:opacity-50'
                : 'rounded-2xl bg-slate-800 text-white font-black text-sm sm:text-base px-8 py-3.5 border border-slate-600 active:scale-95 disabled:opacity-50'
            }
          >
            Continue
          </button>
        </div>
        {extraActions ? (
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 w-full max-w-lg px-2">
            {extraActions}
          </div>
        ) : null}
      </div>

      <style>{`
        @keyframes winner-pop {
          from { opacity: 0; transform: scale(0.72) translateY(18px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes winner-pulse {
          0%, 100% { opacity: 0.7; letter-spacing: 0.35em; }
          50% { opacity: 1; letter-spacing: 0.45em; }
        }
      `}</style>
    </div>
  );
}

export default WinnerCelebration;
