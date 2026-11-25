import { useEffect, useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2, Play, Trash2, Upload, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchGalleryManifest,
  GALLERY_DEFAULT_YEAR,
  GALLERY_SEASON_YEARS,
  galleryTagFromYear,
  isGallerySeasonYear,
  type GalleryMediaItem
} from '../utils/matchGallery';
import {
  GALLERY_MAX_TOTAL_BYTES,
  deleteGalleryUpload,
  formatGalleryStorageLabel,
  subscribeGalleryStorageUsage,
  subscribeGalleryUploads,
  uploadGalleryMedia,
  uploadsToGalleryItems
} from '../utils/galleryUploads';
import { SPORT_CARDS, sportFromGalleryEventId, sportFromParam } from '../data/sports';
import type { Sport } from '../data/tournamentData';

const ALL_SPORTS = 'all';
type SportFilter = Sport | typeof ALL_SPORTS;

/** Sports that have in-app tournaments (Table Tennis isn't built yet). */
const PHOTO_SPORTS = SPORT_CARDS.filter((c): c is typeof c & { sport: Sport } => c.sport !== null);

const ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,.jpg,.jpeg,.png,.webp,.gif,.mp4,.webm';

/**
 * Public match photos / clips gallery.
 * Static files from public/Gallery + community uploads (R2 + data store).
 *
 * Concurrency: component-local state + data store listeners; cleaned up on unmount.
 * Security: allowlisted MIME + season tags (npl-2023…2026); shared 5 GB quota;
 * only validated /Gallery/ paths and HTTPS download URLs are shown.
 */
