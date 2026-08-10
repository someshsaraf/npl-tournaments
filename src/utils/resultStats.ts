import type { CompletedMatch } from '../data/tournamentData';

export type ScoredMatch = {
  row: CompletedMatch;
  /** Point games only (excludes best-of series tally when present). */
  pointGames: Array<{ a: number; b: number }>;
  totalPoints: number;
  minMargin: number | null;
  maxMargin: number | null;
  isNailbiter: boolean;
};

export type NamedCount = { name: string; count: number };

export type SideRecord = {
  name: string;
  apps: number;
  wins: number;
  pct: number;
};

export type HighlightMatch = {
  category: string;
  stage: string;
  matchup: string;
  result: string;
  winner: string;
  margin: number | null;
  when: string;
};

export type TournamentStats = {
  totalMatches: number;
  totalPoints: number;
  nailbiterCount: number;
  byCategory: NamedCount[];
  byDay: NamedCount[];
  topWinners: NamedCount[];
  undefeated: SideRecord[];
  hotStreaks: SideRecord[];
  nailbiters: HighlightMatch[];
  blowouts: HighlightMatch[];
  champions: HighlightMatch[];
  avgMarginByCategory: Array<{ name: string; avgMargin: number; matches: number }>;
  /** Short story lines for the Stats page hero. */
  headline: string;
  curiosities: string[];
};

const SCORE_PAIR = /(\d+)\s*[-–]\s*(\d+)/g;

/**
 * Normalize a display name for aggregation.
 * Input: any; empty string if invalid.
 */
export function normalizeName(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Extract point-game scores from a completed match.
 * Prefers structured gameScores; falls back to parsing `result`.
 */
export function extractPointGames(row: CompletedMatch): Array<{ a: number; b: number }> {
  if (!row || typeof row !== 'object') return [];

  const structured = Array.isArray(row.gameScores)
    ? row.gameScores
        .filter(
          (g) =>
            g &&
            typeof g === 'object' &&
            Number.isFinite(g.score1) &&
            Number.isFinite(g.score2)
        )
        .map((g) => ({ a: Number(g.score1), b: Number(g.score2) }))
    : [];

  if (structured.length > 0) return structured;

  const result = typeof row.result === 'string' ? row.result : '';
  const pairs: Array<{ a: number; b: number }> = [];
  for (const m of result.matchAll(SCORE_PAIR)) {
    pairs.push({ a: Number(m[1]), b: Number(m[2]) });
  }
  if (pairs.length === 0) {
    if (Number.isFinite(row.score1) && Number.isFinite(row.score2)) {
      return [{ a: Number(row.score1), b: Number(row.score2) }];
    }
    return [];
  }

  // Best-of-3 style: "0-2 (10-21 · 9-21)" — drop series tally when present.
  if (
    pairs.length >= 2 &&
    pairs[0].a + pairs[0].b <= 3 &&
    pairs[0].a <= 2 &&
    pairs[0].b <= 2
  ) {
    return pairs.slice(1);
  }
  return pairs;
}

function isNailbiterGames(games: Array<{ a: number; b: number }>): boolean {
  return games.some(({ a, b }) => {
    const hi = Math.max(a, b);
    const lo = Math.min(a, b);
    const margin = Math.abs(a - b);
    if (margin > 2) return false;
    // Past deuce / golden territory for race-to-15 or race-to-21.
    if (lo >= 20) return true;
    if (lo >= 14 && hi >= 15) return true;
    return margin <= 2 && lo >= 14;
  });
}

/**
 * Enrich a completed match with derived score metrics.
 */
export function scoreMatch(row: CompletedMatch): ScoredMatch | null {
  if (!row || typeof row !== 'object' || row.status !== 'completed') return null;
  const pointGames = extractPointGames(row);
  const margins = pointGames.map((g) => Math.abs(g.a - g.b));
  const totalPoints = pointGames.reduce((sum, g) => sum + g.a + g.b, 0);
  return {
    row,
    pointGames,
    totalPoints,
    minMargin: margins.length ? Math.min(...margins) : null,
    maxMargin: margins.length ? Math.max(...margins) : null,
    isNailbiter: isNailbiterGames(pointGames)
  };
}

function matchupOf(row: CompletedMatch): string {
  const fromPlayers =
    row.player1 || row.player2
      ? `${row.player1 || row.teamA || 'Side A'} vs ${row.player2 || row.teamB || 'Side B'}`
      : '';
  return (
    fromPlayers ||
    normalizeName(row.details) ||
    `${row.teamA || 'Side A'} vs ${row.teamB || 'Side B'}`
  );
}

function whenOf(row: CompletedMatch): string {
  return [row.completedDate, row.completedTime].filter(Boolean).join(' ');
}

function toHighlight(s: ScoredMatch, margin: number | null): HighlightMatch {
  return {
    category: normalizeName(s.row.category) || 'Match',
    stage: normalizeName(s.row.stage),
    matchup: matchupOf(s.row),
    result: normalizeName(s.row.result) || '—',
    winner: normalizeName(s.row.winnerName) || '—',
    margin,
    when: whenOf(s.row)
  };
}

function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/[\s/&,]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
}

