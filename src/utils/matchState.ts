import { INITIAL_MATCH, isBestOf, isMaxPoints } from '../data/tournamentData';
import type { GameScore, MatchState } from '../data/tournamentData';

function normalizeGameScores(raw: unknown): GameScore[] {
  if (!Array.isArray(raw)) return [];
  const out: GameScore[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const score1 = Number(r.score1);
    const score2 = Number(r.score2);
    const winner = r.winner === 2 ? 2 : r.winner === 1 ? 1 : null;
    if (!Number.isFinite(score1) || !Number.isFinite(score2) || winner === null) continue;
    out.push({
      score1: Math.max(0, Math.trunc(score1)),
      score2: Math.max(0, Math.trunc(score2)),
      winner
    });
  }
  return out;
}

/**
 * Normalize Firebase `currentMatch` payloads so missing/invalid fields
 * cannot falsely trigger winner UI (`undefined !== null` is true).
 */
export function normalizeMatchState(data: unknown): MatchState {
  if (!data || typeof data !== 'object') {
    return { ...INITIAL_MATCH, gameScores: [] };
  }

  const raw = data as Record<string, unknown>;
  const gameWinnerRaw = raw.gameWinner;
  const gameWinner =
    gameWinnerRaw === 1 || gameWinnerRaw === 2 ? gameWinnerRaw : null;

  const matchWinnerRaw = raw.matchWinner;
  let matchWinner: 1 | 2 | null =
    matchWinnerRaw === 1 || matchWinnerRaw === 2 ? matchWinnerRaw : null;

  const bestOf = isBestOf(raw.bestOf) ? raw.bestOf : 1;
  // Heal legacy BO1 rows that only have gameWinner.
  if (!matchWinner && bestOf === 1 && (gameWinner === 1 || gameWinner === 2)) {
    matchWinner = gameWinner;
  }

  const serverRaw = raw.server;
  const server = serverRaw === 2 ? 2 : 1;
  const servingSide = raw.servingSide === 'left' ? 'left' : 'right';
  const maxPoints = isMaxPoints(raw.maxPoints) ? raw.maxPoints : INITIAL_MATCH.maxPoints;

  const gameNumberRaw = Number(raw.gameNumber);
  const gameNumber =
    Number.isFinite(gameNumberRaw) && gameNumberRaw >= 1
      ? Math.min(3, Math.trunc(gameNumberRaw))
      : 1;

  const gamesWon1Raw = Number(raw.gamesWon1);
  const gamesWon2Raw = Number(raw.gamesWon2);
  const gamesWon1 =
    Number.isFinite(gamesWon1Raw) && gamesWon1Raw >= 0 ? Math.trunc(gamesWon1Raw) : 0;
  const gamesWon2 =
    Number.isFinite(gamesWon2Raw) && gamesWon2Raw >= 0 ? Math.trunc(gamesWon2Raw) : 0;

  return {
    ...INITIAL_MATCH,
    ...(raw as Partial<MatchState>),
    youtubeLiveUrl: typeof raw.youtubeLiveUrl === 'string' ? raw.youtubeLiveUrl : '',
    server,
    servingSide,
    maxPoints,
    bestOf,
    gameNumber,
    gameScores: normalizeGameScores(raw.gameScores),
    gamesWon1,
    gamesWon2,
    gameWinner,
    matchWinner
  };
}

/** Current points-game has a winner. */
export function hasGameWinner(match: MatchState | null | undefined): boolean {
  return !!match && (match.gameWinner === 1 || match.gameWinner === 2);
}

/** Best-of series is decided (BO1 game win or BO3 first to 2). */
export function hasSeriesWinner(match: MatchState | null | undefined): boolean {
  if (!match) return false;
  if (match.matchWinner === 1 || match.matchWinner === 2) return true;
  // Best of 1 (and legacy payloads without matchWinner): game win ends the match.
  const bestOf = match.bestOf === 3 ? 3 : 1;
  if (bestOf === 1 && (match.gameWinner === 1 || match.gameWinner === 2)) {
    return true;
  }
  return false;
}

/**
 * @deprecated Prefer hasGameWinner / hasSeriesWinner.
 * Kept as game-winner check for existing call sites that freeze scoring.
 */
export function hasMatchWinner(match: MatchState | null | undefined): boolean {
  return hasGameWinner(match);
}

/** Games needed to win the series. */
export function gamesNeededToWin(bestOf: unknown): number {
  return bestOf === 3 ? 2 : 1;
}

/** Display line for finished games, e.g. "G1 21-18 · G2 15-21". */
export function formatGameScoresLine(match: MatchState | null | undefined): string {
  if (!match || !Array.isArray(match.gameScores) || match.gameScores.length === 0) {
    return '';
  }
  return match.gameScores
    .map((g, i) => `G${i + 1} ${g.score1}-${g.score2}`)
    .join(' · ');
}

/** Series games tally, e.g. "1-0". */
export function formatGamesWonLabel(match: MatchState | null | undefined): string {
  if (!match) return '0-0';
  const a = Number.isFinite(match.gamesWon1) ? match.gamesWon1 : 0;
  const b = Number.isFinite(match.gamesWon2) ? match.gamesWon2 : 0;
  return `${a}-${b}`;
}
