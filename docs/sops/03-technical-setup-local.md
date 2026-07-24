# SOP-03 — Technical Setup (Local Development)

## Purpose

Stand up LogIt on a developer workstation for coding and demos.

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
npm run dev:infra
# same as: docker compose up -d postgres redis
```

Wait until both are healthy (`docker compose ps`).

### 5. Migrate and seed

```bash
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
npm run db:seed
```

Seed creates roles, permissions, sample org (Accra HQ), SLA, categories, demo users, sample KB/catalog/asset.

### 6. Run application processes

In separate terminals (do **not** use root `npm run dev` unless you need API + web + worker together — that triples Node memory):

```bash
npm run dev:api      # http://localhost:4100  (~512MB heap cap)
npm run dev:web      # http://localhost:3100  (~768MB heap cap, Turbopack)
npm run dev:worker   # optional — only when testing SLA ticks
```

### Low-memory workstations (16GB RAM)

On a typical Windows laptop, **Docker Desktop / WSL2** is the largest controllable cost (often 1.5–4GB+). Postgres + Redis themselves are small (~50–100MB).

1. **Cap WSL2 RAM** (recommended on ≤16GB machines):

   ```powershell
   copy infra\wslconfig.example $env:USERPROFILE\.wslconfig
   wsl --shutdown
   ```

   Then start Docker Desktop again and `npm run dev:infra`.

2. **Compose already caps** Postgres (~256MB) and Redis (~96MB / `maxmemory 64mb`). Override with `POSTGRES_MEM_LIMIT` / `REDIS_MEM_LIMIT` / `REDIS_MAXMEMORY` in `.env` if needed.

3. **Skip the worker** unless you need SLA background jobs.

4. **Avoid full `docker compose up`** for day-to-day coding — that also builds/runs API, web, nginx inside Docker on top of local Node.

### 7. Verify

1. Open http://localhost:4100/health/ready — expect `database: up`, `redis: up`
2. Open http://localhost:3100/login
3. Sign in with seed admin or employee (see below)

## Seed accounts (development only)

| Name | Email | Password | Role | What they can access |
| --- | --- | --- | --- | --- |
| Administrator | `admin@logit.local` | `LogIt-Admin-2026!` | `sysadmin` | Full platform (users, org, SLA, settings, all tickets) |
| Ama Mensah | `employee@logit.local` | `LogIt-Employee-2026!` | `employee` | Own tickets, create tickets, knowledge, catalog |
| Kojo Asante | `agent@logit.local` | `LogIt-Agent-2026!` | `agent` | Queue tickets, assign, internal notes, assets read, Service Desk |
| Efua Boateng | `senior@logit.local` | `LogIt-Senior-2026!` | `senior_agent` | Agent + knowledge/asset write, escalations |
| Yaw Osei | `manager@logit.local` | `LogIt-Manager-2026!` | `it_manager` | All tickets, reports, audit read, org manage, Service Desk lead |
| Akosua Addo | `approver@logit.local` | `LogIt-Approver-2026!` | `approver` | Approvals page — approve/reject pending service/access requests |
| Nana Owusu | `auditor@logit.local` | `LogIt-Auditor-2026!` | `auditor` | Audit, reports, tickets/assets read-focused |

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
