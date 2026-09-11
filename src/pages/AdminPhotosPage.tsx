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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    if (deletingId) return;

    const label = record.title || record.fileName || record.id;
    const ok = window.confirm(
      `Delete this gallery upload?\n\n${label}\n${record.tag}\n\nRemoves it from Photos and frees storage quota.`
    );
    if (!ok) return;

    setDeletingId(record.id);
    setActionError(null);
    setActionMessage(null);
    try {
      await deleteGalleryUpload(record);
      setActionMessage(`Deleted “${label}”.`);
    } catch (err) {
      console.error('Gallery delete failed:', err);
      setActionError(err instanceof Error ? err.message : 'Failed to delete photo.');
    } finally {
      setDeletingId(null);
    }
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
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {uploads.map((item) => {
              const busy = deletingId === item.id;
              return (
                <li
                  key={item.id}
                  className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 flex flex-col"
                >
                  <div className="relative aspect-square bg-slate-900">
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
                      disabled={busy || Boolean(deletingId)}
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
        )}
      </div>
    </div>
  );
}
