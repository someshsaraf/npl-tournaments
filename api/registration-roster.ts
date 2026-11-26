import type { ApiRequest, ApiResponse } from './_lib/http.js';
import { getAdminSession } from './_lib/session.js';
import { isRegistrationKey } from '../src/data/registration.js';
import { rosterFromCsv } from '../server/registrationCsv.js';

/**
 * GET /api/registration-roster?sport=tennis → { players: RosterPlayer[] }
 *
 * The organisers' CSV roster (Kids / Women / Men, Level A/B, singles /
 * doubles) for prefilling Teams & Draw. Admins only.
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!(await getAdminSession(req))) {
    res.status(401).json({ error: 'Admins only.' });
    return;
  }
  const sport = isRegistrationKey(req.query.sport) ? req.query.sport : null;
  if (!sport) {
    res.status(400).json({ error: 'Unknown sport.' });
    return;
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ players: rosterFromCsv(sport) });
}
