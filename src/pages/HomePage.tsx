import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { db } from '../firebase';
import { HomeEventAdBanner, useHomeEventAds } from '../components/HomeEventAdBanner';
import { Reveal } from '../components/Reveal';
import {
  getEventStatus,
  type CommunityEvent,
  type CommunityEventCategory,
  type EventStatus
} from '../data/communityEvents';
import { getLatestUpdates, subscribeCommunityEvents, type LatestUpdate } from '../utils/communityEvents';

const STATUS_ORDER: Record<EventStatus, number> = {
  ongoing: 0,
  upcoming: 1,
  undated: 2,
  past: 3
};

const CATEGORY_TABS: ReadonlyArray<{ key: 'all' | CommunityEventCategory; label: string }> = [
  { key: 'all', label: 'All events' },
  { key: 'cultural', label: 'Cultural' },
  { key: 'sports', label: 'Sports' }
];

const CATEGORY_LABEL: Record<CommunityEventCategory, string> = {
  cultural: 'Cultural Celebrations',
  sports: 'Sports Tournaments'
};

/**
 * Home = a shared calendar: a hero highlighting a handful of upcoming
 * events, a filterable grid of everything live/upcoming, a sidebar of
 * at-a-glance widgets, and a completed-events archive strip.
 */
export default function HomePage() {
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [searchParams] = useSearchParams();
  const [categoryFilter, setCategoryFilter] = useState<'all' | CommunityEventCategory>(() => {
    const q = searchParams.get('category');
    return q === 'cultural' || q === 'sports' ? q : 'all';
  });
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

  const filteredActive = useMemo(
    () => active.filter((e) => categoryFilter === 'all' || e.category === categoryFilter),
    [active, categoryFilter]
  );
  const filteredCompleted = useMemo(
    () => completed.filter((e) => categoryFilter === 'all' || e.category === categoryFilter),
    [completed, categoryFilter]
  );

  const heroPicks = useMemo(() => active.slice(0, 4), [active]);
  const latestUpdates = useMemo(() => getLatestUpdates(events, 4), [events]);
  const categoryCounts = useMemo(
    () => ({
      cultural: active.filter((e) => e.category === 'cultural').length,
      sports: active.filter((e) => e.category === 'sports').length
    }),
    [active]
  );

  return (
    <div className="relative space-y-12">
      <Reveal className="relative z-10">
        <section className="grid lg:grid-cols-[1.1fr_1fr] gap-8 lg:items-center">
          <div className="space-y-5">
            <p className="text-[11px] uppercase tracking-[0.18em] text-ink-soft font-semibold">
              Resident Community Platform
            </p>
            <h1 className="portal-display text-4xl sm:text-5xl text-ink leading-[1.05] tracking-wide">
              A shared calendar for culture, courts, and community.
            </h1>
            <p className="text-sm sm:text-base text-ink-soft max-w-lg">
              Discover cultural celebrations, badminton, tennis, and community gatherings in one
              calm, easy-to-follow experience. Browse upcoming highlights, explore by category,
              and jump into event details with clarity.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="#all-events"
                className="inline-flex items-center rounded-full bg-ink text-white font-bold text-sm px-5 py-2.5 hover:bg-slate-800 transition-colors"
              >
                View All Events
              </a>
              <Link
                to="/photos"
                className="inline-flex items-center rounded-full border border-line text-ink font-bold text-sm px-5 py-2.5 hover:bg-paper-soft transition-colors"
              >
                Explore Photos
              </Link>
            </div>
          </div>
          {heroPicks.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {heroPicks.map((event) => (
                <HeroPickTile key={event.id} event={event} />
              ))}
            </div>
          ) : null}
        </section>
      </Reveal>

      {homeAds.length > 0 ? <HomeEventAdBanner ads={homeAds} /> : null}

      <div id="all-events" className="grid lg:grid-cols-[1fr_320px] gap-8 items-start">
        <Reveal delayMs={80} className="space-y-4 min-w-0">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1.5">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink-soft font-semibold">
                Featured Events
              </p>
              <h2 className="portal-display text-3xl sm:text-4xl text-ink tracking-wide">
                Upcoming highlights
              </h2>
              <p className="text-sm text-slate-500 max-w-md">
                A balanced selection of cultural celebrations and sports tournaments, presented in
                a calm, easy-to-scan format.
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="rounded-full border border-line bg-paper-soft text-ink-soft text-[11px] font-bold uppercase tracking-wide px-3 py-1.5">
                {filteredActive.length} upcoming {filteredActive.length === 1 ? 'event' : 'events'}
              </span>
              <div className="inline-flex items-center gap-1 rounded-full border border-line bg-white p-1">
                {CATEGORY_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setCategoryFilter(tab.key)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                      categoryFilter === tab.key
                        ? 'bg-ink text-white'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </header>

          {filteredActive.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-line bg-paper-soft">
              Nothing live or upcoming right now - check Completed below.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
              {filteredActive.map((event) => (
                <EventTile key={event.id} event={event} />
              ))}
            </div>
          )}
        </Reveal>

        <Reveal delayMs={120} className="space-y-5 lg:sticky lg:top-24">
          <CategoriesWidget counts={categoryCounts} onSelect={setCategoryFilter} />
          <HighlightsWidget events={filteredActive.slice(0, 4)} />
          <UpdatesWidget updates={latestUpdates} />
        </Reveal>
      </div>

      {filteredCompleted.length > 0 ? (
        <Reveal delayMs={160} className="relative z-10">
          <section className="npl-glass rounded-2xl p-4 sm:p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                Completed
              </h2>
              <span className="text-[11px] text-slate-400">{filteredCompleted.length} wrapped up</span>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
              {filteredCompleted.map((event) => (
                <CompletedTile key={event.id} event={event} />
              ))}
            </div>
          </section>
        </Reveal>
      ) : null}
    </div>
  );
}

