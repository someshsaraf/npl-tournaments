import type { BestOf, MaxPoints, Sport, TennisMatchType, TennisRules, TennisStage } from './tournamentData';
import { SPORT_LABEL } from './tournamentData';
import { defaultTennisRulesForStage } from '../utils/tennisScoring';

/**
 * A sport's tournament, built by admins in the tournament console
 * (/admin/badminton, /admin/lawn-tennis). Stored at
 * `tournaments/{sport}/draft` (admin working copy) and copied to
 * `tournaments/{sport}/published` on Publish — residents only ever see the
 * published copy.
 *
 * Structure: categories (format × division like "Adults Singles", or custom
 * names like "Men's Singles <35") → pools of entries (a player, a doubles
 * pair, or a team) → fixtures (round robin per pool, then knockouts fed by
 * pool winners, plus any matches added by hand).
 */

export type TournamentFormat = 'singles' | 'doubles' | 'team';
export type TournamentDivision = 'kids' | 'adults' | 'women';

export const TOURNAMENT_FORMATS: readonly TournamentFormat[] = ['singles', 'doubles', 'team'] as const;
export const TOURNAMENT_DIVISIONS: readonly TournamentDivision[] = ['kids', 'adults', 'women'] as const;

export const FORMAT_LABEL: Record<TournamentFormat, string> = {
  singles: 'Singles',
  doubles: 'Doubles',
  team: 'Team Championship'
};

export const DIVISION_LABEL: Record<TournamentDivision, string> = {
  kids: 'Kids',
  adults: 'Adults',
  women: 'Women'
};

/** A player (singles), a pair (doubles) or a team of 3-4 (team). */
export interface TournamentEntry {
  id: string;
  /** Display name: the player, "A & B", or the team name. */
  name: string;
  players: string[];
}

export interface TournamentPool {
  id: string;
  name: string;
  entries: TournamentEntry[];
  /**
   * Just a list of entries (e.g. the two finalists) — no round robin is
   * generated and it's hidden from the pool tables.
   */
  listOnly?: boolean;
}

/** Where pool winners go next. `auto` picks from the number of qualifiers. */
export type KnockoutStart = 'auto' | 'quarterfinal' | 'semifinal' | 'final' | 'none';

export interface TournamentCategory {
  id: string;
  format: TournamentFormat;
  /** Absent for the Team Championship (no divisions) and custom categories. */
  division?: TournamentDivision;
  /** Display name override, e.g. "Men's Singles <35". */
  name?: string;
  /** Added by hand (kept regardless of the format/division picks). */
  custom?: boolean;
  pools: TournamentPool[];
  /** Pool finishers that advance from each pool (1 = pool winner only). */
  qualifiersPerPool: number;
  knockoutStart: KnockoutStart;
}

export type FixtureStage = 'pool' | 'quarterfinal' | 'semifinal' | 'final';

/**
 * A side of a fixture. Pool fixtures point at an entry; knockout fixtures
 * start as placeholders ("Winner Pool A", "Winner SF1") that resolve as
 * results come in. An admin can pin any side to a specific entry.
 */
export type FixtureSide =
  | { kind: 'entry'; entryId: string }
  | { kind: 'poolRank'; poolId: string; rank: number }
  | { kind: 'winnerOf'; fixtureId: string }
  | { kind: 'bye' }
  | { kind: 'tbd' };

export interface TournamentFixture {
  id: string;
  categoryId: string;
  stage: FixtureStage;
  poolId?: string;
  /** Knockout slot number within its stage (QF1…QF4, SF1, SF2). */
  slot?: number;
  sideA: FixtureSide;
  sideB: FixtureSide;
  /** Original generated side, kept while an admin has pinned sideA/sideB by hand. */
  autoSideA?: FixtureSide;
  autoSideB?: FixtureSide;
  /** ISO date YYYY-MM-DD; empty = not scheduled yet. */
  date: string;
  /** 24h HH:MM; empty = not scheduled yet. */
  time: string;
  court: string;
  /** Manual ordering within a day. */
  order: number;
}

