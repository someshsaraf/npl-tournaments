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
  /** Tournament season year for year tabs (e.g. 2026). */
  year: number;
  /** Upload tag when known, e.g. npl-2026. */
  tag?: GalleryYearTag;
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

/** Allowed upload tags → season year (newest first). */
export const GALLERY_YEAR_TAGS = [
  'npl-2026',
  'npl-2025',
  'npl-2024',
  'npl-2023'
] as const;

export type GalleryYearTag = (typeof GALLERY_YEAR_TAGS)[number];

/** Season years shown as gallery tabs (newest first). */
export const GALLERY_SEASON_YEARS: readonly number[] = GALLERY_YEAR_TAGS.map((tag) =>
  Number(tag.slice('npl-'.length))
);

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

export function isGallerySeasonYear(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    (GALLERY_SEASON_YEARS as readonly number[]).includes(value)
  );
}

/** True if value is an allowlisted upload tag (npl-2023 … npl-2026). */
export function isGalleryYearTag(value: unknown): value is GalleryYearTag {
  return typeof value === 'string' && (GALLERY_YEAR_TAGS as readonly string[]).includes(value);
}

/**
 * Normalize unknown input to an allowlisted gallery year tag.
 * Accepts `npl-2026`, `NPL-2026`, or year number `2026`.
 */
export function parseGalleryYearTag(value: unknown): GalleryYearTag {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (isGalleryYearTag(normalized)) return normalized;
    if (/^\d{4}$/.test(normalized)) {
      const asTag = `npl-${normalized}`;
      if (isGalleryYearTag(asTag)) return asTag;
    }
  }
  if (isGallerySeasonYear(value)) {
    const asTag = `npl-${value}`;
    if (isGalleryYearTag(asTag)) return asTag;
  }
  throw new Error('Choose a season tag: npl-2026, npl-2025, npl-2024, or npl-2023.');
}

export function yearFromGalleryTag(tag: GalleryYearTag): number {
  if (!isGalleryYearTag(tag)) {
    throw new Error('parseGalleryYearTag: invalid tag');
  }
  return Number(tag.slice('npl-'.length));
}

export function galleryTagFromYear(year: number): GalleryYearTag {
  const tag = `npl-${year}`;
  if (!isGalleryYearTag(tag)) {
    throw new Error('galleryTagFromYear: year not in allowlist');
  }
  return tag;
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
