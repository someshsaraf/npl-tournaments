import {
  onValue,
  ref,
  remove,
  set,
  type Unsubscribe
} from 'firebase/database';
import { db, GALLERY_EMOJI_PATH } from '../firebase';
import type { GalleryMediaItem } from './matchGallery';

/** Allowlisted reaction emojis: thumbs up, heart, fire, smiley, badminton. */
export const GALLERY_EMOJI_OPTIONS = ['👍', '❤️', '🔥', '😊', '🏸'] as const;

export type GalleryEmoji = (typeof GALLERY_EMOJI_OPTIONS)[number];

const VISITOR_STORAGE_KEY = 'npl-gallery-visitor-id';
const VISITOR_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
/** RTDB path segment for a photo (community id or static s-year-file key). */
const PHOTO_KEY_RE = /^[a-zA-Z0-9_-]{8,80}$/;

export type GalleryEmojiCounts = {
  /** Emoji → how many visitors attached it. */
  counts: Partial<Record<GalleryEmoji, number>>;
  /** This visitor's attached emoji, if any. */
  mine: GalleryEmoji | null;
};

/**
 * True if value is an allowlisted gallery emoji.
 * Concurrency: pure; Security: closed allowlist only.
 */
export function isGalleryEmoji(value: unknown): value is GalleryEmoji {
  return (
    typeof value === 'string' &&
    (GALLERY_EMOJI_OPTIONS as readonly string[]).includes(value)
  );
}

/**
 * Validate photo key used as RTDB path segment.
 * Fails closed on empty / unsafe characters.
 */
export function parseGalleryPhotoKey(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Photo key is required to attach an emoji.');
  }
  const id = value.trim();
  if (!PHOTO_KEY_RE.test(id)) {
    throw new Error('Invalid photo key for emoji.');
  }
  return id;
}

/** @deprecated Use parseGalleryPhotoKey */
export const parseGalleryUploadId = parseGalleryPhotoKey;

/**
 * Stable RTDB key for any gallery item (community upload or curated static file).
 * Input: gallery item with id and/or year+file; output is path-safe.
 */
export function galleryPhotoEmojiKey(item: unknown): string {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new Error('galleryPhotoEmojiKey: gallery item required');
  }
  const row = item as Partial<GalleryMediaItem>;
  if (typeof row.id === 'string' && row.id.trim()) {
    return parseGalleryPhotoKey(row.id.trim());
  }
  if (
    typeof row.year !== 'number' ||
    !Number.isInteger(row.year) ||
    row.year < 2000 ||
    row.year > 2100
  ) {
    throw new Error('galleryPhotoEmojiKey: valid year required for static photo');
  }
  if (typeof row.file !== 'string' || !row.file.trim()) {
    throw new Error('galleryPhotoEmojiKey: file name required for static photo');
  }
  const safeFile = row.file
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60);
  if (!safeFile) {
    throw new Error('galleryPhotoEmojiKey: file name produced empty key');
  }
  const key = `s-${row.year}-${safeFile}`;
  return parseGalleryPhotoKey(key);
}

/**
 * Stable per-browser visitor id (localStorage) for emoji ownership.
 * Input validation: only [a-zA-Z0-9_-]{8,64} so path injection is impossible.
 * Concurrency: localStorage is per-origin; id creation is idempotent enough for toggles.
 */
