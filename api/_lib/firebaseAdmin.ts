import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getDatabase, type Database } from 'firebase-admin/database';

/**
 * Server-only Firebase Admin SDK — bypasses RTDB security rules entirely,
 * used exclusively for the closed `users`/`usernames`/`otps`/`loginAttempts`
 * paths so they never need to be client-readable.
 *
 * Env (Vercel, not VITE_):
 * - FIREBASE_SERVICE_ACCOUNT_JSON (required) — the full JSON key downloaded
 *   from Firebase Console → Project Settings → Service Accounts → Generate
 *   new private key, pasted as-is (a single-line JSON string).
 * - FIREBASE_DATABASE_URL (required) — same RTDB URL as src/firebase.ts.
 */

let app: App | null = null;
let db: Database | null = null;

function getAdminApp(): App {
  if (app) return app;
  const existing = getApps();
  if (existing.length > 0) {
    app = existing[0];
    return app;
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const databaseURL = process.env.FIREBASE_DATABASE_URL;
  if (!raw || !raw.trim()) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not set.');
  }
  if (!databaseURL || !databaseURL.trim()) {
    throw new Error('FIREBASE_DATABASE_URL is not set.');
  }

  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }

  app = initializeApp({
    credential: cert(serviceAccount as Parameters<typeof cert>[0]),
    databaseURL: databaseURL.trim()
  });
  return app;
}

export function getAdminDb(): Database {
  if (db) return db;
  db = getDatabase(getAdminApp());
  return db;
}
