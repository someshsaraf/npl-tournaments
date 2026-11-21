/** Which tournament's ruleset a match/fixture belongs to. */
export type Sport = 'badminton' | 'tennis';

export const SPORTS: readonly Sport[] = ['badminton', 'tennis'] as const;

export function isSport(value: unknown): value is Sport {
  return value === 'badminton' || value === 'tennis';
}

/** Defaults to 'badminton' — the sport all rows predate the `sport` field belonged to. */
export function resolveSport(value: unknown): Sport {
  return value === 'tennis' ? 'tennis' : 'badminton';
}

/**
 * Display labels. The `tennis` id is kept for the data store back-compat (existing
 * completedMatches rows) — residents see it as Lawn Tennis.
 */
export const SPORT_LABEL: Record<Sport, string> = {
  badminton: 'Badminton',
  tennis: 'Lawn Tennis'
};

/** Tennis stage — a label; the scoring rules themselves live on TennisRules. */
export type TennisStage = 'qualifier' | 'quarterfinal' | 'semifinal' | 'final';

export const TENNIS_STAGES: readonly TennisStage[] = [
  'qualifier',
  'quarterfinal',
  'semifinal',
  'final'
] as const;

export function isTennisStage(value: unknown): value is TennisStage {
  return (
    value === 'qualifier' || value === 'quarterfinal' || value === 'semifinal' || value === 'final'
  );
}

/** Label only — doesn't change rules. Doubles/team sides are combined strings, same as badminton. */
export type TennisMatchType = 'singles' | 'doubles' | 'team';

export const TENNIS_MATCH_TYPES: readonly TennisMatchType[] = ['singles', 'doubles', 'team'] as const;

export function isTennisMatchType(value: unknown): value is TennisMatchType {
  return value === 'singles' || value === 'doubles' || value === 'team';
}

/**
 * How a tennis match is won.
 * - `race`: first to `gamesTarget` games wins, no margin (qualifier "best of 4":
 *   at 3-3 the next game decides).
 * - `set`: a regular set — `gamesTarget` games with a 2-game margin, and a
 *   tiebreak at gamesTarget-all when `tiebreak` is on.
 * `goldenDeuce` = which deuce makes the next point sudden death (3 = third
 * deuce); null keeps classic advantage play forever.
 */
export interface TennisRules {
  format: 'race' | 'set';
  gamesTarget: number;
  goldenDeuce: number | null;
  tiebreak: boolean;
}

/** One finished game (or tiebreak) within a tennis match. */
export interface TennisPointGame {
  points1: number;
  points2: number;
  winner: 1 | 2;
  wasTiebreak: boolean;
  /** Deuce count when the game ended — lets undo reopen a game exactly. */
  deuceCount?: number;
  /** Game was decided on a golden point (the winning point isn't in points1/points2). */
  golden?: boolean;
}

/** Tennis-only mechanics, nested on MatchState.tennis when sport === 'tennis'. */
export interface TennisMatchState {
  tennisStage: TennisStage;
  matchType: TennisMatchType;
  /** Win condition + golden point rule for this match (set when the match starts). */
  rules: TennisRules;
  /** Raw point count in the current game (0,1,2,3,4…), or tiebreak points when isTiebreak. */
  points1: number;
  points2: number;
  isTiebreak: boolean;
  /** Number of times the current game has reached deuce; drives golden point in semifinals. */
  deuceCount: number;
  server: 1 | 2;
  /** Winner of the current game/tiebreak (transient; cleared when the next game starts). */
  gameWinner: 1 | 2 | null;
  gamesWon1: number;
  gamesWon2: number;
  gameLog: TennisPointGame[];
}

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
  /** Defaults to 'badminton' when absent (all existing fixtures predate this field). */
  sport?: Sport;
  teamA?: string;
  teamB?: string;
  /** Runtime fields merged from the data store when the match has been completed */
  status?: 'scheduled' | 'completed';
  result?: string;
  winnerName?: string;
  completedAt?: string;
  completedDate?: string;
  completedTime?: string;
  finalScore1?: number;
  finalScore2?: number;
}

/** Persisted finished-match row (the data store `completedMatches/{fixtureId}`). */
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
  /** Defaults to 'badminton' when absent (all existing rows predate this field). */
  sport?: Sport;
  /** Present only when sport === 'tennis'. */
  tennis?: {
    tennisStage: TennisStage;
    matchType: TennisMatchType;
    gamesWon1: number;
    gamesWon2: number;
    gameLog: TennisPointGame[];
  };
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
  /** Winner of the match/series (BO1: same as game; BO3: first to 2 games; tennis: the set/race winner). */
  matchWinner: 1 | 2 | null;
  isTrump: boolean;
  trumpTeam: 1 | 2 | null;
  /** YouTube live (or VOD) URL consumed by the /live page */
  youtubeLiveUrl: string;
  /** Defaults to 'badminton' for back-compat with existing the data store rows. */
  sport: Sport;
  /** Present only when sport === 'tennis'; badminton fields above are unused in that case. */
  tennis?: TennisMatchState;
}

/**
 * Built-in rosters/fixtures from before the tournament console. Empty: teams
 * and schedules now live in the data store (admin console), never in code.
 */
export const TEAMS: Team[] = [];

export const FIXTURES: Fixture[] = [];

export const FIXTURE_DATES: string[] = [];

export const INITIAL_MATCH: MatchState = {
  currentMatchId: '',
  category: '',
  stage: '',
  teamA: 'Team A',
  teamB: 'Team B',
  player1: 'Player 1',
  player2: 'Player 2',
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
  youtubeLiveUrl: '',
  sport: 'badminton'
};
