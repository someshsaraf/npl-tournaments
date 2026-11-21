import type { Sport } from './tournamentData';

/**
 * The sports shown on the landing page. `sport` is the scoring/data id
 * (`tennis` is kept for the data store back-compat); `slug` is the URL segment.
 * Table Tennis is listed but not built yet (`sport: null`).
 * Photos aren't kept in the repo: admins pick each sport's banner and tile
 * photos from their uploads (see useSportImages).
 */
export interface SportCard {
  slug: 'badminton' | 'lawn-tennis' | 'table-tennis';
  sport: Sport | null;
  label: string;
  tagline: string;
  /** Legacy community-event ids whose photos belong to this sport. */
  legacyEventIds: string[];
}

export const SPORT_CARDS: readonly SportCard[] = [
  {
    slug: 'badminton',
    sport: 'badminton',
    label: 'Badminton',
    tagline: 'Badminton — singles, doubles and the Team Championship.',
    legacyEventIds: ['badminton-tournament']
  },
  {
    slug: 'lawn-tennis',
    sport: 'tennis',
    label: 'Lawn Tennis',
    tagline: 'Pools, knockouts and finals under the lights — singles, doubles and teams.',
    legacyEventIds: ['tennis-tournament']
  },
  {
    slug: 'table-tennis',
    sport: null,
    label: 'Table Tennis',
    tagline: 'Fast rallies, spin and smashes — singles and doubles for kids and adults.',
    legacyEventIds: []
  }
] as const;

export function sportCardBySlug(slug: unknown): SportCard | null {
  return SPORT_CARDS.find((c) => c.slug === slug) ?? null;
}

export function sportCardBySport(sport: Sport): SportCard {
  const card = SPORT_CARDS.find((c) => c.sport === sport);
  if (!card) throw new Error(`sportCardBySport: no card for ${sport}`);
  return card;
}

/** URL slug for a sport id, e.g. tennis → lawn-tennis. */
export function sportSlug(sport: Sport): string {
  return sportCardBySport(sport).slug;
}

/**
 * Resolve a URL value (slug or legacy sport id) to a sport id. Unknown →
 * null so callers decide the fallback.
 */
export function sportFromParam(value: unknown): Sport | null {
  if (value === 'tennis' || value === 'lawn-tennis') return 'tennis';
  if (value === 'badminton') return 'badminton';
  return null;
}

/** Map a gallery upload's eventId (legacy community-event id or sport id) to a sport. */
export function sportFromGalleryEventId(eventId: unknown): Sport | null {
  if (typeof eventId !== 'string') return null;
  const direct = sportFromParam(eventId);
  if (direct) return direct;
  const card = SPORT_CARDS.find((c) => c.legacyEventIds.includes(eventId));
  return card?.sport ?? null;
}

/** Staff landing page for one sport's tournament tools. */
export function adminPathForSport(sport: Sport): string {
  return sport === 'tennis' ? '/admin/lawn-tennis' : '/admin/badminton';
}
