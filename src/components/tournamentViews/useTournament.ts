import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from '../../lib/realtime';
import { db } from '../../db';
import { resolveSport, type CompletedMatch, type MatchState, type Sport } from '../../data/tournamentData';
import type { PublishedTournament, Tournament } from '../../data/tournament';
import { completedMatchesFromFirebase } from '../../utils/completedMatches';
import { buildContext, subscribePublished, type TournamentContext } from '../../utils/tournament';
import { useSportLiveMatch } from '../../hooks/useSportLiveMatch';

/** One sport's rows from completedMatches, keyed by fixture id. */
export function useSportResults(sport: Sport): Record<string, CompletedMatch> {
  const [results, setResults] = useState<Record<string, CompletedMatch>>({});
  useEffect(() => {
    const unsub = onValue(ref(db, 'completedMatches'), (snap) => {
      const all = completedMatchesFromFirebase(snap.val());
      const out: Record<string, CompletedMatch> = {};
      for (const [k, v] of Object.entries(all)) if (resolveSport(v.sport) === sport) out[k] = v;
      setResults(out);
    });
    return () => unsub();
  }, [sport]);
  return results;
}

export interface TournamentData {
  loaded: boolean;
  tournament: PublishedTournament | null;
  ctx: TournamentContext | null;
  live: MatchState | null;
}

/** A sport's published tournament + results + live match, for resident views. */
export function usePublishedTournament(sport: Sport): TournamentData {
  const [tournament, setTournament] = useState<PublishedTournament | null>(null);
  const [loaded, setLoaded] = useState(false);
  const results = useSportResults(sport);
  const live = useSportLiveMatch(sport);

  useEffect(() => {
    const unsub = subscribePublished(db, sport, (t) => {
      setTournament(t);
      setLoaded(true);
    });
    return () => unsub();
  }, [sport]);

  const ctx = useMemo(() => (tournament ? buildContext(tournament, results) : null), [tournament, results]);
  return { loaded, tournament, ctx, live };
}

/** Same context over an arbitrary (e.g. draft) tournament. */
export function useTournamentContext(t: Tournament | null): TournamentContext | null {
  const results = useSportResults(t?.sport ?? 'tennis');
  return useMemo(() => (t ? buildContext(t, results) : null), [t, results]);
}
