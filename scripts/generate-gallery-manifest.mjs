#!/usr/bin/env node
/**
 * Scans public/Gallery for images + mp4 and writes public/Gallery/manifest.json.
 * Run before Vite build/dev so the gallery page can load the list.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const galleryDir = path.join(root, 'public', 'Gallery');
const outFile = path.join(galleryDir, 'manifest.json');

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

if (!fs.existsSync(galleryDir)) {
  fs.mkdirSync(galleryDir, { recursive: true });
}

const entries = fs.readdirSync(galleryDir, { withFileTypes: true });
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

  const label = path.basename(name, path.extname(name)).replace(/[-_]+/g, ' ').trim() || name;

  items.push({
    src: `/Gallery/${encodeURIComponent(name).replace(/%2F/gi, '')}`,
    // Prefer readable path for static hosting (encode only unsafe chars via encodeURI for path)
    file: name,
    kind,
    title: label
  });
}

// Re-encode src properly: /Gallery/ + encodeURIComponent each path segment
for (const item of items) {
  item.src = `/Gallery/${encodeURIComponent(item.file)}`;
}

items.sort((a, b) => naturalKey(a.file).localeCompare(naturalKey(b.file)));

const manifest = {
  generatedAt: new Date().toISOString(),
  folder: '/Gallery',
  items
};

fs.writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Gallery manifest: ${items.length} item(s) → ${path.relative(root, outFile)}`);
