/**
 * Live data client for the self-hosted server (server/realtime.ts).
 *
 * Mirrors the small slice of the Firebase RTDB API this app used — ref,
 * onValue, get, set, update, remove, push, runTransaction, onDisconnect,
 * serverTimestamp — so screens subscribe and write exactly as before, but
 * against our own Node server over one WebSocket (/ws).
 *
 * Like Firebase: subscriptions survive reconnects, writes made while offline
 * are queued and sent on reconnect, and `.info/connected` reports the link.
 */

export type Unsubscribe = () => void;

export interface Database {
  readonly kind: 'realtime-db';
}

export interface DatabaseReference {
  readonly path: string;
  readonly key: string | null;
}

export interface DataSnapshot {
  readonly key: string | null;
  val(): any; // eslint-disable-line @typescript-eslint/no-explicit-any -- mirrors RTDB's untyped val()
  exists(): boolean;
}

type ValueCallback = (snap: DataSnapshot) => void;
type ErrorCallback = (err: Error) => void;

interface SubState {
  id: string;
  path: string;
  callbacks: Set<{ cb: ValueCallback; err?: ErrorCallback }>;
  value: unknown;
  loaded: boolean;
}

interface Pending {
  msg: Record<string, unknown>;
  resolve: (v: Record<string, unknown>) => void;
  reject: (e: Error) => void;
  sent: boolean;
}

const CONNECTED_PATH = '.info/connected';

function cleanPath(path: string | undefined): string {
  return (path ?? '').split('/').filter(Boolean).join('/');
}

function lastKey(path: string): string | null {
  const segs = path.split('/').filter(Boolean);
  return segs.length ? segs[segs.length - 1] : null;
}

function snapshot(path: string, value: unknown): DataSnapshot {
  const json = value === undefined ? 'null' : JSON.stringify(value);
  return {
    key: lastKey(path),
    // Fresh copy per call, like RTDB, so callers can't mutate shared state.
    val: () => JSON.parse(json),
    exists: () => json !== 'null'
  };
}

class RealtimeClient {
  private ws: WebSocket | null = null;
  private open = false;
  private nextId = 1;
  private retryMs = 500;
  private retryTimer: number | null = null;
  private readonly subs = new Map<string, SubState>(); // by path
  private readonly subsById = new Map<string, SubState>();
  private readonly pending = new Map<number, Pending>();
  private readonly ondc = new Map<string, Record<string, unknown>>();
  private readonly connectedCbs = new Set<ValueCallback>();

  private url(): string {
    const override = import.meta.env?.VITE_REALTIME_URL as string | undefined;
    if (override) return override;
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    return `${proto}://${location.host}/ws`;
  }

  private ensure(): void {
    if (this.ws || typeof window === 'undefined') return;
    const ws = new WebSocket(this.url());
    this.ws = ws;
    ws.onopen = () => {
      this.open = true;
      this.retryMs = 500;
      for (const sub of this.subs.values()) this.raw({ t: 'sub', id: sub.id, path: sub.path });
      for (const msg of this.ondc.values()) this.raw(msg);
      for (const [rid, p] of this.pending) {
        this.raw({ ...p.msg, rid });
        p.sent = true;
      }
      this.emitConnected();
    };
    ws.onmessage = (ev) => this.onMessage(ev.data);
    ws.onclose = () => {
      const wasOpen = this.open;
      this.ws = null;
      this.open = false;
      // Requests already sent may or may not have applied. Plain writes are
      // safe to resend; compare-and-set isn't (it could double-apply).
      for (const [rid, p] of this.pending) {
        if (p.sent && p.msg.t === 'cas') {
          this.pending.delete(rid);
          p.reject(new Error('Connection lost — please retry.'));
        } else {
          p.sent = false;
        }
      }
      if (wasOpen) this.emitConnected();
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.retryTimer !== null) return;
    this.retryTimer = window.setTimeout(() => {
      this.retryTimer = null;
      this.ensure();
    }, this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, 10_000);
  }