export interface StageRules {
  pool: TennisRules;
  quarterfinal: TennisRules;
  semifinal: TennisRules;
  final: TennisRules;
}

/** Badminton scoring for one stage: race-to points and best-of games. */
export interface BadmintonRules {
  maxPoints: MaxPoints;
  bestOf: BestOf;
}

export interface BadmintonStageRules {
  pool: BadmintonRules;
  quarterfinal: BadmintonRules;
  semifinal: BadmintonRules;
  final: BadmintonRules;
}

export function defaultBadmintonStageRules(): BadmintonStageRules {
  return {
    pool: { maxPoints: 15, bestOf: 1 },
    quarterfinal: { maxPoints: 15, bestOf: 1 },
    semifinal: { maxPoints: 21, bestOf: 1 },
    final: { maxPoints: 21, bestOf: 3 }
  };
}

export interface Tournament {
  sport: Sport;
  title: string;
  year: number;
  venue: string;
  formats: TournamentFormat[];
  divisions: TournamentDivision[];
  categories: TournamentCategory[];
  fixtures: TournamentFixture[];
  /** Lawn Tennis scoring per stage. */
  rules: StageRules;
  /** Badminton scoring per stage. */
  badmintonRules: BadmintonStageRules;
  /** Pool table points for a win (house rule: 2). */
  pointsPerWin: number;
  updatedAt: string;
}

export interface PublishedTournament extends Tournament {
  publishedAt: string;
}

export function defaultStageRules(): StageRules {
  return {
    pool: defaultTennisRulesForStage('qualifier'),
    quarterfinal: defaultTennisRulesForStage('quarterfinal'),
    semifinal: defaultTennisRulesForStage('semifinal'),
    final: defaultTennisRulesForStage('final')
  };
}

export function buildBlankTournament(sport: Sport, year: number): Tournament {
  return {
    sport,
    title: `NPL ${SPORT_LABEL[sport]} ${year}`,
    year,
    venue: 'Nature Walk Courts',
    formats: ['singles', 'doubles'],
    divisions: ['adults'],
    categories: [],
    fixtures: [],
    rules: defaultStageRules(),
    badmintonRules: defaultBadmintonStageRules(),
    pointsPerWin: 2,
    updatedAt: new Date().toISOString()
  };
}

export function categoryLabel(cat: Pick<TournamentCategory, 'format' | 'division' | 'name'>): string {
  if (cat.name?.trim()) return cat.name.trim();
  if (cat.format === 'team' || !cat.division) return FORMAT_LABEL[cat.format];
  return `${DIVISION_LABEL[cat.division]} ${FORMAT_LABEL[cat.format]}`;
}

/** Stable id for a format × division pair, so toggling a division off/on keeps its pools. */
export function categoryIdFor(format: TournamentFormat, division?: TournamentDivision): string {
  return format === 'team' || !division ? 'team' : `${division}-${format}`;
}

export const STAGE_LABEL: Record<FixtureStage, string> = {
  pool: 'Pool',
  quarterfinal: 'Quarterfinal',
  semifinal: 'Semifinal',
  final: 'Final'
};

export const STAGE_SHORT: Record<FixtureStage, string> = {
  pool: 'Pool',
  quarterfinal: 'QF',
  semifinal: 'SF',
  final: 'Final'
};

/** Scoring-engine stage for a fixture stage (pool matches are qualifiers). */
export function tennisStageForFixture(stage: FixtureStage): TennisStage {
  return stage === 'pool' ? 'qualifier' : stage;
}

export function matchTypeForFormat(format: TournamentFormat): TennisMatchType {
  return format;
}

/** Players per entry the UI asks for. Team size is a soft range (3-4). */
export const ENTRY_SIZE: Record<TournamentFormat, { min: number; max: number }> = {
  singles: { min: 1, max: 1 },
  doubles: { min: 2, max: 2 },
  team: { min: 3, max: 4 }
};
