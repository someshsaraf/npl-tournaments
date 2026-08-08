import { useEffect, useState } from 'react';
import { Film, Loader2 } from 'lucide-react';
import { toYouTubeNocookieEmbedFromId } from '../utils/youtube';
import {
  FetchPastRecordingsError,
  fetchPastRecordings,
  type YouTubeRecording
} from '../utils/youtubeRecordings';

function formatPublishedAt(iso: string): string {
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

/**
 * Public VOD list: Nature Walk CSC videos from 1 Aug 2026.
 * Data comes from same-origin `/api/youtube-recordings` (server holds the API key).
 *
 * Concurrency: component-local fetch/abort only.
 * Security: embeds only validated video IDs from the API response.
 */
export default function RecordingsPage() {
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

  const embedSrc = selectedId ? toYouTubeNocookieEmbedFromId(selectedId) : null;
  const selected = items.find((r) => r.videoId === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="portal-display text-3xl sm:text-4xl text-white tracking-wide">
          Recordings
        </h1>
        <p className="text-sm text-slate-400">
          Past Nature Walk CSC live streams from 1 Aug 2026 onward
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
          <a
            href="https://www.youtube.com/results?search_query=Nature+walk+csc"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-sm font-bold text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
          >
            Open on YouTube
          </a>
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-slate-800 bg-slate-900/40">
          No recordings found for this channel since 1 Aug 2026.
        </p>
      ) : null}

      {!loading && items.length > 0 ? (
        <>
          {embedSrc && selected ? (
            <section
              className="rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-xl shadow-black/40"
              aria-label="Selected recording"
            >
              <div className="aspect-video w-full bg-black">
                <iframe
                  key={selected.videoId}
                  title={selected.title}
                  src={embedSrc}
                  className="h-full w-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  referrerPolicy="strict-origin-when-cross-origin"
                />
              </div>
              <div className="px-4 py-3 bg-slate-900/90 border-t border-slate-800">
                <p className="font-bold text-white text-sm sm:text-base leading-snug">
                  {selected.title}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {formatPublishedAt(selected.publishedAt)}
                </p>
              </div>
            </section>
          ) : null}

          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {items.map((row) => {
              const active = row.videoId === selectedId;
              return (
                <li key={row.videoId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.videoId)}
                    className={`w-full text-left rounded-2xl overflow-hidden border transition-colors ${
                      active
                        ? 'border-emerald-400 bg-emerald-500/10 ring-1 ring-emerald-400/50'
                        : 'border-slate-800 bg-slate-900/50 hover:border-slate-600'
                    }`}
                    aria-pressed={active}
                    aria-label={`Play ${row.title}`}
                  >
                    <div className="relative aspect-video bg-slate-950">
                      <img
                        src={row.thumbnailUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        draggable={false}
                      />
                      <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                        <Film className="size-3" aria-hidden />
                        Play
                      </span>
                    </div>
                    <div className="px-3 py-2.5 space-y-0.5">
                      <p className="text-sm font-bold text-white line-clamp-2 leading-snug">
                        {row.title}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {formatPublishedAt(row.publishedAt)}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {nextPageToken ? (
            <div className="flex justify-center pt-1">
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
                className="rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-sm font-bold px-5 py-2.5 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Loading…
                  </>
                ) : (
                  'Load more'
                )}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
