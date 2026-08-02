import { get, onValue, ref, update } from 'firebase/database';
import type { Database, Unsubscribe } from 'firebase/database';
import type { CompletedMatch, Fixture, MatchState, Team } from '../data/tournamentData';
import { PLAYER_NAME_ALIASES_PATH } from '../firebase';

/** Local clone — avoid importing completedMatches (circular). */
function toWritable<T>(value: T): T {
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    throw new Error('playerRename: value is not JSON-serializable');
  }
}

/** Built-in renames applied when reading historical rows (and migrated into Firebase). */
export const LEGACY_PLAYER_NAME_ALIASES: Readonly<Record<string, string>> = {
  Mihir: 'Ramakrishna',
  Dhanashree: 'Sujata'
};

/**
 * Process-local alias cache for read-time display (fixtures, completed, live).
 * Updated via subscribePlayerNameAliases / propagatePlayerRename.
 * Concurrency: single-threaded UI; last write wins (same as Firebase listeners).
 */
let cachedPlayerAliases: Record<string, string> = { ...LEGACY_PLAYER_NAME_ALIASES };

export function getPlayerNameAliases(): Readonly<Record<string, string>> {
  return cachedPlayerAliases;
}

export function setPlayerNameAliasesCache(raw: unknown): Record<string, string> {
  cachedPlayerAliases = normalizePlayerAliasMap(raw);
  return cachedPlayerAliases;
}

/** Keep the in-memory alias map synced with Firebase. */
export function subscribePlayerNameAliases(database: Database): Unsubscribe {
  if (!database) throw new Error('subscribePlayerNameAliases: database is required');
  return onValue(ref(database, PLAYER_NAME_ALIASES_PATH), (snap) => {
    setPlayerNameAliasesCache(snap.val());
  });
}

const NAME_STRING_KEYS = [
  'player1',
  'player2',
  'teamA',
  'teamB',
  'winnerName',
  'details'
] as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Replace a player name inside free text (doubles lines, "A vs B", etc.).
 * Uses letter/number boundaries so names match as whole tokens.
 * Concurrency: pure. Input: non-empty trimmed names.
 */
export function replacePlayerNameInText(
  text: unknown,
  oldName: unknown,
  newName: unknown
): string {
  if (typeof text !== 'string') return '';
  if (typeof oldName !== 'string' || typeof newName !== 'string') return text;
  const from = oldName.trim();
  const to = newName.trim();
  if (!from || !to || from === to) return text;

  const re = new RegExp(
    `(^|[^\\p{L}\\p{N}])${escapeRegExp(from)}(?=$|[^\\p{L}\\p{N}])`,
    'gu'
  );
  return text.replace(re, `$1${to}`);
}

/** Apply many old→new aliases longest-first. */
export function applyPlayerNameAliasesToText(
  text: unknown,
  aliases: Readonly<Record<string, string>>
): string {
  if (typeof text !== 'string' || !text) return typeof text === 'string' ? text : '';
  if (!aliases || typeof aliases !== 'object') return text;

  const pairs = Object.entries(aliases)
    .filter(([from, to]) => typeof from === 'string' && typeof to === 'string' && from.trim() && to.trim())
    .map(([from, to]) => [from.trim(), to.trim()] as const)
    .filter(([from, to]) => from !== to)
    .sort((a, b) => b[0].length - a[0].length);

  let out = text;
  for (const [from, to] of pairs) {
    out = replacePlayerNameInText(out, from, to);
  }
  return out;
}

function renameFieldsInRecord<T extends Record<string, unknown>>(
  row: T,
  oldName: string,
  newName: string,
  keys: readonly string[]
): T {
  const next = { ...row };
  for (const key of keys) {
    const cur = next[key];
    if (typeof cur !== 'string' || !cur) continue;
    const replaced = replacePlayerNameInText(cur, oldName, newName);
    if (replaced !== cur) {
      (next as Record<string, unknown>)[key] = replaced;
    }
  }
  return next;
}

export function renamePlayerInCompletedMatch(
  row: CompletedMatch,
  oldName: string,
  newName: string
): CompletedMatch {
  if (!row || typeof row !== 'object') {
    throw new Error('renamePlayerInCompletedMatch: row is required');
  }
  const from = typeof oldName === 'string' ? oldName.trim() : '';
  const to = typeof newName === 'string' ? newName.trim() : '';
  if (!from || !to) {
    throw new Error('renamePlayerInCompletedMatch: old and new names are required');
  }
  if (from === to) return row;
  return renameFieldsInRecord(
    row as unknown as Record<string, unknown>,
    from,
    to,
    NAME_STRING_KEYS
  ) as unknown as CompletedMatch;
}

