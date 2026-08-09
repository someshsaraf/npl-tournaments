/**
 * /score + /live daypart fullscreen ads: local 13:00–16:00 window + admin same-day stop.
 *
 * Concurrency: pure helpers; no shared mutable state.
 * Security: stop flag is a YYYY-MM-DD string only (no free-form payloads).
 * Input validation: rejects invalid Date / date-key values.
 */

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Inclusive start hour (1 PM local). */
export const SCORE_DAYPART_ADS_START_HOUR = 13;
/** Exclusive end hour (4 PM local). */
export const SCORE_DAYPART_ADS_END_HOUR = 16;

export function getLocalDateKey(now: Date = new Date()): string {
  const d = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isValidStoppedDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_KEY_RE.test(value);
}

/** True during [13:00, 16:00) local time. */
export function isScoreDaypartAdsWindow(now: Date = new Date()): boolean {
  const d = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const hour = d.getHours();
  return hour >= SCORE_DAYPART_ADS_START_HOUR && hour < SCORE_DAYPART_ADS_END_HOUR;
}

/**
 * Admin stop applies only for the calendar day stored in Firebase.
 * Missing/invalid value → not stopped.
 */
export function isScoreDaypartAdsStoppedToday(
  stoppedDateKey: unknown,
  now: Date = new Date()
): boolean {
  if (!isValidStoppedDateKey(stoppedDateKey)) return false;
  return stoppedDateKey === getLocalDateKey(now);
}

/** Whether /score and /live should run the fullscreen daypart ad loop. */
export function shouldPlayScoreDaypartAds(
  stoppedDateKey: unknown,
  now: Date = new Date(),
  hasAds: boolean
): boolean {
  if (!hasAds) return false;
  if (!isScoreDaypartAdsWindow(now)) return false;
  if (isScoreDaypartAdsStoppedToday(stoppedDateKey, now)) return false;
  return true;
}
