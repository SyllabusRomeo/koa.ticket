# LogIt — User & Developer Guide

**Product:** LogIt — Enterprise IT Service Management  
**Audience:** Requesters, agents, managers, approvers, auditors, administrators, and developers  
**Edition:** 2026-07-23 (aligned with N1–N5 · H1–H7 · M1–M10 · L1–L5)

This is the **book-style master guide** for LogIt. It explains what the system is, how to set it up, how to run day-to-day work, how developers extend it, and how the same patterns can grow beyond ITSM (including manufacturing).

Deep step-by-step operator procedures also live in [sops/](./sops/README.md). This guide is the narrative map; SOPs are the field manuals.

---

## How to read this book

| If you are… | Start with |
| --- | --- |
| New to LogIt (any role) | [Part I — Product & capabilities](./guide/01-product-capabilities-roles.md) |
| Setting up a laptop or server | [Part II — Setup & configuration](./guide/02-setup-configuration.md) |
| Using the product daily | [Part III — Operations playbook](./guide/03-operations-use-cases.md) |
| Building or deploying code | [Part IV — Developer guide](./guide/04-developer-guide.md) |
| Planning growth beyond IT tickets | [Part V — Extending the platform](./guide/05-extending-beyond-itsm.md) |

---

## Table of contents

### Part I — Product & capabilities
1. [What LogIt is](./guide/01-product-capabilities-roles.md#1-what-logit-is)
2. [Capabilities map (360°)](./guide/01-product-capabilities-roles.md#2-capabilities-map-360)
3. [Personas, roles & permissions](./guide/01-product-capabilities-roles.md#3-personas-roles--permissions)
4. [Architecture at a glance](./guide/01-product-capabilities-roles.md#4-architecture-at-a-glance)
5. [Navigation tour](./guide/01-product-capabilities-roles.md#5-navigation-tour)

### Part II — Setup & configuration
6. [Local development setup](./guide/02-setup-configuration.md#6-local-development-setup)
7. [Docker & production baselines](./guide/02-setup-configuration.md#7-docker--production-baselines)
8. [Environment & configuration reference](./guide/02-setup-configuration.md#8-environment--configuration-reference)
9. [First-login checklist](./guide/02-setup-configuration.md#9-first-login-checklist)
10. [Admin bootstrap (org, users, routing, branding)](./guide/02-setup-configuration.md#10-admin-bootstrap)

### Part III — Operations playbook
11. [Tickets, queue & major incidents](./guide/03-operations-use-cases.md#11-tickets-queue--major-incidents)
12. [Service catalog & requests](./guide/03-operations-use-cases.md#12-service-catalog--requests)
13. [Knowledge base & deflection](./guide/03-operations-use-cases.md#13-knowledge-base--deflection)
14. [Assets / CMDB](./guide/03-operations-use-cases.md#14-assets--cmdb)
15. [Approvals & CAB](./guide/03-operations-use-cases.md#15-approvals--cab)
16. [SLA, routing & assignment](./guide/03-operations-use-cases.md#16-sla-routing--assignment)
17. [Problems & changes](./guide/03-operations-use-cases.md#17-problems--changes)
18. [Reports, audit & notifications](./guide/03-operations-use-cases.md#18-reports-audit--notifications)
19. [Integrations (email, Slack, Teams, webhooks)](./guide/03-operations-use-cases.md#19-integrations)
20. [Quick reference by role](./guide/03-operations-use-cases.md#20-quick-reference-by-role)

### Part IV — Developer guide
21. [Repo layout & packages](./guide/04-developer-guide.md#21-repo-layout--packages)
22. [API modules & auth model](./guide/04-developer-guide.md#22-api-modules--auth-model)
23. [Data model overview](./guide/04-developer-guide.md#23-data-model-overview)
24. [Migrations, seed, tests, CI](./guide/04-developer-guide.md#24-migrations-seed-tests-ci)
25. [UI patterns & deploy notes](./guide/04-developer-guide.md#25-ui-patterns--deploy-notes)

### Part V — Extending beyond ITSM
26. [Extension principles](./guide/05-extending-beyond-itsm.md#26-extension-principles)
27. [Manufacturing operations blueprint](./guide/05-extending-beyond-itsm.md#27-manufacturing-operations-blueprint)
28. [Other industry scenarios](./guide/05-extending-beyond-itsm.md#28-other-industry-scenarios)
29. [Anti-patterns & boundaries](./guide/05-extending-beyond-itsm.md#29-anti-patterns--boundaries)

### Back matter
30. [Glossary](./guide/01-product-capabilities-roles.md#30-glossary)
31. [Related documentation index](#related-documentation)

---

## Current product vs extension vision

| Label in this book | Meaning |
| --- | --- |
| **Current product** | Built and usable in this repo today (through L5) |
| **Extension opportunity** | Design pattern for growing LogIt — **not** shipped features |

Do not treat Part V manufacturing/HR/fleet modules as existing screens unless this guide explicitly says they are current product.

---

## Related documentation

| Doc | Purpose |
| --- | --- |
| [sops/README.md](./sops/README.md) | Operator SOPs (detailed how-tos) |
| [GAP_ASSESSMENT.md](./GAP_ASSESSMENT.md) | Shipped vs pending vs PRD |
| [DEVELOPMENT_TODO.md](./DEVELOPMENT_TODO.md) | Living engineering checklist |
| [CHANGELOG.md](./CHANGELOG.md) | Shipped feature summary |
| [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md) | Product phases |
| [PRODUCTION.md](./PRODUCTION.md) | TLS + CI |
| [NOTIFICATIONS.md](./NOTIFICATIONS.md) | Digests & prefs |
| [INTEGRATIONS_EMAIL.md](./INTEGRATIONS_EMAIL.md) | SMTP / IMAP / channel stamp |
| [INTEGRATIONS_SLACK_TEAMS.md](./INTEGRATIONS_SLACK_TEAMS.md) | Chat intake |
| [INTEGRATIONS_OUTBOUND_WEBHOOKS.md](./INTEGRATIONS_OUTBOUND_WEBHOOKS.md) | HMAC webhooks |
| [UX_BUTTONS.md](./UX_BUTTONS.md) | Button variant conventions |

---

## Document control

- Update this guide when nav routes, permissions, env vars, or major modules change.
- Prefer linking to SOPs for long procedures; keep flows and “why” here.
- Never commit production secrets — use `.env` / a secrets manager.
