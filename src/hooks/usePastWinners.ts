import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from '../lib/realtime';
import { db } from '../db';
import { parsePastWinners, pastWinnersPath, type PastWinner } from '../data/pastWinners';
import type { Sport } from '../data/tournamentData';

/** A sport's past champions (live), newest year first. */
export function usePastWinners(sport: Sport): { loaded: boolean; winners: PastWinner[] } {
  const [raw, setRaw] = useState<unknown>(null);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false);
    return onValue(
      ref(db, pastWinnersPath(sport)),
      (snap) => {
        setRaw(snap.val());
        setLoaded(true);
      },
      () => setLoaded(true)
    );
  }, [sport]);
  const winners = useMemo(() => parsePastWinners(raw), [raw]);
  return { loaded, winners };
}
