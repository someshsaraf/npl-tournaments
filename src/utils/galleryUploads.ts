import {
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  set,
  type Unsubscribe
} from 'firebase/database';
import {
  deleteObject,
  getDownloadURL,
  ref as storageRef,
  uploadBytes
} from 'firebase/storage';
import { db, storage, GALLERY_TOTAL_BYTES_PATH, GALLERY_UPLOADS_PATH } from '../firebase';
import {
  GALLERY_DEFAULT_YEAR,
  galleryTagFromYear,
  isGallerySeasonYear,
  isGalleryYearTag,
  parseGalleryYearTag,
  yearFromGalleryTag,
  type GalleryMediaItem,
  type GalleryMediaKind,
  type GalleryYearTag
} from './matchGallery';

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
  /** Season tag chosen at upload (npl-2023 … npl-2026). */
  tag: GalleryYearTag;
  /** Season year derived from tag (for year tabs). */
  year: number;
  /** Community event id chosen at upload time, if any. */
  eventId?: string;
};

/**
 * True for Firebase Storage download URLs only.
 * Concurrency: pure; Security: https-only, allowlisted Firebase/Google hosts.
 * Also accepts r2.dev — the small batch of uploads made during the brief R2 era
 * (before this reverted to Firebase Storage) still needs to keep displaying.
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
  const host = parsed.hostname.toLowerCase();
  return (
    host === 'firebasestorage.googleapis.com' ||
    host.endsWith('.firebasestorage.app') ||
    host.endsWith('.googleapis.com') ||
    host.endsWith('.googleusercontent.com') ||
    host.endsWith('.r2.dev')
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

function yearFromCreatedAt(createdAt: string, fallback: number): number {
  if (typeof createdAt !== 'string' || !createdAt.trim()) return fallback;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return fallback;
  const y = d.getFullYear();
  return isGallerySeasonYear(y) ? y : fallback;
}

/**
 * Resolve season tag + year from RTDB row (tag preferred, then year, then createdAt).
 * Input: untrusted RTDB fields; output always allowlisted.
 */
function resolveUploadSeason(row: {
  tag?: unknown;
  year?: unknown;
  createdAt: string;
}): { tag: GalleryYearTag; year: number } {
  if (isGalleryYearTag(row.tag) || (typeof row.tag === 'string' && row.tag.trim())) {
    try {
      const tag = parseGalleryYearTag(row.tag);
      return { tag, year: yearFromGalleryTag(tag) };
    } catch {
      // fall through
    }
  }
  if (isGallerySeasonYear(row.year)) {
    return { tag: galleryTagFromYear(row.year), year: row.year };
  }
  const year = yearFromCreatedAt(row.createdAt, GALLERY_DEFAULT_YEAR);
  const safeYear = isGallerySeasonYear(year) ? year : GALLERY_DEFAULT_YEAR;
  return { tag: galleryTagFromYear(safeYear), year: safeYear };
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
  const { tag, year } = resolveUploadSeason({
    tag: row.tag,
    year: row.year,
    createdAt
  });
  const eventId =
    typeof row.eventId === 'string' && row.eventId.trim() ? row.eventId.trim().slice(0, 80) : undefined;

  return {
    id,
    url: row.url.trim(),
    kind: row.kind,
    title,
    fileName: row.fileName.trim().slice(0, 120),
    contentType: row.contentType.trim().slice(0, 80),
    storagePath: row.storagePath.trim(),
    createdAt,
    byteSize,
    tag,
    year,
    ...(eventId ? { eventId } : {})
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
    title: r.title,
    year: r.year,
    tag: r.tag,
    ...(r.eventId ? { eventId: r.eventId } : {})
  }));
}

