import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Camera } from 'lucide-react';
import { db } from '../firebase';
import { subscribeCommunityEvents } from '../utils/communityEvents';
import { getEventStatus, type CommunityEvent } from '../data/communityEvents';
import { ScheduleView } from '../components/tournament/ScheduleView';
import { ResultsView } from '../components/tournament/ResultsView';
import { StatsView } from '../components/tournament/StatsView';
import { TeamsView } from '../components/tournament/TeamsView';
import { RulesView } from '../components/tournament/RulesView';
import { RecordingsView } from '../components/tournament/RecordingsView';
import { LiveView } from '../components/tournament/LiveView';

const STATUS_LABEL: Record<string, string> = {
  ongoing: 'Happening now',
  upcoming: 'Coming up',
  past: 'Wrapped up',
  undated: 'Date TBD'
};

type TabKey = 'schedule' | 'results' | 'stats' | 'teams' | 'live' | 'recordings' | 'rules';

/**
 * One event's own page — reached by clicking its tile on Home. Sports events
 * (with a linked in-app tournament) get extra tabs for Schedule/Results/Stats/
 * Teams/Live/Recordings/Rules, scoped to that one sport. Cultural events just
 * show their details.
 */
export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [events, setEvents] = useState<CommunityEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState<TabKey | null>(null);

  useEffect(() => {
    const unsub = subscribeCommunityEvents(db, (list) => {
      setEvents(list);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const event = events.find((e) => e.id === id) ?? null;
  const isSportsTournament = event?.category === 'sports' && !!event.sport;

  const initializedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!event || initializedForRef.current === event.id) return;
    initializedForRef.current = event.id;
    setTab(event.category === 'sports' && event.sport ? 'schedule' : null);
  }, [event]);

  if (loaded && !event) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-slate-400">Event not found.</p>
        <BackLink />
      </div>
    );
  }

  if (!event) {
    return <BackLink />;
  }

  const status = getEventStatus(event);

  const tabs: Array<{ key: TabKey; label: string }> = [];
  if (isSportsTournament) {
    tabs.push({ key: 'schedule', label: 'Schedule' });
    tabs.push({ key: 'results', label: 'Results' });
    tabs.push({ key: 'stats', label: 'Stats' });
    if (event.sport === 'badminton') tabs.push({ key: 'teams', label: 'Teams' });
    tabs.push({ key: 'live', label: 'Live' });
    tabs.push({ key: 'recordings', label: 'Recordings' });
    tabs.push({ key: 'rules', label: 'Rules' });
  }

  return (
    <div className="space-y-5">
      <BackLink />

      <section className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr]">
          {event.imageSrc ? (
            <img
              src={event.imageSrc}
              alt={event.title}
              className="w-full h-48 md:h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="hidden md:flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.14),_transparent_60%)]">
              <img
                src="/nature-walk-logo-1.png"
                alt=""
                className="h-20 w-20 rounded-xl object-cover ring-1 ring-emerald-500/30 bg-white"
                draggable={false}
              />
            </div>
          )}
          <div className="p-5 sm:p-6 space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                  status === 'ongoing'
                    ? 'bg-rose-500/15 text-rose-300 border-rose-500/40 animate-pulse'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                }`}
              >
                {STATUS_LABEL[status]}
              </span>
              <span className="text-[11px] uppercase tracking-wide text-indigo-300/90 font-semibold">
                {event.category === 'sports' ? 'Sports' : 'Cultural'}
              </span>
            </div>
            <h1 className="portal-display text-3xl sm:text-4xl text-white tracking-wide">
              {event.title}
            </h1>
            <p className="text-sm font-mono text-amber-300/90">
              {event.month} · {event.dateLabel}
              {event.location ? ` · ${event.location}` : ''}
            </p>
            {event.description ? (
              <p className="text-sm text-slate-300 leading-relaxed">{event.description}</p>
            ) : null}
            <div className="pt-1">
              <Link
                to={`/photos?event=${event.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 font-bold text-xs uppercase tracking-wide px-3.5 py-2 hover:bg-slate-700"
              >
                <Camera className="size-3.5" aria-hidden />
                View Photos
              </Link>
            </div>
          </div>
        </div>
      </section>

      {Array.isArray(event.posts) && event.posts.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">Updates</h2>
          <ul className="space-y-3">
            {event.posts.map((post) => (
              <li
                key={post.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/40 overflow-hidden"
              >
                {post.imageUrl ? (
                  <img
                    src={post.imageUrl}
                    alt=""
                    className="w-full max-h-96 object-contain bg-slate-950"
                    loading="lazy"
                  />
                ) : null}
                <div className="p-3.5 space-y-1">
                  {post.text ? (
                    <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                      {post.text}
                    </p>
                  ) : null}
                  <p className="text-[11px] text-slate-500 font-mono">
                    {new Date(post.createdAt).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {tabs.length > 0 && (
        <>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`text-xs px-3.5 py-1.5 rounded-lg whitespace-nowrap font-bold uppercase tracking-wide transition-colors ${
                  tab === t.key
                    ? 'bg-indigo-500 text-white shadow-md'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700/80'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div>
            {tab === 'schedule' && event.sport ? <ScheduleView sport={event.sport} /> : null}
            {tab === 'results' && event.sport ? <ResultsView sport={event.sport} /> : null}
            {tab === 'stats' && event.sport ? <StatsView sport={event.sport} /> : null}
            {tab === 'teams' && event.sport === 'badminton' ? <TeamsView /> : null}
            {tab === 'live' && event.sport ? <LiveView sport={event.sport} /> : null}
            {tab === 'recordings' ? <RecordingsView /> : null}
            {tab === 'rules' && event.sport ? <RulesView sport={event.sport} /> : null}
          </div>
        </>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-400 hover:text-emerald-300"
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      Back to Home
    </Link>
  );
}
