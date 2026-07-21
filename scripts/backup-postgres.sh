#!/usr/bin/env sh
set -eu

STAMP=$(date -u +%Y%m%dT%H%M%SZ)
OUT_DIR=${BACKUP_DIR:-./backups}
mkdir -p "$OUT_DIR"

FILE="$OUT_DIR/logit-postgres-$STAMP.sql.gz"

echo "Backing up LogIT Postgres to $FILE"
docker compose exec -T postgres pg_dump -U "${POSTGRES_USER:-logit}" "${POSTGRES_DB:-logit}" | gzip > "$FILE"
echo "Done."
