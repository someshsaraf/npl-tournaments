import { INITIAL_MATCH, isMaxPoints } from '../data/tournamentData';
import type { MatchState } from '../data/tournamentData';

/**
 * Normalize Firebase `currentMatch` payloads so missing/invalid fields
 * cannot falsely trigger winner UI (`undefined !== null` is true).
 */
export function normalizeMatchState(data: unknown): MatchState {
  if (!data || typeof data !== 'object') {
    return { ...INITIAL_MATCH };
  }

  const raw = data as Record<string, unknown>;
  const gameWinnerRaw = raw.gameWinner;
  const gameWinner =
    gameWinnerRaw === 1 || gameWinnerRaw === 2
      ? gameWinnerRaw
      : null;

  const serverRaw = raw.server;
  const server = serverRaw === 2 ? 2 : 1;
  const servingSide = raw.servingSide === 'left' ? 'left' : 'right';
  const maxPoints = isMaxPoints(raw.maxPoints) ? raw.maxPoints : INITIAL_MATCH.maxPoints;

  return {
    ...INITIAL_MATCH,
    ...(raw as Partial<MatchState>),
    youtubeLiveUrl: typeof raw.youtubeLiveUrl === 'string' ? raw.youtubeLiveUrl : '',
    server,
    servingSide,
    maxPoints,
    gameWinner
  };
}

export function hasMatchWinner(match: MatchState | null | undefined): boolean {
  return !!match && (match.gameWinner === 1 || match.gameWinner === 2);
}
