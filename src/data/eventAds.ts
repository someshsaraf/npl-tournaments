/**
 * Community event ads for home + between-match overlays + /live rail.
 * Date windows use the viewer's local calendar day (YYYY-MM-DD).
 * Optional activeUntilTime (HH:mm local) ends an ad mid-day on its last active day.
 *
 * Concurrency: pure functions; no shared mutable state.
 * Security: poster paths are fixed same-origin constants only.
 */

export type EventAdId =
  | 'friends-kitchen'
  | 'gol-gappe'
  | 'drawing-competition'
  | 'hindustan-carpet';

export type EventAdAccent = 'amber' | 'saffron' | 'gold' | 'tangy';

/** Visual treatment for the home spotlight carousel. */
export type EventAdTemplate =
  | 'kitchen-marquee'
  | 'festival-spotlight'
  | 'exhibition-spot'
  | 'street-food';

export type EventAd = {
  id: EventAdId;
  /** Short label shown on overlays / banners */
  title: string;
  eyebrow: string;
  blurb: string;
  ctaLabel: string;
  posterSrc: string;
  alt: string;
  /** Inclusive local calendar start YYYY-MM-DD */
  activeFrom: string;
  /** Inclusive local calendar end YYYY-MM-DD */
  activeTo: string;
  /**
   * Optional local end time HH:mm on activeTo (and any day in range).
   * Ad is inactive at/after this clock time (e.g. Drawing ends at 14:00).
   */
  activeUntilTime?: string;
  accent: EventAdAccent;
  template: EventAdTemplate;
  /** Punchy ribbon text on the spotlight */
  shortTag: string;
};

/** Friends' Kitchen — stall night only (8 Aug 2026). */
const FRIENDS_KITCHEN: EventAd = {
  id: 'friends-kitchen',
  title: "Friends' Kitchen",
  eyebrow: 'Tonight at Clubhouse',
  blurb:
    "We're back — Amritsari Chole with Kulcha or Ghee Jeera Rice, plus Gulab Jamun. From 6:30 PM onwards. Pre-order to skip the rush.",
  ctaLabel: 'View menu poster',
  posterSrc: '/Friends-Kitchen.jpeg',
  alt: "Friends' Kitchen — We're back! Amritsari Chole, Kulcha, Gulab Jamun. Pre-order at Clubhouse from 6:30 PM.",
  activeFrom: '2026-08-08',
  activeTo: '2026-08-08',
  accent: 'amber',
  template: 'kitchen-marquee',
  shortTag: 'Tonight only'
};

/** Flirting Flavors Gol Gappe — NPL court food on 9 Aug 2026 (promo from 8 Aug). */
const GOL_GAPPE: EventAd = {
  id: 'gol-gappe',
  title: 'Flirting Flavors · Gol Gappe',
  eyebrow: 'NPL court · 9 Aug',
  blurb:
    'Keeping Gol Gappe for NPL Badminton on 9th Aug — crispy, spicy, tangy. See you at the court for great shots & greater bites!',
  ctaLabel: 'View Gol Gappe poster',
  posterSrc: '/Gol-Gappe.jpeg',
  alt: 'Flirting Flavors Gol Gappe at NPL Badminton Nature Walk Premier League on 9th August. Crispy, spicy, tangy.',
  activeFrom: '2026-08-08',
  activeTo: '2026-08-09',
  accent: 'tangy',
  template: 'street-food',
  shortTag: '9th Aug'
};

/** Independence Day drawing competition — ends at 2:00 PM local on 8 Aug 2026. */
const DRAWING_COMPETITION: EventAd = {
  id: 'drawing-competition',
  title: 'Independence Day Drawing Competition',
  eyebrow: 'Nature Walk · Clubhouse',
  blurb:
    'Today 2:00–3:30 PM at the Clubhouse. Ages 3–5, 6–8, and 9+. Bring crayons/pencils — sheets provided. Prizes on 15 Aug.',
  ctaLabel: 'View competition poster',
  posterSrc: '/Drawing-Competition.jpeg',
  alt: 'Independence Day 2026 Drawing Competition at Society Clubhouse — Saturday 8 August, 2:00 to 3:30 PM.',
  activeFrom: '2026-08-08',
  activeTo: '2026-08-08',
  activeUntilTime: '14:00',
  accent: 'saffron',
  template: 'festival-spotlight',
  shortTag: 'Today 2:00 PM'
};

