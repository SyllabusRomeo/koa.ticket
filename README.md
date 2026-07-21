# LogIT

Enterprise IT Service Management platform (PRD-aligned). Self-hosted, Docker-first, Hetzner-ready.

## Stack

- **API:** NestJS + Prisma + PostgreSQL
- **Worker:** SLA ticker (Redis-ready)
- **Web:** Next.js (LogIT brand UI)
- **Edge:** Nginx reverse proxy

## Local ports

| Service | Port |
| --- | --- |
| Web | **3100** |
| API | **4100** |
| Nginx (compose) | **8180** |
| Postgres (host) | **15432** |

## Quick start (local)

```bash
cp .env.example .env
npm install
docker compose up -d postgres redis
npm run build -w @logit/shared
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
npm run db:seed
npm run dev:api    # :4100
npm run dev:web    # :3100
npm run dev:worker # optional SLA worker
```

Open http://localhost:3100/login

### Dev accounts (seed)

- Admin: `admin@logit.local` / `LogIT-Admin-2026!`
- Employee: `employee@logit.local` / `LogIT-Employee-2026!`

## Docker full stack

```bash
docker compose up --build
# http://localhost:8180
```

## Phases

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).  
Hetzner production: [infra/hetzner/README.md](infra/hetzner/README.md).

## Brand

LogIT — primary `#0F4A40`, light `#EDF4AC`, secondary `#456433`, warm `#FBF1DA`.