/**
 * Live list of community gallery uploads from RTDB.
 * Concurrency: one listener per subscribe call; caller must unsubscribe.
 * Security: only accepts Firebase Storage download URLs + gallery/ paths.
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

/**
 * Upload a gallery file to Firebase Storage and register metadata in RTDB.
 * Reserves quota first (atomic); rolls back quota on failure.
 *
 * Concurrency: RTDB transaction serializes the 5 GB counter across clients.
 * Security: MIME validated; shared 5 GB RTDB quota; object paths are push-id based
 * (not user-controlled); Storage rules (storage.rules) gate the actual write.
 */
export async function uploadGalleryMedia(
  fileInput: unknown,
  tagInput: unknown = GALLERY_DEFAULT_YEAR,
  eventIdInput?: unknown
): Promise<GalleryUploadRecord> {
  const tag = parseGalleryYearTag(tagInput);
  const year = yearFromGalleryTag(tag);
  const { file, kind, contentType, ext } = validateGalleryUploadFile(fileInput);
  const byteSize = Math.floor(file.size);
  const eventId =
    typeof eventIdInput === 'string' && eventIdInput.trim() ? eventIdInput.trim().slice(0, 80) : undefined;

  await reserveGalleryBytes(byteSize);

  try {
    const metaRef = push(ref(db, GALLERY_UPLOADS_PATH));
    const rtdbId = metaRef.key;
    if (!rtdbId) {
      throw new Error('Could not allocate gallery metadata id. Try again.');
    }

    const stem = sanitizeFileStem(file.name);
    const fileName = `${stem}${ext}`;
    const storagePath = `gallery/${rtdbId}/${fileName}`;
    const objectRef = storageRef(storage, storagePath);

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

    const createdAt = new Date().toISOString();
    const record: GalleryUploadRecord = {
      id: rtdbId,
      url,
      kind,
      title: sanitizeTitle(file.name),
      fileName,
      contentType,
      storagePath,
      createdAt,
      byteSize,
      tag,
      year,
      ...(eventId ? { eventId } : {})
    };

    await set(metaRef, {
      url: record.url,
      kind: record.kind,
      title: record.title,
      fileName: record.fileName,
      contentType: record.contentType,
      storagePath: record.storagePath,
      createdAt: record.createdAt,
      byteSize: record.byteSize,
      tag: record.tag,
      year: record.year,
      ...(eventId ? { eventId } : {})
    });

    return record;
  } catch (err) {
    await releaseGalleryBytes(byteSize);
    throw err instanceof Error ? err : new Error('Upload failed.');
  }
}

const UPLOAD_ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;

/**
 * Delete a community gallery upload (admin).
 * Removes RTDB metadata, releases quota bytes, then deletes the Storage object.
 *
 * Concurrency: RTDB remove is atomic per key; quota uses a transaction.
 * Security: validates id + gallery/ storagePath before touching Storage.
 * Input: GalleryUploadRecord (or equivalent fields); fails fast on bad values.
 */
export async function deleteGalleryUpload(recordInput: unknown): Promise<void> {
  if (!recordInput || typeof recordInput !== 'object' || Array.isArray(recordInput)) {
    throw new Error('deleteGalleryUpload: upload record required');
  }
  const row = recordInput as Partial<GalleryUploadRecord>;
  if (typeof row.id !== 'string' || !UPLOAD_ID_RE.test(row.id.trim())) {
    throw new Error('Invalid upload id.');
  }
  const id = row.id.trim();
  if (
    typeof row.storagePath !== 'string' ||
    !row.storagePath.startsWith('gallery/') ||
    row.storagePath.includes('..')
  ) {
    throw new Error('Invalid storage path on upload record.');
  }
  const storagePath = row.storagePath.trim();
  const byteSize = normalizeUsedBytes(row.byteSize);

  await remove(ref(db, `${GALLERY_UPLOADS_PATH}/${id}`));
  await releaseGalleryBytes(byteSize);

  try {
    await deleteObject(storageRef(storage, storagePath));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`File removed from gallery, but Storage cleanup failed: ${message}`);
  }
}
