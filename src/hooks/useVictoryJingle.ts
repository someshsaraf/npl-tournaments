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
  /**
   * Called once per match when jingle playback ends (auto-stop, manual stop,
   * or skip because no allowlisted video). Not called on unmount/match reset.
   */
  onJingleEnded?: () => void;
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
  matchId,
  onJingleEnded
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
  const playingMatchRef = useRef<string | null>(null);
  const endedForMatchRef = useRef<string | null>(null);
  const onJingleEndedRef = useRef(onJingleEnded);
  onJingleEndedRef.current = onJingleEnded;

  const safeMatchId =
    typeof matchId === 'string' && matchId.trim() ? matchId.trim() : null;

  const clearMaxPlayTimer = useCallback(() => {
    if (maxPlayTimerRef.current !== null) {
      window.clearTimeout(maxPlayTimerRef.current);
      maxPlayTimerRef.current = null;
    }
  }, []);

  const notifyJingleEnded = useCallback((forMatchId: string | null) => {
    if (!forMatchId || endedForMatchRef.current === forMatchId) return;
    endedForMatchRef.current = forMatchId;
    playingMatchRef.current = null;
    const cb = onJingleEndedRef.current;
    if (typeof cb === 'function') {
      try {
        cb();
      } catch {
        /* ignore consumer errors */
      }
    }
  }, []);

  const stopJingle = useCallback(() => {
    clearMaxPlayTimer();
    const wasPlaying = playingMatchRef.current;
    setEmbedSrc(null);
    if (wasPlaying) {
      notifyJingleEnded(wasPlaying);
    }
  }, [clearMaxPlayTimer, notifyJingleEnded]);

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

  // New match → stop previous jingle without notifying (ad should not fire for stale match).
  useEffect(() => {
    if (!safeMatchId) {
      clearMaxPlayTimer();
      playingMatchRef.current = null;
      setEmbedSrc(null);
      return;
    }
    if (playedForMatchRef.current && playedForMatchRef.current !== safeMatchId) {
      clearMaxPlayTimer();
      playingMatchRef.current = null;
      setEmbedSrc(null);
    }
    if (armedMatchRef.current && armedMatchRef.current !== safeMatchId) {
      armedMatchRef.current = null;
    }
    if (endedForMatchRef.current && endedForMatchRef.current !== safeMatchId) {
      endedForMatchRef.current = null;
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
      playedForMatchRef.current = safeMatchId;
      if (!src || !videoId) {
        notifyJingleEnded(safeMatchId);
        return;
      }
      lastIdRef.current = videoId;
      try {
        stopSpeech();
      } catch {
        /* ignore */
      }
      playingMatchRef.current = safeMatchId;
      setEmbedSrc(src);
    }, VICTORY_JINGLE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      if (playedForMatchRef.current !== safeMatchId) {
        armedMatchRef.current = null;
      }
    };
  }, [active, safeMatchId, notifyJingleEnded]);

  // Auto-stop after one minute of playback.
  useEffect(() => {
    clearMaxPlayTimer();
    if (!embedSrc) return;
    const matchIdAtStart = playingMatchRef.current;
    maxPlayTimerRef.current = window.setTimeout(() => {
      maxPlayTimerRef.current = null;
      setEmbedSrc(null);
      notifyJingleEnded(matchIdAtStart);
    }, VICTORY_JINGLE_MAX_PLAY_MS);
    return () => clearMaxPlayTimer();
  }, [embedSrc, clearMaxPlayTimer, notifyJingleEnded]);

  return { embedSrc, stopJingle };
}
