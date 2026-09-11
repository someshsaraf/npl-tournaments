import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Camera, Info, MessageCircleQuestion, Sparkles } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { db } from '../firebase';
import { HomeEventAdBanner, useHomeEventAds } from '../components/HomeEventAdBanner';
import { Reveal } from '../components/Reveal';
import {
  getEventStatus,
  selectFeaturedEvent,
  type CommunityEvent,
  type EventStatus
} from '../data/communityEvents';
import { subscribeCommunityEvents } from '../utils/communityEvents';

const STATUS_LABEL: Record<EventStatus, string> = {
  ongoing: 'Happening now',
  upcoming: 'Coming up',
  past: 'Wrapped up',
  undated: 'Date TBD'
};

const STATUS_ORDER: Record<EventStatus, number> = {
  ongoing: 0,
  upcoming: 1,
  undated: 2,
  past: 3
};

// Ask and About RNW are temporarily disabled — shown greyed out with a
// "Soon" tag rather than removed. Flip `disabled` to re-enable.
const QUICK_LINKS: ReadonlyArray<{ to: string; label: string; icon: LucideIcon; disabled?: boolean }> = [
  { to: '/photos', label: 'Photos', icon: Camera },
  { to: '/ask', label: 'Ask', icon: MessageCircleQuestion, disabled: true },
  { to: '/about', label: 'About RNW', icon: Info, disabled: true }
];

/** Bento span pattern — a big featured tile, occasional wide tiles, rest square. */
function tileSpan(index: number): string {
  if (index === 0) return 'col-span-2 row-span-2';
  if (index % 5 === 3) return 'col-span-2 row-span-1';
  return 'col-span-1 row-span-1';
}

/**
 * Home = a bento-style poster wall of every event (cultural + sports).
 * Live/upcoming events lead the grid; completed events sit in their own
 * archive strip below. Clicking a tile opens that event's own page.
 */
export default function HomePage() {
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const homeAds = useHomeEventAds();

  useEffect(() => {
    const unsubEvents = subscribeCommunityEvents(db, setEvents);
    return () => unsubEvents();
  }, []);

  const { active, completed } = useMemo(() => {
    const byRecency = (a: CommunityEvent, b: CommunityEvent) => {
      if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate);
      if (a.startDate) return -1;
      if (b.startDate) return 1;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    };

    const activeList = events
      .filter((e) => getEventStatus(e) !== 'past')
      .sort((a, b) => STATUS_ORDER[getEventStatus(a)] - STATUS_ORDER[getEventStatus(b)] || byRecency(a, b));

    const completedList = events
      .filter((e) => getEventStatus(e) === 'past')
      .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));

    return { active: activeList, completed: completedList };
  }, [events]);

  const featured = useMemo(() => selectFeaturedEvent(events), [events]);

  return (
    <div className="relative space-y-12">
      <div className="npl-blob -top-24 -left-20 size-80 bg-orange-500/25" aria-hidden />
      <div className="npl-blob top-32 -right-28 size-96 bg-rose-500/20" aria-hidden />
      <div className="npl-blob top-[60vh] left-1/3 size-96 bg-indigo-500/15" aria-hidden />

      {featured ? (
        <Reveal className="relative z-10">
          <HeroBanner event={featured} />
        </Reveal>
      ) : null}

      {homeAds.length > 0 ? <HomeEventAdBanner ads={homeAds} /> : null}

      {QUICK_LINKS.length > 0 ? (
        <Reveal
          delayMs={60}
          className={`relative z-10 grid gap-2.5 sm:gap-3.5 ${
            QUICK_LINKS.length === 3
              ? 'grid-cols-3'
              : QUICK_LINKS.length === 2
                ? 'grid-cols-2'
                : 'grid-cols-1'
          }`}
        >
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            if (link.disabled) {
              return (
                <div
                  key={link.to}
                  aria-disabled="true"
                  className="npl-glass flex items-center justify-center gap-2 rounded-xl px-3 py-3.5 sm:py-4 opacity-50 cursor-not-allowed"
                >
                  <Icon className="size-4 sm:size-5 text-slate-400 shrink-0" aria-hidden />
                  <span className="text-xs sm:text-sm font-bold text-slate-400 truncate">{link.label}</span>
                  <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-500 shrink-0">
                    Soon
                  </span>
                </div>
              );
            }
            return (
              <Link
                key={link.to}
                to={link.to}
                className="npl-glass group flex items-center justify-center gap-2 rounded-xl px-3 py-3.5 sm:py-4 transition-all hover:-translate-y-0.5 hover:border-white/25"
              >
                <Icon className="size-4 sm:size-5 text-amber-300 shrink-0" aria-hidden />
                <span className="text-xs sm:text-sm font-bold text-white truncate">{link.label}</span>
              </Link>
            );
          })}
        </Reveal>
      ) : null}

      <Reveal delayMs={100} className="relative z-10 space-y-4">
        <header className="flex items-end justify-between gap-3">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <Sparkles className="size-4 text-amber-400" aria-hidden />
              <h1 className="npl-flame-text portal-display text-3xl sm:text-4xl tracking-wide">
                All events
              </h1>
            </div>
            <p className="text-sm text-slate-400 pl-6">
              Cultural celebrations and sports tournaments — tap one for details.
            </p>
          </div>
        </header>

        {active.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-slate-800 bg-slate-900/40">
            Nothing live or upcoming right now — check Completed below.
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 auto-rows-[130px] sm:auto-rows-[150px] gap-3 sm:gap-4">
            {active.map((event, i) => (
              <EventTile key={event.id} event={event} spanClass={tileSpan(i)} big={i === 0} />
            ))}
          </div>
        )}
      </Reveal>

      {completed.length > 0 ? (
        <Reveal delayMs={150} className="relative z-10">
          <section className="npl-glass rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Completed
              </h2>
              <span className="text-[11px] text-slate-600">{completed.length} wrapped up</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
              {completed.map((event) => (
                <CompletedTile key={event.id} event={event} />
              ))}
            </div>
          </section>
        </Reveal>
      ) : null}
    </div>
  );
}

