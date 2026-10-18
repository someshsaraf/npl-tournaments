import type { IncomingMessage, Server } from 'node:http';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { normalize, splitPath, type Json, type Store } from './store.js';
import { canRead, checkWrite, type Principal } from './rules.js';

/**
 * Live data over one WebSocket per tab (path /ws) — what Firebase RTDB's
 * SDK used to do. Protocol (JSON messages):
 *
 *   client → server
 *     { t:'sub',    id, path }               subscribe; server replies with 'val' now and on change
 *     { t:'unsub',  id }
 *     { t:'get',    rid, path }
 *     { t:'set',    rid, path, value }
 *     { t:'update', rid, path, value:{ "rel/path": v, … } }
 *     { t:'cas',    rid, path, expected, value }   compare-and-set (client transactions)
 *     { t:'ondc',   rid, path, op:'set'|'remove'|'cancel', value? }   run when this socket closes
 *   server → client
 *     { t:'val', id, value }
 *     { t:'res', rid, ok:true, value?, committed? } | { t:'res', rid, ok:false, error }
 *
 * Access comes from the pass cookies on the upgrade request (community
 * and/or admin code); unlocking/locking makes the client reconnect.
 */

type Sub = { segs: string[]; path: string; last: string | null };
type OnDisconnect = { op: 'set' | 'remove'; value?: unknown };

interface Conn {
  ws: WebSocket;
  who: Principal;
  subs: Map<string, Sub>;
  ondc: Map<string, OnDisconnect>;
  alive: boolean;
}

const MAX_MESSAGE_BYTES = 1024 * 1024;

function related(a: string[], b: string[]): boolean {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function attachRealtime(
  server: Server,
  store: Store,
  identify: (req: IncomingMessage) => Promise<Principal>
): void {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });
  const conns = new Set<Conn>();

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', 'http://x');
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    identify(req)
      .catch(() => ({ uid: null, admin: false }))
      .then((who) => {
        wss.handleUpgrade(req, socket, head, (ws) => onConnection(ws, who));
      });
  });

  const send = (c: Conn, msg: unknown) => {
    if (c.ws.readyState === WebSocket.OPEN) c.ws.send(JSON.stringify(msg));
  };

  const pushSub = (c: Conn, id: string, sub: Sub) => {
    const json = JSON.stringify(store.get(sub.path));
    if (json === sub.last) return;
    sub.last = json;
    c.ws.send(`{"t":"val","id":${JSON.stringify(id)},"value":${json}}`);
  };

  store.onChange((paths) => {
    const written = paths.map((p) => splitPath(p));
    for (const c of conns) {
      for (const [id, sub] of c.subs) {
        if (written.some((w) => related(w, sub.segs))) pushSub(c, id, sub);
      }
    }
  });

  function write(c: Conn, path: string, value: unknown): void {
    const segs = splitPath(path);
    const err = checkWrite(c.who, segs, store.get(path), normalize(value));
    if (err) throw new Error(err);
    store.set(path, value);
  }

  function handle(c: Conn, msg: Record<string, unknown>): unknown {
    const path = typeof msg.path === 'string' ? msg.path : '';
    switch (msg.t) {
      case 'sub': {
        const id = String(msg.id);
        const segs = splitPath(path);
        if (!canRead(c.who, segs)) throw new Error('Permission denied.');
        const sub: Sub = { segs, path, last: null };
        c.subs.set(id, sub);
        pushSub(c, id, sub);
        return undefined;
      }
      case 'unsub':
        c.subs.delete(String(msg.id));
        return undefined;
      case 'get': {
        if (!canRead(c.who, splitPath(path))) throw new Error('Permission denied.');
        return { value: store.get(path) };
      }
      case 'set':
        write(c, path, msg.value);
        return {};
      case 'update': {
        const values = msg.value;
        if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error('update needs an object.');
        const base = splitPath(path);
        for (const [k, v] of Object.entries(values as Record<string, unknown>)) {
          const full = [...base, ...splitPath(k)].join('/');
          const err = checkWrite(c.who, splitPath(full), store.get(full), normalize(v));
          if (err) throw new Error(err);
        }
        store.update(path, values as Record<string, unknown>);
        return {};
      }
      case 'cas': {
        const segs = splitPath(path);
        const current = store.get(path);
        if (JSON.stringify(current) !== JSON.stringify(normalize(msg.expected))) {
          return { committed: false, value: current };
        }
        const err = checkWrite(c.who, segs, current, normalize(msg.value));
        if (err) throw new Error(err);
        store.set(path, msg.value);
        return { committed: true, value: store.get(path) };
      }
      case 'ondc': {
        const segs = splitPath(path);
        if (msg.op === 'cancel') {
          c.ondc.delete(path);
          return {};
        }
        const after = msg.op === 'remove' ? null : normalize(msg.value);
        const err = checkWrite(c.who, segs, store.get(path), after);
        if (err) throw new Error(err);
        c.ondc.set(path, msg.op === 'remove' ? { op: 'remove' } : { op: 'set', value: msg.value });
        return {};
      }
      default:
        throw new Error('Unknown message.');
    }
  }

  function onConnection(ws: WebSocket, who: Principal): void {
    const c: Conn = { ws, who, subs: new Map(), ondc: new Map(), alive: true };
    conns.add(c);
    ws.on('pong', () => {
      c.alive = true;
    });
    ws.on('message', (raw: RawData) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString()) as Record<string, unknown>;
      } catch {
        return;
      }
      const rid = msg.rid;
      try {
        const result = handle(c, msg);
        if (rid !== undefined) send(c, { t: 'res', rid, ok: true, ...(result as object) });
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Request failed.';
        if (rid !== undefined) send(c, { t: 'res', rid, ok: false, error });
        else if (msg.t === 'sub') send(c, { t: 'err', id: msg.id, error });
      }
    });
    ws.on('close', () => {
      conns.delete(c);
      for (const [path, action] of c.ondc) {
        try {
          store.set(path, action.op === 'remove' ? null : (action.value as Json));
        } catch (err) {
          console.error('onDisconnect action failed:', err);
        }
      }
    });
  }

  // Drop sockets that stopped answering pings (closed laptops, lost Wi-Fi) so
  // their onDisconnect cleanup runs.
  const interval = setInterval(() => {
    for (const c of conns) {
      if (!c.alive) {
        c.ws.terminate();
        continue;
      }
      c.alive = false;
      c.ws.ping();
    }
  }, 30_000);
  server.on('close', () => clearInterval(interval));
}
