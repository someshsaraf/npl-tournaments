import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db } from '../firebase';
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
 * Public Live Arena: stream + live score summary + upcoming fixtures.
 * Read-only Firebase listeners; no writes. Admin/scorer stay off this surface.
 */
export default function HomePage() {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);
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

    return () => {
      unsubMatch();
      unsubCompleted();
    };
  }, []);

  const embedUrl = toYouTubeEmbedUrl(match.youtubeLiveUrl ?? '');
  const seriesOver = hasSeriesWinner(match);
  const name1 = match.player1 || match.teamA || 'Side A';
  const name2 = match.player2 || match.teamB || 'Side B';
  const upcoming = fixtures
    .filter((f) => f.status !== 'completed')
    .slice(0, 6);

  const liveLabel = seriesOver
    ? 'Match complete'
    : (match.score1 ?? 0) > 0 || (match.score2 ?? 0) > 0
      ? 'Live now'
      : 'On court';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-slate-800 min-h-[9rem] sm:min-h-[11rem]">
        <img
          src="/hero.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-40"
          draggable={false}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/85 to-emerald-950/50" />
        <div className="relative z-10 px-5 sm:px-8 py-7 sm:py-9 max-w-xl">
          <p className="text-[11px] uppercase tracking-[0.2em] text-emerald-400 font-bold mb-2">
            Nature Walk Premier League
          </p>
          <h1 className="portal-display text-4xl sm:text-5xl text-white leading-none tracking-wide">
            NPL 2026
          </h1>
          <p className="mt-2 text-sm sm:text-base text-slate-300 max-w-md">
            Schedule, teams, live scores, and stream — all in one place for residents and guests.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_0.9fr] gap-4 sm:gap-5">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden flex flex-col min-h-[16rem]">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-800">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">Live stream</h2>
            <Link
              to="/live"
              className="text-[11px] font-bold uppercase tracking-wide text-emerald-400 hover:text-emerald-300"
            >
              Cinema view →
            </Link>
          </div>
          <div className="relative aspect-video bg-slate-950">
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
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center bg-[radial-gradient(ellipse_at_center,_rgba(16,185,129,0.12),_transparent_60%)]">
                <img
                  src="/nature-walk-logo-1.png"
                  alt="NPL"
                  className="h-16 w-16 rounded-xl object-cover ring-1 ring-emerald-500/30 bg-white"
                  draggable={false}
                />
                <p className="text-sm font-semibold text-slate-200">Stream offline</p>
                <p className="text-xs text-slate-500 max-w-xs">
                  When organisers set a YouTube link in Admin, the live feed appears here.
                </p>
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">Now showing</h2>
            <span
              className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                seriesOver
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-500/15 text-rose-300 border-rose-500/40 animate-pulse'
              }`}
            >
              {liveLabel}
            </span>
          </div>

          <div>
            <p className="text-[11px] text-indigo-300 font-semibold uppercase tracking-wider truncate">
              {match.category || '—'}
            </p>
            <p className="text-xs text-slate-500 truncate">{match.stage || '—'}</p>
          </div>

          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-bold text-indigo-100 truncate">{name1}</p>
            </div>
            <div className="font-black tabular-nums text-3xl sm:text-4xl text-amber-300 leading-none px-1">
              {match.score1 ?? 0}
              <span className="text-slate-600 mx-1">:</span>
              {match.score2 ?? 0}
            </div>
            <div className="min-w-0">
              <p className="text-sm sm:text-base font-bold text-rose-100 truncate">{name2}</p>
            </div>
          </div>

          {match.bestOf === 3 ? (
            <SeriesScoreStrip match={match} size="sm" className="justify-center py-1" />
          ) : (
            <p className="text-center text-[11px] font-mono text-slate-500">
              Race to {match.maxPoints ?? 11}
              {match.isTrump ? ' · Trump' : ''}
            </p>
          )}

          {match.bestOf === 3 && (
            <p className="text-center text-[11px] font-mono text-slate-500">
              Series {formatGamesWonLabel(match)}
            </p>
          )}

          <div className="mt-auto flex flex-wrap gap-2 pt-1">
            <Link
              to="/score"
              className="flex-1 min-w-[7rem] text-center rounded-lg bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wide px-3 py-2.5 hover:bg-amber-300"
            >
              Full scoreboard
            </Link>
            <Link
              to="/schedule"
              className="flex-1 min-w-[7rem] text-center rounded-lg border border-slate-700 bg-slate-800 text-slate-100 font-bold text-xs uppercase tracking-wide px-3 py-2.5 hover:bg-slate-700"
            >
              Full schedule
            </Link>
          </div>
        </aside>
      </div>

      <section className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">Up next</h2>
          <Link to="/schedule" className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 uppercase tracking-wide">
            All fixtures →
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No upcoming fixtures.</p>
        ) : (
          <ul className="divide-y divide-slate-800/80">
            {upcoming.map((f) => (
              <li
                key={f.id}
                className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-2.5 text-sm"
              >
                <span className="shrink-0 font-mono text-xs text-amber-400/90 w-[7.5rem]">
                  {f.date} · {f.time}
                </span>
                <span className="text-[11px] uppercase tracking-wide text-indigo-300/90 shrink-0 sm:w-40 truncate">
                  {f.category}
                </span>
                <span className="text-slate-200 min-w-0 truncate">{f.details}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
