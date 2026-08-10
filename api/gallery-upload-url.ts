import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Issues a short-lived R2 presigned PUT URL for /photos community uploads.
 * Browser uploads directly to R2 (avoids Vercel body size limits).
 *
 * Env (Vercel → Environment Variables, no VITE_ prefix):
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *   R2_BUCKET_NAME, R2_PUBLIC_BASE_URL
 *
 * Concurrency: stateless per request.
 * Security: secrets server-only; MIME validated; object key is UUID-based.
 * Total gallery quota (5 GB) is enforced in RTDB on the client upload path.
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

function readEnv(name: string): string {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : '';
}

function isSafePublicBaseUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && !u.search && !u.hash;
  } catch {
    return false;
  }
}

function sanitizeFileStem(name: string): string {
  const stem = name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, 48);
  return stem || 'photo';
}

function setCors(res: VercelResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const accountId = readEnv('R2_ACCOUNT_ID');
  const accessKeyId = readEnv('R2_ACCESS_KEY_ID');
  const secretAccessKey = readEnv('R2_SECRET_ACCESS_KEY');
  const bucket = readEnv('R2_BUCKET_NAME');
  const publicBase = readEnv('R2_PUBLIC_BASE_URL').replace(/\/$/, '');

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket || !publicBase) {
    res.status(503).json({
      error:
        'Gallery upload is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL on Vercel.'
    });
    return;
  }
  if (!isSafePublicBaseUrl(publicBase)) {
    res.status(500).json({ error: 'R2_PUBLIC_BASE_URL must be an https:// base URL.' });
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
  const publicUrl = `${publicBase}/${objectKey}`;

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      ContentType: contentType,
      ContentLength: Math.floor(byteSize)
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: PRESIGN_EXPIRES_SEC });

    res.status(200).json({
      id,
      uploadUrl,
      publicUrl,
      storagePath: objectKey,
      fileName,
      contentType,
      kind,
      byteSize: Math.floor(byteSize),
      expiresInSec: PRESIGN_EXPIRES_SEC
    });
  } catch (err) {
    console.error('R2 presign failed:', err);
    res.status(500).json({ error: 'Failed to create upload URL. Check R2 credentials.' });
  }
}
