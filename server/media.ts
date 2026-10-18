import { createWriteStream } from 'node:fs';
import { mkdir, rename, rm, rmdir, unlink } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SignJWT, jwtVerify } from 'jose';

/**
 * Where uploaded photos/videos and score snapshots live.
 *
 * MEDIA_STORAGE=local (default): files under DATA_DIR/media, served at /media/…
 *   Browser PUTs to /api/uploads/<signed token> on this server.
 * MEDIA_STORAGE=s3: any S3-compatible bucket (AWS S3, Cloudflare R2, MinIO…).
 *   Browser PUTs straight to a presigned bucket URL.
 *   S3_ENDPOINT, S3_REGION (default "auto"), S3_BUCKET, S3_ACCESS_KEY_ID,
 *   S3_SECRET_ACCESS_KEY, S3_PUBLIC_BASE_URL. The older R2_* names
 *   (R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_PUBLIC_BASE_URL, …) still work.
 *
 * Object keys are always "gallery/{id}/{file}" or "photos/{file}".
 */

const KEY_RE = /^(gallery\/[A-Za-z0-9_-]{8,80}\/[A-Za-z0-9._-]{1,120}|photos\/[A-Za-z0-9._-]{1,160})$/;
const UPLOAD_TTL_SEC = 10 * 60;

export function isValidMediaKey(key: unknown): key is string {
  return typeof key === 'string' && KEY_RE.test(key) && !key.includes('..');
}

function env(name: string): string {
  return process.env[name]?.trim() ?? '';
}

export function mediaDir(): string {
  return resolve(env('DATA_DIR') || './data', 'media');
}

export interface UploadTicket {
  /** Where the browser PUTs the file (absolute https URL or same-origin /api/uploads/…). */
  uploadUrl: string;
  /** Where the file is served from afterwards (https URL or same-origin /media/…). */
  publicUrl: string;
}

export interface MediaDriver {
  readonly kind: 'local' | 's3';
  createUpload(key: string, contentType: string, byteSize: number): Promise<UploadTicket>;
  remove(key: string): Promise<void>;
}

// ─── local disk ─────────────────────────────────────────────────────────────

function secretKey(): Uint8Array {
  const s = env('AUTH_JWT_SECRET');
  if (s.length < 16) throw new Error('AUTH_JWT_SECRET is not set (or too short).');
  return new TextEncoder().encode(s);
}

/** Local file path for a key, guaranteed to stay inside the media dir. */
function localPath(key: string): string {
  const root = mediaDir();
  const full = resolve(root, key);
  if (!full.startsWith(root + sep)) throw new Error('Invalid media key.');
  return full;
}

const localDriver: MediaDriver = {
  kind: 'local',
  async createUpload(key, contentType, byteSize) {
    const token = await new SignJWT({ k: key, ct: contentType, max: byteSize })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${UPLOAD_TTL_SEC}s`)
      .sign(secretKey());
    const base = env('PUBLIC_MEDIA_BASE_URL').replace(/\/$/, '');
    return { uploadUrl: `/api/uploads/${token}`, publicUrl: `${base}/media/${key}` };
  },
  async remove(key) {
    const file = localPath(key);
    await unlink(file).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
    });
    // gallery/{id}/ folders hold one file — tidy the empty folder.
    if (key.startsWith('gallery/')) await rmdir(dirname(file)).catch(() => undefined);
  }
};

/**
 * PUT /api/uploads/:token — stream the body to disk, enforcing the size and
 * type the token was issued for. Returns an HTTP status + message.
 */
export async function receiveLocalUpload(
  token: string,
  req: IncomingMessage
): Promise<{ status: number; error?: string }> {
  let claims: { k?: unknown; ct?: unknown; max?: unknown };
  try {
    ({ payload: claims } = await jwtVerify(token, secretKey()));
  } catch {
    return { status: 403, error: 'Upload link expired or invalid — try again.' };
  }
  const key = claims.k;
  const max = Number(claims.max);
  if (!isValidMediaKey(key) || !Number.isFinite(max) || max <= 0) {
    return { status: 400, error: 'Invalid upload token.' };
  }
  const contentType = String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
  if (contentType !== claims.ct) return { status: 415, error: 'Content type does not match the upload request.' };

  const dest = localPath(key);
  const tmp = `${dest}.part`;
  await mkdir(dirname(dest), { recursive: true });
  let received = 0;
  const limiter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      received += chunk.length;
      if (received > max) cb(new Error('too-large'));
      else cb(null, chunk);
    }
  });
  try {
    await pipeline(req, limiter, createWriteStream(tmp));
    if (received === 0) throw new Error('empty');
    await rename(tmp, dest);
    return { status: 200 };
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => undefined);
    if (key.startsWith('gallery/')) await rmdir(dirname(dest)).catch(() => undefined);
    const msg = err instanceof Error ? err.message : '';
    if (msg === 'too-large') return { status: 413, error: 'File is larger than declared.' };
    if (msg === 'empty') return { status: 400, error: 'Empty upload.' };
    console.error('Local upload failed:', err);
    return { status: 500, error: 'Could not store the file.' };
  }
}

// ─── S3-compatible ──────────────────────────────────────────────────────────

interface S3Config {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBase: string;
}

function s3Config(): S3Config | null {
  const r2Account = env('R2_ACCOUNT_ID');
  const cfg: S3Config = {
    endpoint: env('S3_ENDPOINT') || (r2Account ? `https://${r2Account}.r2.cloudflarestorage.com` : ''),
    region: env('S3_REGION') || 'auto',
    bucket: env('S3_BUCKET') || env('R2_BUCKET_NAME'),
    accessKeyId: env('S3_ACCESS_KEY_ID') || env('R2_ACCESS_KEY_ID'),
    secretAccessKey: env('S3_SECRET_ACCESS_KEY') || env('R2_SECRET_ACCESS_KEY'),
    publicBase: (env('S3_PUBLIC_BASE_URL') || env('R2_PUBLIC_BASE_URL')).replace(/\/$/, '')
  };
  return cfg.bucket && cfg.accessKeyId && cfg.secretAccessKey && cfg.publicBase ? cfg : null;
}

function s3Client(cfg: S3Config): S3Client {
  return new S3Client({
    region: cfg.region,
    ...(cfg.endpoint ? { endpoint: cfg.endpoint } : {}),
    // R2/MinIO reject the SDK's default flexible checksums on presigned PUTs.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey }
  });
}

function s3Driver(cfg: S3Config): MediaDriver {
  return {
    kind: 's3',
    async createUpload(key, contentType, byteSize) {
      const uploadUrl = await getSignedUrl(
        s3Client(cfg),
        new PutObjectCommand({ Bucket: cfg.bucket, Key: key, ContentType: contentType, ContentLength: byteSize }),
        { expiresIn: UPLOAD_TTL_SEC }
      );
      return { uploadUrl, publicUrl: `${cfg.publicBase}/${key}` };
    },
    async remove(key) {
      await s3Client(cfg).send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }));
    }
  };
}

/** The configured driver, or an error message explaining what to set. */
export function getMediaDriver(): MediaDriver | { error: string } {
  const mode = (env('MEDIA_STORAGE') || 'local').toLowerCase();
  if (mode === 'local') return localDriver;
  if (mode === 's3') {
    const cfg = s3Config();
    return cfg
      ? s3Driver(cfg)
      : { error: 'MEDIA_STORAGE=s3 needs S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY and S3_PUBLIC_BASE_URL.' };
  }
  return { error: `Unknown MEDIA_STORAGE "${mode}" (use local or s3).` };
}

