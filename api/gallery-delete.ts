import type { ApiRequest, ApiResponse } from './_lib/http.js';
import { getAdminDb } from './_lib/db.js';
import { getAccessSession, getAdminSession } from './_lib/session.js';
import { getMediaDriver } from '../server/media.js';

/**
 * POST /api/gallery-delete — removes a community gallery file from media
 * storage (local disk or S3-compatible; see server/media.ts).
 * Called from admin Photos (any record) or from the device that uploaded it
 * (record.uploaderUid must match that device's community-pass id). Records
 * without an `uploaderUid` can only be removed by staff.
 *
 * Security: storagePath must be gallery/{id}/… with no "..".
 */

const STORAGE_PATH_RE = /^gallery\/[a-zA-Z0-9_-]{8,80}\/[a-zA-Z0-9._-]{1,120}$/;

function setCors(res: ApiResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseStoragePath(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('storagePath is required.');
  }
  const path = raw.trim();
  if (path.includes('..') || path.includes('\\') || path.includes('//')) {
    throw new Error('Invalid storage path.');
  }
  if (!STORAGE_PATH_RE.test(path)) {
    throw new Error('storagePath must look like gallery/{id}/{file}.');
  }
  return path;
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const driver = getMediaDriver();
  if ('error' in driver) {
    res.status(503).json({ error: `Gallery delete is not configured: ${driver.error}` });
    return;
  }

  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  let storagePath: string;
  try {
    storagePath = parseStoragePath((body as { storagePath?: unknown }).storagePath);
  } catch (err) {
    res.status(400).json({
      error: err instanceof Error ? err.message : 'Invalid storage path.'
    });
    return;
  }
  const id = typeof (body as { id?: unknown }).id === 'string' ? (body as { id: string }).id.trim() : '';
  if (!id) {
    res.status(400).json({ error: 'id is required.' });
    return;
  }

  const [userSession, adminSession] = await Promise.all([getAccessSession(req), getAdminSession(req)]);
  if (!userSession && !adminSession) {
    res.status(401).json({ error: 'Enter the community access code first.' });
    return;
  }

  if (!adminSession) {
    const record = (await getAdminDb().ref(`galleryUploads/${id}`).get()).val() as {
      uploaderUid?: string;
    } | null;
    if (!record) {
      res.status(404).json({ error: 'Photo not found.' });
      return;
    }
    if (record.uploaderUid !== userSession!.sid) {
      res.status(403).json({ error: 'You can only delete photos you uploaded.' });
      return;
    }
  }

  try {
    await driver.remove(storagePath);

    res.status(200).json({ ok: true, storagePath });
  } catch (err) {
    console.error('Gallery file delete failed:', err);
    res.status(500).json({ error: 'Failed to delete the gallery file.' });
  }
}
