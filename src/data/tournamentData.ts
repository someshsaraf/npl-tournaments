/** Allowed race-to point targets for a game. */
export type MaxPoints = 11 | 15 | 21;

export const MAX_POINTS_OPTIONS: readonly MaxPoints[] = [11, 15, 21] as const;

/** Scorer quick picks. */
export const SCORER_MAX_POINTS_OPTIONS: readonly MaxPoints[] = [11, 15, 21] as const;

/** Number of games in a match (best of 1 or best of 3). */
export type BestOf = 1 | 3;

export const BEST_OF_OPTIONS: readonly BestOf[] = [1, 3] as const;

export function isMaxPoints(value: unknown): value is MaxPoints {
  return value === 11 || value === 15 || value === 21;
}

export function isBestOf(value: unknown): value is BestOf {
  return value === 1 || value === 3;
}

/** Hard cap when deuce continues: win by 2 until both reach this score, then golden point. */
export function deuceCapForMaxPoints(max: MaxPoints): number {
  if (max === 11) return 15;
  if (max === 15) return 21;
  return 30;
}

/** Team Championship uses golden point at race-to score (e.g. 15-15), not the extended cap. */
export function isTeamChampionshipCategory(category: unknown): boolean {
  if (typeof category !== 'string') return false;
  return category.trim().toLowerCase() === 'team championship';
}

/** True when stage is a Final (case-insensitive; trims whitespace). */
export function isFinalStage(stage: unknown): boolean {
  if (typeof stage !== 'string') return false;
  return stage.trim().toLowerCase() === 'final';
}

/**
 * Deuce/golden cap for this match.
 * Team Championship: golden at max-max (15-15 for race-to-15).
 * Others: extended cap via deuceCapForMaxPoints.
 */
export function deuceCapForMatch(category: unknown, maxPoints: MaxPoints): number {
  if (!isMaxPoints(maxPoints)) {
    throw new Error('deuceCapForMatch: maxPoints must be 11, 15, or 21');
  }
  if (isTeamChampionshipCategory(category)) {
    return maxPoints;
  }
  return deuceCapForMaxPoints(maxPoints);
}

/** One finished game within a best-of series. */
export interface GameScore {
  score1: number;
  score2: number;
  winner: 1 | 2;
}

export interface Team {
  id: string;
  name: string;
  players: string[];
}

export interface Fixture {
  id: string;
  date: string;
  time: string;
  category: string;
  stage: string;
  details: string;
  teamA?: string;
  teamB?: string;
  /** Runtime fields merged from Firebase when the match has been completed */
  status?: 'scheduled' | 'completed';
  result?: string;
  winnerName?: string;
  completedAt?: string;
  completedDate?: string;
  completedTime?: string;
  finalScore1?: number;
  finalScore2?: number;
}

/** Persisted finished-match row (Firebase `completedMatches/{fixtureId}`). */
export interface CompletedMatch {
  id: string;
  fixtureId: string;
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
  maxPoints: MaxPoints;
  winnerSide: 1 | 2;
  winnerName: string;
  result: string;
  status: 'completed';
  completedAt: string;
  completedDate: string;
  completedTime: string;
  isTrump: boolean;
  /** Best of 1 or 3 (defaults to 1 when missing). */
  bestOf?: BestOf;
  gamesWon1?: number;
  gamesWon2?: number;
  gameScores?: GameScore[];
  /** Public URL of score snapshot image in Storage `photos/` (optional). */
  snapshotUrl?: string;
  /** Storage object path, e.g. `photos/f-12-….png` (optional). */
  snapshotPath?: string;
}

export interface MatchState {
  currentMatchId: string;
  category: string;
  stage: string;
  teamA: string;
  teamB: string;
  player1: string;
  player2: string;
  score1: number;
  score2: number;
  maxPoints: MaxPoints;
  server: 1 | 2; // 1 = Team A serving, 2 = Team B serving
  servingSide: 'right' | 'left'; // Service court; updates on service over (even=right, odd=left)
  deuceActive: boolean;
  /** Winner of the current game (points race). */
  gameWinner: 1 | 2 | null;
  /** Best of 1 or best of 3 games. */
  bestOf: BestOf;
  /** 1-based index of the game currently being played. */
  gameNumber: number;
  /** Completed games in this series (final scores). */
  gameScores: GameScore[];
  gamesWon1: number;
  gamesWon2: number;
  /** Winner of the match/series (BO1: same as game; BO3: first to 2 games). */
  matchWinner: 1 | 2 | null;
  isTrump: boolean;
  trumpTeam: 1 | 2 | null;
  /** YouTube live (or VOD) URL consumed by the /live page */
  youtubeLiveUrl: string;
}

