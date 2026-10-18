#!/usr/bin/env bash
# Backups for the production server (runs nightly from cron; or `deploy/npl backup`).
#
#   Every run:  npl-db-<time>.db.gz     database snapshot (small) — keeps 30
#   Sundays, or when none exists yet:
#               npl-full-<time>.tar.gz  database + all photos/videos — keeps 2
#
# The snapshot is taken with SQLite's VACUUM INTO inside the running app, so
# it is consistent without stopping the site. Backups live on the same VM —
# also download one regularly (see deploy/HOSTING.md) in case the VM is lost.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEST="${BACKUP_DIR:-/var/backups/npl}"
KEEP_DB="${BACKUP_KEEP_DB:-30}"
KEEP_FULL="${BACKUP_KEEP_FULL:-2}"
stamp="$(date +%Y%m%d-%H%M%S)"

compose() {
  docker compose -p npl -f "$ROOT/deploy/docker-compose.yml" --env-file "$ROOT/.env" "$@"
}

mkdir -p "$DEST"
chmod 700 "$DEST"

if [ ! -f "$ROOT/data/app.db" ]; then
  echo "No database yet — nothing to back up."
  exit 0
fi

# Consistent snapshot from inside the running app container.
rm -f "$ROOT/data/app-snapshot.db"
compose exec -T npl node --no-warnings -e "
  const { DatabaseSync } = require('node:sqlite');
  new DatabaseSync('/data/app.db').exec(\"VACUUM INTO '/data/app-snapshot.db'\");
"

gzip -c "$ROOT/data/app-snapshot.db" > "$DEST/npl-db-$stamp.db.gz.part"
mv "$DEST/npl-db-$stamp.db.gz.part" "$DEST/npl-db-$stamp.db.gz"

if [ "$(date +%u)" = "7" ] || ! ls "$DEST"/npl-full-*.tar.gz >/dev/null 2>&1; then
  members=(app-snapshot.db)
  [ -d "$ROOT/data/media" ] && members+=(media)
  tar -czf "$DEST/npl-full-$stamp.tar.gz.part" -C "$ROOT/data" "${members[@]}"
  mv "$DEST/npl-full-$stamp.tar.gz.part" "$DEST/npl-full-$stamp.tar.gz"
  echo "Full backup: $DEST/npl-full-$stamp.tar.gz"
fi
rm -f "$ROOT/data/app-snapshot.db"

# Retention (newest first; delete the rest).
ls -1t "$DEST"/npl-db-*.db.gz 2>/dev/null | tail -n +"$((KEEP_DB + 1))" | xargs -r rm -f
ls -1t "$DEST"/npl-full-*.tar.gz 2>/dev/null | tail -n +"$((KEEP_FULL + 1))" | xargs -r rm -f

echo "Database backup: $DEST/npl-db-$stamp.db.gz"
