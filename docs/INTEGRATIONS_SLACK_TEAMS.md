# Slack & Microsoft Teams — create tickets from chat

LogIT Phase-1 integrations: a user messages the bot (slash command or @mention) → LogIT creates a ticket → reply includes ticket number and deep link.

Tickets are stamped `channel=slack` or `channel=teams` (simulate → `chat`) plus `channelMeta` (user/channel/thread ids). Portal creates use `web`.

**Admin UI:** `/app/admin/integrations` (sysadmin only)  
**Roadmap:** [ENTERPRISE_ROADMAP.md](./ENTERPRISE_ROADMAP.md)  
**Email:** [INTEGRATIONS_EMAIL.md](./INTEGRATIONS_EMAIL.md)

---

## Environment variables

| Variable | Purpose |
| --- | --- |
| `SLACK_SIGNING_SECRET` | Verify Slack requests (HMAC v0). **Required in production** |
| `SLACK_BOT_TOKEN` | Optional; status indicator for bot install |
| `TEAMS_APP_ID` or `MICROSOFT_APP_ID` | Bot Framework Microsoft App ID (JWT **audience**). Prefer this for Azure Bot / Teams |
| `TEAMS_APP_PASSWORD` / `MICROSOFT_APP_PASSWORD` | Bot client secret for **outbound** Connector calls (not used to verify inbound) |
| `TEAMS_WEBHOOK_SECRET` | Shared Bearer secret for simple connectors / proxies (fallback when not using JWT) |
| `TEAMS_ALLOW_EMULATOR` | `true` to accept Bot Framework Emulator JWTs (dev only) |
| `INTEGRATIONS_REQUIRE_AUTH` | `true`/`false` to force/disable auth. Default: on when `NODE_ENV=production` |
| `INTEGRATION_SERVICE_USER_EMAIL` | Fallback requester (default: seed admin) |
| `APP_PUBLIC_URL` | Base URL for ticket links in chat replies |
| `API_PUBLIC_URL` | Optional public API base for webhook URL display |

### Auth modes

| Mode | When | Behavior |
| --- | --- | --- |
| **Open (dev)** | No secrets configured and auth not required | Endpoints accept traffic (local only) |
| **Slack signing** | `SLACK_SIGNING_SECRET` set | Rejects missing/invalid/`X-Slack-Request-Timestamp` skew > 5 min |
| **Teams JWT** | `TEAMS_APP_ID` set | Validates Bot Connector JWT via Bot Framework JWKS; checks `aud`, `iss`, signature, optional `serviceUrl` |
| **Teams shared secret** | `TEAMS_WEBHOOK_SECRET` set | `Authorization: Bearer <secret>` (or raw secret) timing-safe compare |

In production (`NODE_ENV=production` or `INTEGRATIONS_REQUIRE_AUTH=true`), missing Slack signing secret / Teams app id or webhook secret causes **401**.

---

## Endpoints

| Method | Path | Auth |
| --- | --- | --- |
| `GET` | `/api/v1/integrations/status` | Sysadmin session |
| `POST` | `/api/v1/integrations/chat/simulate` | Sysadmin session |
| `POST` | `/api/v1/integrations/slack/events` | Slack signature (required in prod) |
| `POST` | `/api/v1/integrations/slack/commands` | Slack signature (required in prod) |
| `POST` | `/api/v1/integrations/teams/messages` | Bot Framework JWT and/or shared Bearer (required in prod) |

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
5. Copy **Signing Secret** → `SLACK_SIGNING_SECRET`.
6. Install app to workspace.

LogIT verifies `X-Slack-Signature` = `v0=` + HMAC-SHA256 of `v0:{timestamp}:{rawBody}` using the signing secret, and rejects timestamps older than 5 minutes. Raw body capture is enabled in the API (`main.ts`) so signature checks match Slack’s bytes.

### Example slash payload handling

`POST /api/v1/integrations/slack/commands` with form field `text=laptop broken priority:high` returns Slack `in_channel` message:

```text
Created INC-2026-000123: laptop broken
https://your-app/app/tickets/INC-2026-000123
```

---

## Teams / Bot Framework setup

### Recommended: Azure Bot JWT

1. Register an **Azure Bot** / Bot Channels Registration; note the **Microsoft App ID**.
2. Set messaging endpoint = `{API}/api/v1/integrations/teams/messages`.
3. Set env:
   - `TEAMS_APP_ID=<Microsoft App ID>` (or `MICROSOFT_APP_ID`)
   - Optionally keep `TEAMS_APP_PASSWORD` for future outbound replies (not required for inbound verify)
4. Enable the **Microsoft Teams** channel on the bot.
5. Users message the bot with `create: …` or plain text; LogIT replies with ticket number + link.

Inbound requests from the Bot Connector include:

```http
Authorization: Bearer <JWT>
```

LogIT validates (per [Bot Connector authentication](https://learn.microsoft.com/en-us/azure/bot-service/rest-api/bot-framework-rest-connector-authentication)):

| Check | Expected |
| --- | --- |
| Issuer (`iss`) | `https://api.botframework.com` |
| Audience (`aud`) | Your `TEAMS_APP_ID` |
| Signature | RS256 key from `https://login.botframework.com/v1/.well-known/keys` |
| Clock skew | ±5 minutes |
| `serviceUrl` claim | Must match Activity `serviceUrl` when both present |

OpenID metadata (static): `https://login.botframework.com/v1/.well-known/openidconfiguration`

### Optional: shared webhook secret

For custom connectors / reverse proxies that cannot send Bot Framework JWTs:

```bash
TEAMS_WEBHOOK_SECRET=long-random-string
```

Send `Authorization: Bearer <same-string>`. If both App ID and webhook secret are set, JWT is tried first; shared secret is the fallback.

### Bot Framework Emulator (dev)

```bash
TEAMS_APP_ID=<app-id>
TEAMS_ALLOW_EMULATOR=true
```

Emulator tokens use MSA issuers / JWKS (`login.microsoftonline.com/...`). **Do not enable in production.**

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

- Webhooks are public routes; always set Slack signing secret and Teams App ID (or webhook secret) in production.
- Invalid signatures / JWTs return **401 Unauthorized**.
- Tickets are created as the mapped user (email) when known, else `INTEGRATION_SERVICE_USER_EMAIL`.
- Do not commit secrets; use Render env groups / secret managers.
- `TEAMS_APP_PASSWORD` is the OAuth client secret for calling the Connector API — it is **not** an inbound verification secret (use JWT or `TEAMS_WEBHOOK_SECRET`).
