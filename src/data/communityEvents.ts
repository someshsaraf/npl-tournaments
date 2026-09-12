/**
 * Community events (sports tournaments + cultural celebrations) shown on the
 * Home page and editable from /admin/events. Persisted in Firebase (`events`,
 * whole-array writes — same pattern as `teams`), seeded from DEFAULT_COMMUNITY_EVENTS
 * the first time the node is empty.
 */
export type CommunityEventCategory = 'sports' | 'cultural';

export interface CommunityEvent {
  id: string;
  title: string;
  category: CommunityEventCategory;
  /**
   * Only for category 'sports' events that have a scored tournament in this
   * app (Badminton, Tennis) — lets Home deep-link to that sport's
   * Schedule/Results/Stats tab. Omit for sports events with no in-app
   * tournament tracking (e.g. Marathon).
   */
  sport?: 'badminton' | 'tennis';
  /** Admin-editable free text grouping, e.g. "August", "TBD", "July–August". */
  month: string;
  /** Human display string, e.g. "15 August" or "31 Jul, 1, 2, 7, 8, 9 Aug" or "TBD". */
  dateLabel: string;
  /** ISO date (YYYY-MM-DD). Optional — enables ongoing/next-up detection. */
  startDate?: string;
  /** ISO date (YYYY-MM-DD). Optional; defaults to startDate when absent. */
  endDate?: string;
  location?: string;
  description?: string;
  /** Path under /public, if a poster/photo is available. */
  imageSrc?: string;
  /** Extra photos (paths under /public) shown as a slow-panning strip on tile hover. */
  galleryImages?: string[];
  /** Fallback manual ordering for undated (TBD) events. */
  sortOrder: number;
  /** Admin-posted updates (image and/or text) shown on this event's public page. */
  posts?: EventPost[];
}

/** One admin-posted update for an event — shown newest-first on its public page. */
export interface EventPost {
  id: string;
  text?: string;
  /** URL of an uploaded image (via the shared gallery upload pipeline), if attached. */
  imageUrl?: string;
  createdAt: string;
}

/** Seeded from the CSC 5.0 (2026–27) community calendar. */
export const DEFAULT_COMMUNITY_EVENTS: CommunityEvent[] = [
  {
    id: 'badminton-tournament',
    title: 'Badminton Tournament',
    category: 'sports',
    sport: 'badminton',
    month: 'July–August',
    dateLabel: '31 Jul, 1, 2, 7, 8, 9 Aug',
    startDate: '2026-07-31',
    endDate: '2026-08-09',
    location: 'Nature Walk Courts',
    description: 'The flagship NPL badminton tournament — singles, doubles, and Team Championship.',
    imageSrc: '/events/badminton-tournament.jpg',
    galleryImages: ['/events/badminton-tournament-2.jpg', '/events/badminton-tournament-3.jpg'],
    sortOrder: 1
  },
  {
    id: 'independence-day',
    title: 'Independence Day',
    category: 'cultural',
    month: 'August',
    dateLabel: '15 August',
    startDate: '2026-08-15',
    endDate: '2026-08-15',
    location: 'Society Clubhouse',
    description: 'Flag hoisting, drawing competition, and community celebrations.',
    imageSrc: '/events/independence-day.jpg',
    galleryImages: ['/events/independence-day-2.jpg', '/events/independence-day-3.jpg'],
    sortOrder: 2
  },
  {
    id: 'ganesh-utsav',
    title: 'Ganesh Utsav',
    category: 'cultural',
    month: 'September',
    dateLabel: '14–16 Sep',
    startDate: '2026-09-14',
    endDate: '2026-09-16',
    location: 'Society Clubhouse',
    description: 'Ganpati installation, aarti, and cultural programs.',
    imageSrc: '/events/ganesh-utsav.jpg',
    galleryImages: ['/events/ganesh-utsav-2.jpg', '/events/ganesh-utsav-3.jpg'],
    sortOrder: 3
  },
  {
    id: 'tennis-tournament',
    title: 'Tennis Tournament',
    category: 'sports',
    sport: 'tennis',
    month: 'TBD',
    dateLabel: 'TBD',
    location: 'Nature Walk Courts',
    description: 'Singles and doubles tennis tournament — qualifiers, semifinals, and final.',
    imageSrc: '/events/tennis-tournament.jpg',
    galleryImages: ['/events/tennis-tournament-2.jpg', '/events/tennis-tournament-3.jpg'],
    sortOrder: 4
  },
  {
    id: 'rajotsav',
    title: 'Rajotsav',
    category: 'cultural',
    month: 'November',
    dateLabel: '1 November',
    startDate: '2026-11-01',
    endDate: '2026-11-01',
    location: 'Society Clubhouse',
    description: 'Karnataka Rajyotsava celebrations.',
    imageSrc: '/events/rajotsav.jpg',
    galleryImages: ['/events/rajotsav-2.jpg', '/events/rajotsav-3.jpg'],
    sortOrder: 5
  },
  {
    id: 'dussehra-diwali',
    title: 'Dussehra & Diwali',
    category: 'cultural',
    month: 'TBD',
    dateLabel: 'TBD',
    location: 'Society Clubhouse',
    description: 'Dussehra and Diwali festivities.',
    imageSrc: '/events/dussehra-diwali.jpg',
    galleryImages: ['/events/dussehra-diwali-2.jpg', '/events/dussehra-diwali-3.jpg'],
    sortOrder: 6
  },
  {
    id: 'marathon',
    title: 'Marathon',
    category: 'sports',
    month: 'TBD',
    dateLabel: 'TBD',
    location: 'Nature Walk',
    description: 'Community fun run / marathon.',
    imageSrc: '/events/marathon.jpg',
    galleryImages: ['/events/marathon-2.jpg'],
    sortOrder: 7
  },
  {
    id: 'holi',
    title: 'Holi',
    category: 'cultural',
    month: 'March',
    dateLabel: '22 March',
    startDate: '2027-03-22',
    endDate: '2027-03-22',
    location: 'Society Clubhouse',
    description: 'Colors, music, and community celebrations.',
    imageSrc: '/events/holi.jpg',
    sortOrder: 8
  },
  {
    id: 'lohri-bhogi-pongal',
    title: 'Lohri / Bhogi & Pongal',
    category: 'cultural',
    month: 'January',
    dateLabel: '13th, 14th Jan',
    startDate: '2027-01-13',
    endDate: '2027-01-14',
    location: 'Society Clubhouse',
    description: 'Bonfire, festivities, and regional harvest celebrations.',
    imageSrc: '/events/lohri-bhogi-pongal.jpg',
    sortOrder: 9
  },
  {
    id: 'republic-day',
    title: 'Republic Day',
    category: 'cultural',
    month: 'January',
    dateLabel: '26 January',
    startDate: '2027-01-26',
    endDate: '2027-01-26',
    location: 'Society Clubhouse',
    description: 'Flag hoisting and community celebrations.',
    imageSrc: '/events/republic-day.jpg',
    sortOrder: 10
  }
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value);
}

