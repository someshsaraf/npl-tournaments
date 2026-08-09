import {
  onValue,
  push,
  ref,
  runTransaction,
  set,
  type Unsubscribe
} from 'firebase/database';
import { getDownloadURL, ref as storageRef, uploadBytes } from 'firebase/storage';
import {
  db,
  GALLERY_TOTAL_BYTES_PATH,
  GALLERY_UPLOADS_PATH,
  storage
} from '../firebase';
import type { GalleryMediaItem, GalleryMediaKind } from './matchGallery';

/** Images up to 8MB; short clips up to 40MB. */
export const GALLERY_MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const GALLERY_MAX_VIDEO_BYTES = 40 * 1024 * 1024;
/** Hard cap for all community gallery uploads combined. */
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

/**
 * True for HTTPS Firebase Storage / Google download URLs only.
 * Concurrency: pure; Security: rejects non-https and unexpected hosts.
 */
export function isSafeGalleryDownloadUrl(value: unknown): value is string {
  if (typeof value !== 'string' || !value.trim()) return false;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  return (
    host === 'firebasestorage.googleapis.com' ||
    host.endsWith('.firebasestorage.app') ||
    host.endsWith('.googleapis.com') ||
    host.endsWith('.googleusercontent.com')
  );
}

function sanitizeTitle(name: string): string {
  const base = name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  const clipped = base.slice(0, 80);
  return clipped || 'Upload';
}

function sanitizeFileStem(name: string): string {
  const stem = name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 48);
  return stem || 'photo';
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

  const max = kind === 'image' ? GALLERY_MAX_IMAGE_BYTES : GALLERY_MAX_VIDEO_BYTES;
  if (!Number.isFinite(file.size) || file.size <= 0) {
    throw new Error('File is empty.');
  }
  if (file.size > max) {
    const mb = Math.round(max / (1024 * 1024));
    throw new Error(
      kind === 'image' ? `Image too large (max ${mb}MB).` : `Video too large (max ${mb}MB).`
    );
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
 * Security: only accepts HTTPS Firebase download URLs + gallery/ paths.
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

/**
 * Atomically reserve `bytes` against the 5 GB gallery quota.
 * Returns false / aborts when the reservation would exceed the cap.
 */
async function reserveGalleryBytes(bytes: number): Promise<void> {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    throw new Error('reserveGalleryBytes: positive byte count required');
  }
  const amount = Math.floor(bytes);
  const result = await runTransaction(ref(db, GALLERY_TOTAL_BYTES_PATH), (current) => {
    const used = normalizeUsedBytes(current);
    if (used + amount > GALLERY_MAX_TOTAL_BYTES) {
      return; // abort transaction
    }
    return used + amount;
  });
  if (!result.committed) {
    throw new Error('Gallery storage is full (5 GB limit).');
  }
}

/** Release previously reserved bytes (e.g. after a failed Storage upload). */
async function releaseGalleryBytes(bytes: number): Promise<void> {
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  const amount = Math.floor(bytes);
  await runTransaction(ref(db, GALLERY_TOTAL_BYTES_PATH), (current) => {
    const used = normalizeUsedBytes(current);
    return Math.max(0, used - amount);
  });
}

/**
 * Upload a gallery file to Storage and register metadata in RTDB.
 * Reserves quota first (atomic), then uploads; rolls back quota on failure.
 *
 * Concurrency: RTDB transaction serializes the 5 GB counter across clients.
 * Security: MIME/size validated; path is push-id based (not user-controlled).
 * Tradeoff: open public write requires Storage + RTDB rules (see storage.rules).
 */
export async function uploadGalleryMedia(fileInput: unknown): Promise<GalleryUploadRecord> {
  const { file, kind, contentType, ext } = validateGalleryUploadFile(fileInput);
  const byteSize = Math.floor(file.size);

  await reserveGalleryBytes(byteSize);

  const metaRef = push(ref(db, GALLERY_UPLOADS_PATH));
  const id = metaRef.key;
  if (!id) {
    await releaseGalleryBytes(byteSize);
    throw new Error('Could not allocate upload id. Try again.');
  }

  const stem = sanitizeFileStem(file.name);
  const fileName = `${stem}${ext}`;
  const storagePath = `gallery/${id}/${fileName}`;
  const objectRef = storageRef(storage, storagePath);

  try {
    await uploadBytes(objectRef, file, {
      contentType,
      customMetadata: {
        kind,
        originalName: file.name.slice(0, 120),
        byteSize: String(byteSize)
      }
    });

    const url = await getDownloadURL(objectRef);
    if (!isSafeGalleryDownloadUrl(url)) {
      throw new Error('Upload succeeded but returned an unexpected URL.');
    }

    const record: GalleryUploadRecord = {
      id,
      url,
      kind,
      title: sanitizeTitle(file.name),
      fileName,
      contentType,
      storagePath,
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