function sideMatchesWinner(side: string, winner: string): boolean {
  const wTok = tokens(winner);
  if (wTok.length === 0) return false;
  const s = side.toLowerCase();
  return wTok.some((t) => s.includes(t));
}

function countMapToList(map: Map<string, number>, limit = 12): NamedCount[] {
  return [...map.entries()]
    .filter(([name, count]) => name && count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

/**
 * Compute public tournament stats from completed matches.
 * Concurrency: pure/stateless — safe for React render/memo.
 * Security: read-only over caller-provided rows; no I/O.
 * Validation: ignores non-completed / malformed rows.
 */
export function computeTournamentStats(rows: unknown): TournamentStats {
  const list = Array.isArray(rows) ? rows : [];
  const scored: ScoredMatch[] = [];
  for (const raw of list) {
    const s = scoreMatch(raw as CompletedMatch);
    if (s) scored.push(s);
  }

  const byCategory = new Map<string, number>();
  const byDay = new Map<string, number>();
  const winners = new Map<string, number>();
  const sideApps = new Map<string, number>();
  const sideWins = new Map<string, number>();
  const marginSum = new Map<string, { sum: number; n: number }>();

  let totalPoints = 0;
  let nailbiterCount = 0;

  for (const s of scored) {
    totalPoints += s.totalPoints;
    if (s.isNailbiter) nailbiterCount += 1;

    const cat = normalizeName(s.row.category) || 'Other';
    byCategory.set(cat, (byCategory.get(cat) || 0) + 1);

    const day = normalizeName(s.row.completedDate) || 'Unknown';
    byDay.set(day, (byDay.get(day) || 0) + 1);

    const winner = normalizeName(s.row.winnerName);
    if (winner) winners.set(winner, (winners.get(winner) || 0) + 1);

    if (s.minMargin != null) {
      const acc = marginSum.get(cat) || { sum: 0, n: 0 };
      acc.sum += s.minMargin;
      acc.n += 1;
      marginSum.set(cat, acc);
    }

    const matchup = matchupOf(s.row);
    const parts = matchup.split(/\s+vs\s+/i);
    if (parts.length === 2) {
      for (const part of parts) {
        const side = normalizeName(part);
        if (!side || /^tbd$/i.test(side) || /^winner pool/i.test(side) || /^runner-up/i.test(side)) {
          continue;
        }
        sideApps.set(side, (sideApps.get(side) || 0) + 1);
      }
      if (winner) {
        for (const part of parts) {
          const side = normalizeName(part);
          if (!side) continue;
          if (sideMatchesWinner(side, winner)) {
            sideWins.set(side, (sideWins.get(side) || 0) + 1);
            break;
          }
        }
      }
    }
  }

  const sideRecords: SideRecord[] = [...sideApps.entries()]
    .map(([name, apps]) => {
      const wins = sideWins.get(name) || 0;
      return { name, apps, wins, pct: apps > 0 ? Math.round((100 * wins) / apps) : 0 };
    })
    .sort((a, b) => b.pct - a.pct || b.wins - a.wins || a.name.localeCompare(b.name));

  const undefeated = sideRecords.filter((r) => r.apps >= 3 && r.wins === r.apps).slice(0, 8);
  const hotStreaks = sideRecords.filter((r) => r.apps >= 3).slice(0, 10);

  const nailbiters = scored
    .filter((s) => s.isNailbiter || (s.minMargin != null && s.minMargin <= 2))
    .sort((a, b) => (a.minMargin ?? 99) - (b.minMargin ?? 99) || b.totalPoints - a.totalPoints)
    .slice(0, 10)
    .map((s) => toHighlight(s, s.minMargin));

  const blowouts = scored
    .filter((s) => s.maxMargin != null)
    .sort((a, b) => (b.maxMargin ?? 0) - (a.maxMargin ?? 0))
    .slice(0, 8)
    .map((s) => toHighlight(s, s.maxMargin));

  const champions = scored
    .filter((s) => typeof s.row.stage === 'string' && /^final$/i.test(s.row.stage.trim()))
    .sort((a, b) => {
      const da = `${a.row.completedDate} ${a.row.completedTime}`;
      const db_ = `${b.row.completedDate} ${b.row.completedTime}`;
      return da.localeCompare(db_);
    })
    .map((s) => toHighlight(s, s.minMargin));

  const avgMarginByCategory = [...marginSum.entries()]
    .map(([name, { sum, n }]) => ({
      name,
      avgMargin: Math.round((sum / n) * 10) / 10,
      matches: n
    }))
    .sort((a, b) => a.avgMargin - b.avgMargin);

  const byDayList = countMapToList(byDay, 20);
  byDayList.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const headline = buildHeadline({
    nailbiters,
    champions,
    undefeated,
    avgMarginByCategory,
    byDay: byDayList,
    totalMatches: scored.length
  });
  const curiosities = buildCuriosities({
    champions,
    undefeated,
    topWinners: countMapToList(winners, 12),
    nailbiters,
    blowouts,
    avgMarginByCategory,
    totalPoints,
    totalMatches: scored.length
  });

  return {
    totalMatches: scored.length,
    totalPoints,
    nailbiterCount,
    byCategory: countMapToList(byCategory, 20),
    byDay: byDayList,
    topWinners: countMapToList(winners, 12),
    undefeated,
    hotStreaks,
    nailbiters,
    blowouts,
    champions,
    avgMarginByCategory,
    headline,
    curiosities
  };
}

function buildHeadline(input: {
  nailbiters: HighlightMatch[];
  champions: HighlightMatch[];
  undefeated: SideRecord[];
  avgMarginByCategory: Array<{ name: string; avgMargin: number; matches: number }>;
  byDay: NamedCount[];
  totalMatches: number;
}): string {
  const parts: string[] = [];
  const topNail = input.nailbiters[0];
  if (topNail) {
    parts.push(
      `Closest scrap: ${topNail.winner} in ${topNail.category}${
        topNail.stage ? ` (${topNail.stage})` : ''
      } — ${topNail.result}.`
    );
  }
  if (input.champions.length > 0) {
    parts.push(`${input.champions.length} category final${input.champions.length === 1 ? '' : 's'} recorded.`);
  }
  const tight = input.avgMarginByCategory[0];
  const wide = input.avgMarginByCategory[input.avgMarginByCategory.length - 1];
  if (tight && wide && tight.name !== wide.name) {
    parts.push(
      `${tight.name} was the tightest (~${tight.avgMargin} pt avg margin); ${wide.name} the widest (~${wide.avgMargin}).`
    );
  }
  if (input.byDay[0]) {
    parts.push(`Busiest day: ${input.byDay[0].name} with ${input.byDay[0].count} completions.`);
  }
  if (parts.length === 0) {
    return `${input.totalMatches} completed match${input.totalMatches === 1 ? '' : 'es'} so far.`;
  }
  return parts.join(' ');
}

function buildCuriosities(input: {
  champions: HighlightMatch[];
  undefeated: SideRecord[];
  topWinners: NamedCount[];
  nailbiters: HighlightMatch[];
  blowouts: HighlightMatch[];
  avgMarginByCategory: Array<{ name: string; avgMargin: number; matches: number }>;
  totalPoints: number;
  totalMatches: number;
}): string[] {
  const out: string[] = [];
  for (const u of input.undefeated.slice(0, 3)) {
    out.push(`${u.name} finished undefeated at ${u.wins}–0.`);
  }
  const multiChamp = input.topWinners.find((w) => w.count >= 4);
  if (multiChamp && !input.undefeated.some((u) => u.name === multiChamp.name)) {
    out.push(`${multiChamp.name} leads the board with ${multiChamp.count} recorded wins.`);
  }
  const finalNail = input.nailbiters.find((n) => /^final$/i.test(n.stage));
  if (finalNail) {
    out.push(
      `Finals drama: ${finalNail.category} went to ${finalNail.result} — ${finalNail.winner}.`
    );
  }
  if (input.blowouts[0]?.margin != null && input.blowouts[0].margin >= 12) {
    out.push(
      `Biggest gap: ${input.blowouts[0].result} in ${input.blowouts[0].category} (Δ ${input.blowouts[0].margin}).`
    );
  }
  if (input.totalMatches > 0) {
    out.push(
      `About ${Math.round(input.totalPoints / input.totalMatches)} points per match on average across formats.`
    );
  }
  return out.slice(0, 4);
}
