import { parseYouTubeVideoId } from './youtube';

/**
 * Allowed victory-jingle video IDs (after match finish on score surfaces).
 * Paths are fixed allowlist — never accept arbitrary URLs from Firebase/UI.
 */
const VICTORY_JINGLE_WATCH_URLS: readonly string[] = Object.freeze([
  'https://www.youtube.com/watch?v=Ax0G_P2dSBw',
  'https://www.youtube.com/watch?v=bnqLzCsffwY',
  'https://www.youtube.com/watch?v=wOsyFQZg76g'
]);

const ALLOWED_IDS: readonly string[] = Object.freeze(
  VICTORY_JINGLE_WATCH_URLS.map((u) => parseYouTubeVideoId(u)).filter(
    (id): id is string => typeof id === 'string'
  )
);

/** Delay after winner celebration appears before starting a jingle. */
export const VICTORY_JINGLE_DELAY_MS = 10_000;

/** Auto-stop jingle playback after this duration. */
export const VICTORY_JINGLE_MAX_PLAY_MS = 60_000;

function pickIndex(length: number): number {
  if (length <= 0) return 0;
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return (buf[0] ?? 0) % length;
  }
  return Math.floor(Math.random() * length);
}

/**
 * Picks a random allowlisted victory video ID, optionally avoiding an immediate repeat.
 * Returns null if the allowlist is empty.
 */
export function pickRandomVictoryJingleId(excludeId?: string | null): string | null {
  if (ALLOWED_IDS.length === 0) return null;
  const pool =
    excludeId && ALLOWED_IDS.length > 1
      ? ALLOWED_IDS.filter((id) => id !== excludeId)
      : [...ALLOWED_IDS];
  if (pool.length === 0) return ALLOWED_IDS[0] ?? null;
  return pool[pickIndex(pool.length)] ?? null;
}

/**
 * Embed URL for victory jingle audio/video playback (autoplay, minimal chrome).
 * Security: only builds embeds for allowlisted IDs.
 */
export function toVictoryJingleEmbedUrl(videoId: unknown): string | null {
  if (typeof videoId !== 'string' || !ALLOWED_IDS.includes(videoId)) return null;

  // Audio-only surface: hide player chrome (iframe is visually hidden in UI).
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '0',
    controls: '0',
    disablekb: '1',
    fs: '0',
    modestbranding: '1',
    playsinline: '1',
    rel: '0',
    iv_load_policy: '3'
  });

  if (typeof window !== 'undefined' && window.location?.origin) {
    params.set('origin', window.location.origin);
  }

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
}
