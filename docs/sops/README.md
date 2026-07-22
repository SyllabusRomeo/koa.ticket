# LogIT — Standard Operating Procedures (SOP) Index

**Product:** LogIT — Enterprise IT Service Management  
**Audience:** End users, IT agents, managers, system administrators, auditors, developers  
**Version:** 1.2 (aligned with phases 0–11 + N1–N5 / H1–H7 / M1–M10)

Use this index to find the right procedure. Each SOP is written so a new user can follow it without prior LogIT experience.

---

## Start here

| # | SOP | Who should read it |
| --- | --- | --- |
| [00](./00-glossary.md) | Glossary & ticket language | Everyone |
| [01](./01-system-overview.md) | What LogIT is and who uses it | Everyone |
| [02](./02-system-architecture.md) | System architecture | Admins, developers, architects |
| [03](./03-technical-setup-local.md) | Local technical setup | Developers, admins |
| [04](./04-docker-deployment.md) | Docker Compose deployment | Admins, DevOps |
| [05](./05-hetzner-production.md) | Hetzner production setup | Admins, DevOps |
| [06](./06-roles-and-permissions.md) | Roles & permissions (+ demo accounts) | Admins, managers |
| [07](./07-sign-in-and-security.md) | Sign-in, passwords, sessions | Everyone |
| [08](./08-employee-self-service.md) | Employee self-service how-to | Employees / requesters |
| [09](./09-agent-ticket-handling.md) | Agent ticket handling | IT agents |
| [10](./10-manager-operations.md) | Manager operations & reporting | IT managers |
| [11](./11-admin-configuration.md) | Admin configuration | System administrators |
| [12](./12-sla-and-escalations.md) | SLA & escalations | Agents, managers, admins |
| [13](./13-knowledge-and-catalog.md) | Knowledge base & service catalog | Everyone (write = agents+) |
| [14](./14-assets.md) | IT asset management | Agents, admins |
| [15](./15-attachments-and-audit.md) | Attachments & audit trail | Agents, auditors, admins |
| [16](./16-notifications.md) | Notifications | Everyone |
| [17](./17-backup-and-recovery.md) | Backup & recovery | Admins, DevOps |
| [18](./18-troubleshooting.md) | Troubleshooting | Admins, developers |
| [19](./19-api-reference-quick.md) | API quick reference | Developers, integrators |
| [20](./20-change-and-release.md) | Change, release & seed data | Admins, developers |

Also see product docs:

- [Enterprise roadmap](../ENTERPRISE_ROADMAP.md) — now / polish / later (L1–L5)
- [Gap assessment](../GAP_ASSESSMENT.md) — **shipped vs pending** matrix
- [Development to-do](../DEVELOPMENT_TODO.md) — live checklist (remaining = L1–L5)
- [Changelog](../CHANGELOG.md) — M1–M10 summary
- [Production TLS + CI](../PRODUCTION.md)
- [Notifications](../NOTIFICATIONS.md)
- [Slack / Teams integrations](../INTEGRATIONS_SLACK_TEAMS.md)
- [Email integrations](../INTEGRATIONS_EMAIL.md)
- [Outbound webhooks](../INTEGRATIONS_OUTBOUND_WEBHOOKS.md)

---

## Quick links (local MVP)

| Item | Value |
| --- | --- |
| Web UI | http://localhost:3100 |
| Login | http://localhost:3100/login |
| API | http://localhost:4100 |
| Health | http://localhost:4100/health/ready |
| Compose UI (Nginx) | http://localhost:8180 |
| Demo users | [SOP-03](./03-technical-setup-local.md#seed-accounts-development-only) / [SOP-06](./06-roles-and-permissions.md#demo-accounts-development-only) |

---

## Document control

- Keep SOPs updated when features or ports change.
- Prefer linking to code/config paths over copying secrets.
- Never put production passwords in SOPs — use `.env` / secrets managers.
