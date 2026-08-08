import { useEffect, useState } from 'react';
import type { EventAd } from '../data/eventAds';
import { isSafeAdPosterPath } from '../data/eventAds';

const SLIDE_MS = 10_000;

/**
 * Continuous fullscreen poster loop for /score during the 1–5 PM daypart.
 * Concurrency: local interval/state only; cleaned up on unmount.
 * Security: allowlisted poster paths only.
 * Input validation: filters invalid ads; no-ops when empty.
 */
export function ScoreDaypartAdPlayer({ ads }: { ads: EventAd[] }) {
  const validAds = (Array.isArray(ads) ? ads : []).filter(
    (ad) => ad && isSafeAdPosterPath(ad.posterSrc) && typeof ad.title === 'string'
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (validAds.length === 0) return;
    setIndex((i) => i % validAds.length);
  }, [validAds.length]);

  useEffect(() => {
    if (validAds.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % validAds.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [validAds.length]);

  if (validAds.length === 0) return null;

  const ad = validAds[Math.min(index, validAds.length - 1)]!;

  return (
    <div
      className="fixed inset-0 z-[90] flex flex-col bg-slate-950 text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Afternoon advertisements"
    >
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <img
          key={ad.id}
          src={ad.posterSrc}
          alt={ad.alt}
          className="absolute inset-0 h-full w-full object-contain bg-black npl-score-daypart-kenburns"
          draggable={false}
        />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 sm:p-5 bg-gradient-to-b from-black/75 to-transparent">
          <div>
            <p className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.2em] text-amber-300/90">
              Advertisement · 1–5 PM
            </p>
            <p className="text-sm sm:text-base font-bold text-white mt-0.5">{ad.title}</p>
          </div>
          <p className="text-[10px] sm:text-xs font-semibold text-slate-300 tabular-nums">
            {index + 1}/{validAds.length}
          </p>
        </div>
      </div>

      {validAds.length > 1 ? (
        <div className="shrink-0 flex items-center justify-center gap-1.5 py-2 bg-slate-950/95 border-t border-slate-800">
          {validAds.map((item, i) => (
            <span
              key={item.id}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/30'
              }`}
              aria-hidden
            />
          ))}
        </div>
      ) : null}

      <style>{`
        @keyframes npl-score-daypart-kenburns {
          from { transform: scale(1.02); }
          to { transform: scale(1.1); }
        }
        .npl-score-daypart-kenburns {
          animation: npl-score-daypart-kenburns ${SLIDE_MS}ms ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .npl-score-daypart-kenburns { animation: none !important; }
        }
      `}</style>
    </div>
  );
}

export default ScoreDaypartAdPlayer;
