import { useEffect, useRef, type ReactNode } from 'react';
import type { GameScore } from '../data/tournamentData';

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

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  kind: 'spark' | 'trail';
};

type Rocket = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  burstAt: number;
};

const COLORS = ['#fbbf24', '#34d399', '#60a5fa', '#f472b6', '#a78bfa', '#fb7185', '#fde68a', '#ffffff'];

function pickColor(): string {
  return COLORS[Math.floor(Math.random() * COLORS.length)] ?? '#fbbf24';
}

function burst(particles: Particle[], x: number, y: number, color: string): void {
  const count = 48 + Math.floor(Math.random() * 24);
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
    const speed = 2.2 + Math.random() * 4.5;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: 0.7 + Math.random() * 0.6,
      color,
      size: 1.5 + Math.random() * 2.5,
      kind: 'spark'
    });
  }
}

/**
 * Full-viewport winner banner with canvas fireworks.
 * Animation runs only while mounted; cleaned up on unmount (no shared globals).
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
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
  const titleSize = audience
    ? 'clamp(1rem, 3.5vw, 2rem)'
    : 'clamp(0.85rem, 2.5vw, 1.25rem)';
  const nameSize = audience
    ? 'clamp(4rem, min(22vw, 34dvh), 16rem)'
    : showBo3Games
      ? 'clamp(3.5rem, min(20vw, 26dvh), 12rem)'
      : 'clamp(4rem, min(22vw, 32dvh), 14rem)';
  /** Opponent must read from distance — ~55% of winner size, high contrast. */
  const opponentSize = audience
    ? 'clamp(2.25rem, min(12vw, 16dvh), 8rem)'
    : showBo3Games
      ? 'clamp(1.75rem, min(9vw, 12dvh), 5rem)'
      : 'clamp(2rem, min(10vw, 14dvh), 6rem)';
  const scoreSize = audience
    ? 'clamp(5rem, min(32vw, 40dvh), 24rem)'
    : 'clamp(3rem, 14vw, 9rem)';
  const gameScoreSize = audience
    ? 'clamp(2rem, min(14vw, 16dvh), 6rem)'
    : 'clamp(1.75rem, min(11vw, 12dvh), 4.5rem)';
  const gameLabelSize = audience
    ? 'clamp(0.7rem, 1.8vw, 1.1rem)'
    : 'clamp(0.65rem, 1.5vw, 0.9rem)';

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let running = true;
    const rockets: Rocket[] = [];
    const particles: Particle[] = [];
    let spawnTimer = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnRocket = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      rockets.push({
        x: w * (0.15 + Math.random() * 0.7),
        y: h + 10,
        vx: (Math.random() - 0.5) * 1.2,
        vy: -(6.5 + Math.random() * 3.5),
        color: pickColor(),
        burstAt: h * (0.15 + Math.random() * 0.35)
      });
    };

    const tick = () => {
      if (!running) return;
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      spawnTimer += 1;
      if (spawnTimer % 18 === 0 && rockets.length < 6) {
        spawnRocket();
      }

      for (let i = rockets.length - 1; i >= 0; i -= 1) {
        const r = rockets[i];
        if (!r) continue;
        r.x += r.vx;
        r.y += r.vy;
        r.vy += 0.035;

        particles.push({
          x: r.x,
          y: r.y,
          vx: 0,
          vy: 0.4,
          life: 1,
          maxLife: 0.35,
          color: r.color,
          size: 2,
          kind: 'trail'
        });

        ctx.beginPath();
        ctx.fillStyle = r.color;
        ctx.arc(r.x, r.y, 2.5, 0, Math.PI * 2);
        ctx.fill();

        if (r.y <= r.burstAt || r.vy >= 0) {
          burst(particles, r.x, r.y, r.color);
          burst(particles, r.x, r.y, pickColor());
          rockets.splice(i, 1);
        }
      }

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        if (!p) continue;
        p.x += p.vx;
        p.y += p.vy;
        if (p.kind === 'spark') {
          p.vy += 0.045;
          p.vx *= 0.99;
        }
        p.life -= 1 / (60 * p.maxLife);
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      raf = window.requestAnimationFrame(tick);
    };

    resize();
    for (let i = 0; i < 3; i += 1) spawnRocket();
    raf = window.requestAnimationFrame(tick);
    window.addEventListener('resize', resize);

    return () => {
      running = false;
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div
      className={
        audience
          ? 'fixed inset-0 z-[60] flex flex-col overflow-hidden'
          : 'fixed inset-0 z-[60] flex flex-col items-center justify-center overflow-hidden'
      }
      style={{
        background:
          'radial-gradient(ellipse at center, rgba(15,23,42,0.72) 0%, rgba(2,6,23,0.94) 70%)'
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="winner-celebration-title"
    >
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0"
        aria-hidden="true"
      />

      <div
        className={
          audience
            ? 'relative z-10 flex h-full w-full max-w-none flex-col items-center justify-between px-3 py-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center'
            : 'relative z-10 flex flex-col items-center justify-center gap-4 sm:gap-6 px-4 text-center max-w-[96vw]'
        }
      >
        <p
          className={`font-black uppercase tracking-[0.35em] text-amber-300 ${audience ? 'shrink-0' : ''}`}
          style={{
            fontSize: titleSize,
            animation: 'winner-pulse 1.4s ease-in-out infinite'
          }}
        >
          Winner
        </p>
        <h1
          id="winner-celebration-title"
          className={
            audience
              ? 'flex min-h-0 w-full flex-[1.4] items-center justify-center font-black text-white leading-[0.85] break-words px-2'
              : 'font-black text-white leading-[0.85] break-words max-w-[95vw] shrink-0 py-1'
          }
          style={{
            fontSize: nameSize,
            textShadow: '0 0 48px rgba(52,211,153,0.55), 0 6px 28px rgba(0,0,0,0.65)',
            animation: 'winner-pop 0.7s cubic-bezier(0.22, 1.2, 0.36, 1) both'
          }}
        >
          {safeName}
        </h1>
        {safeOpponent ? (
          <p
            className={
              audience
                ? 'flex min-h-0 w-full flex-[0.7] items-center justify-center font-black text-emerald-100 leading-[0.95] break-words px-2'
                : 'font-black text-emerald-100 leading-[0.95] break-words max-w-[95vw] shrink-0'
            }
            style={{
              fontSize: opponentSize,
              textShadow: '0 0 28px rgba(16,185,129,0.45), 0 4px 18px rgba(0,0,0,0.7)'
            }}
          >
            <span className="block w-full">
              <span className="inline-block uppercase tracking-[0.18em] text-amber-300/90 font-black mr-2 align-middle"
                style={{ fontSize: '0.45em' }}
              >
                def.
              </span>
              <span className="align-middle">{safeOpponent}</span>
            </span>
          </p>
        ) : null}
        {showBo3Games ? (
          <div
            className={
              audience
                ? 'flex min-h-0 w-full flex-[0.9] items-center justify-center gap-2 sm:gap-4 px-1'
                : 'flex w-full max-w-[96vw] items-center justify-center gap-2 sm:gap-4'
            }
            aria-label={`Game scores ${bo3Scores.map((g, i) => `G${i + 1} ${g.score1}-${g.score2}`).join(', ')}`}
          >
            {[0, 1, 2].map((i) => {
              const g = bo3Scores[i];
              const filled = !!g;
              const winnerSide =
                matchWinner === 1 || matchWinner === 2
                  ? matchWinner
                  : null;
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
                    {filled ? `${g.score1}-${g.score2}` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p
            className={
              audience
                ? 'flex min-h-0 w-full flex-1 items-center justify-center font-black font-mono tabular-nums text-amber-300 leading-none'
                : 'font-black font-mono tabular-nums text-amber-300 leading-none'
            }
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
          <p className="text-sm sm:text-base font-black text-emerald-300 tracking-wide">
            Games {safeSeries}
          </p>
        ) : null}
        {safeSubtitle && !showBo3Games ? (
          <p className="text-xs sm:text-sm font-bold text-slate-300 max-w-[92vw] text-center px-2">
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
