import bcrypt from 'bcryptjs';

/**
 * Access-code hashing — bcrypt (slow, one-way, salted per-hash) plus a
 * server-side pepper appended before hashing. The pepper lives only in an
 * env var, never in the database, so a full DB leak alone still isn't
 * enough to crack hashes offline the way a bare salted hash would be.
 *
 * Env (server .env, never VITE_):
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
