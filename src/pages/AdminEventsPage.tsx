import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { db } from '../firebase';
import type { CommunityEvent } from '../data/communityEvents';
import { DEFAULT_COMMUNITY_EVENTS, getEventStatus } from '../data/communityEvents';
import { buildBlankCommunityEvent, saveCommunityEvents, subscribeCommunityEvents } from '../utils/communityEvents';
import { AdminNav } from '../components/AdminNav';

const STATUS_BADGE: Record<string, string> = {
  ongoing: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
  upcoming: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  past: 'bg-slate-800 text-slate-500 border-slate-700',
  undated: 'bg-amber-500/15 text-amber-300 border-amber-500/40'
};

/**
 * Events list — each event has its own configuration page
 * (/admin/events/:id) with field editing, tournament admin links for sports
 * events, and the Updates feed for posting images/text.
 */
export default function AdminEventsPage() {
  const [events, setEvents] = useState<CommunityEvent[]>(DEFAULT_COMMUNITY_EVENTS);

  useEffect(() => {
    const unsub = subscribeCommunityEvents(db, setEvents);
    return () => unsub();
  }, []);

  const handleAddEvent = () => {
    const nextSortOrder = events.reduce((max, e) => Math.max(max, e.sortOrder ?? 0), 0) + 1;
    const next = [...events, buildBlankCommunityEvent(nextSortOrder)];
    setEvents(next);
    saveCommunityEvents(db, next).catch((err) => console.error('Failed to add event:', err));
  };

  const sorted = [...events].sort((a, b) => {
    if (a.startDate && b.startDate) return a.startDate.localeCompare(b.startDate);
    if (a.startDate) return -1;
    if (b.startDate) return 1;
    return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-8 max-w-4xl mx-auto">
      <AdminNav subtitle="Events" />

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-slate-800 pb-3">
          <div>
            <h1 className="text-lg font-bold text-indigo-300">Community Events</h1>
            <p className="text-xs text-slate-400 mt-1">
              Open an event to edit its details, manage its tournament tools (Badminton &amp;
              Tennis), or post updates.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddEvent}
            className="shrink-0 bg-violet-500 hover:bg-violet-400 text-slate-950 font-bold text-sm px-4 py-2 rounded-lg transition-colors shadow"
          >
            + Add Event
          </button>
        </div>

        <ul className="space-y-2">
          {sorted.map((event) => {
            const status = getEventStatus(event);
            const postCount = Array.isArray(event.posts) ? event.posts.length : 0;
            return (
              <li key={event.id}>
                <Link
                  to={`/admin/events/${event.id}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/40 hover:bg-slate-800/70 hover:border-indigo-500/50 transition-colors p-3"
                >
                  {event.imageSrc ? (
                    <img
                      src={event.imageSrc}
                      alt=""
                      className="w-14 h-14 object-cover rounded-lg shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-lg bg-slate-800 shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${STATUS_BADGE[status]}`}
                      >
                        {status}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-indigo-300/80">
                        {event.category === 'sports' ? `Sports${event.sport ? ` · ${event.sport}` : ''}` : 'Cultural'}
                      </span>
                      {postCount > 0 && (
                        <span className="text-[10px] uppercase tracking-wide text-amber-300/80">
                          {postCount} update{postCount === 1 ? '' : 's'}
                        </span>
                      )}
                    </div>
                    <p className="font-semibold text-slate-100 truncate">{event.title}</p>
                    <p className="text-xs font-mono text-slate-500">
                      {event.month} · {event.dateLabel}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-emerald-400">
                    Configure →
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
