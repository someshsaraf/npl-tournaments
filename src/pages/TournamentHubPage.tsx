import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, Camera, Monitor } from 'lucide-react';
import { Reveal } from '../components/Reveal';
import { HubTabs, SportHero } from '../components/SportHero';
import { LiveView } from '../components/tournament/LiveView';
import { RecordingsView } from '../components/tournament/RecordingsView';
import {
  TournamentBracketView,
  TournamentPoolsView,
  TournamentRulesView,
  TournamentScheduleView
} from '../components/tournamentViews/TournamentViews';
import { usePublishedTournament } from '../components/tournamentViews/useTournament';
import type { ReactNode } from 'react';
import type { Sport } from '../data/tournamentData';
import { sportCardBySport, sportSlug } from '../data/sports';
import { REGISTRATIONS } from '../data/registration';
import { RegisterButton, RegistrationBanner } from '../components/RegistrationBanner';
import { isMatchOnCourt } from '../hooks/useSportLiveMatch';
import { formatFixtureDate } from '../utils/tournament';

type TabKey = 'schedule' | 'live' | 'pools' | 'knockouts' | 'recordings' | 'rules' | string;

/** Extra sport-specific tabs (e.g. Badminton's Results and Stats). */
export interface ExtraTab {
  key: string;
  label: string;
  render: () => ReactNode;
}

/**
 * A sport's hub (/lawn-tennis, and /badminton once its tournament is
 * published): the published schedule (upcoming, live and completed), pool
 * tables, knockout bracket, live stream with score, recordings and rules.
 * Nothing tournament-specific shows until an admin publishes.
 */
export default function TournamentHubPage({ sport, extraTabs = [] }: { sport: Sport; extraTabs?: ExtraTab[] }) {
  const card = sportCardBySport(sport);
  const slug = sportSlug(sport);
  const { loaded, tournament, ctx, live } = usePublishedTournament(sport);
  const registration = REGISTRATIONS[sport];
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
        ...extraTabs.map((t) => ({ key: t.key, label: t.label })),
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
          eyebrow={tournament ? `Season ${tournament.year}` : card.label}
          title={tournament?.title ?? card.label}
          meta={meta || registration?.shortDates || undefined}
          live={onCourt}
          actions={
            <>
              {registration ? <RegisterButton config={registration} slug={slug} /> : null}
              <Link
                to={`/photos?sport=${slug}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white text-slate-950 font-bold text-xs uppercase tracking-wide px-4 py-2.5 shadow-lg"
              >
                <Camera className="size-3.5" aria-hidden />
                Photos
              </Link>
              <Link
                to={`/score/${slug}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 text-white border border-white/30 font-bold text-xs uppercase tracking-wide px-4 py-2.5 backdrop-blur-sm hover:bg-white/20"
              >
                <Monitor className="size-3.5" aria-hidden />
                Court scoreboard
              </Link>
            </>
          }
        />
      </Reveal>

      {registration ? (
        <Reveal delayMs={60} className="relative z-10">
          <RegistrationBanner config={registration} slug={slug} />
        </Reveal>
      ) : null}

      <Reveal delayMs={80} className="relative z-10">
        <PhotoStrip images={card.galleryImages} slug={slug} />
      </Reveal>

      <Reveal delayMs={120} className="relative z-10 space-y-4">
        <HubTabs tabs={tabs} active={tab} onChange={setTab} />
        <div>
          {tab === 'schedule' ? (
            ctx ? (
              <TournamentScheduleView ctx={ctx} live={live} />
            ) : (
              <ComingSoon loaded={loaded} />
            )
          ) : null}
          {tab === 'live' ? <LiveView sport={sport} /> : null}
          {tab === 'pools' && ctx ? <TournamentPoolsView ctx={ctx} live={live} /> : null}
          {tab === 'knockouts' && ctx ? <TournamentBracketView ctx={ctx} live={live} /> : null}
          {tab === 'recordings' ? <RecordingsView sport={sport} /> : null}
          {extraTabs.find((t) => t.key === tab)?.render() ?? null}
          {tab === 'rules' && ctx ? <TournamentRulesView ctx={ctx} /> : null}
        </div>
      </Reveal>
    </div>
  );
}

function PhotoStrip({ images, slug }: { images: string[]; slug: string }) {
  if (images.length === 0) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-black uppercase tracking-[0.14em] text-ink">On court</h2>
        <Link to={`/photos?sport=${slug}`} className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 hover:text-emerald-800">
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
