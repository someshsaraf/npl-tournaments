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
    players: ['Vikash Srivastava', 'Anupam', 'Mihir', 'Dhanashree']
  }
];

/** Full NPL 2026 master schedule (date-ordered) from official pools & fixtures PDF. */
export const FIXTURES: Fixture[] = [
  { id: 'f-1', date: '31-Jul-26', time: '17:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team B (Match 1)', teamA: 'Team A', teamB: 'Team B' },
  { id: 'f-2', date: '31-Jul-26', time: '17:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team B (Match 2)', teamA: 'Team A', teamB: 'Team B' },
  { id: 'f-3', date: '31-Jul-26', time: '17:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team B (Match 3)', teamA: 'Team A', teamB: 'Team B' },
  { id: 'f-4', date: '31-Jul-26', time: '17:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team B (Match 4)', teamA: 'Team A', teamB: 'Team B' },
  { id: 'f-5', date: '31-Jul-26', time: '18:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team B (Match 5)', teamA: 'Team A', teamB: 'Team B' },
  { id: 'f-6', date: '31-Jul-26', time: '18:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team C vs Team E (Match 1)', teamA: 'Team C', teamB: 'Team E' },
  { id: 'f-7', date: '31-Jul-26', time: '18:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team C vs Team E (Match 2)', teamA: 'Team C', teamB: 'Team E' },
  { id: 'f-8', date: '31-Jul-26', time: '18:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team C vs Team E (Match 3)', teamA: 'Team C', teamB: 'Team E' },
  { id: 'f-9', date: '31-Jul-26', time: '19:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team C vs Team E (Match 4)', teamA: 'Team C', teamB: 'Team E' },
  { id: 'f-10', date: '31-Jul-26', time: '19:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team C vs Team E (Match 5)', teamA: 'Team C', teamB: 'Team E' },
  { id: 'f-11', date: '31-Jul-26', time: '19:30', category: 'Boys Singles', stage: 'Group Stage', details: 'Agam vs Keerat Sahai', teamA: 'Agam', teamB: 'Keerat Sahai' },
  { id: 'f-12', date: '31-Jul-26', time: '19:45', category: 'Boys Singles', stage: 'Group Stage', details: 'Vivaan Puri vs Atharva Kitturu', teamA: 'Vivaan Puri', teamB: 'Atharva Kitturu' },
  { id: 'f-13', date: '31-Jul-26', time: '20:00', category: 'Boys Singles', stage: 'Group Stage', details: 'Arush Goyal vs Agam', teamA: 'Arush Goyal', teamB: 'Agam' },
  { id: 'f-14', date: '31-Jul-26', time: '20:15', category: 'Boys Singles', stage: 'Group Stage', details: 'Keerat Sahai vs Vivaan Puri', teamA: 'Keerat Sahai', teamB: 'Vivaan Puri' },
  { id: 'f-15', date: '31-Jul-26', time: '20:30', category: 'Boys Singles', stage: 'Group Stage', details: 'Atharva Kitturu vs Arush Goyal', teamA: 'Atharva Kitturu', teamB: 'Arush Goyal' },
  { id: 'f-16', date: '31-Jul-26', time: '20:45', category: 'Boys Singles', stage: 'Group Stage', details: 'Kushagra vs Riday', teamA: 'Kushagra', teamB: 'Riday' },
  { id: 'f-17', date: '1-Aug-26', time: '07:00', category: 'Boys Singles', stage: 'Group Stage', details: 'Aarav Karthik vs Tarun Rajavelu', teamA: 'Aarav Karthik', teamB: 'Tarun Rajavelu' },
  { id: 'f-18', date: '1-Aug-26', time: '07:15', category: 'Boys Singles', stage: 'Group Stage', details: 'Kevin Behl vs Kushagra', teamA: 'Kevin Behl', teamB: 'Kushagra' },
  { id: 'f-19', date: '1-Aug-26', time: '07:30', category: 'Boys Singles', stage: 'Group Stage', details: 'Riday vs Aarav Karthik', teamA: 'Riday', teamB: 'Aarav Karthik' },
  { id: 'f-20', date: '1-Aug-26', time: '07:45', category: 'Boys Singles', stage: 'Group Stage', details: 'Tarun Rajavelu vs Kevin Behl', teamA: 'Tarun Rajavelu', teamB: 'Kevin Behl' },
  { id: 'f-21', date: '1-Aug-26', time: '08:00', category: 'Boys Singles', stage: 'Group Stage', details: 'Anvik Suman vs Rithvik Anand', teamA: 'Anvik Suman', teamB: 'Rithvik Anand' },
  { id: 'f-22', date: '1-Aug-26', time: '08:15', category: 'Boys Singles', stage: 'Group Stage', details: 'Smaran vs Dhruv Siva', teamA: 'Smaran', teamB: 'Dhruv Siva' },
  { id: 'f-23', date: '1-Aug-26', time: '08:30', category: 'Boys Singles', stage: 'Group Stage', details: 'Anvik Suman vs Smaran', teamA: 'Anvik Suman', teamB: 'Smaran' },
  { id: 'f-24', date: '1-Aug-26', time: '08:45', category: 'Boys Singles', stage: 'Group Stage', details: 'Rithvik Anand vs Dhruv Siva', teamA: 'Rithvik Anand', teamB: 'Dhruv Siva' },
  { id: 'f-25', date: '1-Aug-26', time: '09:00', category: 'Boys Singles', stage: 'Group Stage', details: 'Anvik Suman vs Dhruv Siva', teamA: 'Anvik Suman', teamB: 'Dhruv Siva' },
  { id: 'f-26', date: '1-Aug-26', time: '09:15', category: 'Boys Singles', stage: 'Group Stage', details: 'Rithvik Anand vs Smaran', teamA: 'Rithvik Anand', teamB: 'Smaran' },
  { id: 'f-27', date: '1-Aug-26', time: '09:30', category: 'Boys Singles', stage: 'Group Stage', details: 'Agam vs Vivaan Puri', teamA: 'Agam', teamB: 'Vivaan Puri' },
  { id: 'f-28', date: '1-Aug-26', time: '09:45', category: 'Boys Singles', stage: 'Group Stage', details: 'Keerat Sahai vs Atharva Kitturu', teamA: 'Keerat Sahai', teamB: 'Atharva Kitturu' },
  { id: 'f-29', date: '1-Aug-26', time: '10:00', category: 'Girls Singles', stage: 'Group Stage', details: 'Ananya SG vs Ananya Adurthi', teamA: 'Ananya SG', teamB: 'Ananya Adurthi' },
  { id: 'f-30', date: '1-Aug-26', time: '10:15', category: 'Girls Singles', stage: 'Group Stage', details: 'Meenaakshi S vs Stuthi Rajanish', teamA: 'Meenaakshi S', teamB: 'Stuthi Rajanish' },
  { id: 'f-31', date: '1-Aug-26', time: '10:30', category: 'Girls Singles', stage: 'Group Stage', details: 'Ananya SG vs Meenaakshi S', teamA: 'Ananya SG', teamB: 'Meenaakshi S' },
  { id: 'f-32', date: '1-Aug-26', time: '10:45', category: 'Girls Singles', stage: 'Group Stage', details: 'Ananya Adurthi vs Stuthi Rajanish', teamA: 'Ananya Adurthi', teamB: 'Stuthi Rajanish' },
  { id: 'f-33', date: '1-Aug-26', time: '11:00', category: 'Girls Singles', stage: 'Group Stage', details: 'Ananya SG vs Stuthi Rajanish', teamA: 'Ananya SG', teamB: 'Stuthi Rajanish' },
  { id: 'f-34', date: '1-Aug-26', time: '11:15', category: 'Girls Singles', stage: 'Group Stage', details: 'Ananya Adurthi vs Meenaakshi S', teamA: 'Ananya Adurthi', teamB: 'Meenaakshi S' },
  { id: 'f-35', date: '1-Aug-26', time: '11:30', category: 'Girls Singles', stage: 'Group Stage', details: 'Sadhna kishor vs Asawari Aashish Desai', teamA: 'Sadhna kishor', teamB: 'Asawari Aashish Desai' },
  { id: 'f-36', date: '1-Aug-26', time: '11:45', category: 'Girls Singles', stage: 'Group Stage', details: 'Ria Payik vs Meher Gupta', teamA: 'Ria Payik', teamB: 'Meher Gupta' },
  { id: 'f-37', date: '1-Aug-26', time: '16:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team E vs Team A (Match 1)', teamA: 'Team E', teamB: 'Team A' },
  { id: 'f-38', date: '1-Aug-26', time: '16:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team E vs Team A (Match 2)', teamA: 'Team E', teamB: 'Team A' },
  { id: 'f-39', date: '1-Aug-26', time: '16:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team E vs Team A (Match 3)', teamA: 'Team E', teamB: 'Team A' },
  { id: 'f-40', date: '1-Aug-26', time: '16:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team E vs Team A (Match 4)', teamA: 'Team E', teamB: 'Team A' },
  { id: 'f-41', date: '1-Aug-26', time: '17:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team E vs Team A (Match 5)', teamA: 'Team E', teamB: 'Team A' },
  { id: 'f-42', date: '1-Aug-26', time: '17:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team B vs Team C (Match 1)', teamA: 'Team B', teamB: 'Team C' },
  { id: 'f-43', date: '1-Aug-26', time: '17:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team B vs Team C (Match 2)', teamA: 'Team B', teamB: 'Team C' },
  { id: 'f-44', date: '1-Aug-26', time: '17:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team B vs Team C (Match 3)', teamA: 'Team B', teamB: 'Team C' },
  { id: 'f-45', date: '1-Aug-26', time: '18:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team B vs Team C (Match 4)', teamA: 'Team B', teamB: 'Team C' },
  { id: 'f-46', date: '1-Aug-26', time: '18:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team B vs Team C (Match 5)', teamA: 'Team B', teamB: 'Team C' },
  { id: 'f-47', date: '1-Aug-26', time: '18:30', category: 'Girls Doubles', stage: 'Group Stage', details: 'Ananya SG & Stuti vs Ananya Adurthi & Meenakshi', teamA: 'Ananya SG & Stuti', teamB: 'Ananya Adurthi & Meenakshi' },
  { id: 'f-48', date: '1-Aug-26', time: '18:45', category: 'Girls Doubles', stage: 'Group Stage', details: 'Sadhna kishor & Meher vs Asawari Aashish Desai & Ria', teamA: 'Sadhna kishor & Meher', teamB: 'Asawari Aashish Desai & Ria' },
  { id: 'f-49', date: '1-Aug-26', time: '19:00', category: 'Girls Doubles', stage: 'Group Stage', details: 'Ananya SG & Stuti vs Sadhna kishor & Meher', teamA: 'Ananya SG & Stuti', teamB: 'Sadhna kishor & Meher' },
  { id: 'f-50', date: '1-Aug-26', time: '19:15', category: 'Girls Doubles', stage: 'Group Stage', details: 'Ananya Adurthi & Meenakshi vs Asawari Aashish Desai & Ria', teamA: 'Ananya Adurthi & Meenakshi', teamB: 'Asawari Aashish Desai & Ria' },
  { id: 'f-51', date: '1-Aug-26', time: '19:30', category: 'Girls Doubles', stage: 'Group Stage', details: 'Ananya SG & Stuti vs Asawari Aashish Desai & Ria', teamA: 'Ananya SG & Stuti', teamB: 'Asawari Aashish Desai & Ria' },
  { id: 'f-52', date: '1-Aug-26', time: '19:45', category: 'Girls Doubles', stage: 'Group Stage', details: 'Ananya Adurthi & Meenakshi vs Sadhna kishor & Meher', teamA: 'Ananya Adurthi & Meenakshi', teamB: 'Sadhna kishor & Meher' },
  { id: 'f-53', date: '1-Aug-26', time: '20:00', category: 'Boys Doubles', stage: 'Group Stage', details: 'Agam & Smaran vs Anvik Suman & Atharva', teamA: 'Agam & Smaran', teamB: 'Anvik Suman & Atharva' },
  { id: 'f-54', date: '1-Aug-26', time: '20:15', category: 'Boys Doubles', stage: 'Group Stage', details: 'Riday & Dhruv vs Vivaan Puri & Kevin', teamA: 'Riday & Dhruv', teamB: 'Vivaan Puri & Kevin' },
  { id: 'f-55', date: '1-Aug-26', time: '20:30', category: 'Boys Doubles', stage: 'Group Stage', details: 'Agam & Smaran vs Riday & Dhruv', teamA: 'Agam & Smaran', teamB: 'Riday & Dhruv' },
  { id: 'f-56', date: '1-Aug-26', time: '20:45', category: 'Boys Doubles', stage: 'Group Stage', details: 'Anvik Suman & Atharva vs Vivaan Puri & Kevin', teamA: 'Anvik Suman & Atharva', teamB: 'Vivaan Puri & Kevin' },
  { id: 'f-57', date: '2-Aug-26', time: '07:00', category: 'Boys Doubles', stage: 'Group Stage', details: 'Agam & Smaran vs Vivaan Puri & Kevin', teamA: 'Agam & Smaran', teamB: 'Vivaan Puri & Kevin' },
  { id: 'f-58', date: '2-Aug-26', time: '07:15', category: 'Boys Doubles', stage: 'Group Stage', details: 'Anvik Suman & Atharva vs Riday & Dhruv', teamA: 'Anvik Suman & Atharva', teamB: 'Riday & Dhruv' },
  { id: 'f-59', date: '2-Aug-26', time: '07:30', category: 'Boys Doubles', stage: 'Group Stage', details: 'Kushagra & Arush Goyal vs Keerat Sahai & Tarun', teamA: 'Kushagra & Arush Goyal', teamB: 'Keerat Sahai & Tarun' },
  { id: 'f-60', date: '2-Aug-26', time: '07:45', category: 'Boys Doubles', stage: 'Group Stage', details: 'Keerat Sahai & Tarun vs Rithvik Anand & Aarav', teamA: 'Keerat Sahai & Tarun', teamB: 'Rithvik Anand & Aarav' },
  { id: 'f-61', date: '2-Aug-26', time: '08:00', category: 'Boys Doubles', stage: 'Group Stage', details: 'Kushagra & Arush Goyal vs Rithvik Anand & Aarav', teamA: 'Kushagra & Arush Goyal', teamB: 'Rithvik Anand & Aarav' },
  { id: 'f-62', date: '2-Aug-26', time: '08:15', category: "Men's Singles >35", stage: 'Group Stage', details: 'Nitin Verma vs Vikash Srivastava', teamA: 'Nitin Verma', teamB: 'Vikash Srivastava' },
  { id: 'f-63', date: '2-Aug-26', time: '08:30', category: "Men's Singles >35", stage: 'Group Stage', details: 'Vinamra Jaiswal vs Anand', teamA: 'Vinamra Jaiswal', teamB: 'Anand' },
  { id: 'f-64', date: '2-Aug-26', time: '08:45', category: "Men's Singles >35", stage: 'Group Stage', details: 'Nitin Verma vs Rajanish GJ', teamA: 'Nitin Verma', teamB: 'Rajanish GJ' },
  { id: 'f-65', date: '2-Aug-26', time: '09:00', category: "Men's Singles >35", stage: 'Group Stage', details: 'Vikash Srivastava vs Vinamra Jaiswal', teamA: 'Vikash Srivastava', teamB: 'Vinamra Jaiswal' },
  { id: 'f-66', date: '2-Aug-26', time: '09:15', category: "Men's Singles >35", stage: 'Group Stage', details: 'Anand vs Rajanish GJ', teamA: 'Anand', teamB: 'Rajanish GJ' },
  { id: 'f-67', date: '2-Aug-26', time: '09:30', category: 'Boys Singles', stage: 'Group Stage', details: 'Agam vs Atharva Kitturu', teamA: 'Agam', teamB: 'Atharva Kitturu' },
  { id: 'f-68', date: '2-Aug-26', time: '09:45', category: 'Boys Singles', stage: 'Group Stage', details: 'Keerat Sahai vs Arush Goyal', teamA: 'Keerat Sahai', teamB: 'Arush Goyal' },
  { id: 'f-69', date: '2-Aug-26', time: '10:00', category: 'Girls Singles', stage: 'Group Stage', details: 'Sadhna kishor vs Ria Payik', teamA: 'Sadhna kishor', teamB: 'Ria Payik' },
  { id: 'f-70', date: '2-Aug-26', time: '10:15', category: 'Girls Singles', stage: 'Group Stage', details: 'Asawari Aashish Desai vs Meher Gupta', teamA: 'Asawari Aashish Desai', teamB: 'Meher Gupta' },
  { id: 'f-71', date: '2-Aug-26', time: '10:30', category: 'Girls Singles', stage: 'Group Stage', details: 'Sadhna kishor vs Meher Gupta', teamA: 'Sadhna kishor', teamB: 'Meher Gupta' },
  { id: 'f-72', date: '2-Aug-26', time: '10:45', category: 'Girls Singles', stage: 'Group Stage', details: 'Asawari Aashish Desai vs Ria Payik', teamA: 'Asawari Aashish Desai', teamB: 'Ria Payik' },
  { id: 'f-73', date: '2-Aug-26', time: '11:00', category: "Women's Singles", stage: 'Group Stage', details: 'Sujata Dusi vs Shila sg', teamA: 'Sujata Dusi', teamB: 'Shila sg' },
  { id: 'f-74', date: '2-Aug-26', time: '11:15', category: "Women's Singles", stage: 'Group Stage', details: 'Anisha vs Manila', teamA: 'Anisha', teamB: 'Manila' },
  { id: 'f-75', date: '2-Aug-26', time: '11:30', category: "Women's Singles", stage: 'Group Stage', details: 'Sujata Dusi vs Anisha', teamA: 'Sujata Dusi', teamB: 'Anisha' },
  { id: 'f-76', date: '2-Aug-26', time: '11:45', category: "Women's Singles", stage: 'Group Stage', details: 'Shila sg vs Manila', teamA: 'Shila sg', teamB: 'Manila' },
  { id: 'f-77', date: '2-Aug-26', time: '12:00', category: "Women's Singles", stage: 'Group Stage', details: 'Sujata Dusi vs Saanvi', teamA: 'Sujata Dusi', teamB: 'Saanvi' },
  { id: 'f-78', date: '2-Aug-26', time: '12:15', category: "Women's Singles", stage: 'Group Stage', details: 'Shila sg vs Saanvi', teamA: 'Shila sg', teamB: 'Saanvi' },
  { id: 'f-79', date: '2-Aug-26', time: '16:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team D vs Team E (Match 1)', teamA: 'Team D', teamB: 'Team E' },
  { id: 'f-80', date: '2-Aug-26', time: '16:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team D vs Team E (Match 2)', teamA: 'Team D', teamB: 'Team E' },
  { id: 'f-81', date: '2-Aug-26', time: '16:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team D vs Team E (Match 3)', teamA: 'Team D', teamB: 'Team E' },
  { id: 'f-82', date: '2-Aug-26', time: '16:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team D vs Team E (Match 4)', teamA: 'Team D', teamB: 'Team E' },
  { id: 'f-83', date: '2-Aug-26', time: '17:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team D vs Team E (Match 5)', teamA: 'Team D', teamB: 'Team E' },
  { id: 'f-84', date: '2-Aug-26', time: '17:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team C (Match 1)', teamA: 'Team A', teamB: 'Team C' },
  { id: 'f-85', date: '2-Aug-26', time: '17:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team C (Match 2)', teamA: 'Team A', teamB: 'Team C' },
  { id: 'f-86', date: '2-Aug-26', time: '17:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team C (Match 3)', teamA: 'Team A', teamB: 'Team C' },
  { id: 'f-87', date: '2-Aug-26', time: '18:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team C (Match 4)', teamA: 'Team A', teamB: 'Team C' },
  { id: 'f-88', date: '2-Aug-26', time: '18:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team C (Match 5)', teamA: 'Team A', teamB: 'Team C' },
  { id: 'f-89', date: '2-Aug-26', time: '18:30', category: "Men's Doubles A", stage: 'Group Stage', details: 'Nitin Verma & Sanchit vs Tejas A & Anupam', teamA: 'Nitin Verma & Sanchit', teamB: 'Tejas A & Anupam' },
  { id: 'f-90', date: '2-Aug-26', time: '18:45', category: "Men's Doubles A", stage: 'Group Stage', details: 'Sambit Mahapatra & Shaunak vs Ishan Suman & Abhishek Modi', teamA: 'Sambit Mahapatra & Shaunak', teamB: 'Ishan Suman & Abhishek Modi' },
  { id: 'f-91', date: '2-Aug-26', time: '19:00', category: "Men's Doubles A", stage: 'Group Stage', details: 'Ajay Narang & Vikash vs Nitin Verma & Sanchit', teamA: 'Ajay Narang & Vikash', teamB: 'Nitin Verma & Sanchit' },
  { id: 'f-92', date: '2-Aug-26', time: '19:15', category: "Men's Doubles A", stage: 'Group Stage', details: 'Tejas A & Anupam vs Sambit Mahapatra & Shaunak', teamA: 'Tejas A & Anupam', teamB: 'Sambit Mahapatra & Shaunak' },
  { id: 'f-93', date: '2-Aug-26', time: '19:30', category: "Men's Doubles A", stage: 'Group Stage', details: 'Ishan Suman & Abhishek Modi vs Ajay Narang & Vikash', teamA: 'Ishan Suman & Abhishek Modi', teamB: 'Ajay Narang & Vikash' },
  { id: 'f-94', date: '2-Aug-26', time: '19:45', category: "Men's Doubles B", stage: 'Group Stage', details: 'Prateek Surana & Samik vs Vinamra Jaiswal & Anirudh', teamA: 'Prateek Surana & Samik', teamB: 'Vinamra Jaiswal & Anirudh' },
  { id: 'f-95', date: '2-Aug-26', time: '20:00', category: "Men's Doubles B", stage: 'Group Stage', details: 'Satish Ram & Mihir vs Vishwajeet & Mayank Sehlot', teamA: 'Satish Ram & Mihir', teamB: 'Vishwajeet & Mayank Sehlot' },
  { id: 'f-96', date: '2-Aug-26', time: '20:15', category: "Men's Doubles B", stage: 'Group Stage', details: 'Prateek Surana & Samik vs Satish Ram & Mihir', teamA: 'Prateek Surana & Samik', teamB: 'Satish Ram & Mihir' },
  { id: 'f-97', date: '2-Aug-26', time: '20:30', category: "Men's Doubles B", stage: 'Group Stage', details: 'Vinamra Jaiswal & Anirudh vs Vishwajeet & Mayank Sehlot', teamA: 'Vinamra Jaiswal & Anirudh', teamB: 'Vishwajeet & Mayank Sehlot' },
  { id: 'f-98', date: '2-Aug-26', time: '20:45', category: "Men's Doubles B", stage: 'Group Stage', details: 'Prateek Surana & Samik vs Vishwajeet & Mayank Sehlot', teamA: 'Prateek Surana & Samik', teamB: 'Vishwajeet & Mayank Sehlot' },
  { id: 'f-99', date: '7-Aug-26', time: '17:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team B vs Team D (Match 1)', teamA: 'Team B', teamB: 'Team D' },
  { id: 'f-100', date: '7-Aug-26', time: '17:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team B vs Team D (Match 2)', teamA: 'Team B', teamB: 'Team D' },
  { id: 'f-101', date: '7-Aug-26', time: '17:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team B vs Team D (Match 3)', teamA: 'Team B', teamB: 'Team D' },
  { id: 'f-102', date: '7-Aug-26', time: '17:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team B vs Team D (Match 4)', teamA: 'Team B', teamB: 'Team D' },
  { id: 'f-103', date: '7-Aug-26', time: '18:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team B vs Team D (Match 5)', teamA: 'Team B', teamB: 'Team D' },
  { id: 'f-104', date: '7-Aug-26', time: '18:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team E vs Team B (Match 1)', teamA: 'Team E', teamB: 'Team B' },
  { id: 'f-105', date: '7-Aug-26', time: '18:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team E vs Team B (Match 2)', teamA: 'Team E', teamB: 'Team B' },
  { id: 'f-106', date: '7-Aug-26', time: '18:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team E vs Team B (Match 3)', teamA: 'Team E', teamB: 'Team B' },
  { id: 'f-107', date: '7-Aug-26', time: '19:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team E vs Team B (Match 4)', teamA: 'Team E', teamB: 'Team B' },
  { id: 'f-108', date: '7-Aug-26', time: '19:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team E vs Team B (Match 5)', teamA: 'Team E', teamB: 'Team B' },
  { id: 'f-109', date: '7-Aug-26', time: '19:30', category: "Men's Doubles B", stage: 'Group Stage', details: 'Vinamra Jaiswal & Anirudh vs Satish Ram & Mihir', teamA: 'Vinamra Jaiswal & Anirudh', teamB: 'Satish Ram & Mihir' },
  { id: 'f-110', date: '7-Aug-26', time: '19:45', category: "Men's Doubles B", stage: 'Group Stage', details: 'Anand & Rohit vs Kshounis & Manmohan', teamA: 'Anand & Rohit', teamB: 'Kshounis & Manmohan' },
  { id: 'f-111', date: '7-Aug-26', time: '20:00', category: "Men's Doubles B", stage: 'Group Stage', details: 'Kumar Abhishek & Rajanish vs Rumit Sehlot & Naman', teamA: 'Kumar Abhishek & Rajanish', teamB: 'Rumit Sehlot & Naman' },
  { id: 'f-112', date: '7-Aug-26', time: '20:15', category: "Men's Doubles B", stage: 'Group Stage', details: 'Anand & Rohit vs Kumar Abhishek & Rajanish', teamA: 'Anand & Rohit', teamB: 'Kumar Abhishek & Rajanish' },
  { id: 'f-113', date: '7-Aug-26', time: '20:30', category: "Men's Doubles B", stage: 'Group Stage', details: 'Kshounis & Manmohan vs Rumit Sehlot & Naman', teamA: 'Kshounis & Manmohan', teamB: 'Rumit Sehlot & Naman' },
  { id: 'f-114', date: '7-Aug-26', time: '20:45', category: "Men's Doubles B", stage: 'Group Stage', details: 'Anand & Rohit vs Rumit Sehlot & Naman', teamA: 'Anand & Rohit', teamB: 'Rumit Sehlot & Naman' },
  { id: 'f-115', date: '8-Aug-26', time: '07:00', category: "Men's Singles <35", stage: 'Group Stage', details: 'Tejas A vs Sambit Mahapatra', teamA: 'Tejas A', teamB: 'Sambit Mahapatra' },
  { id: 'f-116', date: '8-Aug-26', time: '07:15', category: "Men's Singles <35", stage: 'Group Stage', details: 'Anupam vs Anirudh Rakesh', teamA: 'Anupam', teamB: 'Anirudh Rakesh' },
  { id: 'f-117', date: '8-Aug-26', time: '07:30', category: "Men's Singles <35", stage: 'Group Stage', details: 'Tejas A vs Anupam', teamA: 'Tejas A', teamB: 'Anupam' },
  { id: 'f-118', date: '8-Aug-26', time: '07:45', category: "Men's Singles <35", stage: 'Group Stage', details: 'Sambit Mahapatra vs Anirudh Rakesh', teamA: 'Sambit Mahapatra', teamB: 'Anirudh Rakesh' },
  { id: 'f-119', date: '8-Aug-26', time: '08:00', category: "Men's Singles <35", stage: 'Group Stage', details: 'Tejas A vs Anirudh Rakesh', teamA: 'Tejas A', teamB: 'Anirudh Rakesh' },
  { id: 'f-120', date: '8-Aug-26', time: '08:15', category: "Men's Singles <35", stage: 'Group Stage', details: 'Sambit Mahapatra vs Anupam', teamA: 'Sambit Mahapatra', teamB: 'Anupam' },
  { id: 'f-121', date: '8-Aug-26', time: '08:30', category: "Men's Singles <35", stage: 'Group Stage', details: 'Ishan Suman vs Ajay Narang', teamA: 'Ishan Suman', teamB: 'Ajay Narang' },
  { id: 'f-122', date: '8-Aug-26', time: '08:45', category: "Men's Singles <35", stage: 'Group Stage', details: 'Shaunak vs Rup Chitrak', teamA: 'Shaunak', teamB: 'Rup Chitrak' },
  { id: 'f-123', date: '8-Aug-26', time: '09:00', category: "Men's Singles <35", stage: 'Group Stage', details: 'Ishan Suman vs Shaunak', teamA: 'Ishan Suman', teamB: 'Shaunak' },
  { id: 'f-124', date: '8-Aug-26', time: '09:15', category: "Men's Singles <35", stage: 'Group Stage', details: 'Ajay Narang vs Rup Chitrak', teamA: 'Ajay Narang', teamB: 'Rup Chitrak' },
  { id: 'f-125', date: '8-Aug-26', time: '09:30', category: "Men's Singles <35", stage: 'Group Stage', details: 'Ishan Suman vs Rup Chitrak', teamA: 'Ishan Suman', teamB: 'Rup Chitrak' },
  { id: 'f-126', date: '8-Aug-26', time: '09:45', category: "Men's Singles <35", stage: 'Group Stage', details: 'Ajay Narang vs Shaunak', teamA: 'Ajay Narang', teamB: 'Shaunak' },
  { id: 'f-127', date: '8-Aug-26', time: '10:00', category: "Women's Doubles", stage: 'Group Stage', details: 'Sujata Dusi & Punitha vs Shila sg & Ashritha', teamA: 'Sujata Dusi & Punitha', teamB: 'Shila sg & Ashritha' },
  { id: 'f-128', date: '8-Aug-26', time: '10:15', category: "Women's Doubles", stage: 'Group Stage', details: 'Anisha & Dhanashree vs Manila & Shwetha', teamA: 'Anisha & Dhanashree', teamB: 'Manila & Shwetha' },
  { id: 'f-129', date: '8-Aug-26', time: '10:30', category: "Women's Doubles", stage: 'Group Stage', details: 'Sujata Dusi & Punitha vs Deepthi Bapat & Dhanya', teamA: 'Sujata Dusi & Punitha', teamB: 'Deepthi Bapat & Dhanya' },
  { id: 'f-130', date: '8-Aug-26', time: '10:45', category: "Women's Doubles", stage: 'Group Stage', details: 'Shila sg & Ashritha vs Anisha & Dhanashree', teamA: 'Shila sg & Ashritha', teamB: 'Anisha & Dhanashree' },
  { id: 'f-131', date: '8-Aug-26', time: '11:00', category: "Women's Doubles", stage: 'Group Stage', details: 'Manila & Shwetha vs Deepthi Bapat & Dhanya', teamA: 'Manila & Shwetha', teamB: 'Deepthi Bapat & Dhanya' },
  { id: 'f-132', date: '8-Aug-26', time: '11:15', category: "Women's Singles", stage: 'Group Stage', details: 'Sujata Dusi vs Manila', teamA: 'Sujata Dusi', teamB: 'Manila' },
  { id: 'f-133', date: '8-Aug-26', time: '11:30', category: "Women's Singles", stage: 'Group Stage', details: 'Shila sg vs Anisha', teamA: 'Shila sg', teamB: 'Anisha' },
  { id: 'f-134', date: '8-Aug-26', time: '11:45', category: "Women's Singles", stage: 'Group Stage', details: 'Anisha vs Saanvi', teamA: 'Anisha', teamB: 'Saanvi' },
  { id: 'f-135', date: '8-Aug-26', time: '12:00', category: "Women's Singles", stage: 'Group Stage', details: 'Manila vs Saanvi', teamA: 'Manila', teamB: 'Saanvi' },
  { id: 'f-136', date: '8-Aug-26', time: '12:15', category: "Women's Doubles", stage: 'Group Stage', details: 'Sujata Dusi & Punitha vs Anisha & Dhanashree', teamA: 'Sujata Dusi & Punitha', teamB: 'Anisha & Dhanashree' },
  { id: 'f-137', date: '8-Aug-26', time: '16:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team C vs Team D (Match 1)', teamA: 'Team C', teamB: 'Team D' },
  { id: 'f-138', date: '8-Aug-26', time: '16:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team C vs Team D (Match 2)', teamA: 'Team C', teamB: 'Team D' },
  { id: 'f-139', date: '8-Aug-26', time: '16:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team C vs Team D (Match 3)', teamA: 'Team C', teamB: 'Team D' },
  { id: 'f-140', date: '8-Aug-26', time: '16:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team C vs Team D (Match 4)', teamA: 'Team C', teamB: 'Team D' },
  { id: 'f-141', date: '8-Aug-26', time: '17:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team C vs Team D (Match 5)', teamA: 'Team C', teamB: 'Team D' },
  { id: 'f-142', date: '8-Aug-26', time: '17:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team D (Match 1)', teamA: 'Team A', teamB: 'Team D' },
  { id: 'f-143', date: '8-Aug-26', time: '17:30', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team D (Match 2)', teamA: 'Team A', teamB: 'Team D' },
  { id: 'f-144', date: '8-Aug-26', time: '17:45', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team D (Match 3)', teamA: 'Team A', teamB: 'Team D' },
  { id: 'f-145', date: '8-Aug-26', time: '18:00', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team D (Match 4)', teamA: 'Team A', teamB: 'Team D' },
  { id: 'f-146', date: '8-Aug-26', time: '18:15', category: 'Team Championship', stage: 'Group Stage', details: 'Team A vs Team D (Match 5)', teamA: 'Team A', teamB: 'Team D' },
  { id: 'f-147', date: '8-Aug-26', time: '18:30', category: "Men's Doubles A", stage: 'Group Stage', details: 'Nitin Verma & Sanchit vs Sambit Mahapatra & Shaunak', teamA: 'Nitin Verma & Sanchit', teamB: 'Sambit Mahapatra & Shaunak' },
  { id: 'f-148', date: '8-Aug-26', time: '18:45', category: "Men's Doubles A", stage: 'Group Stage', details: 'Tejas A & Anupam vs Ishan Suman & Abhishek Modi', teamA: 'Tejas A & Anupam', teamB: 'Ishan Suman & Abhishek Modi' },
  { id: 'f-149', date: '8-Aug-26', time: '19:00', category: "Men's Doubles A", stage: 'Group Stage', details: 'Sambit Mahapatra & Shaunak vs Ajay Narang & Vikash', teamA: 'Sambit Mahapatra & Shaunak', teamB: 'Ajay Narang & Vikash' },
  { id: 'f-150', date: '8-Aug-26', time: '19:15', category: "Men's Doubles A", stage: 'Group Stage', details: 'Nitin Verma & Sanchit vs Ishan Suman & Abhishek Modi', teamA: 'Nitin Verma & Sanchit', teamB: 'Ishan Suman & Abhishek Modi' },
  { id: 'f-151', date: '8-Aug-26', time: '19:30', category: "Men's Doubles A", stage: 'Group Stage', details: 'Tejas A & Anupam vs Ajay Narang & Vikash', teamA: 'Tejas A & Anupam', teamB: 'Ajay Narang & Vikash' },
  { id: 'f-152', date: '8-Aug-26', time: '19:45', category: "Men's Doubles B", stage: 'Group Stage', details: 'Kshounis & Manmohan vs Kumar Abhishek & Rajanish', teamA: 'Kshounis & Manmohan', teamB: 'Kumar Abhishek & Rajanish' },
  { id: 'f-153', date: '8-Aug-26', time: '20:00', category: "Men's Singles >35", stage: 'Group Stage', details: 'Nitin Verma vs Vinamra Jaiswal', teamA: 'Nitin Verma', teamB: 'Vinamra Jaiswal' },
  { id: 'f-154', date: '8-Aug-26', time: '20:15', category: "Men's Singles >35", stage: 'Group Stage', details: 'Vikash Srivastava vs Anand', teamA: 'Vikash Srivastava', teamB: 'Anand' },
  { id: 'f-155', date: '8-Aug-26', time: '20:30', category: "Men's Singles >35", stage: 'Group Stage', details: 'Nitin Verma vs Anand', teamA: 'Nitin Verma', teamB: 'Anand' },
  { id: 'f-156', date: '8-Aug-26', time: '20:45', category: "Men's Singles >35", stage: 'Group Stage', details: 'Vikash Srivastava vs Rajanish GJ', teamA: 'Vikash Srivastava', teamB: 'Rajanish GJ' },
  { id: 'f-157', date: '8-Aug-26', time: '21:00', category: "Men's Singles >35", stage: 'Group Stage', details: 'Vinamra Jaiswal vs Rajanish GJ', teamA: 'Vinamra Jaiswal', teamB: 'Rajanish GJ' },
  { id: 'f-158', date: '9-Aug-26', time: '07:00', category: 'Boys Singles', stage: 'Group Stage', details: 'Vivaan Puri vs Arush Goyal', teamA: 'Vivaan Puri', teamB: 'Arush Goyal' },
  { id: 'f-159', date: '9-Aug-26', time: '07:15', category: 'Boys Singles', stage: 'Group Stage', details: 'Kushagra vs Aarav Karthik', teamA: 'Kushagra', teamB: 'Aarav Karthik' },
  { id: 'f-160', date: '9-Aug-26', time: '07:30', category: 'Boys Singles', stage: 'Group Stage', details: 'Kushagra vs Tarun Rajavelu', teamA: 'Kushagra', teamB: 'Tarun Rajavelu' },
  { id: 'f-161', date: '9-Aug-26', time: '07:45', category: 'Boys Singles', stage: 'Group Stage', details: 'Riday vs Tarun Rajavelu', teamA: 'Riday', teamB: 'Tarun Rajavelu' },
  { id: 'f-162', date: '9-Aug-26', time: '08:00', category: 'Boys Singles', stage: 'Group Stage', details: 'Riday vs Kevin Behl', teamA: 'Riday', teamB: 'Kevin Behl' },
  { id: 'f-163', date: '9-Aug-26', time: '08:15', category: 'Boys Singles', stage: 'Group Stage', details: 'Aarav Karthik vs Kevin Behl', teamA: 'Aarav Karthik', teamB: 'Kevin Behl' },
  { id: 'f-164', date: '9-Aug-26', time: '08:30', category: "Women's Doubles", stage: 'Group Stage', details: 'Shila sg & Ashritha vs Manila & Shwetha', teamA: 'Shila sg & Ashritha', teamB: 'Manila & Shwetha' },
  { id: 'f-165', date: '9-Aug-26', time: '08:45', category: "Women's Doubles", stage: 'Group Stage', details: 'Sujata Dusi & Punitha vs Manila & Shwetha', teamA: 'Sujata Dusi & Punitha', teamB: 'Manila & Shwetha' },
  { id: 'f-166', date: '9-Aug-26', time: '09:00', category: "Women's Doubles", stage: 'Group Stage', details: 'Shila sg & Ashritha vs Deepthi Bapat & Dhanya', teamA: 'Shila sg & Ashritha', teamB: 'Deepthi Bapat & Dhanya' },
  { id: 'f-167', date: '9-Aug-26', time: '09:15', category: "Women's Doubles", stage: 'Group Stage', details: 'Anisha & Dhanashree vs Deepthi Bapat & Dhanya', teamA: 'Anisha & Dhanashree', teamB: 'Deepthi Bapat & Dhanya' },
  { id: 'f-168', date: '9-Aug-26', time: '09:30', category: 'Boys Singles', stage: 'Round 2', details: 'Winner Pool A vs Winner Pool B', teamA: 'Winner Pool A', teamB: 'Winner Pool B' },
  { id: 'f-169', date: '9-Aug-26', time: '09:45', category: 'Boys Singles', stage: 'Round 2', details: 'Winner Pool A vs Winner Pool C', teamA: 'Winner Pool A', teamB: 'Winner Pool C' },
  { id: 'f-170', date: '9-Aug-26', time: '10:00', category: 'Boys Singles', stage: 'Round 2', details: 'Winner Pool B vs Winner Pool C', teamA: 'Winner Pool B', teamB: 'Winner Pool C' },
  { id: 'f-171', date: '9-Aug-26', time: '10:15', category: 'Boys Doubles', stage: 'Semi-Final', details: 'Winner Pool A vs Runner-up Pool B', teamA: 'Winner Pool A', teamB: 'Runner-up Pool B' },
  { id: 'f-172', date: '9-Aug-26', time: '10:30', category: 'Boys Doubles', stage: 'Semi-Final', details: 'Winner Pool B vs Runner-up Pool A', teamA: 'Winner Pool B', teamB: 'Runner-up Pool A' },
  { id: 'f-173', date: '9-Aug-26', time: '10:45', category: "Men's Doubles B", stage: 'Semi-Final', details: 'Winner Pool A vs Runner-up Pool B', teamA: 'Winner Pool A', teamB: 'Runner-up Pool B' },
  { id: 'f-174', date: '9-Aug-26', time: '11:00', category: "Men's Doubles B", stage: 'Semi-Final', details: 'Winner Pool B vs Runner-up Pool A', teamA: 'Winner Pool B', teamB: 'Runner-up Pool A' },
  { id: 'f-175', date: '9-Aug-26', time: '11:15', category: "Men's Singles <35", stage: 'Semi-Final', details: 'Winner Pool A vs Runner-up Pool B', teamA: 'Winner Pool A', teamB: 'Runner-up Pool B' },
  { id: 'f-176', date: '9-Aug-26', time: '11:30', category: "Men's Singles <35", stage: 'Semi-Final', details: 'Winner Pool B vs Runner-up Pool A', teamA: 'Winner Pool B', teamB: 'Runner-up Pool A' },
  { id: 'f-177', date: '9-Aug-26', time: '11:45', category: 'Girls Singles', stage: 'Semi-Final', details: 'Winner Pool A vs Runner-up Pool B', teamA: 'Winner Pool A', teamB: 'Runner-up Pool B' },
  { id: 'f-178', date: '9-Aug-26', time: '12:00', category: 'Girls Singles', stage: 'Semi-Final', details: 'Winner Pool B vs Runner-up Pool A', teamA: 'Winner Pool B', teamB: 'Runner-up Pool A' },
  { id: 'f-179', date: '9-Aug-26', time: '16:00', category: 'Boys Singles', stage: 'Final', details: 'Finalist 1 vs Finalist 2', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-180', date: '9-Aug-26', time: '16:15', category: 'Girls Singles', stage: 'Final', details: 'Finalist 1 vs Finalist 2', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-181', date: '9-Aug-26', time: '16:30', category: 'Boys Doubles', stage: 'Final', details: 'Finalist 1 vs Finalist 2', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-182', date: '9-Aug-26', time: '16:45', category: 'Girls Doubles', stage: 'Final', details: 'Finalist 1 vs Finalist 2', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-183', date: '9-Aug-26', time: '17:00', category: "Women's Singles", stage: 'Final', details: 'Finalist 1 vs Finalist 2', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-184', date: '9-Aug-26', time: '17:15', category: "Women's Doubles", stage: 'Final', details: 'Finalist 1 vs Finalist 2', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-185', date: '9-Aug-26', time: '17:30', category: "Men's Singles <35", stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 1)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-186', date: '9-Aug-26', time: '17:45', category: "Men's Singles <35", stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 2)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-187', date: '9-Aug-26', time: '18:00', category: "Men's Singles <35", stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 3)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-188', date: '9-Aug-26', time: '18:15', category: "Men's Singles >35", stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 1)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-189', date: '9-Aug-26', time: '18:30', category: "Men's Singles >35", stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 2)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-190', date: '9-Aug-26', time: '18:45', category: "Men's Singles >35", stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 3)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-191', date: '9-Aug-26', time: '19:00', category: 'Team Championship', stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 1)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-192', date: '9-Aug-26', time: '19:15', category: 'Team Championship', stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 2)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-193', date: '9-Aug-26', time: '19:30', category: 'Team Championship', stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 3)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-194', date: '9-Aug-26', time: '19:45', category: 'Team Championship', stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 4)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-195', date: '9-Aug-26', time: '20:00', category: 'Team Championship', stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 5)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-196', date: '9-Aug-26', time: '20:15', category: "Men's Doubles B", stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 1)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-197', date: '9-Aug-26', time: '20:30', category: "Men's Doubles B", stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 2)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-198', date: '9-Aug-26', time: '20:45', category: "Men's Doubles B", stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 3)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-199', date: '9-Aug-26', time: '21:00', category: "Men's Doubles A", stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 1)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-200', date: '9-Aug-26', time: '21:15', category: "Men's Doubles A", stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 2)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
  { id: 'f-201', date: '9-Aug-26', time: '21:30', category: "Men's Doubles A", stage: 'Final', details: 'Finalist 1 vs Finalist 2 (Match 3)', teamA: 'Finalist 1', teamB: 'Finalist 2' },
];

export const FIXTURE_DATES: string[] = Array.from(
  new Set(FIXTURES.map((f) => f.date))
);

export const INITIAL_MATCH: MatchState = {
  currentMatchId: 'f-1',
  category: 'Team Championship',
  stage: 'Group Stage',
  teamA: 'Team A',
  teamB: 'Team B',
  player1: 'Nitin Verma',
  player2: 'Sambit Mahapatra',
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
