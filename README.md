# Renaissance Nature Walk · Sports

Tournament portal for the Renaissance Nature Walk community: Badminton, Lawn
Tennis (Table Tennis coming soon). Residents follow schedules, live scores,
streams, recordings and photos; staff build schedules and score matches;
court screens show big live scores.

It's one self-contained Node app — no Firebase, no Vercel, no external
database. Host it anywhere that runs **Node 22.13+** or **Docker**.

```
browser ──HTTP──▶  server (Node)  ──▶  data/app.db      (SQLite: results, schedules, settings…)
        ◀──WS───   /ws  live data       data/media/…    (photos, videos, score snapshots)
                   /api access codes, uploads, YouTube, Ask
                   /    the built site
```

## Run it locally

```bash
npm install
cp .env.example .env
#   fill AUTH_JWT_SECRET and AUTH_PEPPER (openssl rand -hex 32 for each)
#   and pick a COMMUNITY_ACCESS_CODE, then make the admin code:
node scripts/hash-admin-password.mjs --generate
#   note the printed code; paste the ADMIN_CODE_HASH='…' line into .env
npm run dev
```

Open http://localhost:5173. `npm run dev` starts the API/live-data server
(port 8787) and Vite (hot reload) together; data goes to `./data`.

- Residents and court screens: enter the **community access code** once per
  device (it stays unlocked for 180 days). Court screens: `/score/lawn-tennis`,
  `/live/lawn-tennis`.
- Staff: `/admin/login` with the **admin code** — admin pages, score desk and
  the scorer tablet (`/scorer/lawn-tennis`).
- Change the community code any time at `/admin/access` (signs every device
  out). The admin code is fixed in `.env`; re-run the script to replace it.

There are no individual accounts — no names, emails or phone numbers are
collected. A device that uploads a photo gets a random id so it can delete
its own upload; it isn't linked to a person.

To try a production build locally: `npm run preview` → http://localhost:8787.

## Host it

**Recommended: a small Ubuntu server (AWS EC2 or Oracle Cloud) + a free
DuckDNS address** — step-by-step guide and one-command setup in
[deploy/HOSTING.md](deploy/HOSTING.md) (`sudo ./deploy/setup.sh`, then
`./deploy/npl` for updates, backups and restores).

The options below are for running it some other way.


### Docker (any VPS, home server, NAS, Fly, Railway, Render…)

```bash
cp .env.example .env   # fill it in as above
docker compose up -d   # → http://<host>:8787
```

The database and uploads live in `./data` on the host. On Linux the
container runs as uid 1000, so make sure it can write there
(`mkdir -p data && sudo chown 1000:1000 data`).

### Plain Node

```bash
npm ci && npm run build
NODE_ENV=production npm start      # reads .env; PORT defaults to 8787
```

Keep it running with systemd, pm2, or your platform's process manager.

### HTTPS

Put any reverse proxy in front (Caddy is the least work) and set
`TRUST_PROXY=true` in `.env` so access passes get secure cookies:

```
# Caddyfile
sports.example.com {
  reverse_proxy localhost:8787
}
```

The proxy must pass WebSockets through (`/ws`) — Caddy does by default; for
nginx add the usual `Upgrade`/`Connection` headers.

Platforms with ephemeral disks (Render free tier, Heroku…) need a persistent
volume mounted at `DATA_DIR`, or the database is lost on redeploy.

## Back up

Everything is in `DATA_DIR` (default `./data`):

- `app.db` (+ `app.db-wal`) — copy while the server is stopped, or use
  `sqlite3 data/app.db ".backup backup.db"` while it runs.
- `media/` — uploaded photos, videos and score snapshots.

## Media storage

Default `MEDIA_STORAGE=local` keeps files on the server's disk. For big
galleries, `MEDIA_STORAGE=s3` stores them in any S3-compatible bucket (AWS
S3, Cloudflare R2, MinIO, Backblaze B2) — set the `S3_*` variables in
`.env`. The bucket must be publicly readable and allow `PUT` from your site's
origin (CORS).

## Moving from the old Firebase deployment

1. Firebase console → Realtime Database → ⋮ → **Export JSON**.
2. Fill in `.env` as above (new secrets are fine — nothing from the old
   deployment's accounts is reused).
3. Import (server stopped):
   ```bash
   npm run import -- ./npl-tournaments-export.json
   # with Docker: docker compose run --rm npl node dist-server/index.js import /data/export.json
   ```
   - Results, teams, schedules, settings and gallery records are copied
     (old resident accounts are deliberately left behind); score snapshots are downloaded from Firebase Storage to
     `data/media`.
   - Add `--download-gallery` to also copy community photos off R2 to local
     disk. Without it they stay on R2 (keep `MEDIA_STORAGE=s3` with the R2
     settings so deletes work).
   - `--replace` overwrites a database that already has data.

## Who can change what

Enforced by the server (`server/rules.ts`):

| Data | Read | Write |
|---|---|---|
| Access-code hashes | server only | server only (staff change it via `/admin/access`) |
| Scores, schedules, results, teams, settings | community or admin code | admin code |
| Gallery photos | community or admin code | community code (add; delete own device's) — admin code: any |
| Live viewer count | community or admin code | own entry |

## Project layout

- `src/` — React app. `src/lib/realtime.ts` is the live-data client;
  `src/db.ts` lists the data paths.
- `server/` — Node server: `store.ts` (SQLite-backed data tree),
  `realtime.ts` (WebSocket), `rules.ts` (permissions), `media.ts` (uploads),
  `importFirebase.ts` (migration).
- `api/` — HTTP endpoints (auth, uploads, YouTube recordings, Ask).

Scripts: `npm run dev`, `npm run build`, `npm start`, `npm run lint`,
`npm run import -- <export.json>`.
