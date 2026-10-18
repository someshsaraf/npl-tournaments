import type {
  MatchState,
  TennisMatchState,
  TennisPointGame,
  TennisRules,
  TennisStage,
  TennisMatchType
} from '../data/tournamentData';

const TIEBREAK_TARGET = 7;

/**
 * House defaults per stage (NPL Lawn Tennis):
 * - Qualifier / QF / SF: race to 4 games (at 3-3 the next game decides),
 *   golden point on the 3rd deuce.
 * - Final: a full 6-game set, tiebreak at 6-6, golden point on the 4th deuce.
 * Admins override these per tournament (see data/tennisTournament.ts).
 */
export function defaultTennisRulesForStage(tennisStage: TennisStage): TennisRules {
  if (tennisStage === 'final') {
    return { format: 'set', gamesTarget: 6, goldenDeuce: 4, tiebreak: true };
  }
  return { format: 'race', gamesTarget: 4, goldenDeuce: 3, tiebreak: false };
}

/** Defensive copy/heal of a rules payload (the data store or admin input). */
export function normalizeTennisRules(raw: unknown, tennisStage: TennisStage): TennisRules {
  const fallback = defaultTennisRulesForStage(tennisStage);
  if (!raw || typeof raw !== 'object') return fallback;
  const r = raw as Record<string, unknown>;
  const format = r.format === 'set' || r.format === 'race' ? r.format : fallback.format;
  const targetRaw = Number(r.gamesTarget);
  const gamesTarget =
    Number.isFinite(targetRaw) && targetRaw >= 1 && targetRaw <= 12
      ? Math.trunc(targetRaw)
      : fallback.gamesTarget;
  const goldenRaw = r.goldenDeuce;
  const goldenNum = Number(goldenRaw);
  const goldenDeuce =
    goldenRaw === null
      ? null
      : Number.isFinite(goldenNum) && goldenNum >= 1 && goldenNum <= 10
        ? Math.trunc(goldenNum)
        : fallback.goldenDeuce;
  const tiebreak = typeof r.tiebreak === 'boolean' ? r.tiebreak : fallback.tiebreak;
  return { format, gamesTarget, goldenDeuce, tiebreak };
}

export function buildInitialTennisState(
  tennisStage: TennisStage,
  matchType: TennisMatchType,
  rules: TennisRules = defaultTennisRulesForStage(tennisStage)
): TennisMatchState {
  return {
    tennisStage,
    matchType,
    rules: { ...rules },
    points1: 0,
    points2: 0,
    isTiebreak: false,
    deuceCount: 0,
    server: 1,
    gameWinner: null,
    gamesWon1: 0,
    gamesWon2: 0,
    gameLog: []
  };
}

function resolveTennis(match: MatchState): TennisMatchState {
  return match.tennis ?? buildInitialTennisState('qualifier', 'singles');
}

/** At deuce right now, and this deuce is the golden one → the next point decides the game. */
function isGoldenNow(t: TennisMatchState): boolean {
  if (t.isTiebreak || t.rules.goldenDeuce === null) return false;
  const atDeuce = t.points1 >= 3 && t.points1 === t.points2;
  return atDeuce && t.deuceCount >= t.rules.goldenDeuce;
}

/**
 * Tennis point-scoring state machine. Pure — returns a new MatchState.
 * Handles regular games (0/15/30/40 + deuce/advantage, with golden point on
 * the rules' Nth deuce), tiebreaks (first to 7, win by 2), and the match-win
 * condition from match.tennis.rules (race to N games, or a set with tiebreak).
 */
export function applyTennisScorePoint(match: MatchState, scoringSide: 1 | 2): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applyTennisScorePoint: match is required');
  }
  if (scoringSide !== 1 && scoringSide !== 2) {
    throw new Error('applyTennisScorePoint: scoringSide must be 1 or 2');
  }
  if (match.matchWinner === 1 || match.matchWinner === 2) {
    return match;
  }

  const t = resolveTennis(match);
  return t.isTiebreak
    ? applyTiebreakPoint(match, t, scoringSide)
    : applyRegularGamePoint(match, t, scoringSide);
}

function applyTiebreakPoint(match: MatchState, t: TennisMatchState, scoringSide: 1 | 2): MatchState {
  let p1 = t.points1;
  let p2 = t.points2;
  if (scoringSide === 1) p1 += 1;
  else p2 += 1;

  const winningScore = scoringSide === 1 ? p1 : p2;
  const otherScore = scoringSide === 1 ? p2 : p1;
  const winner: 1 | 2 | null =
    winningScore >= TIEBREAK_TARGET && winningScore - otherScore >= 2 ? scoringSide : null;

  if (!winner) {
    return { ...match, tennis: { ...t, points1: p1, points2: p2, gameWinner: null } };
  }
  return finishTennisGame(match, { ...t, points1: p1, points2: p2 }, winner, true);
}

