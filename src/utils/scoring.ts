import type { BestOf, GameScore, MatchState, MaxPoints } from '../data/tournamentData';
import { deuceCapForMatch, isBestOf, isMaxPoints } from '../data/tournamentData';
import { gamesNeededToWin } from './matchState';

export function getServeSide(score: number): 'right' | 'left' {
  if (!Number.isFinite(score) || score < 0) return 'right';
  return score % 2 === 0 ? 'right' : 'left';
}

function resolveMaxPoints(match: MatchState): MaxPoints {
  return isMaxPoints(match.maxPoints) ? match.maxPoints : 11;
}

function resolveBestOf(match: MatchState): BestOf {
  return isBestOf(match.bestOf) ? match.bestOf : 1;
}

function resolveGameNumber(match: MatchState): number {
  const n = Number(match.gameNumber);
  return Number.isFinite(n) && n >= 1 ? Math.min(3, Math.trunc(n)) : 1;
}

/**
 * Record a finished game into the series and set matchWinner when the series is decided.
 * Idempotent for the current gameNumber.
 */
function withSeriesProgress(match: MatchState): MatchState {
  const winner = match.gameWinner;
  if (winner !== 1 && winner !== 2) return match;

  const gameNumber = resolveGameNumber(match);
  const prevScores = Array.isArray(match.gameScores) ? match.gameScores : [];
  if (prevScores.length >= gameNumber) {
    return match;
  }

  const entry: GameScore = {
    score1: Number.isFinite(match.score1) ? match.score1 : 0,
    score2: Number.isFinite(match.score2) ? match.score2 : 0,
    winner
  };
  const gameScores = [...prevScores, entry];
  let gamesWon1 = Number.isFinite(match.gamesWon1) ? match.gamesWon1 : 0;
  let gamesWon2 = Number.isFinite(match.gamesWon2) ? match.gamesWon2 : 0;
  if (winner === 1) gamesWon1 += 1;
  else gamesWon2 += 1;

  const needed = gamesNeededToWin(resolveBestOf(match));
  let matchWinner: 1 | 2 | null = null;
  if (gamesWon1 >= needed) matchWinner = 1;
  else if (gamesWon2 >= needed) matchWinner = 2;

  return {
    ...match,
    gameScores,
    gamesWon1,
    gamesWon2,
    matchWinner
  };
}

/**
 * True at the golden-point tie (both sides at the deuce cap).
 * Team Championship race-to-15 → golden at 15-15; other 15-pt games → 21-21.
 */
export function isGoldenPoint(match: MatchState | null | undefined): boolean {
  if (!match || typeof match !== 'object') return false;
  if (match.gameWinner === 1 || match.gameWinner === 2) return false;
  const max = resolveMaxPoints(match);
  const cap = deuceCapForMatch(match.category, max);
  const s1 = Number(match.score1);
  const s2 = Number(match.score2);
  const a = Number.isFinite(s1) ? s1 : 0;
  const b = Number.isFinite(s2) ? s2 : 0;
  return a === cap && b === cap;
}

/**
 * Rally point: winner serves next. L/R court updates only on service over.
 * When a game ends, records it into the best-of series.
 * Pure — no shared mutable state.
 */
export function applyScorePoint(match: MatchState, scoringTeam: 1 | 2): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applyScorePoint: match is required');
  }
  if (scoringTeam !== 1 && scoringTeam !== 2) {
    throw new Error('applyScorePoint: scoringTeam must be 1 or 2');
  }
  if (match.gameWinner === 1 || match.gameWinner === 2) {
    return match;
  }
  if (match.matchWinner === 1 || match.matchWinner === 2) {
    return match;
  }

  const max = resolveMaxPoints(match);
  const cap = deuceCapForMatch(match.category, max);
  const deuceThreshold = max - 1;

  let s1 = match.score1 ?? 0;
  let s2 = match.score2 ?? 0;

  if (scoringTeam === 1) s1 += 1;
  else s2 += 1;

  const previousServer = match.server === 2 ? 2 : 1;
  const newServer: 1 | 2 = scoringTeam;
  const serviceOver = newServer !== previousServer;
  const newServingSide = serviceOver
    ? getServeSide(newServer === 1 ? s1 : s2)
    : match.servingSide === 'left'
      ? 'left'
      : 'right';

  let isDeuce = match.deuceActive;
  let winner: 1 | 2 | null = null;
  const winningScore = scoringTeam === 1 ? s1 : s2;

  if (s1 >= deuceThreshold && s2 >= deuceThreshold) {
    if (s1 === s2) {
      isDeuce = true;
    } else if (Math.abs(s1 - s2) >= 2) {
      winner = scoringTeam;
    } else if (Math.min(s1, s2) >= cap) {
      winner = scoringTeam;
    } else {
      isDeuce = true;
    }
  } else if (winningScore >= max) {
    winner = scoringTeam;
  }

  const next: MatchState = {
    ...match,
    score1: s1,
    score2: s2,
    server: newServer,
    servingSide: newServingSide,
    deuceActive: isDeuce,
    gameWinner: winner
  };

  return winner ? withSeriesProgress(next) : next;
}

/**
 * Start the next game in a best-of-3 after the previous game finished.
 * Keeps series tallies; resets point score for the new game.
 */
