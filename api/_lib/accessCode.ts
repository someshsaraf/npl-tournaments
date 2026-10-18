import { createHash, timingSafeEqual } from 'node:crypto';
import { getStore } from '../../server/store.js';
import { hashSecret, verifySecret } from './secrets.js';

/**
 * The two shared codes that replace individual accounts — no personal data.
 *
 * Community code (residents, court screens):
 *   Starts as COMMUNITY_ACCESS_CODE from .env. Staff can change it from
 *   /admin/access; the new one is stored hashed under `access/` (server-only
 *   data) and bumps `access/version`, which signs every device out.
 *   Case- and spacing-insensitive, so it's easy to type on a TV remote.
 *
 * Admin code (staff): fixed, ADMIN_CODE_HASH in .env (bcrypt + AUTH_PEPPER,
 * from `node scripts/hash-admin-password.mjs --generate`).
 */

const STORE_PATH = 'access';

type StoredAccess = { codeHash?: string; version?: number; updatedAt?: string };

function stored(): StoredAccess {
  const v = getStore().get(STORE_PATH);
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as StoredAccess) : {};
}

export function getAccessCodeVersion(): number {
  const v = Number(stored().version);
  return Number.isFinite(v) && v >= 1 ? v : 1;
}

/** "Falcon  Court-27 " → "falcon court-27". Null if too short/long. */
export function normalizeCommunityCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  return code.length >= 6 && code.length <= 64 ? code : null;
}

function sha(s: string): Buffer {
  return createHash('sha256').update(s).digest();
}

export function communityCodeConfigured(): boolean {
  return !!stored().codeHash || !!normalizeCommunityCode(process.env.COMMUNITY_ACCESS_CODE);
}

export async function verifyCommunityCode(raw: unknown): Promise<boolean> {
  const code = normalizeCommunityCode(raw);
  if (!code) return false;
  const { codeHash } = stored();
  if (codeHash) return verifySecret(code, codeHash);
  const envCode = normalizeCommunityCode(process.env.COMMUNITY_ACCESS_CODE);
  return !!envCode && timingSafeEqual(sha(code), sha(envCode));
}

/** Replace the community code; every device currently unlocked is signed out. */
export async function setCommunityCode(raw: unknown): Promise<void> {
  const code = normalizeCommunityCode(raw);
  if (!code) throw new Error('The access code must be 6–64 characters.');
  getStore().set(STORE_PATH, {
    codeHash: await hashSecret(code),
    version: getAccessCodeVersion() + 1,
    updatedAt: new Date().toISOString()
  });
}

export function communityCodeInfo(): { source: 'env' | 'custom'; updatedAt: string | null } {
  const s = stored();
  return { source: s.codeHash ? 'custom' : 'env', updatedAt: s.updatedAt ?? null };
}

export function adminCodeHash(): string {
  // ADMIN_PASSWORD_HASH is the pre-access-code name; still accepted.
  return (process.env.ADMIN_CODE_HASH || process.env.ADMIN_PASSWORD_HASH || '').trim();
}

export async function verifyAdminCode(raw: unknown): Promise<boolean> {
  const hash = adminCodeHash();
  if (!hash || typeof raw !== 'string' || !raw.trim() || raw.length > 200) return false;
  const code = raw.trim();
  if (await verifySecret(code, hash)) return true;
  // Generated codes are upper-case (ABCD-EFGH-…); forgive lower-case typing on phones.
  return code !== code.toUpperCase() && verifySecret(code.toUpperCase(), hash);
}

// ─── attempt throttling ─────────────────────────────────────────────────────
// Per client IP and kind, in memory. Per-IP (not global) so someone guessing
// can't lock every resident or the staff out.

const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; first: number }>();

export function isThrottled(kind: 'community' | 'admin', ip: string): boolean {
  const a = attempts.get(`${kind}:${ip}`);
  if (!a) return false;
  if (Date.now() - a.first > WINDOW_MS) {
    attempts.delete(`${kind}:${ip}`);
    return false;
  }
  return a.count >= MAX_ATTEMPTS;
}

export function recordFailure(kind: 'community' | 'admin', ip: string): void {
  const key = `${kind}:${ip}`;
  const a = attempts.get(key);
  if (!a || Date.now() - a.first > WINDOW_MS) attempts.set(key, { count: 1, first: Date.now() });
  else a.count += 1;
  if (attempts.size > 10_000) attempts.clear(); // bound memory under abuse
}

export function clearFailures(kind: 'community' | 'admin', ip: string): void {
  attempts.delete(`${kind}:${ip}`);
}
