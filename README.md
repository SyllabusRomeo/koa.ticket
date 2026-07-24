# LogIt

Enterprise IT Service Management platform (PRD-aligned). Self-hosted, Docker-first, Hetzner-ready.

## Stack

- **API:** NestJS + Prisma + PostgreSQL
- **Worker:** SLA ticker (Redis-ready)
- **Web:** Next.js (LogIt brand UI)
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
npm run build -w @logit/shared
npm run dev:infra   # postgres + redis only (memory-capped)
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
npm run db:seed
npm run dev:api     # :4100  (skip worker unless testing SLA)
npm run dev:web     # :3100
```

On **16GB Windows** laptops, also cap Docker/WSL RAM — see [SOP-03 Low-memory workstations](docs/sops/03-technical-setup-local.md#low-memory-workstations-16gb-ram) (`infra/wslconfig.example`).

Open http://localhost:3100/login

**Production hostname:** https://logit.koaimpact.app — see [docs/DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md](docs/DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md).

### Dev accounts (seed)

Full table: [docs/sops/03-technical-setup-local.md](docs/sops/03-technical-setup-local.md#seed-accounts-development-only)

| Role | Email | Password |
| --- | --- | --- |
| sysadmin | `admin@logit.local` | `LogIt-Admin-2026!` |
| employee | `employee@logit.local` | `LogIt-Employee-2026!` |
| agent | `agent@logit.local` | `LogIt-Agent-2026!` |
| senior_agent | `senior@logit.local` | `LogIt-Senior-2026!` |
| it_manager | `manager@logit.local` | `LogIt-Manager-2026!` |
| approver | `approver@logit.local` | `LogIt-Approver-2026!` |
| auditor | `auditor@logit.local` | `LogIt-Auditor-2026!` |

## Docker full stack

```bash
docker compose up --build
# http://localhost:8180
```

## Status docs

| Doc | Purpose |
| --- | --- |
| [docs/USER_AND_DEVELOPER_GUIDE.md](docs/USER_AND_DEVELOPER_GUIDE.md) | **Book-style guide** — setup, every use case, developer map, extension (manufacturing+) |
| [docs/GAP_ASSESSMENT.md](docs/GAP_ASSESSMENT.md) | **Shipped vs pending** vs PRD / tech roadmap (through L5) |
| [docs/ENTERPRISE_ROADMAP.md](docs/ENTERPRISE_ROADMAP.md) | Now / polish / Later product phases |
| [docs/DEVELOPMENT_TODO.md](docs/DEVELOPMENT_TODO.md) | Living checklist — N/H/M/L shipped; optional polish |
| [docs/CHANGELOG.md](docs/CHANGELOG.md) | Shipped features summary |
| [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) | Build phases 0–11 checklist |
| [docs/sops/README.md](docs/sops/README.md) | Operator & user SOPs |

## Phases

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).  
Hetzner production: [infra/hetzner/README.md](infra/hetzner/README.md) · TLS/CI: [docs/PRODUCTION.md](docs/PRODUCTION.md) · **NameSilo + Cloudflare + GitHub:** [docs/DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md](docs/DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md).

## SOPs (user & operator guides)

Start at **[docs/USER_AND_DEVELOPER_GUIDE.md](docs/USER_AND_DEVELOPER_GUIDE.md)** for the full book, or **[docs/sops/README.md](docs/sops/README.md)** for individual SOPs — architecture, setup, employee/agent/admin how-tos, SLA, backups, troubleshooting, API map.

## Brand

LogIt — primary `#0F4A40`, light `#EDF4AC`, secondary `#456433`, warm `#FBF1DA`.
