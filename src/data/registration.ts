/**
 * Tournament registration settings, shared by the resident form and the
 * server's validation (api/registrations.ts). The dates here are defaults:
 * admins can change the match days, closing date and whether residents see
 * registration at all from the admin Registrations tab (stored under
 * registrationSettings/{sport} — see resolveRegistration).
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
  /**
   * Last moment residents can register, with its UTC offset (India time),
   * e.g. "2026-11-13T23:59:59+05:30". Enforced by the server; staff (admin
   * code) can still add late entries.
   */
  closesAt: string;
  categories: RegistrationCategory[];
  /**
   * Not shown to residents yet (no Register button, form or sign-ups) — only
   * admins see it, so anything already stored stays reachable.
   */
  hidden?: boolean;
}

const cat = (id: string, group: string, format: string): RegistrationCategory => ({
  id,
  group,
  format,
  label: `${group} · ${format}`
});

/**
 * Which tournament a registration is for: a scored sport's id ('tennis',
 * 'badminton') or a sport that's only taking sign-ups so far ('table-tennis').
 */
export type RegistrationKey = 'badminton' | 'tennis' | 'table-tennis';

export function isRegistrationKey(v: unknown): v is RegistrationKey {
  return v === 'badminton' || v === 'tennis' || v === 'table-tennis';
}

/** Built-in registration setups (dates are defaults admins can override). */
export const DEFAULT_REGISTRATIONS: Partial<Record<RegistrationKey, RegistrationConfig>> = {
  tennis: {
    title: 'Lawn Tennis Tournament 2026',
    dates: 'Fri–Sun 20, 21, 22 Nov & Fri–Sun 27, 28, 29 Nov 2026',
    shortDates: '20–22 & 27–29 Nov 2026',
    weekends: [
      ['2026-11-20', '2026-11-21', '2026-11-22'],
      ['2026-11-27', '2026-11-28', '2026-11-29']
    ],
    firstDay: '2026-11-20',
    closesAt: '2026-11-13T23:59:59+05:30',
    categories: [
      cat('kids-singles', 'Kids (under 21)', 'Singles'),
      cat('kids-doubles', 'Kids (under 21)', 'Doubles'),
      cat('adults-singles', 'Adults (21 and over)', 'Singles'),
      cat('adults-doubles', 'Adults (21 and over)', 'Doubles')
    ]
  },
  // Dates not decided yet — hidden from residents until an admin sets the
  // dates and turns on "Show registration to residents".
  'table-tennis': {
    title: 'Table Tennis Tournament 2026',
    dates: 'Dates to be announced',
    shortDates: 'Dates to be announced',
    weekends: [],
    firstDay: '',
    closesAt: '',
    hidden: true,
    categories: [
      cat('kids-singles', 'Kids (under 21)', 'Singles'),
      cat('kids-doubles', 'Kids (under 21)', 'Doubles'),
      cat('adults-singles', 'Adults (21 and over)', 'Singles'),
      cat('adults-doubles', 'Adults (21 and over)', 'Doubles')
    ]
  }
};

export type RegistrationMap = Partial<Record<RegistrationKey, RegistrationConfig>>;

/**
 * Admin-chosen dates for one sport, stored at registrationSettings/{sport}
 * (readable with the community code, writable by admins only).
 */
export interface RegistrationSettings {
  /** Match days, YYYY-MM-DD. Back-to-back days are shown as one weekend. */
  days: string[];
  /** Last day to register, YYYY-MM-DD — closes 11:59 PM India time. */
  closesOn: string;
  /** Show the Register button, form and dates to residents. */
  visible: boolean;
}

export const REGISTRATION_SETTINGS_TOP = 'registrationSettings';

export function registrationSettingsPath(key: RegistrationKey): string {
  return `${REGISTRATION_SETTINGS_TOP}/${key}`;
}

const ISO_DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 21;

