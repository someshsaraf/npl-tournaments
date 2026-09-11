import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { verifySecret } from '../_lib/secrets.js';
import { setAdminSession } from '../_lib/session.js';

/**
 * POST /api/auth/admin-login — { username, password }
 *
 * Env (Vercel, not VITE_):
 * - ADMIN_USERNAME (required)
 * - ADMIN_PASSWORD_HASH (required) — bcrypt+pepper hash, NOT the raw
 *   password. Generate with the same AUTH_PEPPER this app uses; see
 *   scripts/hash-admin-password.mjs.
 *
 * Same lockout pattern as user login — attempts tracked in RTDB under
 * loginAttempts/admin (closed path, admin-SDK only).
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const GENERIC_ERROR = 'Incorrect username or password.';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminUsername || !adminPasswordHash) {
    res.status(503).json({ error: 'Admin login is not configured on the server.' });
    return;
  }

  const body = (req.body ?? {}) as { username?: unknown; password?: unknown };
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!username || !password) {
    res.status(400).json({ error: GENERIC_ERROR });
    return;
  }

  try {
    const db = getAdminDb();
    const attemptsRef = db.ref('loginAttempts/admin');
    const attemptState = (await attemptsRef.get()).val() as
      | { count?: number; lockedUntil?: number }
      | null;

    if (attemptState?.lockedUntil && Date.now() < attemptState.lockedUntil) {
      res.status(423).json({ error: 'Too many attempts. Try again later.' });
      return;
    }

    // Constant-shape check: always run bcrypt.compare even on a username
    // mismatch, so response timing doesn't reveal whether the username was right.
    const usernameOk = username === adminUsername;
    const passwordOk = await verifySecret(password, adminPasswordHash);

    if (!usernameOk || !passwordOk) {
      const count = (attemptState?.count ?? 0) + 1;
      const update: Record<string, unknown> = { count };
      if (count >= MAX_ATTEMPTS) {
        update.lockedUntil = Date.now() + LOCKOUT_MS;
        update.count = 0;
      }
      await attemptsRef.set(update);
      res
        .status(count >= MAX_ATTEMPTS ? 423 : 401)
        .json({ error: count >= MAX_ATTEMPTS ? 'Too many attempts. Try again later.' : GENERIC_ERROR });
      return;
    }

    await attemptsRef.remove();
    await setAdminSession(res, { role: 'admin', username: adminUsername });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('admin-login failed:', err);
    res.status(500).json({ error: 'Could not log in. Try again shortly.' });
  }
}
