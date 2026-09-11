import type { MatchState, TennisStage, TennisMatchType } from '../data/tournamentData';
import { isTennisStage, isTennisMatchType } from '../data/tournamentData';
import { createCustomMatchId, sanitizeLabel } from './customMatch';
import { buildInitialTennisState } from './tennisScoring';

export type CustomTennisMatchInput = {
  sideA: string;
  sideB: string;
  tennisStage: TennisStage;
  matchType: TennisMatchType;
  category?: string;
  stage?: string;
};

/**
 * Build a fresh MatchState for an ad-hoc tennis match.
 * Concurrency: pure/stateless — caller writes to Firebase.
 * Security: labels sanitized; match id generated locally.
 */
export function buildCustomTennisMatchState(
  current: MatchState,
  input: CustomTennisMatchInput
): MatchState {
  if (!current || typeof current !== 'object') {
    throw new Error('buildCustomTennisMatchState: current match is required');
  }
  if (!input || typeof input !== 'object') {
    throw new Error('buildCustomTennisMatchState: input is required');
  }
  if (!isTennisStage(input.tennisStage)) {
    throw new Error('Select a valid tennis stage (Qualifier, Semifinal, or Final).');
  }
  if (!isTennisMatchType(input.matchType)) {
    throw new Error('Select a valid match type (Singles or Doubles).');
  }

  const sideA = sanitizeLabel(input.sideA, 'Player/Team 1');
  const sideB = sanitizeLabel(input.sideB, 'Player/Team 2');
  const category = sanitizeLabel(input.category ?? 'Tennis Singles', 'Category');
  const stage = sanitizeLabel(input.stage ?? 'Qualifier', 'Stage');

  return {
    ...current,
    sport: 'tennis',
    currentMatchId: createCustomMatchId(),
    category,
    stage,
    teamA: sideA,
    teamB: sideB,
    player1: sideA,
    player2: sideB,
    // Reset badminton-only fields so stale state from a prior badminton match
    // can't leak into checks like hasGameWinner/isGoldenPoint.
    score1: 0,
    score2: 0,
    maxPoints: 11,
    server: 1,
    servingSide: 'right',
    deuceActive: false,
    gameWinner: null,
    bestOf: 1,
    gameNumber: 1,
    gameScores: [],
    gamesWon1: 0,
    gamesWon2: 0,
    matchWinner: null,
    isTrump: false,
    trumpTeam: null,
    tennis: buildInitialTennisState(input.tennisStage, input.matchType)
  };
}
