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
import heroImage from '../assets/hero.png';

/**
 * Public home: hero, quick navigation hub, live stream + score, upcoming fixtures.
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
  const upcoming = fixtures.filter((f) => f.status !== 'completed').slice(0, 5);
  const hasScore = (match.score1 ?? 0) > 0 || (match.score2 ?? 0) > 0;

  const liveStatus = seriesOver ? 'completed' : hasScore ? 'live' : 'on-court';

  return (
    <div>
      <section className="relative min-h-[min(68vh,34rem)] sm:min-h-[min(74vh,38rem)] overflow-hidden text-white">
        <img
          src={heroImage}
          alt=""
          className="npl-hero-media absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--pine-deep)] via-[color-mix(in_srgb,var(--pine-deep)_75%,transparent)] to-[color-mix(in_srgb,var(--pine-deep)_40%,transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_70%,rgba(212,232,90,0.18),transparent_55%)]" />

        <div className="npl-hero-copy relative z-10 mx-auto flex min-h-[inherit] w-full max-w-6xl flex-col justify-end px-4 sm:px-6 pb-10 sm:pb-14 pt-20">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.28em] text-[var(--pine-lime)] mb-3">
            Renaissance Nature Walk
          </p>
          <h1 className="portal-display text-[clamp(3rem,11vw,6.5rem)] leading-[0.92] text-white">
            NPL 2026
          </h1>
          <p className="mt-3 max-w-lg text-sm sm:text-base text-white/85 font-medium leading-relaxed">
            Everything you need for tournament day — live scores, schedule, teams, and stream.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link to="/live" className="portal-btn-primary !bg-[var(--pine-lime)] !text-[var(--pine-deep)]">
              Watch live
            </Link>
            <Link
              to="/schedule"
              className="inline-flex items-center justify-center rounded-xl border border-white/35 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/18 transition-colors"
            >
              View schedule
            </Link>
          </div>
        </div>
      </section>

      <div className="portal-page space-y-8">
        <section className="space-y-3 -mt-6 relative z-10">
          <h2 className="sr-only">Quick navigation</h2>
          <QuickNav />
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="portal-section-title">Live now</h2>
            <Link
              to="/score"
              className="text-xs font-bold text-[var(--pine-leaf)] hover:text-[var(--pine-deep)] flex items-center gap-0.5"
            >
              Full scoreboard
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.85fr] gap-4">
            <div className="portal-card overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--pine-line)] bg-[var(--pine-mist)]/50">
                <h3 className="text-sm font-bold text-[var(--pine-deep)]">Live stream</h3>
                <Link
                  to="/live"
                  className="text-[11px] font-bold text-[var(--pine-leaf)] hover:text-[var(--pine-deep)]"
                >
                  Cinema view →
                </Link>
              </div>
              <div className="relative aspect-video bg-[var(--pine-deep)]">
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
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                    <img
                      src="/nature-walk-logo-1.png"
                      alt="NPL"
                      className="h-16 w-16 rounded-xl object-cover ring-1 ring-white/20 bg-white"
                      draggable={false}
                    />
                    <p className="text-sm font-semibold text-white">Stream offline</p>
                    <p className="text-xs text-white/60 max-w-xs">
                      The live feed appears here when organisers connect YouTube.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <aside className="portal-card p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-[var(--pine-deep)]">On court</h3>
                <StatusBadge
                  status={liveStatus}
                  pulse={liveStatus === 'live' || liveStatus === 'on-court'}
                />
              </div>

              <div className="rounded-xl bg-[var(--pine-mist)]/80 px-3 py-2">
                <p className="text-[11px] text-[var(--pine-sky)] font-semibold uppercase tracking-wider truncate">
                  {match.category || 'Match'}
                </p>
                <p className="text-xs text-[var(--pine-muted)] truncate">{match.stage || '—'}</p>
              </div>

              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center py-2">
                <div className="min-w-0 text-left sm:text-center">
                  <p className="text-sm font-bold text-[var(--pine-deep)] truncate leading-tight">
                    {name1}
                  </p>
                </div>
                <div className="font-black tabular-nums text-4xl text-[var(--pine-deep)] leading-none px-2">
                  {match.score1 ?? 0}
                  <span className="text-[var(--pine-muted)] mx-0.5 font-semibold text-2xl">:</span>
                  {match.score2 ?? 0}
                </div>
                <div className="min-w-0 text-right sm:text-center">
                  <p className="text-sm font-bold text-[var(--pine-deep)] truncate leading-tight">
                    {name2}
                  </p>
                </div>
              </div>

              {match.bestOf === 3 ? (
                <SeriesScoreStrip match={match} size="sm" className="justify-center py-1" />
              ) : (
                <p className="text-center text-[11px] font-mono text-[var(--pine-muted)]">
                  Race to {match.maxPoints ?? 11}
                  {match.isTrump ? ' · Trump' : ''}
                </p>
              )}

              {match.bestOf === 3 && (
                <p className="text-center text-[11px] font-mono text-[var(--pine-muted)]">
                  Series {formatGamesWonLabel(match)}
                </p>
              )}

              <div className="mt-auto grid grid-cols-2 gap-2 pt-1">
                <Link to="/results" className="portal-btn-primary text-center text-xs !py-2">
                  Results
                </Link>
                <Link to="/schedule" className="portal-btn-secondary text-center text-xs !py-2">
                  Schedule
                </Link>
              </div>
            </aside>
          </div>
        </section>

        <section className="space-y-3 pb-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="portal-section-title">Up next</h2>
            <Link
              to="/schedule"
              className="text-xs font-bold text-[var(--pine-leaf)] hover:text-[var(--pine-deep)] flex items-center gap-0.5"
            >
              All fixtures
              <ChevronRight className="size-4" aria-hidden />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-[var(--pine-muted)] py-8 text-center portal-card">
              No upcoming fixtures right now.
            </p>
          ) : (
            <ul className="portal-list">
              {upcoming.map((f) => (
                <li key={f.id} className="portal-list-item">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <span className="shrink-0 font-mono text-xs font-semibold text-[var(--pine-clay)] w-[8rem]">
                      {f.date} · {f.time}
                    </span>
                    <span className="text-[11px] uppercase tracking-wide text-[var(--pine-sky)] shrink-0 sm:w-36 truncate font-semibold">
                      {f.category}
                    </span>
                    <span className="text-[var(--pine-ink)] min-w-0 truncate font-medium flex-1">
                      {f.details}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
