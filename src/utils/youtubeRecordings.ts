/** Inclusive start of recordings window (UTC) — display copy; API uses the same date. */
export const RECORDINGS_PUBLISHED_AFTER = '2026-07-31T00:00:00Z';

export type YouTubeRecording = {
  videoId: string;
  title: string;
  /** ISO time the live stream started (actualStartTime), not VOD publish time. */
  publishedAt: string;
  thumbnailUrl: string;
};

export type FetchPastRecordingsResult = {
  items: YouTubeRecording[];
  nextPageToken: string | null;
};

export type FetchPastRecordingsErrorCode =
  | 'missing_config'
  | 'invalid_config'
  | 'http_error'
  | 'parse_error'
  | 'method_not_allowed';

export class FetchPastRecordingsError extends Error {
  readonly code: FetchPastRecordingsErrorCode;

  constructor(code: FetchPastRecordingsErrorCode, message: string) {
    super(message);
    this.name = 'FetchPastRecordingsError';
    this.code = code;
  }
}

const VIDEO_ID_RE = /^[\w-]{11}$/;
const PAGE_TOKEN_RE = /^[\w-]{1,256}$/;

function isSafeHttpsUrl(raw: unknown): raw is string {
  if (typeof raw !== 'string' || !raw.trim()) return false;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseClientItem(raw: unknown): YouTubeRecording | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const videoId = row.videoId;
  const title = row.title;
  const publishedAt = row.publishedAt;
  const thumbnailUrl = row.thumbnailUrl;
  if (typeof videoId !== 'string' || !VIDEO_ID_RE.test(videoId)) return null;
  if (typeof title !== 'string' || !title.trim()) return null;
  if (typeof publishedAt !== 'string' || !publishedAt.trim()) return null;
  if (!isSafeHttpsUrl(thumbnailUrl)) return null;
  return {
    videoId,
    title: title.trim(),
    publishedAt: publishedAt.trim(),
    thumbnailUrl: thumbnailUrl.trim()
  };
}

/**
 * Fetches past recordings via the Vercel serverless proxy (`/api/youtube-recordings`).
 * API key stays on the server (YOUTUBE_API_KEY) — never use VITE_ for the key.
 *
 * Concurrency: pure async; no shared mutable state.
 * Security: only talks to same-origin /api; validates each returned video id/thumbnail.
 * Input validation: pageToken allowlist; ignores unknown fields from the API JSON.
 */
export async function fetchPastRecordings(options?: {
  pageToken?: string | null;
  signal?: AbortSignal;
}): Promise<FetchPastRecordingsResult> {
  const params = new URLSearchParams();
  const pageToken =
    typeof options?.pageToken === 'string' && options.pageToken.trim()
      ? options.pageToken.trim()
      : '';
  if (pageToken && PAGE_TOKEN_RE.test(pageToken)) {
    params.set('pageToken', pageToken);
  }

  const qs = params.toString();
  const url = qs ? `/api/youtube-recordings?${qs}` : '/api/youtube-recordings';

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      signal: options?.signal,
      headers: { Accept: 'application/json' }
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err;
    throw new FetchPastRecordingsError(
      'http_error',
      'Network error loading recordings. On local Vite, use `vercel dev` so /api works.'
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const errMsg =
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    typeof (body as { error?: unknown }).error === 'string'
      ? ((body as { error: string }).error)
      : null;
  const errCode =
    body &&
    typeof body === 'object' &&
    !Array.isArray(body) &&
    typeof (body as { code?: unknown }).code === 'string'
      ? ((body as { code: string }).code)
      : null;

  if (!response.ok) {
    const code: FetchPastRecordingsErrorCode =
      errCode === 'missing_config' ||
      errCode === 'invalid_config' ||
      errCode === 'parse_error' ||
      errCode === 'method_not_allowed'
        ? errCode
        : 'http_error';
    throw new FetchPastRecordingsError(
      code,
      errMsg ??
        (response.status === 404
          ? 'Recordings API not found. Deploy with Vercel (or run `vercel dev`) so /api/youtube-recordings exists.'
          : `Failed to load recordings (${response.status}).`)
    );
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new FetchPastRecordingsError('parse_error', 'Unexpected recordings API response.');
  }

  const root = body as Record<string, unknown>;
  const rawItems = Array.isArray(root.items) ? root.items : [];
  const items = rawItems
    .map(parseClientItem)
    .filter((row): row is YouTubeRecording => row !== null);

  const nextPageToken =
    typeof root.nextPageToken === 'string' && root.nextPageToken.trim()
      ? root.nextPageToken.trim()
      : null;

  return { items, nextPageToken };
}