export const TEAMS: Team[] = [
  {
    id: 'team-a',
    name: 'Team A',
    players: ['Nitin Verma', 'Prateek Anand', 'Rup Chitrak', 'Anirudh', 'Manmohan']
  },
  {
    id: 'team-b',
    name: 'Team B',
    players: ['Sambit Mahapatra', 'Vinamara', 'Kumar Abhishek', 'Rumit Sehlot', 'Dinesh']
  },
  {
    id: 'team-c',
    name: 'Team C',
    players: ['Shaunak', 'Sanchit', 'Samik', 'Mayank Sehlot', 'Deepti Bapat']
  },
  {
    id: 'team-d',
    name: 'Team D',
    players: ['Abhishek Modi', 'Satish', 'Vishwajeet', 'Manila', 'Naman']
  },
  {
    id: 'team-e',
    name: 'Team E',
    players: ['Vikash Srivastava', 'Anupam', 'Ramakrishna', 'Sujata']
  }
];

/** NPL 2026 finals only — from Fixtures for finals.pdf (9 Aug). */
export const FIXTURES: Fixture[] = [
  { id: 'f-final-1', date: '9-Aug-26', time: '16:00', category: 'Boys Singles', stage: 'Final', details: 'Agam vs Kushagra', teamA: 'Agam', teamB: 'Kushagra' },
  { id: 'f-final-2', date: '9-Aug-26', time: '16:15', category: 'Girls Singles', stage: 'Final', details: 'Asavari vs Ananya SG', teamA: 'Asavari', teamB: 'Ananya SG' },
  { id: 'f-final-3', date: '9-Aug-26', time: '16:30', category: 'Boys Doubles', stage: 'Final', details: 'Anvik & Atharva vs Agam & Smaran', teamA: 'Anvik & Atharva', teamB: 'Agam & Smaran' },
  { id: 'f-final-4', date: '9-Aug-26', time: '16:45', category: 'Girls Doubles', stage: 'Final', details: 'Ananya SG & Stuthi vs Meher & Sadhana', teamA: 'Ananya SG & Stuthi', teamB: 'Meher & Sadhana' },
  { id: 'f-final-5', date: '9-Aug-26', time: '17:00', category: "Women's Singles", stage: 'Final', details: 'Manila vs Shila', teamA: 'Manila', teamB: 'Shila' },
  { id: 'f-final-6', date: '9-Aug-26', time: '17:15', category: "Women's Doubles", stage: 'Final', details: 'Shila & Ashritha vs Dhanya & Deepthi', teamA: 'Shila & Ashritha', teamB: 'Dhanya & Deepthi' },
  { id: 'f-final-7', date: '9-Aug-26', time: '17:30', category: "Men's Singles <35", stage: 'Final', details: 'Ishan vs Sambit', teamA: 'Ishan', teamB: 'Sambit' },
  { id: 'f-final-8', date: '9-Aug-26', time: '17:45', category: "Men's Singles >35", stage: 'Final', details: 'Nitin vs Vikash', teamA: 'Nitin', teamB: 'Vikash' },
  { id: 'f-final-9', date: '9-Aug-26', time: '18:00', category: 'Team Championship', stage: 'Final', details: "Sambit's Team vs Vikash's Team", teamA: "Sambit's Team", teamB: "Vikash's Team" },
  { id: 'f-final-10', date: '9-Aug-26', time: '18:15', category: "Men's Doubles B", stage: 'Final', details: 'TBD', teamA: 'TBD', teamB: 'TBD' },
  { id: 'f-final-11', date: '9-Aug-26', time: '18:30', category: "Men's Doubles A", stage: 'Final', details: 'Sambit & Shaunak vs Ishan & Abhishek Modi', teamA: 'Sambit & Shaunak', teamB: 'Ishan & Abhishek Modi' },
];

export const FIXTURE_DATES: string[] = Array.from(
  new Set(FIXTURES.map((f) => f.date))
);

export const INITIAL_MATCH: MatchState = {
  currentMatchId: 'f-final-1',
  category: 'Boys Singles',
  stage: 'Final',
  teamA: 'Agam',
  teamB: 'Kushagra',
  player1: 'Agam',
  player2: 'Kushagra',
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
  youtubeLiveUrl: ''
};
