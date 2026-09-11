import { SignJWT, jwtVerify } from 'jose';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Signed, HTTP-only session cookies (JWT). Not readable by client JS, so an
 * XSS bug can't steal the session the way reading localStorage would let it.
 *
 * Env (Vercel, not VITE_):
 * - AUTH_JWT_SECRET (required) — a long random string, e.g. `openssl rand -hex 32`.
 *   Must differ from AUTH_PEPPER (two independent secrets, one purpose each).
 */

const USER_COOKIE = 'rnw_session';
const ADMIN_COOKIE = 'rnw_admin_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = {
  uid: string;
  username: string;
  email: string;
};

export type AdminSessionPayload = {
  role: 'admin';
  username: string;
};

function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH_JWT_SECRET;
  if (!secret || secret.trim().length < 16) {
    throw new Error('AUTH_JWT_SECRET is not set (or too short) on the server.');
  }
  return new TextEncoder().encode(secret);
}

async function sign(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
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

function parseCookies(req: VercelRequest): Record<string, string> {
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

function setCookie(res: VercelResponse, name: string, value: string, maxAgeSeconds: number): void {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`
  ];
  const existing = res.getHeader('Set-Cookie');
  const cookies = Array.isArray(existing) ? existing.map(String) : existing ? [String(existing)] : [];
  cookies.push(parts.join('; '));
  res.setHeader('Set-Cookie', cookies);
}

export async function setUserSession(res: VercelResponse, payload: SessionPayload): Promise<void> {
  const token = await sign(payload);
  setCookie(res, USER_COOKIE, token, SESSION_TTL_SECONDS);
}

export async function setAdminSession(res: VercelResponse, payload: AdminSessionPayload): Promise<void> {
  const token = await sign(payload);
  setCookie(res, ADMIN_COOKIE, token, SESSION_TTL_SECONDS);
}

export function clearSessionCookies(res: VercelResponse): void {
  setCookie(res, USER_COOKIE, '', 0);
  setCookie(res, ADMIN_COOKIE, '', 0);
}

export async function getUserSession(req: VercelRequest): Promise<SessionPayload | null> {
  const token = parseCookies(req)[USER_COOKIE];
  if (!token) return null;
  return verify<SessionPayload>(token);
}

export async function getAdminSession(req: VercelRequest): Promise<AdminSessionPayload | null> {
  const token = parseCookies(req)[ADMIN_COOKIE];
  if (!token) return null;
  return verify<AdminSessionPayload>(token);
}
