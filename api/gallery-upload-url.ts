import { randomUUID } from 'node:crypto';
import type { ApiRequest, ApiResponse } from './_lib/http.js';
import { getAccessSession, getAdminSession } from './_lib/session.js';
import { getMediaDriver } from '../server/media.js';

/**
 * POST /api/gallery-upload-url — issues a short-lived upload URL for a
 * /photos community upload. The browser then PUTs the file there: to this
 * server (MEDIA_STORAGE=local) or straight to an S3-compatible bucket
 * (MEDIA_STORAGE=s3) — see server/media.ts.
 *
 * Security: community or staff pass required; MIME allowlisted; object key is
 * UUID-based. The shared 5 GB quota is reserved by the client in the data
 * tree (galleryUploadsMeta/totalBytes) before calling this.
 */

/** Absolute ceiling for one object (must fit under the shared 5 GB pool). */
const MAX_TOTAL_BYTES = 5 * 1024 * 1024 * 1024;
const PRESIGN_EXPIRES_SEC = 10 * 60;

const IMAGE_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const VIDEO_MIME = new Set(['video/mp4', 'video/webm']);
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm'
};

function sanitizeFileStem(name: string): string {
  const stem = name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 48);
  return stem || 'photo';
}

function setCors(res: ApiResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

  // Anyone with the community code, or staff, may upload.
  const [access, admin] = await Promise.all([getAccessSession(req), getAdminSession(req)]);
  if (!access && !admin) {
    res.status(401).json({ error: 'Enter the community access code to upload photos.' });
    return;
  }

  const driver = getMediaDriver();
  if ('error' in driver) {
    res.status(503).json({ error: `Gallery upload is not configured: ${driver.error}` });
    return;
  }

  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};
  const contentType =
    typeof (body as { contentType?: unknown }).contentType === 'string'
      ? (body as { contentType: string }).contentType.toLowerCase().trim()
      : '';
  const byteSizeRaw = (body as { byteSize?: unknown }).byteSize;
  const byteSize =
    typeof byteSizeRaw === 'number'
      ? byteSizeRaw
      : typeof byteSizeRaw === 'string'
        ? Number(byteSizeRaw)
        : NaN;
  const fileNameHint =
    typeof (body as { fileName?: unknown }).fileName === 'string'
      ? (body as { fileName: string }).fileName.trim().slice(0, 120)
      : 'photo';

  if (!contentType || (!IMAGE_MIME.has(contentType) && !VIDEO_MIME.has(contentType))) {
    res.status(400).json({ error: 'Unsupported type. Allowed: JPG, PNG, WebP, GIF, MP4, WebM.' });
    return;
  }
  const kind = IMAGE_MIME.has(contentType) ? 'image' : 'video';
  if (!Number.isFinite(byteSize) || byteSize <= 0) {
    res.status(400).json({ error: 'File is empty or size is invalid.' });
    return;
  }
  if (byteSize > MAX_TOTAL_BYTES) {
    res.status(400).json({ error: 'File is larger than the 5 GB gallery storage limit.' });
    return;
  }

  const ext = EXT_BY_MIME[contentType];
  if (!ext) {
    res.status(400).json({ error: 'Unsupported file extension.' });
    return;
  }

  const id = randomUUID().replace(/-/g, '').slice(0, 20);
  const stem = sanitizeFileStem(fileNameHint);
  const fileName = `${stem}${ext}`;
  const objectKey = `gallery/${id}/${fileName}`;

  try {
    const { uploadUrl, publicUrl } = await driver.createUpload(objectKey, contentType, Math.floor(byteSize));

    // No names are collected — uploads are credited generically. The device id
    // only lets the same device delete its own upload later.
    const uploaderName = admin ? 'Organisers' : 'Resident';

    res.status(200).json({
      id,
      uploadUrl,
      publicUrl,
      storagePath: objectKey,
      fileName,
      contentType,
      kind,
      byteSize: Math.floor(byteSize),
      expiresInSec: PRESIGN_EXPIRES_SEC,
      ...(access && !admin ? { uploaderUid: access.sid } : {}),
      uploaderName
    });
  } catch (err) {
    console.error('Creating upload URL failed:', err);
    res.status(500).json({ error: 'Failed to create upload URL. Check the media storage settings.' });
  }
}
