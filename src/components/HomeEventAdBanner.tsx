import { useEffect, useRef, useState } from 'react';
import type { EventAd } from '../data/eventAds';
import { getActiveEventAds, isSafeAdPosterPath } from '../data/eventAds';

const ROTATE_MS = 7000;

/**
 * Compact single-slot home ads: one slim strip that auto-rotates active posters.
 * Saves vertical space vs stacking banners. Pause on hover/focus.
 *
 * Concurrency: local interval + state only; cleaned up on unmount.
 * Security: only allowlisted poster paths from eventAds.
 * Input validation: filters invalid ads before render.
 */
export function HomeEventAdBanner({ ads }: { ads: EventAd[] }) {
  const validAds = (Array.isArray(ads) ? ads : []).filter(
    (ad) => ad && isSafeAdPosterPath(ad.posterSrc) && typeof ad.title === 'string'
  );
  const count = validAds.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const indexRef = useRef(0);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    if (count <= 1 || paused) return;
    const id = window.setInterval(() => {
      const next = (indexRef.current + 1) % count;
      indexRef.current = next;
      setIndex(next);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [count, paused]);

  // Clamp if ads list shrinks.
  useEffect(() => {
    if (count === 0) return;
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (count === 0) return null;

  const ad = validAds[Math.min(index, count - 1)]!;
  const amber = ad.accent !== 'saffron';
  const shell = amber
    ? 'border-amber-700/35 bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-slate-900/80'
    : 'border-orange-700/35 bg-gradient-to-r from-orange-950/40 via-slate-900/90 to-slate-900/80';
  const eyebrow = amber ? 'text-amber-400' : 'text-orange-300';
  const dotActive = amber ? 'bg-amber-400' : 'bg-orange-400';

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Community announcements"
      className={`relative overflow-hidden rounded-xl border ${shell}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      <div className="flex items-stretch gap-0 min-h-[4.75rem] sm:min-h-[5.25rem]">
        <a
          href={ad.posterSrc}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 w-[4.5rem] sm:w-[5.5rem] self-stretch focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-inset"
          aria-label={`Open poster: ${ad.title}`}
        >
          <img
            key={ad.id}
            src={ad.posterSrc}
            alt=""
            className="h-full w-full object-cover object-top npl-home-ad-fade"
            draggable={false}
          />
        </a>

        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5 px-3 sm:px-4 py-2.5 pr-14 sm:pr-16">
          <p className={`text-[10px] uppercase tracking-[0.16em] font-bold ${eyebrow}`}>
            {ad.eyebrow}
          </p>
          <p className="text-sm sm:text-base font-bold text-white leading-snug truncate">
            {ad.title}
          </p>
          <p className="text-[11px] sm:text-xs text-slate-400 line-clamp-1 sm:line-clamp-2">
            {ad.blurb}
          </p>
          <a
            href={ad.posterSrc}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-1 w-fit text-[11px] font-bold uppercase tracking-wide ${
              amber ? 'text-amber-300 hover:text-amber-200' : 'text-orange-300 hover:text-orange-200'
            }`}
          >
            {ad.ctaLabel} →
          </a>
        </div>
      </div>

      {count > 1 ? (
        <div
          className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5"
          role="tablist"
          aria-label="Choose announcement"
        >
          {validAds.map((item, i) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={item.title}
              onClick={() => {
                indexRef.current = i;
                setIndex(i);
              }}
              className={`size-2 rounded-full transition-colors ${
                i === index ? dotActive : 'bg-slate-600 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>
      ) : null}

      <style>{`
        @keyframes npl-home-ad-fade {
          from { opacity: 0.55; }
          to { opacity: 1; }
        }
        .npl-home-ad-fade {
          animation: npl-home-ad-fade 0.45s ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .npl-home-ad-fade { animation: none; }
        }
      `}</style>
    </section>
  );
}

/**
 * Date-active ads for the home page (stable snapshot per mount).
 */
export function useHomeEventAds(): EventAd[] {
  const [ads] = useState<EventAd[]>(() => getActiveEventAds());
  return ads;
}

export default HomeEventAdBanner;
