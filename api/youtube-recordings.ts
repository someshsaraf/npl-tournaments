import type { VercelRequest, VercelResponse } from '@vercel/node';

/** Inclusive start of NPL 2026 recordings window (UTC). */
const PUBLISHED_AFTER = '2026-08-01T00:00:00Z';
const SEARCH_QUERY = 'Nature walk csc';
const MAX_RESULTS = 25;
const API_HOST = 'https://www.googleapis.com';
const CHANNEL_ID_RE = /^UC[\w-]{20,}$/;
const API_KEY_RE = /^AIza[\w-]{10,}$/;
const VIDEO_ID_RE = /^[\w-]{11}$/;
const PAGE_TOKEN_RE = /^[\w-]{1,256}$/;

type RecordingItem = {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
};

function isSafeHttpsUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function pickThumbnail(snippet: Record<string, unknown>): string | null {
  const thumbs = snippet.thumbnails;
  if (!thumbs || typeof thumbs !== 'object' || Array.isArray(thumbs)) return null;
  const map = thumbs as Record<string, unknown>;
  for (const key of ['medium', 'high', 'default'] as const) {
    const entry = map[key];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const url = (entry as { url?: unknown }).url;
    if (isSafeHttpsUrl(url)) return url.trim();
  }
  return null;
}

function parseRecordingItem(raw: unknown): RecordingItem | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const item = raw as Record<string, unknown>;
  const id = item.id;
  if (!id || typeof id !== 'object' || Array.isArray(id)) return null;
  const videoId = (id as { videoId?: unknown }).videoId;
  if (typeof videoId !== 'string' || !VIDEO_ID_RE.test(videoId)) return null;

  const snippet = item.snippet;
  if (!snippet || typeof snippet !== 'object' || Array.isArray(snippet)) return null;
  const sn = snippet as Record<string, unknown>;
  const title = typeof sn.title === 'string' && sn.title.trim() ? sn.title.trim() : null;
  const publishedAt =
    typeof sn.publishedAt === 'string' && sn.publishedAt.trim() ? sn.publishedAt.trim() : null;
  const thumbnailUrl = pickThumbnail(sn);
  if (!title || !publishedAt || !thumbnailUrl) return null;

  return { videoId, title, publishedAt, thumbnailUrl };
}

/**
 * GET /api/youtube-recordings?pageToken=…
 * Server-only YouTube Data API proxy. Keys never shipped to the browser.
 *
 * Env (Vercel project settings, not VITE_):
 * - YOUTUBE_API_KEY
 * - YOUTUBE_CHANNEL_ID
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
    return;
  }

  const apiKey =
    typeof process.env.YOUTUBE_API_KEY === 'string' ? process.env.YOUTUBE_API_KEY.trim() : '';
  const channelId =
    typeof process.env.YOUTUBE_CHANNEL_ID === 'string'
      ? process.env.YOUTUBE_CHANNEL_ID.trim()
      : '';

  if (!apiKey || !channelId) {
    res.status(503).json({
      error:
        'Recordings are not configured. Set YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID in Vercel env.',
      code: 'missing_config'
    });
    return;
  }
  if (!API_KEY_RE.test(apiKey) || !CHANNEL_ID_RE.test(channelId)) {
    res.status(500).json({
      error: 'YouTube API key or channel ID format is invalid on the server.',
      code: 'invalid_config'
    });
    return;
  }

  const rawToken = req.query.pageToken;
  const pageToken =
    typeof rawToken === 'string' && PAGE_TOKEN_RE.test(rawToken.trim()) ? rawToken.trim() : '';

  const params = new URLSearchParams({
    part: 'snippet',
    channelId,
    q: SEARCH_QUERY,
    type: 'video',
    order: 'date',
    publishedAfter: PUBLISHED_AFTER,
    maxResults: String(MAX_RESULTS),
    key: apiKey
  });
  if (pageToken) params.set('pageToken', pageToken);

  const url = `${API_HOST}/youtube/v3/search?${params.toString()}`;

  let ytRes: Response;
  try {
    ytRes = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' }
    });
  } catch {
    res.status(502).json({ error: 'Network error talking to YouTube.', code: 'http_error' });
    return;
  }

  if (!ytRes.ok) {
    res.status(502).json({
      error: `YouTube API error (${ytRes.status}). Check API key, quota, and channel ID.`,
      code: 'http_error'
    });
    return;
  }

  let data: unknown;
  try {
    data = await ytRes.json();
  } catch {
    res.status(502).json({ error: 'Invalid JSON from YouTube API.', code: 'parse_error' });
    return;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    res.status(502).json({ error: 'Unexpected YouTube API response.', code: 'parse_error' });
    return;
  }

  const root = data as Record<string, unknown>;
  const rawItems = Array.isArray(root.items) ? root.items : [];
  const items = rawItems
    .map(parseRecordingItem)
    .filter((row): row is RecordingItem => row !== null);

  const nextPageToken =
    typeof root.nextPageToken === 'string' && root.nextPageToken.trim()
      ? root.nextPageToken.trim()
      : null;

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json({ items, nextPageToken });
}
