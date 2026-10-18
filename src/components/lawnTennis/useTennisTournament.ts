import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from '../../lib/realtime';
import { db } from '../../db';
import { resolveSport, type CompletedMatch, type MatchState } from '../../data/tournamentData';
import type { PublishedTennisTournament, TennisTournament } from '../../data/tennisTournament';
import { completedMatchesFromFirebase } from '../../utils/completedMatches';
import { buildContext, subscribePublishedTennis, type TournamentContext } from '../../utils/tennisTournament';
import { useSportLiveMatch } from '../../hooks/useSportLiveMatch';

/** Tennis rows from completedMatches, keyed by fixture id. */
export function useTennisResults(): Record<string, CompletedMatch> {
  const [results, setResults] = useState<Record<string, CompletedMatch>>({});
  useEffect(() => {
    const unsub = onValue(ref(db, 'completedMatches'), (snap) => {
      const all = completedMatchesFromFirebase(snap.val());
      const out: Record<string, CompletedMatch> = {};
      for (const [k, v] of Object.entries(all)) if (resolveSport(v.sport) === 'tennis') out[k] = v;
      setResults(out);
    });
    return () => unsub();
  }, []);
  return results;
}

export interface TennisTournamentData {
  loaded: boolean;
  tournament: PublishedTennisTournament | null;
  ctx: TournamentContext | null;
  live: MatchState | null;
}

/** Published tournament + results + live match, for resident views. */
export function usePublishedTennisTournament(): TennisTournamentData {
  const [tournament, setTournament] = useState<PublishedTennisTournament | null>(null);
  const [loaded, setLoaded] = useState(false);
  const results = useTennisResults();
  const live = useSportLiveMatch('tennis');

  useEffect(() => {
    const unsub = subscribePublishedTennis(db, (t) => {
      setTournament(t);
      setLoaded(true);
    });
    return () => unsub();
  }, []);

  const ctx = useMemo(() => (tournament ? buildContext(tournament, results) : null), [tournament, results]);
  return { loaded, tournament, ctx, live };
}

/** Same context over an arbitrary (e.g. draft) tournament. */
export function useTournamentContext(t: TennisTournament | null): TournamentContext | null {
  const results = useTennisResults();
  return useMemo(() => (t ? buildContext(t, results) : null), [t, results]);
}
