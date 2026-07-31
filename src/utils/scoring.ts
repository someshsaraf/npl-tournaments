import type { MatchState } from '../data/tournamentData';

export function getServeSide(score: number): 'right' | 'left' {
  if (!Number.isFinite(score) || score < 0) return 'right';
  return score % 2 === 0 ? 'right' : 'left';
}

/**
 * Rally point: winner serves next. L/R court updates only on service over.
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

  const max = match.maxPoints ?? 11;
  const cap = max === 11 ? 15 : 30;
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
    : (match.servingSide === 'left' ? 'left' : 'right');

  let isDeuce = match.deuceActive;
  let winner: 1 | 2 | null = null;
  const winningScore = scoringTeam === 1 ? s1 : s2;

  if (s1 >= deuceThreshold && s2 >= deuceThreshold) {
    if (s1 === s2) {
      isDeuce = true;
    } else if (Math.abs(s1 - s2) >= 2 || winningScore === cap) {
      winner = scoringTeam;
    } else {
      isDeuce = true;
    }
  } else if (winningScore >= max) {
    winner = scoringTeam;
  }

  return {
    ...match,
    score1: s1,
    score2: s2,
    server: newServer,
    servingSide: newServingSide,
    deuceActive: isDeuce,
    gameWinner: winner
  };
}

export function applyDecrementScore(match: MatchState, side: 1 | 2): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applyDecrementScore: match is required');
  }
  if (side !== 1 && side !== 2) {
    throw new Error('applyDecrementScore: side must be 1 or 2');
  }

  let s1 = match.score1 ?? 0;
  let s2 = match.score2 ?? 0;
  if (side === 1) s1 = Math.max(0, s1 - 1);
  else s2 = Math.max(0, s2 - 1);

  const maxPoints = match.maxPoints ?? 11;

  return {
    ...match,
    score1: s1,
    score2: s2,
    gameWinner: null,
    deuceActive: s1 >= (maxPoints - 1) && s2 >= (maxPoints - 1) && s1 === s2
  };
}

/**
 * Assign who serves. Tap the current server again to toggle court L ↔ R.
 * Switching server keeps the current court side (manual control).
 */
export function applySetServer(match: MatchState, targetServer: 1 | 2): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applySetServer: match is required');
  }
  if (targetServer !== 1 && targetServer !== 2) {
    throw new Error('applySetServer: targetServer must be 1 or 2');
  }
  const currentSide = match.servingSide === 'left' ? 'left' : 'right';
  if (match.server === targetServer) {
    return {
      ...match,
      servingSide: currentSide === 'left' ? 'right' : 'left'
    };
  }
  return {
    ...match,
    server: targetServer,
    servingSide: currentSide
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
    gameWinner: null
  };
}

/**
 * Swap court / player sides (scores, names, server).
 * Court L/R flips with the physical end-change (stored side is not recomputed from score).
 */
export function applySwapSides(match: MatchState): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('applySwapSides: match is required');
  }
  const swappedServer: 1 | 2 = match.server === 1 ? 2 : 1;
  const currentSide = match.servingSide === 'left' ? 'left' : 'right';

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
    gameWinner:
      match.gameWinner === 1 ? 2 : match.gameWinner === 2 ? 1 : null
  };
}
