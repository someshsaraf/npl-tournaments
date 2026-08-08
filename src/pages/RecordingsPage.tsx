import { useEffect, useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { RecordingsInPagePlayer } from '../components/RecordingsInPagePlayer';
import {
  FetchPastRecordingsError,
  fetchPastRecordings,
  type YouTubeRecording
} from '../utils/youtubeRecordings';

function formatStreamedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(d);
  } catch {
    return iso;
  }
}

/** Compact date for dropdown rows (local calendar day of stream start). */
function formatStreamDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch {
    return iso;
  }
}

function optionLabel(row: YouTubeRecording): string {
  const date = formatStreamDate(row.publishedAt);
  const title =
    typeof row.title === 'string' && row.title.trim() ? row.title.trim() : 'Recording';
  const shortTitle = title.length > 72 ? `${title.slice(0, 71)}…` : title;
  return `${date} · ${shortTitle}`;
}

/**
 * Public VOD page: large in-page player + dropdown (date · title).
 * Clicks never go to youtube.com — Play/Pause is portal-owned via IFrame API.
 *
 * Concurrency: component-local fetch/abort only.
 * Security: embeds only validated video IDs from the API response.
 */
export default function RecordingsPage() {
  const selectId = useId();
  const [items, setItems] = useState<YouTubeRecording[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchPastRecordings({ signal: ac.signal });
        if (cancelled) return;
        setItems(result.items);
        setNextPageToken(result.nextPageToken);
        setSelectedId(result.items[0]?.videoId ?? null);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message =
          err instanceof FetchPastRecordingsError
            ? err.message
            : 'Failed to load recordings.';
        setError(message);
        setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, []);

  const selectRecording = (videoId: string) => {
    if (typeof videoId !== 'string' || !videoId.trim()) return;
    setSelectedId(videoId);
  };

  const selected = items.find((r) => r.videoId === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="portal-display text-3xl sm:text-4xl text-white tracking-wide">
          Recordings
        </h1>
        <p className="text-sm text-slate-400">
          Past live streams from @NatureWalkCSC since 31 Jul 2026
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span className="text-sm font-medium">Loading recordings…</span>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-5 space-y-3">
          <p className="text-sm text-amber-100 font-medium">{error}</p>
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-slate-800 bg-slate-900/40">
          No recordings found for @NatureWalkCSC since 31 Jul 2026.
        </p>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 sm:p-4 space-y-2">
            <label
              htmlFor={selectId}
              className="block text-xs font-bold uppercase tracking-[0.14em] text-slate-400"
            >
              Choose recording
            </label>
            <select
              id={selectId}
              value={selectedId ?? ''}
              onChange={(e) => selectRecording(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 text-white text-sm sm:text-base font-semibold px-3 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            >
              {items.map((row) => (
                <option key={row.videoId} value={row.videoId}>
                  {optionLabel(row)}
                </option>
              ))}
            </select>
            {selected ? (
              <p className="text-xs text-slate-500">
                Streamed {formatStreamedAt(selected.publishedAt)}
              </p>
            ) : null}
            {nextPageToken ? (
              <button
                type="button"
                disabled={loadingMore}
                onClick={() => {
                  void (async () => {
                    setLoadingMore(true);
                    setError(null);
                    try {
                      const result = await fetchPastRecordings({
                        pageToken: nextPageToken
                      });
                      setItems((prev) => [...prev, ...result.items]);
                      setNextPageToken(result.nextPageToken);
                    } catch (err) {
                      const message =
                        err instanceof FetchPastRecordingsError
                          ? err.message
                          : 'Failed to load more recordings.';
                      setError(message);
                    } finally {
                      setLoadingMore(false);
                    }
                  })();
                }}
                className="text-xs font-bold text-emerald-300 hover:text-emerald-200 disabled:opacity-50 inline-flex items-center gap-1.5"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    Loading more…
                  </>
                ) : (
                  'Load more into list'
                )}
              </button>
            ) : null}
          </div>

          {selected ? (
            <RecordingsInPagePlayer
              key={selected.videoId}
              videoId={selected.videoId}
              title={selected.title}
              thumbnailUrl={selected.thumbnailUrl}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
