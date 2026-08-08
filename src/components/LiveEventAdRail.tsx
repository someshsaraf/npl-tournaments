import { useEffect, useState } from 'react';
import type { EventAd } from '../data/eventAds';
import { getAllEventAds, isSafeAdPosterPath } from '../data/eventAds';

const ROTATE_MS = 5500;

/**
 * Slim left-edge "lobby card" rail for /live — always shows both community posters
 * (no date filter). Peek without covering stream center or top-right score.
 *
 * Concurrency: local timers/state only; cleaned up on unmount.
 * Security: allowlisted poster paths only.
 * Input validation: filters invalid ads before render.
 */
export function LiveEventAdRail() {
  const [ads] = useState<EventAd[]>(() =>
    getAllEventAds().filter(
      (ad) => ad && isSafeAdPosterPath(ad.posterSrc) && typeof ad.title === 'string'
    )
  );
  const [focus, setFocus] = useState(0);
  const [peek, setPeek] = useState<EventAd | null>(null);

  useEffect(() => {
    if (ads.length <= 1) return;
    const id = window.setInterval(() => {
      setFocus((i) => (i + 1) % ads.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [ads.length]);

  useEffect(() => {
    if (!peek) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPeek(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [peek]);

  if (ads.length === 0) return null;

  return (
    <>
      <aside
        className="npl-live-ad-rail absolute z-[55] pointer-events-auto top-1/2 -translate-y-1/2 left-[max(0.2rem,env(safe-area-inset-left))] flex flex-col items-start gap-2 pl-0.5"
        aria-label="Community announcements"
      >
        <p className="hidden sm:block text-[8px] font-black uppercase tracking-[0.18em] text-white/55 px-1 mb-0.5 writing-mode-vertical">
          Today
        </p>
        <ul className="flex flex-col gap-2">
          {ads.map((ad, i) => {
            const active = i === focus;
            const amber = ad.accent !== 'saffron';
            return (
              <li key={ad.id} className="relative">
                <button
                  type="button"
                  onClick={() => setPeek(ad)}
                  aria-label={`View poster: ${ad.title}`}
                  title={ad.title}
                  className={`group relative block overflow-hidden rounded-md border shadow-lg transition-all duration-500 ease-out focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
                    amber ? 'border-amber-400/50' : 'border-orange-400/50'
                  } ${
                    active
                      ? 'w-[3.15rem] sm:w-[3.6rem] opacity-100 scale-100 ring-1 ring-white/30'
                      : 'w-[2.85rem] sm:w-[3.2rem] opacity-95 scale-[0.98] hover:opacity-100'
                  }`}
                  style={{
                    aspectRatio: '2 / 3',
                    transform: active
                      ? 'translateX(0) rotate(-1.5deg)'
                      : 'translateX(0) rotate(1.5deg)'
                  }}
                >
                  <img
                    src={ad.posterSrc}
                    alt=""
                    className={`h-full w-full object-cover object-top ${
                      active ? 'npl-live-ad-kenburns' : ''
                    }`}
                    draggable={false}
                  />
                  <span
                    className={`absolute inset-x-0 bottom-0 px-0.5 py-0.5 text-center text-[7px] sm:text-[8px] font-black uppercase tracking-wide leading-tight ${
                      amber
                        ? 'bg-amber-400/95 text-slate-950'
                        : 'bg-orange-400/95 text-slate-950'
                    }`}
                  >
                    {ad.shortTag || 'Promo'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {peek && isSafeAdPosterPath(peek.posterSrc) ? (
        <div
          className="absolute inset-0 z-[85] flex items-center justify-center bg-black/70 p-3 sm:p-6 pointer-events-auto"
          role="dialog"
          aria-modal="true"
          aria-label={peek.title}
          onClick={() => setPeek(null)}
        >
          <div
            className="relative max-h-[min(88dvh,52rem)] max-w-[min(92vw,22rem)] npl-live-ad-peek-in"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={peek.posterSrc}
              alt={peek.alt}
              className="max-h-[min(88dvh,52rem)] w-auto max-w-full rounded-lg shadow-2xl ring-1 ring-white/20 object-contain"
              draggable={false}
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="min-w-0 text-[11px] font-bold text-white truncate">{peek.title}</p>
              <button
                type="button"
                onClick={() => setPeek(null)}
                className="shrink-0 rounded-lg bg-white/15 hover:bg-white/25 text-white text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 border border-white/25"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`
        @keyframes npl-live-ad-kenburns {
          from { transform: scale(1); }
          to { transform: scale(1.08); }
        }
        @keyframes npl-live-ad-peek-in {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .npl-live-ad-kenburns {
          animation: npl-live-ad-kenburns ${ROTATE_MS}ms ease-out both;
        }
        .npl-live-ad-peek-in {
          animation: npl-live-ad-peek-in 0.35s cubic-bezier(0.22, 1.1, 0.36, 1) both;
        }
        @media (prefers-reduced-motion: reduce) {
          .npl-live-ad-kenburns,
          .npl-live-ad-peek-in {
            animation: none !important;
          }
        }
      `}</style>
    </>
  );
}

export default LiveEventAdRail;
