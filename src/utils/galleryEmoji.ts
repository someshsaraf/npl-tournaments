import {
  onValue,
  ref,
  remove,
  set,
  type Unsubscribe
} from 'firebase/database';
import { db, GALLERY_EMOJI_PATH } from '../firebase';

/** Allowlisted emoji icons visitors may attach to an uploaded photo. */
export const GALLERY_EMOJI_OPTIONS = ['🔥', '👏', '😂', '❤️', '🏏', '💪'] as const;

export type GalleryEmoji = (typeof GALLERY_EMOJI_OPTIONS)[number];

const VISITOR_STORAGE_KEY = 'npl-gallery-visitor-id';
const VISITOR_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const UPLOAD_ID_RE = /^[a-zA-Z0-9_-]{8,80}$/;

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
 * Validate community-upload id used as RTDB path segment.
 * Fails closed on empty / unsafe characters.
 */
export function parseGalleryUploadId(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Photo id is required to attach an emoji.');
  }
  const id = value.trim();
  if (!UPLOAD_ID_RE.test(id)) {
    throw new Error('Invalid photo id for emoji.');
  }
  return id;
}

/**
 * Stable per-browser visitor id (localStorage) for emoji ownership.
 * Input validation: only [a-zA-Z0-9_-]{8,64} so path injection is impossible.
 * Concurrency: localStorage is per-origin; not shared across tabs' writers atomically
 * but id creation is idempotent enough for emoji toggles.
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
 * Live map of uploadId → emoji counts for all community photos.
 * Concurrency: one listener per subscribe; caller must unsubscribe.
 * Security: only allowlisted emojis and safe path keys are counted.
 */
export function subscribeGalleryEmoji(
  onChange: (byUploadId: Record<string, GalleryEmojiCounts>) => void,
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
        for (const [uploadId, row] of Object.entries(val as Record<string, unknown>)) {
          if (!UPLOAD_ID_RE.test(uploadId)) continue;
          out[uploadId] = aggregateGalleryEmoji(row, visitorId);
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
 * Attach or clear this visitor's emoji on a community upload.
 * Same emoji again → remove; different emoji → replace.
 *
 * Concurrency: last write wins per visitorId path (no shared counter).
 * Security: allowlisted emoji + validated path segments; no auth (public feature).
 */
export async function setGalleryEmoji(
  uploadIdInput: unknown,
  emojiInput: unknown
): Promise<void> {
  const uploadId = parseGalleryUploadId(uploadIdInput);
  if (!isGalleryEmoji(emojiInput)) {
    throw new Error('Choose a supported emoji icon.');
  }
  const visitorId = getOrCreateGalleryVisitorId();
  if (!visitorId) {
    throw new Error('Could not save emoji in this browser. Check storage permissions.');
  }

  const emojiRef = ref(db, `${GALLERY_EMOJI_PATH}/${uploadId}/${visitorId}`);
  // Read current via a one-shot is unnecessary if caller already knows mine;
  // toggle is handled by caller. This helper always sets the given emoji.
  await set(emojiRef, emojiInput);
}

/**
 * Remove this visitor's emoji from a community upload.
 */
export async function clearGalleryEmoji(uploadIdInput: unknown): Promise<void> {
  const uploadId = parseGalleryUploadId(uploadIdInput);
  const visitorId = getOrCreateGalleryVisitorId();
  if (!visitorId) {
    throw new Error('Could not clear emoji in this browser. Check storage permissions.');
  }
  await remove(ref(db, `${GALLERY_EMOJI_PATH}/${uploadId}/${visitorId}`));
}

/**
 * Toggle: if `emoji` is already mine, clear; otherwise attach/replace.
 */
export async function toggleGalleryEmoji(
  uploadIdInput: unknown,
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
    await clearGalleryEmoji(uploadIdInput);
    return;
  }
  await setGalleryEmoji(uploadIdInput, emojiInput);
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