/** Hindustan Carpet exhibition & exchange — 8 & 9 Aug 2026. */
const HINDUSTAN_CARPET: EventAd = {
  id: 'hindustan-carpet',
  title: 'Hindustan Carpet',
  eyebrow: 'Marketing Office · RNW',
  blurb:
    'Exclusive carpet exhibition & exchange on 8 & 9 Aug, 8 am–9 pm. Exchange old carpets and avail up to 35% off. Contact 8050902880.',
  ctaLabel: 'View exhibition poster',
  posterSrc: '/Hindustan-Carpet.jpeg',
  alt: 'Hindustan Carpet exclusive carpet exhibition and exchange event on 8 and 9 August at Marketing Office, RNW. Up to 35% off. Contact 8050902880.',
  activeFrom: '2026-08-08',
  activeTo: '2026-08-09',
  accent: 'gold',
  template: 'exhibition-spot',
  shortTag: '8 & 9 Aug'
};

/** Display order: Friends' Kitchen, Gol Gappe (2nd), Drawing, Carpet. */
const EVENT_ADS: readonly EventAd[] = Object.freeze([
  FRIENDS_KITCHEN,
  GOL_GAPPE,
  DRAWING_COMPETITION,
  HINDUSTAN_CARPET
]);

/**
 * Full catalog (no date/time filter). Used for path allowlisting.
 * Returns a shallow copy so callers cannot mutate the frozen catalog.
 */
export function getAllEventAds(): EventAd[] {
  return [...EVENT_ADS];
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Local calendar date as YYYY-MM-DD (not UTC).
 * Validates `now` is a Date; falls back to current time if invalid.
 */
export function getLocalDateKey(now: Date = new Date()): string {
  const d = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isDateKey(value: unknown): value is string {
  return typeof value === 'string' && DATE_KEY_RE.test(value);
}

/** Parses HH:mm to minutes from midnight; null if invalid. */
function parseLocalTimeToMinutes(value: unknown): number | null {
  if (typeof value !== 'string' || !TIME_HM_RE.test(value)) return null;
  const match = TIME_HM_RE.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return null;
  return hours * 60 + mins;
}

function isAdActiveAt(ad: EventAd, now: Date): boolean {
  const dateKey = getLocalDateKey(now);
  if (!isDateKey(dateKey) || !isDateKey(ad.activeFrom) || !isDateKey(ad.activeTo)) {
    return false;
  }
  if (dateKey < ad.activeFrom || dateKey > ad.activeTo) {
    return false;
  }
  if (ad.activeUntilTime) {
    const untilMins = parseLocalTimeToMinutes(ad.activeUntilTime);
    if (untilMins === null) return false;
    const nowMins = now.getHours() * 60 + now.getMinutes();
    if (nowMins >= untilMins) return false;
  }
  return true;
}

/**
 * Ads eligible for the given local date/time.
 * Drawing Competition drops at/after 14:00 on 2026-08-08.
 */
export function getActiveEventAds(now: Date = new Date()): EventAd[] {
  const d = now instanceof Date && !Number.isNaN(now.getTime()) ? now : new Date();
  return EVENT_ADS.filter((ad) => isAdActiveAt(ad, d));
}

/**
 * Uniform random pick among active ads. Returns null when none are active.
 * Uses crypto.getRandomValues when available.
 */
export function pickRandomEventAd(
  now: Date = new Date(),
  /** Avoid immediate repeat when possible */
  excludeId?: EventAdId | null
): EventAd | null {
  const active = getActiveEventAds(now);
  if (active.length === 0) return null;

  const pool =
    excludeId && active.length > 1
      ? active.filter((ad) => ad.id !== excludeId)
      : active;

  if (pool.length === 0) return active[0] ?? null;
  if (pool.length === 1) return pool[0] ?? null;

  let index = 0;
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    index = (buf[0] ?? 0) % pool.length;
  } else {
    index = Math.floor(Math.random() * pool.length);
  }
  return pool[index] ?? null;
}

export function isSafeAdPosterPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('..') &&
    value.length < 200 &&
    EVENT_ADS.some((ad) => ad.posterSrc === value)
  );
}
