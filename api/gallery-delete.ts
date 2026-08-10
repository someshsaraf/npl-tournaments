import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Deletes a community gallery object from Cloudflare R2.
 * Called from admin Photos after RTDB metadata is removed.
 *
 * Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *
 * Concurrency: stateless per request.
 * Security: secrets server-only; storagePath must be gallery/{id}/… with no "..".
 * Note: same public-API model as upload (no staff auth); tighten later if needed.
 */

const STORAGE_PATH_RE = /^gallery\/[a-zA-Z0-9_-]{8,80}\/[a-zA-Z0-9._-]{1,120}$/;

function readEnv(name: string): string {
  const v = process.env[name];
  return typeof v === 'string' ? v.trim() : '';
}

function setCors(res: VercelResponse): void {
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

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    res.status(503).json({
      error:
        'Gallery delete is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME on Vercel.'
    });
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

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    });

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: storagePath
      })
    );

    res.status(200).json({ ok: true, storagePath });
  } catch (err) {
    console.error('R2 delete failed:', err);
    res.status(500).json({ error: 'Failed to delete gallery file from R2.' });
  }
}
