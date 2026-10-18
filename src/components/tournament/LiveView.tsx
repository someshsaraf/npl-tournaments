import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ref, onValue } from '../../lib/realtime';
import { Maximize2 } from 'lucide-react';
import { db, youtubeLiveUrlPath } from '../../db';
import type { MatchState, Sport } from '../../data/tournamentData';
import { sportSlug } from '../../data/sports';
import { hasSeriesWinner } from '../../utils/matchState';
import { toYouTubeEmbedUrl } from '../../utils/youtube';
import { formatTennisPointLabel, isTennisDeuce, isTennisGoldenPointActive, isTennisTiebreak } from '../../utils/tennisScoring';
import { formatTennisStageLabel } from '../../utils/tennisMatchState';
import { useSportLiveMatch } from '../../hooks/useSportLiveMatch';

/**
 * Live tab for one sport: that sport's YouTube stream with the live score
 * overlaid on the video, plus a link to the full-screen /live/:sport view.
 * Each sport has its own live match + stream URL, so courts never mix.
 */
export function LiveView({ sport }: { sport: Sport }) {
  const match = useSportLiveMatch(sport);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  useEffect(() => {
    const unsub = onValue(ref(db, youtubeLiveUrlPath(sport)), (snap) => {
      const val = snap.val();
      setYoutubeUrl(typeof val === 'string' ? val : '');
    });
    return () => unsub();
  }, [sport]);

  const embedUrl = toYouTubeEmbedUrl(youtubeUrl || match?.youtubeLiveUrl || '');
  const slug = sportSlug(sport);

  if (!embedUrl && !match) {
    return (
      <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-line bg-paper-soft">
        Not live right now. Check back when a match is on court.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          {embedUrl ? 'Live stream' : 'Live score'}
          {match ? (
            <span className="text-ink-soft font-normal">
              {' '}· {match.category}
              {match.stage ? ` · ${match.stage}` : ''}
            </span>
          ) : null}
        </p>
        <Link
          to={`/live/${slug}`}
          className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-emerald-700 hover:text-emerald-800 shrink-0"
        >
          <Maximize2 className="size-3" aria-hidden />
          Cinema view
        </Link>
      </div>
      {embedUrl ? (
        <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-line">
          <iframe
            title="Live stream"
            src={embedUrl}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
          {match ? (
            <div className="pointer-events-none absolute left-2 bottom-2 sm:left-4 sm:bottom-4">
              <LiveScoreBug match={match} />
            </div>
          ) : null}
        </div>
      ) : match ? (
        <div className="rounded-2xl bg-slate-950 p-4 sm:p-6 flex justify-center">
          <LiveScoreBug match={match} large />
        </div>
      ) : null}
    </div>
  );
}

/** Broadcast-style score bug: names, sets/games and current points. */
export function LiveScoreBug({ match, large = false }: { match: MatchState; large?: boolean }) {
  const isTennis = match.sport === 'tennis' && !!match.tennis;
  const t = match.tennis;
  const over = hasSeriesWinner(match);
  const rows: Array<{ name: string; games: number; points: string; serving: boolean; winner: boolean }> = [1, 2].map(
    (side) => {
      const s = side as 1 | 2;
      const name = (s === 1 ? match.player1 || match.teamA : match.player2 || match.teamB) || `Side ${s}`;
      if (isTennis && t) {
        return {
          name,
          games: s === 1 ? t.gamesWon1 : t.gamesWon2,
          points: formatTennisPointLabel(
            s === 1 ? t.points1 : t.points2,
            s === 1 ? t.points2 : t.points1,
            t.isTiebreak
          ),
          serving: !over && t.server === s,
          winner: match.matchWinner === s
        };
      }
      return {
        name,
        games: s === 1 ? match.gamesWon1 : match.gamesWon2,
        points: String(s === 1 ? match.score1 : match.score2),
        serving: !over && match.server === s,
        winner: match.matchWinner === s
      };
    }
  );
  const badge = isTennis
    ? over
      ? 'Final'
      : isTennisTiebreak(match)
        ? 'Tiebreak'
        : isTennisGoldenPointActive(match)
          ? 'Golden point'
          : isTennisDeuce(match)
            ? 'Deuce'
            : t
              ? formatTennisStageLabel(t.tennisStage)
              : ''
    : over
      ? 'Final'
      : '';

  const nameCls = large ? 'text-lg sm:text-2xl' : 'text-xs sm:text-sm';
  const numCls = large ? 'text-2xl sm:text-4xl min-w-[3ch]' : 'text-sm sm:text-base min-w-[2.6ch]';

  return (
    <div className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-slate-950/90 backdrop-blur-sm text-white">
      {rows.map((r, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 sm:gap-3 px-2.5 sm:px-3 py-1 sm:py-1.5 ${i === 0 ? 'border-b border-white/10' : ''}`}
        >
          <span
            className={`size-1.5 sm:size-2 rounded-full shrink-0 ${r.serving ? 'bg-lime-300 shadow-[0_0_8px_#bef264]' : 'bg-transparent'}`}
            aria-label={r.serving ? 'Serving' : undefined}
          />
          <span className={`${nameCls} font-bold truncate max-w-[9rem] sm:max-w-[16rem] ${r.winner ? 'text-lime-300' : ''}`}>
            {r.name}
          </span>
          <span className={`${numCls} ml-auto text-center font-black tabular-nums text-slate-300`}>{r.games}</span>
          <span className={`${numCls} text-center font-black tabular-nums rounded bg-lime-300 text-slate-950 px-1`}>
            {over ? '' : r.points}
          </span>
        </div>
      ))}
      {badge ? (
        <div className="bg-lime-300/15 text-lime-200 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.14em] text-center py-0.5">
          {badge}
        </div>
      ) : null}
    </div>
  );
}
