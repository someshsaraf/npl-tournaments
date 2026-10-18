import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

/**
 * The app's data: one JSON tree addressed by slash paths
 * ("completedMatches/f-12", "liveMatches/tennis") — the same model the app
 * used with Firebase RTDB, so client code reads and writes it the same way.
 *
 * Held in memory, persisted to SQLite one top-level key per row (e.g. the
 * whole `completedMatches` object is one row). Data here is small (tens to
 * hundreds of KB), so whole-key writes are cheap and keep persistence simple.
 *
 * Semantics kept from RTDB: writing null deletes, empty objects vanish,
 * `{".sv":"timestamp"}` becomes the server time.
 */

export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Obj = { [k: string]: Json };

/** Top-level keys that live in memory only (e.g. who is watching right now). */
const EPHEMERAL_KEYS = new Set(['presence']);

const KEY_RE = /^[^./#$[\]\s][^/#$[\]]*$/;

export function splitPath(path: string): string[] {
  const segs = path.split('/').filter((s) => s.length > 0);
  for (const s of segs) {
    if (!KEY_RE.test(s) || s.length > 200) throw new Error(`Invalid path segment "${s}"`);
  }
  return segs;
}

export function joinPath(segs: string[]): string {
  return segs.join('/');
}

function isObj(v: unknown): v is Obj {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function clone<T>(v: T): T {
  return v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T);
}

/** Resolve server values, drop nulls/undefined, collapse empty containers to null. */
export function normalize(value: unknown, now = Date.now()): Json {
  if (value === undefined || value === null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    const out = value.map((v) => normalize(v, now));
    // RTDB arrays can't hold holes; keep nulls positional only if something real remains.
    return out.some((v) => v !== null) ? out : null;
  }
  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;
    if (Object.keys(o).length === 1 && o['.sv'] === 'timestamp') return now;
    const out: Obj = {};
    for (const [k, v] of Object.entries(o)) {
      const n = normalize(v, now);
      if (n !== null) out[k] = n;
    }
    return Object.keys(out).length > 0 ? out : null;
  }
  return null;
}

function getChild(node: Json | undefined, key: string): Json | undefined {
  if (Array.isArray(node)) return node[Number(key)];
  if (isObj(node)) return node[key];
  return undefined;
}

export class Store {
  private root: Obj = {};
  private readonly db: DatabaseSync | null;
  private readonly listeners = new Set<(paths: string[]) => void>();

  /** `file` = SQLite path, or ':memory:' for tests. */
  constructor(file: string) {
    if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec('CREATE TABLE IF NOT EXISTS nodes (key TEXT PRIMARY KEY, json TEXT NOT NULL)');
    this.db.exec('PRAGMA journal_mode = WAL');
    for (const row of this.db.prepare('SELECT key, json FROM nodes').all() as Array<{ key: string; json: string }>) {
      try {
        this.root[row.key] = JSON.parse(row.json) as Json;
      } catch {
        console.error(`store: skipping corrupt row "${row.key}"`);
      }
    }
  }

