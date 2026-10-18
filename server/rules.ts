import type { Json } from './store.js';

/**
 * Who may read/write which part of the data tree (replaces Firebase's
 * database.rules.json). Enforced on the server for every realtime request.
 *
 * - Private (access-code hashes, legacy accounts): server code only.
 * - Reading anything else needs the community code (or the admin code).
 * - Writes need the admin code, except, for community-code devices:
 *     presence/live/{id}             live viewer count
 *     galleryUploads/{id}            add photos; delete ones this device added
 *     galleryUploadsMeta/totalBytes  upload quota counter
 */

export interface Principal {
  /** Community-pass device id (random, not a person), when the community code was entered. */
  uid: string | null;
  admin: boolean;
}

/** Has this connection unlocked the site at all? */
export function hasAccess(who: Principal): boolean {
  return who.admin || who.uid !== null;
}

const PRIVATE_TOP = new Set(['access', 'users', 'usernames', 'emails', 'loginAttempts', 'otps']);
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
const MAX_GALLERY_BYTES = 5 * 1024 * 1024 * 1024;

export function canRead(who: Principal, segs: string[]): boolean {
  if (!hasAccess(who)) return false;
  if (segs.length === 0) return false; // root contains private data
  return !PRIVATE_TOP.has(segs[0]);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function validGalleryRecord(v: Json): boolean {
  if (!isObj(v)) return false;
  const required = ['url', 'kind', 'title', 'fileName', 'contentType', 'storagePath', 'createdAt', 'byteSize'];
  if (!required.every((k) => k in v)) return false;
  const url = v.url;
  const storagePath = v.storagePath;
  return (
    (v.kind === 'image' || v.kind === 'video') &&
    typeof url === 'string' &&
    (url.startsWith('https://') || url.startsWith('/media/')) &&
    typeof storagePath === 'string' &&
    storagePath.startsWith('gallery/') &&
    !storagePath.includes('..') &&
    typeof v.title === 'string' &&
    v.title.length <= 80 &&
    typeof v.fileName === 'string' &&
    v.fileName.length <= 120 &&
    typeof v.byteSize === 'number' &&
    v.byteSize > 0 &&
    v.byteSize <= 41943040 * 128
  );
}

/**
 * May `who` change the value at `segs` from `before` to `after`?
 * Returns an error message, or null when allowed.
 */
export function checkWrite(who: Principal, segs: string[], before: Json, after: Json): string | null {
  if (segs.length === 0) return 'Root writes are not allowed.';
  const top = segs[0];
  if (PRIVATE_TOP.has(top)) return 'Permission denied.';

  if (!hasAccess(who)) return 'Enter the community access code first.';

  if (top === 'presence') {
    // The viewer's own node or a field under it (heartbeat updates write presence/live/{id}/at).
    if (segs[1] === 'live' && segs.length >= 3 && SESSION_ID_RE.test(segs[2])) return null;
    return 'Permission denied.';
  }

  if (who.admin) return null;

  if (top === 'galleryUploads' && segs.length === 2) {
    if (!who.uid) return 'Enter the community access code to upload.';
    if (before === null && after !== null) {
      if (!validGalleryRecord(after)) return 'Invalid gallery record.';
      if (isObj(after) && after.uploaderUid !== undefined && after.uploaderUid !== who.uid) {
        return 'Uploads must be attributed to you.';
      }
      return null;
    }
    if (before !== null && after === null) {
      return isObj(before) && before.uploaderUid === who.uid ? null : 'You can only delete photos you uploaded.';
    }
    return 'Gallery records cannot be edited.';
  }

  if (top === 'galleryUploadsMeta' && segs.length === 2 && segs[1] === 'totalBytes') {
    if (!who.uid) return 'Enter the community access code to upload.';
    return typeof after === 'number' && after >= 0 && after <= MAX_GALLERY_BYTES ? null : 'Invalid quota value.';
  }

  return 'The admin code is required to change this.';
}
