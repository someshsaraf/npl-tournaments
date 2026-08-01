import { useEffect, useRef, useState } from 'react';
import type { MatchState } from '../data/tournamentData';
import { hasMatchWinner } from '../utils/matchState';
import {
  announceScore,
  announceScoreAndServe,
  announceServe,
  announceWinner,
  isSpeechSupported,
  stopSpeech,
  unlockSpeech
} from '../utils/matchAnnouncer';

type Snapshot = {
  matchId: string;
  score1: number;
  score2: number;
  server: 1 | 2;
  winner: 1 | 2 | null;
};

function snapshotFromMatch(match: MatchState): Snapshot {
  return {
    matchId: typeof match.currentMatchId === 'string' ? match.currentMatchId : '',
    score1: Number.isFinite(match.score1) ? match.score1 : 0,
    score2: Number.isFinite(match.score2) ? match.score2 : 0,
    server: match.server === 2 ? 2 : 1,
    winner: match.gameWinner === 1 || match.gameWinner === 2 ? match.gameWinner : null
  };
}

function sideName(match: MatchState, side: 1 | 2): string {
  if (side === 1) return match.player1 || match.teamA || 'Side A';
  return match.player2 || match.teamB || 'Side B';
}

/**
 * Announces score and serve changes for a live MatchState.
 * Skips the first snapshot after enable (baseline). Requires unlockSpeech() on mobile.
 * Concurrency: React effect + refs only; no shared mutable module state beyond SpeechSynthesis.
 */
export function useMatchAnnouncer(match: MatchState): {
  audioEnabled: boolean;
  speechSupported: boolean;
  enableAudio: () => void;
  disableAudio: () => void;
} {
  const [audioEnabled, setAudioEnabled] = useState(false);
  const speechSupported = isSpeechSupported();
  const prevRef = useRef<Snapshot | null>(null);
  const primedRef = useRef(false);

  const enableAudio = () => {
    if (!speechSupported) return;
    unlockSpeech();
    primedRef.current = false;
    prevRef.current = null;
    setAudioEnabled(true);
  };

  const disableAudio = () => {
    stopSpeech();
    setAudioEnabled(false);
    primedRef.current = false;
    prevRef.current = null;
  };

  useEffect(() => {
    if (!audioEnabled) return;

    const next = snapshotFromMatch(match);

    if (!primedRef.current || !prevRef.current) {
      primedRef.current = true;
      prevRef.current = next;
      return;
    }

    const prev = prevRef.current;

    // New fixture / custom match — reset baseline, no chatter.
    if (prev.matchId !== next.matchId) {
      prevRef.current = next;
      return;
    }

    const scoreChanged = prev.score1 !== next.score1 || prev.score2 !== next.score2;
    const serveChanged = prev.server !== next.server;
    const winnerNow = hasMatchWinner(match) && prev.winner !== next.winner && next.winner;

    if (winnerNow) {
      const winName =
        next.winner === 1 ? sideName(match, 1) : sideName(match, 2);
      announceWinner(winName);
      prevRef.current = next;
      return;
    }

    if (scoreChanged && serveChanged) {
      announceScoreAndServe(
        next.score1,
        next.score2,
        sideName(match, 1),
        sideName(match, 2),
        sideName(match, next.server)
      );
    } else if (scoreChanged) {
      announceScore(next.score1, next.score2, sideName(match, 1), sideName(match, 2));
    } else if (serveChanged) {
      announceServe(sideName(match, next.server));
    }

    prevRef.current = next;
  }, [match, audioEnabled]);

  useEffect(() => {
    return () => stopSpeech();
  }, []);

  return { audioEnabled, speechSupported, enableAudio, disableAudio };
}
