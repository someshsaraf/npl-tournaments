import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin';
import { verifySecret, isValidSixDigitPin } from '../_lib/secrets';
import { setUserSession } from '../_lib/session';
import { resolveUidByIdentifier, type StoredUser } from '../_lib/userLookup';

/**
 * POST /api/auth/login — { identifier, pin }
 * `identifier` may be an email or a username. Errors are deliberately
 * generic (never "wrong PIN" vs "no such account") to avoid confirming
 * which accounts exist. Failed attempts lock the account temporarily —
 * the real defense for a low-entropy 6-digit PIN is stopping online
 * guessing, not just the hash strength.
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const GENERIC_ERROR = 'Incorrect username/email or PIN.';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = (req.body ?? {}) as { identifier?: unknown; pin?: unknown };
  const rawIdentifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
  const pin = typeof body.pin === 'string' ? body.pin : '';
  if (!rawIdentifier || !isValidSixDigitPin(pin)) {
    res.status(400).json({ error: GENERIC_ERROR });
    return;
  }

  try {
    const db = getAdminDb();
    const uid = await resolveUidByIdentifier(db, rawIdentifier);
    if (!uid) {
      res.status(401).json({ error: GENERIC_ERROR });
      return;
    }

    const userRef = db.ref(`users/${uid}`);
    const user = (await userRef.get()).val() as StoredUser | null;

    if (!user) {
      res.status(401).json({ error: GENERIC_ERROR });
      return;
    }

    if (user.lockedUntil && Date.now() < user.lockedUntil) {
      res.status(423).json({ error: 'Too many attempts. Try again later.' });
      return;
    }

    const matches = await verifySecret(pin, user.pinHash);
    if (!matches) {
      const attempts = (user.failedPinAttempts ?? 0) + 1;
      const update: Record<string, unknown> = { failedPinAttempts: attempts };
      if (attempts >= MAX_ATTEMPTS) {
        update.lockedUntil = Date.now() + LOCKOUT_MS;
        update.failedPinAttempts = 0;
      }
      await userRef.update(update);
      res
        .status(attempts >= MAX_ATTEMPTS ? 423 : 401)
        .json({ error: attempts >= MAX_ATTEMPTS ? 'Too many attempts. Try again later.' : GENERIC_ERROR });
      return;
    }

    if (user.failedPinAttempts) {
      await userRef.update({ failedPinAttempts: 0, lockedUntil: null });
    }

    await setUserSession(res, { uid, username: user.username, email: user.email });
    res.status(200).json({ ok: true, user: { username: user.username, email: user.email } });
  } catch (err) {
    console.error('login failed:', err);
    res.status(500).json({ error: 'Could not log in. Try again shortly.' });
  }
}
