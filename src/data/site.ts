/**
 * Site identity and admin-chosen images, shared by the browser and the
 * server. No imports, so the server can use it as-is.
 *
 * - The society name comes from SOCIETY_NAME (and optional
 *   SOCIETY_SHORT_NAME) in .env. The server writes it into every page it
 *   serves as `window.__SITE__`, so it shows even before the code is entered.
 * - Photos aren't kept in the repo: admins upload them on the Photos page
 *   and pick which ones the site uses (siteImages in the data store).
 */

export interface SiteConfig {
  /** e.g. "Green Meadows Residency". */
  name: string;
  /** e.g. "GMR" — for tight spots. */
  shortName: string;
  /** Tournament brand shown with the year, e.g. "NPL" → "NPL 2026" (LEAGUE_NAME; default "<short name> Sports"). */
  league: string;
  /** URL of the main background (served without the code), or '' when none is chosen. */
  background: string;
}

export const DEFAULT_SOCIETY_NAME = 'Our Community';

/** "Green Meadows Residency" → "GMR". */
export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return letters.slice(0, 5) || name.slice(0, 5);
}

/** Society name, short name and league brand from env-style values, cleaned and with defaults. */
export function siteNames(
  rawName: unknown,
  rawShort: unknown,
  rawLeague?: unknown
): { name: string; shortName: string; league: string } {
  const clean = (v: unknown, max: number) =>
    typeof v === 'string'
      ? [...v]
          .filter((c) => c.charCodeAt(0) >= 32 && c !== '<' && c !== '>')
          .join('')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, max)
      : '';
  const name = clean(rawName, 80) || DEFAULT_SOCIETY_NAME;
  const shortName = clean(rawShort, 20) || initialsOf(name);
  return { name, shortName, league: clean(rawLeague, 30) || `${shortName} Sports` };
}

// ─── admin-chosen images ───────────────────────────────────────────────────

export const SITE_IMAGES_TOP = 'siteImages';
/** Public URL of the chosen main background (no code needed). */
export const SITE_BACKGROUND_URL = '/api/site/background';

export type SiteSportSlug = 'badminton' | 'lawn-tennis' | 'table-tennis';
export const SITE_SPORT_SLUGS: readonly SiteSportSlug[] = ['badminton', 'lawn-tennis', 'table-tennis'];

export interface SportImages {
  /** Wide banner on the sport page. */
  hero: string;
  /** Tile on the home page. */
  card: string;
}

export interface SiteImages {
  /** Code-entry screen and home page backdrop. */
  background: string;
  sports: Record<SiteSportSlug, SportImages>;
}

/** An uploaded photo's URL: local media or an HTTPS object-storage link. */
export function isSiteImageUrl(v: unknown): v is string {
  if (typeof v !== 'string' || v.length > 600 || v.includes('..')) return false;
  return /^\/media\/gallery\/[A-Za-z0-9_-]{8,80}\/[A-Za-z0-9._-]{1,120}$/.test(v) || /^https:\/\/[^\s"'<>]+$/.test(v);
}

export function parseSiteImages(raw: unknown): SiteImages {
  const r = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const url = (v: unknown) => (isSiteImageUrl(v) ? v : '');
  const sports = {} as Record<SiteSportSlug, SportImages>;
  for (const slug of SITE_SPORT_SLUGS) {
    const s = r[slug] && typeof r[slug] === 'object' ? (r[slug] as Record<string, unknown>) : {};
    sports[slug] = { hero: url(s.hero), card: url(s.card) };
  }
  return { background: url(r.background), sports };
}
