import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBytAP0vO7M25RZ5uv0JMFBnyIrHRhvCpE",
  authDomain: "npl-tournaments.firebaseapp.com",
  databaseURL: "https://npl-tournaments-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "npl-tournaments",
  storageBucket: "npl-tournaments.firebasestorage.app",
  messagingSenderId: "229048065105",
  appId: "1:229048065105:web:965a331d7e300a39172c70"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
/** Score snapshot images under Storage path `photos/`. */
export const storage = getStorage(app);

/** RTDB path for persistent YouTube live URL (shared across admin sessions). */
export const YOUTUBE_LIVE_URL_PATH = 'settings/youtubeLiveUrl';

/** RTDB path for /live score broadcast delay in milliseconds. */
export const LIVE_SCORE_DELAY_MS_PATH = 'settings/liveScoreDelayMs';

/**
 * RTDB path for /score + /live daypart fullscreen ads kill-switch.
 * Value is a local YYYY-MM-DD string when stopped for that day; null/missing = allowed.
 */
export const SCORE_DAYPART_ADS_STOPPED_DATE_PATH = 'settings/scoreDaypartAdsStoppedDate';

/** RTDB path for player old→new name aliases (propagated across completed matches). */
export const PLAYER_NAME_ALIASES_PATH = 'settings/playerNameAliases';

/**
 * RTDB path for /live page presence (one child per open tab).
 * Clients write presence/live/{sessionId} and remove via onDisconnect.
 * Rules must allow public .write for create/delete under this path only.
 */
export const LIVE_VIEWERS_PRESENCE_PATH = 'presence/live';

/**
 * RTDB path for community gallery uploads metadata (one child per upload).
 * Files live in R2 under gallery/{id}/… — see api/gallery-upload-url.ts.
 */
export const GALLERY_UPLOADS_PATH = 'galleryUploads';

/** RTDB path for running total of community gallery bytes (5 GB cap). */
export const GALLERY_TOTAL_BYTES_PATH = 'galleryUploadsMeta/totalBytes';

/**
 * RTDB path for per-visitor emoji icons on community uploads.
 * Shape: galleryEmoji/{uploadId}/{visitorId} → allowlisted emoji string.
 */
export const GALLERY_EMOJI_PATH = 'galleryEmoji';
