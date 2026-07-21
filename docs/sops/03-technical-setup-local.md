# SOP-03 — Technical Setup (Local Development)

## Purpose

Stand up LogIT on a developer workstation for coding and demos.

## Prerequisites

- Node.js **20+** (22 recommended)
- npm 10+
- Docker Desktop (for Postgres + Redis)
- Git
- Ports free: **3100** (web), **4100** (API), **15432** (Postgres host map), **6379** (Redis)

> Note: Web/API intentionally avoid 3000/4000 to reduce clashes with other apps.

## Procedure

### 1. Clone and enter repo

```bash
git clone https://github.com/SyllabusRomeo/koa.ticket.git
cd koa.ticket
```

### 2. Environment file

```bash
cp .env.example .env
```

Confirm at least:

- `WEB_PORT=3100`
- `API_PORT=4100` / `PORT=4100`
- `DATABASE_URL=...127.0.0.1:15432...`
- `REDIS_URL=redis://127.0.0.1:6379`
- `WEB_ORIGIN=http://localhost:3100,http://127.0.0.1:3100`
- `UPLOAD_DIR=./data/uploads`

Web client env (already typical):

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4100/api/v1
```

### 3. Install dependencies

```bash
npm install
npm run build -w @logit/shared
```

### 4. Start data services

```bash
docker compose up -d postgres redis
```

Wait until both are healthy (`docker compose ps`).

### 5. Migrate and seed

```bash
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
npm run db:seed
```

Seed creates roles, permissions, sample org (Accra HQ), SLA, categories, demo users, sample KB/catalog/asset.

### 6. Run application processes

In separate terminals:

```bash
npm run dev:api      # http://localhost:4100
npm run dev:web      # http://localhost:3100
npm run dev:worker   # SLA background tick (recommended)
```

### 7. Verify

1. Open http://localhost:4100/health/ready — expect `database: up`, `redis: up`
2. Open http://localhost:3100/login
3. Sign in with seed admin or employee (see below)

## Seed accounts (development only)

| Name | Email | Password | Role | What they can access |
| --- | --- | --- | --- | --- |
| System Administrator | `admin@logit.local` | `LogIT-Admin-2026!` | `sysadmin` | Full platform (users, org, SLA, settings, all tickets) |
| Ama Mensah | `employee@logit.local` | `LogIT-Employee-2026!` | `employee` | Own tickets, create tickets, knowledge, catalog |
| Kojo Asante | `agent@logit.local` | `LogIT-Agent-2026!` | `agent` | Queue tickets, assign, internal notes, assets read, Service Desk |
| Efua Boateng | `senior@logit.local` | `LogIT-Senior-2026!` | `senior_agent` | Agent + knowledge/asset write, escalations |
| Yaw Osei | `manager@logit.local` | `LogIT-Manager-2026!` | `it_manager` | All tickets, reports, audit read, org manage, Service Desk lead |
| Akosua Addo | `approver@logit.local` | `LogIT-Approver-2026!` | `approver` | Own tickets + knowledge (approvals expand later); OPS dept |
| Nana Owusu | `auditor@logit.local` | `LogIT-Auditor-2026!` | `auditor` | Audit, reports, tickets/assets read-focused |

Re-seed anytime with `npm run db:seed` (idempotent upserts).

**Never use these credentials in production.** Full capability map: [SOP-06](./06-roles-and-permissions.md).

## Common local failures

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Prisma auth failed on 5432 | Windows Postgres conflict | Use host port **15432** (default in compose) |
| API cannot reach DB | Docker not running | Start Docker Desktop, then `docker compose up -d postgres redis` |
| CORS / cookie login fails | Wrong `WEB_ORIGIN` or API URL | Match ports 3100↔4100 in `.env` and `apps/web/.env.local` |
| Prisma generate EPERM on Windows | API process locking DLL | Stop API/worker, regenerate, restart |

## Related SOPs

- [04 Docker deployment](./04-docker-deployment.md)
- [18 Troubleshooting](./18-troubleshooting.md)
- [20 Change and release](./20-change-and-release.md)
