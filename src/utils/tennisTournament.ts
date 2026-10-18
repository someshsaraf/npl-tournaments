import { onValue, ref, remove, set, type Database, type Unsubscribe } from '../lib/realtime';
import { TENNIS_TOURNAMENT_PATH } from '../db';
import type { CompletedMatch, MatchState, TennisRules } from '../data/tournamentData';
import {
  ENTRY_SIZE,
  STAGE_SHORT,
  TENNIS_DIVISIONS,
  TENNIS_FORMATS,
  buildBlankTournament,
  categoryIdFor,
  defaultStageRules,
  type FixtureSide,
  type FixtureStage,
  type KnockoutStart,
  type PublishedTennisTournament,
  type StageRules,
  type TennisDivision,
  type TennisFormat,
  type TennisTournament,
  type TournamentCategory,
  type TournamentEntry,
  type TournamentFixture,
  type TournamentPool
} from '../data/tennisTournament';
import { normalizeTennisRules } from './tennisScoring';
import { completedMatchStorageKey, toFirebaseWritable } from './completedMatches';
import { hasSeriesWinner } from './matchState';

// ─── ids ────────────────────────────────────────────────────────────────────

function rand(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
}

/** Ids are data store-key and match-id safe ([A-Za-z0-9_-]). */
export function newId(prefix: string): string {
  return `${prefix}-${rand()}`;
}

// ─── normalize (the data store drops empty arrays and may return arrays as objects) ─

function asArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw.filter((v) => v != null);
  if (raw && typeof raw === 'object') return Object.values(raw as Record<string, unknown>);
  return [];
}

function str(raw: unknown, max = 120): string {
  return typeof raw === 'string' ? raw.trim().slice(0, max) : '';
}

function safeId(raw: unknown): string | null {
  return typeof raw === 'string' && /^[\w-]{1,80}$/.test(raw) ? raw : null;
}

function normalizeEntry(raw: unknown): TournamentEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = safeId(r.id);
  if (!id) return null;
  const players = asArray(r.players).map((p) => str(p, 60)).filter(Boolean);
  const name = str(r.name, 80) || players.join(' & ');
  return { id, name, players };
}

function normalizePool(raw: unknown): TournamentPool | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = safeId(r.id);
  if (!id) return null;
  return {
    id,
    name: str(r.name, 40) || 'Pool',
    entries: asArray(r.entries).map(normalizeEntry).filter((e): e is TournamentEntry => !!e)
  };
}

const KNOCKOUT_STARTS: readonly KnockoutStart[] = ['auto', 'quarterfinal', 'semifinal', 'final', 'none'];

function normalizeCategory(raw: unknown): TournamentCategory | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = safeId(r.id);
  const format = TENNIS_FORMATS.find((f) => f === r.format);
  if (!id || !format) return null;
  const division = TENNIS_DIVISIONS.find((d) => d === r.division);
  const qpp = Number(r.qualifiersPerPool);
  return {
    id,
    format,
    ...(format !== 'team' && division ? { division } : {}),
    pools: asArray(r.pools).map(normalizePool).filter((p): p is TournamentPool => !!p),
    qualifiersPerPool: Number.isFinite(qpp) && qpp >= 1 && qpp <= 4 ? Math.trunc(qpp) : 1,
    knockoutStart: KNOCKOUT_STARTS.find((k) => k === r.knockoutStart) ?? 'auto'
  };
}

function normalizeSide(raw: unknown): FixtureSide {
  if (!raw || typeof raw !== 'object') return { kind: 'tbd' };
  const r = raw as Record<string, unknown>;
  if (r.kind === 'entry' && safeId(r.entryId)) return { kind: 'entry', entryId: r.entryId as string };
  if (r.kind === 'poolRank' && safeId(r.poolId)) {
    const rank = Number(r.rank);
    return { kind: 'poolRank', poolId: r.poolId as string, rank: Number.isFinite(rank) && rank >= 1 ? Math.trunc(rank) : 1 };
  }
  if (r.kind === 'winnerOf' && safeId(r.fixtureId)) return { kind: 'winnerOf', fixtureId: r.fixtureId as string };
  if (r.kind === 'bye') return { kind: 'bye' };
  return { kind: 'tbd' };
}

