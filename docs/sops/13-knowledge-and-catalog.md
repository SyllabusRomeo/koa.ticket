# SOP-13 — Knowledge Base & Service Catalog

## Purpose

Publish reusable guidance and present requestable IT services.

## Knowledge base

### For employees

1. Open **Knowledge** in the workspace.
2. Browse published articles.
3. Follow steps; open a ticket only if unresolved.

### For authors (agents / managers with `knowledge:write`)

1. Open **Knowledge** → **Create article** (`/app/knowledge/new`).
2. Write the body with the **formatting toolbar**: Bold, Italic, H2/H3, bullets, numbered lists, links, and **Insert image**.
3. Inline images upload via `POST /api/v1/knowledge/media`, then embed in the HTML body.
4. Use **Attach files** for downloadable attachments (PDF, Office, ZIP) — uploaded after save, or from the article page.
5. Publish immediately or save as draft; drafts are invisible to employees until published.

Create via API (body is **sanitized HTML**):

```http
POST /api/v1/knowledge
{
  "title": "Connect to corporate VPN",
  "slug": "connect-vpn",
  "body": "<h2>Steps</h2><p>Open the <strong>VPN</strong> client…</p>",
  "category": "Network",
  "publish": true
}
```

Attachments / media:

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/knowledge/media` | Inline image upload (`knowledge:write`) |
| POST | `/knowledge/:id/attachments` | Article file attachment |
| GET | `/knowledge/:id/attachments` | List attachments |
| GET | `/knowledge/attachments/:id/content` | Inline view (images) |
| GET | `/knowledge/attachments/:id/download` | Download |
| POST | `/knowledge/:id/publish` | Publish draft |

Allowed body tags (server allowlist): `p`, `h1`–`h3`, `strong`, `em`, `ul`, `ol`, `li`, `a`, `img`, `br`, `code`, `pre`, `blockquote`.

### Content standards

- Clear title; one topic per article
- Steps numbered; include screenshots via **Insert image** where helpful
- Attachments for templates / installers; keep secrets out of articles
- Review dates / ownership (process) even if fields expand later

Seed example: `reset-password-m365`.

## Service catalog

### For employees

1. Open **Catalog**.
2. Read available services (code, name, description). Services with a form show a **form** chip.
3. Select a service. If it has a `formSchema`, fill the dynamic fields; notes remain optional.
4. Click **Request this service** — creates the matching ticket (`POST /api/v1/catalog/:id/request` with `{ notes?, answers? }`).
5. Answers are validated against the schema, appended under **Catalog form answers** in the ticket description, and stored as JSON on the ticket (`catalogAnswers`).
6. Items with an empty schema keep the notes-only one-click flow.
7. Service/access requests that require approval appear in Approvals.

### For admins (`settings:manage`)

Create or edit catalog items (including a field builder for the request form):

```http
POST /api/v1/catalog
{
  "code": "REQ-LAPTOP",
  "name": "Request Laptop",
  "description": "...",
  "ticketTypeCode": "service_request",
  "categoryCode": "HARDWARE",
  "teamId": "...",
  "formSchema": [
    {
      "name": "justification",
      "label": "Business justification",
      "type": "textarea",
      "required": true
    }
  ]
}
```

```http
PATCH /api/v1/catalog/:id
{
  "name": "...",
  "formSchema": [ /* same field shape; null clears */ ]
}
```

Field types: `text`, `textarea`, `select`, `number`, `checkbox`. Optional: `required`, `placeholder`, `helpText`, `options`, `min`, `max`, `defaultValue`.

Seed examples: `REQ-LAPTOP` (full sample form), `REQ-SOFTWARE`, `REQ-VPN`; `ACC-MFA-RESET` stays notes-only.

## Related SOPs

- [08 Employee self-service](./08-employee-self-service.md)
- [11 Admin configuration](./11-admin-configuration.md)