function applyRegularGamePoint(match: MatchState, t: TennisMatchState, scoringSide: 1 | 2): MatchState {
  const p1 = t.points1;
  const p2 = t.points2;

  // Sitting at the golden deuce right now: this point decides the game outright.
  if (isGoldenNow(t)) {
    return finishTennisGame(match, t, scoringSide, false, true);
  }

  let n1 = p1;
  let n2 = p2;
  if (scoringSide === 1) n1 += 1;
  else n2 += 1;

  const contention = n1 >= 3 && n2 >= 3;
  let winner: 1 | 2 | null = null;
  let deuceCount = t.deuceCount;

  if (contention) {
    if (n1 === n2) {
      deuceCount += 1;
    } else if (Math.abs(n1 - n2) >= 2) {
      winner = scoringSide;
    }
    // else: exactly 1 point apart → advantage, no winner yet.
  } else if ((scoringSide === 1 ? n1 : n2) >= 4) {
    winner = scoringSide;
  }

  if (!winner) {
    return { ...match, tennis: { ...t, points1: n1, points2: n2, deuceCount, gameWinner: null } };
  }
  return finishTennisGame(match, { ...t, points1: n1, points2: n2, deuceCount }, winner, false);
}

/** Records the finished game/tiebreak, resets for the next game, and checks the match-win condition. */
function finishTennisGame(
  match: MatchState,
  t: TennisMatchState,
  winner: 1 | 2,
  wasTiebreak: boolean,
  golden = false
): MatchState {
  const entry: TennisPointGame = {
    points1: t.points1,
    points2: t.points2,
    winner,
    wasTiebreak,
    deuceCount: t.deuceCount,
    ...(golden ? { golden: true } : {})
  };
  const gameLog = [...t.gameLog, entry];
  const gamesWon1 = t.gamesWon1 + (winner === 1 ? 1 : 0);
  const gamesWon2 = t.gamesWon2 + (winner === 2 ? 1 : 0);

  let matchWinner: 1 | 2 | null = null;
  let isTiebreak = false;

  const { format, gamesTarget, tiebreak } = t.rules;
  if (format === 'race') {
    if (gamesWon1 >= gamesTarget) matchWinner = 1;
    else if (gamesWon2 >= gamesTarget) matchWinner = 2;
  } else if (wasTiebreak) {
    matchWinner = winner;
  } else if (gamesWon1 >= gamesTarget && gamesWon1 - gamesWon2 >= 2) {
    matchWinner = 1;
  } else if (gamesWon2 >= gamesTarget && gamesWon2 - gamesWon1 >= 2) {
    matchWinner = 2;
  } else if (tiebreak && gamesWon1 === gamesTarget && gamesWon2 === gamesTarget) {
    isTiebreak = true;
  }

  return {
    ...match,
    matchWinner,
    tennis: {
      ...t,
      points1: 0,
      points2: 0,
      deuceCount: 0,
      isTiebreak,
      gameWinner: winner,
      gamesWon1,
      gamesWon2,
      gameLog,
      server: t.server === 1 ? 2 : 1
    }
  };
}

/**
 * Undo the last point for `side`. If the current game/tiebreak had just been
 * won, first reopens it (restoring the pre-win score, deuce count and games
 * tally). A game won on a golden point is only reopened — its winning point
 * was never added to the point counts. Mirrors applyDecrementScore's
 * badminton behavior.
 */
export function applyTennisUndoPoint(match: MatchState, side: 1 | 2): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applyTennisUndoPoint: match is required');
  }
  if (side !== 1 && side !== 2) {
    throw new Error('applyTennisUndoPoint: side must be 1 or 2');
  }
  const t = resolveTennis(match);
  let base = t;
  let matchWinner = match.matchWinner;

  if (t.gameWinner !== null && t.gameLog.length > 0) {
    const last = t.gameLog[t.gameLog.length - 1];
    const gameLog = t.gameLog.slice(0, -1);
    const gamesWon1 = last.winner === 1 ? Math.max(0, t.gamesWon1 - 1) : t.gamesWon1;
    const gamesWon2 = last.winner === 2 ? Math.max(0, t.gamesWon2 - 1) : t.gamesWon2;
    base = {
      ...t,
      points1: last.points1,
      points2: last.points2,
      isTiebreak: last.wasTiebreak,
      deuceCount: Number.isFinite(last.deuceCount) ? Number(last.deuceCount) : 0,
      gameWinner: null,
      gamesWon1,
      gamesWon2,
      gameLog,
      // finishTennisGame flipped the server for the next game — flip it back.
      server: t.server === 1 ? 2 : 1
    };
    matchWinner = null;
    if (last.golden) {
      return { ...match, matchWinner, tennis: base };
    }
  }

  let p1 = base.points1;
  let p2 = base.points2;
  if (side === 1) p1 = Math.max(0, p1 - 1);
  else p2 = Math.max(0, p2 - 1);

  // Leaving a deuce (e.g. 4-4 → 4-3) steps back to the previous deuce.
  const wasDeuce = !base.isTiebreak && base.points1 >= 3 && base.points1 === base.points2;
  const isDeuce = p1 >= 3 && p1 === p2;
  let deuceCount = base.deuceCount;
  if (p1 < 3 || p2 < 3) deuceCount = 0;
  else if (wasDeuce && !isDeuce) deuceCount = Math.max(0, deuceCount - 1);

  return {
    ...match,
    matchWinner,
    tennis: { ...base, points1: p1, points2: p2, deuceCount }
  };
}

