import { useCallback, useEffect, useState } from 'react';
import { onValue, ref, set } from 'firebase/database';
import { db, SCORE_DAYPART_ADS_STOPPED_DATE_PATH } from '../firebase';
import type { EventAd } from '../data/eventAds';
import { getActiveEventAds } from '../data/eventAds';
import {
  getLocalDateKey,
  isScoreDaypartAdsStoppedToday,
  isScoreDaypartAdsWindow,
  shouldPlayScoreDaypartAds
} from '../utils/scoreDaypartAds';

const CLOCK_TICK_MS = 30_000;
const AD_REFRESH_MS = 60_000;

/**
 * Drives /score + /live 1–4 PM fullscreen ad loop + Firebase same-day stop flag.
 * Concurrency: local state + one RTDB listener; cleaned up on unmount.
 * Security: only reads the allowlisted settings path; validates date-key shape.
 */
export function useScoreDaypartAds(): {
  active: boolean;
  ads: EventAd[];
  stoppedToday: boolean;
} {
  const [now, setNow] = useState(() => new Date());
  const [ads, setAds] = useState<EventAd[]>(() => getActiveEventAds());
  const [stoppedDateKey, setStoppedDateKey] = useState<string | null>(null);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const refresh = () => setAds(getActiveEventAds(new Date()));
    refresh();
    const id = window.setInterval(refresh, AD_REFRESH_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const stopRef = ref(db, SCORE_DAYPART_ADS_STOPPED_DATE_PATH);
    const unsub = onValue(stopRef, (snap) => {
      const val = snap.val();
      setStoppedDateKey(typeof val === 'string' ? val : null);
    });
    return () => unsub();
  }, []);

  const stoppedToday = isScoreDaypartAdsStoppedToday(stoppedDateKey, now);
  const active = shouldPlayScoreDaypartAds(stoppedDateKey, now, ads.length > 0);

  return { active, ads, stoppedToday };
}

/**
 * Admin controls for same-day stop/resume of /score daypart ads.
 * Concurrency: local state + RTDB listener/writes; no shared mutable globals.
 * Security: writes only YYYY-MM-DD or null to the settings path.
 */
export function useScoreDaypartAdsAdmin(): {
  stoppedToday: boolean;
  inWindow: boolean;
  stopAds: () => Promise<void>;
  resumeAds: () => Promise<void>;
  busy: boolean;
  message: string | null;
} {
  const [stoppedDateKey, setStoppedDateKey] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const tick = window.setInterval(() => setNow(new Date()), CLOCK_TICK_MS);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const stopRef = ref(db, SCORE_DAYPART_ADS_STOPPED_DATE_PATH);
    const unsub = onValue(stopRef, (snap) => {
      const val = snap.val();
      setStoppedDateKey(typeof val === 'string' ? val : null);
    });
    return () => unsub();
  }, []);

  const stopAds = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      await set(ref(db, SCORE_DAYPART_ADS_STOPPED_DATE_PATH), getLocalDateKey());
      setMessage('Score & live ads stopped for today (resume anytime, or they return tomorrow).');
    } catch (err) {
      console.error('Failed to stop score daypart ads:', err);
      setMessage('Failed to stop ads — check Firebase permissions.');
    } finally {
      setBusy(false);
    }
  }, []);

  const resumeAds = useCallback(async () => {
    setBusy(true);
    setMessage(null);
    try {
      await set(ref(db, SCORE_DAYPART_ADS_STOPPED_DATE_PATH), null);
      setMessage('Score & live ads resumed for the 1–4 PM window.');
    } catch (err) {
      console.error('Failed to resume score daypart ads:', err);
      setMessage('Failed to resume ads — check Firebase permissions.');
    } finally {
      setBusy(false);
    }
  }, []);

  return {
    stoppedToday: isScoreDaypartAdsStoppedToday(stoppedDateKey, now),
    inWindow: isScoreDaypartAdsWindow(now),
    stopAds,
    resumeAds,
    busy,
    message
  };
}
