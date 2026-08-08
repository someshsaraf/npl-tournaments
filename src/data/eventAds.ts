/**
 * Community event ads for home + between-match overlays.
 * Date windows use the viewer's local calendar day (YYYY-MM-DD).
 *
 * Concurrency: pure functions; no shared mutable state.
 * Security: poster paths are fixed same-origin constants only.
 */

export type EventAdId = 'friends-kitchen' | 'drawing-competition';

export type EventAdAccent = 'amber' | 'saffron';

/** Visual treatment for the home spotlight carousel. */
export type EventAdTemplate = 'kitchen-marquee' | 'festival-spotlight';

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

/** Independence Day drawing competition — promo through 15 Aug 2026. */
const DRAWING_COMPETITION: EventAd = {
  id: 'drawing-competition',
  title: 'Independence Day Drawing Competition',
  eyebrow: 'Nature Walk · Clubhouse',
  blurb:
    '15th August at the Clubhouse. Ages 3–5, 6–8, and 9+. Bring crayons/pencils — sheets provided.',
  ctaLabel: 'View competition poster',
  posterSrc: '/Drawing-Competition.jpeg',
  alt: 'Independence Day 2026 Drawing Competition at Society Clubhouse — 15th August.',
  activeFrom: '2026-08-08',
  activeTo: '2026-08-15',
  accent: 'saffron',
  template: 'festival-spotlight',
  shortTag: '15th Aug'
};

const EVENT_ADS: readonly EventAd[] = Object.freeze([FRIENDS_KITCHEN, DRAWING_COMPETITION]);

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

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

function isAdActiveOn(ad: EventAd, dateKey: string): boolean {
  if (!isDateKey(dateKey) || !isDateKey(ad.activeFrom) || !isDateKey(ad.activeTo)) {
    return false;
  }
  return dateKey >= ad.activeFrom && dateKey <= ad.activeTo;
}

/**
 * Ads eligible for the given local calendar day.
 * Friends' Kitchen is only included on 2026-08-08.
 */
export function getActiveEventAds(now: Date = new Date()): EventAd[] {
  const dateKey = getLocalDateKey(now);
  return EVENT_ADS.filter((ad) => isAdActiveOn(ad, dateKey));
}

/**
 * Uniform random pick among active ads. Returns null when none are active.
 * Uses crypto.getRandomValues when available (secure, no Math.random bias concerns for small n).
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
