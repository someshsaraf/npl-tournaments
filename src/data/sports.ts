import type { Sport } from './tournamentData';

/**
 * The sports shown on the landing page. `sport` is the scoring/data id
 * (`tennis` is kept for the data store back-compat); `slug` is the URL segment.
 * Table Tennis is listed but not built yet (`sport: null`).
 */
export interface SportCard {
  slug: 'badminton' | 'lawn-tennis' | 'table-tennis';
  sport: Sport | null;
  label: string;
  tagline: string;
  /** Wide hero photo for the sport hub (path under /public). */
  heroImage: string;
  /** CSS object-position for heroImage. */
  heroFocus?: string;
  /** Card photo on the landing page. */
  cardImage: string;
  /** Extra photos for the hub's photo strip. */
  galleryImages: string[];
  /** Legacy community-event ids whose photos belong to this sport. */
  legacyEventIds: string[];
}

export const SPORT_CARDS: readonly SportCard[] = [
  {
    slug: 'badminton',
    sport: 'badminton',
    label: 'Badminton',
    tagline: 'NPL Badminton — singles, doubles and the Team Championship.',
    heroImage: '/events/badminton-tournament.jpg',
    cardImage: '/events/badminton-tournament.jpg',
    galleryImages: ['/events/badminton-tournament-2.jpg', '/events/badminton-tournament-3.jpg'],
    legacyEventIds: ['badminton-tournament']
  },
  {
    slug: 'lawn-tennis',
    sport: 'tennis',
    label: 'Lawn Tennis',
    tagline: 'Pools, knockouts and finals under the lights — singles, doubles and teams.',
    heroImage: '/sports/lawn-tennis/lt-2025-3.jpg',
    heroFocus: '50% 65%',
    cardImage: '/sports/lawn-tennis/lt-2025-2.jpg',
    galleryImages: [
      '/sports/lawn-tennis/lt-2025-5.jpg',
      '/sports/lawn-tennis/lt-2025-2.jpg',
      '/sports/lawn-tennis/lt-2025-4.jpg',
      '/sports/lawn-tennis/lt-2025-1.jpg',
      '/sports/lawn-tennis/lt-2025-7.jpg'
    ],
    legacyEventIds: ['tennis-tournament']
  },
  {
    slug: 'table-tennis',
    sport: null,
    label: 'Table Tennis',
    tagline: 'Coming soon.',
    heroImage: '',
    cardImage: '',
    galleryImages: [],
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
  return sport === 'tennis' ? '/admin/lawn-tennis' : '/admin/tournament';
}
