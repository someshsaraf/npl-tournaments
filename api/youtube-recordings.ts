import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Past live streams for https://www.youtube.com/@NatureWalkCSC/streams
 * from 31 Jul 2026 onward (YouTube Data API — not HTML scrape).
 *
 * Dates use liveStreamingDetails.actualStartTime (when the stream ran),
 * not snippet.publishedAt (when the VOD was posted — often days later).
 */
const STREAMED_AFTER = '2026-07-31T00:00:00Z';
const STREAMED_AFTER_MS = Date.parse(STREAMED_AFTER);
/** Public channel id for @NatureWalkCSC (not a secret). Override with YOUTUBE_CHANNEL_ID. */
const DEFAULT_CHANNEL_ID = 'UCArjq0pgzz_DjtglfS6i_Fg';
const MAX_RESULTS = 25;
const API_HOST = 'https://www.googleapis.com';
const CHANNEL_ID_RE = /^UC[\w-]{20,}$/;
const API_KEY_RE = /^AIza[\w-]{10,}$/;
const VIDEO_ID_RE = /^[\w-]{11}$/;
const PAGE_TOKEN_RE = /^[\w-]{1,256}$/;

type RecordingItem = {
  videoId: string;
  title: string;
  /** When the live stream actually started (fallback: scheduled / published). */
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

function parseIsoDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const t = Date.parse(raw.trim());
  if (!Number.isFinite(t)) return null;
  return raw.trim();
}

function resolveChannelId(): string | null {
  const fromEnv =
    typeof process.env.YOUTUBE_CHANNEL_ID === 'string'
      ? process.env.YOUTUBE_CHANNEL_ID.trim()
      : '';
  if (fromEnv) {
    return CHANNEL_ID_RE.test(fromEnv) ? fromEnv : null;
  }
  return CHANNEL_ID_RE.test(DEFAULT_CHANNEL_ID) ? DEFAULT_CHANNEL_ID : null;
}

type SearchHit = {
  videoId: string;
  title: string;
  publishedAt: string;
  thumbnailUrl: string;
};

function parseSearchHit(raw: unknown): SearchHit | null {
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
  const publishedAt = parseIsoDate(sn.publishedAt);
  const thumbnailUrl = pickThumbnail(sn);
  if (!title || !publishedAt || !thumbnailUrl) return null;

  return { videoId, title, publishedAt, thumbnailUrl };
}

/**
 * Prefer actual live start, then scheduled start, then VOD publishedAt.
 */
function pickStreamedAt(video: Record<string, unknown>, fallbackPublishedAt: string): string {
  const live = video.liveStreamingDetails;
  if (live && typeof live === 'object' && !Array.isArray(live)) {
    const details = live as Record<string, unknown>;
    const actual = parseIsoDate(details.actualStartTime);
    if (actual) return actual;
    const scheduled = parseIsoDate(details.scheduledStartTime);
    if (scheduled) return scheduled;
  }
  const sn = video.snippet;
  if (sn && typeof sn === 'object' && !Array.isArray(sn)) {
    const pub = parseIsoDate((sn as Record<string, unknown>).publishedAt);
    if (pub) return pub;
  }
  return fallbackPublishedAt;
}

async function enrichWithStreamTimes(
  hits: SearchHit[],
  apiKey: string
): Promise<RecordingItem[]> {
  if (hits.length === 0) return [];

  const ids = hits.map((h) => h.videoId).join(',');
  const params = new URLSearchParams({
    part: 'snippet,liveStreamingDetails',
    id: ids,
    key: apiKey
  });
  const url = `${API_HOST}/youtube/v3/videos?${params.toString()}`;

  const ytRes = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' }
  });
  if (!ytRes.ok) {
    // Fall back to search publishedAt rather than failing the whole page.
    return hits.map((h) => ({
      videoId: h.videoId,
      title: h.title,
      publishedAt: h.publishedAt,
      thumbnailUrl: h.thumbnailUrl
    }));
  }

  const data: unknown = await ytRes.json();
  const byId = new Map<string, Record<string, unknown>>();
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const items = (data as { items?: unknown }).items;
    if (Array.isArray(items)) {
      for (const raw of items) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
        const v = raw as Record<string, unknown>;
        if (typeof v.id === 'string' && VIDEO_ID_RE.test(v.id)) {
          byId.set(v.id, v);
        }
      }
    }
  }

  const enriched: RecordingItem[] = [];
  for (const hit of hits) {
    const video = byId.get(hit.videoId);
    const streamedAt = video
      ? pickStreamedAt(video, hit.publishedAt)
      : hit.publishedAt;
    const streamedMs = Date.parse(streamedAt);
    // Keep only streams that actually started on/after 31 Jul 2026.
    if (Number.isFinite(streamedMs) && streamedMs < STREAMED_AFTER_MS) {
      continue;
    }
    let title = hit.title;
    let thumbnailUrl = hit.thumbnailUrl;
    if (video) {
      const sn = video.snippet;
      if (sn && typeof sn === 'object' && !Array.isArray(sn)) {
        const s = sn as Record<string, unknown>;
        if (typeof s.title === 'string' && s.title.trim()) title = s.title.trim();
        const thumb = pickThumbnail(s);
        if (thumb) thumbnailUrl = thumb;
      }
    }
    enriched.push({
      videoId: hit.videoId,
      title,
      publishedAt: streamedAt,
      thumbnailUrl
    });
  }

  enriched.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  return enriched;
}

/**
 * GET /api/youtube-recordings?pageToken=…
 * Lists completed live broadcasts for @NatureWalkCSC (same intent as /streams).
 *
 * Env (Vercel, not VITE_):
 * - YOUTUBE_API_KEY (required)
 * - YOUTUBE_CHANNEL_ID (optional; defaults to NatureWalk CSC)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed', code: 'method_not_allowed' });
    return;
  }

  const apiKey =
    typeof process.env.YOUTUBE_API_KEY === 'string' ? process.env.YOUTUBE_API_KEY.trim() : '';
  const channelId = resolveChannelId();

  if (!apiKey) {
    res.status(503).json({
      error: 'Recordings are not configured. Set YOUTUBE_API_KEY in Vercel env.',
      code: 'missing_config'
    });
    return;
  }
  if (!API_KEY_RE.test(apiKey)) {
    res.status(500).json({
      error: 'YouTube API key format is invalid on the server.',
      code: 'invalid_config'
    });
    return;
  }
  if (!channelId) {
    res.status(500).json({
      error: 'YOUTUBE_CHANNEL_ID format is invalid on the server.',
      code: 'invalid_config'
    });
    return;
  }

  const rawToken = req.query.pageToken;
  const pageToken =
    typeof rawToken === 'string' && PAGE_TOKEN_RE.test(rawToken.trim()) ? rawToken.trim() : '';

  // Wider search window on publish date; we filter by actual stream start after enrich.
  const params = new URLSearchParams({
    part: 'snippet',
    channelId,
    type: 'video',
    eventType: 'completed',
    order: 'date',
    publishedAfter: STREAMED_AFTER,
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
  const hits = rawItems
    .map(parseSearchHit)
    .filter((row): row is SearchHit => row !== null);

  let items: RecordingItem[];
  try {
    items = await enrichWithStreamTimes(hits, apiKey);
  } catch {
    res.status(502).json({
      error: 'Failed to load live stream start times from YouTube.',
      code: 'http_error'
    });
    return;
  }

  const nextPageToken =
    typeof root.nextPageToken === 'string' && root.nextPageToken.trim()
      ? root.nextPageToken.trim()
      : null;

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  res.status(200).json({ items, nextPageToken });
}
