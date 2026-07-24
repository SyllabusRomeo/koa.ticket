#!/bin/sh
# Build a Prisma-safe DATABASE_URL (URL-encode password special chars like + / =).
set -eu

USER="${POSTGRES_USER:-logit}"
PASS="${POSTGRES_PASSWORD:-change_me_strong_password}"
DB="${POSTGRES_DB:-logit}"
HOST="${POSTGRES_HOST:-postgres}"
PGPORT="${POSTGRES_PORT:-5432}"

ENCODED_PASS="$(node -e 'process.stdout.write(encodeURIComponent(process.argv[1]))' "$PASS")"
export DATABASE_URL="postgresql://${USER}:${ENCODED_PASS}@${HOST}:${PGPORT}/${DB}?schema=public"

# HTTP listen port — never reuse PGPORT (assignment to PORT would clobber compose PORT=4000)
export API_PORT="${API_PORT:-4000}"
export PORT="${API_PORT}"

npx prisma migrate deploy
exec node dist/main.js
