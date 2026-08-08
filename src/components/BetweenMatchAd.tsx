import { useEffect, useRef, useState } from 'react';

const POSTER_SRC = '/Friends-Kitchen.jpeg';
/**
 * Optional real clip. When this file exists under public/, pass videoSrc
 * (e.g. "/Friends-Kitchen-ad.mp4") to prefer it over the Ken Burns poster.
 */
const DEFAULT_DURATION_MS = 8000;
const MIN_DURATION_MS = 5000;
const MAX_DURATION_MS = 15_000;

export type BetweenMatchAdProps = {
  onComplete: () => void;
  /** How long to show the ad (clamped 5–15s). Default 8s. */
  durationMs?: number;
  /** Audience kiosks: hide skip; score desk can skip. Default true. */
  allowSkip?: boolean;
  /** Same-origin MP4/WebM path. Invalid/missing falls back to poster animation. */
  videoSrc?: string;
};

function clampDurationMs(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULT_DURATION_MS;
  return Math.min(MAX_DURATION_MS, Math.max(MIN_DURATION_MS, Math.round(value)));
}

function isSafeSameOriginAssetPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('..') &&
    value.length < 200
  );
}

/**
 * Full-viewport between-match ad (Friends' Kitchen).
 * Uses optional same-origin video, else Ken Burns zoom on the poster (~8s).
 * Concurrency: local timers/refs only; cleaned up on unmount.
 * Security: static same-origin assets only; rejects non-/ relative paths.
 */
export function BetweenMatchAd({
  onComplete,
  durationMs,
  allowSkip = true,
  videoSrc
}: BetweenMatchAdProps) {
  const duration = clampDurationMs(durationMs);
  const safeVideoSrc = isSafeSameOriginAssetPath(videoSrc) ? videoSrc : null;
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [useVideo, setUseVideo] = useState(Boolean(safeVideoSrc));
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  };

  useEffect(() => {
    completedRef.current = false;
    setProgress(0);
    const started = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const ratio = Math.min(1, (now - started) / duration);
      setProgress(ratio);
      if (ratio >= 1) {
        finish();
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const fallback = window.setTimeout(finish, duration + 250);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(fallback);
    };
    // finish is stable via ref; duration is the only trigger
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot per mount
  }, [duration]);

  return (
    <div
      className="fixed inset-0 z-[65] flex flex-col bg-slate-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Friends' Kitchen advertisement"
    >
      <div className="relative flex-1 min-h-0 overflow-hidden">
        {useVideo && safeVideoSrc ? (
          <video
            className="absolute inset-0 h-full w-full object-contain bg-black"
            src={safeVideoSrc}
            autoPlay
            muted
            playsInline
            preload="auto"
            onError={() => setUseVideo(false)}
            onEnded={finish}
            aria-label="Friends' Kitchen video advertisement"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_#1c1917_0%,_#0a0a0a_70%)]">
            <img
              src={POSTER_SRC}
              alt="Friends' Kitchen — We're back at NPL. Pre-order at Clubhouse from 6:30 PM."
              className="npl-between-ad-kenburns max-h-full max-w-full object-contain"
              draggable={false}
            />
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4 bg-gradient-to-b from-black/70 to-transparent">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.22em] text-amber-300/90">
            Advertisement · Friends&apos; Kitchen
          </p>
          <p className="text-[10px] sm:text-xs font-semibold text-slate-300 tabular-nums">
            {Math.max(1, Math.ceil((1 - progress) * (duration / 1000)))}s
          </p>
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-800 bg-slate-950/95 px-3 py-2.5 sm:px-4 flex items-center gap-3">
        <div
          className="flex-1 h-1.5 rounded-full bg-slate-800 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
        >
          <div
            className="h-full rounded-full bg-amber-400 transition-[width] duration-100 ease-linear"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
        {allowSkip ? (
          <button
            type="button"
            onClick={finish}
            className="shrink-0 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-100 hover:bg-slate-700 active:scale-95"
          >
            Skip
          </button>
        ) : null}
      </div>

      <style>{`
        @keyframes npl-between-ad-kenburns {
          from { transform: scale(1) translate3d(0, 0, 0); }
          to { transform: scale(1.12) translate3d(-1.5%, -1%, 0); }
        }
        .npl-between-ad-kenburns {
          animation: npl-between-ad-kenburns ${duration}ms ease-out forwards;
          will-change: transform;
        }
        @media (prefers-reduced-motion: reduce) {
          .npl-between-ad-kenburns {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

export default BetweenMatchAd;
