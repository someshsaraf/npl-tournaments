import { INITIAL_MATCH } from '../data/tournamentData';
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

  return {
    ...INITIAL_MATCH,
    ...(raw as Partial<MatchState>),
    youtubeLiveUrl: typeof raw.youtubeLiveUrl === 'string' ? raw.youtubeLiveUrl : '',
    gameWinner
  };
}

export function hasMatchWinner(match: MatchState | null | undefined): boolean {
  return !!match && (match.gameWinner === 1 || match.gameWinner === 2);
}