const FIXTURE_STAGES: readonly FixtureStage[] = ['pool', 'quarterfinal', 'semifinal', 'final'];

function normalizeFixture(raw: unknown): TournamentFixture | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = safeId(r.id);
  const categoryId = safeId(r.categoryId);
  const stage = FIXTURE_STAGES.find((s) => s === r.stage);
  if (!id || !categoryId || !stage) return null;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(str(r.date)) ? str(r.date) : '';
  const time = /^\d{2}:\d{2}$/.test(str(r.time)) ? str(r.time) : '';
  const order = Number(r.order);
  const slot = Number(r.slot);
  return {
    id,
    categoryId,
    stage,
    ...(safeId(r.poolId) ? { poolId: r.poolId as string } : {}),
    ...(Number.isFinite(slot) && slot >= 1 ? { slot: Math.trunc(slot) } : {}),
    sideA: normalizeSide(r.sideA),
    sideB: normalizeSide(r.sideB),
    ...(r.autoSideA ? { autoSideA: normalizeSide(r.autoSideA) } : {}),
    ...(r.autoSideB ? { autoSideB: normalizeSide(r.autoSideB) } : {}),
    date,
    time,
    court: str(r.court, 30),
    order: Number.isFinite(order) ? order : 0
  };
}

function normalizeStageRules(raw: unknown): StageRules {
  const d = defaultStageRules();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  return {
    pool: normalizeTennisRules(r.pool, 'qualifier'),
    quarterfinal: normalizeTennisRules(r.quarterfinal, 'quarterfinal'),
    semifinal: normalizeTennisRules(r.semifinal, 'semifinal'),
    final: normalizeTennisRules(r.final, 'final')
  };
}

export function normalizeTournament(raw: unknown): TennisTournament | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const year = Number(r.year);
  const safeYear = Number.isFinite(year) && year >= 2020 && year <= 2100 ? Math.trunc(year) : new Date().getFullYear();
  const blank = buildBlankTournament(safeYear);
  const ppw = Number(r.pointsPerWin);
  return {
    title: str(r.title, 80) || blank.title,
    year: safeYear,
    venue: str(r.venue, 80),
    formats: asArray(r.formats).filter((f): f is TennisFormat => TENNIS_FORMATS.includes(f as TennisFormat)),
    divisions: asArray(r.divisions).filter((d): d is TennisDivision =>
      TENNIS_DIVISIONS.includes(d as TennisDivision)
    ),
    categories: asArray(r.categories).map(normalizeCategory).filter((c): c is TournamentCategory => !!c),
    fixtures: asArray(r.fixtures).map(normalizeFixture).filter((f): f is TournamentFixture => !!f),
    rules: normalizeStageRules(r.rules),
    pointsPerWin: Number.isFinite(ppw) && ppw >= 0 && ppw <= 10 ? ppw : 2,
    updatedAt: str(r.updatedAt, 40) || blank.updatedAt
  };
}

export function normalizePublishedTournament(raw: unknown): PublishedTennisTournament | null {
  const t = normalizeTournament(raw);
  if (!t) return null;
  const publishedAt = str((raw as Record<string, unknown>).publishedAt, 40);
  return { ...t, publishedAt };
}

// ─── the data store ───────────────────────────────────────────────────────────────

export function subscribeTennisDraft(
  database: Database,
  callback: (t: TennisTournament | null) => void
): Unsubscribe {
  return onValue(ref(database, `${TENNIS_TOURNAMENT_PATH}/draft`), (snap) =>
    callback(normalizeTournament(snap.val()))
  );
}

