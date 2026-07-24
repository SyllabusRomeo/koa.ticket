# Part IV — Developer guide

← [Operations](./03-operations-use-cases.md) · [Book home](../USER_AND_DEVELOPER_GUIDE.md) · Next: [Extending beyond ITSM](./05-extending-beyond-itsm.md)

---

## 21. Repo layout & packages

```
koa.ticket/
  apps/
    api/          NestJS + Prisma (business API)
    web/          Next.js App Router UI
    worker/       SLA ticker / background jobs
  packages/
    shared/       Roles, permissions, statuses, brand constants
  infra/
    docker/       Dockerfiles
    nginx/        Reverse proxy + TLS
    hetzner/      Production notes
  docs/
    USER_AND_DEVELOPER_GUIDE.md   ← book entry
    guide/                        ← this Part IV lives here
    sops/                         ← operator SOPs
  docker-compose.yml
  docker-compose.prod.yml
```

Workspaces: root `package.json` scripts (`dev:api`, `dev:web`, `dev:infra`, `db:seed`, `ci`, …).

Shared package name: `@logit/shared` — **import permission/role constants from here**; do not fork string literals in app code.

---

## 22. API modules & auth model

### Modules (`apps/api/src`)

| Module | Responsibility |
| --- | --- |
| `auth` | Sessions, passwords, MFA, Entra SSO, guards |
| `users` | User CRUD / access |
| `org` | Locations, departments, teams |
| `tickets` | Lifecycle, comments, watchers, work logs, links, merge, channel |
| `presence` | Viewing/composing (Redis + memory fallback) |
| `attachments` | Upload/download |
| `audit` | Audit log + export schedules/runs |
| `sla` | Policies / instances / escalations |
| `assignment` | Rules + skills / auto-assign |
| `approvals` | Policies, steps, decisions |
| `notifications` | In-app + digests |
| `knowledge` | Articles + events |
| `catalog` | Items + formSchema |
| `assets` | Register, relations, impact, discovery |
| `reports` | Summary, heatmap, stages, schedules |
| `integrations` | Slack/Teams/chat intake |
| `email` | SMTP + IMAP poller |
| `webhooks` | Outbound HMAC |
| `branding` | Logo/themes |
| `im` | Incident Management — declare, updates, roles, status, PIR |
| `automation` | Ticket on-create rules (`settings:manage`) |
| `ai` | Assists (heuristic + optional OpenAI) |
| `health` | `/health`, `/live`, `/ready` |
| `prisma` | DB client |

Prefix: **`/api/v1`**. Quick map: [SOP-19](../sops/19-api-reference-quick.md).

### Auth model

- Session cookie `logit_session` (HttpOnly); `COOKIE_SECURE` in prod.
- `SessionAuthGuard` + `@Permissions()` / roles guard on controllers.
- Effective permissions computed from primary role ∪ extras at session time — **re-login after access changes**.
- Never rely on Next.js nav alone for authorization.

---

## 23. Data model overview

Authoritative schema: `apps/api/prisma/schema.prisma`.

### Domains (selected)

| Domain | Core models |
| --- | --- |
| Identity | `User`, `Role`, `Permission`, `UserRole`, `UserPermission`, `Session`, MFA/challenge tokens |
| Org | `Location`, `Department`, `Team`, `TeamMember` |
| Ticketing | `Ticket`, statuses/types/categories/priorities, `TicketComment`, `TicketWatcher`, `TicketWorkLog`, `TicketHistory`, `TicketAttachment`, `EmailMessage` |
| SLA / routing | `SlaPolicy`, `SlaInstance`, `SlaEscalationRule`, `BusinessHours`, `Holiday`, `Skill`, `UserSkill`, `AssignmentRule` |
| Knowledge / catalog | `KnowledgeArticle`, `KnowledgeEvent`, `ServiceCatalogItem` |
| Assets | `Asset`, `AssetType`, `AssetRelation`, `TicketAsset` |
| Approvals | `ApprovalPolicy`, `ApprovalStep`, `Approval` |
| Comms / integration | `Notification`, `NotificationPreference`, `WebhookEndpoint`, `WebhookDelivery` |
| Reporting / compliance | `ReportSchedule`, `AuditLog`, `AuditExportSchedule`, `AuditExportRun` |
| Incident Management | `ImIncident`, `ImIncidentUpdate`, `ImIncidentRole` |
| Automation | `AutomationRule` (and related action/condition fields per schema) |
| Settings | `SystemSetting` (branding/themes etc.) |

### Design habits

- Soft-deactivate (`isActive`) over hard delete for org/users where applicable.
- Ticket numbers via sequences + type prefixes (`INC`, `REQ`, …).
- Optimistic concurrency on tickets via `version`.
- Uploads stored with randomized names under `UPLOAD_DIR` (volume in prod).

---

## 24. Migrations, seed, tests, CI

### Migrations

```bash
# develop
npx prisma migrate dev --name <change> --schema=apps/api/prisma/schema.prisma

# deploy
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
npm run db:generate
```

Never hand-edit production schema without a migration. Release SOP: [SOP-20](../sops/20-change-and-release.md).

### Seed

```bash
npm run db:seed
```

Creates roles/permissions, sample org, SLA, categories, demo users, sample KB/catalog/assets. **Dev only** credentials — rotate/remove before production use.

### Tests & CI

```bash
npm run typecheck
npm run test -w @logit/api
npm run ci
```

GitHub Actions: typecheck → API tests → build API/worker/web. See [PRODUCTION.md](../PRODUCTION.md).

### Backups

Treat Postgres dumps + upload volume as recovery unit: [SOP-17](../sops/17-backup-and-recovery.md). Troubleshooting: [SOP-18](../sops/18-troubleshooting.md).

---

## 25. UI patterns & deploy notes

### Web patterns

- Nav + capability checks: `apps/web/src/lib/access.ts` + `nav-icons.ts`
- Buttons: shared `Button` / variants — see [UX_BUTTONS.md](../UX_BUTTONS.md)
- Forms: prefer `FormField` / `TextInput` / `FormStack` + global input baseline in `globals.css`
- Section headings: shared `SectionHeading` / `PanelHeading` for admin consistency
- API client: web `api` helper with credentials (cookie session)

When adding a page:

1. Create `apps/web/src/app/app/.../page.tsx`
2. Gate with `can(user, …)` in nav (`navForUser`) and page-level checks
3. Call existing API or add Nest module + DTO validation
4. Add permission to `@logit/shared` + seed/role matrix if new

### Deploy notes

| Concern | Guidance |
| --- | --- |
| Production host | `https://logit.koaimpact.app` — [DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md](../DEPLOY_HETZNER_CLOUDFLARE_NAMESILO.md) |
| Port bind | `0.0.0.0` + `$PORT` / `API_PORT` |
| Filesystem | Ephemeral — persist uploads on a volume or object store |
| Cookies | HTTPS → `COOKIE_SECURE=true`, `TRUST_PROXY=1` |
| CORS | `WEB_ORIGIN=https://logit.koaimpact.app` |
| Worker | Run separately for SLA ticks in prod |
| Pollers | IMAP/digests/schedules run in API process — size the instance accordingly |

---

← [Operations](./03-operations-use-cases.md) · [Book home](../USER_AND_DEVELOPER_GUIDE.md) · Next: [Extending beyond ITSM](./05-extending-beyond-itsm.md)
