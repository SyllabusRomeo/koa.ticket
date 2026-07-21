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

Full table: [docs/sops/03-technical-setup-local.md](docs/sops/03-technical-setup-local.md#seed-accounts-development-only)

| Role | Email | Password |
| --- | --- | --- |
| sysadmin | `admin@logit.local` | `LogIT-Admin-2026!` |
| employee | `employee@logit.local` | `LogIT-Employee-2026!` |
| agent | `agent@logit.local` | `LogIT-Agent-2026!` |
| senior_agent | `senior@logit.local` | `LogIT-Senior-2026!` |
| it_manager | `manager@logit.local` | `LogIT-Manager-2026!` |
| approver | `approver@logit.local` | `LogIT-Approver-2026!` |
| auditor | `auditor@logit.local` | `LogIT-Auditor-2026!` |

## Docker full stack

```bash
docker compose up --build
# http://localhost:8180
```

## Status docs

| Doc | Purpose |
| --- | --- |
| [docs/GAP_ASSESSMENT.md](docs/GAP_ASSESSMENT.md) | **Shipped vs pending** vs PRD / tech roadmap |
| [docs/ENTERPRISE_ROADMAP.md](docs/ENTERPRISE_ROADMAP.md) | Now / Next / Later product phases |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Build phases 0–11 checklist |
| [docs/sops/README.md](docs/sops/README.md) | Operator & user SOPs |

## Phases

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).  
Hetzner production: [infra/hetzner/README.md](infra/hetzner/README.md).

## SOPs (user & operator guides)

Start at **[docs/sops/README.md](docs/sops/README.md)** — architecture, setup, employee/agent/admin how-tos, SLA, backups, troubleshooting, API map.

## Brand

LogIT — primary `#0F4A40`, light `#EDF4AC`, secondary `#456433`, warm `#FBF1DA`.