export function subscribePublishedTennis(
  database: Database,
  callback: (t: PublishedTennisTournament | null) => void
): Unsubscribe {
  return onValue(ref(database, `${TENNIS_TOURNAMENT_PATH}/published`), (snap) =>
    callback(normalizePublishedTournament(snap.val()))
  );
}

/** Whole-document write (single admin editing at a time — last write wins). */
export function saveTennisDraft(database: Database, t: TennisTournament): Promise<void> {
  return set(
    ref(database, `${TENNIS_TOURNAMENT_PATH}/draft`),
    toFirebaseWritable({ ...t, updatedAt: new Date().toISOString() })
  );
}

export function publishTennisTournament(database: Database, t: TennisTournament): Promise<void> {
  const now = new Date().toISOString();
  return set(
    ref(database, `${TENNIS_TOURNAMENT_PATH}/published`),
    toFirebaseWritable({ ...t, updatedAt: now, publishedAt: now })
  );
}

/** Content equality ignoring timestamps — drives the "unpublished changes" badge. */
export function sameTournamentContent(a: TennisTournament, b: TennisTournament): boolean {
  const stable = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(stable);
    if (v && typeof v === 'object') {
      return Object.keys(v as Record<string, unknown>)
        .filter((k) => k !== 'updatedAt' && k !== 'publishedAt')
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          const val = (v as Record<string, unknown>)[k];
          if (val !== undefined) acc[k] = stable(val);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(stable(a)) === JSON.stringify(stable(b));
}

export function unpublishTennisTournament(database: Database): Promise<void> {
  return remove(ref(database, `${TENNIS_TOURNAMENT_PATH}/published`));
}

// ─── categories / pools / entries ───────────────────────────────────────────

/**
 * Categories implied by the selected formats × divisions, reusing any
 * existing category with the same id so its pools survive a toggle.
 */
export function syncCategories(t: TennisTournament): TournamentCategory[] {
  const byId = new Map(t.categories.map((c) => [c.id, c]));
  const out: TournamentCategory[] = [];
  for (const format of TENNIS_FORMATS) {
    if (!t.formats.includes(format)) continue;
    const divisions: Array<TennisDivision | undefined> =
      format === 'team' ? [undefined] : TENNIS_DIVISIONS.filter((d) => t.divisions.includes(d));
    for (const division of divisions) {
      const id = categoryIdFor(format, division);
      out.push(
        byId.get(id) ?? {
          id,
          format,
          ...(division ? { division } : {}),
          pools: [],
          qualifiersPerPool: 1,
          knockoutStart: 'auto'
        }
      );
    }
  }
  return out;
}

export function poolName(index: number): string {
  return `Pool ${String.fromCharCode(65 + (index % 26))}${index >= 26 ? Math.floor(index / 26) + 1 : ''}`;
}

export function entryCount(cat: TournamentCategory): number {
  return cat.pools.reduce((n, p) => n + p.entries.length, 0);
}

/**
 * Build an entry from player names. Validates against the format's size so
 * a doubles pair always has two names.
 */
export function buildEntry(format: TennisFormat, players: string[], teamName?: string): TournamentEntry {
  const clean = players.map((p) => p.trim().replace(/\s+/g, ' ').slice(0, 60)).filter(Boolean);
  const { min, max } = ENTRY_SIZE[format];
  if (format === 'team') {
    if (clean.length > 6) throw new Error('A team can have at most 6 players.');
    const name = (teamName ?? '').trim().slice(0, 60);
    if (!name) throw new Error('Give the team a name.');
    return { id: newId('e'), name, players: clean };
  }
  if (clean.length < min || clean.length > max) {
    throw new Error(format === 'doubles' ? 'A doubles pair needs exactly two players.' : 'Enter the player name.');
  }
  return { id: newId('e'), name: clean.join(' & '), players: clean };
}

/**
 * Parse a pasted list (one entry per line). Doubles lines are split on
 * "&", "/", "+", "," or " and ". Team lines are "Team name: p1, p2, p3".
 */
export function parseEntryLines(format: TennisFormat, text: string): { entries: TournamentEntry[]; errors: string[] } {
  const entries: TournamentEntry[] = [];
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    try {
      if (format === 'singles') {
        entries.push(buildEntry('singles', [line]));
      } else if (format === 'doubles') {
        entries.push(buildEntry('doubles', line.split(/\s*(?:&|\/|\+|,|\band\b)\s*/i)));
      } else {
        const [name, rest = ''] = line.split(/:(.*)/s);
        entries.push(buildEntry('team', rest.split(/\s*,\s*/), name));
      }
    } catch (err) {
      errors.push(`Line ${i + 1} ("${line.slice(0, 40)}"): ${err instanceof Error ? err.message : 'invalid'}`);
    }
  });
  return { entries, errors };
}

