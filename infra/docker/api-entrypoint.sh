#!/bin/sh
# Build a Prisma-safe DATABASE_URL (URL-encode password special chars like + / =).
set -eu

USER="${POSTGRES_USER:-logit}"
PASS="${POSTGRES_PASSWORD:-change_me_strong_password}"
DB="${POSTGRES_DB:-logit}"
HOST="${POSTGRES_HOST:-postgres}"
PORT="${POSTGRES_PORT:-5432}"

ENCODED_PASS="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$PASS")"
export DATABASE_URL="postgresql://${USER}:${ENCODED_PASS}@${HOST}:${PORT}/${DB}?schema=public"

npx prisma migrate deploy
exec node dist/main.js
