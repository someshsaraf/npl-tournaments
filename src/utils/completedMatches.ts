import type { CompletedMatch, Fixture, MatchState } from '../data/tournamentData';
import { isBestOf, isMaxPoints } from '../data/tournamentData';
import { formatGameScoresLine, hasSeriesWinner } from './matchState';
import {
  applyPlayerNameAliasesToCompletedMatch,
  applyPlayerNameAliasesToFixture
} from './playerRename';

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
    const aliased = applyPlayerNameAliasesToFixture(fixture);
    const done = map[fixture.id];
    if (!done || done.status !== 'completed') {
      return { ...aliased, status: 'scheduled' as const };
    }
    return {
      ...aliased,
      status: 'completed' as const,
      result: done.result,
      winnerName: done.winnerName,
      completedAt: done.completedAt,
      completedDate: done.completedDate,
      completedTime: done.completedTime,
      finalScore1: done.score1,
      finalScore2: done.score2,
      // Prefer completed-match sides (already alias-applied) for display consistency.
      details: done.details || aliased.details,
      teamA: done.teamA || aliased.teamA,
      teamB: done.teamB || aliased.teamB
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
    // Display renamed players even before Firebase rows are rewritten.
    out[id] = applyPlayerNameAliasesToCompletedMatch(base);
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

/** Admin-editable fields for a completed match (fixture id is immutable). */
export type CompletedMatchEditInput = {
  category: string;
  stage: string;
  details: string;
  scheduledDate: string;
  scheduledTime: string;
  teamA: string;
  teamB: string;
  player1: string;
  player2: string;
  score1: number;
  score2: number;
  result: string;
  winnerSide: 1 | 2;
  isTrump: boolean;
  bestOf: 1 | 3;
  gamesWon1: number;
  gamesWon2: number;
  /** ISO timestamp; completedDate/Time are derived. */
  completedAt: string;
};

function clipStr(value: unknown, max: number, label: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} must be text.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new Error(`${label} must be at most ${max} characters.`);
  }
  return trimmed;
}

function parseNonNegInt(value: unknown, label: string): number {
  const n =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
    throw new Error(`${label} must be a whole number ≥ 0.`);
  }
  if (n > 999) {
    throw new Error(`${label} is too large.`);
  }
  return n;
}

/**
 * Merge admin edits into an existing completed match.
 * Preserves id/fixtureId, snapshots, maxPoints, and gameScores.
 *
 * Concurrency: pure — caller writes the result to RTDB.
 * Security: no secrets; validates types/ranges before write.
 * Input: existing CompletedMatch + edit payload; fails fast on bad values.
 */
