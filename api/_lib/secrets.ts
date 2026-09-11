import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';

/**
 * PIN/password hashing — bcrypt (slow, one-way, salted per-hash) plus a
 * server-side pepper appended before hashing. The pepper lives only in an
 * env var, never in the database, so a full DB leak alone still isn't
 * enough to crack hashes offline the way a bare salted hash would be.
 *
 * Env (Vercel, not VITE_):
 * - AUTH_PEPPER (required) — a long random string, e.g. `openssl rand -hex 32`.
 */

const BCRYPT_ROUNDS = 12;

function getPepper(): string {
  const pepper = process.env.AUTH_PEPPER;
  if (!pepper || pepper.trim().length < 16) {
    throw new Error('AUTH_PEPPER is not set (or too short) on the server.');
  }
  return pepper;
}

function withPepper(secret: string): string {
  return `${secret}:${getPepper()}`;
}

export async function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(withPepper(secret), BCRYPT_ROUNDS);
}

export async function verifySecret(secret: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(withPepper(secret), hash);
  } catch {
    return false;
  }
}

export function isValidSixDigitPin(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{6}$/.test(pin);
}

/** Rejects PINs with zero real entropy (repeated digit, or a simple run like 123456/654321). */
export function isWeakPin(pin: string): boolean {
  if (/^(\d)\1{5}$/.test(pin)) return true;
  const ascending = '0123456789';
  const descending = '9876543210';
  return ascending.includes(pin) || descending.includes(pin);
}

/** Cryptographically secure — never use Math.random() for OTP codes. */
export function generateSixDigitCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

// Unambiguous alphabet — no 0/O, 1/I/l — so a hand-written copy stays readable.
const RECOVERY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * A 12-character recovery code (grouped XXXX-XXXX-XXXX), ~59 bits of
 * entropy — this is the sole proof of identity for "forgot PIN" since
 * there's no email verification, so it needs to be far stronger than the
 * 6-digit PIN it can reset. Shown to the user exactly once; only its hash
 * is ever stored.
 */
export function generateRecoveryCode(): string {
  const chars = Array.from({ length: 12 }, () => RECOVERY_ALPHABET[randomInt(0, RECOVERY_ALPHABET.length)]);
  return `${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`;
}

export function normalizeRecoveryCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (cleaned.length !== 12) return null;
  return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}-${cleaned.slice(8, 12)}`;
}