  /** Drop and reopen the socket, e.g. after login/logout so the server sees the new session. */
  reconnect(): void {
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
      const wasOpen = this.open;
      this.open = false;
      for (const p of this.pending.values()) p.sent = false;
      if (wasOpen) this.emitConnected();
    }
    this.ensure();
  }

  private raw(msg: Record<string, unknown>): void {
    if (this.open && this.ws) this.ws.send(JSON.stringify(msg));
  }

  private onMessage(data: unknown): void {
    let msg: Record<string, unknown>;
    try {
      msg = JSON.parse(String(data)) as Record<string, unknown>;
    } catch {
      return;
    }
    if (msg.t === 'val') {
      const sub = this.subsById.get(String(msg.id));
      if (!sub) return;
      sub.value = msg.value;
      sub.loaded = true;
      for (const { cb } of [...sub.callbacks]) cb(snapshot(sub.path, sub.value));
    } else if (msg.t === 'err') {
      const sub = this.subsById.get(String(msg.id));
      const error = new Error(String(msg.error ?? 'Subscription failed'));
      if (sub) for (const { err } of sub.callbacks) err?.(error);
      else console.error(error);
    } else if (msg.t === 'res') {
      const rid = Number(msg.rid);
      const p = this.pending.get(rid);
      if (!p) return;
      this.pending.delete(rid);
      if (msg.ok) p.resolve(msg);
      else p.reject(new Error(String(msg.error ?? 'Request failed')));
    }
  }

  private emitConnected(): void {
    for (const cb of [...this.connectedCbs]) cb(snapshot(CONNECTED_PATH, this.open));
  }

  request(msg: Record<string, unknown>): Promise<Record<string, unknown>> {
    this.ensure();
    const rid = this.nextId++;
    return new Promise((resolve, reject) => {
      const p: Pending = { msg, resolve, reject, sent: false };
      this.pending.set(rid, p);
      if (this.open) {
        this.raw({ ...msg, rid });
        p.sent = true;
      }
    });
  }

  subscribe(path: string, cb: ValueCallback, err?: ErrorCallback): Unsubscribe {
    if (path === CONNECTED_PATH) {
      this.connectedCbs.add(cb);
      this.ensure();
      queueMicrotask(() => this.connectedCbs.has(cb) && cb(snapshot(path, this.open)));
      return () => this.connectedCbs.delete(cb);
    }
    this.ensure();
    let sub = this.subs.get(path);
    if (!sub) {
      sub = { id: `s${this.nextId++}`, path, callbacks: new Set(), value: null, loaded: false };
      this.subs.set(path, sub);
      this.subsById.set(sub.id, sub);
      this.raw({ t: 'sub', id: sub.id, path });
    }
    const entry = { cb, err };
    sub.callbacks.add(entry);
    if (sub.loaded) {
      const s = sub;
      queueMicrotask(() => s.callbacks.has(entry) && cb(snapshot(path, s.value)));
    }
    return () => {
      const s = this.subs.get(path);
      if (!s) return;
      s.callbacks.delete(entry);
      if (s.callbacks.size === 0) {
        this.subs.delete(path);
        this.subsById.delete(s.id);
        this.raw({ t: 'unsub', id: s.id });
      }
    };
  }

  setOnDisconnect(path: string, msg: Record<string, unknown> | null): Promise<void> {
    if (msg) this.ondc.set(path, msg);
    else this.ondc.delete(path);
    return this.request({ t: 'ondc', path, ...(msg ?? { op: 'cancel' }) }).then(() => undefined);
  }
}

const client = new RealtimeClient();
const database: Database = { kind: 'realtime-db' };

export function getDatabase(): Database {
  return database;
}

/** Reopen the live connection — call after login/logout so writes use the new session. */
export function reconnectRealtime(): void {
  client.reconnect();
}

export function ref(_db: Database, path?: string): DatabaseReference {
  const p = cleanPath(path);
  return { path: p, key: lastKey(p) };
}

export function child(parent: DatabaseReference, path: string): DatabaseReference {
  return ref(database, `${parent.path}/${path}`);
}

export function onValue(r: DatabaseReference, cb: ValueCallback, err?: ErrorCallback): Unsubscribe {
  return client.subscribe(r.path, cb, err);
}

export async function get(r: DatabaseReference): Promise<DataSnapshot> {
  const res = await client.request({ t: 'get', path: r.path });
  return snapshot(r.path, res.value);
}

export async function set(r: DatabaseReference, value: unknown): Promise<void> {
  await client.request({ t: 'set', path: r.path, value: value === undefined ? null : value });
}

export async function update(r: DatabaseReference, values: Record<string, unknown>): Promise<void> {
  await client.request({ t: 'update', path: r.path, value: values });
}

export async function remove(r: DatabaseReference): Promise<void> {
  await client.request({ t: 'set', path: r.path, value: null });
}

// Firebase-style push ids: time-ordered, so new children sort last.
const PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';
function pushId(): string {
  let t = Date.now();
  let out = '';
  for (let i = 0; i < 8; i++) {
    out = PUSH_CHARS.charAt(t % 64) + out;
    t = Math.floor(t / 64);
  }
  const rand = new Uint8Array(12);
  crypto.getRandomValues(rand);
  for (const b of rand) out += PUSH_CHARS.charAt(b % 64);
  return out;
}

/** New child reference with a unique, time-ordered key (writes `value` if given). */
export function push(parent: DatabaseReference, value?: unknown): DatabaseReference {
  const r = child(parent, pushId());
  if (value !== undefined) void set(r, value);
  return r;
}

/**
 * Optimistic transaction: read, apply `fn`, compare-and-set; retry on
 * conflict. Return undefined from `fn` to abort.
 */
export async function runTransaction(
  r: DatabaseReference,
  fn: (current: any) => unknown // eslint-disable-line @typescript-eslint/no-explicit-any -- mirrors RTDB
): Promise<{ committed: boolean; snapshot: DataSnapshot }> {
  let current: unknown = (await get(r)).val();
  for (let attempt = 0; attempt < 25; attempt++) {
    const next = fn(current === undefined ? null : JSON.parse(JSON.stringify(current)));
    if (next === undefined) return { committed: false, snapshot: snapshot(r.path, current) };
    const res = await client.request({ t: 'cas', path: r.path, expected: current, value: next });
    if (res.committed) return { committed: true, snapshot: snapshot(r.path, res.value) };
    current = res.value;
  }
  throw new Error('Transaction failed after repeated conflicts.');
}

export function onDisconnect(r: DatabaseReference) {
  return {
    remove: () => client.setOnDisconnect(r.path, { t: 'ondc', path: r.path, op: 'remove' }),
    set: (value: unknown) => client.setOnDisconnect(r.path, { t: 'ondc', path: r.path, op: 'set', value }),
    cancel: () => client.setOnDisconnect(r.path, null)
  };
}

/** Placeholder the server replaces with its current time (ms). */
export function serverTimestamp(): object {
  return { '.sv': 'timestamp' };
}