export function getOrCreateGalleryVisitorId(): string | null {
  try {
    const existing = localStorage.getItem(VISITOR_STORAGE_KEY);
    if (typeof existing === 'string' && VISITOR_ID_RE.test(existing)) {
      return existing;
    }
    const raw =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '')
        : `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    const id = raw.slice(0, 64);
    if (!VISITOR_ID_RE.test(id)) return null;
    localStorage.setItem(VISITOR_STORAGE_KEY, id);
    return id;
  } catch {
    return null;
  }
}

function emptyCounts(): GalleryEmojiCounts {
  return { counts: {}, mine: null };
}

/**
 * Aggregate raw RTDB row (visitorId → emoji) into counts + this visitor's pick.
 * Security: ignores unknown visitors / non-allowlisted emoji.
 */
export function aggregateGalleryEmoji(
  raw: unknown,
  visitorId: string | null
): GalleryEmojiCounts {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return emptyCounts();
  }
  const counts: Partial<Record<GalleryEmoji, number>> = {};
  let mine: GalleryEmoji | null = null;
  for (const [vid, emojiRaw] of Object.entries(raw as Record<string, unknown>)) {
    if (!VISITOR_ID_RE.test(vid)) continue;
    if (!isGalleryEmoji(emojiRaw)) continue;
    counts[emojiRaw] = (counts[emojiRaw] ?? 0) + 1;
    if (visitorId && vid === visitorId) mine = emojiRaw;
  }
  return { counts, mine };
}

/**
 * Live map of photoKey → emoji counts for all gallery photos.
 * Concurrency: one listener per subscribe; caller must unsubscribe.
 * Security: only allowlisted emojis and safe path keys are counted.
 */
export function subscribeGalleryEmoji(
  onChange: (byPhotoKey: Record<string, GalleryEmojiCounts>) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (typeof onChange !== 'function') {
    throw new Error('subscribeGalleryEmoji: onChange required');
  }
  const visitorId = getOrCreateGalleryVisitorId();
  const rootRef = ref(db, GALLERY_EMOJI_PATH);
  return onValue(
    rootRef,
    (snap) => {
      const val = snap.val();
      const out: Record<string, GalleryEmojiCounts> = {};
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        for (const [photoKey, row] of Object.entries(val as Record<string, unknown>)) {
          if (!PHOTO_KEY_RE.test(photoKey)) continue;
          out[photoKey] = aggregateGalleryEmoji(row, visitorId);
        }
      }
      onChange(out);
    },
    (err) => {
      console.error('galleryEmoji listen failed:', err);
      onError?.(err instanceof Error ? err : new Error('Failed to load emoji icons.'));
    }
  );
}

/**
 * Attach this visitor's emoji on a gallery photo.
 *
 * Concurrency: last write wins per visitorId path (no shared counter).
 * Security: allowlisted emoji + validated path segments; no auth (public feature).
 */
export async function setGalleryEmoji(
  photoKeyInput: unknown,
  emojiInput: unknown
): Promise<void> {
  const photoKey = parseGalleryPhotoKey(photoKeyInput);
  if (!isGalleryEmoji(emojiInput)) {
    throw new Error('Choose a supported emoji icon.');
  }
  const visitorId = getOrCreateGalleryVisitorId();
  if (!visitorId) {
    throw new Error('Could not save emoji in this browser. Check storage permissions.');
  }

  await set(ref(db, `${GALLERY_EMOJI_PATH}/${photoKey}/${visitorId}`), emojiInput);
}

/**
 * Remove this visitor's emoji from a gallery photo.
 */
export async function clearGalleryEmoji(photoKeyInput: unknown): Promise<void> {
  const photoKey = parseGalleryPhotoKey(photoKeyInput);
  const visitorId = getOrCreateGalleryVisitorId();
  if (!visitorId) {
    throw new Error('Could not clear emoji in this browser. Check storage permissions.');
  }
  await remove(ref(db, `${GALLERY_EMOJI_PATH}/${photoKey}/${visitorId}`));
}

/**
 * Toggle: if `emoji` is already mine, clear; otherwise attach/replace.
 */
export async function toggleGalleryEmoji(
  photoKeyInput: unknown,
  emojiInput: unknown,
  currentMine: GalleryEmoji | null
): Promise<void> {
  if (!isGalleryEmoji(emojiInput)) {
    throw new Error('Choose a supported emoji icon.');
  }
  if (currentMine !== null && !isGalleryEmoji(currentMine)) {
    throw new Error('Invalid current emoji state.');
  }
  if (currentMine === emojiInput) {
    await clearGalleryEmoji(photoKeyInput);
    return;
  }
  await setGalleryEmoji(photoKeyInput, emojiInput);
}

/** Sorted emoji chips for display (highest count first, then allowlist order). */
export function rankedGalleryEmoji(
  counts: Partial<Record<GalleryEmoji, number>>
): Array<{ emoji: GalleryEmoji; count: number }> {
  if (!counts || typeof counts !== 'object') return [];
  const ranked: Array<{ emoji: GalleryEmoji; count: number }> = [];
  for (const emoji of GALLERY_EMOJI_OPTIONS) {
    const count = counts[emoji];
    if (typeof count === 'number' && Number.isFinite(count) && count > 0) {
      ranked.push({ emoji, count: Math.floor(count) });
    }
  }
  ranked.sort((a, b) => b.count - a.count);
  return ranked;
}
