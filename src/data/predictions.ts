/**
 * Winner predictions: each villa picks who it thinks will win a category.
 * Shared by the browser and the server — no imports, so the server can use
 * it as-is.
 *
 * Data (see server/rules.ts):
 *   predictions/{sport}/{categoryId}/{villa}   { pick: entryId, at }  admins only
 *                                              (villa → pick; residents vote via
 *                                              POST /api/predictions)
 *   predictionTallies/{sport}/{categoryId}     { [entryId]: count }   everyone
 *                                              (kept in step by the server)
 *   predictionsOpen/{sport}/{categoryId}       true while voting is open (admins)
 *
 * One vote per villa per category; a vote can't be changed — an admin
 * deletes a wrong one and the villa votes again. Villa numbers are typed
 * in on trust (everyone shares one access code), so they stay admin-only.
 */

export type PredictionSport = 'badminton' | 'tennis';

export function isPredictionSport(v: unknown): v is PredictionSport {
  return v === 'badminton' || v === 'tennis';
}

export const PREDICTIONS_TOP = 'predictions';
export const PREDICTION_TALLIES_TOP = 'predictionTallies';
export const PREDICTIONS_OPEN_TOP = 'predictionsOpen';

export const predictionsPath = (sport: PredictionSport) => `${PREDICTIONS_TOP}/${sport}`;
export const predictionTalliesPath = (sport: PredictionSport) => `${PREDICTION_TALLIES_TOP}/${sport}`;
export const predictionsOpenPath = (sport: PredictionSport) => `${PREDICTIONS_OPEN_TOP}/${sport}`;

/**
 * "  a-101 " → "A-101". Letters, digits and one separator (- or /, stored
 * as -); 1–10 characters. Returns null when it doesn't look like a villa.
 */
export function normalizeVilla(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toUpperCase().replace(/\s+/g, '').replace(/\//g, '-');
  return /^[A-Z0-9]{1,6}(-[A-Z0-9]{1,6})?$/.test(v) && v.length <= 10 ? v : null;
}

export interface PredictionCandidate {
  id: string;
  name: string;
}

export interface PredictionCategory {
  id: string;
  label: string;
  candidates: PredictionCandidate[];
}

function list(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  return v && typeof v === 'object' ? Object.values(v) : [];
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

const FORMAT: Record<string, string> = { singles: 'Singles', doubles: 'Doubles', team: 'Team Championship' };
const DIVISION: Record<string, string> = { kids: 'Kids', adults: 'Adults', women: 'Women' };

/**
 * Categories with announced players/teams, from a published tournament (raw
 * data-store value, so the server can read it too). A category needs at
 * least two entries to be votable.
 */
export function predictionCategories(published: unknown): PredictionCategory[] {
  if (!published || typeof published !== 'object') return [];
  const out: PredictionCategory[] = [];
  for (const c of list((published as Record<string, unknown>).categories)) {
    if (!c || typeof c !== 'object') continue;
    const cat = c as Record<string, unknown>;
    const id = str(cat.id);
    if (!id) continue;
    const format = str(cat.format);
    const division = str(cat.division);
    const label =
      str(cat.name) || (format === 'team' || !division ? FORMAT[format] ?? 'Category' : `${DIVISION[division] ?? division} ${FORMAT[format] ?? format}`);
    const seen = new Set<string>();
    const candidates: PredictionCandidate[] = [];
    for (const p of list(cat.pools)) {
      for (const e of list((p as Record<string, unknown> | null)?.entries)) {
        const entry = (e ?? {}) as Record<string, unknown>;
        const eid = str(entry.id);
        const name = str(entry.name);
        if (!eid || !name || seen.has(eid)) continue;
        seen.add(eid);
        candidates.push({ id: eid, name });
      }
    }
    if (candidates.length >= 2) out.push({ id, label, candidates });
  }
  return out;
}

/** predictions/{sport} → { [categoryId]: { [entryId]: count } } (numbers only). */
export function predictionTallies(rawVotes: unknown): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  if (!rawVotes || typeof rawVotes !== 'object') return out;
  for (const [catId, villas] of Object.entries(rawVotes as Record<string, unknown>)) {
    if (!villas || typeof villas !== 'object') continue;
    const counts: Record<string, number> = {};
    for (const v of Object.values(villas as Record<string, unknown>)) {
      const pick = v && typeof v === 'object' ? str((v as Record<string, unknown>).pick) : '';
      if (pick) counts[pick] = (counts[pick] ?? 0) + 1;
    }
    if (Object.keys(counts).length) out[catId] = counts;
  }
  return out;
}

/** Vote rows for the admin list: villa → pick per category, newest first. */
export interface PredictionVote {
  categoryId: string;
  villa: string;
  pick: string;
  at: string;
}

export function predictionVotes(rawVotes: unknown): PredictionVote[] {
  const out: PredictionVote[] = [];
  if (!rawVotes || typeof rawVotes !== 'object') return out;
  for (const [categoryId, villas] of Object.entries(rawVotes as Record<string, unknown>)) {
    if (!villas || typeof villas !== 'object') continue;
    for (const [villa, v] of Object.entries(villas as Record<string, unknown>)) {
      const r = (v ?? {}) as Record<string, unknown>;
      out.push({ categoryId, villa, pick: str(r.pick), at: str(r.at) });
    }
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
