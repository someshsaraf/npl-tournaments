/**
 * Thin client for /api/auth/*. Access is by shared code — a community code
 * for residents and court screens, a fixed admin code for staff. The server
 * keeps the pass in an HTTP-only cookie; nothing secret lives in JS.
 */

export type SessionInfo = {
  /** Set once this device has entered the community code. `deviceId` is random — not a person. */
  access: { deviceId: string } | null;
  admin: { role: 'admin' } | null;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = (await res.json().catch(() => null)) as { error?: unknown } | null;
  if (!res.ok) {
    throw new Error(typeof payload?.error === 'string' ? payload.error : `Request failed (${res.status}).`);
  }
  return payload as T;
}

/** Unlock this device with the community code (or the admin code → `admin: true`). */
export function enterAccessCode(code: string): Promise<{ ok: true; admin?: boolean }> {
  return postJson('/api/auth/access', { code });
}

/** Staff unlock with the admin code. */
export function adminLogin(code: string): Promise<{ ok: true }> {
  return postJson('/api/auth/admin-login', { code });
}

/** Lock this device (clears both passes). */
export async function logout(): Promise<void> {
  await postJson('/api/auth/logout', {});
}

export async function fetchSession(): Promise<SessionInfo> {
  const res = await fetch('/api/auth/me');
  if (!res.ok) return { access: null, admin: null };
  const data = (await res.json()) as Partial<SessionInfo>;
  return { access: data.access ?? null, admin: data.admin ?? null };
}

export type AccessCodeInfo = { source: 'env' | 'custom'; updatedAt: string | null; configured: boolean };

export async function fetchAccessCodeInfo(): Promise<AccessCodeInfo> {
  const res = await fetch('/api/auth/admin-access-info');
  if (!res.ok) throw new Error('Could not load access settings.');
  return res.json();
}

/** Staff: replace the community code (signs every device out). */
export function setCommunityAccessCode(code: string): Promise<{ ok: true }> {
  return postJson('/api/auth/admin-set-access-code', { code });
}