export default function MatchPhotosPage() {
  const { access, admin, deviceId } = useAuth();
  /** Anyone who entered the community code (or staff) can add photos. */
  const canUpload = access;
  const [searchParams] = useSearchParams();
  const [staticItems, setStaticItems] = useState<GalleryMediaItem[]>([]);
  const [uploadItems, setUploadItems] = useState<GalleryMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [usedBytes, setUsedBytes] = useState(0);
  const [selectedYear, setSelectedYear] = useState(GALLERY_DEFAULT_YEAR);
  // ?sport=lawn-tennis (or a legacy ?event=tennis-tournament link) preselects a sport.
  const [selectedSport, setSelectedSport] = useState<SportFilter>(
    () =>
      sportFromParam(searchParams.get('sport')) ??
      sportFromGalleryEventId(searchParams.get('event')) ??
      ALL_SPORTS
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const allItems = [...uploadItems, ...staticItems];
  const items = allItems.filter(
    (item) =>
      item.year === selectedYear &&
      (selectedSport === ALL_SPORTS || sportFromGalleryEventId(item.eventId) === selectedSport)
  );
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

  // Close lightbox when switching year/event so indices stay in range.
  useEffect(() => {
    setActiveIndex(null);
  }, [selectedYear, selectedSport]);

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
    if (!isGallerySeasonYear(year)) return;
    setSelectedYear(year);
  };

  const handleFilesSelected = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list);

    setUploading(true);
    setUploadError(null);
    setUploadMessage(null);
    // Uploads are tagged with the sport id in the existing eventId field.
    const eventIdToSave = selectedSport === ALL_SPORTS ? undefined : selectedSport;
    const tag = galleryTagFromYear(selectedYear);

    let successCount = 0;
    const failures: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (files.length > 1) {
        setUploadMessage(`Uploading ${i + 1} of ${files.length}…`);
      }
      try {
        const record = await uploadGalleryMedia(file, tag, eventIdToSave);
        successCount++;
        setUploadItems((prev) => {
          const next: GalleryMediaItem = {
            id: record.id,
            src: record.url,
            file: record.fileName,
            kind: record.kind,
            title: record.title,
            year: record.year,
            tag: record.tag,
            ...(record.eventId ? { eventId: record.eventId } : {})
          };
          if (prev.some((p) => p.id === record.id)) return prev;
          return [next, ...prev];
        });
      } catch (err) {
        failures.push(`${file.name}: ${err instanceof Error ? err.message : 'Upload failed.'}`);
      }
    }

    if (successCount > 0 && failures.length === 0) {
      setUploadMessage(
        successCount === 1
          ? `Uploaded to ${selectedYear}. Thanks!`
          : `Uploaded all ${successCount} files to ${selectedYear}. Thanks!`
      );
    } else if (successCount > 0 && failures.length > 0) {
      setUploadMessage(`Uploaded ${successCount} of ${files.length}.`);
      setUploadError(failures.join(' · '));
    } else {
      setUploadMessage(null);
      setUploadError(failures.join(' · ') || 'Upload failed.');
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDeleteItem = async (item: GalleryMediaItem) => {
    if (!item.id || deletingId) return;
    const ok = window.confirm('Delete this photo? This cannot be undone.');
    if (!ok) return;

    setDeletingId(item.id);
    setDeleteError(null);
    try {
      await deleteGalleryUpload({
        id: item.id,
        storagePath: item.storagePath,
        byteSize: item.byteSize
      });
      // subscribeGalleryUploads' live listener will drop it from uploadItems automatically.
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this photo.');
    } finally {
      setDeletingId(null);
    }
  };

  const active = activeIndex !== null ? items[activeIndex] ?? null : null;

  return (
    <div className="space-y-5">
      <header className="space-y-3">
        <div className="space-y-1">
          <h1 className="portal-display text-3xl sm:text-4xl text-ink tracking-wide">
            Match photos
          </h1>
        </div>

        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Gallery season"
        >
          {GALLERY_SEASON_YEARS.map((year) => {
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
                    : 'rounded-lg border border-line bg-paper-soft px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600 hover:border-emerald-500/50 hover:text-ink'
                }
              >
                {year}
              </button>
            );
          })}
        </div>

        <p className="text-[11px] text-slate-500">
          {canUpload
            ? 'Pick the year above and a sport below — new uploads are tagged to both.'
            : 'Pick a year and sport to browse.'}
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex items-center gap-2 text-[11px] text-ink-soft">
            <span className="uppercase tracking-wide font-bold text-slate-500">Sport</span>
            <select
              value={selectedSport}
              onChange={(e) => setSelectedSport(sportFromParam(e.target.value) ?? ALL_SPORTS)}
              className="rounded-lg border border-line bg-white px-2.5 py-2 text-xs font-semibold text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
              aria-label="Filter photos by sport, and where new uploads are tagged"
            >
              <option value={ALL_SPORTS}>All sports</option>
              {PHOTO_SPORTS.map((card) => (
                <option key={card.sport} value={card.sport}>
                  {card.label}
                </option>
              ))}
            </select>
          </label>
          {canUpload ? (
            <>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            multiple
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
            {uploading ? 'Uploading…' : storageFull ? 'Storage full' : 'Upload photos or clips'}
          </button>
          <p className="text-[11px] text-slate-500">
            JPG / PNG / WebP / GIF · MP4 / WebM · shared 5 GB limit
            <span className="block sm:inline sm:before:content-['·_'] mt-0.5 sm:mt-0">
              Used {formatGalleryStorageLabel(usedBytes)}
            </span>
          </p>
            </>
          ) : (
            <p className="text-[11px] text-slate-500">
              Enter the community access code to add photos.
            </p>
          )}
        </div>

        {uploadError ? (
          <p className="text-sm text-amber-700 font-medium" role="alert">
            {uploadError}
          </p>
        ) : null}
        {uploadMessage ? (
          <p className="text-sm text-emerald-700 font-medium" role="status">
            {uploadMessage}
          </p>
        ) : null}
        {deleteError ? (
          <p className="text-sm text-amber-700 font-medium" role="alert">
            {deleteError}
          </p>
        ) : null}
      </header>

      {loading && allItems.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          <span className="text-sm font-medium">Loading gallery…</span>
        </div>
      ) : null}

      {!loading && error && allItems.length === 0 ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-5">
          <p className="text-sm text-amber-800 font-medium">{error}</p>
          <p className="text-xs text-amber-700/80 mt-2">
            {canUpload ? 'You can still upload a photo above.' : 'Please try again in a moment.'}
          </p>
        </div>
      ) : null}

      {!loading && items.length === 0 && !error ? (
        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-line bg-paper-soft">
          No photos for npl-{selectedYear} yet — pick that tag and upload, or add files under{' '}
          <code className="text-ink-soft">public/Gallery/{selectedYear}</code>.
        </p>
      ) : null}

      {!loading && items.length === 0 && error && allItems.length > 0 ? (
        <p className="text-sm text-slate-500 text-center py-12 rounded-2xl border border-line bg-paper-soft">
          No photos for npl-{selectedYear} yet.
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
          {items.map((item, index) => (
            <li key={item.id ?? `static:${item.year}:${item.file}`} className="relative">
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                className="group relative w-full aspect-square overflow-hidden rounded-xl border border-line bg-paper-soft text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
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
              {(admin || (deviceId && item.uploaderUid === deviceId)) ? (
                <button
                  type="button"
                  disabled={deletingId === item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeleteItem(item);
                  }}
                  aria-label="Delete this photo"
                  className="absolute top-1.5 right-1.5 z-10 inline-flex items-center justify-center size-7 rounded-full bg-black/60 text-white hover:bg-rose-600 disabled:opacity-50 transition-colors"
                >
                  {deletingId === item.id ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                  ) : (
                    <Trash2 className="size-3.5" aria-hidden />
                  )}
                </button>
              ) : null}
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
            {active.uploaderName ? ` · Uploaded by ${active.uploaderName}` : ''}
          </p>
        </div>
      ) : null}
    </div>
  );
}