export function applyTennisSetServer(match: MatchState, targetServer: 1 | 2): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applyTennisSetServer: match is required');
  }
  if (targetServer !== 1 && targetServer !== 2) {
    throw new Error('applyTennisSetServer: targetServer must be 1 or 2');
  }
  const t = resolveTennis(match);
  if (t.server === targetServer) return match;
  return { ...match, tennis: { ...t, server: targetServer } };
}

export function applyTennisSwapSides(match: MatchState): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applyTennisSwapSides: match is required');
  }
  const t = resolveTennis(match);
  const gameLog: TennisPointGame[] = t.gameLog.map((g) => ({
    ...g,
    points1: g.points2,
    points2: g.points1,
    winner: g.winner === 1 ? 2 : 1,
    wasTiebreak: g.wasTiebreak
  }));

  return {
    ...match,
    teamA: match.teamB,
    teamB: match.teamA,
    player1: match.player2,
    player2: match.player1,
    matchWinner: match.matchWinner === 1 ? 2 : match.matchWinner === 2 ? 1 : null,
    tennis: {
      ...t,
      points1: t.points2,
      points2: t.points1,
      server: t.server === 1 ? 2 : 1,
      gameWinner: t.gameWinner === 1 ? 2 : t.gameWinner === 2 ? 1 : null,
      gamesWon1: t.gamesWon2,
      gamesWon2: t.gamesWon1,
      gameLog
    }
  };
}

export function applyTennisResetMatch(
  match: MatchState,
  tennisStage: TennisStage,
  matchType: TennisMatchType
): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applyTennisResetMatch: match is required');
  }
  const rules = match.tennis?.rules ?? defaultTennisRulesForStage(tennisStage);
  return {
    ...match,
    matchWinner: null,
    tennis: buildInitialTennisState(tennisStage, matchType, rules)
  };
}

const REGULAR_POINT_LABELS = ['0', '15', '30', '40'] as const;

/** Maps a raw in-game point count to its tennis display label. */
export function formatTennisPointLabel(mine: number, theirs: number, isTiebreak: boolean): string {
  if (isTiebreak) return String(Math.max(0, mine));
  if (mine < 3 || theirs < 3) return REGULAR_POINT_LABELS[Math.min(Math.max(mine, 0), 3)] ?? '40';
  if (mine === theirs) return 'Deuce';
  if (mine === theirs + 1) return 'Ad';
  return '40';
}

export function isTennisDeuce(match: MatchState | null | undefined): boolean {
  const t = match?.tennis;
  if (!t || t.isTiebreak) return false;
  return t.points1 >= 3 && t.points2 >= 3 && t.points1 === t.points2;
}

export function isTennisTiebreak(match: MatchState | null | undefined): boolean {
  return !!match?.tennis?.isTiebreak;
}

/** True right now if the *next* point is sudden death (the rules' golden deuce). */
export function isTennisGoldenPointActive(match: MatchState | null | undefined): boolean {
  const t = match?.tennis;
  if (!t) return false;
  return isGoldenNow(t);
}

/** One-line human summary of a rules object, e.g. "Race to 4 games · golden point on 3rd deuce". */
export function describeTennisRules(rules: TennisRules): string {
  const ord = (n: number) => {
    const suffix = n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th';
    return `${n}${suffix}`;
  };
  const base =
    rules.format === 'race'
      ? `First to ${rules.gamesTarget} games`
      : `${rules.gamesTarget}-game set${rules.tiebreak ? `, tiebreak at ${rules.gamesTarget}-${rules.gamesTarget}` : ', win by 2'}`;
  const golden =
    rules.goldenDeuce === null ? 'advantage play' : `golden point on ${ord(rules.goldenDeuce)} deuce`;
  return `${base} · ${golden}`;
}
