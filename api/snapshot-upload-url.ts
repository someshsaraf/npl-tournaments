import type { ApiRequest, ApiResponse } from './_lib/http.js';
import { getAdminSession } from './_lib/session.js';
import { getMediaDriver, isValidMediaKey } from '../server/media.js';

/**
 * POST /api/snapshot-upload-url — upload URL for a score-snapshot PNG
 * (saved with a finished match). Staff only. Key: photos/{fileName}.
 * Body: { fileName, byteSize }.
 */
const MAX_SNAPSHOT_BYTES = 15 * 1024 * 1024;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!(await getAdminSession(req))) {
    res.status(401).json({ error: 'Staff login required.' });
    return;
  }
  const driver = getMediaDriver();
  if ('error' in driver) {
    res.status(503).json({ error: `Media storage is not configured: ${driver.error}` });
    return;
  }
  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as { fileName?: unknown; byteSize?: unknown };
  const fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';
  const byteSize = Number(body.byteSize);
  const key = `photos/${fileName}`;
  if (!fileName.endsWith('.png') || !isValidMediaKey(key)) {
    res.status(400).json({ error: 'fileName must be a simple .png name.' });
    return;
  }
  if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > MAX_SNAPSHOT_BYTES) {
    res.status(400).json({ error: 'Invalid snapshot size.' });
    return;
  }
  try {
    const ticket = await driver.createUpload(key, 'image/png', Math.floor(byteSize));
    res.status(200).json({ ...ticket, storagePath: key });
  } catch (err) {
    console.error('Snapshot upload URL failed:', err);
    res.status(500).json({ error: 'Could not create the upload URL.' });
  }
}
