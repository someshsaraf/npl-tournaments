import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from '../lib/realtime';
import { db } from '../db';
import { REGISTRATION_SETTINGS_TOP, resolveRegistrations } from '../data/registration';

// Last value seen, so pages opened later start with it instead of the defaults.
let lastRaw: unknown = null;
let loadedOnce = false;

/**
 * Registrations with the admin's dates applied, kept live: `shown` is what
 * residents see, `all` includes hidden ones (admin pages). `loading` is true
 * until the stored settings first arrive (the defaults apply meanwhile).
 */
export function useRegistrations(): ReturnType<typeof resolveRegistrations> & { loading: boolean } {
  const [raw, setRaw] = useState<unknown>(lastRaw);
  const [loaded, setLoaded] = useState(loadedOnce);

  useEffect(() => {
    const unsub = onValue(
      ref(db, REGISTRATION_SETTINGS_TOP),
      (snap) => {
        lastRaw = snap.val();
        loadedOnce = true;
        setRaw(lastRaw);
        setLoaded(true);
      },
      () => setLoaded(true)
    );
    return () => unsub();
  }, []);

  return useMemo(() => ({ ...resolveRegistrations(raw), loading: !loaded }), [raw, loaded]);
}
