import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import {
  generateRecoveryCode,
  generateSixDigitCode,
  hashSecret,
  isValidSixDigitPin,
  isWeakPin,
  normalizeRecoveryCode,
  verifySecret
} from '../_lib/secrets.js';
import {
  clearSessionCookies,
  getAdminSession,
  getUserSession,
  setAdminSession,
  setUserSession
} from '../_lib/session.js';
import { resolveUidByIdentifier, type StoredUser } from '../_lib/userLookup.js';
import { normalizeEmail, normalizeUsername, emailToKey } from '../_lib/validate.js';

/**
 * Single dynamic route (/api/auth/[action]) fanning out to every auth
 * endpoint, so the Hobby plan's 12-serverless-function cap doesn't get
 * blown past — this used to be 10 separate files under api/auth/.
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const CREDENTIAL_ERROR = 'Incorrect username/email or PIN.';
const RECOVERY_ERROR = 'Incorrect username/email or recovery code.';
const ADMIN_CREDENTIAL_ERROR = 'Incorrect username or password.';

function methodNotAllowed(res: VercelResponse) {
  res.status(405).json({ error: 'Method not allowed' });
}

async function handleCheckUsername(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const username = normalizeUsername((req.body as { username?: unknown } | undefined)?.username);
  if (!username) {
    res.status(200).json({
      available: false,
      reason: '3-20 characters: lowercase letters, numbers, underscore only.'
    });
    return;
  }

  try {
    const db = getAdminDb();
    const existing = (await db.ref(`usernames/${username}`).get()).val();
    res.status(200).json({ available: !existing });
  } catch (err) {
    console.error('check-username failed:', err);
    res.status(500).json({ error: 'Could not check username. Try again shortly.' });
  }
}

async function handleRegister(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

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

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const body = (req.body ?? {}) as { identifier?: unknown; pin?: unknown };
  const rawIdentifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
  const pin = typeof body.pin === 'string' ? body.pin : '';
  if (!rawIdentifier || !isValidSixDigitPin(pin)) {
    res.status(400).json({ error: CREDENTIAL_ERROR });
    return;
  }

  try {
    const db = getAdminDb();
    const uid = await resolveUidByIdentifier(db, rawIdentifier);
    if (!uid) {
      res.status(401).json({ error: CREDENTIAL_ERROR });
      return;
    }

    const userRef = db.ref(`users/${uid}`);
    const user = (await userRef.get()).val() as StoredUser | null;

    if (!user) {
      res.status(401).json({ error: CREDENTIAL_ERROR });
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
        .json({ error: attempts >= MAX_ATTEMPTS ? 'Too many attempts. Try again later.' : CREDENTIAL_ERROR });
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

async function handleLogout(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);
  clearSessionCookies(res);
  res.status(200).json({ ok: true });
}

async function handleMe(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const [user, admin] = await Promise.all([getUserSession(req), getAdminSession(req)]);
  res.status(200).json({
    user: user ? { username: user.username, email: user.email } : null,
    admin: admin ? { username: admin.username } : null
  });
}

async function handleVerifyRecoveryCode(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const body = (req.body ?? {}) as { identifier?: unknown; recoveryCode?: unknown };
  const rawIdentifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
  const recoveryCode = normalizeRecoveryCode(body.recoveryCode);
  if (!rawIdentifier || !recoveryCode) {
    res.status(400).json({ error: RECOVERY_ERROR });
    return;
  }

  try {
    const db = getAdminDb();
    const uid = await resolveUidByIdentifier(db, rawIdentifier);
    if (!uid) {
      res.status(401).json({ error: RECOVERY_ERROR });
      return;
    }

    const userRef = db.ref(`users/${uid}`);
    const user = (await userRef.get()).val() as StoredUser | null;
    if (!user || !user.recoveryCodeHash) {
      res.status(401).json({ error: RECOVERY_ERROR });
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
        .json({ error: attempts >= MAX_ATTEMPTS ? 'Too many attempts. Try again later.' : RECOVERY_ERROR });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('verify-recovery-code failed:', err);
    res.status(500).json({ error: 'Could not verify code. Try again shortly.' });
  }
}

async function handleResetPinWithCode(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const body = (req.body ?? {}) as { identifier?: unknown; recoveryCode?: unknown; newPin?: unknown };
  const rawIdentifier = typeof body.identifier === 'string' ? body.identifier.trim() : '';
  const recoveryCode = normalizeRecoveryCode(body.recoveryCode);
  const newPin = typeof body.newPin === 'string' ? body.newPin : '';

  if (!rawIdentifier || !recoveryCode) {
    res.status(400).json({ error: RECOVERY_ERROR });
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
      res.status(401).json({ error: RECOVERY_ERROR });
      return;
    }

    const userRef = db.ref(`users/${uid}`);
    const user = (await userRef.get()).val() as StoredUser | null;
    if (!user || !user.recoveryCodeHash) {
      res.status(401).json({ error: RECOVERY_ERROR });
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
        .json({ error: attempts >= MAX_ATTEMPTS ? 'Too many attempts. Try again later.' : RECOVERY_ERROR });
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

async function handleAdminLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

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
    res.status(400).json({ error: ADMIN_CREDENTIAL_ERROR });
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
        .json({ error: count >= MAX_ATTEMPTS ? 'Too many attempts. Try again later.' : ADMIN_CREDENTIAL_ERROR });
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

async function handleAdminListUsers(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return methodNotAllowed(res);

  const admin = await getAdminSession(req);
  if (!admin) {
    res.status(401).json({ error: 'Not authorized.' });
    return;
  }

  try {
    const db = getAdminDb();
    const snapshot = await db.ref('users').get();
    const raw = (snapshot.val() ?? {}) as Record<
      string,
      { username?: string; email?: string; createdAt?: string; lockedUntil?: number }
    >;

    const users = Object.entries(raw)
      .map(([uid, u]) => ({
        uid,
        username: u.username ?? '',
        email: u.email ?? '',
        createdAt: u.createdAt ?? '',
        locked: Boolean(u.lockedUntil && u.lockedUntil > Date.now())
      }))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.status(200).json({ users });
  } catch (err) {
    console.error('admin-list-users failed:', err);
    res.status(500).json({ error: 'Could not load users.' });
  }
}

async function handleAdminResetPin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return methodNotAllowed(res);

  const admin = await getAdminSession(req);
  if (!admin) {
    res.status(401).json({ error: 'Not authorized.' });
    return;
  }

  const uid =
    typeof (req.body as { uid?: unknown } | undefined)?.uid === 'string'
      ? (req.body as { uid: string }).uid
      : '';
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

const ROUTES: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<void>> = {
  'check-username': handleCheckUsername,
  register: handleRegister,
  login: handleLogin,
  logout: handleLogout,
  me: handleMe,
  'verify-recovery-code': handleVerifyRecoveryCode,
  'reset-pin-with-code': handleResetPinWithCode,
  'admin-login': handleAdminLogin,
  'admin-list-users': handleAdminListUsers,
  'admin-reset-pin': handleAdminResetPin
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = typeof req.query.action === 'string' ? req.query.action : '';
  const route = ROUTES[action];
  if (!route) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await route(req, res);
}
