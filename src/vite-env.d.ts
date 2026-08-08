/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Client Vite env — do not put YouTube API keys here (use server YOUTUBE_API_KEY).
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
