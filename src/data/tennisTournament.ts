import type { TennisMatchType, TennisRules, TennisStage } from './tournamentData';
import { defaultTennisRulesForStage } from '../utils/tennisScoring';

/**
 * Lawn Tennis tournament built by admins at /admin/lawn-tennis.
 * Stored at `tournaments/tennis/draft` (admin working copy) and copied to
 * `tournaments/tennis/published` on Publish — residents only ever see the
 * published copy.
 *
 * Structure: categories (format × division, e.g. "Adults Singles") → pools of
 * entries (a player, a doubles pair, or a team) → fixtures (round robin per
 * pool, then knockouts fed by pool winners).
 */

export type TennisFormat = 'singles' | 'doubles' | 'team';
export type TennisDivision = 'kids' | 'adults' | 'women';

export const TENNIS_FORMATS: readonly TennisFormat[] = ['singles', 'doubles', 'team'] as const;
export const TENNIS_DIVISIONS: readonly TennisDivision[] = ['kids', 'adults', 'women'] as const;

export const FORMAT_LABEL: Record<TennisFormat, string> = {
  singles: 'Singles',
  doubles: 'Doubles',
  team: 'Team Championship'
};

export const DIVISION_LABEL: Record<TennisDivision, string> = {
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
}

/** Where pool winners go next. `auto` picks from the number of qualifiers. */
export type KnockoutStart = 'auto' | 'quarterfinal' | 'semifinal' | 'final' | 'none';

export interface TournamentCategory {
  id: string;
  format: TennisFormat;
  /** Absent for the Team Championship (no divisions). */
  division?: TennisDivision;
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

export interface TennisTournament {
  title: string;
  year: number;
  venue: string;
  formats: TennisFormat[];
  divisions: TennisDivision[];
  categories: TournamentCategory[];
  fixtures: TournamentFixture[];
  rules: StageRules;
  /** Pool table points for a win (house rule: 2). */
  pointsPerWin: number;
  updatedAt: string;
}

export interface PublishedTennisTournament extends TennisTournament {
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

export function buildBlankTournament(year: number): TennisTournament {
  return {
    title: `NPL Lawn Tennis ${year}`,
    year,
    venue: 'Nature Walk Courts',
    formats: ['singles', 'doubles'],
    divisions: ['adults'],
    categories: [],
    fixtures: [],
    rules: defaultStageRules(),
    pointsPerWin: 2,
    updatedAt: new Date().toISOString()
  };
}

export function categoryLabel(cat: Pick<TournamentCategory, 'format' | 'division'>): string {
  if (cat.format === 'team' || !cat.division) return FORMAT_LABEL[cat.format];
  return `${DIVISION_LABEL[cat.division]} ${FORMAT_LABEL[cat.format]}`;
}

/** Stable id for a format × division pair, so toggling a division off/on keeps its pools. */
export function categoryIdFor(format: TennisFormat, division?: TennisDivision): string {
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

export function matchTypeForFormat(format: TennisFormat): TennisMatchType {
  return format;
}

/** Players per entry the UI asks for. Team size is a soft range (3-4). */
export const ENTRY_SIZE: Record<TennisFormat, { min: number; max: number }> = {
  singles: { min: 1, max: 1 },
  doubles: { min: 2, max: 2 },
  team: { min: 3, max: 4 }
};
