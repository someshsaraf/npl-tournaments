import { useCallback, useEffect, useRef, useState } from 'react';
import type { MatchState } from '../data/tournamentData';
import { hasSeriesWinner } from '../utils/matchState';

/**
 * Queues a between-match ad after a series win, once celebration is dismissed.
 * Plays at most once per currentMatchId. Mid-series game wins do not queue.
 *
 * Concurrency: component-local refs/state only.
 * Input validation: requires a non-empty match id string when present.
 */
export function useBetweenMatchAd(match: MatchState | null | undefined) {
  const [showAd, setShowAd] = useState(false);
  const playedForIdRef = useRef<string | null>(null);
  const queuedForIdRef = useRef<string | null>(null);

  const matchId =
    match && typeof match.currentMatchId === 'string' && match.currentMatchId.trim()
      ? match.currentMatchId.trim()
      : null;

  const seriesOver = hasSeriesWinner(match);

  useEffect(() => {
    if (!seriesOver || !matchId) return;
    if (playedForIdRef.current === matchId) return;
    queuedForIdRef.current = matchId;
  }, [seriesOver, matchId]);

  // New match id while ad is open — dismiss stale ad.
  useEffect(() => {
    if (!matchId) return;
    if (showAd && playedForIdRef.current && playedForIdRef.current !== matchId) {
      setShowAd(false);
    }
  }, [matchId, showAd]);

  const maybeStartAdAfterCelebration = useCallback(() => {
    if (!seriesOver || !matchId) return;
    if (playedForIdRef.current === matchId) return;
    if (queuedForIdRef.current !== matchId) return;
    playedForIdRef.current = matchId;
    queuedForIdRef.current = null;
    setShowAd(true);
  }, [seriesOver, matchId]);

  /** Skip the ad for this match (e.g. scorer opens New Match immediately). */
  const skipQueuedAd = useCallback(() => {
    if (matchId) {
      playedForIdRef.current = matchId;
      queuedForIdRef.current = null;
    }
    setShowAd(false);
  }, [matchId]);

  const dismissAd = useCallback(() => {
    setShowAd(false);
  }, []);

  return { showAd, maybeStartAdAfterCelebration, dismissAd, skipQueuedAd };
}
