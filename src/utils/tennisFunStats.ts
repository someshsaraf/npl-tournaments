import type { CompletedMatch, TennisPointGame } from '../data/tournamentData';

/**
 * Fun facts for the Lawn Tennis page, worked out from the scores the court
 * scorers already record (every game's points, deuces, golden points and
 * tiebreaks). Matches entered by hand in Results have no game-by-game log —
 * they count toward win/loss records and game totals only.
 */

export interface FunMatch {
  category: string;
  stage: string;
  sideA: string;
  sideB: string;
  winner: string;
  result: string;
}

export interface FunHighlight {
  /** Big number on the card, e.g. "7". */
  value: string;
  /** What the number means, e.g. "deuces in a single game". */
  label: string;
  match: FunMatch;
}

export interface FunLeader {
  name: string;
  count: number;
}

export interface PlayerRecord {
  name: string;
  played: number;
  won: number;
  lost: number;
  gamesWon: number;
  gamesLost: number;
}

export interface TennisFunStats {
  matches: number;
  games: number;
  /** Only matches scored point by point. */
  points: number;
  deuces: number;
  goldenPoints: number;
  tiebreaks: number;
  loveGames: number;
  /** Matches decided by a single game. */
  nailBiters: number;
  marathon: FunHighlight | null;
  deuceDrama: FunHighlight | null;
  comeback: FunHighlight | null;
  streak: FunHighlight | null;
  bagels: FunMatch[];
  mostLoveGames: FunLeader[];
  mostGoldenPoints: FunLeader[];
  records: PlayerRecord[];
  unbeaten: PlayerRecord[];
}

const clean = (s: unknown) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : '');
const key = (s: string) => s.toLowerCase();

function sideNames(row: CompletedMatch): [string, string] {
  return [clean(row.player1) || clean(row.teamA) || 'Side A', clean(row.player2) || clean(row.teamB) || 'Side B'];
}

/** Which side won — by name first, so a mid-match side swap can't flip it. */
function winnerOf(row: CompletedMatch, a: string, b: string): 1 | 2 {
  const w = key(clean(row.winnerName));
  if (w && w === key(a)) return 1;
  if (w && w === key(b)) return 2;
  return row.winnerSide === 2 ? 2 : 1;
}

function gameLog(row: CompletedMatch): TennisPointGame[] {
  const log = row.tennis?.gameLog;
  return Array.isArray(log) ? log.filter((g) => g && (g.winner === 1 || g.winner === 2)) : [];
}

/** Points in a game; a golden point's winning point isn't in points1/points2. */
function pointsIn(g: TennisPointGame): number {
  return (Number(g.points1) || 0) + (Number(g.points2) || 0) + (g.golden ? 1 : 0);
}

function gamesWon(row: CompletedMatch, log: TennisPointGame[]): [number, number] {
  const t1 = Number(row.tennis?.gamesWon1 ?? row.gamesWon1);
  const t2 = Number(row.tennis?.gamesWon2 ?? row.gamesWon2);
  if (Number.isFinite(t1) && Number.isFinite(t2) && t1 + t2 > 0) return [t1, t2];
  if (log.length) return [log.filter((g) => g.winner === 1).length, log.filter((g) => g.winner === 2).length];
  return [0, 0];
}

function leaders(map: Map<string, FunLeader>, limit = 3): FunLeader[] {
  const list = [...map.values()].filter((l) => l.count > 0).sort((x, y) => y.count - x.count || x.name.localeCompare(y.name));
  if (!list.length) return [];
  // Keep everyone tied with the last place shown.
  const cut = list[Math.min(limit, list.length) - 1].count;
  return list.filter((l) => l.count >= cut).slice(0, limit + 2);
}

function bump(map: Map<string, FunLeader>, name: string, by = 1) {
  const cur = map.get(key(name)) ?? { name, count: 0 };
  cur.count += by;
  map.set(key(name), cur);
}

/** Keep the higher-scoring highlight; ties go to the earlier match. */
function better(cur: FunHighlight | null, score: number, best: number, make: () => FunHighlight): [FunHighlight | null, number] {
  return score > best ? [make(), score] : [cur, best];
}