/** Snake-seed entries across `poolCount` pools (A,B,C,C,B,A,…) so pools stay even. */
export function distributeIntoPools(entries: TournamentEntry[], poolCount: number): TournamentPool[] {
  const n = Math.max(1, Math.min(26, Math.trunc(poolCount)));
  const pools: TournamentPool[] = Array.from({ length: n }, (_, i) => ({
    id: newId('p'),
    name: poolName(i),
    entries: []
  }));
  entries.forEach((entry, i) => {
    const lap = Math.floor(i / n);
    const pos = i % n;
    pools[lap % 2 === 0 ? pos : n - 1 - pos].entries.push(entry);
  });
  return pools;
}

/** Suggested pool count for 3-4 entries per pool. */
export function suggestPoolCount(entries: number): number {
  if (entries <= 4) return 1;
  return Math.ceil(entries / 4);
}

// ─── fixture generation ─────────────────────────────────────────────────────

/** Circle-method round robin; returns rounds of [i, j] index pairs (byes dropped). */
export function roundRobinPairs(count: number): Array<Array<[number, number]>> {
  if (count < 2) return [];
  const ids = Array.from({ length: count }, (_, i) => i);
  if (count % 2 === 1) ids.push(-1);
  const n = ids.length;
  const rounds: Array<Array<[number, number]>> = [];
  for (let r = 0; r < n - 1; r++) {
    const round: Array<[number, number]> = [];
    for (let i = 0; i < n / 2; i++) {
      const a = ids[i];
      const b = ids[n - 1 - i];
      if (a !== -1 && b !== -1) round.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(round);
    ids.splice(1, 0, ids.pop() as number);
  }
  return rounds;
}

/** Standard bracket seed order, e.g. 8 → [1,8,4,5,2,7,3,6]. */
export function bracketSeedOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const next = order.length * 2 + 1;
    order = order.flatMap((s) => [s, next - s]);
  }
  return order;
}

export function resolvedKnockoutStart(cat: TournamentCategory): Exclude<KnockoutStart, 'auto'> {
  if (cat.knockoutStart !== 'auto') return cat.knockoutStart;
  const qualifiers = cat.pools.length * cat.qualifiersPerPool;
  if (qualifiers <= 1) return 'none';
  if (qualifiers === 2) return 'final';
  if (qualifiers <= 4) return 'semifinal';
  return 'quarterfinal';
}

const BRACKET_SIZE: Record<'quarterfinal' | 'semifinal' | 'final', number> = {
  quarterfinal: 8,
  semifinal: 4,
  final: 2
};

const NEXT_STAGE: Record<'quarterfinal' | 'semifinal', 'semifinal' | 'final'> = {
  quarterfinal: 'semifinal',
  semifinal: 'final'
};

/**
 * Round robin for every pool, then a knockout bracket seeded from pool
 * finishers (all pool winners first, then runners-up…) so same-pool players
 * land in opposite halves. Missing seeds become byes.
 */
