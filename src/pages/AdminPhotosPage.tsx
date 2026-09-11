import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, Loader2, Play, Trash2 } from 'lucide-react';
import { AdminNav } from '../components/AdminNav';
import {
  deleteGalleryUpload,
  formatGalleryStorageLabel,
  subscribeGalleryStorageUsage,
  subscribeGalleryUploads,
  type GalleryUploadRecord
} from '../utils/galleryUploads';

/**
 * Admin gallery manager — list and delete community uploads (R2 + RTDB).
 * Static files under public/Gallery are not deletable here (repo-managed).
 *
 * Concurrency: RTDB listeners; delete is last-write-wins per upload id.
 * Security: staff UI by URL only (same as other admin pages); path validated before delete.
 * Input: confirmed delete of a subscribed GalleryUploadRecord.
 */
export default function AdminPhotosPage() {
  const [uploads, setUploads] = useState<GalleryUploadRecord[]>([]);
  const [usedBytes, setUsedBytes] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    const unsub = subscribeGalleryUploads(
      (records) => {
        const sorted = [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        setUploads(sorted);
        setLoadError(null);
      },
      (err) => {
        console.error(err);
        setLoadError(err.message || 'Failed to load gallery uploads.');
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

  const handleDelete = async (record: GalleryUploadRecord) => {
    if (!record || typeof record.id !== 'string' || !record.id.trim()) {
      setActionError('Cannot delete: missing upload id.');
      return;
    }
    if (deletingIds.size > 0) return;

    const label = record.title || record.fileName || record.id;
    const ok = window.confirm(
      `Delete this gallery upload?\n\n${label}\n${record.tag}\n\nRemoves it from Photos and frees storage quota.`
    );
    if (!ok) return;

    setDeletingIds(new Set([record.id]));
    setActionError(null);
    setActionMessage(null);
    try {
      await deleteGalleryUpload(record);
      setActionMessage(`Deleted “${label}”.`);
      setSelectedIds((prev) => {
        if (!prev.has(record.id)) return prev;
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
    } catch (err) {
      console.error('Gallery delete failed:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to delete photo.');
    } finally {
      setDeletingIds(new Set());
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.size === uploads.length ? new Set() : new Set(uploads.map((u) => u.id))));
  };

  const handleBulkDelete = async () => {
    if (deletingIds.size > 0 || selectedIds.size === 0) return;
    const targets = uploads.filter((u) => selectedIds.has(u.id));
    if (targets.length === 0) return;

    const ok = window.confirm(
      `Delete ${targets.length} selected upload${targets.length === 1 ? '' : 's'}?\n\nRemoves them from Photos and frees storage quota.`
    );
    if (!ok) return;

    setDeletingIds(new Set(targets.map((t) => t.id)));
    setBulkDeleting(true);
    setActionError(null);
    setActionMessage(null);

    let successCount = 0;
    const failures: string[] = [];
    for (const record of targets) {
      try {
        await deleteGalleryUpload(record);
        successCount++;
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(record.id);
          return next;
        });
      } catch (err) {
        failures.push(
          `${record.title || record.fileName || record.id}: ${err instanceof Error ? err.message : 'Failed.'}`
        );
      }
    }

    if (successCount > 0 && failures.length === 0) {
      setActionMessage(`Deleted ${successCount} upload${successCount === 1 ? '' : 's'}.`);
    } else if (successCount > 0) {
      setActionMessage(`Deleted ${successCount} of ${targets.length}.`);
      setActionError(failures.join(' · '));
    } else {
      setActionError(failures.join(' · ') || 'Bulk delete failed.');
    }

    setDeletingIds(new Set());
    setBulkDeleting(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-8 font-sans space-y-8 max-w-7xl mx-auto">
      <AdminNav subtitle="Photos" />

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-indigo-300 inline-flex items-center gap-2">
              <Camera className="size-5" aria-hidden />
              Community uploads
            </h1>
            <span className="text-xs text-slate-400 font-mono">{uploads.length} files</span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
            <span>Used {formatGalleryStorageLabel(usedBytes)}</span>
            <Link
              to="/photos"
              className="font-bold uppercase tracking-wide text-emerald-400 hover:text-emerald-300"
            >
              Open public Photos
            </Link>
          </div>
        </div>

        <p className="text-xs text-slate-500">
          Delete removes the upload from the public gallery and R2 storage. Curated files in{' '}
          <code className="text-slate-400">public/Gallery</code> are managed in the repo, not here.
        </p>

        {loadError ? (
          <p className="text-[11px] text-red-400" role="alert">
            {loadError}
          </p>
        ) : null}
        {actionError ? (
          <p className="text-[11px] text-amber-300" role="alert">
            {actionError}
          </p>
        ) : null}
        {actionMessage ? (
          <p className="text-[11px] text-emerald-400" role="status">
            {actionMessage}
          </p>
        ) : null}

        {uploads.length === 0 && !loadError ? (
          <p className="text-sm text-slate-500 text-center py-10">
            No community uploads yet. Visitors can add files from{' '}
            <Link to="/photos" className="text-emerald-400 hover:text-emerald-300">
              /photos
            </Link>
            .
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-3 text-[11px]">
              <label className="inline-flex items-center gap-1.5 text-slate-400 font-semibold">
                <input
                  type="checkbox"
                  checked={uploads.length > 0 && selectedIds.size === uploads.length}
                  ref={(el) => {
                    if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < uploads.length;
                  }}
                  onChange={toggleSelectAll}
                  disabled={deletingIds.size > 0}
                  className="size-3.5 accent-emerald-500"
                />
                Select all
              </label>
              {selectedIds.size > 0 ? (
                <>
                  <span className="text-slate-500">{selectedIds.size} selected</span>
                  <button
                    type="button"
                    onClick={() => void handleBulkDelete()}
                    disabled={deletingIds.size > 0}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-950/50 text-red-300 border border-red-500/40 px-3 py-1.5 font-bold uppercase tracking-wide hover:bg-red-900/70 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {bulkDeleting ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="size-3.5" aria-hidden />
                    )}
                    {bulkDeleting ? 'Deleting…' : `Delete ${selectedIds.size} selected`}
                  </button>
                </>
              ) : null}
            </div>

            <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {uploads.map((item) => {
                const busy = deletingIds.has(item.id);
                const selected = selectedIds.has(item.id);
                return (
                  <li
                    key={item.id}
                    className={`overflow-hidden rounded-xl border bg-slate-950 flex flex-col ${
                      selected ? 'border-emerald-500/70 ring-1 ring-emerald-500/40' : 'border-slate-800'
                    }`}
                  >
                    <div className="relative aspect-square bg-slate-900">
                      <label className="absolute top-2 left-2 z-10 inline-flex items-center justify-center rounded-md bg-slate-950/70 p-1">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelected(item.id)}
                          disabled={deletingIds.size > 0}
                          aria-label={`Select ${item.title || item.fileName}`}
                          className="size-4 accent-emerald-500"
                        />
                      </label>
                      {item.kind === 'image' ? (
                      <img
                        src={item.url}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                        draggable={false}
                      />
                    ) : (
                      <>
                        <video
                          src={item.url}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                          aria-hidden
                        />
                        <span className="absolute inset-0 flex items-center justify-center bg-black/35 pointer-events-none">
                          <span className="inline-flex size-10 items-center justify-center rounded-full bg-emerald-500 text-slate-950">
                            <Play className="size-5 fill-current ml-0.5" aria-hidden />
                          </span>
                        </span>
                      </>
                    )}
                  </div>
                  <div className="p-2.5 space-y-2 flex-1 flex flex-col">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-100 font-medium truncate" title={item.title}>
                        {item.title || item.fileName}
                      </p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {item.tag} · {item.kind}
                      </p>
                      <p className="text-[10px] text-slate-600 font-mono">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={deletingIds.size > 0}
                      onClick={() => void handleDelete(item)}
                      className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-red-950/50 text-red-300 border border-red-500/40 px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide hover:bg-red-900/70 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy ? (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      ) : (
                        <Trash2 className="size-3.5" aria-hidden />
                      )}
                      {busy ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                </li>
              );
            })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
