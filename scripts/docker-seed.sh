#!/usr/bin/env bash
# Seed the running API container DB (rebuilds DATABASE_URL like the entrypoint).
# Usage: ./scripts/docker-seed.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.yml -f docker-compose.prod.yml)

"${COMPOSE[@]}" exec -T api sh -c '
set -eu
USER="${POSTGRES_USER:-logit}"
PASS="${POSTGRES_PASSWORD:-change_me_strong_password}"
DB="${POSTGRES_DB:-logit}"
HOST="${POSTGRES_HOST:-postgres}"
PGPORT="${POSTGRES_PORT:-5432}"
ENCODED_PASS="$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$PASS")"
export DATABASE_URL="postgresql://${USER}:${ENCODED_PASS}@${HOST}:${PGPORT}/${DB}?schema=public"
npx tsx prisma/seed.ts
'
