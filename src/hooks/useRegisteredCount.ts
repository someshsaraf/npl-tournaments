import { useCallback, useEffect, useState } from 'react';
import type { RegistrationKey } from '../data/registration';

export interface RegisteredStats {
  count: number;
  /** Per age group, in form order, e.g. [{ group: 'Kids (under 21)', count: 4 }, …]. */
  groups: { group: string; count: number }[];
}

/** How many have registered so far, overall and per age group (numbers only, from the server); null until known. */
export function useRegisteredCount(sport: RegistrationKey): [RegisteredStats | null, () => void] {
  const [stats, setStats] = useState<RegisteredStats | null>(null);
  const refresh = useCallback(() => {
    fetch(`/api/registrations?sport=${encodeURIComponent(sport)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { count?: unknown; groups?: unknown } | null) => {
        if (!d || typeof d.count !== 'number') return;
        const groups = Array.isArray(d.groups)
          ? d.groups.filter((g): g is RegisteredStats['groups'][number] => typeof g?.group === 'string' && typeof g?.count === 'number')
          : [];
        setStats({ count: d.count, groups });
      })
      .catch(() => {});
  }, [sport]);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);
  return [stats, refresh];
}
