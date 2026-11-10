import { useCallback, useEffect, useState } from 'react';
import type { RegistrationKey } from '../data/registration';

/** How many have registered so far (just the number, from the server); null until known. */
export function useRegisteredCount(sport: RegistrationKey): [number | null, () => void] {
  const [count, setCount] = useState<number | null>(null);
  const refresh = useCallback(() => {
    fetch(`/api/registrations?sport=${encodeURIComponent(sport)}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { count?: unknown } | null) => {
        if (d && typeof d.count === 'number') setCount(d.count);
      })
      .catch(() => {});
  }, [sport]);
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 30_000);
    return () => clearInterval(t);
  }, [refresh]);
  return [count, refresh];
}
