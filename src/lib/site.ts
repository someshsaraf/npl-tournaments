import { siteNames, type SiteConfig } from '../data/site';

declare global {
  interface Window {
    /** Written into the page by the server (server/site.ts) or, in dev, by Vite. */
    __SITE__?: Partial<SiteConfig>;
  }
}

const raw: Partial<SiteConfig> = (typeof window !== 'undefined' && window.__SITE__) || {};

/** The society's name (SOCIETY_NAME in .env), league brand and the chosen main background. */
export const SITE: SiteConfig = {
  ...siteNames(raw.name, raw.shortName, raw.league),
  background: typeof raw.background === 'string' && raw.background.startsWith('/api/site/background') ? raw.background : ''
};

/** League brand with a year, e.g. "NPL 2026" (LEAGUE_NAME in .env). Defaults to this year. */
export function leagueTitle(year: number = new Date().getFullYear()): string {
  return `${SITE.league} ${year}`;
}
