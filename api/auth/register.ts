import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin';
import { generateRecoveryCode, hashSecret, isValidSixDigitPin, isWeakPin } from '../_lib/secrets';
import { setUserSession } from '../_lib/session';
import { normalizeEmail, normalizeUsername, emailToKey } from '../_lib/validate';

/**
 * POST /api/auth/register — { email, username, pin }
 * Single-step registration: no email verification (email is an unverified
 * profile/login field, not proven to belong to the registrant — acceptable
 * since nothing in this app emails users yet; revisit if that changes).
 * Claims the username atomically, creates the user record, logs them in.
 */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = (req.body ?? {}) as { email?: unknown; username?: unknown; pin?: unknown };
  const email = normalizeEmail(body.email);
  const username = normalizeUsername(body.username);
  const pin = typeof body.pin === 'string' ? body.pin : '';

  if (!email) {
    res.status(400).json({ error: 'Invalid email.' });
    return;
  }
  if (!username) {
    res.status(400).json({ error: 'Username must be 3-20 characters: lowercase letters, numbers, underscore.' });
    return;
  }
  if (!isValidSixDigitPin(pin)) {
    res.status(400).json({ error: 'PIN must be exactly 6 digits.' });
    return;
  }
  if (isWeakPin(pin)) {
    res.status(400).json({ error: 'Choose a less predictable PIN (not all one digit or a simple run).' });
    return;
  }

  try {
    const db = getAdminDb();
    const emailKey = emailToKey(email);

    const emailRef = db.ref(`emails/${emailKey}`);
    if ((await emailRef.get()).val()) {
      res.status(409).json({ error: 'This email is already registered. Try logging in instead.' });
      return;
    }

    const usernameRef = db.ref(`usernames/${username}`);
    const claim = await usernameRef.transaction((current: unknown) => {
      if (current) return; // abort — already taken
      return 'pending';
    });
    if (!claim.committed) {
      res.status(409).json({ error: 'That username is already taken.' });
      return;
    }

    const usersRef = db.ref('users');
    const newUserRef = usersRef.push();
    const uid = newUserRef.key;
    if (!uid) {
      await usernameRef.remove();
      throw new Error('Could not allocate user id.');
    }

    const pinHash = await hashSecret(pin);
    const recoveryCode = generateRecoveryCode();
    const recoveryCodeHash = await hashSecret(recoveryCode);
    const createdAt = new Date().toISOString();

    try {
      await newUserRef.set({
        username,
        email,
        pinHash,
        recoveryCodeHash,
        createdAt,
        failedPinAttempts: 0
      });
      await usernameRef.set(uid);
      await emailRef.set(uid);
    } catch (writeErr) {
      await usernameRef.remove().catch(() => undefined);
      await newUserRef.remove().catch(() => undefined);
      throw writeErr;
    }

    await setUserSession(res, { uid, username, email });
    res.status(200).json({ ok: true, user: { username, email }, recoveryCode });
  } catch (err) {
    console.error('register failed:', err);
    res.status(500).json({ error: 'Could not create your account. Try again shortly.' });
  }
}
