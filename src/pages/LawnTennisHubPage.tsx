import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Camera, Monitor } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { HubTabs, SportHero } from '../components/SportHero';
import { LiveView } from '../components/tournament/LiveView';
import { RecordingsView } from '../components/tournament/RecordingsView';
import {
  TennisBracketView,
  TennisPoolsView,
  TennisRulesView,
  TennisScheduleView
} from '../components/lawnTennis/TennisViews';
import { usePublishedTennisTournament } from '../components/lawnTennis/useTennisTournament';
import { sportCardBySport } from '../data/sports';
import { isMatchOnCourt } from '../hooks/useSportLiveMatch';
import { formatFixtureDate } from '../utils/tennisTournament';

type TabKey = 'schedule' | 'live' | 'pools' | 'knockouts' | 'recordings' | 'rules';

/**
 * Lawn Tennis hub (/lawn-tennis): the published schedule (upcoming, live and
 * completed), pool tables, knockout bracket, live stream with score,
 * recordings and rules. Nothing shows until an admin publishes.
 */
export default function LawnTennisHubPage() {
  const card = sportCardBySport('tennis');
  const { loaded, tournament, ctx, live } = usePublishedTennisTournament();
  const onCourt = isMatchOnCourt(live);
  const [tab, setTab] = useState<TabKey>('schedule');

  const dateRange = useMemo(() => {
    const dates = (tournament?.fixtures ?? []).map((f) => f.date).filter(Boolean).sort();
    if (dates.length === 0) return '';
    const first = formatFixtureDate(dates[0]);
    const last = formatFixtureDate(dates[dates.length - 1]);
    return first === last ? first : `${first} – ${last}`;
  }, [tournament]);

  const published = !!tournament && !!ctx;
  const tabs: ReadonlyArray<{ key: TabKey; label: string; badge?: string }> = published
    ? [
        { key: 'schedule', label: 'Schedule' },
        { key: 'live', label: 'Live', ...(onCourt ? { badge: '●' } : {}) },
        { key: 'pools', label: 'Pools' },
        { key: 'knockouts', label: 'Knockouts' },
        { key: 'recordings', label: 'Recordings' },
        { key: 'rules', label: 'Rules' }
      ]
    : [
        { key: 'schedule', label: 'Schedule' },
        { key: 'live', label: 'Live', ...(onCourt ? { badge: '●' } : {}) },
        { key: 'recordings', label: 'Recordings' }
      ];

  const meta = [dateRange, tournament?.venue].filter(Boolean).join(' · ');

  return (
    <div className="relative space-y-6">
      <Reveal className="relative z-10">
        <SportHero
          card={card}
          eyebrow={tournament ? `Season ${tournament.year}` : 'Lawn Tennis'}
          title={tournament?.title ?? card.label}
          meta={meta || undefined}
          live={onCourt}
          actions={
            <>
              <Link
                to="/photos?sport=lawn-tennis"
                className="inline-flex items-center gap-1.5 rounded-full bg-white text-slate-950 font-bold text-xs uppercase tracking-wide px-4 py-2.5 shadow-lg"
              >
                <Camera className="size-3.5" aria-hidden />
                Photos
              </Link>
              <Link
                to="/score/lawn-tennis"
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 text-white border border-white/30 font-bold text-xs uppercase tracking-wide px-4 py-2.5 backdrop-blur-sm hover:bg-white/20"
              >
                <Monitor className="size-3.5" aria-hidden />
                Court scoreboard
              </Link>
            </>
          }
        />
      </Reveal>

      <Reveal delayMs={80} className="relative z-10">
        <PhotoStrip images={card.galleryImages} />
      </Reveal>

      <Reveal delayMs={120} className="relative z-10 space-y-4">
        <HubTabs tabs={tabs} active={tab} onChange={setTab} />
        <div>
          {tab === 'schedule' ? (
            ctx ? (
              <TennisScheduleView ctx={ctx} live={live} />
            ) : (
              <ComingSoon loaded={loaded} />
            )
          ) : null}
          {tab === 'live' ? <LiveView sport="tennis" /> : null}
          {tab === 'pools' && ctx ? <TennisPoolsView ctx={ctx} live={live} /> : null}
          {tab === 'knockouts' && ctx ? <TennisBracketView ctx={ctx} live={live} /> : null}
          {tab === 'recordings' ? <RecordingsView sport="tennis" /> : null}
          {tab === 'rules' && ctx ? <TennisRulesView ctx={ctx} /> : null}
        </div>
      </Reveal>
    </div>
  );
}

function PhotoStrip({ images }: { images: string[] }) {
  if (images.length === 0) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-ink">2025 on court</h2>
        <Link to="/photos?sport=lawn-tennis" className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 hover:text-emerald-800">
          All photos →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 snap-x">
        {images.map((src) => (
          <img
            key={src}
            src={src}
            alt=""
            loading="lazy"
            className="h-40 sm:h-48 w-auto aspect-[4/3] object-cover rounded-2xl border border-line shadow-sm snap-start"
          />
        ))}
      </div>
    </section>
  );
}

function ComingSoon({ loaded }: { loaded: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-paper-soft px-6 py-12 text-center space-y-2">
      <CalendarClock className="size-8 mx-auto text-emerald-600" aria-hidden />
      <p className="portal-display text-3xl text-ink tracking-wide">
        {loaded ? 'Draw coming soon' : 'Loading…'}
      </p>
      {loaded ? (
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Pools and the match schedule will appear here as soon as the organisers publish them.
        </p>
      ) : null}
    </div>
  );
}
