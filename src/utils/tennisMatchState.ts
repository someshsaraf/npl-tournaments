import type { MatchState, TennisMatchState, TennisPointGame, TennisStage, TennisMatchType } from '../data/tournamentData';
import { isTennisStage, isTennisMatchType } from '../data/tournamentData';
import { buildInitialTennisState } from './tennisScoring';

function normalizeTennisGameLog(raw: unknown): TennisPointGame[] {
  if (!Array.isArray(raw)) return [];
  const out: TennisPointGame[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const points1 = Number(r.points1);
    const points2 = Number(r.points2);
    const winner = r.winner === 2 ? 2 : r.winner === 1 ? 1 : null;
    if (!Number.isFinite(points1) || !Number.isFinite(points2) || winner === null) continue;
    out.push({
      points1: Math.max(0, Math.trunc(points1)),
      points2: Math.max(0, Math.trunc(points2)),
      winner,
      wasTiebreak: r.wasTiebreak === true
    });
  }
  return out;
}

/** Defensive Firebase payload healing for the `tennis` sub-object — same spirit as normalizeMatchState. */
export function normalizeTennisMatchState(raw: unknown): TennisMatchState {
  if (!raw || typeof raw !== 'object') {
    return buildInitialTennisState('qualifier', 'singles');
  }
  const r = raw as Record<string, unknown>;
  const tennisStage: TennisStage = isTennisStage(r.tennisStage) ? r.tennisStage : 'qualifier';
  const matchType: TennisMatchType = isTennisMatchType(r.matchType) ? r.matchType : 'singles';

  const points1Raw = Number(r.points1);
  const points2Raw = Number(r.points2);
  const points1 = Number.isFinite(points1Raw) && points1Raw >= 0 ? Math.trunc(points1Raw) : 0;
  const points2 = Number.isFinite(points2Raw) && points2Raw >= 0 ? Math.trunc(points2Raw) : 0;

  const deuceCountRaw = Number(r.deuceCount);
  const deuceCount = Number.isFinite(deuceCountRaw) && deuceCountRaw >= 0 ? Math.trunc(deuceCountRaw) : 0;

  const gamesWon1Raw = Number(r.gamesWon1);
  const gamesWon2Raw = Number(r.gamesWon2);
  const gamesWon1 = Number.isFinite(gamesWon1Raw) && gamesWon1Raw >= 0 ? Math.trunc(gamesWon1Raw) : 0;
  const gamesWon2 = Number.isFinite(gamesWon2Raw) && gamesWon2Raw >= 0 ? Math.trunc(gamesWon2Raw) : 0;

  const server = r.server === 2 ? 2 : 1;
  const gameWinnerRaw = r.gameWinner;
  const gameWinner = gameWinnerRaw === 1 || gameWinnerRaw === 2 ? gameWinnerRaw : null;

  return {
    tennisStage,
    matchType,
    points1,
    points2,
    isTiebreak: r.isTiebreak === true,
    deuceCount,
    server,
    gameWinner,
    gamesWon1,
    gamesWon2,
    gameLog: normalizeTennisGameLog(r.gameLog)
  };
}

/** Games tally within the (single) set/qualifier race, e.g. "4-2". */
export function formatTennisGamesLabel(match: MatchState | null | undefined): string {
  if (!match?.tennis) return '0-0';
  return `${match.tennis.gamesWon1}-${match.tennis.gamesWon2}`;
}

/** Display line for the finished match, e.g. "6-4" or "7-6(4)" when it ended on a tiebreak. */
export function formatTennisGameLogLine(match: MatchState | null | undefined): string {
  const t = match?.tennis;
  if (!t || t.gameLog.length === 0) return '';
  const last = t.gameLog[t.gameLog.length - 1];
  const base = `${t.gamesWon1}-${t.gamesWon2}`;
  if (last?.wasTiebreak) {
    const loserPoints = last.winner === 1 ? last.points2 : last.points1;
    return `${base}(${loserPoints})`;
  }
  return base;
}

/** Human label for the tennis stage, e.g. for badges/headers. */
export function formatTennisStageLabel(tennisStage: TennisStage): string {
  if (tennisStage === 'qualifier') return 'Qualifier';
  if (tennisStage === 'semifinal') return 'Semifinal';
  return 'Final';
}
