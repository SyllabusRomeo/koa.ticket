# SOP-08 — Employee Self-Service How-To

## Purpose

Teach requesters how to use LogIt day to day.

## Before you start

- You need an active LogIt account (IT creates it), or your org may offer **Sign in with Microsoft**.
- Use a supported modern browser.
- Prefer corporate network/VPN policies as directed by IT.

## Sign in

1. Go to the LogIt portal URL provided by IT.
2. Sign in with your email and password, or Microsoft SSO if enabled ([SOP-07](./07-sign-in-and-security.md)).
3. If MFA is enabled on your account, enter the authenticator code when prompted.

## Workspace tour

After login (`/app`):

- Greeting and your roles
- Shortcuts: **Tickets**, **Knowledge**, **Catalog** (and more if permitted)
- Recent tickets list
- **Notification bell** (unread count) → `/app/notifications`
- **My profile** — password, MFA, notification preferences, email digest

## Report an IT issue

1. Open **Tickets** (`/app/tickets`).
2. Fill **Report an issue**:
   - Title (clear, short)
   - Type (usually Incident)
   - Category (Hardware / Software / Network / Access…)
   - **Origin site** (location) — defaults to your home location; change if the issue is elsewhere
   - Description (what happened, when, who is affected, error text)
3. Submit.
4. Note your ticket number (e.g. `INC-2026-000001`). Portal tickets are stamped channel **web**.

### Writing a good ticket

- One issue per ticket
- Include screenshots via **Attach files** on ticket create or ticket detail (see [SOP-15](./15-attachments-and-audit.md))
- Impact/urgency affect priority — be honest

## Request a standard service

1. Open **Catalog** (`/app/catalog`).
2. Find the service (e.g. Request Laptop). Items with a form show a **form** chip.
3. Click the service, fill any required fields, add optional notes.
4. Click **Request this service** — creates the matching ticket with your answers on the record.
5. Service/access requests that need approval go to the Approvals queue for IT.

## Track my tickets

On **Tickets**, review **Open work**:

- Number, title, status, priority, channel badge when relevant

You can only see **your own** tickets unless given special access.

## Use the knowledge base

1. Open **Knowledge**.
2. Browse published articles (password reset, etc.).
3. Try knowledge first for common how-tos; open a ticket if still blocked.

## Respond to IT

When agents ask questions (Pending User), reply on the ticket conversation (public comments). Check the **bell** / notifications inbox, or configure an email digest on Profile.

## Confirm resolution

When status is **Resolved**:

1. Verify the fix.
2. If fixed, IT sets **Closed** (terminal confirmation).
3. If not fixed, ask IT to reopen (status transition back to Open).

Home/Reports “Resolved today” counts resolutions, not closures.

## What employees cannot do

- View other people’s tickets
- See internal IT notes
- Change global configuration
- Export sensitive reports

## Related SOPs

- [00 Glossary](./00-glossary.md)
- [13 Knowledge and catalog](./13-knowledge-and-catalog.md)
- [16 Notifications](./16-notifications.md)