function HeroPickTile({ event }: { event: CommunityEvent }) {
  const isCultural = event.category !== 'sports';
  return (
    <Link
      to={`/events/${event.id}`}
      className="group relative overflow-hidden rounded-2xl border border-line aspect-[4/3]"
    >
      {event.imageSrc ? (
        <img
          src={event.imageSrc}
          alt={event.title}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          style={{ objectPosition: event.imageFocus ?? 'center' }}
          loading="lazy"
        />
      ) : (
        <div className="absolute inset-0 bg-paper-soft" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/5 to-transparent" />
      <span className="absolute left-2.5 top-2.5 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-full bg-white/95 text-ink">
        {isCultural ? 'Culture' : 'Sports'}
      </span>
      <span className="absolute right-2.5 top-2.5 inline-flex items-center justify-center size-6 rounded-full bg-white/25 text-white backdrop-blur-sm transition-colors group-hover:bg-white/40">
        <ArrowUpRight className="size-3.5" aria-hidden />
      </span>
      <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
        <p className="text-sm font-bold truncate">{event.title}</p>
        <p className="text-[10px] font-mono text-white/80 truncate">{event.dateLabel}</p>
      </div>
    </Link>
  );
}

function EventTile({ event }: { event: CommunityEvent }) {
  const status = getEventStatus(event);
  const isCultural = event.category !== 'sports';
  const images = [event.imageSrc, ...(event.galleryImages ?? [])].filter(
    (src): src is string => !!src
  );

  return (
    <Link
      to={`/events/${event.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-paper-soft">
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
                style={{
                  width: `${100 / images.length}%`,
                  objectPosition: i === 0 ? (event.imageFocus ?? 'center') : 'center'
                }}
                loading="lazy"
              />
            ))}
          </div>
        ) : images.length === 1 ? (
          <img
            src={images[0]}
            alt={event.title}
            className="h-full w-full object-cover"
            style={{ objectPosition: event.imageFocus ?? 'center' }}
            loading="lazy"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center">
            <img
              src="/nature-walk-logo-1.png"
              alt=""
              className="h-10 w-10 rounded-lg object-cover ring-1 ring-line bg-white"
              draggable={false}
            />
          </div>
        )}
      </div>

      <div className="p-4 sm:p-5 flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full ${
                isCultural ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'
              }`}
            >
              {isCultural ? 'Culture' : 'Sports'}
            </span>
            {status === 'ongoing' ? (
              <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-600">
                <span className="npl-glow-pulse size-1.5 rounded-full bg-rose-500" aria-hidden />
                Live
              </span>
            ) : null}
          </div>
          <span className="text-[11px] font-mono font-bold text-slate-500 shrink-0">
            {event.dateLabel}
          </span>
        </div>

        <h2 className="portal-display text-xl sm:text-2xl text-ink tracking-wide leading-none">
          {event.title}
        </h2>

        {event.description ? (
          <p className="text-xs sm:text-sm text-slate-500 line-clamp-2">{event.description}</p>
        ) : null}

        <div className="flex items-center justify-between gap-2 pt-2 mt-auto">
          <span className="text-xs font-bold text-ink-soft truncate">{event.location ?? ''}</span>
          <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-ink text-white text-xs font-bold px-3.5 py-1.5 group-hover:bg-slate-800 transition-colors">
            View Event
            <ArrowRight className="size-3.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}

function CategoriesWidget({
  counts,
  onSelect
}: {
  counts: Record<CommunityEventCategory, number>;
  onSelect: (key: 'all' | CommunityEventCategory) => void;
}) {
  return (
    <div className="npl-glass rounded-2xl p-5 space-y-3">
      <h3 className="text-sm font-bold text-ink">Event Categories</h3>
      <ul className="space-y-1">
        {(Object.keys(CATEGORY_LABEL) as CommunityEventCategory[]).map((key) => (
          <li key={key}>
            <button
              type="button"
              onClick={() => onSelect(key)}
              className="w-full flex items-center justify-between gap-2 text-sm py-1.5 text-left hover:text-ink text-ink-soft transition-colors"
            >
              <span>{CATEGORY_LABEL[key]}</span>
              <span className="font-bold text-ink">{counts[key]}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HighlightsWidget({ events }: { events: CommunityEvent[] }) {
  if (events.length === 0) return null;
  return (
    <div className="npl-glass rounded-2xl p-5 space-y-3">
      <h3 className="text-sm font-bold text-ink">Upcoming Highlights</h3>
      <ul className="space-y-2.5">
        {events.map((event) => (
          <li key={event.id}>
            <Link
              to={`/events/${event.id}`}
              className="group flex items-center justify-between gap-3 text-sm"
            >
              <span className="text-ink-soft group-hover:text-ink truncate">{event.title}</span>
              <span className="text-[11px] font-mono font-bold text-slate-400 shrink-0">
                {event.dateLabel}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function UpdatesWidget({ updates }: { updates: LatestUpdate[] }) {
  if (updates.length === 0) return null;
  return (
    <div className="npl-glass rounded-2xl p-5 space-y-3">
      <h3 className="text-sm font-bold text-ink">Latest Updates</h3>
      <ul className="space-y-3">
        {updates.map(({ event, post }) => (
          <li key={post.id}>
            <Link to={`/events/${event.id}`} className="group block">
              <p className="text-sm text-ink-soft group-hover:text-ink line-clamp-2">
                {post.text ? post.text : `New photo posted for ${event.title}.`}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {event.title} ·{' '}
                {new Date(post.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric'
                })}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CompletedTile({ event }: { event: CommunityEvent }) {
  const images = [event.imageSrc, ...(event.galleryImages ?? [])].filter(
    (src): src is string => !!src
  );

  return (
    <Link
      to={`/events/${event.id}`}
      className="group shrink-0 w-40 rounded-xl border border-line bg-white overflow-hidden flex flex-col opacity-80 hover:opacity-100 transition-opacity"
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
        <div className="w-full h-20 bg-paper-soft flex items-center justify-center">
          <img
            src="/nature-walk-logo-1.png"
            alt=""
            className="h-8 w-8 rounded object-cover opacity-70"
            draggable={false}
          />
        </div>
      )}
      <div className="p-2.5 space-y-0.5">
        <h3 className="text-xs font-semibold text-slate-600 truncate group-hover:text-ink">
          {event.title}
        </h3>
        <p className="text-[10px] font-mono text-slate-400 truncate">{event.dateLabel}</p>
      </div>
    </Link>
  );
}
