import { useEffect, useRef, useState } from 'react';
import type { EventAd } from '../data/eventAds';
import { getActiveEventAds, isSafeAdPosterPath } from '../data/eventAds';

const ROTATE_MS = 8000;

function filterValidAds(ads: EventAd[] | null | undefined): EventAd[] {
  if (!Array.isArray(ads)) return [];
  return ads.filter(
    (ad) =>
      ad &&
      isSafeAdPosterPath(ad.posterSrc) &&
      typeof ad.title === 'string' &&
      ad.title.trim().length > 0
  );
}

/**
 * Cinematic single-slot home promo: poster-forward spotlight with per-ad templates.
 * Rotates active ads; pause on hover/focus. One composition — no stacked banners.
 *
 * Concurrency: local timers/state only; cleaned up on unmount.
 * Security: allowlisted poster paths only.
 * Input validation: filters invalid ads before render.
 */
export function HomeEventAdBanner({ ads }: { ads: EventAd[] }) {
  const validAds = filterValidAds(ads);
  const count = validAds.length;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const indexRef = useRef(0);
  const progressRef = useRef(0);
  const startedRef = useRef(performance.now());

  useEffect(() => {
    indexRef.current = index;
    startedRef.current = performance.now();
    progressRef.current = 0;
    setProgress(0);
  }, [index]);

  useEffect(() => {
    if (count <= 1) return;
    if (paused) {
      // Freeze: keep started offset so resume continues from same progress.
      startedRef.current = performance.now() - progressRef.current * ROTATE_MS;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = now - startedRef.current;
      const ratio = Math.min(1, elapsed / ROTATE_MS);
      progressRef.current = ratio;
      setProgress(ratio);
      if (ratio >= 1) {
        const next = (indexRef.current + 1) % count;
        indexRef.current = next;
        startedRef.current = now;
        progressRef.current = 0;
        setIndex(next);
        setProgress(0);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [count, paused, index]);

  useEffect(() => {
    if (count === 0) return;
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (count === 0) return null;

  const ad = validAds[Math.min(index, count - 1)]!;
  const template = ad.template;
  const isKitchen = template === 'kitchen-marquee';
  const isExhibition = template === 'exhibition-spot';
  const isStreet = template === 'street-food';

  const accentBar = isKitchen
    ? 'from-amber-400 via-orange-500 to-amber-600'
    : isExhibition
      ? 'from-amber-200 via-yellow-600 to-amber-800'
      : isStreet
        ? 'from-lime-400 via-yellow-400 to-rose-500'
        : 'from-orange-400 via-white to-emerald-500';
  const glow = isKitchen
    ? 'shadow-[0_0_40px_-8px_rgba(251,191,36,0.45)]'
    : isExhibition
      ? 'shadow-[0_0_40px_-8px_rgba(202,138,4,0.5)]'
      : isStreet
        ? 'shadow-[0_0_40px_-8px_rgba(132,204,22,0.45)]'
        : 'shadow-[0_0_40px_-8px_rgba(249,115,22,0.4)]';
  const ctaClass = isKitchen
    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300 shadow-amber-400/25'
    : isExhibition
      ? 'bg-yellow-600 text-slate-950 hover:bg-yellow-500 shadow-yellow-600/25'
      : isStreet
        ? 'bg-lime-400 text-slate-950 hover:bg-lime-300 shadow-lime-400/25'
        : 'bg-orange-400 text-slate-950 hover:bg-orange-300 shadow-orange-400/25';
  const tagClass = isKitchen
    ? 'bg-amber-400/95 text-slate-950'
    : isExhibition
      ? 'bg-gradient-to-r from-amber-200 via-yellow-500 to-amber-700 text-slate-950'
      : isStreet
        ? 'bg-gradient-to-r from-lime-400 via-yellow-300 to-rose-500 text-slate-950'
        : 'bg-gradient-to-r from-orange-500 via-white to-emerald-500 text-slate-950';
  const eyebrowLabel = isKitchen
    ? 'Clubhouse kitchen'
    : isExhibition
      ? 'RNW exhibition'
      : isStreet
        ? 'Court snacks'
        : 'Kids · Clubhouse';
  const kenburnsClass = isKitchen
    ? 'npl-promo-kenburns object-[center_20%]'
    : isExhibition
      ? 'npl-promo-kenburns-exhibition object-[center_25%]'
      : isStreet
        ? 'npl-promo-kenburns-street object-[center_30%]'
        : 'npl-promo-kenburns-alt object-[center_15%]';
  const tiltClass = isKitchen
    ? 'npl-promo-card-tilt-kitchen'
    : isExhibition
      ? 'npl-promo-card-tilt-exhibition'
      : isStreet
        ? 'npl-promo-card-tilt-street'
        : 'npl-promo-card-tilt-festival';
  const dotActiveClass = isKitchen
    ? 'w-5 bg-amber-400'
    : isExhibition
      ? 'w-5 bg-yellow-500'
      : isStreet
        ? 'w-5 bg-lime-400'
        : 'w-5 bg-orange-400';

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Community announcements"
      className={`npl-promo-spotlight relative overflow-hidden rounded-2xl border border-white/10 ${glow}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
    >
      {/* Full-bleed poster stage */}
      <a
        href={ad.posterSrc}
        target="_blank"
        rel="noopener noreferrer"
        className="group relative block h-[10.5rem] sm:h-[12rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-inset"
        aria-label={`${ad.ctaLabel}: ${ad.title}`}
      >
        <img
          key={ad.id}
          src={ad.posterSrc}
          alt={ad.alt}
          className={`absolute inset-0 h-full w-full object-cover ${kenburnsClass}`}
          draggable={false}
        />

        {/* Template atmospheres */}
        {isKitchen ? (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,transparent_20%,rgba(2,6,23,0.55)_70%,rgba(2,6,23,0.92)_100%)]" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-transparent w-[72%] sm:w-[58%]" />
            <div className="pointer-events-none absolute -left-8 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-amber-500/20 blur-3xl npl-promo-pulse" />
          </>
        ) : isExhibition ? (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_72%_35%,transparent_18%,rgba(28,25,23,0.55)_68%,rgba(2,6,23,0.94)_100%)]" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-stone-950/80 to-transparent w-[74%] sm:w-[60%]" />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-amber-200 via-yellow-600 to-amber-900"
              aria-hidden
            />
            <div className="pointer-events-none absolute right-8 bottom-4 h-28 w-28 rounded-full bg-yellow-600/20 blur-3xl npl-promo-pulse" />
          </>
        ) : isStreet ? (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_68%_40%,transparent_16%,rgba(2,6,23,0.52)_66%,rgba(2,6,23,0.93)_100%)]" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-emerald-950/70 to-transparent w-[74%] sm:w-[60%]" />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-lime-400 via-yellow-400 to-rose-500"
              aria-hidden
            />
            <div className="pointer-events-none absolute right-6 top-2 h-24 w-24 rounded-full bg-lime-400/20 blur-2xl npl-promo-pulse" />
          </>
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_75%_30%,transparent_15%,rgba(2,6,23,0.5)_65%,rgba(2,6,23,0.92)_100%)]" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/75 to-transparent w-[74%] sm:w-[60%]" />
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-orange-400 via-white to-emerald-500"
              aria-hidden
            />
            <div className="pointer-events-none absolute right-6 top-0 h-24 w-24 rounded-full bg-orange-400/15 blur-2xl npl-promo-pulse" />
          </>
        )}

        {/* Ticket / festival ribbon */}
        <span
          className={`absolute top-3 left-3 z-10 rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] shadow-md ${tagClass} npl-promo-tag-in`}
        >
          {ad.shortTag || ad.eyebrow}
        </span>

        {/* Copy overlay */}
        <div className="absolute inset-0 z-10 flex flex-col justify-end sm:justify-center p-3.5 sm:p-5 pr-16 sm:pr-24 max-w-xl npl-promo-copy-in">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] font-bold text-emerald-300/90 mb-1">
            {eyebrowLabel}
          </p>
          <h2 className="portal-display text-2xl sm:text-3xl text-white leading-none tracking-wide drop-shadow-lg">
            {ad.title}
          </h2>
          <p className="mt-1.5 text-[11px] sm:text-xs text-slate-200/90 line-clamp-2 max-w-md">
            {ad.blurb}
          </p>
          <span
            className={`mt-2.5 inline-flex w-fit items-center rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wide shadow-lg transition-transform group-hover:scale-[1.03] group-active:scale-95 ${ctaClass}`}
          >
            {ad.ctaLabel}
          </span>
        </div>

        {/* Portrait poster peek (desktop) — framed like a lobby card */}
        <div
          className={`pointer-events-none absolute right-3 sm:right-4 top-1/2 hidden sm:block -translate-y-1/2 w-[5.75rem] md:w-[6.75rem] ${tiltClass}`}
          aria-hidden
        >
          <div className="aspect-[2/3] rounded-lg overflow-hidden ring-2 ring-white/25 shadow-2xl npl-promo-card-float">
            <img
              key={`${ad.id}-peek`}
              src={ad.posterSrc}
              alt=""
              className="h-full w-full object-cover object-top"
              draggable={false}
            />
            <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${accentBar}`} />
          </div>
        </div>
      </a>

      {/* Bottom chrome: progress + dots */}
      <div className="absolute inset-x-0 bottom-0 z-20 flex items-center gap-2 px-3 pb-2 pt-6 bg-gradient-to-t from-slate-950/90 to-transparent">
        <div
          className="flex-1 h-0.5 rounded-full bg-white/15 overflow-hidden"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Next announcement"
        >
          <div
            className={`h-full rounded-full bg-gradient-to-r ${accentBar} transition-[width] duration-100 ease-linear`}
            style={{ width: count > 1 && !paused ? `${Math.round(progress * 100)}%` : paused ? `${Math.round(progress * 100)}%` : '100%' }}
          />
        </div>
        {count > 1 ? (
          <div className="flex items-center gap-1.5 shrink-0" role="tablist" aria-label="Choose announcement">
            {validAds.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={item.title}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  indexRef.current = i;
                  setIndex(i);
                }}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? dotActiveClass : 'w-1.5 bg-white/35 hover:bg-white/55'
                }`}
              />
            ))}
          </div>
        ) : null}
      </div>

      <style>{`
        @keyframes npl-promo-kenburns {
          from { transform: scale(1.05) translate3d(0, 0, 0); }
          to { transform: scale(1.18) translate3d(-2%, -1.5%, 0); }
        }
        @keyframes npl-promo-kenburns-alt {
          from { transform: scale(1.08) translate3d(0, 0, 0); }
          to { transform: scale(1.2) translate3d(2%, -2%, 0); }
        }
        @keyframes npl-promo-kenburns-exhibition {
          from { transform: scale(1.06) translate3d(0, 0, 0); }
          to { transform: scale(1.16) translate3d(1.5%, -1%, 0); }
        }
        @keyframes npl-promo-kenburns-street {
          from { transform: scale(1.05) translate3d(0, 0, 0); }
          to { transform: scale(1.14) translate3d(-1%, 1.5%, 0); }
        }
        @keyframes npl-promo-pulse {
          0%, 100% { opacity: 0.45; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.08); }
        }
        @keyframes npl-promo-tag-in {
          from { opacity: 0; transform: translateY(-8px) scale(0.92); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes npl-promo-copy-in {
          from { opacity: 0; transform: translateX(-12px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes npl-promo-card-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .npl-promo-kenburns {
          animation: npl-promo-kenburns ${ROTATE_MS}ms ease-out both;
        }
        .npl-promo-kenburns-alt {
          animation: npl-promo-kenburns-alt ${ROTATE_MS}ms ease-out both;
        }
        .npl-promo-kenburns-exhibition {
          animation: npl-promo-kenburns-exhibition ${ROTATE_MS}ms ease-out both;
        }
        .npl-promo-kenburns-street {
          animation: npl-promo-kenburns-street ${ROTATE_MS}ms ease-out both;
        }
        .npl-promo-pulse {
          animation: npl-promo-pulse 3.2s ease-in-out infinite;
        }
        .npl-promo-tag-in {
          animation: npl-promo-tag-in 0.45s cubic-bezier(0.22, 1.2, 0.36, 1) both;
        }
        .npl-promo-copy-in {
          animation: npl-promo-copy-in 0.5s ease-out both;
        }
        .npl-promo-card-float {
          animation: npl-promo-card-float 4s ease-in-out infinite;
          position: relative;
        }
        .npl-promo-card-tilt-kitchen {
          transform: rotate(2.5deg);
        }
        .npl-promo-card-tilt-festival {
          transform: rotate(-2.5deg);
        }
        .npl-promo-card-tilt-exhibition {
          transform: rotate(1.5deg);
        }
        .npl-promo-card-tilt-street {
          transform: rotate(-1.75deg);
        }
        @media (prefers-reduced-motion: reduce) {
          .npl-promo-kenburns,
          .npl-promo-kenburns-alt,
          .npl-promo-kenburns-exhibition,
          .npl-promo-kenburns-street,
          .npl-promo-pulse,
          .npl-promo-tag-in,
          .npl-promo-copy-in,
          .npl-promo-card-float {
            animation: none !important;
          }
        }
      `}</style>
    </section>
  );
}

/**
 * Date/time-active ads for the home page.
 * Refreshes every minute so mid-day cutoffs (e.g. Drawing at 14:00) apply without reload.
 */
export function useHomeEventAds(): EventAd[] {
  const [ads, setAds] = useState<EventAd[]>(() => getActiveEventAds());

  useEffect(() => {
    const refresh = () => setAds(getActiveEventAds());
    refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, []);

  return ads;
}

export default HomeEventAdBanner;
