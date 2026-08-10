# Match / event gallery (images + short videos)

## Curated (static)

Drop files into this folder, then run:

```bash
npm run gallery:manifest
```

Or just `npm run build` / `npm run dev` (manifest regenerates automatically).

**Allowed:** `.jpg` `.jpeg` `.png` `.webp` `.gif` `.mp4` `.webm`

Prefer year folders so the Photos page can show season tabs (`npl-2023` … `npl-2026`):

```text
public/Gallery/2026/Photo-1.jpeg
public/Gallery/2025/…
```

Flat files directly in `public/Gallery/` are still supported and tagged as **2026**.
Do not nest folders other than a 4-digit year.

Community uploads must choose a season tag: `npl-2026`, `npl-2025`, `npl-2024`, or `npl-2023`.
Photos are filtered by that tag on the year tabs.

## Community uploads (Cloudflare R2 + Realtime Database)

Visitors upload from `/photos`:

1. Browser asks `/api/gallery-upload-url` for a **presigned PUT** (Vercel serverless).
2. File goes **directly to Cloudflare R2** (`gallery/{id}/…`).
3. Metadata + 5 GB quota counter stay in **Firebase RTDB** (`galleryUploads`, `galleryUploadsMeta`).

### Cloudflare setup

1. Create an R2 bucket (e.g. `npl-gallery`).
2. Enable public access: **R2.dev subdomain** or a custom domain.  
   Set `R2_PUBLIC_BASE_URL` to that base (no trailing slash), e.g. `https://pub-xxxxx.r2.dev`.
3. Create an **R2 API token** with Object Read & Write on that bucket.  
   Copy Account ID, Access Key ID, Secret Access Key.
4. In the bucket **Settings → CORS**, allow your site to PUT:

```json
[
  {
    "AllowedOrigins": [
      "https://npl-tournaments.vercel.app",
      "http://localhost:5173",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### Vercel env vars

Set (Production + Preview):

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`
- `R2_PUBLIC_BASE_URL`

Redeploy after saving env vars. Locally use `npx vercel dev`.

### RTDB rules

Still deploy database rules for metadata/quota:

```bash
firebase deploy --only database
```

Firebase **Storage** is not required for gallery uploads (R2 holds the files).

**Security note:** public uploads with MIME allowlist and a shared **5 GB** RTDB quota (no per-file size cap).
Monitor R2 usage; tighten later (PIN / auth) if needed.
