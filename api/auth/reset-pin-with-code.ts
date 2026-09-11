import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import {
  generateRecoveryCode,
  hashSecret,
  isValidSixDigitPin,
  isWeakPin,
  normalizeRecoveryCode,
  verifySecret
} from '../_lib/secrets.js';
import { setUserSession } from '../_lib/session.js';
import { resolveUidByIdentifier, type StoredUser } from '../_lib/userLookup.js';

/**
 * POST /api/auth/reset-pin-with-code — { identifier, recoveryCode, newPin }
 * Re-verifies the recovery code (authoritative check — never trust a prior
 * client-side "verified" state for something this sensitive), then sets
 * the new PIN and rotates the recovery code so the old, now-displayed-once
 * code can't be reused. Logs the user in, same as a normal login would.
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const GENERIC_ERROR = 'Incorrect username/email or recovery code.';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = (req.body ?? {}) as { identifier?: unknown; recoveryCode?: unknown; newPin?: unknown };
  const rawIdentifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
  const recoveryCode = normalizeRecoveryCode(body.recoveryCode);
  const newPin = typeof body.newPin === 'string' ? body.newPin : '';

  if (!rawIdentifier || !recoveryCode) {
    res.status(400).json({ error: GENERIC_ERROR });
    return;
  }
  if (!isValidSixDigitPin(newPin)) {
    res.status(400).json({ error: 'PIN must be exactly 6 digits.' });
    return;
  }
  if (isWeakPin(newPin)) {
    res.status(400).json({ error: 'Choose a less predictable PIN (not all one digit or a simple run).' });
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
    if (!user || !user.recoveryCodeHash) {
      res.status(401).json({ error: GENERIC_ERROR });
      return;
    }

    if (user.lockedUntil && Date.now() < user.lockedUntil) {
      res.status(423).json({ error: 'Too many attempts. Try again later.' });
      return;
    }

    const matches = await verifySecret(recoveryCode, user.recoveryCodeHash);
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

    const pinHash = await hashSecret(newPin);
    const newRecoveryCode = generateRecoveryCode();
    const recoveryCodeHash = await hashSecret(newRecoveryCode);

    await userRef.update({
      pinHash,
      recoveryCodeHash,
      failedPinAttempts: 0,
      lockedUntil: null
    });

    await setUserSession(res, { uid, username: user.username, email: user.email });
    res.status(200).json({
      ok: true,
      user: { username: user.username, email: user.email },
      newRecoveryCode
    });
  } catch (err) {
    console.error('reset-pin-with-code failed:', err);
    res.status(500).json({ error: 'Could not reset PIN. Try again shortly.' });
  }
}
