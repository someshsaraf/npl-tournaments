/** Default /live score lag when settings path is missing or invalid. */
export const DEFAULT_LIVE_SCORE_DELAY_MS = 7000;
export const MIN_LIVE_SCORE_DELAY_MS = 0;
export const MAX_LIVE_SCORE_DELAY_MS = 30000;

/**
 * Parse and clamp a live-score delay (milliseconds) from Firebase or form input.
 * Input: number | numeric string | unknown. Returns a safe integer in [0, 30000].
 */
export function parseLiveScoreDelayMs(raw: unknown): number {
  let n = NaN;
  if (typeof raw === 'number') n = raw;
  else if (typeof raw === 'string' && raw.trim()) n = Number(raw.trim());

  if (!Number.isFinite(n)) return DEFAULT_LIVE_SCORE_DELAY_MS;
  const rounded = Math.round(n);
  if (rounded < MIN_LIVE_SCORE_DELAY_MS) return MIN_LIVE_SCORE_DELAY_MS;
  if (rounded > MAX_LIVE_SCORE_DELAY_MS) return MAX_LIVE_SCORE_DELAY_MS;
  return rounded;
}

/** Seconds ↔ ms helpers for admin UI. */
export function delayMsToSeconds(ms: unknown): number {
  return Math.round(parseLiveScoreDelayMs(ms) / 1000);
}

export function delaySecondsToMs(seconds: unknown): number {
  const s =
    typeof seconds === 'number'
      ? seconds
      : typeof seconds === 'string' && seconds.trim()
        ? Number(seconds.trim())
        : NaN;
  if (!Number.isFinite(s)) return DEFAULT_LIVE_SCORE_DELAY_MS;
  return parseLiveScoreDelayMs(s * 1000);
}
