import { useEffect, useState } from 'react';
import { onValue, ref } from '../lib/realtime';
import { db } from '../db';
import { predictionTalliesPath, predictionsOpenPath, type PredictionSport } from '../data/predictions';

export interface PredictionState {
  /** { [categoryId]: { [entryId]: count } } */
  tallies: Record<string, Record<string, number>>;
  /** Category ids open for voting. */
  open: Set<string>;
}

function asCounts(raw: unknown): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [cat, counts] of Object.entries(raw as Record<string, unknown>)) {
    if (!counts || typeof counts !== 'object') continue;
    out[cat] = {};
    for (const [entry, n] of Object.entries(counts as Record<string, unknown>)) {
      if (typeof n === 'number' && n > 0) out[cat][entry] = n;
    }
  }
  return out;
}

/** Live vote counts and which categories are open — community-readable, no villas. */
export function usePredictions(sport: PredictionSport): PredictionState {
  const [tallies, setTallies] = useState<PredictionState['tallies']>({});
  const [open, setOpen] = useState<Set<string>>(new Set());
  useEffect(() => {
    const u1 = onValue(ref(db, predictionTalliesPath(sport)), (snap) => setTallies(asCounts(snap.val())));
    const u2 = onValue(ref(db, predictionsOpenPath(sport)), (snap) => {
      const raw = snap.val();
      setOpen(
        new Set(raw && typeof raw === 'object' ? Object.keys(raw).filter((k) => (raw as Record<string, unknown>)[k] === true) : [])
      );
    });
    return () => {
      u1();
      u2();
    };
  }, [sport]);
  return { tallies, open };
}