export function generateCategoryFixtures(cat: TournamentCategory): TournamentFixture[] {
  const fixtures: TournamentFixture[] = [];
  let order = 0;

  for (const pool of cat.pools) {
    for (const round of roundRobinPairs(pool.entries.length)) {
      for (const [a, b] of round) {
        fixtures.push({
          id: newId(`lt-${cat.id}`),
          categoryId: cat.id,
          stage: 'pool',
          poolId: pool.id,
          sideA: { kind: 'entry', entryId: pool.entries[a].id },
          sideB: { kind: 'entry', entryId: pool.entries[b].id },
          date: '',
          time: '',
          court: '',
          order: order++
        });
      }
    }
  }

  const start = resolvedKnockoutStart(cat);
  if (start === 'none' || cat.pools.length === 0) return fixtures;

  const size = BRACKET_SIZE[start];
  const seeds: FixtureSide[] = [];
  for (let rank = 1; rank <= cat.qualifiersPerPool; rank++) {
    for (const pool of cat.pools) seeds.push({ kind: 'poolRank', poolId: pool.id, rank });
  }
  if (seeds.length > size) {
    throw new Error(
      `${seeds.length} qualifiers don't fit a ${start} bracket of ${size}. Reduce qualifiers per pool or start at an earlier round.`
    );
  }

  const seedOrder = bracketSeedOrder(size);
  let stage: 'quarterfinal' | 'semifinal' | 'final' = start;
  let previous: TournamentFixture[] = [];
  for (let i = 0; i < size / 2; i++) {
    const sa = seeds[seedOrder[2 * i] - 1] ?? { kind: 'bye' };
    const sb = seeds[seedOrder[2 * i + 1] - 1] ?? { kind: 'bye' };
    previous.push({
      id: newId(`lt-${cat.id}`),
      categoryId: cat.id,
      stage,
      slot: i + 1,
      sideA: sa,
      sideB: sb,
      date: '',
      time: '',
      court: '',
      order: order++
    });
  }
  fixtures.push(...previous);

  while (stage !== 'final') {
    stage = NEXT_STAGE[stage];
    const next: TournamentFixture[] = [];
    for (let i = 0; i < previous.length / 2; i++) {
      next.push({
        id: newId(`lt-${cat.id}`),
        categoryId: cat.id,
        stage,
        slot: i + 1,
        sideA: { kind: 'winnerOf', fixtureId: previous[2 * i].id },
        sideB: { kind: 'winnerOf', fixtureId: previous[2 * i + 1].id },
        date: '',
        time: '',
        court: '',
        order: order++
      });
    }
    fixtures.push(...next);
    previous = next;
  }
  return fixtures;
}

/** Fixtures with a bye side are walkovers — never scheduled or scored. */
export function isByeFixture(f: TournamentFixture): boolean {
  return f.sideA.kind === 'bye' || f.sideB.kind === 'bye';
}

/**
 * Lay fixtures out on a timetable: fills `courts` courts in parallel, one
 * slot every `slotMinutes`, starting `date` at `startTime`, rolling to the
 * next day after `endTime`. Earlier stages are always scheduled first and
 * nobody is put on two courts in the same slot.
 */