/** A real calendar day as YYYY-MM-DD? */
export function isIsoDay(v: unknown): v is string {
  if (typeof v !== 'string' || !ISO_DAY_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Stored settings, or null if missing/garbled (then the defaults apply). */
export function parseRegistrationSettings(raw: unknown): RegistrationSettings | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const days = Array.isArray(r.days) ? [...new Set(r.days.filter(isIsoDay))].sort().slice(0, MAX_DAYS) : [];
  if (!isIsoDay(r.closesOn)) return null;
  return { days, closesOn: r.closesOn, visible: r.visible === true };
}

/** Match days → runs of back-to-back days ("weekends"). */
export function groupDays(days: string[]): string[][] {
  const sorted = [...new Set(days)].sort();
  const runs: string[][] = [];
  for (const d of sorted) {
    const run = runs[runs.length - 1];
    if (run && dayMs(d) - dayMs(run[run.length - 1]) === 86_400_000) run.push(d);
    else runs.push([d]);
  }
  return runs;
}

const fmt = (iso: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-GB', { ...o, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

/** "Fri–Sun 20, 21, 22 Nov & Fri–Sun 27, 28, 29 Nov 2026". */
export function longDatesLabel(weekends: string[][]): string {
  if (weekends.length === 0) return 'Dates to be announced';
  const parts = weekends.map((run) => {
    const first = run[0];
    const last = run[run.length - 1];
    const wd = run.length > 1 ? `${fmt(first, { weekday: 'short' })}–${fmt(last, { weekday: 'short' })}` : fmt(first, { weekday: 'short' });
    const byMonth: string[] = [];
    let nums: string[] = [];
    run.forEach((d, i) => {
      nums.push(fmt(d, { day: 'numeric' }));
      const next = run[i + 1];
      if (!next || fmt(next, { month: 'short' }) !== fmt(d, { month: 'short' })) {
        byMonth.push(`${nums.join(', ')} ${fmt(d, { month: 'short' })}`);
        nums = [];
      }
    });
    return `${wd} ${byMonth.join(', ')}`;
  });
  return `${parts.join(' & ')} ${fmt(weekends[weekends.length - 1].slice(-1)[0], { year: 'numeric' })}`;
}

/** "20–22 & 27–29 Nov 2026" / "4–6 Dec 2026" / "30 Nov–1 Dec 2026". */
export function shortDatesLabel(weekends: string[][]): string {
  if (weekends.length === 0) return 'Dates to be announced';
  const mon = (d: string) => fmt(d, { month: 'short' });
  const day = (d: string) => fmt(d, { day: 'numeric' });
  const all = weekends.flat();
  const oneMonth = all.every((d) => mon(d) === mon(all[0]));
  const parts = weekends.map((run) => {
    const a = run[0];
    const b = run[run.length - 1];
    if (oneMonth) return a === b ? day(a) : `${day(a)}–${day(b)}`;
    if (a === b) return `${day(a)} ${mon(a)}`;
    return mon(a) === mon(b) ? `${day(a)}–${day(b)} ${mon(a)}` : `${day(a)} ${mon(a)}–${day(b)} ${mon(b)}`;
  });
  return `${parts.join(' & ')}${oneMonth ? ` ${mon(all[0])}` : ''} ${fmt(all[all.length - 1], { year: 'numeric' })}`;
}

/** The settings a config currently stands for (to prefill the admin editor). */
export function settingsOf(config: RegistrationConfig): RegistrationSettings {
  return {
    days: config.weekends.flat(),
    closesOn: config.closesAt ? config.closesAt.slice(0, 10) : '',
    visible: !config.hidden
  };
}

/**
 * One sport's registration with any admin settings applied, or undefined if
 * the sport has no registration. `hidden` is set when residents mustn't see
 * it (switched off, or no match days / closing date yet).
 */
export function resolveRegistration(key: RegistrationKey, rawSettings: unknown): RegistrationConfig | undefined {
  const base = DEFAULT_REGISTRATIONS[key];
  if (!base) return undefined;
  const s = parseRegistrationSettings(rawSettings);
  if (!s) return base;
  const weekends = groupDays(s.days);
  return {
    ...base,
    dates: longDatesLabel(weekends),
    shortDates: shortDatesLabel(weekends),
    weekends,
    firstDay: weekends[0]?.[0] ?? '',
    closesAt: `${s.closesOn}T23:59:59+05:30`,
    hidden: !s.visible || weekends.length === 0
  };
}

/**
 * Every sport's registration with settings applied (`all`, for admin pages)
 * and the ones residents see (`shown`).
 */
export function resolveRegistrations(rawAll: unknown): {
  all: RegistrationMap;
  shown: RegistrationMap;
  /** Sports whose dates come from admin settings rather than the defaults. */
  custom: Partial<Record<RegistrationKey, boolean>>;
} {
  const raw = (rawAll && typeof rawAll === 'object' ? rawAll : {}) as Record<string, unknown>;
  const all: RegistrationMap = {};
  const shown: RegistrationMap = {};
  const custom: Partial<Record<RegistrationKey, boolean>> = {};
  for (const key of Object.keys(DEFAULT_REGISTRATIONS) as RegistrationKey[]) {
    const c = resolveRegistration(key, raw[key]);
    if (!c) continue;
    all[key] = c;
    if (!c.hidden) shown[key] = c;
    if (parseRegistrationSettings(raw[key])) custom[key] = true;
  }
  return { all, shown, custom };
}

/** Still taking resident registrations? */
export function registrationOpen(config: RegistrationConfig, now: number = Date.now()): boolean {
  return !!config.closesAt && now <= Date.parse(config.closesAt);
}

/** "Fri 13 Nov" — the closing day, in India time whatever the viewer's clock zone. */
export function closesLabel(config: RegistrationConfig): string {
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata'
  }).format(new Date(config.closesAt));
}