export function computeTennisFunStats(rows: CompletedMatch[]): TennisFunStats {
  const sorted = [...rows]
    .filter((r) => r && r.status === 'completed')
    .sort((a, b) => clean(a.completedAt).localeCompare(clean(b.completedAt)));

  const stats: TennisFunStats = {
    matches: 0,
    games: 0,
    points: 0,
    deuces: 0,
    goldenPoints: 0,
    tiebreaks: 0,
    loveGames: 0,
    nailBiters: 0,
    marathon: null,
    deuceDrama: null,
    comeback: null,
    streak: null,
    bagels: [],
    mostLoveGames: [],
    mostGoldenPoints: [],
    records: [],
    unbeaten: []
  };
  const records = new Map<string, PlayerRecord>();
  const love = new Map<string, FunLeader>();
  const golden = new Map<string, FunLeader>();
  let bestMarathon = 0;
  let bestDeuce = 0;
  let bestComeback = 1; // a 2-game deficit is the smallest worth calling a comeback
  let bestStreak = 2; // 3+ games in a row

  for (const row of sorted) {
    const [a, b] = sideNames(row);
    const names: Record<1 | 2, string> = { 1: a, 2: b };
    const win = winnerOf(row, a, b);
    const lose = win === 1 ? 2 : 1;
    const log = gameLog(row);
    const [g1, g2] = gamesWon(row, log);
    const match: FunMatch = {
      category: clean(row.category),
      stage: clean(row.stage),
      sideA: a,
      sideB: b,
      winner: names[win],
      result: clean(row.result)
    };

    stats.matches += 1;
    stats.games += g1 + g2;
    if (g1 + g2 > 0 && Math.abs(g1 - g2) === 1) stats.nailBiters += 1;
    if (g1 + g2 > 0 && (win === 1 ? g2 : g1) === 0) stats.bagels.push(match);

    for (const side of [1, 2] as const) {
      const name = names[side];
      const rec = records.get(key(name)) ?? { name, played: 0, won: 0, lost: 0, gamesWon: 0, gamesLost: 0 };
      rec.played += 1;
      if (side === win) rec.won += 1;
      else rec.lost += 1;
      rec.gamesWon += side === 1 ? g1 : g2;
      rec.gamesLost += side === 1 ? g2 : g1;
      records.set(key(name), rec);
    }

    if (!log.length) continue;

    let points = 0;
    let deficit = 0;
    let runSide: 1 | 2 | 0 = 0;
    let run = 0;
    let score = { 1: 0, 2: 0 };
    for (const g of log) {
      points += pointsIn(g);
      stats.deuces += Number(g.deuceCount) || 0;
      if (g.wasTiebreak) stats.tiebreaks += 1;
      if (g.golden) {
        stats.goldenPoints += 1;
        bump(golden, names[g.winner]);
      }
      const loserPoints = g.winner === 1 ? Number(g.points2) || 0 : Number(g.points1) || 0;
      if (!g.wasTiebreak && !g.golden && loserPoints === 0) {
        stats.loveGames += 1;
        bump(love, names[g.winner]);
      }
      const d = Number(g.deuceCount) || 0;
      [stats.deuceDrama, bestDeuce] = better(stats.deuceDrama, d, bestDeuce, () => ({
        value: String(d),
        label: d === 1 ? 'deuce in a single game' : 'deuces in a single game',
        match
      }));

      score = { ...score, [g.winner]: score[g.winner] + 1 };
      deficit = Math.max(deficit, score[lose] - score[win]);
      run = g.winner === runSide ? run + 1 : 1;
      runSide = g.winner;
      [stats.streak, bestStreak] = better(stats.streak, run, bestStreak, () => ({
        value: String(run),
        label: `games in a row by ${names[g.winner]}`,
        match
      }));
    }
    stats.points += points;
    [stats.marathon, bestMarathon] = better(stats.marathon, points, bestMarathon, () => ({
      value: String(points),
      label: 'points played in one match',
      match
    }));
    [stats.comeback, bestComeback] = better(stats.comeback, deficit, bestComeback, () => ({
      value: `${deficit}`,
      label: `games down — and ${names[win]} still won`,
      match
    }));
  }

  stats.records = [...records.values()].sort(
    (x, y) => y.won - x.won || x.lost - y.lost || y.gamesWon - y.gamesLost - (x.gamesWon - x.gamesLost) || x.name.localeCompare(y.name)
  );
  stats.unbeaten = stats.records.filter((r) => r.won >= 2 && r.lost === 0);
  stats.mostLoveGames = leaders(love);
  stats.mostGoldenPoints = leaders(golden);
  return stats;
}