export function applyCompletedMatchEdits(
  existing: CompletedMatch,
  edits: unknown
): CompletedMatch {
  if (!existing || typeof existing !== 'object') {
    throw new Error('applyCompletedMatchEdits: existing match required');
  }
  if (typeof existing.fixtureId !== 'string' || !existing.fixtureId.trim()) {
    throw new Error('applyCompletedMatchEdits: fixtureId required');
  }
  if (!edits || typeof edits !== 'object' || Array.isArray(edits)) {
    throw new Error('Edit form data is invalid.');
  }
  const raw = edits as Record<string, unknown>;

  const category = clipStr(raw.category, 80, 'Category');
  const stage = clipStr(raw.stage, 80, 'Stage');
  const details = clipStr(raw.details, 200, 'Match');
  if (!details) throw new Error('Match details are required.');
  const scheduledDate = clipStr(raw.scheduledDate, 40, 'Scheduled date');
  const scheduledTime = clipStr(raw.scheduledTime, 20, 'Scheduled time');
  const teamA = clipStr(raw.teamA, 80, 'Team A');
  const teamB = clipStr(raw.teamB, 80, 'Team B');
  const player1 = clipStr(raw.player1, 120, 'Player / side A');
  const player2 = clipStr(raw.player2, 120, 'Player / side B');
  const result = clipStr(raw.result, 80, 'Result');
  if (!result) throw new Error('Result is required.');

  const score1 = parseNonNegInt(raw.score1, 'Score 1');
  const score2 = parseNonNegInt(raw.score2, 'Score 2');
  const gamesWon1 = parseNonNegInt(raw.gamesWon1, 'Games won (side A)');
  const gamesWon2 = parseNonNegInt(raw.gamesWon2, 'Games won (side B)');

  const winnerSideRaw = raw.winnerSide;
  const winnerSideNum =
    typeof winnerSideRaw === 'number'
      ? winnerSideRaw
      : typeof winnerSideRaw === 'string'
        ? Number(winnerSideRaw)
        : NaN;
  if (winnerSideNum !== 1 && winnerSideNum !== 2) {
    throw new Error('Winner side must be 1 or 2.');
  }
  const winnerSide = winnerSideNum as 1 | 2;

  const bestOfRaw = raw.bestOf;
  const bestOfNum =
    typeof bestOfRaw === 'number'
      ? bestOfRaw
      : typeof bestOfRaw === 'string'
        ? Number(bestOfRaw)
        : NaN;
  if (!isBestOf(bestOfNum)) {
    throw new Error('Best of must be 1 or 3.');
  }

  const isTrump = raw.isTrump === true || raw.isTrump === 'true';

  const completedAtRaw = clipStr(raw.completedAt, 40, 'Completed at');
  const completedMs = Date.parse(completedAtRaw);
  if (!Number.isFinite(completedMs)) {
    throw new Error('Completed time must be a valid date/time.');
  }
  const completedAtDate = new Date(completedMs);
  const completedAt = completedAtDate.toISOString();

  const winnerName =
    winnerSide === 1
      ? player1 || teamA || 'Side A'
      : player2 || teamB || 'Side B';

  return {
    ...existing,
    id: existing.fixtureId,
    fixtureId: existing.fixtureId,
    status: 'completed',
    category,
    stage,
    details,
    scheduledDate,
    scheduledTime,
    teamA,
    teamB,
    player1,
    player2,
    score1,
    score2,
    result,
    winnerSide,
    winnerName,
    isTrump,
    bestOf: bestOfNum,
    gamesWon1,
    gamesWon2,
    completedAt,
    completedDate: formatMatchDate(completedAtDate),
    completedTime: formatMatchTime(completedAtDate)
  };
}

/** Build edit-form defaults from a completed match row. */
export function completedMatchToEditInput(row: CompletedMatch): CompletedMatchEditInput {
  if (!row || typeof row !== 'object') {
    throw new Error('completedMatchToEditInput: row required');
  }
  const completedMs = Date.parse(row.completedAt || '');
  const completedAt = Number.isFinite(completedMs)
    ? new Date(completedMs).toISOString()
    : new Date().toISOString();

  return {
    category: typeof row.category === 'string' ? row.category : '',
    stage: typeof row.stage === 'string' ? row.stage : '',
    details: typeof row.details === 'string' ? row.details : '',
    scheduledDate: typeof row.scheduledDate === 'string' ? row.scheduledDate : '',
    scheduledTime: typeof row.scheduledTime === 'string' ? row.scheduledTime : '',
    teamA: typeof row.teamA === 'string' ? row.teamA : '',
    teamB: typeof row.teamB === 'string' ? row.teamB : '',
    player1: typeof row.player1 === 'string' ? row.player1 : '',
    player2: typeof row.player2 === 'string' ? row.player2 : '',
    score1: Number.isFinite(row.score1) ? row.score1 : 0,
    score2: Number.isFinite(row.score2) ? row.score2 : 0,
    result: typeof row.result === 'string' ? row.result : '',
    winnerSide: row.winnerSide === 2 ? 2 : 1,
    isTrump: !!row.isTrump,
    bestOf: isBestOf(row.bestOf) ? row.bestOf : 1,
    gamesWon1: Number.isFinite(row.gamesWon1) ? Number(row.gamesWon1) : 0,
    gamesWon2: Number.isFinite(row.gamesWon2) ? Number(row.gamesWon2) : 0,
    completedAt
  };
}

/** Value for `<input type="datetime-local" />` from an ISO string (local timezone). */
export function isoToDatetimeLocalValue(iso: unknown): string {
  if (typeof iso !== 'string' || !iso.trim()) return '';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Parse datetime-local value to ISO; fails fast if empty/invalid. */
export function datetimeLocalToIso(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Completed time is required.');
  }
  const ms = Date.parse(value.trim());
  if (!Number.isFinite(ms)) {
    throw new Error('Completed time is invalid.');
  }
  return new Date(ms).toISOString();
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
