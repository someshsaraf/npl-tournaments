import type { BestOf, MatchState, MaxPoints } from '../data/tournamentData';
import { isBestOf, isMaxPoints } from '../data/tournamentData';

/** Unique id for ad-hoc matches (not in FIXTURES). */
export function createCustomMatchId(): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `custom-${Date.now()}-${rand}`;
}

export function sanitizeLabel(value: unknown, field: string, maxLen = 80): string {
  if (typeof value !== 'string') {
    throw new Error(`${field} must be a string`);
  }
  const trimmed = value.trim().replace(/\s+/g, ' ');
  if (!trimmed) {
    throw new Error(`${field} is required`);
  }
  if (trimmed.length > maxLen) {
    throw new Error(`${field} must be at most ${maxLen} characters`);
  }
  return trimmed;
}

export type CustomMatchInput = {
  sideA: string;
  sideB: string;
  maxPoints: MaxPoints;
  bestOf?: BestOf;
  category?: string;
  stage?: string;
};

/**
 * Build a fresh MatchState for an ad-hoc match.
 * Concurrency: pure/stateless — caller writes to Firebase.
 * Security: labels sanitized; match id generated locally.
 */
export function buildCustomMatchState(
  current: MatchState,
  input: CustomMatchInput
): MatchState {
  if (!current || typeof current !== 'object') {
    throw new Error('buildCustomMatchState: current match is required');
  }
  if (!input || typeof input !== 'object') {
    throw new Error('buildCustomMatchState: input is required');
  }
  if (!isMaxPoints(input.maxPoints)) {
    throw new Error('Select a valid point format (11, 15, or 21).');
  }
  const bestOf: BestOf = isBestOf(input.bestOf) ? input.bestOf : 1;

  const sideA = sanitizeLabel(input.sideA, 'Player 1');
  const sideB = sanitizeLabel(input.sideB, 'Player 2');
  const category = sanitizeLabel(input.category ?? 'Exhibition', 'Category');
  const stage = sanitizeLabel(input.stage ?? 'Custom', 'Stage');

  return {
    ...current,
    currentMatchId: createCustomMatchId(),
    category,
    stage,
    teamA: sideA,
    teamB: sideB,
    player1: sideA,
    player2: sideB,
    score1: 0,
    score2: 0,
    maxPoints: input.maxPoints,
    bestOf,
    gameNumber: 1,
    gameScores: [],
    gamesWon1: 0,
    gamesWon2: 0,
    matchWinner: null,
    server: 1,
    servingSide: 'right',
    deuceActive: false,
    gameWinner: null,
    isTrump: false,
    trumpTeam: null
  };
}
