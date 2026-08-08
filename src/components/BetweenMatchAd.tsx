import { useEffect, useRef, useState } from 'react';
import type { EventAd } from '../data/eventAds';
import { isSafeAdPosterPath } from '../data/eventAds';

/**
 * Optional real clip. When this file exists under public/, pass videoSrc
 * (e.g. "/Friends-Kitchen-ad.mp4") to prefer it over the Ken Burns poster.
 */
const DEFAULT_DURATION_MS = 8000;
const MIN_DURATION_MS = 5000;
const MAX_DURATION_MS = 15_000;

export type BetweenMatchAdProps = {
  ad: EventAd;
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

function useViewportOrientation(): 'portrait' | 'landscape' {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(() => {
    if (typeof window === 'undefined') return 'portrait';
    return window.matchMedia('(orientation: landscape)').matches ? 'landscape' : 'portrait';
  });

  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const sync = () => setOrientation(mq.matches ? 'landscape' : 'portrait');
    sync();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', sync);
      return () => mq.removeEventListener('change', sync);
    }
    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, []);

  return orientation;
}

/**
 * Full-viewport between-match ad with Ken Burns poster (or optional video).
 * Concurrency: local timers/refs only; cleaned up on unmount.
 * Security: only allowlisted event poster paths + optional same-origin videoSrc.
 * Input validation: rejects ads without a safe posterSrc.
 */
export function BetweenMatchAd({
  ad,
  onComplete,
  durationMs,
  allowSkip = true,
  videoSrc
}: BetweenMatchAdProps) {
  const duration = clampDurationMs(durationMs);
  const posterSrc = isSafeAdPosterPath(ad?.posterSrc) ? ad.posterSrc : null;
  const title =
    typeof ad?.title === 'string' && ad.title.trim() ? ad.title.trim() : 'Advertisement';
  const alt =
    typeof ad?.alt === 'string' && ad.alt.trim() ? ad.alt.trim() : title;
  const safeVideoSrc = isSafeSameOriginAssetPath(videoSrc) ? videoSrc : null;
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);
  const [useVideo, setUseVideo] = useState(Boolean(safeVideoSrc));
  const [progress, setProgress] = useState(0);
  const orientation = useViewportOrientation();
  const landscape = orientation === 'landscape';

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  const finish = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    onCompleteRef.current();
  };

  useEffect(() => {
    if (!posterSrc && !safeVideoSrc) {
      finish();
      return;
    }
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
    // finish is stable via ref; duration/poster are the triggers
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional one-shot per mount
  }, [duration, posterSrc, safeVideoSrc]);

  if (!posterSrc && !safeVideoSrc) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[65] flex flex-col bg-slate-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`${title} advertisement`}
    >
      <div className="relative flex-1 min-h-0 overflow-hidden bg-black">
        {useVideo && safeVideoSrc ? (
          <video
            className={`absolute inset-0 h-full w-full bg-black ${
              landscape ? 'object-contain' : 'object-contain'
            }`}
            src={safeVideoSrc}
            autoPlay
            muted
            playsInline
            preload="auto"
            onError={() => setUseVideo(false)}
            onEnded={finish}
            aria-label={`${title} video advertisement`}
          />
        ) : (
          <>
            {landscape && posterSrc ? (
              <img
                src={posterSrc}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover scale-110 blur-2xl opacity-45"
                draggable={false}
              />
            ) : null}
            <div
              className={`absolute inset-0 flex items-center justify-center ${
                landscape ? 'px-[max(1rem,4vw)]' : ''
              }`}
            >
              <img
                src={posterSrc!}
                alt={alt}
                className={`npl-between-ad-kenburns object-contain ${
                  landscape
                    ? 'max-h-full w-auto max-w-[min(100%,72vh)] shadow-2xl ring-1 ring-white/15 rounded-sm'
                    : 'max-h-full max-w-full h-full w-full'
                }`}
                draggable={false}
              />
            </div>
          </>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-4 bg-gradient-to-b from-black/70 to-transparent">
          <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.22em] text-amber-300/90">
            Advertisement · {title}
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
