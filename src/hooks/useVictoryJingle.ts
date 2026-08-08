import { useCallback, useEffect, useRef, useState } from 'react';
import { stopSpeech } from '../utils/matchAnnouncer';
import {
  pickRandomVictoryJingleId,
  toVictoryJingleEmbedUrl,
  VICTORY_JINGLE_DELAY_MS,
  VICTORY_JINGLE_MAX_PLAY_MS
} from '../utils/victoryJingle';

type UseVictoryJingleArgs = {
  /** True when the series has a winner. */
  seriesOver: boolean;
  /**
   * True while the winner celebration is visible.
   * Latches the 10s arm so dismiss/ad transition does not cancel playback.
   */
  celebrationVisible: boolean;
  /** Match id — jingle plays at most once per match. */
  matchId: string | null | undefined;
};

/**
 * After winner celebration is shown, wait 10s then play a random YouTube jingle.
 * Auto-stops after 1 minute. Manual stop via stopJingle().
 * Latch: once celebration is seen for a finished series, the delay/play continues
 * even if celebration is dismissed (e.g. /score → between-match ad).
 *
 * Concurrency: component-local timers/refs; cleaned up on unmount.
 * Security: only allowlisted video IDs from victoryJingle.ts.
 * Input validation: requires non-empty matchId; seriesOver + celebration to arm.
 */
export function useVictoryJingle({
  seriesOver,
  celebrationVisible,
  matchId
}: UseVictoryJingleArgs): {
  embedSrc: string | null;
  stopJingle: () => void;
} {
  const [embedSrc, setEmbedSrc] = useState<string | null>(null);
  const [latched, setLatched] = useState(false);
  const playedForMatchRef = useRef<string | null>(null);
  const lastIdRef = useRef<string | null>(null);
  const armedMatchRef = useRef<string | null>(null);
  const maxPlayTimerRef = useRef<number | null>(null);

  const safeMatchId =
    typeof matchId === 'string' && matchId.trim() ? matchId.trim() : null;

  const clearMaxPlayTimer = useCallback(() => {
    if (maxPlayTimerRef.current !== null) {
      window.clearTimeout(maxPlayTimerRef.current);
      maxPlayTimerRef.current = null;
    }
  }, []);

  const stopJingle = useCallback(() => {
    clearMaxPlayTimer();
    setEmbedSrc(null);
  }, [clearMaxPlayTimer]);

  // Latch when celebration appears for a finished series; clear when series resets.
  useEffect(() => {
    if (!seriesOver) {
      setLatched(false);
      return;
    }
    if (celebrationVisible) {
      setLatched(true);
    }
  }, [seriesOver, celebrationVisible]);

  const active = seriesOver && latched;

  // New match → stop previous jingle.
  useEffect(() => {
    if (!safeMatchId) {
      clearMaxPlayTimer();
      setEmbedSrc(null);
      return;
    }
    if (playedForMatchRef.current && playedForMatchRef.current !== safeMatchId) {
      clearMaxPlayTimer();
      setEmbedSrc(null);
    }
    if (armedMatchRef.current && armedMatchRef.current !== safeMatchId) {
      armedMatchRef.current = null;
    }
  }, [safeMatchId, clearMaxPlayTimer]);

  useEffect(() => {
    if (!active || !safeMatchId) return;
    if (playedForMatchRef.current === safeMatchId) return;

    armedMatchRef.current = safeMatchId;
    const timer = window.setTimeout(() => {
      if (armedMatchRef.current !== safeMatchId) return;
      if (playedForMatchRef.current === safeMatchId) return;
      const videoId = pickRandomVictoryJingleId(lastIdRef.current);
      const src = toVictoryJingleEmbedUrl(videoId);
      if (!src || !videoId) return;
      playedForMatchRef.current = safeMatchId;
      lastIdRef.current = videoId;
      try {
        stopSpeech();
      } catch {
        /* ignore */
      }
      setEmbedSrc(src);
    }, VICTORY_JINGLE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      if (playedForMatchRef.current !== safeMatchId) {
        armedMatchRef.current = null;
      }
    };
  }, [active, safeMatchId]);

  // Auto-stop after one minute of playback.
  useEffect(() => {
    clearMaxPlayTimer();
    if (!embedSrc) return;
    maxPlayTimerRef.current = window.setTimeout(() => {
      maxPlayTimerRef.current = null;
      setEmbedSrc(null);
    }, VICTORY_JINGLE_MAX_PLAY_MS);
    return () => clearMaxPlayTimer();
  }, [embedSrc, clearMaxPlayTimer]);

  return { embedSrc, stopJingle };
}