export function autoSchedule(
  fixtures: TournamentFixture[],
  opts: { date: string; startTime: string; endTime: string; slotMinutes: number; courts: string[] }
): TournamentFixture[] {
  const { date, startTime, endTime, slotMinutes } = opts;
  const courts = opts.courts.map((c) => c.trim()).filter(Boolean);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Pick a start date.');
  const toMin = (hhmm: string) => {
    const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
    if (!m) throw new Error('Times must be HH:MM.');
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const startMin = toMin(startTime);
  const endMin = toMin(endTime);
  if (endMin <= startMin) throw new Error('Day end must be after day start.');
  if (!Number.isFinite(slotMinutes) || slotMinutes < 5) throw new Error('Slot length must be at least 5 minutes.');
  if (courts.length === 0) throw new Error('Add at least one court.');

  const stageRank: Record<FixtureStage, number> = { pool: 0, quarterfinal: 1, semifinal: 2, final: 3 };
  const remaining = fixtures
    .filter((f) => !isByeFixture(f))
    .sort((a, b) => stageRank[a.stage] - stageRank[b.stage] || a.order - b.order);

  const day = new Date(`${date}T00:00:00`);
  let minute = startMin;
  const placed = new Map<string, Partial<TournamentFixture>>();
  const toIso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const sideKey = (s: FixtureSide) =>
    s.kind === 'entry' ? `e:${s.entryId}` : s.kind === 'winnerOf' ? `w:${s.fixtureId}` : null;

  // Greedy per time slot: fill courts with the earliest fixtures whose
  // players aren't already on court this slot. Knockout rounds never share a
  // slot with an earlier round (their sides depend on those results).
  while (remaining.length > 0) {
    if (minute + slotMinutes > endMin) {
      day.setDate(day.getDate() + 1);
      minute = startMin;
    }
    const slotStage = stageRank[remaining[0].stage];
    const busy = new Set<string>();
    let court = 0;
    for (let i = 0; i < remaining.length && court < courts.length; ) {
      const f = remaining[i];
      if (stageRank[f.stage] !== slotStage) break;
      const keys = [sideKey(f.sideA), sideKey(f.sideB)].filter((k): k is string => !!k);
      if (keys.some((k) => busy.has(k))) {
        i += 1;
        continue;
      }
      keys.forEach((k) => busy.add(k));
      placed.set(f.id, {
        date: toIso(day),
        time: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
        court: courts[court]
      });
      court += 1;
      remaining.splice(i, 1);
    }
    minute += slotMinutes;
  }
  return fixtures.map((f) => (placed.has(f.id) ? { ...f, ...placed.get(f.id) } : f));
}

// ─── results, standings, resolution ─────────────────────────────────────────

export interface StandingRow {
  entry: TournamentEntry;
  played: number;
  won: number;
  lost: number;
  gamesFor: number;
  gamesAgainst: number;
  points: number;
}

export interface TournamentContext {
  tournament: TennisTournament;
  /** completedMatches keyed by data store key (fixture id). */
  results: Record<string, CompletedMatch>;
  entriesById: Map<string, TournamentEntry>;
  fixturesById: Map<string, TournamentFixture>;
  poolsById: Map<string, TournamentPool>;
}

export function buildContext(
  tournament: TennisTournament,
  results: Record<string, CompletedMatch>
): TournamentContext {
  const entriesById = new Map<string, TournamentEntry>();
  const poolsById = new Map<string, TournamentPool>();
  for (const c of tournament.categories) {
    for (const p of c.pools) {
      poolsById.set(p.id, p);
      for (const e of p.entries) entriesById.set(e.id, e);
    }
  }
  return {
    tournament,
    results,
    entriesById,
    poolsById,
    fixturesById: new Map(tournament.fixtures.map((f) => [f.id, f]))
  };
}

export function resultFor(ctx: TournamentContext, fixtureId: string): CompletedMatch | null {
  try {
    return ctx.results[completedMatchStorageKey(fixtureId)] ?? null;
  } catch {
    return null;
  }
}

export interface ResolvedSide {
  label: string;
  entry: TournamentEntry | null;
  isBye: boolean;
}

/** Which side (A=1/B=2) won, matching by name first so a mid-match side swap can't flip it. */
export function winnerSideOf(result: CompletedMatch, nameA: string, nameB: string): 1 | 2 {
  const w = result.winnerName.trim().toLowerCase();
  if (w && w === nameA.trim().toLowerCase()) return 1;
  if (w && w === nameB.trim().toLowerCase()) return 2;
  return result.winnerSide;
}

function ordinalPlace(rank: number): string {
  if (rank === 1) return 'Winner';
  if (rank === 2) return 'Runner-up';
  return `#${rank}`;
}

export function resolveSide(ctx: TournamentContext, side: FixtureSide, depth = 0): ResolvedSide {
  if (depth > 8) return { label: 'TBD', entry: null, isBye: false };
  switch (side.kind) {
    case 'entry': {
      const entry = ctx.entriesById.get(side.entryId) ?? null;
      return { label: entry?.name ?? 'Removed entry', entry, isBye: false };
    }
    case 'bye':
      return { label: 'Bye', entry: null, isBye: true };
    case 'tbd':
      return { label: 'TBD', entry: null, isBye: false };
    case 'poolRank': {
      const pool = ctx.poolsById.get(side.poolId);
      const label = `${ordinalPlace(side.rank)} ${pool?.name ?? 'Pool'}`;
      if (!pool || !isPoolComplete(ctx, pool.id)) return { label, entry: null, isBye: false };
      const row = poolStandings(ctx, pool.id)[side.rank - 1];
      return row ? { label: row.entry.name, entry: row.entry, isBye: false } : { label, entry: null, isBye: false };
    }
    case 'winnerOf': {
      const f = ctx.fixturesById.get(side.fixtureId);
      const label = f ? `Winner ${STAGE_SHORT[f.stage]}${f.slot ?? ''}` : 'TBD';
      if (!f) return { label, entry: null, isBye: false };
      const a = resolveSide(ctx, f.sideA, depth + 1);
      const b = resolveSide(ctx, f.sideB, depth + 1);
      if (a.isBye && b.entry) return b;
      if (b.isBye && a.entry) return a;
      if (a.isBye && b.isBye) return { label: 'Bye', entry: null, isBye: true };
      const res = resultFor(ctx, f.id);
      if (!res) return { label, entry: null, isBye: false };
      return winnerSideOf(res, a.label, b.label) === 1 ? a : b;
    }
  }
}

export function poolFixtures(ctx: TournamentContext, poolId: string): TournamentFixture[] {
  return ctx.tournament.fixtures.filter((f) => f.stage === 'pool' && f.poolId === poolId);
}

export function isPoolComplete(ctx: TournamentContext, poolId: string): boolean {
  const list = poolFixtures(ctx, poolId);
  return list.length > 0 && list.every((f) => !!resultFor(ctx, f.id));
}

/**
 * Pool table: points (pointsPerWin per win), then game difference, games
 * won, then head-to-head between two tied entries, then name.
 */
export function poolStandings(ctx: TournamentContext, poolId: string): StandingRow[] {
  const pool = ctx.poolsById.get(poolId);
  if (!pool) return [];
  const rows = new Map<string, StandingRow>(
    pool.entries.map((entry) => [
      entry.id,
      { entry, played: 0, won: 0, lost: 0, gamesFor: 0, gamesAgainst: 0, points: 0 }
    ])
  );
  const h2h = new Map<string, string>();
  for (const f of poolFixtures(ctx, poolId)) {
    const res = resultFor(ctx, f.id);
    if (!res || f.sideA.kind !== 'entry' || f.sideB.kind !== 'entry') continue;
    const a = rows.get(f.sideA.entryId);
    const b = rows.get(f.sideB.entryId);
    if (!a || !b) continue;
    const winner = winnerSideOf(res, a.entry.name, b.entry.name);
    // score1/score2 are games won, oriented to player1/player2 at save time.
    const aIsP1 = res.player1.trim().toLowerCase() !== b.entry.name.trim().toLowerCase();
    const gA = aIsP1 ? res.score1 : res.score2;
    const gB = aIsP1 ? res.score2 : res.score1;
    a.played += 1;
    b.played += 1;
    a.gamesFor += gA;
    a.gamesAgainst += gB;
    b.gamesFor += gB;
    b.gamesAgainst += gA;
    const [w, l] = winner === 1 ? [a, b] : [b, a];
    w.won += 1;
    l.lost += 1;
    w.points += ctx.tournament.pointsPerWin;
    h2h.set(`${w.entry.id}>${l.entry.id}`, w.entry.id);
  }
  return [...rows.values()].sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    const dx = x.gamesFor - x.gamesAgainst;
    const dy = y.gamesFor - y.gamesAgainst;
    if (dy !== dx) return dy - dx;
    if (y.gamesFor !== x.gamesFor) return y.gamesFor - x.gamesFor;
    if (h2h.has(`${x.entry.id}>${y.entry.id}`)) return -1;
    if (h2h.has(`${y.entry.id}>${x.entry.id}`)) return 1;
    return x.entry.name.localeCompare(y.entry.name);
  });
}

