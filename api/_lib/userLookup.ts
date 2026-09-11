import type { Database } from 'firebase-admin/database';
import { normalizeEmail, normalizeUsername, emailToKey } from './validate.js';

/** Resolves a login identifier (email or username) to a uid, or null. */
export async function resolveUidByIdentifier(db: Database, rawIdentifier: string): Promise<string | null> {
  const email = normalizeEmail(rawIdentifier);
  if (email) {
    const uid = (await db.ref(`emails/${emailToKey(email)}`).get()).val();
    return typeof uid === 'string' ? uid : null;
  }
  const username = normalizeUsername(rawIdentifier);
  if (username) {
    const uid = (await db.ref(`usernames/${username}`).get()).val();
    return typeof uid === 'string' ? uid : null;
  }
  return null;
}

export type StoredUser = {
  username: string;
  email: string;
  pinHash: string;
  recoveryCodeHash?: string;
  failedPinAttempts?: number;
  lockedUntil?: number;
};
