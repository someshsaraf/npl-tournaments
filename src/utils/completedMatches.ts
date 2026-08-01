import type { CompletedMatch, Fixture, MatchState } from '../data/tournamentData';
import { isBestOf, isMaxPoints } from '../data/tournamentData';
import { formatGameScoresLine, hasSeriesWinner } from './matchState';

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

/** Firebase RTDB path key — strips characters that are illegal in keys. */
export function completedMatchStorageKey(fixtureId: unknown): string {
  if (typeof fixtureId !== 'string' || !fixtureId.trim()) {
    throw new Error('completedMatchStorageKey: non-empty fixtureId required');
  }
  return fixtureId.trim().replace(/[.#$[\]]/g, '_');
}

/**
 * JSON-clone so Firebase never receives `undefined` (RTDB rejects it).
 * Concurrency: pure; returns a new plain object.
 */
export function toFirebaseWritable<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    throw new Error('toFirebaseWritable: value is not JSON-serializable');
  }
}

/**
 * Builds a CompletedMatch record from the live match + schedule fixture.
 * For best-of-3, result includes games tally and each game score.
 * Concurrency: pure/stateless — caller writes to Firebase.
 */
export function buildCompletedMatch(
  match: MatchState,
  fixture: Fixture | undefined,
  completedAt: Date = new Date(),
  extras?: { snapshotUrl?: string; snapshotPath?: string }
): CompletedMatch {
  if (!match || typeof match !== 'object') {
    throw new Error('buildCompletedMatch: match is required');
  }
  if (!hasSeriesWinner(match)) {
    throw new Error('buildCompletedMatch: series has no winner yet');
  }
  if (!(completedAt instanceof Date) || Number.isNaN(completedAt.getTime())) {
    throw new Error('buildCompletedMatch: completedAt must be a valid Date');
  }

  const fixtureId =
    typeof match.currentMatchId === 'string' && match.currentMatchId.trim()
      ? match.currentMatchId.trim()
      : `unknown-${completedAt.getTime()}`;

  const bestOf = isBestOf(match.bestOf) ? match.bestOf : 1;
  const gameScores = Array.isArray(match.gameScores) ? match.gameScores : [];
  const gamesWon1 = Number.isFinite(match.gamesWon1) ? match.gamesWon1 : 0;
  const gamesWon2 = Number.isFinite(match.gamesWon2) ? match.gamesWon2 : 0;

  const winnerSide =
    match.matchWinner === 1 || match.matchWinner === 2
      ? match.matchWinner
      : match.gameWinner === 1 || match.gameWinner === 2
        ? match.gameWinner
        : 1;

  const score1 = Number.isFinite(match.score1) ? match.score1 : 0;
  const score2 = Number.isFinite(match.score2) ? match.score2 : 0;
  const winnerName =
    winnerSide === 1
      ? match.player1 || match.teamA || 'Side A'
      : match.player2 || match.teamB || 'Side B';

  const gamesLine = formatGameScoresLine(match);
  let result: string;
  if (bestOf === 3) {
    result = gamesLine
      ? `${gamesWon1}-${gamesWon2} (${gamesLine.replace(/G\d+\s/g, '')})`
      : `${gamesWon1}-${gamesWon2}`;
  } else {
    result = `${score1}-${score2}`;
  }

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
    maxPoints: isMaxPoints(match.maxPoints) ? match.maxPoints : 11,
    winnerSide,
    winnerName,
    result,
    status: 'completed',
    completedAt: completedAt.toISOString(),
    completedDate: formatMatchDate(completedAt),
    completedTime: formatMatchTime(completedAt),
    isTrump: !!match.isTrump,
    bestOf,
    gamesWon1,
    gamesWon2,
    gameScores,
    ...(typeof extras?.snapshotUrl === 'string' && extras.snapshotUrl.startsWith('https://')
      ? { snapshotUrl: extras.snapshotUrl }
      : {}),
    ...(typeof extras?.snapshotPath === 'string' && extras.snapshotPath.startsWith('photos/')
      ? { snapshotPath: extras.snapshotPath }
      : {})
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
    // Accept explicit completed rows, and heal older rows that have a result but no status.
    const looksCompleted =
      row.status === 'completed' ||
      (row.status == null &&
        (typeof row.result === 'string' || typeof row.winnerName === 'string'));
    if (!looksCompleted) continue;
    if (typeof row.fixtureId !== 'string' && typeof row.id !== 'string' && !key) {
      continue;
    }
    const id = String(row.fixtureId || row.id || key).trim();
    if (!id) continue;

    const base = {
      ...(row as CompletedMatch),
      id,
      fixtureId: id,
      status: 'completed' as const
    };
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