export function applyStartNextGame(match: MatchState): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applyStartNextGame: match is required');
  }
  if (match.matchWinner === 1 || match.matchWinner === 2) {
    throw new Error('Series already decided — start a new match instead.');
  }
  if (match.gameWinner !== 1 && match.gameWinner !== 2) {
    throw new Error('Finish the current game before starting the next.');
  }
  if (resolveBestOf(match) !== 3) {
    throw new Error('Next game is only for best-of-3 matches.');
  }

  const gameNumber = resolveGameNumber(match);
  if (gameNumber >= 3) {
    throw new Error('Best-of-3 has no further games.');
  }

  return {
    ...match,
    score1: 0,
    score2: 0,
    server: 1,
    servingSide: 'right',
    deuceActive: false,
    gameWinner: null,
    gameNumber: gameNumber + 1
  };
}

export function applyDecrementScore(match: MatchState, side: 1 | 2): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applyDecrementScore: match is required');
  }
  if (side !== 1 && side !== 2) {
    throw new Error('applyDecrementScore: side must be 1 or 2');
  }

  let base: MatchState = match;
  const gameNumber = resolveGameNumber(match);
  const scores = Array.isArray(match.gameScores) ? match.gameScores : [];

  if (
    (match.gameWinner === 1 || match.gameWinner === 2) &&
    scores.length >= gameNumber
  ) {
    const last = scores[scores.length - 1];
    let gamesWon1 = Number.isFinite(match.gamesWon1) ? match.gamesWon1 : 0;
    let gamesWon2 = Number.isFinite(match.gamesWon2) ? match.gamesWon2 : 0;
    if (last?.winner === 1) gamesWon1 = Math.max(0, gamesWon1 - 1);
    else if (last?.winner === 2) gamesWon2 = Math.max(0, gamesWon2 - 1);
    base = {
      ...match,
      gameScores: scores.slice(0, -1),
      gamesWon1,
      gamesWon2,
      matchWinner: null
    };
  }

  let s1 = base.score1 ?? 0;
  let s2 = base.score2 ?? 0;
  if (side === 1) s1 = Math.max(0, s1 - 1);
  else s2 = Math.max(0, s2 - 1);

  const maxPoints = resolveMaxPoints(base);

  return {
    ...base,
    score1: s1,
    score2: s2,
    gameWinner: null,
    deuceActive: s1 >= maxPoints - 1 && s2 >= maxPoints - 1 && s1 === s2
  };
}

export function applySetMaxPoints(match: MatchState, maxPoints: MaxPoints): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applySetMaxPoints: match is required');
  }
  if (!isMaxPoints(maxPoints)) {
    throw new Error('applySetMaxPoints: maxPoints must be 11, 15, or 21');
  }
  const s1 = match.score1 ?? 0;
  const s2 = match.score2 ?? 0;
  return {
    ...match,
    maxPoints,
    gameWinner: null,
    deuceActive: s1 >= maxPoints - 1 && s2 >= maxPoints - 1 && s1 === s2
  };
}

/**
 * Change best-of format (1 or 3). Recomputes matchWinner from games already won.
 * Does not reset the current point score.
 */
export function applySetBestOf(match: MatchState, bestOf: BestOf): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applySetBestOf: match is required');
  }
  if (!isBestOf(bestOf)) {
    throw new Error('applySetBestOf: bestOf must be 1 or 3');
  }

  const gamesWon1 = Number.isFinite(match.gamesWon1) ? match.gamesWon1 : 0;
  const gamesWon2 = Number.isFinite(match.gamesWon2) ? match.gamesWon2 : 0;
  const needed = gamesNeededToWin(bestOf);

  let matchWinner: 1 | 2 | null = null;
  if (gamesWon1 >= needed) matchWinner = 1;
  else if (gamesWon2 >= needed) matchWinner = 2;
  else if (
    bestOf === 1 &&
    (match.gameWinner === 1 || match.gameWinner === 2) &&
    gamesWon1 === 0 &&
    gamesWon2 === 0
  ) {
    // Current game already finished on a fresh BO1 switch.
    matchWinner = match.gameWinner;
  }

  return {
    ...match,
    bestOf,
    matchWinner
  };
}

export function applySetServer(match: MatchState, targetServer: 1 | 2): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applySetServer: match is required');
  }
  if (targetServer !== 1 && targetServer !== 2) {
    throw new Error('applySetServer: targetServer must be 1 or 2');
  }
  if (match.server === targetServer) {
    return match;
  }
  return {
    ...match,
    server: targetServer
  };
}

export function applyResetScores(match: MatchState): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applyResetScores: match is required');
  }
  return {
    ...match,
    score1: 0,
    score2: 0,
    server: 1,
    servingSide: 'right',
    deuceActive: false,
    gameWinner: null,
    gameNumber: 1,
    gameScores: [],
    gamesWon1: 0,
    gamesWon2: 0,
    matchWinner: null
  };
}

export function applySwapSides(match: MatchState): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applySwapSides: match is required');
  }
  const swappedServer: 1 | 2 = match.server === 1 ? 2 : 1;
  const currentSide = match.servingSide === 'left' ? 'left' : 'right';
  const gameScores = (Array.isArray(match.gameScores) ? match.gameScores : []).map((g) => ({
    score1: g.score2,
    score2: g.score1,
    winner: (g.winner === 1 ? 2 : 1) as 1 | 2
  }));

  return {
    ...match,
    teamA: match.teamB,
    teamB: match.teamA,
    player1: match.player2,
    player2: match.player1,
    score1: match.score2 ?? 0,
    score2: match.score1 ?? 0,
    server: swappedServer,
    servingSide: currentSide === 'left' ? 'right' : 'left',
    gameWinner: match.gameWinner === 1 ? 2 : match.gameWinner === 2 ? 1 : null,
    gamesWon1: match.gamesWon2 ?? 0,
    gamesWon2: match.gamesWon1 ?? 0,
    gameScores,
    matchWinner: match.matchWinner === 1 ? 2 : match.matchWinner === 2 ? 1 : null
  };
}
