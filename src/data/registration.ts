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
  /** Human-readable dates for text contexts (admin console, CSV). */
  dates: string;
  /** Compact form for headlines, e.g. "20–22 & 27–29 Nov 2026". */
  shortDates: string;
  /** Match days grouped by weekend (YYYY-MM-DD) — drives the date tiles. */
  weekends: string[][];
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
    shortDates: '20–22 & 27–29 Nov 2026',
    weekends: [
      ['2026-11-20', '2026-11-21', '2026-11-22'],
      ['2026-11-27', '2026-11-28', '2026-11-29']
    ],
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

/**
 * One person's registration: one age group, one or both events — stored as
 * the matching category ids, e.g. ["adults-singles", "adults-doubles"].
 */
export interface Registration {
  name: string;
  categories: string[];
  createdAt: string;
}

/** Category ids of a stored row (rows saved before multi-event sign-up had a single `category`). */
export function registrationCategories(row: { categories?: unknown; category?: unknown }): string[] {
  if (Array.isArray(row.categories)) return row.categories.filter((c): c is string => typeof c === 'string');
  return typeof row.category === 'string' && row.category ? [row.category] : [];
}

export function groupsOf(config: RegistrationConfig): string[] {
  return [...new Set(config.categories.map((c) => c.group))];
}

export function formatsOf(config: RegistrationConfig): string[] {
  return [...new Set(config.categories.map((c) => c.format))];
}

/** The category id for an age group + event, if that combination exists. */
export function categoryFor(config: RegistrationConfig, group: string, format: string): RegistrationCategory | undefined {
  return config.categories.find((c) => c.group === group && c.format === format);
}

/** Why a selection isn't allowed, or null: one age group, at least one event, no repeats. */
export function selectionError(config: RegistrationConfig, ids: string[]): string | null {
  const cats = ids.map((id) => config.categories.find((c) => c.id === id));
  if (cats.length === 0) return 'Please choose your age group and at least one event.';
  if (cats.some((c) => !c)) return 'Please choose from the listed categories.';
  if (new Set(ids).size !== ids.length) return 'Each event can be chosen once.';
  if (new Set(cats.map((c) => c!.group)).size > 1) return 'Please choose either Kids or Adults — not both.';
  return null;
}

/** "Adults (21 and over) · Singles & Doubles". */
export function describeSelection(config: RegistrationConfig, ids: string[]): string {
  const cats = ids
    .map((id) => config.categories.find((c) => c.id === id))
    .filter((c): c is RegistrationCategory => !!c)
    .sort((a, b) => config.categories.indexOf(a) - config.categories.indexOf(b));
  if (cats.length === 0) return 'no category';
  return `${cats[0].group} · ${cats.map((c) => c.format).join(' & ')}`;
}

/** "  priya   nair " → "priya nair" — how duplicate names are compared. */
export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ').toLowerCase();
}
