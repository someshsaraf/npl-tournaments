import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin';
import { getAdminSession } from '../_lib/session';
import { generateSixDigitCode, hashSecret, isWeakPin } from '../_lib/secrets';

/**
 * POST /api/auth/admin-reset-pin — { uid } — admin-only.
 * Generates a fresh random PIN, replaces the user's pinHash, clears any
 * lockout, and returns the new PIN once so the admin can relay it to the
 * resident out of band (in person, phone, WhatsApp) — it is never stored
 * or logged in plain form, and this response is the only time it's visible.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const admin = await getAdminSession(req);
  if (!admin) {
    res.status(401).json({ error: 'Not authorized.' });
    return;
  }

  const uid = typeof (req.body as { uid?: unknown } | undefined)?.uid === 'string' ? (req.body as { uid: string }).uid : '';
  if (!uid) {
    res.status(400).json({ error: 'Missing uid.' });
    return;
  }

  try {
    const db = getAdminDb();
    const userRef = db.ref(`users/${uid}`);
    const user = (await userRef.get()).val() as { username?: string } | null;
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    let newPin = generateSixDigitCode();
    while (isWeakPin(newPin)) {
      newPin = generateSixDigitCode();
    }
    const pinHash = await hashSecret(newPin);

    await userRef.update({
      pinHash,
      failedPinAttempts: 0,
      lockedUntil: null
    });

    res.status(200).json({ ok: true, username: user.username, newPin });
  } catch (err) {
    console.error('admin-reset-pin failed:', err);
    res.status(500).json({ error: 'Could not reset PIN.' });
  }
}