export type FixtureStatus = 'completed' | 'live' | 'upcoming' | 'walkover';

export function fixtureStatus(
  ctx: TournamentContext,
  f: TournamentFixture,
  liveMatch: MatchState | null
): FixtureStatus {
  if (isByeFixture(f)) return 'walkover';
  if (resultFor(ctx, f.id)) return 'completed';
  if (liveMatch && liveMatch.currentMatchId === f.id && !hasSeriesWinner(liveMatch)) return 'live';
  return 'upcoming';
}

/** Short round label: "Pool A", "QF2", "SF1", "Final". */
export function fixtureStageLabel(ctx: TournamentContext, f: TournamentFixture): string {
  if (f.stage === 'pool') return ctx.poolsById.get(f.poolId ?? '')?.name ?? 'Pool';
  if (f.stage === 'final') return 'Final';
  return `${STAGE_SHORT[f.stage]}${f.slot ?? ''}`;
}

export function rulesForStage(t: TennisTournament, stage: FixtureStage): TennisRules {
  return t.rules[stage];
}

/** Sort key for timetable views: date, time, court, order (unscheduled last). */
export function compareFixtureTime(a: TournamentFixture, b: TournamentFixture): number {
  const da = a.date || '9999-99-99';
  const db = b.date || '9999-99-99';
  if (da !== db) return da.localeCompare(db);
  const ta = a.time || '99:99';
  const tb = b.time || '99:99';
  if (ta !== tb) return ta.localeCompare(tb);
  if (a.court !== b.court) return a.court.localeCompare(b.court, undefined, { numeric: true });
  return a.order - b.order;
}

