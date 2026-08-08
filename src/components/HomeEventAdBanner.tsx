import { useState } from 'react';
import type { EventAd } from '../data/eventAds';
import { getActiveEventAds } from '../data/eventAds';

/**
 * Home / portal promo strip for a date-active community ad.
 * Accent styles are fixed allowlisted variants (no user CSS injection).
 */
export function HomeEventAdBanner({ ad }: { ad: EventAd }) {
  if (!ad || typeof ad.posterSrc !== 'string' || !ad.posterSrc.startsWith('/')) {
    return null;
  }

  const amber = ad.accent !== 'saffron';
  const shell = amber
    ? 'overflow-hidden rounded-2xl border border-amber-700/40 bg-gradient-to-br from-amber-950/50 via-slate-900/80 to-emerald-950/40'
    : 'overflow-hidden rounded-2xl border border-orange-700/40 bg-gradient-to-br from-orange-950/45 via-slate-900/80 to-emerald-950/40';
  const eyebrow = amber ? 'text-amber-400' : 'text-orange-300';
  const focusRing = amber
    ? 'focus-visible:ring-amber-400'
    : 'focus-visible:ring-orange-400';
  const borderSide = amber ? 'sm:border-r border-amber-800/30' : 'sm:border-r border-orange-800/30';
  const cta = amber
    ? 'rounded-lg bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wide px-3 py-2.5 hover:bg-amber-300'
    : 'rounded-lg bg-orange-400 text-slate-950 font-bold text-xs uppercase tracking-wide px-3 py-2.5 hover:bg-orange-300';

  return (
    <section aria-label={ad.title} className={shell}>
      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,11rem)_1fr] md:grid-cols-[minmax(0,14rem)_1fr] gap-0">
        <a
          href={ad.posterSrc}
          target="_blank"
          rel="noopener noreferrer"
          className={`block relative bg-white/5 ${borderSide} focus:outline-none focus-visible:ring-2 ${focusRing} focus-visible:ring-inset`}
        >
          <img
            src={ad.posterSrc}
            alt={ad.alt}
            className="w-full h-48 sm:h-full sm:min-h-[11rem] object-cover object-top"
            loading="lazy"
            draggable={false}
          />
        </a>
        <div className="flex flex-col justify-center gap-2 px-4 sm:px-5 py-4 sm:py-5">
          <p className={`text-[11px] uppercase tracking-[0.18em] font-bold ${eyebrow}`}>
            {ad.eyebrow}
          </p>
          <h2 className="text-xl sm:text-2xl font-bold text-white leading-tight">{ad.title}</h2>
          <p className="text-sm text-slate-300 max-w-xl">{ad.blurb}</p>
          <a
            href={ad.posterSrc}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-1 inline-flex w-fit items-center ${cta}`}
          >
            {ad.ctaLabel}
          </a>
        </div>
      </div>
    </section>
  );
}

/**
 * All date-active ads for the home page (stable snapshot per mount).
 * Friends' Kitchen only on 2026-08-08; Drawing Competition through 2026-08-15.
 */
export function useHomeEventAds(): EventAd[] {
  const [ads] = useState<EventAd[]>(() => getActiveEventAds());
  return ads;
}

export default HomeEventAdBanner;
