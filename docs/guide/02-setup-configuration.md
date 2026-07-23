# Part II — Setup & configuration

← [Product & capabilities](./01-product-capabilities-roles.md) · [Book home](../USER_AND_DEVELOPER_GUIDE.md) · Next: [Operations playbook](./03-operations-use-cases.md)

---

## 6. Local development setup

### Prerequisites

- Node.js **20+** (**.nvmrc` → 22** recommended)
- npm 10+
- Docker Desktop (Postgres + Redis)
- Free ports: **3100**, **4100**, **15432**, **6379**

### Procedure

```bash
cp .env.example .env
npm install
npm run build -w @logit/shared
npm run dev:infra          # postgres + redis
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
npm run db:seed
npm run dev:api            # :4100
npm run dev:web            # :3100
# optional: npm run dev:worker   # SLA ticks
```

Open http://localhost:3100/login

Web client typically needs:

```bash
# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:4100/api/v1
```

### Low-memory (16GB Windows)

1. Cap WSL2 RAM via `infra/wslconfig.example` → `%USERPROFILE%\.wslconfig`, then `wsl --shutdown`.
2. Prefer `dev:infra` + local Node API/web — skip full `docker compose up` for daily coding.
3. Skip worker unless testing SLA.

Full detail: [SOP-03](../sops/03-technical-setup-local.md).

### Smoke test after seed

1. Login as `admin@logit.local` / `LogIT-Admin-2026!`
2. Create a ticket as employee (second browser/session)
3. Assign / comment as agent
4. Confirm `/health/ready` on API
5. Open Assets, Knowledge, Catalog, Reports once each

---

## 7. Docker & production baselines

### Full stack (local compose)

```bash
docker compose up --build
# UI via Nginx: http://localhost:8180
```

### Production overlay (TLS)

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

See [SOP-04](../sops/04-docker-deployment.md), [SOP-05](../sops/05-hetzner-production.md), [PRODUCTION.md](../PRODUCTION.md).

### Platform constraints (e.g. Render / containers)

- Bind HTTP to `0.0.0.0:$PORT`
- Treat local disk as **ephemeral** — use Postgres + durable volume/object storage for uploads
- Paths are **case-sensitive** on Linux

---

## 8. Environment & configuration reference

Copy from [`.env.example`](../../.env.example). Never commit `.env`.

### Core

| Variable | Purpose |
| --- | --- |
| `APP_NAME` / `APP_URL` | Product naming / public web URL |
| `WEB_PORT` / `API_PORT` / `NGINX_PORT` | Host ports |
| `DATABASE_URL` | Prisma Postgres URL (host often `127.0.0.1:15432`) |
| `REDIS_URL` | Presence / cache |
| `SESSION_SECRET` | ≥32 chars |
| `COOKIE_SECURE` | `true` behind HTTPS |
| `TRUST_PROXY` | `1` behind Nginx/Caddy/Render |
| `WEB_ORIGIN` | CORS allowlist for web origins |
| `PASSWORD_MIN_LENGTH` | Default 12 |
| `UPLOAD_*` | Size, dir, extension allowlist |

### Auth / SSO

| Variable | Purpose |
| --- | --- |
| `ENTRA_TENANT_ID` / `CLIENT_ID` / `CLIENT_SECRET` | Microsoft Entra OIDC |
| `ENTRA_REDIRECT_URI` | Must match app registration |
| `ENTRA_AUTO_PROVISION` | Create employee on first SSO |
| `ENTRA_DEFAULT_ROLE` | Usually `employee` |

### Email / IMAP

| Variable | Purpose |
| --- | --- |
| `SMTP_*` / `EMAIL_FROM` | Outbound (skipped if host unset) |
| `EMAIL_INBOUND_SECRET` | Inbound webhook auth |
| `IMAP_*` / `IMAP_POLL_MINUTES` | UNSEEN poll → tickets/comments |

### Chat & webhooks

| Variable | Purpose |
| --- | --- |
| `SLACK_SIGNING_SECRET` / `SLACK_BOT_TOKEN` | Slack intake |
| `TEAMS_APP_ID` / `TEAMS_WEBHOOK_SECRET` / `TEAMS_APP_PASSWORD` | Teams JWT / fallback |
| `INTEGRATION_SERVICE_USER_EMAIL` | Actor for channel-created tickets |
| `WEBHOOKS_ENABLED` | Global outbound webhook switch |

### Schedulers & AI

| Variable | Purpose |
| --- | --- |
| `DIGEST_*` | Notification digest poller |
| `REPORT_SCHEDULE_*` | Report email exports |
| `AUDIT_EXPORT_SCHEDULE_*` | Immutable audit CSV schedules |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | Optional AI assists (heuristics work without) |

### Seed (dev)

| Variable | Purpose |
| --- | --- |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | Bootstrap admin |
| `EXPOSE_RESET_TOKENS` | Dev-only reset token exposure |

Specialized runbooks: [INTEGRATIONS_EMAIL.md](../INTEGRATIONS_EMAIL.md), [INTEGRATIONS_SLACK_TEAMS.md](../INTEGRATIONS_SLACK_TEAMS.md), [INTEGRATIONS_OUTBOUND_WEBHOOKS.md](../INTEGRATIONS_OUTBOUND_WEBHOOKS.md), [NOTIFICATIONS.md](../NOTIFICATIONS.md).

---

## 9. First-login checklist

1. Open `/login` — password or **Sign in with Microsoft** (if configured).
2. If prompted, change temporary password / enroll MFA on **Profile**.
3. Confirm Home shortcuts match your role.
4. Employees: try Knowledge → Catalog → create ticket.
5. Agents: open Queue + one ticket; note channel badge and presence.
6. Admins: verify Users, Locations, Routing & SLA, Branding once.

Security SOP: [SOP-07](../sops/07-sign-in-and-security.md).

---

## 10. Admin bootstrap

Recommended order for a new organization:

### A. Branding & themes

**Admin → Branding** — logo/banner, theme preset (Forest / Coastal / Slate / Olive) or custom CSS variables. Applies site-wide.

### B. Locations → Departments → Teams

```
Company → Site (Location) → Department → Team → User
```

1. Create locations with timezone (seed example Accra HQ).
2. Create departments (seed: IT, OPS).
3. Create support teams and add members/leads (seed: Service Desk).

### C. Users & access

1. **Users** — create accounts (optional temp password → `mustChangePassword`).
2. **Roles & Access** — set primary role, extras, **home location** (stamps ticket origin).
3. Prefer deactivate over hard delete.

### D. Routing & SLA

**Admin → Routing & SLA:**

- SLA policies (response/resolve targets, pause on pending states)
- Assignment rules (category, location, team; optional auto-assign least-open + skills)
- Skills catalog + user skill links

### E. Approval policies

**Admin → Approval policies** — sequential steps for access/service/change CAB.

### F. Catalog & knowledge seed content

- Publish catalog items with `formSchema` where needed.
- Publish KB articles employees will actually find before opening tickets.

### G. Integrations

**Admin → Integrations** — email status, Slack/Teams, rotate webhook secrets, delivery log, outbound endpoints.

### H. Reports & audit schedules

Configure scheduled report emails and immutable audit export schedules after SMTP works.

Detail: [SOP-11](../sops/11-admin-configuration.md).

---

← [Product & capabilities](./01-product-capabilities-roles.md) · [Book home](../USER_AND_DEVELOPER_GUIDE.md) · Next: [Operations playbook](./03-operations-use-cases.md)