export function applyPlayerNameAliasesToCompletedMatch(
  row: CompletedMatch,
  aliases: Readonly<Record<string, string>> = getPlayerNameAliases()
): CompletedMatch {
  if (!row || typeof row !== 'object') {
    throw new Error('applyPlayerNameAliasesToCompletedMatch: row is required');
  }
  let next = row;
  for (const [from, to] of Object.entries(aliases || {})) {
    if (typeof from !== 'string' || typeof to !== 'string') continue;
    next = renamePlayerInCompletedMatch(next, from, to);
  }
  return next;
}

export function applyPlayerNameAliasesToFixture(
  fixture: Fixture,
  aliases: Readonly<Record<string, string>> = getPlayerNameAliases()
): Fixture {
  if (!fixture || typeof fixture !== 'object') {
    throw new Error('applyPlayerNameAliasesToFixture: fixture is required');
  }
  return {
    ...fixture,
    details: applyPlayerNameAliasesToText(fixture.details ?? '', aliases),
    ...(typeof fixture.teamA === 'string'
      ? { teamA: applyPlayerNameAliasesToText(fixture.teamA, aliases) }
      : {}),
    ...(typeof fixture.teamB === 'string'
      ? { teamB: applyPlayerNameAliasesToText(fixture.teamB, aliases) }
      : {}),
    ...(typeof fixture.winnerName === 'string'
      ? { winnerName: applyPlayerNameAliasesToText(fixture.winnerName, aliases) }
      : {})
  };
}

export function applyPlayerNameAliasesToFixtures(
  fixtures: Fixture[],
  aliases: Readonly<Record<string, string>> = getPlayerNameAliases()
): Fixture[] {
  if (!Array.isArray(fixtures)) return [];
  return fixtures.map((f) => applyPlayerNameAliasesToFixture(f, aliases));
}

export function renamePlayerInMatchState(
  match: MatchState,
  oldName: string,
  newName: string
): MatchState {
  if (!match || typeof match !== 'object') {
    throw new Error('renamePlayerInMatchState: match is required');
  }
  const from = typeof oldName === 'string' ? oldName.trim() : '';
  const to = typeof newName === 'string' ? newName.trim() : '';
  if (!from || !to) {
    throw new Error('renamePlayerInMatchState: old and new names are required');
  }
  if (from === to) return match;
  return renameFieldsInRecord(
    match as unknown as Record<string, unknown>,
    from,
    to,
    ['player1', 'player2', 'teamA', 'teamB']
  ) as unknown as MatchState;
}

export function renamePlayerInTeams(teams: Team[], oldName: string, newName: string): Team[] {
  if (!Array.isArray(teams)) {
    throw new Error('renamePlayerInTeams: teams array required');
  }
  const from = typeof oldName === 'string' ? oldName.trim() : '';
  const to = typeof newName === 'string' ? newName.trim() : '';
  if (!from || !to || from === to) return teams;

  return teams.map((team) => {
    if (!team || typeof team !== 'object') return team;
    const players = Array.isArray(team.players)
      ? team.players.map((p) =>
          typeof p === 'string' ? replacePlayerNameInText(p, from, to) : p
        )
      : [];
    return { ...team, players };
  });
}

export function normalizePlayerAliasMap(raw: unknown): Record<string, string> {
  const out: Record<string, string> = { ...LEGACY_PLAYER_NAME_ALIASES };
  if (!raw || typeof raw !== 'object') return out;
  for (const [from, to] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof from !== 'string' || typeof to !== 'string') continue;
    const f = from.trim();
    const t = to.trim();
    if (!f || !t || f === t) continue;
    out[f] = t;
  }
  return out;
}

/**
 * Merge a new rename into the alias map, retargeting prior aliases that pointed at `oldName`.
 */
export function mergePlayerAlias(
  existing: Readonly<Record<string, string>>,
  oldName: string,
  newName: string
): Record<string, string> {
  const from = oldName.trim();
  const to = newName.trim();
  if (!from || !to || from === to) return { ...existing };

  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(existing)) {
    if (typeof k !== 'string' || typeof v !== 'string') continue;
    const key = k.trim();
    let val = v.trim();
    if (!key || !val) continue;
    if (val === from) val = to;
    if (key === from) continue;
    if (key !== val) next[key] = val;
  }
  next[from] = to;
  if (next[to] === from) delete next[to];
  return next;
}

