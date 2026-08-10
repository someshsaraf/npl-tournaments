import { useEffect, useCallback, useRef, useState } from 'react';
import { Loader2, Play, Upload, X } from 'lucide-react';
import {
  fetchGalleryManifest,
  galleryYearsFromItems,
  GALLERY_DEFAULT_YEAR,
  type GalleryMediaItem
} from '../utils/matchGallery';
import {
  GALLERY_MAX_TOTAL_BYTES,
  formatGalleryStorageLabel,
  subscribeGalleryStorageUsage,
  subscribeGalleryUploads,
  uploadGalleryMedia,
  uploadsToGalleryItems
} from '../utils/galleryUploads';

const ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm';

/**
 * Public match photos / clips gallery.
 * Static files from public/Gallery + community uploads (R2 + RTDB).
 *
 * Concurrency: component-local state + RTDB listeners; cleaned up on unmount.
 * Security: allowlisted MIME on upload; shared 5 GB RTDB quota; only validated
 * /Gallery/ paths and HTTPS download URLs are shown.
 */
export default function MatchPhotosPage() {
  const [staticItems, setStaticItems] = useState<GalleryMediaItem[]>([]);
  const [uploadItems, setUploadItems] = useState<GalleryMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [usedBytes, setUsedBytes] = useState(0);
  const [selectedYear, setSelectedYear] = useState(GALLERY_DEFAULT_YEAR);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allItems = [...uploadItems, ...staticItems];
  const yearsFromItems = galleryYearsFromItems(allItems);
  const years = yearsFromItems.length > 0 ? yearsFromItems : [GALLERY_DEFAULT_YEAR];
  const items = allItems.filter((item) => item.year === selectedYear);
  const storageFull = usedBytes >= GALLERY_MAX_TOTAL_BYTES;

  useEffect(() => {
    let cancelled = false;
    const ac = new AbortController();
    async function run() {
      setLoading(true);
      setError(null);
      try {
        const list = await fetchGalleryManifest(ac.signal);
        if (cancelled) return;
        setStaticItems(list);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Static gallery load failed:', err);
        setStaticItems([]);
        setError(err instanceof Error ? err.message : 'Failed to load curated photos.');
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
    const unsub = subscribeGalleryUploads(
      (records) => {
        setUploadItems(uploadsToGalleryItems(records));
      },
      (err) => {
        console.error(err);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeGalleryStorageUsage((bytes) => {
      setUsedBytes(bytes);
    });
    return () => unsub();
  }, []);

  // Keep selected year valid when the available year list changes.
  useEffect(() => {
    if (years.includes(selectedYear)) return;
    setSelectedYear(years[0] ?? GALLERY_DEFAULT_YEAR);
  }, [years, selectedYear]);

  // Close lightbox when switching year so indices stay in range.
  useEffect(() => {
    setActiveIndex(null);
  }, [selectedYear]);

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

  const handlePickClick = () => {
    setUploadError(null);
    setUploadMessage(null);
    if (storageFull) {
      setUploadError('Gallery storage is full (5 GB limit).');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleYearSelect = (year: number) => {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) return;
    if (!years.includes(year)) return;
    setSelectedYear(year);
  };

  const handleFilesSelected = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const file = list[0];
    if (!file) return;

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);
    try {
      const record = await uploadGalleryMedia(file);
      setUploadMessage('Uploaded. Thanks!');
      setSelectedYear(record.year);
      setUploadItems((prev) => {
        const next: GalleryMediaItem = {
          id: record.id,
          src: record.url,
          file: record.fileName,
          kind: record.kind,
          title: record.title,
          year: record.year
        };
        if (prev.some((p) => p.id === record.id)) return prev;
        return [next, ...prev];
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const active = activeIndex !== null ? items[activeIndex] ?? null : null;

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="space-y-1">
          <h1 className="portal-display text-3xl sm:text-4xl text-white tracking-wide">
            Match photos
          </h1>
          <p className="text-sm text-slate-400">
            NPL-{selectedYear} Photos
            {items.length > 0 ? ` · ${items.length} item${items.length === 1 ? '' : 's'}` : ''}
          </p>
        </div>

        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Gallery year"
        >
          {years.map((year) => {
            const selected = year === selectedYear;
            return (
              <button
                key={year}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => handleYearSelect(year)}
                className={
                  selected
                    ? 'rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-950'
                    : 'rounded-lg border border-slate-700 bg-slate-900/60 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-300 hover:border-emerald-500/50 hover:text-white'
                }
              >
                {year}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-hidden
            tabIndex={-1}
            onChange={(e) => void handleFilesSelected(e.target.files)}
          />
          <button
            type="button"
            onClick={handlePickClick}
            disabled={uploading || storageFull}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-slate-950 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4" aria-hidden />
            )}
            {uploading ? 'Uploading…' : storageFull ? 'Storage full' : 'Upload photo or clip'}
          </button>
          <p className="text-[11px] text-slate-500">
            JPG / PNG / WebP / GIF · MP4 / WebM · shared 5 GB limit
            <span className="block sm:inline sm:before:content-['·_'] mt-0.5 sm:mt-0">
              Used {formatGalleryStorageLabel(usedBytes)}
            </span>
          </p>
        </div>

        {uploadError ? (
          <p className="text-sm text-amber-200 font-medium" role="alert">
            {uploadError}
          </p>
        ) : null}
        {uploadMessage ? (
          <p className="text-sm text-emerald-300 font-medium" role="status">
            {uploadMessage}
          </p>
        ) : null}
      </header>

      {loading && allItems.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-400">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span className="text-sm font-medium">Loading gallery…</span>
        </div>
      ) : null}

      {!loading && error && allItems.length === 0 ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-5">
          <p className="text-sm text-amber-100 font-medium">{error}</p>
          <p className="text-xs text-amber-100/70 mt-2">
            You can still upload a photo above once Firebase rules allow gallery writes.
          </p>
        </div>
      ) : null}

      {!loading && items.length === 0 && !error ? (
        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-slate-800 bg-slate-900/40">
          No photos for {selectedYear} yet — be the first to upload, or add files under{' '}
          <code className="text-slate-300">public/Gallery/{selectedYear}</code>.
        </p>
      ) : null}

      {!loading && items.length === 0 && error && allItems.length > 0 ? (
        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-slate-800 bg-slate-900/40">
          No photos for {selectedYear} yet.
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {items.map((item, index) => (
            <li key={item.id ?? `static:${item.year}:${item.file}`}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                className="group relative w-full aspect-square overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
                aria-label="Open gallery item"
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
          aria-label={active.kind === 'video' ? 'Gallery video' : 'Gallery photo'}
        >
          <div className="flex items-center justify-end gap-3 px-3 sm:px-5 py-3 border-b border-white/10">
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
                alt=""
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
