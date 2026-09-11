import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin';
import { normalizeRecoveryCode, verifySecret } from '../_lib/secrets';
import { resolveUidByIdentifier, type StoredUser } from '../_lib/userLookup';

/**
 * POST /api/auth/verify-recovery-code — { identifier, recoveryCode }
 * First step of "forgot PIN": confirms the code is right before the client
 * shows the new-PIN screen. Not authoritative on its own — the actual
 * reset (reset-pin-with-code.ts) re-verifies the code itself, since a
 * client-side "already verified" flag can't be trusted for something this
 * sensitive. Same account lockout as PIN login (shared failure counter —
 * repeated wrong attempts at either credential should count together).
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const GENERIC_ERROR = 'Incorrect username/email or recovery code.';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = (req.body ?? {}) as { identifier?: unknown; recoveryCode?: unknown };
  const rawIdentifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
  const recoveryCode = normalizeRecoveryCode(body.recoveryCode);
  if (!rawIdentifier || !recoveryCode) {
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

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('verify-recovery-code failed:', err);
    res.status(500).json({ error: 'Could not verify code. Try again shortly.' });
  }
}
