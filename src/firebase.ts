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
 * RTDB path for /score daypart fullscreen ads kill-switch.
 * Value is a local YYYY-MM-DD string when stopped for that day; null/missing = allowed.
 */
export const SCORE_DAYPART_ADS_STOPPED_DATE_PATH = 'settings/scoreDaypartAdsStoppedDate';

/** RTDB path for player old→new name aliases (propagated across completed matches). */
export const PLAYER_NAME_ALIASES_PATH = 'settings/playerNameAliases';
