import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserSession, getAdminSession } from '../_lib/session';

/** GET /api/auth/me — current session, if any (user and/or admin). */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const [user, admin] = await Promise.all([getUserSession(req), getAdminSession(req)]);
  res.status(200).json({
    user: user ? { username: user.username, email: user.email } : null,
    admin: admin ? { username: admin.username } : null
  });
}