function HeroBanner({ event }: { event: CommunityEvent }) {
  const status = getEventStatus(event);
  return (
    <Link
      to={`/events/${event.id}`}
      className="group relative block w-full h-[56vh] min-h-80 max-h-[600px] rounded-3xl overflow-hidden border border-white/10 shadow-2xl shadow-black/50 ring-1 ring-white/5"
    >
      {event.imageSrc ? (
        <img
          src={event.imageSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          loading="eager"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(251,146,60,0.22),_transparent_65%)] bg-slate-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />

      <div className="relative h-full flex flex-col justify-end p-6 sm:p-12 space-y-3 max-w-2xl">
        <span
          className={`w-fit inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border backdrop-blur-sm ${
            status === 'ongoing'
              ? 'bg-rose-500/20 text-rose-200 border-rose-400/50'
              : 'bg-white/10 text-white border-white/30'
          }`}
        >
          {status === 'ongoing' ? (
            <span className="npl-glow-pulse size-1.5 rounded-full bg-rose-400" aria-hidden />
          ) : null}
          {STATUS_LABEL[status]}
        </span>
        <p className="text-sm font-mono text-amber-300/90">
          {event.month} · {event.dateLabel}
        </p>
        <h1 className="npl-flame-text portal-display text-5xl sm:text-7xl tracking-wide leading-[0.95] [text-shadow:0_4px_32px_rgba(0,0,0,0.6)]">
          {event.title}
        </h1>
        {event.description ? (
          <p className="text-sm sm:text-base text-slate-200/90 max-w-lg">{event.description}</p>
        ) : null}
        <span className="mt-2 inline-flex items-center gap-2 w-fit rounded-full bg-white text-slate-950 font-bold text-sm px-5 py-2.5 shadow-lg shadow-black/30 transition-all group-hover:gap-3 group-hover:shadow-orange-500/30">
          Explore event
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

function EventTile({
  event,
  spanClass,
  big
}: {
  event: CommunityEvent;
  spanClass: string;
  big: boolean;
}) {
  const status = getEventStatus(event);
  const isCultural = event.category !== 'sports';
  const images = [event.imageSrc, ...(event.galleryImages ?? [])].filter(
    (src): src is string => !!src
  );

  return (
    <Link
      to={`/events/${event.id}`}
      className={`group relative overflow-hidden rounded-2xl border border-white/10 transition-all duration-300 hover:-translate-y-1 hover:border-white/25 hover:shadow-2xl ${
        isCultural ? 'hover:shadow-rose-950/60' : 'hover:shadow-indigo-950/60'
      } ${spanClass}`}
    >
      <div className="absolute inset-0 bg-slate-900">
        {images.length > 1 ? (
          <div
            className="npl-tile-strip flex h-full"
            style={
              {
                width: `${images.length * 100}%`,
                '--npl-pan-end': `${-((images.length - 1) / images.length) * 100}%`,
                '--npl-pan-duration': `${images.length * 3}s`
              } as CSSProperties
            }
          >
            {images.map((src, i) => (
              <img
                key={src + i}
                src={src}
                alt={i === 0 ? event.title : ''}
                className="h-full object-cover"
                style={{ width: `${100 / images.length}%` }}
                loading="lazy"
              />
            ))}
          </div>
        ) : images.length === 1 ? (
          <img src={images[0]} alt={event.title} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(ellipse_at_center,_rgba(251,146,60,0.18),_transparent_60%)] flex items-center justify-center">
            <img
              src="/nature-walk-logo-1.png"
              alt=""
              className="h-10 w-10 rounded-lg object-cover ring-1 ring-white/20 bg-white"
              draggable={false}
            />
          </div>
        )}
      </div>

      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/25 to-transparent" />
      <div
        className={`absolute inset-0 rounded-2xl ring-1 ring-inset opacity-0 group-hover:opacity-100 transition-opacity ${
          isCultural ? 'ring-rose-400/40' : 'ring-indigo-400/40'
        }`}
        aria-hidden
      />

      <div className="relative h-full flex flex-col justify-between p-2.5 sm:p-3.5">
        <div className="flex items-center justify-between gap-1.5">
          <span
            className={`text-[8px] sm:text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border backdrop-blur-sm ${
              status === 'ongoing'
                ? 'bg-rose-500/20 text-rose-200 border-rose-400/50'
                : 'bg-white/10 text-white/90 border-white/25'
            }`}
          >
            {STATUS_LABEL[status]}
          </span>
          <span
            className={`hidden sm:inline text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
              isCultural ? 'bg-rose-400/15 text-rose-300' : 'bg-indigo-400/15 text-indigo-300'
            }`}
          >
            {isCultural ? 'Cultural' : 'Sports'}
          </span>
        </div>
        <div className="space-y-0.5">
          <h2
            className={`portal-display text-white tracking-wide leading-none truncate ${
              big ? 'text-2xl sm:text-4xl' : 'text-sm sm:text-lg'
            }`}
          >
            {event.title}
          </h2>
          <p className="text-[10px] sm:text-xs font-mono text-amber-300/90 truncate">
            {event.month} · {event.dateLabel}
          </p>
        </div>
      </div>
    </Link>
  );
}

function CompletedTile({ event }: { event: CommunityEvent }) {
  const images = [event.imageSrc, ...(event.galleryImages ?? [])].filter(
    (src): src is string => !!src
  );

  return (
    <Link
      to={`/events/${event.id}`}
      className="group shrink-0 w-40 rounded-xl border border-white/10 bg-slate-900/40 overflow-hidden flex flex-col opacity-70 hover:opacity-100 transition-opacity"
    >
      {images.length > 1 ? (
        <div className="relative w-full h-20 overflow-hidden">
          <div
            className="npl-tile-strip flex h-full grayscale-[40%] group-hover:grayscale-0 transition-[filter]"
            style={
              {
                width: `${images.length * 100}%`,
                '--npl-pan-end': `${-((images.length - 1) / images.length) * 100}%`,
                '--npl-pan-duration': `${images.length * 3}s`
              } as CSSProperties
            }
          >
            {images.map((src, i) => (
              <img
                key={src + i}
                src={src}
                alt={i === 0 ? event.title : ''}
                className="h-full object-cover"
                style={{ width: `${100 / images.length}%` }}
                loading="lazy"
              />
            ))}
          </div>
        </div>
      ) : images.length === 1 ? (
        <img src={images[0]} alt={event.title} className="w-full h-20 object-cover grayscale-[40%]" loading="lazy" />
      ) : (
        <div className="w-full h-20 bg-slate-800/60 flex items-center justify-center">
          <img
            src="/nature-walk-logo-1.png"
            alt=""
            className="h-8 w-8 rounded object-cover opacity-70"
            draggable={false}
          />
        </div>
      )}
      <div className="p-2.5 space-y-0.5">
        <h3 className="text-xs font-semibold text-slate-300 truncate group-hover:text-white">
          {event.title}
        </h3>
        <p className="text-[10px] font-mono text-slate-500 truncate">{event.dateLabel}</p>
      </div>
    </Link>
  );
}
