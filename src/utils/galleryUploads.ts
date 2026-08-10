import {
  onValue,
  push,
  ref,
  runTransaction,
  set,
  type Unsubscribe
} from 'firebase/database';
import { db, GALLERY_TOTAL_BYTES_PATH, GALLERY_UPLOADS_PATH } from '../firebase';
import type { GalleryMediaItem, GalleryMediaKind } from './matchGallery';

/** Hard cap for all community gallery uploads combined (no per-file size limit). */
export const GALLERY_MAX_TOTAL_BYTES = 5 * 1024 * 1024 * 1024;

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm']);

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm'
};

export type GalleryUploadRecord = {
  id: string;
  url: string;
  kind: GalleryMediaKind;
  title: string;
  fileName: string;
  contentType: string;
  storagePath: string;
  createdAt: string;
  /** File size in bytes (for quota accounting). */
  byteSize: number;
};

type PresignResponse = {
  id: string;
  uploadUrl: string;
  publicUrl: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  kind: GalleryMediaKind;
  byteSize: number;
};

/**
 * True for HTTPS media URLs (R2 public URL / CDN). Rejects non-https.
 * Concurrency: pure; Security: https-only, no credentials in URL.
 */
export function isSafeGalleryDownloadUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim() || value.length > 2000) return false;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  return true;
}

function sanitizeTitle(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  const clipped = base.slice(0, 80);
  return clipped || 'Upload';
}

function normalizeUsedBytes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

/** Human-readable storage usage, e.g. "1.2 GB / 5 GB". */
export function formatGalleryStorageLabel(usedBytes: number): string {
  const used = normalizeUsedBytes(usedBytes);
  const maxGb = GALLERY_MAX_TOTAL_BYTES / (1024 * 1024 * 1024);
  const usedGb = used / (1024 * 1024 * 1024);
  if (usedGb < 0.1) {
    const usedMb = used / (1024 * 1024);
    return `${usedMb.toFixed(1)} MB / ${maxGb} GB`;
  }
  return `${usedGb.toFixed(2)} GB / ${maxGb} GB`;
}

/**
 * Validate a browser File for gallery upload.
 * Fails fast with a clear message for UI display.
 */
export function validateGalleryUploadFile(file: unknown): {
  file: File;
  kind: GalleryMediaKind;
  contentType: string;
  ext: string;
} {
  if (!(file instanceof File)) {
    throw new Error('Choose a photo or short video to upload.');
  }
  const contentType = (file.type || '').toLowerCase().trim();
  if (!contentType) {
    throw new Error('Unknown file type. Use JPG, PNG, WebP, GIF, MP4, or WebM.');
  }

  let kind: GalleryMediaKind | null = null;
  if (IMAGE_MIME.has(contentType)) kind = 'image';
  else if (VIDEO_MIME.has(contentType)) kind = 'video';
  if (!kind) {
    throw new Error('Unsupported type. Allowed: JPG, PNG, WebP, GIF, MP4, WebM.');
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error('File is empty.');
  }
  // No per-file cap — only the shared 5 GB gallery quota applies (checked on reserve).
  if (file.size > GALLERY_MAX_TOTAL_BYTES) {
    throw new Error('File is larger than the 5 GB gallery storage limit.');
  }

  const ext = EXT_BY_MIME[contentType];
  if (!ext) throw new Error('Unsupported file extension.');

  return { file, kind, contentType, ext };
}

