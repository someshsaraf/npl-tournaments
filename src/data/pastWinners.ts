import type { Sport } from './tournamentData';

/**
 * Champions from earlier seasons, entered by admins on the tournament
 * console (Past winners tab) and shown on the sport's resident hub.
 * Stored at pastWinners/{sport}/{id} — admin writes, residents read.
 */
export interface PastWinner {
  id: string;
  year: number;
  category: string;
  winner: string;
  runnerUp: string;
  /** Final score, e.g. "6–4" or "7–6 (7–5)". Optional. */
  score: string;
  /** Position within its year (entry order); lower shows first. */
  order: number;
}

export function pastWinnersPath(sport: Sport): string {
  return `pastWinners/${sport}`;
}

function str(v: unknown, max = 80): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

/** Raw data-store value → clean list, newest year first, then by category. */
export function parsePastWinners(raw: unknown): PastWinner[] {
  if (!raw || typeof raw !== 'object') return [];
  const out: PastWinner[] = [];
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!v || typeof v !== 'object') continue;
    const r = v as Record<string, unknown>;
    const year = typeof r.year === 'number' && Number.isFinite(r.year) ? Math.trunc(r.year) : 0;
    const winner = str(r.winner);
    const category = str(r.category);
    // Rows may be just a category until an admin fills in the names.
    if (!year || (!winner && !category)) continue;
    const order = typeof r.order === 'number' && Number.isFinite(r.order) ? r.order : 0;
    out.push({ id, year, category, winner, runnerUp: str(r.runnerUp), score: str(r.score, 40), order });
  }
  return out.sort((a, b) => b.year - a.year || a.order - b.order || a.id.localeCompare(b.id));
}

/** Group a sorted list by year, newest first. */
export function groupByYear(list: PastWinner[]): Array<{ year: number; winners: PastWinner[] }> {
  const groups: Array<{ year: number; winners: PastWinner[] }> = [];
  for (const w of list) {
    const last = groups[groups.length - 1];
    if (last && last.year === w.year) last.winners.push(w);
    else groups.push({ year: w.year, winners: [w] });
  }
  return groups;
}