export function formatFixtureDate(iso: string): string {
  if (!iso) return 'Date TBD';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(d);
}

/** Problems that should block or warn before publishing. */
export function validateTournament(t: TennisTournament): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (t.categories.length === 0) errors.push('Pick at least one format and division in Setup.');
  for (const c of t.categories) {
    const label = c.format === 'team' ? 'Team Championship' : `${c.division} ${c.format}`;
    if (c.pools.length === 0) {
      warnings.push(`${label}: no pools yet.`);
      continue;
    }
    for (const p of c.pools) {
      if (p.entries.length < 2) warnings.push(`${label} · ${p.name}: needs at least 2 entries.`);
      if (c.format === 'team') {
        for (const e of p.entries) {
          if (e.players.length < 3 || e.players.length > 4) {
            warnings.push(`${label} · ${e.name}: ${e.players.length} players (expected 3-4).`);
          }
        }
      }
    }
    if (!t.fixtures.some((f) => f.categoryId === c.id)) {
      warnings.push(`${label}: fixtures not generated yet.`);
    }
  }
  const unscheduled = t.fixtures.filter((f) => !isByeFixture(f) && (!f.date || !f.time)).length;
  if (unscheduled > 0) warnings.push(`${unscheduled} fixture(s) have no date/time yet (shown as "Date TBD").`);
  return { errors, warnings };
}
