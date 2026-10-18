import { getDatabase } from './lib/realtime';

/**
 * The app's live data store (self-hosted server, see server/realtime.ts) and
 * the well-known paths inside it.
 */
export const db = getDatabase();

/** Data path for persistent YouTube live URL (shared across admin sessions). */
export const YOUTUBE_LIVE_URL_PATH = 'settings/youtubeLiveUrl';

/** Data path for /live score broadcast delay in milliseconds. */
export const LIVE_SCORE_DELAY_MS_PATH = 'settings/liveScoreDelayMs';

/**
 * Data path for /score + /live daypart fullscreen ads kill-switch.
 * Value is a local YYYY-MM-DD string when stopped for that day; null/missing = allowed.
 */
export const SCORE_DAYPART_ADS_STOPPED_DATE_PATH = 'settings/scoreDaypartAdsStoppedDate';

/** Data path for player old→new name aliases (propagated across completed matches). */
export const PLAYER_NAME_ALIASES_PATH = 'settings/playerNameAliases';

/**
 * Data path for /live page presence (one child per open tab).
 * Clients write presence/live/{sessionId} and remove via onDisconnect.
 * Rules must allow public .write for create/delete under this path only.
 */
export const LIVE_VIEWERS_PRESENCE_PATH = 'presence/live';

/**
 * Data path for community gallery uploads metadata (one child per upload).
 * Files live in R2 under gallery/{id}/… — see api/gallery-upload-url.ts.
 */
export const GALLERY_UPLOADS_PATH = 'galleryUploads';

/** Data path for running total of community gallery bytes (5 GB cap). */
export const GALLERY_TOTAL_BYTES_PATH = 'galleryUploadsMeta/totalBytes';


/**
 * Per-sport live state. Badminton keeps the original top-level paths (so no
 * data migration); every other sport gets its own node so courts can score
 * simultaneously.
 */
export function liveMatchPath(sport: 'badminton' | 'tennis'): string {
  return sport === 'badminton' ? 'currentMatch' : `liveMatches/${sport}`;
}

export function youtubeLiveUrlPath(sport: 'badminton' | 'tennis'): string {
  return sport === 'badminton' ? YOUTUBE_LIVE_URL_PATH : `settings/sports/${sport}/youtubeLiveUrl`;
}

export function liveScoreDelayPath(sport: 'badminton' | 'tennis'): string {
  return sport === 'badminton' ? LIVE_SCORE_DELAY_MS_PATH : `settings/sports/${sport}/liveScoreDelayMs`;
}

/** Data root for the Lawn Tennis tournament builder (`draft` + `published`). */
export const TENNIS_TOURNAMENT_PATH = 'tournaments/tennis';
