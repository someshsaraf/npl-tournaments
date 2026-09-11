import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin.js';
import { getAdminSession } from '../_lib/session.js';

/** GET /api/auth/admin-list-users — admin-only. Never returns pinHash. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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
