import { useEffect, useState } from 'react';
import {
  onDisconnect,
  onValue,
  ref,
  remove,
  serverTimestamp,
  set,
  update
} from 'firebase/database';
import { db, LIVE_VIEWERS_PRESENCE_PATH } from '../firebase';

const SESSION_STORAGE_KEY = 'npl-live-viewer-session';
const SESSION_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;
/** Drop presence rows that have not heartbeated within this window. */
const STALE_MS = 90_000;
const HEARTBEAT_MS = 25_000;
const STALE_SWEEP_MS = 15_000;

/**
 * Stable per-tab session id (sessionStorage). Regenerates if missing/invalid.
 * Input validation: only [a-zA-Z0-9_-]{8,64} so path injection is impossible.
 */
function getOrCreateSessionId(): string | null {
  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (typeof existing === 'string' && SESSION_ID_RE.test(existing)) {
      return existing;
    }
    const raw =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().replace(/-/g, '')
        : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
    const id = raw.slice(0, 64);
    if (!SESSION_ID_RE.test(id)) return null;
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return null;
  }
}

function countFreshViewers(val: unknown, nowMs: number): number {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return 0;
  let n = 0;
  for (const [key, entry] of Object.entries(val as Record<string, unknown>)) {
    if (!SESSION_ID_RE.test(key)) continue;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const at = (entry as { at?: unknown }).at;
    if (typeof at !== 'number' || !Number.isFinite(at)) continue;
    if (nowMs - at <= STALE_MS) n += 1;
  }
  return n;
}

/**
 * Registers this /live tab in RTDB presence and returns the current viewer count.
 * Leaves immediately on unmount / pagehide / beforeunload; onDisconnect covers hard kills.
 * Heartbeat + stale filter so abandoned rows stop counting within ~90s.
 *
 * Concurrency: each tab owns one path; no shared mutable globals.
 * Security: fixed allowlisted path prefix; session id validated before use.
 * Requires RTDB rules allowing public write/delete under presence/live/{id}.
 */
export function useLiveViewerCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const sessionId = getOrCreateSessionId();
    if (!sessionId) return;

    const myRef = ref(db, `${LIVE_VIEWERS_PRESENCE_PATH}/${sessionId}`);
    const listRef = ref(db, LIVE_VIEWERS_PRESENCE_PATH);
    const connectedRef = ref(db, '.info/connected');
    let latestRaw: unknown = null;
    let joined = false;
    let closed = false;

    const refreshCount = () => {
      setCount(countFreshViewers(latestRaw, Date.now()));
    };

    const leave = () => {
      if (closed) return;
      closed = true;
      joined = false;
      try {
        void onDisconnect(myRef).cancel();
      } catch {
        /* ignore */
      }
      void remove(myRef).catch(() => {
        /* ignore — onDisconnect still covers hard close */
      });
    };

    const join = async () => {
      if (closed) return;
      try {
        await onDisconnect(myRef).remove();
        if (closed) return;
        await set(myRef, { at: serverTimestamp() });
        if (closed) {
          void remove(myRef).catch(() => undefined);
          return;
        }
        joined = true;
      } catch (err) {
        console.error('Live viewer presence join failed:', err);
      }
    };

    const heartbeat = async () => {
      if (closed || !joined) return;
      try {
        await update(myRef, { at: serverTimestamp() });
      } catch {
        /* ignore transient heartbeat errors */
      }
    };

    const unsubCount = onValue(listRef, (snap) => {
      latestRaw = snap.val();
      refreshCount();
    });

    const unsubConnected = onValue(connectedRef, (snap) => {
      if (snap.val() === true && !closed) {
        void join();
      }
    });

    const heartbeatId = window.setInterval(() => {
      void heartbeat();
    }, HEARTBEAT_MS);

    const sweepId = window.setInterval(refreshCount, STALE_SWEEP_MS);

    const onPageHide = () => {
      leave();
    };

    const onPageShow = (event: PageTransitionEvent) => {
      // Restored from back-forward cache — rejoin as a viewer.
      if (event.persisted) {
        closed = false;
        void join();
      }
    };

    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('beforeunload', onPageHide);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      window.clearInterval(heartbeatId);
      window.clearInterval(sweepId);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('beforeunload', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      unsubCount();
      unsubConnected();
      leave();
    };
  }, []);

  return count;
}
