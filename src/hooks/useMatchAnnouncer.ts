import { useEffect, useRef, useState } from 'react';
import type { MatchState } from '../data/tournamentData';
import { announceScore, isSpeechSupported, stopSpeech, unlockSpeech } from '../utils/matchAnnouncer';

type Snapshot = {
  matchId: string;
  score1: number;
  score2: number;
};

function snapshotFromMatch(match: MatchState): Snapshot {
  const score1 = Number(match.score1);
  const score2 = Number(match.score2);
  return {
    matchId: typeof match.currentMatchId === 'string' ? match.currentMatchId : '',
    score1: Number.isFinite(score1) ? score1 : 0,
    score2: Number.isFinite(score2) ? score2 : 0
  };
}

function sideName(match: MatchState, side: 1 | 2): string {
  if (side === 1) return match.player1 || match.teamA || 'Side A';
  return match.player2 || match.teamB || 'Side B';
}

/** Side whose score increased; null if neither increased (e.g. undo). */
function sideThatIncremented(prev: Snapshot, next: Snapshot): 1 | 2 | null {
  if (next.score1 > prev.score1) return 1;
  if (next.score2 > prev.score2) return 2;
  return null;
}

/**
 * Announces only the player whose score incremented: "Name score".
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

    const scorer = sideThatIncremented(prev, next);
    if (scorer) {
      announceScore(
        next.score1,
        next.score2,
        sideName(match, 1),
        sideName(match, 2),
        scorer
      );
    }

    prevRef.current = next;
  }, [match, audioEnabled]);

  useEffect(() => {
    return () => stopSpeech();
  }, []);

  return { audioEnabled, speechSupported, enableAudio, disableAudio };
}
