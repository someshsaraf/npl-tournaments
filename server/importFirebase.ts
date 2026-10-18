import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { getStore } from './store.js';
import { isValidMediaKey, mediaDir } from './media.js';

/**
 * One-time migration from Firebase.
 *
 *   1. Firebase console → Realtime Database → ⋮ → Export JSON
 *   2. node dist-server/index.js import ./export.json [--download-gallery] [--replace]
 *      (or: npm run import -- ./export.json …)
 *
 * - Copies results, teams, tournaments, settings and gallery records. Skips
 *   live heartbeats, removed community events and old resident accounts.
 * - Score snapshots stored in Firebase Storage are downloaded to
 *   DATA_DIR/media/photos and re-pointed at /media/…, since Firebase Storage
 *   goes away with the project.
 * - --download-gallery also copies community uploads off R2 to local disk
 *   (otherwise their R2 URLs are kept; set MEDIA_STORAGE=s3 with the R2_*
 *   vars so deletes still work).
 */

/**
 * Not carried over: live heartbeats, removed community events, and the old
 * per-resident accounts (names + PIN hashes) — access is by shared code now,
 * so that personal data is simply left behind.
 */
const SKIP = new Set(['presence', 'events', 'users', 'usernames', 'emails', 'loginAttempts', 'otps']);

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

async function download(url: string, key: string): Promise<boolean> {
  if (!isValidMediaKey(key)) return false;
  const dest = resolve(mediaDir(), key);
  const tmp = `${dest}.part`;
  try {
    const res = await fetch(url);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    await mkdir(dirname(dest), { recursive: true });
    await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp));
    await rename(tmp, dest);
    return true;
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => undefined);
    console.warn(`  ! could not download ${key}: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}

function isFirebaseStorageUrl(url: unknown): url is string {
  return typeof url === 'string' && /^https:\/\/(firebasestorage|storage)\.googleapis\.com\//.test(url);
}

export async function runImport(args: string[]): Promise<void> {
  const file = args.find((a) => !a.startsWith('--'));
  const replace = args.includes('--replace');
  const downloadGallery = args.includes('--download-gallery');
  if (!file) {
    console.error('Usage: import <firebase-export.json> [--download-gallery] [--replace]');
    process.exit(1);
  }

  const data = JSON.parse(await readFile(file, 'utf8')) as unknown;
  if (!isObj(data)) throw new Error('Export must be a JSON object (the database root).');

  const store = getStore();
  const existing = ['completedMatches', 'teams', 'galleryUploads'].filter((k) => store.get(k) !== null);
  if (existing.length > 0 && !replace) {
    console.error(`The database already has data (${existing.join(', ')}). Re-run with --replace to overwrite it.`);
    process.exit(1);
  }

  // Score snapshots → local disk.
  const completed = data.completedMatches;
  if (isObj(completed)) {
    let n = 0;
    for (const row of Object.values(completed)) {
      if (!isObj(row) || !isFirebaseStorageUrl(row.snapshotUrl)) continue;
      const key = typeof row.snapshotPath === 'string' ? row.snapshotPath : '';
      // On failure the Firebase URL is kept (it works until that project is deleted).
      if (await download(row.snapshotUrl, key)) {
        row.snapshotUrl = `/media/${key}`;
        n++;
      }
    }
    console.log(`Score snapshots copied: ${n}`);
  }

  // Community gallery → optionally local disk.
  const gallery = data.galleryUploads;
  if (downloadGallery && isObj(gallery)) {
    let n = 0;
    for (const row of Object.values(gallery)) {
      if (!isObj(row) || typeof row.url !== 'string' || !row.url.startsWith('https://')) continue;
      const key = typeof row.storagePath === 'string' ? row.storagePath : '';
      if (await download(row.url, key)) {
        row.url = `/media/${key}`;
        n++;
      }
    }
    console.log(`Gallery files copied: ${n}`);
  }

  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SKIP.has(key)) continue;
    values[key] = value;
  }
  if (replace) {
    for (const key of Object.keys(values)) store.remove(key);
  }
  store.update('', values);
  console.log(`Imported: ${Object.keys(values).join(', ')}`);
  if (isObj(data.users)) {
    console.log(`Skipped ${Object.keys(data.users).length} old resident accounts (access is by shared code now).`);
  }
}
