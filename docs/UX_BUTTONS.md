# LogIt — Action button variants

Industry ITSM principle: **one clear next step**, quieter alternatives, and destructive actions that look different. Visual language stays LogIt (forest greens `#0F4A40` / `#456433`, lime `#EDF4AC`, warm `#FBF1DA`) — not a blue Service Desk clone.

Shared styles: `apps/web/src/components/Button.module.css` (+ `Button` / `buttonClass` in `Button.tsx`). App pages also expose aliases via `app.module.css` (`.btn`, `.btnSecondary`, …).

## Variants

| Variant | When to use | Examples |
| --- | --- | --- |
| **Primary** | The main next action for the view (prefer **one**) | Submit ticket, Save roles, Close ticket, Create request |
| **Secondary** | Safe alternatives, navigation, cancel | Cancel, Assign to me, Reopen, Back to Home, Choose files |
| **Tertiary / ghost** | Lowest emphasis chrome | Sign out, Audit trail link, de-emphasized nav actions |
| **Success** | Positive lifecycle / decision | **Resolve**, **Approve** |
| **Danger** | Irreversible or harmful from the user’s POV | **Reject**, Cancel ticket (status) |
| **Danger outline** | Destructive but confirmatory / less impulsive | **Delete** ticket (confirm dialog required) |

## Layout

- **Forms:** trailing actions — Cancel (secondary) then Submit/Save (primary), right-aligned when the row is form-width (`.btnRow` + `.btnRowEnd`).
- **Ticket actions:** group under “Ticket actions”. Resolve → success; Close → primary; Reopen / progress → secondary; Cancel status → danger; Delete → danger outline + confirm.
- **Approvals:** Approve → success; Reject → danger (not two same-weight fills).
- **Disabled:** use native `disabled`; focus rings stay visible when enabled (`:focus-visible`).

## Icons

- Use **lucide-react** line icons via `Icon` (`apps/web/src/components/Icon.tsx`) — sizes 16/20/24, `currentColor`, LogIt brand greens.
- Prefer **icon + text** on key actions (New ticket, Save, Delete, Attach, Approve/Reject, Sign out). Icon-only controls need an `aria-label`.
- Decorative icons: `aria-hidden` (the `Icon` wrapper sets this). Never emoji or multicolored glyphs.
- See `.cursor/rules/logit-icons.mdc`.

## Do / don’t

- Do keep size, padding, radius, and focus rings consistent.
- Do confirm destructive actions (`window.confirm` or a modal).
- Don’t label every control as primary weight.
- Don’t show backend jargon in the UI (e.g. say **Delete**, not “soft-delete”).
- Don’t clutter every control with an icon — reserve them for nav, KPIs, empty states, toolbars, and key CTAs.
