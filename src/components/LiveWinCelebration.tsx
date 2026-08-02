import { useEffect } from 'react';
import { FireworksCanvas } from './FireworksCanvas';

const AUTO_DISMISS_MS = 5500;

type LiveWinCelebrationProps = {
  winnerName: string;
  opponentName?: string;
  scoreLabel: string;
  onDismiss: () => void;
};

/**
 * Stream-safe win celebration for /live: fireworks + compact banner.
 * Auto-dismisses; tap anywhere also dismisses. Fireworks are pointer-events-none.
 * Input: validates strings; onDismiss must be a function.
 */
export function LiveWinCelebration({
  winnerName,
  opponentName,
  scoreLabel,
  onDismiss
}: LiveWinCelebrationProps) {
  const safeName =
    typeof winnerName === 'string' && winnerName.trim() ? winnerName.trim() : 'Winner';
  const safeOpponent =
    typeof opponentName === 'string' && opponentName.trim() ? opponentName.trim() : '';
  const safeScore =
    typeof scoreLabel === 'string' && scoreLabel.trim() ? scoreLabel.trim() : '—';

  useEffect(() => {
    if (typeof onDismiss !== 'function') return;
    const id = window.setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(id);
  }, [onDismiss]);

  const handleDismiss = () => {
    if (typeof onDismiss === 'function') onDismiss();
  };

  return (
    <div
      className="absolute inset-0 z-[80] flex items-center justify-center overflow-hidden"
      role="dialog"
      aria-modal="false"
      aria-labelledby="live-win-celebration-title"
      onClick={handleDismiss}
      onKeyDown={(e) => {
        if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleDismiss();
        }
      }}
    >
      {/* Light dim — video remains visible */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(2,6,23,0.35) 0%, rgba(2,6,23,0.55) 70%)'
        }}
        aria-hidden="true"
      />

      <FireworksCanvas className="pointer-events-none absolute inset-0 z-[1]" />

      <div
        className="relative z-[2] pointer-events-none mx-3 max-w-[min(92vw,28rem)] rounded-2xl border border-emerald-400/40 bg-slate-950/80 px-5 py-5 text-center shadow-2xl backdrop-blur-md"
        style={{
          animation: 'live-win-pop 0.55s cubic-bezier(0.22, 1.2, 0.36, 1) both'
        }}
      >
        <p className="text-[11px] font-black uppercase tracking-[0.35em] text-amber-300 mb-2">
          Winner
        </p>
        <h2
          id="live-win-celebration-title"
          className="font-black text-white leading-tight break-words"
          style={{
            fontSize: 'clamp(1.75rem, 6vw, 2.75rem)',
            textShadow: '0 0 28px rgba(52,211,153,0.5), 0 4px 16px rgba(0,0,0,0.65)'
          }}
        >
          {safeName}
        </h2>
        {safeOpponent ? (
          <p
            className="mt-2 font-black text-emerald-100 leading-snug break-words"
            style={{ fontSize: 'clamp(1.1rem, 3.5vw, 1.65rem)' }}
          >
            <span className="uppercase tracking-[0.16em] text-amber-300/90 text-[0.55em] font-black mr-1.5 align-middle">
              def.
            </span>
            <span className="align-middle">{safeOpponent}</span>
          </p>
        ) : null}
        <p
          className="mt-3 font-black font-mono tabular-nums text-amber-300 leading-none"
          style={{ fontSize: 'clamp(1.75rem, 5vw, 2.5rem)' }}
        >
          {safeScore}
        </p>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Tap to dismiss
        </p>
      </div>

      <style>{`
        @keyframes live-win-pop {
          from { opacity: 0; transform: scale(0.85) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*='live-win-pop'] {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default LiveWinCelebration;