function parseUploadRecord(id: string, raw: unknown): GalleryUploadRecord | null {
  if (!id || typeof id !== 'string') return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  if (!isSafeGalleryDownloadUrl(row.url)) return null;
  if (row.kind !== 'image' && row.kind !== 'video') return null;
  if (typeof row.fileName !== 'string' || !row.fileName.trim()) return null;
  if (typeof row.contentType !== 'string' || !row.contentType.trim()) return null;
  if (typeof row.storagePath !== 'string' || !row.storagePath.startsWith('gallery/')) {
    return null;
  }
  if (row.storagePath.includes('..')) return null;
  const title =
    typeof row.title === 'string' && row.title.trim()
      ? row.title.trim().slice(0, 80)
      : sanitizeTitle(row.fileName);
  const createdAt =
    typeof row.createdAt === 'string' && row.createdAt.trim()
      ? row.createdAt.trim()
      : new Date(0).toISOString();
  const byteSize = normalizeUsedBytes(row.byteSize);

  return {
    id,
    url: row.url.trim(),
    kind: row.kind,
    title,
    fileName: row.fileName.trim().slice(0, 120),
    contentType: row.contentType.trim().slice(0, 80),
    storagePath: row.storagePath.trim(),
    createdAt,
    byteSize
  };
}

/** Map validated upload records to gallery grid items (newest first). */
export function uploadsToGalleryItems(records: GalleryUploadRecord[]): GalleryMediaItem[] {
  const sorted = [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return sorted.map((r) => ({
    id: r.id,
    src: r.url,
    file: r.fileName,
    kind: r.kind,
    title: r.title
  }));
}

/**
 * Live list of community gallery uploads from RTDB.
 * Concurrency: one listener per subscribe call; caller must unsubscribe.
 * Security: only accepts https URLs + gallery/ paths.
 */
export function subscribeGalleryUploads(
  onChange: (items: GalleryUploadRecord[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (typeof onChange !== 'function') {
    throw new Error('subscribeGalleryUploads: onChange required');
  }
  const listRef = ref(db, GALLERY_UPLOADS_PATH);
  return onValue(
    listRef,
    (snap) => {
      const val = snap.val();
      const out: GalleryUploadRecord[] = [];
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const [id, row] of Object.entries(val as Record<string, unknown>)) {
          const parsed = parseUploadRecord(id, row);
          if (parsed) out.push(parsed);
        }
      }
      onChange(out);
    },
    (err) => {
      console.error('galleryUploads listen failed:', err);
      onError?.(err instanceof Error ? err : new Error('Failed to load uploads.'));
    }
  );
}

/**
 * Live community gallery byte usage (for the 5 GB cap UI).
 * Concurrency: one listener; cleaned up by returned unsubscribe.
 */
export function subscribeGalleryStorageUsage(
  onChange: (usedBytes: number) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (typeof onChange !== 'function') {
    throw new Error('subscribeGalleryStorageUsage: onChange required');
  }
  const usageRef = ref(db, GALLERY_TOTAL_BYTES_PATH);
  return onValue(
    usageRef,
    (snap) => {
      onChange(normalizeUsedBytes(snap.val()));
    },
    (err) => {
      console.error('gallery storage usage listen failed:', err);
      onError?.(err instanceof Error ? err : new Error('Failed to load storage usage.'));
    }
  );
}

async function reserveGalleryBytes(bytes: number): Promise<void> {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new Error('reserveGalleryBytes: positive byte count required');
  }
  const amount = Math.floor(bytes);
  const result = await runTransaction(ref(db, GALLERY_TOTAL_BYTES_PATH), (current) => {
    const used = normalizeUsedBytes(current);
    if (used + amount > GALLERY_MAX_TOTAL_BYTES) {
      return;
    }
    return used + amount;
  });
  if (!result.committed) {
    throw new Error(
      'This file would exceed the 5 GB gallery limit (all uploads combined).'
    );
  }
}

async function releaseGalleryBytes(bytes: number): Promise<void> {
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  const amount = Math.floor(bytes);
  await runTransaction(ref(db, GALLERY_TOTAL_BYTES_PATH), (current) => {
    const used = normalizeUsedBytes(current);
    return Math.max(0, used - amount);
  });
}

