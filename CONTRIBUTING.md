# Contributing

Thanks for helping! Anyone can propose a change; the maintainer reviews and
merges. Nobody else can push to this repository directly.

## How to send a change

1. **Fork** the repository on GitHub and clone your fork.
2. Create a branch: `git checkout -b my-change`.
3. Set up and run it locally — see [Run it locally](README.md#run-it-locally).
4. Before opening a pull request, make sure these pass:
   ```bash
   npm run build      # type-checks the site and server, then builds
   npm run lint
   ```
5. Push to your fork and open a **pull request** against `main`. Describe
   what changed and how you tested it (screenshots help for UI changes).

For anything bigger than a small fix, open an issue first so we can agree on
the approach.

## Keep it generic

This code is meant to work for any residential community.

- **No community names, logos or addresses in code.** The name comes from
  `SOCIETY_NAME` / `SOCIETY_SHORT_NAME` / `LEAGUE_NAME` in `.env` (`SITE` in
  `src/lib/site.ts`).
- **No photos or videos in the repo.** Admins upload them on the Photos page
  and pick the site's images there. `.gitignore` blocks image files.
- **No personal data** — no resident names, phone numbers, flat/villa
  numbers, registration exports or real match rosters, including in tests,
  fixtures, screenshots and docs. Use made-up names like "Player A".
- **No secrets.** Never commit `.env`, API keys or service-account files.
- **No platform lock-in.** The app must keep running on any Node 22+ host or
  Docker, without vendor SDKs.

## Privacy by design

The site has no user accounts: one shared community code, one admin code.
New features should collect as little as possible, keep anything that
identifies a household admin-only (see `server/rules.ts`), and show
residents only counts.

## Reporting security issues

Please don't open a public issue for security problems — contact the
maintainer through GitHub privately (Security → Report a vulnerability).
