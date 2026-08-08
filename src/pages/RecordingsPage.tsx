import { useEffect, useRef, useState } from 'react';
import { Film, Loader2 } from 'lucide-react';
import { toYouTubeNocookieEmbedFromId } from '../utils/youtube';
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

/**
 * Public VOD list: @NatureWalkCSC completed lives since 31 Jul 2026.
 * Player stays sticky / side-by-side with the grid; selecting a card scrolls the
 * player into view on small screens so users do not hunt upward.
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
  const playerRef = useRef<HTMLElement | null>(null);
  const userPickedRef = useRef(false);

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

  useEffect(() => {
    if (!userPickedRef.current || !selectedId) return;
    const el = playerRef.current;
    if (!el) return;
    // Keep player in view after picking a card lower on the page (esp. mobile).
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [selectedId]);

  const selectRecording = (videoId: string) => {
    if (typeof videoId !== 'string' || !videoId.trim()) return;
    userPickedRef.current = true;
    setSelectedId(videoId);
  };

  const embedSrc = selectedId ? toYouTubeNocookieEmbedFromId(selectedId) : null;
  const selected = items.find((r) => r.videoId === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="portal-display text-3xl sm:text-4xl text-white tracking-wide">
          Recordings
        </h1>
        <p className="text-sm text-slate-400">
          Past live streams from{' '}
          <a
            href="https://www.youtube.com/@NatureWalkCSC/streams"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
          >
            @NatureWalkCSC
          </a>{' '}
          since 31 Jul 2026
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
            href="https://www.youtube.com/@NatureWalkCSC/streams"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex text-sm font-bold text-emerald-300 hover:text-emerald-200 underline-offset-2 hover:underline"
          >
            Open @NatureWalkCSC streams on YouTube
          </a>
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-slate-800 bg-slate-900/40">
          No recordings found for @NatureWalkCSC since 31 Jul 2026.
        </p>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start">
          {/* Player: sticky under portal nav; scrolls into view on mobile pick */}
          <div className="lg:sticky lg:top-28 z-30 -mx-3 sm:mx-0 px-3 sm:px-0 pb-3 lg:pb-0">
            {embedSrc && selected ? (
              <section
                ref={playerRef}
                className="scroll-mt-28 rounded-2xl overflow-hidden border border-slate-800 bg-black shadow-xl shadow-black/40"
                aria-label="Selected recording"
                tabIndex={-1}
              >
                <div className="aspect-video w-full max-h-[42dvh] lg:max-h-none bg-black">
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
                <div className="px-4 py-3 bg-slate-900/95 border-t border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400/90 mb-1">
                    Now playing
                  </p>
                  <p className="font-bold text-white text-sm sm:text-base leading-snug line-clamp-2">
                    {selected.title}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Streamed {formatStreamedAt(selected.publishedAt)}
                  </p>
                </div>
              </section>
            ) : null}
          </div>

          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Choose a recording
            </p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
              {items.map((row) => {
                const active = row.videoId === selectedId;
                return (
                  <li key={row.videoId}>
                    <button
                      type="button"
                      onClick={() => selectRecording(row.videoId)}
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
                          {active ? 'Playing' : 'Play'}
                        </span>
                      </div>
                      <div className="px-3 py-2.5 space-y-0.5">
                        <p className="text-sm font-bold text-white line-clamp-2 leading-snug">
                          {row.title}
                        </p>
                        <p className="text-[11px] text-slate-400">
                          Streamed {formatStreamedAt(row.publishedAt)}
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
          </div>
        </div>
      ) : null}
    </div>
  );
}
