# Slack & Microsoft Teams — create tickets from chat

LogIT Phase-1 integrations: a user messages the bot (slash command or @mention) → LogIT creates a ticket → reply includes ticket number and deep link.

**Admin UI:** `/app/admin/integrations` (sysadmin only)  
**Roadmap:** [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md)

---

## Environment variables

| Variable | Purpose |
| --- | --- |
| `SLACK_SIGNING_SECRET` | Verify Slack requests (required in prod) |
| `SLACK_BOT_TOKEN` | Optional; status indicator for bot install |
| `TEAMS_APP_ID` | Optional status for Teams app |
| `TEAMS_WEBHOOK_SECRET` or `TEAMS_APP_PASSWORD` | Bearer secret for Teams webhook |
| `INTEGRATION_SERVICE_USER_EMAIL` | Fallback requester (default: seed admin) |
| `APP_PUBLIC_URL` | Base URL for ticket links in chat replies |
| `API_PUBLIC_URL` | Optional public API base for webhook URL display |

When signing secrets are **absent**, Slack/Teams endpoints accept traffic (local/dev). When **present**, signatures/Bearer tokens are enforced.

---

## Endpoints

| Method | Path | Auth |
| --- | --- | --- |
| `GET` | `/api/v1/integrations/status` | Sysadmin session |
| `POST` | `/api/v1/integrations/chat/simulate` | Sysadmin session |
| `POST` | `/api/v1/integrations/slack/events` | Slack signature (if secret set) |
| `POST` | `/api/v1/integrations/slack/commands` | Slack signature (if secret set) |
| `POST` | `/api/v1/integrations/teams/messages` | Bearer secret (if set) |

### Message syntax

Shared parser extracts title/body; default type **incident**.

Examples:

```text
/logit laptop broken priority:high
@LogIT create: VPN down priority:p2
Printer offline impact:medium urgency:low type:incident
```

Tokens: `priority:p1|p2|high|medium|low`, `impact:`, `urgency:`, `type:`.

---

## Slack setup (summary)

1. Create a Slack app at api.slack.com.
2. **Slash Commands** → `/logit` → Request URL = `{API}/api/v1/integrations/slack/commands`.
3. **Event Subscriptions** → Request URL = `{API}/api/v1/integrations/slack/events` (handles `url_verification` challenge).
4. Subscribe to `app_mention` (and optionally `message.im`).
5. Copy Signing Secret → `SLACK_SIGNING_SECRET`.
6. Install app to workspace.

### Example slash payload handling

`POST /api/v1/integrations/slack/commands` with form field `text=laptop broken priority:high` returns Slack `in_channel` message:

```text
Created INC-2026-000123: laptop broken
https://your-app/app/tickets/INC-2026-000123
```

---

## Teams setup (summary)

1. Register a Bot / Azure Bot resource.
2. Messaging endpoint = `{API}/api/v1/integrations/teams/messages`.
3. Set `TEAMS_WEBHOOK_SECRET` and send `Authorization: Bearer <secret>` (or configure equivalent in your connector).
4. Users message the bot with `create: …` or plain text; LogIT replies with ticket number + link.

> Full Bot Framework JWT validation can be added later; this first cut uses a shared webhook secret suitable for controlled networks / connectors.

---

## Dev simulate (no Slack)

As sysadmin:

```http
POST /api/v1/integrations/chat/simulate
Content-Type: application/json
Cookie: logit_session=…

{ "text": "VPN down priority:high" }
```

Or use **Dev simulate** on `/app/admin/integrations`.

---

## Security notes

- Webhooks are public routes; protect with Slack signing secret / Teams bearer in production.
- Tickets are created as the mapped user (email) when known, else `INTEGRATION_SERVICE_USER_EMAIL`.
- Do not commit secrets; use Render env groups / secret managers.
