import { useEffect, useState } from 'react';
import { onValue, ref } from '../lib/realtime';
import { db } from '../db';
import { parseGender, registrationStatsPath, type RegistrationKey, type RegistrationStats } from '../data/registration';

export type RegisteredStats = RegistrationStats;

function parse(v: unknown): RegisteredStats | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as { count?: unknown; groups?: unknown; players?: unknown };
  if (typeof d.count !== 'number') return null;
  const groups = Array.isArray(d.groups)
    ? d.groups.filter((g): g is RegisteredStats['groups'][number] => typeof g?.group === 'string' && typeof g?.count === 'number')
    : [];
  const players = Array.isArray(d.players)
    ? d.players
        .filter((p): p is { name: string; categories?: unknown; gender?: unknown } => typeof p?.name === 'string')
        .map((p) => {
          const gender = parseGender(p.gender);
          return {
            name: p.name,
            categories: Array.isArray(p.categories) ? p.categories.filter((c): c is string => typeof c === 'string') : [],
            ...(gender ? { gender } : {})
          };
        })
    : [];
  return { count: d.count, groups, players };
}

/**
 * How many have registered, overall and per age group (numbers only) — live:
 * updates the moment anyone registers or an admin changes the list. Null
 * until known.
 */
export function useRegisteredCount(sport: RegistrationKey): RegisteredStats | null {
  const [stats, setStats] = useState<RegisteredStats | null>(null);
  useEffect(() => {
    const unsub = onValue(
      ref(db, registrationStatsPath(sport)),
      (snap) => setStats(parse(snap.val()) ?? { count: 0, groups: [], players: [] }),
      () => {}
    );
    return () => unsub();
  }, [sport]);
  return stats;
}
