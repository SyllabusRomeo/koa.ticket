#!/bin/sh
# Build a Prisma-safe DATABASE_URL for the worker (URL-encode password).
set -eu

USER="${POSTGRES_USER:-logit}"
PASS="${POSTGRES_PASSWORD:-change_me_strong_password}"
DB="${POSTGRES_DB:-logit}"
HOST="${POSTGRES_HOST:-postgres}"
PGPORT="${POSTGRES_PORT:-5432}"

ENCODED_PASS="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$PASS")"
export DATABASE_URL="postgresql://${USER}:${ENCODED_PASS}@${HOST}:${PGPORT}/${DB}?schema=public"

exec node dist/main.js
