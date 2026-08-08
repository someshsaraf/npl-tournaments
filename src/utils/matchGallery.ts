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
};

export type GalleryManifest = {
  generatedAt?: string;
  folder?: string;
  items: GalleryMediaItem[];
};

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

function isSafeGallerySrc(src: unknown, file: string): src is string {
  if (typeof src !== 'string' || !src.startsWith('/Gallery/')) return false;
  if (src.includes('..')) return false;
  // Must resolve to the same basename we trust.
  try {
    const decoded = decodeURIComponent(src.slice('/Gallery/'.length));
    return decoded === file;
  } catch {
    return false;
  }
}

/**
 * Validates and normalizes a manifest payload from /Gallery/manifest.json.
 */
export function parseGalleryManifest(raw: unknown): GalleryMediaItem[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) return [];

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
    if (!isSafeGallerySrc(row.src, file)) continue;
    const title =
      typeof row.title === 'string' && row.title.trim() ? row.title.trim() : file;
    out.push({ src: row.src, file, kind, title });
  }
  return out;
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
