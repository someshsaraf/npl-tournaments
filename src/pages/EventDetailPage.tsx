import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Camera } from 'lucide-react';
import { db } from '../firebase';
import { subscribeCommunityEvents } from '../utils/communityEvents';
import { getEventStatus, type CommunityEvent } from '../data/communityEvents';
import { Reveal } from '../components/Reveal';
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
    <div className="relative space-y-6">
      <div className="npl-blob -top-16 -right-24 size-80 bg-orange-500/20" aria-hidden />

      <BackLink />

      <Reveal className="relative z-10">
        <section className="relative rounded-3xl overflow-hidden border border-line shadow-xl min-h-[280px] sm:min-h-[340px]">
          {event.imageSrc ? (
            <img
              src={event.imageSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              style={{ objectPosition: event.imageFocus ?? 'center' }}
              loading="eager"
            />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(251,146,60,0.2),_transparent_65%)] bg-slate-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent" />

          <div className="relative h-full flex flex-col justify-end p-5 sm:p-8 space-y-2.5 max-w-2xl">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border backdrop-blur-sm ${
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
              <span className="text-[11px] uppercase tracking-wide text-amber-300/90 font-semibold">
                {event.category === 'sports' ? 'Sports' : 'Cultural'}
              </span>
            </div>
            <h1 className="text-white portal-display text-4xl sm:text-5xl tracking-wide leading-[0.95] [text-shadow:0_2px_24px_rgba(0,0,0,0.5)]">
              {event.title}
            </h1>
            <p className="text-sm font-mono text-amber-300/90">
              {event.month} · {event.dateLabel}
              {event.location ? ` · ${event.location}` : ''}
            </p>
            {event.description ? (
              <p className="text-sm text-slate-200/90 leading-relaxed max-w-lg">{event.description}</p>
            ) : null}
            <div className="pt-1">
              <Link
                to={`/photos?event=${event.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white text-slate-950 font-bold text-xs uppercase tracking-wide px-4 py-2.5 shadow-lg shadow-black/30 transition-all hover:gap-2.5 hover:shadow-orange-500/30"
              >
                <Camera className="size-3.5" aria-hidden />
                View Photos
              </Link>
            </div>
          </div>
        </section>
      </Reveal>

      {Array.isArray(event.posts) && event.posts.length > 0 ? (
        <Reveal delayMs={80} className="relative z-10 space-y-3">
          <div className="flex items-center gap-2.5">
            <span className="h-4 w-1 rounded-full bg-ink" aria-hidden />
            <h2 className="text-sm font-bold uppercase tracking-wider text-ink">Updates</h2>
          </div>
          <ul className="space-y-3">
            {event.posts.map((post) => (
              <li
                key={post.id}
                className="rounded-2xl border border-line bg-white overflow-hidden transition-colors hover:border-slate-300"
              >
                {post.imageUrl ? (
                  <img
                    src={post.imageUrl}
                    alt=""
                    className="w-full max-h-96 object-contain bg-paper-soft"
                    loading="lazy"
                  />
                ) : null}
                <div className="p-3.5 space-y-1">
                  {post.text ? (
                    <p className="text-sm text-ink-soft whitespace-pre-line leading-relaxed">
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
        </Reveal>
      ) : null}

      {tabs.length > 0 && (
        <Reveal delayMs={120} className="relative z-10">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`text-xs px-3.5 py-1.5 rounded-lg whitespace-nowrap font-bold uppercase tracking-wide transition-all ${
                  tab === t.key
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-paper-soft text-ink-soft hover:text-ink border border-line'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            {tab === 'schedule' && event.sport ? <ScheduleView sport={event.sport} /> : null}
            {tab === 'results' && event.sport ? <ResultsView sport={event.sport} /> : null}
            {tab === 'stats' && event.sport ? <StatsView sport={event.sport} /> : null}
            {tab === 'teams' && event.sport === 'badminton' ? <TeamsView /> : null}
            {tab === 'live' && event.sport ? <LiveView sport={event.sport} /> : null}
            {tab === 'recordings' ? <RecordingsView /> : null}
            {tab === 'rules' && event.sport ? <RulesView sport={event.sport} /> : null}
          </div>
        </Reveal>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/"
      className="group inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-emerald-700 hover:text-emerald-800"
    >
      <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" aria-hidden />
      Back to Home
    </Link>
  );
}