  onChange(listener: (paths: string[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Deep copy of the value at `path` (null when missing). */
  get(path: string): Json {
    let node: Json | undefined = this.root;
    for (const s of splitPath(path)) {
      node = getChild(node, s);
      if (node === undefined) return null;
    }
    return clone(node ?? null);
  }

  set(path: string, value: unknown): void {
    const segs = splitPath(path);
    this.write([[segs, normalize(value)]]);
  }

  /**
   * Multi-location write. Keys of `values` are paths relative to `path`
   * and may contain slashes ("users/u1": null deletes that user).
   */
  update(path: string, values: Record<string, unknown>): void {
    const base = splitPath(path);
    const now = Date.now();
    const writes: Array<[string[], Json]> = Object.entries(values).map(([k, v]) => [
      [...base, ...splitPath(k)],
      normalize(v, now)
    ]);
    this.write(writes);
  }

  remove(path: string): void {
    this.set(path, null);
  }

  /**
   * Atomic read-modify-write (single-threaded, so trivially atomic).
   * Returning undefined from `fn` aborts, like RTDB.
   */
  transaction(path: string, fn: (current: Json) => unknown): { committed: boolean; value: Json } {
    const current = this.get(path);
    const next = fn(current);
    if (next === undefined) return { committed: false, value: current };
    this.set(path, next);
    return { committed: true, value: this.get(path) };
  }

  /** Compare-and-set for clients: write only if the stored value still equals `expected`. */
  compareAndSet(path: string, expected: unknown, value: unknown): boolean {
    if (JSON.stringify(this.get(path)) !== JSON.stringify(normalize(expected))) return false;
    this.set(path, value);
    return true;
  }

  private write(writes: Array<[string[], Json]>): void {
    const touchedTop = new Set<string>();
    for (const [segs, value] of writes) {
      if (segs.length === 0) {
        // Whole-tree write: only used by imports.
        for (const k of Object.keys(this.root)) touchedTop.add(k);
        this.root = isObj(value) ? (clone(value) as Obj) : {};
        for (const k of Object.keys(this.root)) touchedTop.add(k);
        continue;
      }
      this.setAt(segs, value);
      touchedTop.add(segs[0]);
    }
    this.persist(touchedTop);
    const paths = writes.map(([segs]) => joinPath(segs));
    for (const l of this.listeners) {
      try {
        l(paths);
      } catch (err) {
        console.error('store listener failed:', err);
      }
    }
  }

  private setAt(segs: string[], value: Json): void {
    // Walk/create parents.
    const parents: Array<{ node: Obj | Json[]; key: string }> = [];
    let node: Obj | Json[] = this.root;
    for (let i = 0; i < segs.length - 1; i++) {
      const key = segs[i];
      let next = getChild(node, key);
      if (!isObj(next) && !Array.isArray(next)) {
        if (value === null) return; // deleting under a missing parent: no-op
        next = {};
        this.assign(node, key, next);
      }
      parents.push({ node, key });
      node = next as Obj | Json[];
    }
    const last = segs[segs.length - 1];
    if (value === null) this.delete(node, last);
    else this.assign(node, last, clone(value));

    // Prune parents that became empty (RTDB has no empty objects).
    for (let i = parents.length - 1; i >= 0; i--) {
      const { node: parent, key } = parents[i];
      const child = getChild(parent, key);
      const empty = Array.isArray(child)
        ? child.every((c) => c === null || c === undefined)
        : isObj(child) && Object.keys(child).length === 0;
      if (!empty) break;
      this.delete(parent, key);
    }
  }

  private assign(node: Obj | Json[], key: string, value: Json): void {
    if (Array.isArray(node)) node[Number(key)] = value;
    else node[key] = value;
  }

  private delete(node: Obj | Json[], key: string): void {
    if (Array.isArray(node)) {
      const i = Number(key);
      if (i === node.length - 1) node.pop();
      else node[i] = null;
    } else {
      delete node[key];
    }
  }

  private persist(keys: Set<string>): void {
    if (!this.db) return;
    const upsert = this.db.prepare('INSERT INTO nodes (key, json) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET json = excluded.json');
    const del = this.db.prepare('DELETE FROM nodes WHERE key = ?');
    for (const key of keys) {
      if (EPHEMERAL_KEYS.has(key)) continue;
      const value = this.root[key];
      if (value === undefined || value === null) del.run(key);
      else upsert.run(key, JSON.stringify(value));
    }
  }
}

// Firebase-style push ids: time-ordered, 20 chars, sortable as strings.
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
let lastPushTime = 0;
let lastRand: number[] = [];

export function pushId(now = Date.now()): string {
  const dup = now === lastPushTime;
  lastPushTime = now;
  let t = now;
  const timeChars: string[] = [];
  for (let i = 7; i >= 0; i--) {
    timeChars[i] = PUSH_CHARS.charAt(t % 64);
    t = Math.floor(t / 64);
  }
  if (!dup) {
    const bytes = randomBytes(12);
    lastRand = Array.from(bytes, (b) => b % 64);
  } else {
    let i = 11;
    while (i >= 0 && lastRand[i] === 63) {
      lastRand[i] = 0;
      i--;
    }
    if (i >= 0) lastRand[i] += 1;
  }
  return timeChars.join('') + lastRand.map((r) => PUSH_CHARS.charAt(r)).join('');
}

let singleton: Store | null = null;

/** Process-wide store (DATA_DIR/app.db). */
export function getStore(): Store {
  if (!singleton) {
    const dir = process.env.DATA_DIR?.trim() || './data';
    singleton = new Store(`${dir.replace(/\/$/, '')}/app.db`);
  }
  return singleton;
}

/** For tests/import tooling. */
export function setStoreForTesting(store: Store): void {
  singleton = store;
}
