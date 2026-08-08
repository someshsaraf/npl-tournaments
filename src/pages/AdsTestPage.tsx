import { Link } from 'react-router-dom';
import { ScoreDaypartAdPlayer } from '../components/ScoreDaypartAdPlayer';
import { useScoreDaypartAds, useScoreDaypartAdsAdmin } from '../hooks/useScoreDaypartAds';

/**
 * Staff test page for /score + /live daypart fullscreen ads.
 * Always previews the rotating posters (ignores 1–5 PM window) so you can verify
 * creatives anytime. Stop/resume still uses the same Firebase flag as /score and /live.
 *
 * Concurrency: hooks own their listeners/timers.
 * Security: staff URL only (not in public nav); stop writes validated date keys.
 */
export default function AdsTestPage() {
  const { ads, active: scoreWouldPlay, stoppedToday } = useScoreDaypartAds();
  const {
    inWindow,
    stopAds,
    resumeAds,
    busy,
    message
  } = useScoreDaypartAdsAdmin();

  const hasAds = ads.length > 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 relative">
      {hasAds ? (
        <ScoreDaypartAdPlayer ads={ads} />
      ) : (
        <div className="flex min-h-screen items-center justify-center px-6 text-center">
          <div className="max-w-md space-y-3">
            <h1 className="portal-display text-4xl text-white tracking-wide">No active ads</h1>
            <p className="text-sm text-slate-400">
              Nothing in the catalog is active for this local date/time (e.g. Drawing after 2 PM,
              Kitchen only on 8 Aug).
            </p>
          </div>
        </div>
      )}

      <div className="fixed top-3 left-3 right-3 z-[100] flex flex-col sm:flex-row sm:items-start gap-2 pointer-events-none">
        <div className="pointer-events-auto rounded-xl border border-slate-700 bg-slate-950/90 backdrop-blur-md px-3 py-2.5 shadow-xl max-w-lg space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
            Ads test · /ads
          </p>
          <p className="text-xs text-slate-300">
            Preview always runs here. On <code className="text-indigo-300">/score</code> and{' '}
            <code className="text-indigo-300">/live</code>:{' '}
            {scoreWouldPlay ? (
              <span className="text-emerald-400 font-semibold">would play now</span>
            ) : (
              <span className="text-slate-400 font-semibold">would not play</span>
            )}
            {' · '}
            window {inWindow ? 'open (1–5 PM)' : 'closed'}
            {' · '}
            {stoppedToday ? 'admin stopped today' : 'not stopped'}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => void stopAds()}
              disabled={busy || stoppedToday}
              className="rounded-lg bg-rose-500 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white hover:bg-rose-400 disabled:opacity-40"
            >
              Stop score ads
            </button>
            <button
              type="button"
              onClick={() => void resumeAds()}
              disabled={busy || !stoppedToday}
              className="rounded-lg bg-emerald-500 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
            >
              Resume
            </button>
            <Link
              to="/score"
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-100 hover:bg-slate-700"
            >
              Open /score
            </Link>
            <Link
              to="/live"
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-100 hover:bg-slate-700"
            >
              Open /live
            </Link>
            <Link
              to="/admin"
              className="rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-100 hover:bg-slate-700"
            >
              Admin
            </Link>
          </div>
          {message ? (
            <p
              className={`text-[11px] ${
                message.startsWith('Failed') ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {message}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
