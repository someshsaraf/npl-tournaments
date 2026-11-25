import { SignJWT, jwtVerify } from 'jose';
import type { ApiResponse, HasHeaders } from './http.js';
import { getAccessCodeVersion } from './accessCode.js';

/**
 * Signed, HTTP-only session cookies (JWT) for the two access levels — no
 * personal data inside. Not readable by client JS, so an XSS bug can't steal
 * them the way reading localStorage would let it.
 *
 * Env (server only, never VITE_):
 * - AUTH_JWT_SECRET (required) — a long random string, e.g. `openssl rand -hex 32`.
 *   Must differ from AUTH_PEPPER (two independent secrets, one purpose each).
 */

/** Community pass (shared access code) — residents, court screens. */
const ACCESS_COOKIE = 'rnw_access';
/** Staff pass (admin code). Also grants community access. */
const ADMIN_COOKIE = 'rnw_admin_session';
/** Old per-resident account cookie — only ever cleared now. */
const LEGACY_USER_COOKIE = 'rnw_session';
const ACCESS_TTL_SECONDS = 60 * 60 * 24 * 180; // court TVs stay unlocked for a season
const ADMIN_TTL_SECONDS = 60 * 60 * 24 * 30;

export type AccessSessionPayload = {
  role: 'community';
  /** Random per-device id — lets a device delete photos it uploaded. Not tied to a person. */
  sid: string;
  /** Access-code version at login; changing the code bumps it and signs every device out. */
  v: number;
};

export type AdminSessionPayload = {
  role: 'admin';
};

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error('AUTH_JWT_SECRET is not set (or too short) on the server.');
  }
  return new TextEncoder().encode(secret);
}

async function sign(payload: Record<string, unknown>, ttlSeconds: number): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(getJwtSecret());
}

async function verify<T>(token: string): Promise<T | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload as T;
  } catch {
    return null;
  }
}

function parseCookies(req: HasHeaders): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const out: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

/**
 * `Secure` cookies are dropped by browsers on plain-HTTP sites (e.g. a LAN
 * address), which would make login silently fail. So: COOKIE_SECURE=true/false
 * forces it; otherwise it follows the request (HTTPS directly, or behind a
 * proxy that sets X-Forwarded-Proto — see `trust proxy` in server/index.ts).
 */
function wantSecureCookies(res: ApiResponse): boolean {
  const forced = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (forced === 'true') return true;
  if (forced === 'false') return false;
  return !!res.req?.secure;
}

function setCookie(res: ApiResponse, name: string, value: string, maxAgeSeconds: number): void {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    ...(wantSecureCookies(res) ? ['Secure'] : []),
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`
  ];
  const existing = res.getHeader('Set-Cookie');
  const cookies = Array.isArray(existing) ? existing.map(String) : existing ? [String(existing)] : [];
  cookies.push(parts.join('; '));
  res.setHeader('Set-Cookie', cookies);
}

export async function setAccessSession(res: ApiResponse, payload: AccessSessionPayload): Promise<void> {
  setCookie(res, ACCESS_COOKIE, await sign(payload, ACCESS_TTL_SECONDS), ACCESS_TTL_SECONDS);
}

export async function setAdminSession(res: ApiResponse): Promise<void> {
  const payload: AdminSessionPayload = { role: 'admin' };
  setCookie(res, ADMIN_COOKIE, await sign(payload, ADMIN_TTL_SECONDS), ADMIN_TTL_SECONDS);
}

/** Drop just the staff pass (e.g. a staff device switching to the community code). */
export function clearAdminSession(res: ApiResponse): void {
  setCookie(res, ADMIN_COOKIE, '', 0);
}

export function clearSessionCookies(res: ApiResponse): void {
  setCookie(res, ACCESS_COOKIE, '', 0);
  setCookie(res, ADMIN_COOKIE, '', 0);
  setCookie(res, LEGACY_USER_COOKIE, '', 0);
}

/** Valid community pass for the current access-code version, or null. */
export async function getAccessSession(req: HasHeaders): Promise<AccessSessionPayload | null> {
  const token = parseCookies(req)[ACCESS_COOKIE];
  if (!token) return null;
  const payload = await verify<AccessSessionPayload>(token);
  if (!payload || payload.role !== 'community' || typeof payload.sid !== 'string') return null;
  return payload.v === getAccessCodeVersion() ? payload : null;
}

export async function getAdminSession(req: HasHeaders): Promise<AdminSessionPayload | null> {
  const token = parseCookies(req)[ADMIN_COOKIE];
  if (!token) return null;
  const payload = await verify<AdminSessionPayload>(token);
  return payload && payload.role === 'admin' ? payload : null;
}
