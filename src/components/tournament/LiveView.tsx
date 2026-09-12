import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ref, onValue } from 'firebase/database';
import { db, YOUTUBE_LIVE_URL_PATH } from '../../firebase';
import { INITIAL_MATCH, resolveSport, type MatchState, type Sport } from '../../data/tournamentData';
import { hasSeriesWinner, normalizeMatchState } from '../../utils/matchState';
import { toYouTubeEmbedUrl } from '../../utils/youtube';

/**
 * Live stream for one sport, embedded as a tab in that sport's event detail
 * page. Only shows the player when the live match's sport matches this tab —
 * otherwise says so plainly rather than silently showing an unrelated stream.
 */
export function LiveView({ sport }: { sport: Sport }) {
  const [match, setMatch] = useState<MatchState>(INITIAL_MATCH);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  useEffect(() => {
    const matchRef = ref(db, 'currentMatch');
    const unsubMatch = onValue(matchRef, (snap) => {
      const raw = snap.val();
      setMatch(normalizeMatchState(raw && typeof raw === 'object' ? raw : INITIAL_MATCH));
    });
    const youtubeRef = ref(db, YOUTUBE_LIVE_URL_PATH);
    const unsubYoutube = onValue(youtubeRef, (snap) => {
      const val = snap.val();
      setYoutubeUrl(typeof val === 'string' ? val : '');
    });
    return () => {
      unsubMatch();
      unsubYoutube();
    };
  }, []);

  const embedUrl = toYouTubeEmbedUrl(youtubeUrl || match.youtubeLiveUrl || '');
  const matchSport = resolveSport(match.sport);
  const seriesOver = hasSeriesWinner(match);
  const isThisSportLive = !!embedUrl && matchSport === sport && !seriesOver;

  if (!isThisSportLive) {
    return (
      <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-line bg-paper-soft">
        Not live right now. Check back when a match is on court.
      </p>
    );
  }

  const name1 = match.player1 || match.teamA || 'Side A';
  const name2 = match.player2 || match.teamB || 'Side B';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">
          {name1} vs {name2}
        </p>
        <Link
          to="/live"
          className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 hover:text-emerald-800 shrink-0"
        >
          Cinema view →
        </Link>
      </div>
      <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-line">
        <iframe
          title="Live stream"
          src={embedUrl}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      </div>
    </div>
  );
}
