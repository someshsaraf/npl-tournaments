import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { db } from '../firebase';
import { HomeEventAdBanner, useHomeEventAds } from '../components/HomeEventAdBanner';
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

/**
 * Home = a tiled view of every event (cultural + sports). Live/upcoming
 * events lead in the main grid; completed events sit in their own pane
 * below so they read as an archive, not competing for attention.
 * Clicking a tile opens that event's own page (/events/:id).
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
    <div className="space-y-8">
      {featured ? <HeroBanner event={featured} /> : null}

      {homeAds.length > 0 ? <HomeEventAdBanner ads={homeAds} /> : null}

      <div className="space-y-4">
        <header className="space-y-1">
          <h1 className="portal-display text-3xl sm:text-4xl text-white tracking-wide">Events</h1>
          <p className="text-sm text-slate-400">
            Cultural celebrations and sports tournaments — tap one for details.
          </p>
        </header>

        {active.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-slate-800 bg-slate-900/40">
            Nothing live or upcoming right now — check Completed below.
          </p>
        ) : (
          <EventCarousel events={active} />
        )}
      </div>

      {completed.length > 0 ? (
        <section className="rounded-2xl border border-slate-800 bg-slate-900/20 p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
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
      ) : null}
    </div>
  );
}

function HeroBanner({ event }: { event: CommunityEvent }) {
  const status = getEventStatus(event);
  return (
    <Link
      to={`/events/${event.id}`}
      className="group relative block w-full h-[52vh] min-h-72 max-h-[560px] rounded-3xl overflow-hidden border border-slate-800"
    >
      {event.imageSrc ? (
        <img
          src={event.imageSrc}
          alt=""
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          loading="eager"
        />
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.18),_transparent_65%)] bg-slate-900" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

      <div className="relative h-full flex flex-col justify-end p-6 sm:p-10 space-y-3 max-w-2xl">
        <span
          className={`w-fit text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
            status === 'ongoing'
              ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
          }`}
        >
          {STATUS_LABEL[status]}
        </span>
        <p className="text-sm font-mono text-amber-300/90">
          {event.month} · {event.dateLabel}
        </p>
        <h1 className="portal-display text-4xl sm:text-6xl text-white tracking-wide leading-none">
          {event.title}
        </h1>
        {event.description ? (
          <p className="text-sm sm:text-base text-slate-200/90 max-w-lg">{event.description}</p>
        ) : null}
        <span className="mt-2 inline-flex items-center gap-2 w-fit rounded-full bg-white text-slate-950 font-bold text-sm px-5 py-2.5 group-hover:bg-emerald-300 transition-colors">
          Explore event
          <ArrowRight className="size-4" aria-hidden />
        </span>
      </div>
    </Link>
  );
}

/**
 * Horizontal-scroll card row with a scroll-position progress bar — same
 * drag-and-scroll pattern as the Google Store's "Popular" product carousel.
 */
function EventCarousel({ events }: { events: CommunityEvent[] }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState({ thumbPct: 100, leftPct: 0 });

  const updateProgress = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const maxScroll = el.scrollWidth - el.clientWidth;
    if (maxScroll <= 4) {
      setProgress({ thumbPct: 100, leftPct: 0 });
      return;
    }
    const visibleFrac = Math.min(1, el.clientWidth / el.scrollWidth);
    const scrolledFrac = el.scrollLeft / maxScroll;
    const thumbPct = visibleFrac * 100;
    const leftPct = scrolledFrac * (100 - thumbPct);
    setProgress({ thumbPct, leftPct });
  };

  useEffect(() => {
    updateProgress();
    window.addEventListener('resize', updateProgress);
    return () => window.removeEventListener('resize', updateProgress);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events.length]);

  const showProgress = progress.thumbPct < 99.5;

  return (
    <div className="space-y-2.5">
      <div
        ref={scrollerRef}
        onScroll={updateProgress}
        className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-1 -mx-1 px-1 scroll-smooth"
      >
        {events.map((event) => (
          <EventTile key={event.id} event={event} />
        ))}
      </div>
      {showProgress ? (
        <div className="h-1 rounded-full bg-slate-800 overflow-hidden max-w-xs">
          <div
            className="h-full rounded-full bg-emerald-400 transition-[width,margin-left] duration-150 ease-out"
            style={{ width: `${progress.thumbPct}%`, marginLeft: `${progress.leftPct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function EventTile({ event }: { event: CommunityEvent }) {
  const status = getEventStatus(event);
  const images = [event.imageSrc, ...(event.galleryImages ?? [])].filter(
    (src): src is string => !!src
  );

  return (
    <Link
      to={`/events/${event.id}`}
      className="group shrink-0 w-64 sm:w-72 snap-start rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden flex flex-col transition-all duration-300 hover:border-emerald-500/50 hover:-translate-y-1 hover:shadow-xl hover:shadow-emerald-950/40"
    >
      {images.length > 1 ? (
        <div className="relative w-full h-32 overflow-hidden">
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
        </div>
      ) : images.length === 1 ? (
        <img
          src={images[0]}
          alt={event.title}
          className="w-full h-32 object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-32 bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.14),_transparent_60%)] flex items-center justify-center">
          <img
            src="/nature-walk-logo-1.png"
            alt=""
            className="h-12 w-12 rounded-lg object-cover ring-1 ring-emerald-500/30 bg-white"
            draggable={false}
          />
        </div>
      )}
      <div className="p-3.5 space-y-1 flex-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              status === 'ongoing'
                ? 'bg-rose-500/15 text-rose-300 border-rose-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
          >
            {STATUS_LABEL[status]}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-indigo-300/80">
            {event.category === 'sports' ? 'Sports' : 'Cultural'}
          </span>
        </div>
        <h2 className="font-semibold text-slate-100 truncate group-hover:text-emerald-300">
          {event.title}
        </h2>
        <p className="text-xs font-mono text-amber-300/90">
          {event.month} · {event.dateLabel}
        </p>
      </div>
    </Link>
  );
}

function CompletedTile({ event }: { event: CommunityEvent }) {
  return (
    <Link
      to={`/events/${event.id}`}
      className="group shrink-0 w-40 rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden flex flex-col opacity-70 hover:opacity-100 transition-opacity"
    >
      {event.imageSrc ? (
        <img src={event.imageSrc} alt={event.title} className="w-full h-20 object-cover grayscale-[40%]" loading="lazy" />
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
        <h3 className="text-xs font-semibold text-slate-300 truncate group-hover:text-emerald-300">
          {event.title}
        </h3>
        <p className="text-[10px] font-mono text-slate-500 truncate">{event.dateLabel}</p>
      </div>
    </Link>
  );
}
