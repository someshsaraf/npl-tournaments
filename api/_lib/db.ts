import { getStore, pushId, splitPath, type Json } from '../../server/store.js';

/**
 * Server-side data access with a small RTDB-style API (ref/get/set/update/
 * transaction/push), so the auth and gallery handlers read naturally.
 * Bypasses the client access rules — server code is trusted.
 */

export interface Snapshot {
  val(): Json;
  exists(): boolean;
}

export interface Ref {
  readonly key: string | null;
  get(): Promise<Snapshot>;
  set(value: unknown): Promise<void>;
  update(values: Record<string, unknown>): Promise<void>;
  remove(): Promise<void>;
  transaction(fn: (current: Json) => unknown): Promise<{ committed: boolean; snapshot: Snapshot }>;
  push(): Ref;
}

export interface Db {
  ref(path?: string): Ref;
}

function snapshot(value: Json): Snapshot {
  return { val: () => value, exists: () => value !== null };
}

function makeRef(path: string): Ref {
  const segs = splitPath(path);
  const store = getStore();
  return {
    key: segs.length ? segs[segs.length - 1] : null,
    get: async () => snapshot(store.get(path)),
    set: async (value) => store.set(path, value),
    update: async (values) => store.update(path, values),
    remove: async () => store.remove(path),
    transaction: async (fn) => {
      const { committed, value } = store.transaction(path, fn);
      return { committed, snapshot: snapshot(value) };
    },
    push: () => makeRef(segs.length ? `${path}/${pushId()}` : pushId())
  };
}

export function getAdminDb(): Db {
  return { ref: (path = '') => makeRef(path) };
}
