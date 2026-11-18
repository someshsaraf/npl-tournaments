import type { ApiRequest, ApiResponse } from './_lib/http.js';
import { getAccessSession, getAdminSession } from './_lib/session.js';
import { getAdminDb } from './_lib/db.js';
import {
  isPredictionSport,
  normalizeVilla,
  predictionCategories,
  predictionsOpenPath,
  predictionsPath
} from '../src/data/predictions.js';

/**
 * POST /api/predictions  { sport, categoryId, villa, pick }
 *
 * A villa's predicted winner for one category. Needs the community (or
 * admin) code. Stored at predictions/{sport}/{categoryId}/{villa} — admins
 * only (server/rules.ts); residents see just the counts, which the server
 * keeps at predictionTallies/{sport} (server/predictionTallies.ts).
 *
 * - The category must be open for voting and `pick` one of its announced
 *   entries in the published tournament.
 * - One vote per villa per category, and it can't be changed — an admin
 *   deletes a wrong vote so the villa can vote again.
 * - One vote per device per category too, so one phone can't vote for
 *   every villa. (The device id is the random community-pass id, not a person.)
 */
export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const [access, admin] = await Promise.all([getAccessSession(req), getAdminSession(req)]);
  if (!access && !admin) {
    res.status(401).json({ error: 'Enter the community access code first.' });
    return;
  }

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const sport = isPredictionSport(body.sport) ? body.sport : null;
  const categoryId = typeof body.categoryId === 'string' ? body.categoryId : '';
  const pick = typeof body.pick === 'string' ? body.pick : '';
  const villa = normalizeVilla(body.villa);
  if (!sport) {
    res.status(400).json({ error: 'Unknown sport.' });
    return;
  }
  if (!villa) {
    res.status(400).json({ error: 'Please enter your villa number (letters and digits, e.g. 101 or A-12).' });
    return;
  }

  const db = getAdminDb();
  const published = (await db.ref(`tournaments/${sport}/published`).get()).val();
  const category = predictionCategories(published).find((c) => c.id === categoryId);
  if (!category) {
    res.status(400).json({ error: 'This category is not open for predictions.' });
    return;
  }
  const open = (await db.ref(`${predictionsOpenPath(sport)}/${category.id}`).get()).val() === true;
  if (!open) {
    res.status(403).json({ error: `Voting for ${category.label} is closed.` });
    return;
  }
  const candidate = category.candidates.find((c) => c.id === pick);
  if (!candidate) {
    res.status(400).json({ error: 'Please pick one of the listed players or teams.' });
    return;
  }

  const catRef = db.ref(`${predictionsPath(sport)}/${category.id}`);
  const device = access?.sid ?? null;
  let refusal: { status: number; error: string } | null = null;
  // Single-threaded store → the check and the write happen together.
  await catRef.transaction((current) => {
    const votes = (current && typeof current === 'object' && !Array.isArray(current) ? current : {}) as Record<
      string,
      { device?: unknown } | null
    >;
    if (votes[villa]) {
      refusal = {
        status: 409,
        error: `Villa ${villa} has already voted in ${category.label}. If that wasn't you, ask an organiser to remove it.`
      };
      return undefined;
    }
    if (!admin && device && Object.values(votes).some((v) => v?.device === device)) {
      refusal = { status: 409, error: `This phone has already voted in ${category.label}.` };
      return undefined;
    }
    return { ...votes, [villa]: { pick: candidate.id, at: new Date().toISOString(), ...(device ? { device } : {}) } };
  });
  if (refusal) {
    const { status, error } = refusal;
    res.status(status).json({ error });
    return;
  }
  res.status(200).json({ ok: true, villa, pick: candidate.name, category: category.label });
}
