import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import express, { type Request, type Response } from 'express';
import authHandler from '../api/auth.js';
import askHandler from '../api/ask.js';
import galleryUploadUrlHandler from '../api/gallery-upload-url.js';
import galleryDeleteHandler from '../api/gallery-delete.js';
import snapshotUploadUrlHandler from '../api/snapshot-upload-url.js';
import youtubeRecordingsHandler from '../api/youtube-recordings.js';
import { getAccessSession, getAdminSession } from '../api/_lib/session.js';
import { getStore } from './store.js';
import { attachRealtime } from './realtime.js';
import { mediaDir, receiveLocalUpload } from './media.js';
import { runImport } from './importFirebase.js';

/**
 * Self-hosted server: serves the built site (dist/), the /api routes,
 * uploaded media (/media) and live data (/ws) from one port. Runs on any
 * Node 22+ host or in Docker — see README.md.
 *
 *   node dist-server/index.js                 start
 *   node dist-server/index.js import <file>   load a Firebase RTDB JSON export
 */

if (existsSync('.env')) process.loadEnvFile('.env');

if (process.argv[2] === 'import') {
  await runImport(process.argv.slice(3));
  process.exit(0);
}

const PORT = Number(process.env.PORT) || 8787;
const STATIC_DIR = resolve(process.env.STATIC_DIR || 'dist');

const secret = process.env.AUTH_JWT_SECRET?.trim() ?? '';
if (secret.length < 16) {
  console.error('AUTH_JWT_SECRET must be set (16+ chars). Copy .env.example to .env and fill it in.');
  process.exit(1);
}

// Catch the common .env mistakes at startup instead of at the login screen.
{
  const community = process.env.COMMUNITY_ACCESS_CODE?.trim() ?? '';
  if (community && (community.length < 6 || community.length > 64 || /[#'"\n]/.test(community))) {
    console.warn(
      `⚠ COMMUNITY_ACCESS_CODE looks wrong (${community.length} chars${/[#'"\n]/.test(community) ? ', contains a quote/# — an unclosed quote in .env?' : ''}). It must be 6–64 characters.`
    );
  } else if (!community) {
    console.warn('⚠ COMMUNITY_ACCESS_CODE is empty — set it in .env, or set a code at /admin/access.');
  }
  const adminHash = (process.env.ADMIN_CODE_HASH || process.env.ADMIN_PASSWORD_HASH || '').trim();
  if (!/^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/.test(adminHash)) {
    console.warn('⚠ ADMIN_CODE_HASH is missing or malformed — run: node scripts/hash-admin-password.mjs --generate');
  }
}

const app = express();
app.disable('x-powered-by');
// Behind a reverse proxy (Caddy/nginx/Traefik) set TRUST_PROXY=true so
// HTTPS is detected for Secure cookies. Default trusts local/private proxies.
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? true : 'loopback, linklocal, uniquelocal');

type Handler = (req: Request, res: Response) => unknown;
const api = (handler: Handler) => async (req: Request, res: Response) => {
  try {
    await handler(req, res);
  } catch (err) {
    console.error(`${req.method} ${req.path} failed:`, err);
    if (!res.headersSent) res.status(500).json({ error: 'Server error.' });
  }
};

app.get('/healthz', (_req, res) => {
  res.json({ ok: true });
});

// Raw file uploads (local media storage) — must come before the JSON parser.
app.put('/api/uploads/:token', async (req, res) => {
  const { status, error } = await receiveLocalUpload(String(req.params.token), req);
  res.status(status).json(error ? { error } : { ok: true });
});

/** Community or admin code required (photos, recordings, Ask). */
const requireAccess = async (req: Request, res: Response, next: () => void) => {
  const [access, admin] = await Promise.all([getAccessSession(req), getAdminSession(req)]);
  if (access || admin) return next();
  res.status(401).json({ error: 'Enter the community access code first.' });
};

app.use('/api', express.json({ limit: '256kb' }));
app.all('/api/auth/:action', api(authHandler));
app.all('/api/ask', requireAccess, api(askHandler));
app.all('/api/gallery-upload-url', api(galleryUploadUrlHandler));
app.all('/api/gallery-delete', api(galleryDeleteHandler));
app.all('/api/snapshot-upload-url', api(snapshotUploadUrlHandler));
app.all('/api/youtube-recordings', requireAccess, api(youtubeRecordingsHandler));
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(
  '/media',
  requireAccess,
  express.static(mediaDir(), {
    immutable: true,
    maxAge: '365d',
    fallthrough: false,
    setHeaders: (res) => res.setHeader('X-Content-Type-Options', 'nosniff')
  })
);

// Built site + single-page-app fallback.
if (existsSync(STATIC_DIR)) {
  app.use(express.static(STATIC_DIR, { index: false, maxAge: '1h' }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(resolve(STATIC_DIR, 'index.html'));
  });
} else {
  console.warn(`No built site at ${STATIC_DIR} — API and /ws only (use "npm run dev" for the UI).`);
}

const server = createServer(app);
attachRealtime(server, getStore(), async (req) => {
  const [access, admin] = await Promise.all([getAccessSession(req), getAdminSession(req)]);
  return { uid: access?.sid ?? null, admin: !!admin };
});

server.listen(PORT, () => {
  console.log(`NPL server on http://localhost:${PORT} (data: ${resolve(process.env.DATA_DIR || './data')})`);
});
