#!/usr/bin/env node
/**
 * Scans public/Gallery for images + mp4 and writes public/Gallery/manifest.json.
 * Supports flat files (default year) and year folders: public/Gallery/2026/*.jpg
 * Run before Vite build/dev so the gallery page can load the list.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const galleryDir = path.join(root, 'public', 'Gallery');
const outFile = path.join(galleryDir, 'manifest.json');

/** Flat files in public/Gallery/ are tagged with this year. */
const DEFAULT_YEAR = 2026;

const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const VIDEO_EXT = new Set(['.mp4', '.webm']);
const ALLOWED = new Set([...IMAGE_EXT, ...VIDEO_EXT]);

/** Safe basename only — reject path segments. */
function isSafeFileName(name) {
  if (typeof name !== 'string' || !name.trim()) return false;
  if (name !== path.basename(name)) return false;
  if (name.includes('..') || name.includes('/') || name.includes('\\')) return false;
  if (name.startsWith('.')) return false;
  return true;
}

function isYearFolderName(name) {
  return typeof name === 'string' && /^\d{4}$/.test(name);
}

function naturalKey(name) {
  return name
    .toLowerCase()
    .replace(/(\d+)/g, (_, n) => n.padStart(8, '0'));
}

function kindForExt(ext) {
  if (IMAGE_EXT.has(ext)) return 'image';
  if (VIDEO_EXT.has(ext)) return 'video';
  return null;
}

/**
 * @param {string} absDir
 * @param {number} year
 * @param {string} urlPrefix path under /Gallery ('' or '2026')
 */
function collectMediaFiles(absDir, year, urlPrefix) {
  if (!fs.existsSync(absDir)) return [];
  const entries = fs.readdirSync(absDir, { withFileTypes: true });
  const items = [];

  for (const ent of entries) {
    if (!ent.isFile()) continue;
    const name = ent.name;
    if (!isSafeFileName(name)) continue;
    if (name === 'manifest.json' || name === 'README.md') continue;

    const ext = path.extname(name).toLowerCase();
    if (!ALLOWED.has(ext)) continue;
    const kind = kindForExt(ext);
    if (!kind) continue;

    const label =
      path.basename(name, path.extname(name)).replace(/[-_]+/g, ' ').trim() || name;
    const relPath = urlPrefix ? `${urlPrefix}/${name}` : name;

    items.push({
      src: `/Gallery/${relPath.split('/').map(encodeURIComponent).join('/')}`,
      file: name,
      kind,
      title: label,
      year
    });
  }
  return items;
}

if (!fs.existsSync(galleryDir)) {
  fs.mkdirSync(galleryDir, { recursive: true });
}

const items = [];
const topEntries = fs.readdirSync(galleryDir, { withFileTypes: true });

for (const ent of topEntries) {
  if (ent.isDirectory() && isYearFolderName(ent.name)) {
    const year = Number(ent.name);
    items.push(
      ...collectMediaFiles(path.join(galleryDir, ent.name), year, ent.name)
    );
  }
}

// Flat files at Gallery root → default year (legacy layout).
items.push(...collectMediaFiles(galleryDir, DEFAULT_YEAR, ''));

items.sort((a, b) => {
  if (a.year !== b.year) return b.year - a.year;
  return naturalKey(a.file).localeCompare(naturalKey(b.file));
});

const years = [...new Set(items.map((i) => i.year))].sort((a, b) => b - a);

const manifest = {
  generatedAt: new Date().toISOString(),
  folder: '/Gallery',
  defaultYear: DEFAULT_YEAR,
  years,
  items
};

fs.writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(
  `Gallery manifest: ${items.length} item(s), years [${years.join(', ')}] → ${path.relative(root, outFile)}`
);