export type PropagatePlayerRenameResult = {
  completedUpdated: number;
  currentMatchUpdated: boolean;
  teamsUpdated: boolean;
};

/**
 * Rewrite player name across Firebase: completedMatches, currentMatch, teams, aliases.
 * Concurrency: last-write-wins on RTDB (same as rest of app).
 */
export async function propagatePlayerRename(
  database: Database,
  oldName: unknown,
  newName: unknown
): Promise<PropagatePlayerRenameResult> {
  if (!database) throw new Error('propagatePlayerRename: database is required');
  const from = typeof oldName === 'string' ? oldName.trim() : '';
  const to = typeof newName === 'string' ? newName.trim() : '';
  if (!from || !to) {
    throw new Error('propagatePlayerRename: non-empty old and new names required');
  }
  if (from.length > 80 || to.length > 80) {
    throw new Error('propagatePlayerRename: names must be at most 80 characters');
  }
  if (from === to) {
    return { completedUpdated: 0, currentMatchUpdated: false, teamsUpdated: false };
  }

  const [completedSnap, matchSnap, teamsSnap, aliasesSnap] = await Promise.all([
    get(ref(database, 'completedMatches')),
    get(ref(database, 'currentMatch')),
    get(ref(database, 'teams')),
    get(ref(database, PLAYER_NAME_ALIASES_PATH))
  ]);

  const updates: Record<string, unknown> = {};
  let completedUpdated = 0;
  let currentMatchUpdated = false;
  let teamsUpdated = false;

  const completedRaw = completedSnap.val();
  if (completedRaw && typeof completedRaw === 'object') {
    for (const [key, value] of Object.entries(completedRaw as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue;
      const row = value as CompletedMatch;
      const renamed = renamePlayerInCompletedMatch(row, from, to);
      if (JSON.stringify(row) !== JSON.stringify(renamed)) {
        updates[`completedMatches/${key}`] = toWritable(renamed);
        completedUpdated += 1;
      }
    }
  }

  const matchVal = matchSnap.val();
  if (matchVal && typeof matchVal === 'object') {
    const renamed = renamePlayerInMatchState(matchVal as MatchState, from, to);
    if (JSON.stringify(matchVal) !== JSON.stringify(renamed)) {
      updates.currentMatch = toWritable(renamed);
      currentMatchUpdated = true;
    }
  }

  const teamsVal = teamsSnap.val();
  if (Array.isArray(teamsVal)) {
    const renamedTeams = renamePlayerInTeams(teamsVal as Team[], from, to);
    if (JSON.stringify(teamsVal) !== JSON.stringify(renamedTeams)) {
      updates.teams = toWritable(renamedTeams);
      teamsUpdated = true;
    }
  }

  const prevAliases = normalizePlayerAliasMap(aliasesSnap.val());
  const mergedAliases = mergePlayerAlias(prevAliases, from, to);
  if (JSON.stringify(prevAliases) !== JSON.stringify(mergedAliases) || !aliasesSnap.exists()) {
    updates[PLAYER_NAME_ALIASES_PATH] = mergedAliases;
  }

  if (Object.keys(updates).length > 0) {
    await update(ref(database), updates);
  }

  cachedPlayerAliases = mergedAliases;
  return { completedUpdated, currentMatchUpdated, teamsUpdated };
}

/**
 * Idempotent migration for built-in renames. Skips Firebase writes when no old names remain.
 */
export async function migrateLegacyPlayerNames(database: Database): Promise<void> {
  if (!database) throw new Error('migrateLegacyPlayerNames: database is required');

  const [completedSnap, matchSnap, teamsSnap] = await Promise.all([
    get(ref(database, 'completedMatches')),
    get(ref(database, 'currentMatch')),
    get(ref(database, 'teams'))
  ]);
  const blob = JSON.stringify({
    c: completedSnap.val(),
    m: matchSnap.val(),
    t: teamsSnap.val()
  });

  for (const [from, to] of Object.entries(LEGACY_PLAYER_NAME_ALIASES)) {
    if (!blob.includes(from)) continue;
    await propagatePlayerRename(database, from, to);
  }

  // Ensure alias map exists even when data is already clean.
  const aliasesSnap = await get(ref(database, PLAYER_NAME_ALIASES_PATH));
  if (!aliasesSnap.exists()) {
    await update(ref(database), {
      [PLAYER_NAME_ALIASES_PATH]: { ...LEGACY_PLAYER_NAME_ALIASES }
    });
  }
}
