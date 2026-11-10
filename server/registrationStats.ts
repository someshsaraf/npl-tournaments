import type { Store } from './store.js';
import {
  DEFAULT_REGISTRATIONS,
  registrationStats,
  registrationStatsPath,
  registrationsPath,
  type RegistrationKey
} from '../src/data/registration.js';

/**
 * Keep registrationStats/{sport} (numbers only — community-readable) in step
 * with registrations/{sport} (names — admins only), so resident pages see the
 * count change the moment someone registers, or an admin edits or removes one.
 */
export function keepRegistrationStats(store: Store): void {
  const sports = Object.keys(DEFAULT_REGISTRATIONS) as RegistrationKey[];
  const refresh = (sport: RegistrationKey) => {
    const next = registrationStats(sport, store.get(registrationsPath(sport)));
    const path = registrationStatsPath(sport);
    if (JSON.stringify(store.get(path)) !== JSON.stringify(next)) store.set(path, next);
  };
  sports.forEach(refresh);
  store.onChange((paths) => {
    for (const sport of sports) {
      const own = registrationsPath(sport);
      if (paths.some((p) => p === '' || p === 'registrations' || p === own || p.startsWith(`${own}/`))) refresh(sport);
    }
  });
}
