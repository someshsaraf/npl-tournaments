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

Deploy rules so uploads work in production:

```bash
firebase deploy --only storage,database
```

Rule sources in the repo root:

- [`storage.rules`](../../storage.rules)
- [`database.rules.json`](../../database.rules.json)

**Security note:** public create-only writes with MIME/size limits. Total community
gallery storage is capped at **5 GB** (`galleryUploadsMeta/totalBytes`). Anyone with
the site URL can upload within those limits — monitor usage and tighten rules
(auth / PIN) if needed.
