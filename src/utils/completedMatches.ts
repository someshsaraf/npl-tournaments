import type { CompletedMatch, Fixture, MatchState } from '../data/tournamentData';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/** Formats a Date as `31-Jul-26` (same style as schedule PDF). */
export function formatMatchDate(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('formatMatchDate requires a valid Date');
  }
  const day = date.getDate();
  const mon = MONTHS[date.getMonth()];
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${mon}-${year}`;
}

/** Formats a Date as `HH:mm` (24h local). */
export function formatMatchTime(date: Date): string {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw new Error('formatMatchTime requires a valid Date');
  }
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Builds a CompletedMatch record from the live match + schedule fixture.
 * Concurrency: pure/stateless — caller writes to Firebase.
 */
export function buildCompletedMatch(
  match: MatchState,
  fixture: Fixture | undefined,
  completedAt: Date = new Date()
): CompletedMatch {
  if (!match || typeof match !== 'object') {
    throw new Error('buildCompletedMatch: match is required');
  }
  if (match.gameWinner !== 1 && match.gameWinner !== 2) {
    throw new Error('buildCompletedMatch: match has no winner');
  }
  if (!(completedAt instanceof Date) || Number.isNaN(completedAt.getTime())) {
    throw new Error('buildCompletedMatch: completedAt must be a valid Date');
  }

  const fixtureId =
    typeof match.currentMatchId === 'string' && match.currentMatchId.trim()
      ? match.currentMatchId.trim()
      : `unknown-${completedAt.getTime()}`;

  const score1 = Number.isFinite(match.score1) ? match.score1 : 0;
  const score2 = Number.isFinite(match.score2) ? match.score2 : 0;
  const winnerSide = match.gameWinner;
  const winnerName =
    winnerSide === 1
      ? (match.player1 || match.teamA || 'Side A')
      : (match.player2 || match.teamB || 'Side B');

  return {
    id: fixtureId,
    fixtureId,
    category: match.category || fixture?.category || '',
    stage: match.stage || fixture?.stage || '',
    details: fixture?.details || `${match.player1 || match.teamA} vs ${match.player2 || match.teamB}`,
    scheduledDate: fixture?.date || '',
    scheduledTime: fixture?.time || '',
    teamA: match.teamA || fixture?.teamA || '',
    teamB: match.teamB || fixture?.teamB || '',
    player1: match.player1 || '',
    player2: match.player2 || '',
    score1,
    score2,
    maxPoints: match.maxPoints === 21 ? 21 : 11,
    winnerSide,
    winnerName,
    result: `${score1}-${score2}`,
    status: 'completed',
    completedAt: completedAt.toISOString(),
    completedDate: formatMatchDate(completedAt),
    completedTime: formatMatchTime(completedAt),
    isTrump: !!match.isTrump
  };
}

/** Merge static fixtures with completed-match overlays from Firebase. */
export function mergeFixturesWithResults(
  fixtures: Fixture[],
  completedById: Record<string, CompletedMatch>
): Fixture[] {
  if (!Array.isArray(fixtures)) return [];
  const map = completedById && typeof completedById === 'object' ? completedById : {};

  return fixtures.map((fixture) => {
    const done = map[fixture.id];
    if (!done || done.status !== 'completed') {
      return { ...fixture, status: 'scheduled' as const };
    }
    return {
      ...fixture,
      status: 'completed' as const,
      result: done.result,
      winnerName: done.winnerName,
      completedAt: done.completedAt,
      completedDate: done.completedDate,
      completedTime: done.completedTime,
      finalScore1: done.score1,
      finalScore2: done.score2
    };
  });
}

export function completedMatchesFromFirebase(
  raw: unknown
): Record<string, CompletedMatch> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, CompletedMatch> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const row = value as Partial<CompletedMatch>;
    if (row.status !== 'completed') continue;
    if (typeof row.fixtureId !== 'string' && typeof row.id !== 'string') continue;
    const id = (row.fixtureId || row.id || key).trim();
    if (!id) continue;

    const base = { ...(row as CompletedMatch), id, fixtureId: id };
    // Prefer ISO completedAt as source of truth for display date/time
    const parsed = Date.parse(base.completedAt || '');
    if (Number.isFinite(parsed)) {
      const when = new Date(parsed);
      base.completedDate = formatMatchDate(when);
      base.completedTime = formatMatchTime(when);
    }
    out[id] = base;
  }
  return out;
}

export function sortCompletedMatches(rows: CompletedMatch[]): CompletedMatch[] {
  return [...rows].sort((a, b) => {
    const ta = Date.parse(a.completedAt || '') || 0;
    const tb = Date.parse(b.completedAt || '') || 0;
    return tb - ta;
  });
}

export type ActualPlayTime = {
  /** ISO timestamp when the match was actually finished/saved */
  actualAt: string;
  /** Local date `31-Jul-26` from actualAt */
  actualDate: string;
  /** Local time `HH:mm` from actualAt */
  actualTime: string;
  /** Combined local display string */
  actualDateTime: string;
};

/**
 * Resolve when the match actually happened from `completedAt` (preferred),
 * falling back to stored completedDate/Time.
 */
export function resolveActualPlayTime(row: CompletedMatch): ActualPlayTime {
  if (!row || typeof row !== 'object') {
    return { actualAt: '', actualDate: '', actualTime: '', actualDateTime: '' };
  }

  const parsed = Date.parse(row.completedAt || '');
  if (Number.isFinite(parsed)) {
    const when = new Date(parsed);
    const actualDate = formatMatchDate(when);
    const actualTime = formatMatchTime(when);
    return {
      actualAt: row.completedAt,
      actualDate,
      actualTime,
      actualDateTime: `${actualDate} ${actualTime}`
    };
  }

  const actualDate = typeof row.completedDate === 'string' ? row.completedDate : '';
  const actualTime = typeof row.completedTime === 'string' ? row.completedTime : '';
  return {
    actualAt: typeof row.completedAt === 'string' ? row.completedAt : '',
    actualDate,
    actualTime,
    actualDateTime: `${actualDate} ${actualTime}`.trim()
  };
}
