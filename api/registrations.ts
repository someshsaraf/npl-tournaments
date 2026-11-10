import type { ApiRequest, ApiResponse } from './_lib/http.js';
import { getAccessSession, getAdminSession } from './_lib/session.js';
import { getAdminDb } from './_lib/db.js';
import {
  closesLabel,
  describeSelection,
  registrationOpen,
  isRegistrationKey,
  normalizeName,
  registrationCategories,
  registrationSettingsPath,
  registrationsPath,
  resolveRegistration,
  selectionError
} from '../src/data/registration.js';

/**
 * POST /api/registrations  { sport, name, categories: [ids] }
 *
 * Tournament sign-up from the resident form. Needs the community (or admin)
 * code. One age group (Kids or Adults) with Singles, Doubles or both.
 * Stores { name, categories, createdAt } under registrations/{sport} —
 * readable only by admins (server/rules.ts). One registration per person:
 * a name that's already registered (case/spacing-insensitive) is refused.
 *
 * GET /api/registrations?sport=tennis  → { count }
 *
 * How many people have registered — just the number, never names, so the
 * resident form can show it. Counted live, so admin edits show straight away.
 */

const NAME_RE = /^[\p{L}][\p{L}\p{M}.' -]{1,59}$/u;
const MAX_PER_SPORT = 1000;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  const [access, admin] = await Promise.all([getAccessSession(req), getAdminSession(req)]);
  if (!access && !admin) {
    res.status(401).json({ error: 'Enter the community access code first.' });
    return;
  }
  if (req.method === 'GET') {
    await handleCount(req, res);
    return;
  }

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>;
  const sport = isRegistrationKey(body.sport) ? body.sport : null;
  const db = getAdminDb();
  const config = sport ? resolveRegistration(sport, (await db.ref(registrationSettingsPath(sport)).get()).val()) : undefined;
  if (!sport || !config || config.hidden) {
    res.status(400).json({ error: 'Registration is not open for this sport.' });
    return;
  }

  // Closed for residents after the deadline; staff can still add late entries.
  if (!admin && !registrationOpen(config)) {
    res.status(403).json({ error: `Registration closed on ${closesLabel(config)}. Please contact the organisers.` });
    return;
  }

  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (!NAME_RE.test(name)) {
    res.status(400).json({ error: 'Please enter your full name (letters only, 2–60 characters).' });
    return;
  }
  const categories = registrationCategories(body as { categories?: unknown; category?: unknown });
  const invalid = selectionError(config, categories);
  if (invalid) {
    res.status(400).json({ error: invalid });
    return;
  }

  const existing = ((await db.ref(registrationsPath(sport)).get()).val() ?? {}) as Record<
    string,
    { name?: string; category?: string; categories?: string[] }
  >;
  const rows = Object.values(existing);
  if (rows.length >= MAX_PER_SPORT) {
    res.status(429).json({ error: 'Registrations are full. Please contact the organisers.' });
    return;
  }
  const already = rows.find((r) => typeof r.name === 'string' && normalizeName(r.name) === normalizeName(name));
  if (already) {
    const where = describeSelection(config, registrationCategories(already));
    res.status(409).json({
      error: `${already.name} is already registered (${where}). Each person registers once — ask an organiser if it needs changing.`
    });
    return;
  }

  const ref = db.ref(registrationsPath(sport)).push();
  await ref.set({ name, categories, createdAt: new Date().toISOString() });
  res.status(200).json({ ok: true, name, category: describeSelection(config, categories) });
}

async function handleCount(req: ApiRequest, res: ApiResponse) {
  const sport = isRegistrationKey(req.query.sport) ? req.query.sport : null;
  if (!sport) {
    res.status(400).json({ error: 'Unknown sport.' });
    return;
  }
  const rows = ((await getAdminDb().ref(registrationsPath(sport)).get()).val() ?? {}) as Record<string, { name?: unknown }>;
  const count = Object.values(rows).filter((r) => r && typeof r.name === 'string').length;
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ count });
}
