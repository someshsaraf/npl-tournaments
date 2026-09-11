import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import { HomeEventAdBanner, useHomeEventAds } from '../components/HomeEventAdBanner';
import { getEventStatus, type CommunityEvent, type EventStatus } from '../data/communityEvents';
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

  return (
    <div className="space-y-8">
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {active.map((event) => (
              <EventTile key={event.id} event={event} />
            ))}
          </div>
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

function EventTile({ event }: { event: CommunityEvent }) {
  const status = getEventStatus(event);
  return (
    <Link
      to={`/events/${event.id}`}
      className="group rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden flex flex-col transition-colors hover:border-emerald-500/50"
    >
      {event.imageSrc ? (
        <img
          src={event.imageSrc}
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