/** Local calendar date as YYYY-MM-DD (not UTC). */
function todayKey(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export type EventStatus = 'ongoing' | 'upcoming' | 'past' | 'undated';

/** Status relative to `now`'s local calendar date. Undated events are always 'undated'. */
export function getEventStatus(event: CommunityEvent, now: Date = new Date()): EventStatus {
  if (!isIsoDate(event.startDate)) return 'undated';
  const end = isIsoDate(event.endDate) ? event.endDate : event.startDate;
  const key = todayKey(now);
  if (key < event.startDate) return 'upcoming';
  if (key > end) return 'past';
  return 'ongoing';
}

/**
 * The event to feature: the first ongoing event (by start date), else the
 * soonest dated upcoming event, else the lowest-sortOrder undated event, else null.
 */
export function selectFeaturedEvent(
  events: CommunityEvent[],
  now: Date = new Date()
): CommunityEvent | null {
  if (!Array.isArray(events) || events.length === 0) return null;
  const ongoing = events
    .filter((e) => getEventStatus(e, now) === 'ongoing')
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  if (ongoing[0]) return ongoing[0];

  const upcoming = events
    .filter((e) => getEventStatus(e, now) === 'upcoming')
    .sort((a, b) => (a.startDate ?? '').localeCompare(b.startDate ?? ''));
  if (upcoming[0]) return upcoming[0];

  const undated = events
    .filter((e) => getEventStatus(e, now) === 'undated')
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  return undated[0] ?? null;
}

export type EventTimeline = {
  featured: CommunityEvent | null;
  upcoming: CommunityEvent[];
  past: CommunityEvent[];
};

/** Groups events for display: featured (see selectFeaturedEvent), the rest split into upcoming vs past. */
export function buildEventTimeline(events: CommunityEvent[], now: Date = new Date()): EventTimeline {
  const list = Array.isArray(events) ? events : [];
  const featured = selectFeaturedEvent(list, now);

  const rest = list.filter((e) => e.id !== featured?.id);
  const upcoming = rest
    .filter((e) => getEventStatus(e, now) !== 'past')
    .sort((a, b) => {
      const aDated = isIsoDate(a.startDate);
      const bDated = isIsoDate(b.startDate);
      if (aDated && bDated) return (a.startDate as string).localeCompare(b.startDate as string);
      if (aDated) return -1;
      if (bDated) return 1;
      return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    });
  const past = rest
    .filter((e) => getEventStatus(e, now) === 'past')
    .sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''));

  return { featured, upcoming, past };
}
