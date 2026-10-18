import { useEffect, useId, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { RecordingsInPagePlayer } from '../RecordingsInPagePlayer';
import type { Sport } from '../../data/tournamentData';
import { SPORT_LABEL } from '../../data/tournamentData';
import {
  FetchPastRecordingsError,
  fetchPastRecordings,
  type YouTubeRecording
} from '../../utils/youtubeRecordings';

function formatStreamedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(d);
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
  const title = typeof row.title === 'string' && row.title.trim() ? row.title.trim() : 'Recording';
  const shortTitle = title.length > 72 ? `${title.slice(0, 71)}…` : title;
  return `${date} · ${shortTitle}`;
}

/** Does a stream title mention this sport? ("Table Tennis" never counts as lawn tennis.) */
function titleMatchesSport(title: string, sport: Sport): boolean {
  if (sport === 'tennis') return /tennis/i.test(title) && !/table[\s-]*tennis/i.test(title);
  return /badminton/i.test(title);
}

/**
 * Past live-stream recordings from the channel, embedded as a tab in a
 * sport's hub. The channel isn't split by sport, so recordings are matched
 * on the sport name in the stream title, with a toggle to show everything.
 */
export function RecordingsView({ sport }: { sport?: Sport }) {
  const [showAll, setShowAll] = useState(false);
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
          err instanceof FetchPastRecordingsError ? err.message : 'Failed to load recordings.';
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

  const sportItems = sport ? items.filter((r) => titleMatchesSport(r.title ?? '', sport)) : items;
  const visible = !sport || showAll ? items : sportItems;
  const selected = visible.find((r) => r.videoId === selectedId) ?? visible[0] ?? null;

  return (
    <div className="space-y-4">
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span className="text-sm font-medium">Loading recordings…</span>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-5 space-y-3">
          <p className="text-sm text-amber-800 font-medium">{error}</p>
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-line bg-paper-soft">
          No recordings found for @NatureWalkCSC since 31 Jul 2026.
        </p>
      ) : null}

      {!loading && sport && items.length > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            {showAll
              ? `Showing all ${items.length} channel recordings.`
              : sportItems.length > 0
                ? `${sportItems.length} ${SPORT_LABEL[sport]} recording${sportItems.length === 1 ? '' : 's'}.`
                : `No streams titled "${SPORT_LABEL[sport]}" yet.`}
          </span>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="font-bold uppercase tracking-wide text-emerald-700 hover:text-emerald-800"
          >
            {showAll ? `Only ${SPORT_LABEL[sport]}` : 'Show all recordings'}
          </button>
        </div>
      ) : null}

      {!loading && visible.length > 0 ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-paper-soft p-3 sm:p-4 space-y-2">
            <label
              htmlFor={selectId}
              className="block text-xs font-bold uppercase tracking-[0.14em] text-slate-500"
            >
              Choose recording
            </label>
            <select
              id={selectId}
              value={selected?.videoId ?? ''}
              onChange={(e) => selectRecording(e.target.value)}
              className="w-full rounded-xl border border-line bg-white text-ink text-sm sm:text-base font-semibold px-3 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
            >
              {visible.map((row) => (
                <option key={row.videoId} value={row.videoId}>
                  {optionLabel(row)}
                </option>
              ))}
            </select>
            {selected ? (
              <p className="text-xs text-slate-500">Streamed {formatStreamedAt(selected.publishedAt)}</p>
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
                      const result = await fetchPastRecordings({ pageToken: nextPageToken });
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
                className="text-xs font-bold text-emerald-700 hover:text-emerald-800 disabled:opacity-50 inline-flex items-center gap-1.5"
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
