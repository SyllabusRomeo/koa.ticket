# LogIT — Changelog (shipped through M10)

Concise product summary. Detail lives in [DEVELOPMENT_TODO.md](./docs/DEVELOPMENT_TODO.md) and [GAP_ASSESSMENT.md](./docs/GAP_ASSESSMENT.md).

## Near-term (N1–N5)

- Watch / Unwatch on ticket detail; watcher notifications on comment + status
- Work-log UI (minutes + notes) on ticket detail
- Major-incident badge, list filter, and Major queue chip
- Departments admin (`/app/admin/departments`)

## High (H1–H7)

- Agent presence (viewing/composing) with Redis + memory fallback
- Queue / Kanban + workload (`/app/queue`)
- Problem management (`/app/problems`) and Change / CAB (`/app/changes`)
- Major-incident ops dashboard (`/app/major-incidents`)
- TOTP MFA + optional Microsoft Entra OIDC
- Stage bottleneck analytics on Reports + detail bars

## Medium (M1–M10)

| # | Feature |
| --- | --- |
| M1 | IMAP UNSEEN poller + Message-ID / In-Reply-To threading |
| M2 | Skills catalog + least-open auto-assign on routing rules |
| M3 | Multi-step approval policies (Admin → Approval policies) |
| M4 | Catalog dynamic forms (`formSchema` validate + persist) |
| M5 | Signed outbound webhooks (HMAC + Admin → Integrations) |
| M6 | GitHub Actions CI + Nginx TLS / Let's Encrypt |
| M7 | Slack HMAC + Teams Bot Framework JWT (shared-secret fallback) |
| M8 | Notification digests (daily/weekly, quiet hours, Profile UI) |
| M9 | Reporting heatmaps + scheduled CSV/PDF email exports |
| M10 | Ticket channel metadata (`web` / `email` / `slack` / `teams` / `chat` / `api`) |

## What’s next

Later / strategic **L1–L5**: CMDB discovery, AI assists, knowledge deflection analytics, portal themes, immutable audit export schedules.
