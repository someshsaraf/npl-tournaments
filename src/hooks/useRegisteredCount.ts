import { useEffect, useState } from 'react';
import { onValue, ref } from '../lib/realtime';
import { db } from '../db';
import { registrationStatsPath, type RegistrationKey, type RegistrationStats } from '../data/registration';

export type RegisteredStats = RegistrationStats;

function parse(v: unknown): RegisteredStats | null {
  if (!v || typeof v !== 'object') return null;
  const d = v as { count?: unknown; groups?: unknown };
  if (typeof d.count !== 'number') return null;
  const groups = Array.isArray(d.groups)
    ? d.groups.filter((g): g is RegisteredStats['groups'][number] => typeof g?.group === 'string' && typeof g?.count === 'number')
    : [];
  return { count: d.count, groups };
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
      (snap) => setStats(parse(snap.val()) ?? { count: 0, groups: [] }),
      () => {}
    );
    return () => unsub();
  }, [sport]);
  return stats;
}
