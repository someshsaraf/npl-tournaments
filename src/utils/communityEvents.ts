import { ref, onValue, set } from 'firebase/database';
import type { Database, Unsubscribe } from 'firebase/database';
import { COMMUNITY_EVENTS_PATH } from '../firebase';
import type { CommunityEvent, CommunityEventCategory, EventPost } from '../data/communityEvents';
import { DEFAULT_COMMUNITY_EVENTS } from '../data/communityEvents';

function isCommunityEvent(value: unknown): value is CommunityEvent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.title === 'string';
}

function normalizeEvents(raw: unknown): CommunityEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isCommunityEvent);
}

/**
 * Subscribe to the community events list. Seeds Firebase with
 * DEFAULT_COMMUNITY_EVENTS the first time the node is empty (same pattern as
 * AdminTeamsPage's TEAMS auto-seed).
 */
export function subscribeCommunityEvents(
  database: Database,
  callback: (events: CommunityEvent[]) => void
): Unsubscribe {
  return onValue(ref(database, COMMUNITY_EVENTS_PATH), (snapshot) => {
    const data = snapshot.val();
    const events = normalizeEvents(data);
    if (events.length > 0) {
      callback(events);
    } else {
      callback(DEFAULT_COMMUNITY_EVENTS);
      set(ref(database, COMMUNITY_EVENTS_PATH), DEFAULT_COMMUNITY_EVENTS).catch((err) => {
        console.error('Failed to seed default community events:', err);
      });
    }
  });
}

export function saveCommunityEvents(database: Database, events: CommunityEvent[]): Promise<void> {
  if (!Array.isArray(events)) {
    return Promise.reject(new Error('saveCommunityEvents: events must be an array'));
  }
  return set(ref(database, COMMUNITY_EVENTS_PATH), events);
}

export function createCommunityEventId(): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `event-${Date.now()}-${rand}`;
}

export function buildBlankCommunityEvent(nextSortOrder: number): CommunityEvent {
  const category: CommunityEventCategory = 'cultural';
  return {
    id: createCommunityEventId(),
    title: 'New Event',
    category,
    month: 'TBD',
    dateLabel: 'TBD',
    location: '',
    description: '',
    sortOrder: nextSortOrder
  };
}

function createEventPostId(): string {
  const rand =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `post-${Date.now()}-${rand}`;
}

/**
 * Append a post (image and/or text) to one event and persist the whole list.
 * Concurrency: whole-array write, same as saveCommunityEvents — last write wins.
 */
export async function addEventPost(
  database: Database,
  events: CommunityEvent[],
  eventId: string,
  input: { text?: string; imageUrl?: string }
): Promise<EventPost> {
  const text = typeof input.text === 'string' ? input.text.trim().slice(0, 2000) : '';
  const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '';
  if (!text && !imageUrl) {
    throw new Error('A post needs text, an image, or both.');
  }
  const post: EventPost = {
    id: createEventPostId(),
    createdAt: new Date().toISOString(),
    ...(text ? { text } : {}),
    ...(imageUrl ? { imageUrl } : {})
  };
  const next = events.map((e) =>
    e.id === eventId ? { ...e, posts: [post, ...(Array.isArray(e.posts) ? e.posts : [])] } : e
  );
  await saveCommunityEvents(database, next);
  return post;
}

/** Remove one post from one event and persist the whole list. */
export async function removeEventPost(
  database: Database,
  events: CommunityEvent[],
  eventId: string,
  postId: string
): Promise<void> {
  const next = events.map((e) =>
    e.id === eventId
      ? { ...e, posts: (Array.isArray(e.posts) ? e.posts : []).filter((p) => p.id !== postId) }
      : e
  );
  await saveCommunityEvents(database, next);
}

export type LatestUpdate = { event: CommunityEvent; post: EventPost };

/** Every event's posts, flattened and sorted newest-first — for a cross-event "Latest Updates" feed. */
export function getLatestUpdates(events: CommunityEvent[], limit: number): LatestUpdate[] {
  return events
    .flatMap((event) => (Array.isArray(event.posts) ? event.posts : []).map((post) => ({ event, post })))
    .sort((a, b) => b.post.createdAt.localeCompare(a.post.createdAt))
    .slice(0, limit);
}
