/**
 * Match gallery media from /Gallery/manifest.json (built from public/Gallery).
 *
 * Concurrency: pure helpers; no shared mutable state.
 * Security: only allowlisted extensions and safe /Gallery/ paths (no ..).
 */

export type GalleryMediaKind = 'image' | 'video';

export type GalleryMediaItem = {
  src: string;
  file: string;
  kind: GalleryMediaKind;
  title: string;
  /** Tournament / calendar year for year tabs (e.g. 2026). */
  year: number;
  /** Present for community uploads (RTDB id). */
  id?: string;
};

export type GalleryManifest = {
  generatedAt?: string;
  folder?: string;
  defaultYear?: number;
  years?: number[];
  items: GalleryMediaItem[];
};

/** Default year for curated flat files and current season. */
export const GALLERY_DEFAULT_YEAR = 2026;

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const VIDEO_EXT = new Set(['.mp4', '.webm']);

function extOf(file: string): string {
  const i = file.lastIndexOf('.');
  if (i < 0) return '';
  return file.slice(i).toLowerCase();
}

function isSafeFileName(name: unknown): name is string {
  if (typeof name !== 'string' || !name.trim()) return false;
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
  if (name.startsWith('.')) return false;
  return true;
}

function isValidGalleryYear(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 2000 &&
    value <= 2100
  );
}

/**
 * Accepts /Gallery/file.jpg or /Gallery/2026/file.jpg matching basename `file`.
 */
function isSafeGallerySrc(src: unknown, file: string, year: number): src is string {
  if (typeof src !== 'string' || !src.startsWith('/Gallery/')) return false;
  if (src.includes('..')) return false;
  try {
    const rest = decodeURIComponent(src.slice('/Gallery/'.length));
    if (rest === file) return true;
    const yearPrefix = `${year}/`;
    return rest === `${yearPrefix}${file}`;
  } catch {
    return false;
  }
}

/**
 * Validates and normalizes a manifest payload from /Gallery/manifest.json.
 */
export function parseGalleryManifest(raw: unknown): GalleryMediaItem[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const root = raw as Record<string, unknown>;
  const items = root.items;
  if (!Array.isArray(items)) return [];

  const defaultYear = isValidGalleryYear(root.defaultYear)
    ? root.defaultYear
    : GALLERY_DEFAULT_YEAR;

  const out: GalleryMediaItem[] = [];
  for (const entry of items) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const file = row.file;
    if (!isSafeFileName(file)) continue;
    const ext = extOf(file);
    const kind: GalleryMediaKind | null = IMAGE_EXT.has(ext)
      ? 'image'
      : VIDEO_EXT.has(ext)
        ? 'video'
        : null;
    if (!kind) continue;
    if (row.kind !== kind) continue;
    const year = isValidGalleryYear(row.year) ? row.year : defaultYear;
    if (!isSafeGallerySrc(row.src, file, year)) continue;
    const title =
      typeof row.title === 'string' && row.title.trim() ? row.title.trim() : file;
    out.push({ src: row.src as string, file, kind, title, year });
  }
  return out;
}

/**
 * Unique years present in items, newest first.
 * Input: validated gallery items (year already checked when parsed).
 */
export function galleryYearsFromItems(items: GalleryMediaItem[]): number[] {
  if (!Array.isArray(items)) return [];
  const years = new Set<number>();
  for (const item of items) {
    if (item && isValidGalleryYear(item.year)) years.add(item.year);
  }
  return [...years].sort((a, b) => b - a);
}

export async function fetchGalleryManifest(
  signal?: AbortSignal
): Promise<GalleryMediaItem[]> {
  const res = await fetch('/Gallery/manifest.json', {
    method: 'GET',
    signal,
    headers: { Accept: 'application/json' },
    cache: 'no-cache'
  });
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? 'Gallery manifest missing. Run npm run gallery:manifest after adding files.'
        : `Failed to load gallery (${res.status}).`
    );
  }
  const data: unknown = await res.json();
  return parseGalleryManifest(data);
}
