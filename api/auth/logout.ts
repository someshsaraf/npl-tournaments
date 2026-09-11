import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clearSessionCookies } from '../_lib/session.js';

/** POST /api/auth/logout — clears both user and admin session cookies. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  clearSessionCookies(res);
  res.status(200).json({ ok: true });
}
