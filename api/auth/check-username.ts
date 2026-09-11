import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getAdminDb } from '../_lib/firebaseAdmin';
import { normalizeUsername } from '../_lib/validate';

/** POST /api/auth/check-username — { username } → { available, reason? } */

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

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
