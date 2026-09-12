/**
 * Thin client for the /api/auth/* endpoints. Sessions are HTTP-only cookies
 * set by the server — nothing sensitive (PIN, hash, tokens) ever lives here.
 */

export type AuthUser = { username: string; email: string };
export type AdminUser = { username: string };
export type ManagedUser = {
  uid: string;
  username: string;
  email: string;
  createdAt: string;
  locked: boolean;
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }
  if (!res.ok) {
    const message =
      payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
        ? (payload as { error: string }).error
        : `Request failed (${res.status}).`;
    throw new Error(message);
  }
  return payload as T;
}

export function checkUsername(username: string): Promise<{ available: boolean; reason?: string }> {
  return postJson('/api/auth/check-username', { username });
}

export function register(
  email: string,
  username: string,
  pin: string
): Promise<{ ok: true; user: AuthUser; recoveryCode: string }> {
  return postJson('/api/auth/register', { email, username, pin });
}

export function verifyRecoveryCode(identifier: string, recoveryCode: string): Promise<{ ok: true }> {
  return postJson('/api/auth/verify-recovery-code', { identifier, recoveryCode });
}

export function resetPinWithCode(
  identifier: string,
  recoveryCode: string,
  newPin: string
): Promise<{ ok: true; user: AuthUser; newRecoveryCode: string }> {
  return postJson('/api/auth/reset-pin-with-code', { identifier, recoveryCode, newPin });
}

export function login(identifier: string, pin: string): Promise<{ ok: true; user: AuthUser }> {
  return postJson('/api/auth/login', { identifier, pin });
}

export function adminLogin(username: string, password: string): Promise<{ ok: true }> {
  return postJson('/api/auth/admin-login', { username, password });
}

export async function logout(): Promise<void> {
  await postJson('/api/auth/logout', {});
}

export async function fetchSession(): Promise<{ user: AuthUser | null; admin: AdminUser | null }> {
  const res = await fetch('/api/auth/me');
  if (!res.ok) return { user: null, admin: null };
  return res.json();
}

export async function adminListUsers(): Promise<ManagedUser[]> {
  const res = await fetch('/api/auth/admin-list-users');
  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new Error(
      payload && typeof payload.error === 'string' ? payload.error : 'Could not load users.'
    );
  }
  const data = (await res.json()) as { users: ManagedUser[] };
  return data.users;
}

export function adminResetPin(uid: string): Promise<{ ok: true; username: string; newPin: string }> {
  return postJson('/api/auth/admin-reset-pin', { uid });
}

export function adminDeleteUser(uid: string): Promise<{ ok: true }> {
  return postJson('/api/auth/admin-delete-user', { uid });
}
