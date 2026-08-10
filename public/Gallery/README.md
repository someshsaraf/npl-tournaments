# Match / event gallery (images + short videos)

## Curated (static)

Drop files into this folder, then run:

```bash
npm run gallery:manifest
```

Or just `npm run build` / `npm run dev` (manifest regenerates automatically).

**Allowed:** `.jpg` `.jpeg` `.png` `.webp` `.gif` `.mp4` `.webm`

Do not put nested folders here — keep files flat in `public/Gallery/`.

## Community uploads (Photos page)

Visitors can upload from `/photos`. Files go to Firebase Storage `gallery/{id}/…`
and metadata to RTDB `galleryUploads/{id}`.

### 1) Deploy Storage + RTDB rules

```bash
firebase deploy --only storage,database
```

Rule sources in the repo root:

- [`storage.rules`](../../storage.rules)
- [`database.rules.json`](../../database.rules.json)

If rules are not deployed, browsers often report a **CORS** error on upload even though the real issue is a 403 from Storage.

### 2) Allow browser CORS on the Storage bucket (required for Vercel)

Firebase Storage buckets do **not** allow `https://npl-tournaments.vercel.app` until you set CORS once:

```bash
# Needs Google Cloud SDK (gsutil) logged into the same GCP project
gsutil cors set storage-cors.json gs://npl-tournaments.firebasestorage.app

# Verify
gsutil cors get gs://npl-tournaments.firebasestorage.app
```

Config file: [`storage-cors.json`](../../storage-cors.json)

If your bucket still uses the older name, try:

```bash
gsutil cors set storage-cors.json gs://npl-tournaments.appspot.com
```

**Security note:** public create-only writes with MIME/size limits. Total community
gallery storage is capped at **5 GB** (`galleryUploadsMeta/totalBytes`). Anyone with
the site URL can upload within those limits — monitor usage and tighten rules
(auth / PIN) if needed.
