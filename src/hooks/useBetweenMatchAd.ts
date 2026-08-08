import { useCallback, useEffect, useRef, useState } from 'react';
import type { EventAd, EventAdId } from '../data/eventAds';
import { getActiveEventAds, pickRandomEventAd } from '../data/eventAds';
import type { MatchState } from '../data/tournamentData';
import { hasSeriesWinner } from '../utils/matchState';

/**
 * Queues a between-match ad after a series win, once celebration is dismissed.
 * Picks randomly among date-active ads (Friends' Kitchen only on 2026-08-08).
 * Plays at most once per currentMatchId. Mid-series game wins do not queue.
 * Skips entirely when no ads are active today.
 *
 * Concurrency: component-local refs/state only.
 * Input validation: requires a non-empty match id string when present.
 */
export function useBetweenMatchAd(match: MatchState | null | undefined) {
  const [showAd, setShowAd] = useState(false);
  const [currentAd, setCurrentAd] = useState<EventAd | null>(null);
  const playedForIdRef = useRef<string | null>(null);
  const queuedForIdRef = useRef<string | null>(null);
  const lastAdIdRef = useRef<EventAdId | null>(null);

  const matchId =
    match && typeof match.currentMatchId === 'string' && match.currentMatchId.trim()
      ? match.currentMatchId.trim()
      : null;

  const seriesOver = hasSeriesWinner(match);
  const hasActiveAds = getActiveEventAds().length > 0;

  useEffect(() => {
    if (!seriesOver || !matchId || !hasActiveAds) return;
    if (playedForIdRef.current === matchId) return;
    queuedForIdRef.current = matchId;
  }, [seriesOver, matchId, hasActiveAds]);

  // New match id while ad is open — dismiss stale ad.
  useEffect(() => {
    if (!matchId) return;
    if (showAd && playedForIdRef.current && playedForIdRef.current !== matchId) {
      setShowAd(false);
      setCurrentAd(null);
    }
  }, [matchId, showAd]);

  const maybeStartAdAfterCelebration = useCallback(() => {
    if (!seriesOver || !matchId) return;
    if (playedForIdRef.current === matchId) return;
    if (queuedForIdRef.current !== matchId) return;

    const picked = pickRandomEventAd(new Date(), lastAdIdRef.current);
    playedForIdRef.current = matchId;
    queuedForIdRef.current = null;

    if (!picked) {
      setShowAd(false);
      setCurrentAd(null);
      return;
    }

    lastAdIdRef.current = picked.id;
    setCurrentAd(picked);
    setShowAd(true);
  }, [seriesOver, matchId]);

  /** Skip the ad for this match (e.g. scorer opens New Match immediately). */
  const skipQueuedAd = useCallback(() => {
    if (matchId) {
      playedForIdRef.current = matchId;
      queuedForIdRef.current = null;
    }
    setShowAd(false);
    setCurrentAd(null);
  }, [matchId]);

  const dismissAd = useCallback(() => {
    setShowAd(false);
    setCurrentAd(null);
  }, []);

  return {
    showAd: showAd && currentAd !== null,
    currentAd,
    maybeStartAdAfterCelebration,
    dismissAd,
    skipQueuedAd
  };
}
