import { useEffect, useCallback, useState } from 'react';
import { Loader2, Play, X } from 'lucide-react';
import {
  fetchGalleryManifest,
  type GalleryMediaItem
} from '../utils/matchGallery';

/**
 * Public match photos / clips gallery (public/Gallery — images + mp4).
 * Lightbox stays in-portal; videos use native <video controls playsInline>.
 *
 * Concurrency: component-local state only.
 * Security: only allowlisted paths from validated manifest.
 */
export default function MatchPhotosPage() {
  const [items, setItems] = useState<GalleryMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchGalleryManifest(ac.signal);
        if (cancelled) return;
        setItems(list);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load photos.');
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

  const closeLightbox = useCallback(() => setActiveIndex(null), []);

  const showPrev = useCallback(() => {
    setActiveIndex((i) => {
      if (i === null || items.length === 0) return i;
      return (i - 1 + items.length) % items.length;
    });
  }, [items.length]);

  const showNext = useCallback(() => {
    setActiveIndex((i) => {
      if (i === null || items.length === 0) return i;
      return (i + 1) % items.length;
    });
  }, [items.length]);

  useEffect(() => {
    if (activeIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [activeIndex, closeLightbox, showPrev, showNext]);

  const active = activeIndex !== null ? items[activeIndex] ?? null : null;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="portal-display text-3xl sm:text-4xl text-white tracking-wide">
          Match photos
        </h1>
        <p className="text-sm text-slate-400">
          Court photos and short clips from NPL 2026
          {items.length > 0 ? ` · ${items.length} item${items.length === 1 ? '' : 's'}` : ''}
        </p>
      </header>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span className="text-sm font-medium">Loading gallery…</span>
        </div>
      ) : null}

      {!loading && error ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-5">
          <p className="text-sm text-amber-100 font-medium">{error}</p>
        </div>
      ) : null}

      {!loading && !error && items.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-slate-800 bg-slate-900/40">
          No photos yet. Add files to <code className="text-slate-300">public/Gallery</code> and
          run <code className="text-slate-300">npm run gallery:manifest</code>.
        </p>
      ) : null}

      {!loading && items.length > 0 ? (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {items.map((item, index) => (
            <li key={item.file}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                className="group relative w-full aspect-square overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                aria-label={`Open ${item.title}`}
              >
                {item.kind === 'image' ? (
                  <img
                    src={item.src}
                    alt=""
                    className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]"
                    loading="lazy"
                    draggable={false}
                  />
                ) : (
                  <>
                    <video
                      src={item.src}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                      aria-hidden
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                      <span className="inline-flex size-12 items-center justify-center rounded-full bg-emerald-500 text-slate-950 shadow-lg">
                        <Play className="size-6 fill-current ml-0.5" aria-hidden />
                      </span>
                    </span>
                  </>
                )}
                <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-2">
                  <span className="block text-[10px] sm:text-xs font-bold text-white truncate">
                    {item.title}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {active && activeIndex !== null ? (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-black/95"
          role="dialog"
          aria-modal="true"
          aria-label={active.title}
        >
          <div className="flex items-center justify-between gap-3 px-3 sm:px-5 py-3 border-b border-white/10">
            <p className="min-w-0 text-sm sm:text-base font-bold text-white truncate">
              {active.title}
            </p>
            <button
              type="button"
              onClick={closeLightbox}
              className="shrink-0 rounded-full border border-white/20 bg-slate-900/80 p-2 text-white hover:bg-slate-800"
              aria-label="Close"
            >
              <X className="size-5" aria-hidden />
            </button>
          </div>

          <div className="relative flex-1 min-h-0 flex items-center justify-center p-3 sm:p-6">
            {items.length > 1 ? (
              <>
                <button
                  type="button"
                  onClick={showPrev}
                  className="absolute left-2 sm:left-4 z-10 rounded-full bg-slate-900/80 border border-white/20 px-3 py-2 text-xs font-bold uppercase text-white hover:bg-slate-800"
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={showNext}
                  className="absolute right-2 sm:right-4 z-10 rounded-full bg-slate-900/80 border border-white/20 px-3 py-2 text-xs font-bold uppercase text-white hover:bg-slate-800"
                >
                  Next
                </button>
              </>
            ) : null}

            {active.kind === 'image' ? (
              <img
                src={active.src}
                alt={active.title}
                className="max-h-full max-w-full object-contain rounded-lg"
                draggable={false}
              />
            ) : (
              <video
                key={active.src}
                src={active.src}
                className="max-h-full max-w-full rounded-lg bg-black"
                controls
                playsInline
                autoPlay
              />
            )}
          </div>

          <p className="text-center text-[11px] text-slate-500 py-2">
            {activeIndex + 1} / {items.length}
            {active.kind === 'video' ? ' · Video' : ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}
