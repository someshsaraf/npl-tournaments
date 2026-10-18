/**
 * Media URLs the app will display or store: absolute https (S3/R2/CDN), or
 * same-origin /media/… when the server stores files on its own disk.
 */
export function isSafeMediaUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v || v.length > 2000) return false;
  if (v.startsWith('/media/')) return !v.includes('..') && !v.includes('//', 1);
  try {
    const u = new URL(v);
    return u.protocol === 'https:' && !u.username && !u.password;
  } catch {
    return false;
  }
}

/** Upload targets: a presigned https bucket URL, or this server's /api/uploads/… endpoint. */
export function isSafeUploadUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  return value.startsWith('/api/uploads/') || value.startsWith('https://');
}

/**
 * PUT a file to an upload URL from /api/*-upload-url. Same-origin uploads
 * carry the session cookie; bucket uploads don't need it.
 */
export async function putToUploadUrl(uploadUrl: string, body: Blob, contentType: string): Promise<void> {
  if (!isSafeUploadUrl(uploadUrl)) throw new Error('Invalid upload URL from server.');
  const res = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body });
  if (!res.ok) {
    let detail = '';
    try {
      detail = ((await res.json()) as { error?: string }).error ?? '';
    } catch {
      /* not JSON */
    }
    throw new Error(
      detail ||
        (res.status === 403 && !uploadUrl.startsWith('/')
          ? 'The storage bucket rejected the upload (check its CORS allows PUT from this site).'
          : `Upload failed (${res.status}).`)
    );
  }
}