const IST_DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }); // → YYYY-MM-DD

/**
 * Whole calendar days (India time) from today to the closing day: 0 on the
 * last day, negative once closed.
 */
export function daysUntilClose(config: RegistrationConfig, now: number = Date.now()): number {
  const today = Date.parse(`${IST_DAY.format(new Date(now))}T00:00:00Z`);
  const closeDay = Date.parse(`${IST_DAY.format(new Date(config.closesAt))}T00:00:00Z`);
  return Math.round((closeDay - today) / 86_400_000);
}

/** "13 days left" / "1 day left" / "Last day today!" — while open. */
export function countdownLabel(config: RegistrationConfig, now: number = Date.now()): string {
  const d = daysUntilClose(config, now);
  if (d <= 0) return 'Last day today!';
  return d === 1 ? '1 day left' : `${d} days left`;
}

/** Day parts of the closing date in India time, for the deadline tile. */
export function closeDayParts(config: RegistrationConfig): { weekday: string; day: string; month: string } {
  const at = new Date(config.closesAt);
  const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { ...o, timeZone: 'Asia/Kolkata' }).format(at);
  return { weekday: f({ weekday: 'short' }), day: f({ day: 'numeric' }), month: f({ month: 'short' }) };
}

/** Data path for one sport's registrations (admin-only — see server/rules.ts). */
export function registrationsPath(sport: RegistrationKey): string {
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

/**
 * Public registration numbers — overall and per age group, never names.
 * The server keeps a copy at registrationStats/{sport} (community-readable)
 * so pages update the moment someone registers.
 */
export interface RegistrationStats {
  count: number;
  /** Per age group, in form order, e.g. [{ group: 'Kids (under 21)', count: 4 }, …]. */
  groups: { group: string; count: number }[];
}

export const REGISTRATION_STATS_TOP = 'registrationStats';

export function registrationStatsPath(sport: RegistrationKey): string {
  return `${REGISTRATION_STATS_TOP}/${sport}`;
}

/** Count the stored registrations (as read from registrations/{sport}). */
export function registrationStats(sport: RegistrationKey, rawRows: unknown): RegistrationStats {
  const raw = (rawRows && typeof rawRows === 'object' ? rawRows : {}) as Record<string, unknown>;
  const rows = Object.values(raw).filter(
    (r): r is { name: string; categories?: unknown; category?: unknown } =>
      !!r && typeof r === 'object' && typeof (r as { name?: unknown }).name === 'string'
  );
  const config = DEFAULT_REGISTRATIONS[sport];
  const groupOf = new Map(config?.categories.map((c) => [c.id, c.group]) ?? []);
  const groups = (config ? groupsOf(config) : []).map((group) => ({
    group,
    count: rows.filter((r) => groupOf.get(registrationCategories(r)[0] ?? '') === group).length
  }));
  return { count: rows.length, groups };
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
