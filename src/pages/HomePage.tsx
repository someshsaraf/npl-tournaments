import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
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

/**
 * Public home: full-bleed brand hero, then stream + live score + upcoming.
 * Read-only Firebase listeners; no writes.
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
  const upcoming = fixtures.filter((f) => f.status !== 'completed').slice(0, 6);

  const liveLabel = seriesOver
    ? 'Match complete'
    : (match.score1 ?? 0) > 0 || (match.score2 ?? 0) > 0
      ? 'Live now'
      : 'On court';

  return (
    <div>
      {/* Full-bleed hero — brand first, one CTA group */}
      <section className="relative min-h-[min(72vh,36rem)] sm:min-h-[min(78vh,40rem)] overflow-hidden text-white">
        <img
          src="/hero.png"
          alt=""
          className="npl-hero-media absolute inset-0 h-full w-full object-cover"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--pine-deep)] via-[color-mix(in_srgb,var(--pine-deep)_72%,transparent)] to-[color-mix(in_srgb,var(--pine-deep)_35%,transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_70%,rgba(212,232,90,0.18),transparent_55%)]" />

        <div className="npl-hero-copy relative z-10 mx-auto flex min-h-[inherit] w-full max-w-6xl flex-col justify-end px-4 sm:px-6 pb-10 sm:pb-14 pt-24">
          <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-[0.28em] text-[var(--pine-lime)] mb-3">
            Renaissance Nature Walk
          </p>
          <h1 className="portal-display text-[clamp(3.5rem,12vw,7rem)] leading-[0.9] text-white">
            NPL 2026
          </h1>
          <p className="mt-3 max-w-md text-sm sm:text-base text-white/85 font-medium leading-relaxed">
            Community badminton — live scores, schedule, and stream in one place.
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link
              to="/live"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--pine-lime)] px-5 py-3 text-sm font-bold text-[var(--pine-deep)] hover:brightness-105 transition-[filter]"
            >
              Watch live
            </Link>
            <Link
              to="/schedule"
              className="inline-flex items-center justify-center rounded-xl border border-white/35 bg-white/10 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm hover:bg-white/18 transition-colors"
            >
              View schedule
            </Link>
          </div>
        </div>
      </section>

      <div className="portal-page space-y-8 -mt-1">
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.9fr] gap-5">
          <section className="overflow-hidden rounded-2xl border border-[var(--pine-line)] bg-[var(--pine-paper)] shadow-sm">
            <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[var(--pine-line)]">
              <h2 className="text-sm font-bold text-[var(--pine-deep)] tracking-wide">
                Live stream
              </h2>
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
                    When organisers set a YouTube link, the feed appears here.
                  </p>
                </div>
              )}
            </div>
          </section>

          <aside className="rounded-2xl border border-[var(--pine-line)] bg-[var(--pine-paper)] p-5 flex flex-col gap-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[var(--pine-deep)] tracking-wide">
                Now on court
              </h2>
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md ${
                  seriesOver
                    ? 'bg-[var(--pine-leaf)]/15 text-[var(--pine-leaf)]'
                    : 'bg-[var(--pine-clay)]/15 text-[var(--pine-clay)] animate-pulse'
                }`}
              >
                {liveLabel}
              </span>
            </div>

            <div>
              <p className="text-[11px] text-[var(--pine-sky)] font-semibold uppercase tracking-wider truncate">
                {match.category || '—'}
              </p>
              <p className="text-xs text-[var(--pine-muted)] truncate">{match.stage || '—'}</p>
            </div>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
              <div className="min-w-0">
                <p className="text-sm sm:text-base font-bold text-[var(--pine-deep)] truncate">
                  {name1}
                </p>
              </div>
              <div className="font-black tabular-nums text-3xl sm:text-4xl text-[var(--pine-deep)] leading-none px-1">
                {match.score1 ?? 0}
                <span className="text-[var(--pine-muted)] mx-1 font-semibold">:</span>
                {match.score2 ?? 0}
              </div>
              <div className="min-w-0">
                <p className="text-sm sm:text-base font-bold text-[var(--pine-deep)] truncate">
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

            <div className="mt-auto flex flex-wrap gap-2 pt-1">
              <Link
                to="/results"
                className="flex-1 min-w-[7rem] text-center rounded-xl bg-[var(--pine-deep)] text-[var(--pine-lime)] font-bold text-xs uppercase tracking-wide px-3 py-2.5 hover:opacity-95"
              >
                Results
              </Link>
              <Link
                to="/schedule"
                className="flex-1 min-w-[7rem] text-center rounded-xl border border-[var(--pine-line)] bg-white text-[var(--pine-deep)] font-bold text-xs uppercase tracking-wide px-3 py-2.5 hover:bg-[var(--pine-mist)]"
              >
                Schedule
              </Link>
            </div>
          </aside>
        </div>

        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="portal-display text-2xl sm:text-3xl text-[var(--pine-deep)]">
              Up next
            </h2>
            <Link
              to="/schedule"
              className="text-[11px] font-bold text-[var(--pine-leaf)] hover:text-[var(--pine-deep)] uppercase tracking-wide"
            >
              All fixtures →
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-[var(--pine-muted)] py-6 text-center">
              No upcoming fixtures.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--pine-line)] rounded-2xl border border-[var(--pine-line)] bg-[var(--pine-paper)] overflow-hidden">
              {upcoming.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-4 py-3 text-sm"
                >
                  <span className="shrink-0 font-mono text-xs text-[var(--pine-clay)] w-[7.5rem]">
                    {f.date} · {f.time}
                  </span>
                  <span className="text-[11px] uppercase tracking-wide text-[var(--pine-sky)] shrink-0 sm:w-40 truncate font-semibold">
                    {f.category}
                  </span>
                  <span className="text-[var(--pine-ink)] min-w-0 truncate font-medium">
                    {f.details}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