async function requestR2Presign(input: {
  contentType: string;
  byteSize: number;
  fileName: string;
}): Promise<PresignResponse> {
  const res = await fetch('/api/gallery-upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      contentType: input.contentType,
      byteSize: input.byteSize,
      fileName: input.fileName
    })
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  const errMsg =
    payload &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    typeof (payload as { error?: unknown }).error === 'string'
      ? (payload as { error: string }).error
      : `Upload setup failed (${res.status}).`;

  if (!res.ok) {
    throw new Error(errMsg);
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Invalid upload URL response.');
  }
  const row = payload as Record<string, unknown>;
  if (
    typeof row.id !== 'string' ||
    typeof row.uploadUrl !== 'string' ||
    typeof row.publicUrl !== 'string' ||
    typeof row.storagePath !== 'string' ||
    typeof row.fileName !== 'string' ||
    typeof row.contentType !== 'string' ||
    (row.kind !== 'image' && row.kind !== 'video') ||
    typeof row.byteSize !== 'number'
  ) {
    throw new Error('Invalid upload URL response.');
  }
  if (!row.uploadUrl.startsWith('https://')) {
    throw new Error('Invalid presigned upload URL.');
  }
  if (!isSafeGalleryDownloadUrl(row.publicUrl)) {
    throw new Error('Invalid public media URL from server.');
  }
  if (!row.storagePath.startsWith('gallery/') || row.storagePath.includes('..')) {
    throw new Error('Invalid storage path from server.');
  }

  return {
    id: row.id,
    uploadUrl: row.uploadUrl,
    publicUrl: row.publicUrl.trim(),
    storagePath: row.storagePath,
    fileName: row.fileName,
    contentType: row.contentType,
    kind: row.kind,
    byteSize: Math.floor(row.byteSize)
  };
}

/**
 * Upload a gallery file to Cloudflare R2 (presigned PUT) and register metadata in RTDB.
 * Reserves quota first (atomic); rolls back quota on failure.
 *
 * Concurrency: RTDB transaction serializes the 5 GB counter across clients.
 * Security: MIME validated client+server; no per-file size cap; shared 5 GB RTDB
 * quota; R2 secrets stay on Vercel; object keys are UUID-based.
 * Local: use `npx vercel dev` so /api/gallery-upload-url is available.
 */
export async function uploadGalleryMedia(fileInput: unknown): Promise<GalleryUploadRecord> {
  const { file, kind, contentType } = validateGalleryUploadFile(fileInput);
  const byteSize = Math.floor(file.size);

  await reserveGalleryBytes(byteSize);

  try {
    const presign = await requestR2Presign({
      contentType,
      byteSize,
      fileName: file.name || `photo${EXT_BY_MIME[contentType] ?? '.jpg'}`
    });

    const putRes = await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file
    });
    if (!putRes.ok) {
      throw new Error(
        putRes.status === 403
          ? 'R2 rejected the upload (check bucket CORS allows PUT from this site).'
          : `R2 upload failed (${putRes.status}).`
      );
    }

    const metaRef = push(ref(db, GALLERY_UPLOADS_PATH));
    const rtdbId = metaRef.key;
    if (!rtdbId) {
      throw new Error('Could not allocate gallery metadata id. Try again.');
    }

    const record: GalleryUploadRecord = {
      id: rtdbId,
      url: presign.publicUrl,
      kind: presign.kind || kind,
      title: sanitizeTitle(file.name),
      fileName: presign.fileName,
      contentType: presign.contentType,
      storagePath: presign.storagePath,
      createdAt: new Date().toISOString(),
      byteSize
    };

    await set(metaRef, {
      url: record.url,
      kind: record.kind,
      title: record.title,
      fileName: record.fileName,
      contentType: record.contentType,
      storagePath: record.storagePath,
      createdAt: record.createdAt,
      byteSize: record.byteSize
    });

    return record;
  } catch (err) {
    await releaseGalleryBytes(byteSize);
    throw err instanceof Error ? err : new Error('Upload failed.');
  }
}
