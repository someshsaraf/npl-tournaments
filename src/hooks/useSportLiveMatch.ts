import { useEffect, useState } from 'react';
import { onValue, ref } from '../lib/realtime';
import { db, liveMatchPath } from '../db';
import type { MatchState, Sport } from '../data/tournamentData';
import { hasSeriesWinner, normalizeMatchState } from '../utils/matchState';

/** Live match for one sport (null until loaded / when the node is empty). */
export function useSportLiveMatch(sport: Sport): MatchState | null {
  const [match, setMatch] = useState<MatchState | null>(null);
  useEffect(() => {
    const unsub = onValue(ref(db, liveMatchPath(sport)), (snap) => {
      const raw = snap.val();
      setMatch(raw && typeof raw === 'object' ? normalizeMatchState(raw) : null);
    });
    return () => unsub();
  }, [sport]);
  return match;
}

/**
 * A match is "on court" when it's unfinished and at least one point has been
 * played — a freshly reset or long-finished match doesn't light up Live badges.
 */
export function isMatchOnCourt(match: MatchState | null): boolean {
  if (!match || hasSeriesWinner(match)) return false;
  if (match.sport === 'tennis') {
    const t = match.tennis;
    return !!t && (t.points1 + t.points2 + t.gamesWon1 + t.gamesWon2 > 0);
  }
  return match.score1 + match.score2 + match.gamesWon1 + match.gamesWon2 > 0;
}
