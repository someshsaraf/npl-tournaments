import { useEffect, useRef } from 'react';

type WinnerCelebrationProps = {
  winnerName: string;
  scoreLabel: string;
  onDismiss: () => void;
  /** Optional save action shown on the celebration screen */
  onSave?: () => void;
  isSaving?: boolean;
  alreadySaved?: boolean;
  /** Open the new-match form after a finished game */
  onNewMatch?: () => void;
  /** Larger type for audience /score displays */
  variant?: 'default' | 'audience';
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
  scoreLabel,
  onDismiss,
  onSave,
  isSaving = false,
  alreadySaved = false,
  onNewMatch,
  variant = 'default'
}: WinnerCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const safeName =
    typeof winnerName === 'string' && winnerName.trim() ? winnerName.trim() : 'Winner';
  const safeScore =
    typeof scoreLabel === 'string' && scoreLabel.trim() ? scoreLabel.trim() : '—';
  const canSave = typeof onSave === 'function' && !alreadySaved;
  const canNewMatch = typeof onNewMatch === 'function';
  const audience = variant === 'audience';
  const titleSize = audience
    ? 'clamp(1rem, 3.5vw, 2rem)'
    : 'clamp(0.85rem, 2.5vw, 1.25rem)';
  const nameSize = audience
    ? 'clamp(3.5rem, min(18vw, 42dvh), 22rem)'
    : 'clamp(2.75rem, 12vw, 8rem)';
  const scoreSize = audience
    ? 'clamp(5rem, min(32vw, 40dvh), 24rem)'
    : 'clamp(3rem, 14vw, 9rem)';

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
              ? 'flex min-h-0 w-full flex-[1.35] items-center justify-center font-black text-white leading-[0.9] break-words px-2'
              : 'font-black text-white leading-[0.95] break-words max-w-[95vw]'
          }
          style={{
            fontSize: nameSize,
            textShadow: '0 0 48px rgba(52,211,153,0.55), 0 6px 28px rgba(0,0,0,0.65)',
            animation: 'winner-pop 0.7s cubic-bezier(0.22, 1.2, 0.36, 1) both'
          }}
        >
          {safeName}
        </h1>
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
        <div
          className={
            audience
              ? 'mt-2 flex shrink-0 flex-wrap items-center justify-center gap-3'
              : 'mt-6 flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3 w-full max-w-lg'
          }
        >
          {canSave && (
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving}
              className="rounded-2xl bg-emerald-500 text-slate-950 font-black text-sm sm:text-base px-8 py-3.5 active:scale-95 shadow-lg shadow-emerald-500/30 disabled:opacity-50"
            >
              {isSaving ? 'Saving…' : 'Save result'}
            </button>
          )}
          {alreadySaved && (
            <p className="text-sm font-bold text-emerald-300 self-center">Result saved</p>
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
