/**
 * Tournament registration settings, shared by the resident form and the
 * server's validation (api/registrations.ts). Edit here to change the dates
 * or categories. Only sports listed in REGISTRATIONS show a Register button.
 */

export interface RegistrationCategory {
  id: string;
  /** Age group heading on the form, e.g. "Kids (under 21)". */
  group: string;
  /** Singles / Doubles. */
  format: string;
  /** Full label, e.g. "Kids (under 21) · Singles". */
  label: string;
}

export interface RegistrationConfig {
  title: string;
  /** Human-readable dates for the form and the sport page. */
  dates: string;
  /** First match day (YYYY-MM-DD) — for "see you on …". */
  firstDay: string;
  categories: RegistrationCategory[];
}

const cat = (id: string, group: string, format: string): RegistrationCategory => ({
  id,
  group,
  format,
  label: `${group} · ${format}`
});

export const REGISTRATIONS: Partial<Record<'badminton' | 'tennis', RegistrationConfig>> = {
  tennis: {
    title: 'Lawn Tennis Tournament 2026',
    dates: 'Fri–Sun 20, 21, 22 Nov & Fri–Sun 27, 28, 29 Nov 2026',
    firstDay: '2026-11-20',
    categories: [
      cat('kids-singles', 'Kids (under 21)', 'Singles'),
      cat('kids-doubles', 'Kids (under 21)', 'Doubles'),
      cat('adults-singles', 'Adults (21 and over)', 'Singles'),
      cat('adults-doubles', 'Adults (21 and over)', 'Doubles')
    ]
  }
};

/** Data path for one sport's registrations (admin-only — see server/rules.ts). */
export function registrationsPath(sport: 'badminton' | 'tennis'): string {
  return `registrations/${sport}`;
}

export interface Registration {
  name: string;
  category: string;
  createdAt: string;
}

/** "  priya   nair " → "priya nair" — how duplicate names are compared. */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}
