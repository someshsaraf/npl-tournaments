import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { ChevronRight } from 'lucide-react';
import { db, YOUTUBE_LIVE_URL_PATH } from '../firebase';
import {
  FIXTURES,
  INITIAL_MATCH,
  type Fixture,
  type MatchState
} from '../data/tournamentData';
import {
  completedMatchesFromFirebase,
  mergeFixturesWithResults
} from '../utils/completedMatches';
import {
  formatGamesWonLabel,
  hasSeriesWinner,
  normalizeMatchState
} from '../utils/matchState';
import { toYouTubeEmbedUrl } from '../utils/youtube';
import { SeriesScoreStrip } from '../components/SeriesScoreStrip';
import { QuickNav } from '../components/ui/QuickNav';
import { StatusBadge } from '../components/ui/StatusBadge';
import { SectionHeading } from '../components/ui/SectionHeading';
import { MatchCard } from '../components/ui/MatchCard';
import heroImage from '../assets/hero.png';

/**
 * Goalkick-inspired home: hero matchup, live stream, upcoming fixtures.
 */
export default function HomePage() {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [fixtures, setFixtures] = useState<Fixture[]>(() =>
    mergeFixturesWithResults(FIXTURES, {})
  );

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubMatch = onValue(matchRef, (snap) => {
      const raw = snap.val();
      setMatch(normalizeMatchState(raw && typeof raw === 'object' ? raw : INITIAL_MATCH));
    });

    const completedRef = ref(db, 'completedMatches');
    const unsubCompleted = onValue(completedRef, (snap) => {
      const byId = completedMatchesFromFirebase(snap.val());
      setFixtures(mergeFixturesWithResults(FIXTURES, byId));
    });

    const youtubeRef = ref(db, YOUTUBE_LIVE_URL_PATH);
    const unsubYoutube = onValue(youtubeRef, (snap) => {
      const val = snap.val();
      setYoutubeUrl(typeof val === 'string' ? val : '');
    });

    return () => {
      unsubMatch();
      unsubCompleted();
      unsubYoutube();
    };
  }, []);

  const embedUrl = toYouTubeEmbedUrl(youtubeUrl || match.youtubeLiveUrl || '');
  const seriesOver = hasSeriesWinner(match);
  const name1 = match.player1 || match.teamA || 'Side A';
  const name2 = match.player2 || match.teamB || 'Side B';
  const upcoming = fixtures.filter((f) => f.status !== 'completed').slice(0, 4);
  const latest = fixtures.filter((f) => f.status === 'completed').slice(-3).reverse();
  const hasScore = (match.score1 ?? 0) > 0 || (match.score2 ?? 0) > 0;
  const liveStatus = seriesOver ? 'completed' : hasScore ? 'live' : 'on-court';

  return (
    <div>
      {/* Hero — Goalkick league-home style matchup */}
      <section className="relative min-h-[min(75vh,40rem)] overflow-hidden">
        <img
          src={heroImage}
          alt=""
          className="npl-hero-media absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[var(--gk-bg)] via-[color-mix(in_srgb,var(--gk-bg)_85%,transparent)] to-[color-mix(in_srgb,var(--gk-bg)_60%,transparent)]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--gk-bg)] via-transparent to-transparent" />

        <div className="npl-hero-copy relative z-10 mx-auto flex min-h-[inherit] w-full max-w-7xl flex-col justify-center px-4 sm:px-6 py-16 sm:py-20">
          <p className="portal-section-label mb-4">2026 Tournament</p>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] items-center gap-6 lg:gap-10 max-w-4xl">
            <div className="text-center lg:text-right">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gk-muted)] mb-2">
                {match.category || 'On Court'}
              </p>
              <p className="portal-display text-3xl sm:text-4xl lg:text-5xl text-[var(--gk-ink)] leading-tight">
                {name1}
              </p>
            </div>

            <div className="flex flex-col items-center gap-2">
              <StatusBadge
                status={liveStatus}
                pulse={liveStatus === 'live' || liveStatus === 'on-court'}
              />
              <div className="gk-score text-5xl sm:text-6xl lg:text-7xl">
                {match.score1 ?? 0}
                <span className="text-[var(--gk-red)] mx-2 text-3xl sm:text-4xl">:</span>
                {match.score2 ?? 0}
              </div>
              <span className="gk-vs">VS</span>
            </div>

            <div className="text-center lg:text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-[var(--gk-muted)] mb-2">
                {match.stage || 'Match'}
              </p>
              <p className="portal-display text-3xl sm:text-4xl lg:text-5xl text-[var(--gk-ink)] leading-tight">
                {name2}
              </p>
            </div>
          </div>

          {match.bestOf === 3 && (
            <div className="mt-6 flex justify-center">
              <SeriesScoreStrip match={match} size="sm" className="justify-center" />
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/live" className="portal-btn-primary">
              Watch Live
            </Link>
            <Link to="/schedule" className="portal-btn-secondary">
              View Schedule
            </Link>
          </div>
        </div>
      </section>

      <div className="portal-page space-y-12">
        <section className="space-y-4 -mt-8 relative z-10">
          <QuickNav />
        </section>

        <section className="space-y-5">
          <SectionHeading label="Live Broadcast" title="Watch Stream" />
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.8fr] gap-4">
            <div className="portal-card overflow-hidden gk-stripe">
              <div className="relative aspect-video bg-black">
                {embedUrl ? (
                  <iframe
                    title="NPL live stream"
                    src={embedUrl}
                    className="absolute inset-0 h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-[var(--gk-surface-2)]">
                    <img
                      src="/nature-walk-logo-1.png"
                      alt="NPL"
                      className="h-16 w-16 rounded-sm object-cover ring-1 ring-[var(--gk-line)]"
                      draggable={false}
                    />
                    <p className="portal-display text-lg text-[var(--gk-ink)]">Stream Offline</p>
                    <p className="text-xs text-[var(--gk-muted)] max-w-xs">
                      Live feed appears when organisers connect YouTube.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <aside className="portal-card p-5 flex flex-col gap-4 gk-stripe">
              <div className="flex items-center justify-between">
                <h3 className="portal-display text-lg text-[var(--gk-ink)]">On Court</h3>
                <StatusBadge
                  status={liveStatus}
                  pulse={liveStatus === 'live' || liveStatus === 'on-court'}
                />
              </div>

              <div className="rounded-sm bg-[var(--gk-surface-2)] border border-[var(--gk-line)] px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--gk-red)]">
                  {match.category || '—'}
                </p>
                <p className="text-xs text-[var(--gk-muted)] mt-0.5">{match.stage || '—'}</p>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-3">
                <p className="text-sm font-bold text-right truncate">{name1}</p>
                <div className="gk-score text-3xl px-2">
                  {match.score1 ?? 0}:{match.score2 ?? 0}
                </div>
                <p className="text-sm font-bold text-left truncate">{name2}</p>
              </div>

              <p className="text-center text-[11px] font-mono text-[var(--gk-muted)] uppercase">
                Race to {match.maxPoints ?? 11}
                {match.isTrump ? ' · Trump' : ''}
                {match.bestOf === 3 ? ` · Series ${formatGamesWonLabel(match)}` : ''}
              </p>

              <div className="mt-auto grid grid-cols-2 gap-2">
                <Link to="/score" className="portal-btn-primary text-center !text-xs !py-2.5">
                  Scoreboard
                </Link>
                <Link to="/live" className="portal-btn-secondary text-center !text-xs !py-2.5">
                  Cinema
                </Link>
              </div>
            </aside>
          </div>
        </section>

        {latest.length > 0 && (
          <section className="space-y-5">
            <div className="flex items-end justify-between gap-2">
              <SectionHeading label="Recent" title="Latest Matches" />
              <Link
                to="/results"
                className="text-xs font-bold uppercase tracking-wider text-[var(--gk-red)] hover:text-[var(--gk-ink)] flex items-center gap-0.5 shrink-0 mb-1"
              >
                All results
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {latest.map((f) => {
                const [teamA, teamB] = f.details.split(' vs ');
                return (
                  <MatchCard
                    key={f.id}
                    date={f.date}
                    time={f.time}
                    category={f.category}
                    stage={f.stage}
                    teamA={teamA || f.details}
                    teamB={teamB || '—'}
                    status="completed"
                    winnerName={f.winnerName}
                    result={f.result}
                  />
                );
              })}
            </div>
          </section>
        )}

        <section className="space-y-5 pb-4">
          <div className="flex items-end justify-between gap-2">
            <SectionHeading label="Fixtures" title="Upcoming Matches" />
            <Link
              to="/schedule"
              className="text-xs font-bold uppercase tracking-wider text-[var(--gk-red)] hover:text-[var(--gk-ink)] flex items-center gap-0.5 shrink-0 mb-1"
            >
              Full schedule
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-[var(--gk-muted)] py-10 text-center portal-card">
              No upcoming fixtures right now.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upcoming.map((f) => {
                const [teamA, teamB] = f.details.split(' vs ');
                return (
                  <MatchCard
                    key={f.id}
                    date={f.date}
                    time={f.time}
                    category={f.category}
                    stage={f.stage}
                    teamA={teamA || f.details}
                    teamB={teamB || 'TBD'}
                    status="scheduled"
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
