const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
]);

const VIDEO_ID_PATTERN = /^[\w-]{11}$/;

function isValidVideoId(id: string | undefined): id is string {
  return typeof id === 'string' && VIDEO_ID_PATTERN.test(id);
}

/**
 * Extracts a YouTube video ID from common watch/live/share URL forms.
 * Rejects non-YouTube hosts to avoid unsafe iframe src values.
 */
export function parseYouTubeVideoId(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;

  const host = url.hostname.replace(/^www\./, '').toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;

  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return isValidVideoId(id) ? id : null;
  }

  const fromQuery = url.searchParams.get('v');
  if (isValidVideoId(fromQuery ?? undefined)) return fromQuery;

  const parts = url.pathname.split('/').filter(Boolean);
  if (
    parts.length >= 2 &&
    (parts[0] === 'live' || parts[0] === 'embed' || parts[0] === 'shorts' || parts[0] === 'v')
  ) {
    return isValidVideoId(parts[1]) ? parts[1] : null;
  }

  return null;
}

/** Safe embed URL for iframe, or null if input is empty/invalid. */
export function toYouTubeEmbedUrl(raw: string): string | null {
  const id = parseYouTubeVideoId(raw);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?autoplay=1&playsinline=1&rel=0`;
}

/**
 * Embed URL for the /live page: autoplay, no controls, JS API enabled
 * so the host page can force continuous playback.
 */
export function toYouTubeLiveOverlayEmbedUrl(raw: string): string | null {
  const id = parseYouTubeVideoId(raw);
  if (!id) return null;

  // mute=1 is required for iOS / Safari autoplay policies.
  const params = new URLSearchParams({
    autoplay: '1',
    mute: '1',
    controls: '0',
    disablekb: '1',
    fs: '0',
    modestbranding: '1',
    playsinline: '1',
    rel: '0',
    enablejsapi: '1',
    iv_load_policy: '3'
  });

  if (typeof window !== 'undefined' && window.location?.origin) {
    params.set('origin', window.location.origin);
  }

  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export function isValidYouTubeLiveUrl(raw: string): boolean {
  if (typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  if (!trimmed) return true; // empty clears the link
  return parseYouTubeVideoId(trimmed) !== null;
}
