'use client';

import { FormEvent, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  Copy,
  History,
  Inbox,
  KeyRound,
  Link2,
  Mail,
  MessageSquareText,
  Plug,
  RefreshCw,
  Send,
  Trash2,
  Webhook,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { api, type AuthUser, type WebhookEndpoint } from '@/lib/api';
import { hasRole } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { SectionHeading } from '@/components/SectionHeading';
import {
  IntegrationStatusCard,
  SlackGlyph,
  TeamsGlyph,
} from './integration-glyphs';
import appStyles from '../../app.module.css';
import styles from './integrations.module.css';

function PanelHeading({
  icon,
  children,
}: {
  icon: LucideIcon;
  children: ReactNode;
}) {
  return <SectionHeading icon={icon}>{children}</SectionHeading>;
}

type Status = Awaited<ReturnType<typeof api.integrationsStatus>>;
type Delivery = Awaited<ReturnType<typeof api.webhookDeliveries>>[number];

const DEFAULT_EVENTS = [
  'ticket.created',
  'ticket.updated',
  'ticket.assigned',
  'ticket.commented',
];

export default function IntegrationsAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [simText, setSimText] = useState(
    'VPN down for Accra office priority:high',
  );
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [imapBusy, setImapBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const [webhooksEnabled, setWebhooksEnabled] = useState(true);
  const [endpoints, setEndpoints] = useState<WebhookEndpoint[]>([]);
  const [eventCatalog, setEventCatalog] = useState<string[]>(DEFAULT_EVENTS);
  const [whName, setWhName] = useState('');
  const [whUrl, setWhUrl] = useState('https://example.com/logit-hooks');
  const [whEvents, setWhEvents] = useState<string[]>([...DEFAULT_EVENTS]);
  const [whActive, setWhActive] = useState(false);
  const [whBusy, setWhBusy] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deliveriesBusy, setDeliveriesBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editEvents, setEditEvents] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (!hasRole(user, 'sysadmin')) {
          router.replace('/app');
          return;
        }
        if (!cancelled) setUser(user);
        const [s, events, eps] = await Promise.all([
          api.integrationsStatus(),
          api
            .webhookEvents()
            .catch(() => ({ enabled: true, events: DEFAULT_EVENTS })),
          api.webhookEndpoints().catch(() => [] as WebhookEndpoint[]),
        ]);
        if (!cancelled) {
          setStatus(s);
          setWebhooksEnabled(events.enabled);
          setEventCatalog(
            events.events?.length ? events.events : DEFAULT_EVENTS,
          );
          setEndpoints(eps);
        }
      } catch {
        if (!cancelled) router.replace('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function refreshEndpoints() {
    setEndpoints(await api.webhookEndpoints());
  }

  async function refreshStatus() {
    setStatusBusy(true);
    setError(null);
    try {
      const [s, events] = await Promise.all([
        api.integrationsStatus(),
        api.webhookEvents(),
      ]);
      setStatus(s);
      setWebhooksEnabled(events.enabled);
      setEventCatalog(events.events?.length ? events.events : DEFAULT_EVENTS);
      await refreshEndpoints();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh status');
    } finally {
      setStatusBusy(false);
    }
  }

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError('Could not copy to clipboard');
    }
  }

  async function onSimulate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.simulateChatTicket({ text: simText });
      setResult(res.confirmation);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulate failed');
    } finally {
      setBusy(false);
    }
  }

  async function onImapPoll() {
    setImapBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.pollImap();
      setResult(
        res.ok
          ? `IMAP poll: processed ${res.processed}, skipped ${res.skipped}, errors ${res.errors}${res.reason ? ` (${res.reason})` : ''}`
          : `IMAP poll failed${res.reason ? `: ${res.reason}` : ''}`,
      );
      const s = await api.integrationsStatus();
      setStatus(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'IMAP poll failed');
    } finally {
      setImapBusy(false);
    }
  }

  function toggleEvent(code: string) {
    setWhEvents((prev) =>
      prev.includes(code) ? prev.filter((e) => e !== code) : [...prev, code],
    );
  }

  function toggleEditEvent(code: string) {
    setEditEvents((prev) =>
      prev.includes(code) ? prev.filter((e) => e !== code) : [...prev, code],
    );
  }

  function startEdit(ep: WebhookEndpoint) {
    setEditingId(ep.id);
    setEditName(ep.name);
    setEditUrl(ep.url);
    setEditEvents([...ep.eventTypes]);
    setError(null);
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setWhBusy(true);
    setError(null);
    try {
      await api.updateWebhookEndpoint(editingId, {
        name: editName.trim(),
        url: editUrl.trim(),
        eventTypes: editEvents,
      });
      setEditingId(null);
      setResult('Webhook endpoint updated.');
      await refreshEndpoints();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update webhook');
    } finally {
      setWhBusy(false);
    }
  }

  async function onCreateWebhook(e: FormEvent) {
    e.preventDefault();
    setWhBusy(true);
    setError(null);
    setResult(null);
    setRevealedSecret(null);
    try {
      const created = await api.createWebhookEndpoint({
        name: whName.trim(),
        url: whUrl.trim(),
        eventTypes: whEvents,
        isActive: whActive,
      });
      if (created.secret) setRevealedSecret(created.secret);
      setWhName('');
      setResult(
        `Webhook “${created.name}” created. Copy the secret now — it won’t be shown again.`,
      );
      await refreshEndpoints();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create webhook');
    } finally {
      setWhBusy(false);
    }
  }

  async function onToggleActive(ep: WebhookEndpoint) {
    setWhBusy(true);
    setError(null);
    try {
      await api.updateWebhookEndpoint(ep.id, { isActive: !ep.isActive });
      await refreshEndpoints();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update webhook');
    } finally {
      setWhBusy(false);
    }
  }

  async function onRotateSecret(ep: WebhookEndpoint) {
    if (
      !window.confirm(
        `Rotate signing secret for “${ep.name}”? The old secret stops working immediately.`,
      )
    ) {
      return;
    }
    setWhBusy(true);
    setError(null);
    setResult(null);
    setRevealedSecret(null);
    try {
      const updated = await api.updateWebhookEndpoint(ep.id, {
        rotateSecret: true,
      });
      if (updated.secret) setRevealedSecret(updated.secret);
      setResult(
        `Secret rotated for “${ep.name}”. Copy the new secret now — it won’t be shown again.`,
      );
      await refreshEndpoints();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rotate secret');
    } finally {
      setWhBusy(false);
    }
  }

  async function onTestWebhook(id: string) {
    setWhBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.testWebhookEndpoint(id);
      setResult(
        res.ok
          ? `Test ping OK (HTTP ${res.statusCode ?? '—'}) · delivery ${res.deliveryId}`
          : `Test ping failed: ${res.error ?? `HTTP ${res.statusCode}`}`,
      );
      if (deliveriesFor === id) {
        setDeliveries(await api.webhookDeliveries(id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test ping failed');
    } finally {
      setWhBusy(false);
    }
  }

  async function onToggleDeliveries(id: string) {
    if (deliveriesFor === id) {
      setDeliveriesFor(null);
      setDeliveries([]);
      return;
    }
    setDeliveriesBusy(true);
    setError(null);
    try {
      const rows = await api.webhookDeliveries(id);
      setDeliveriesFor(id);
      setDeliveries(rows);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load deliveries',
      );
    } finally {
      setDeliveriesBusy(false);
    }
  }

  async function onDeleteWebhook(id: string) {
    if (!window.confirm('Delete this webhook endpoint?')) return;
    setWhBusy(true);
    setError(null);
    try {
      await api.deleteWebhookEndpoint(id);
      if (deliveriesFor === id) {
        setDeliveriesFor(null);
        setDeliveries([]);
      }
      if (editingId === id) setEditingId(null);
      await refreshEndpoints();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete webhook');
    } finally {
      setWhBusy(false);
    }
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  }

  if (loading || !user) {
    return (
      <main className={appStyles.page}>
        <p className={appStyles.muted}>Loading integrations…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="Integrations">
      <div className={styles.layout}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Administration · Sysadmin</p>
          <p className={styles.lede}>
            Connect Slack, Microsoft Teams, and email so people can create and
            update LogIt tickets from chat or mailbox. Configure signed outbound
            webhooks for external systems. Chat secrets live in environment
            variables; outbound webhook secrets are stored per endpoint.
          </p>
        </header>

        {error ? (
          <p className={appStyles.error} role="alert">
            {error}
          </p>
        ) : null}
        {result ? <pre className={styles.result}>{result}</pre> : null}

        <section className={styles.panel}>
          <div className={styles.panelHead}>
            <PanelHeading icon={Plug}>Status</PanelHeading>
            <Button
              type="button"
              variant="secondary"
              disabled={statusBusy}
              onClick={() => void refreshStatus()}
            >
              <Icon icon={RefreshCw} size="sm" />
              {statusBusy ? 'Refreshing…' : 'Refresh'}
            </Button>
          </div>
          <div className={styles.statusGrid}>
            <IntegrationStatusCard
              title="Slack"
              ready={!!status?.slack.configured}
              status={
                status?.slack.configured
                  ? 'Env configured'
                  : 'Not configured (dev simulate still works)'
              }
              detail={`Signing secret: ${status?.slack.signingSecret ? 'yes' : 'no'} · Bot token: ${status?.slack.botToken ? 'yes' : 'no'}${status?.slack.authRequired ? ' · auth required' : ''}`}
              glyph={SlackGlyph}
            />
            <IntegrationStatusCard
              title="Microsoft Teams"
              ready={!!status?.teams.configured}
              status={
                status?.teams.configured
                  ? 'Env configured'
                  : 'Not configured (dev simulate still works)'
              }
              detail={`App id (JWT): ${status?.teams.appId ? 'yes' : 'no'} · Webhook secret: ${status?.teams.webhookSecret ? 'yes' : 'no'}${status?.teams.jwtVerification ? ' · JWT on' : ''}${status?.teams.allowEmulator ? ' · emulator' : ''}${status?.teams.authRequired ? ' · auth required' : ''}`}
              glyph={TeamsGlyph}
            />
            <IntegrationStatusCard
              title="Email (SMTP)"
              ready={!!status?.email?.configured}
              status={
                status?.email?.configured
                  ? 'Outbound SMTP configured'
                  : 'Not configured — outbound emails are logged and skipped'
              }
              detail={`Host: ${status?.email?.outbound.hostValue ?? '—'} · From: ${status?.email?.outbound.from ?? '—'} · Inbound secret: ${status?.email?.inbound.secretConfigured ? 'yes' : 'no'}`}
              lucide={Mail}
            />
            <IntegrationStatusCard
              title="Email (IMAP)"
              ready={!!status?.email?.imap?.configured}
              status={
                status?.email?.imap?.configured
                  ? `Polling ${status.email.imap.mailbox ?? 'INBOX'} every ${status.email.imap.pollMinutes ?? 5}m`
                  : 'Not configured — webhook inbound still works'
              }
              detail={`Host: ${status?.email?.imap?.host ?? '—'} · ${status?.email?.imap?.note ?? ''}`}
              lucide={Inbox}
            />
            <IntegrationStatusCard
              title="Outbound webhooks"
              ready={webhooksEnabled}
              status={
                webhooksEnabled
                  ? `${endpoints.filter((e) => e.isActive).length} active · ${endpoints.length} total`
                  : 'Disabled (WEBHOOKS_ENABLED=false)'
              }
              detail="HMAC-SHA256 signed POSTs on ticket lifecycle events"
              lucide={Webhook}
            />
          </div>
          <p className={styles.meta}>
            Service account:{' '}
            <code>{status?.serviceUserEmail ?? '—'}</code>
            <br />
            Ticket links use <code>APP_PUBLIC_URL</code>:{' '}
            <code>{status?.appPublicUrl ?? '—'}</code>
          </p>
        </section>

        <section className={styles.panel}>
          <PanelHeading icon={Webhook}>Outbound webhooks</PanelHeading>
          <p className={styles.hint}>
            LogIt POSTs JSON to your URL on ticket events. Verify{' '}
            <code>X-LogIt-Signature</code> (HMAC-SHA256 of the raw body,{' '}
            <code>sha256=&lt;hex&gt;</code>) with the endpoint secret. Also check{' '}
            <code>X-LogIt-Event</code>, <code>X-LogIt-Delivery-Id</code>,{' '}
            <code>X-LogIt-Timestamp</code>. See{' '}
            <code>docs/INTEGRATIONS_OUTBOUND_WEBHOOKS.md</code>.
          </p>

          {revealedSecret ? (
            <div className={styles.secretBox}>
              <strong>Signing secret (copy now)</strong>
              <code>{revealedSecret}</code>
              <Button
                type="button"
                variant="secondary"
                onClick={() => copy('webhook-secret', revealedSecret)}
              >
                <Icon icon={Copy} size="sm" />
                {copied === 'webhook-secret' ? 'Copied' : 'Copy secret'}
              </Button>
            </div>
          ) : null}

          {endpoints.length === 0 ? (
            <p className={styles.hint}>No endpoints yet — add one below.</p>
          ) : (
            <ul className={styles.endpointList}>
              {endpoints.map((ep) => (
                <li key={ep.id}>
                  <div className={styles.endpointBody}>
                    <strong>
                      {ep.name}{' '}
                      <span
                        className={
                          ep.isActive ? styles.badgeOn : styles.badgeOff
                        }
                      >
                        {ep.isActive ? 'active' : 'inactive'}
                      </span>
                    </strong>
                    <code>{ep.url}</code>
                    <em>
                      Events: {ep.eventTypes.join(', ') || '—'} · Secret:{' '}
                      {ep.secretHint}
                    </em>

                    {editingId === ep.id ? (
                      <form
                        className={styles.editForm}
                        onSubmit={onSaveEdit}
                      >
                        <label>
                          Name
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            required
                            minLength={2}
                          />
                        </label>
                        <label>
                          URL
                          <input
                            value={editUrl}
                            onChange={(e) => setEditUrl(e.target.value)}
                            required
                            type="url"
                          />
                        </label>
                        <fieldset className={styles.eventSet}>
                          <legend>Events</legend>
                          {eventCatalog.map((code) => (
                            <label key={code} className={styles.checkRow}>
                              <input
                                type="checkbox"
                                checked={editEvents.includes(code)}
                                onChange={() => toggleEditEvent(code)}
                              />
                              {code}
                            </label>
                          ))}
                        </fieldset>
                        <div className={styles.editActions}>
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={whBusy}
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                          <Button type="submit" disabled={whBusy}>
                            {whBusy ? 'Saving…' : 'Save changes'}
                          </Button>
                        </div>
                      </form>
                    ) : null}

                    {deliveriesFor === ep.id ? (
                      <div className={styles.deliveries}>
                        <h3 className={styles.subhead}>Recent deliveries</h3>
                        {deliveries.length === 0 ? (
                          <p className={styles.hint}>
                            No deliveries yet — run a test ping.
                          </p>
                        ) : (
                          <ul className={styles.deliveryList}>
                            {deliveries.map((d) => (
                              <li key={d.id}>
                                <span
                                  className={
                                    d.success
                                      ? styles.deliveryOk
                                      : styles.deliveryFail
                                  }
                                >
                                  {d.success ? 'OK' : 'Fail'}
                                </span>
                                <code>{d.eventType}</code>
                                <span>
                                  HTTP {d.statusCode ?? '—'} ·{' '}
                                  {new Date(d.createdAt).toLocaleString()}
                                </span>
                                {d.error ? (
                                  <em className={styles.deliveryError}>
                                    {d.error}
                                  </em>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ) : null}
                  </div>
                  <div className={styles.endpointActions}>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={whBusy}
                      onClick={() =>
                        editingId === ep.id
                          ? setEditingId(null)
                          : startEdit(ep)
                      }
                    >
                      {editingId === ep.id ? 'Close edit' : 'Edit'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={whBusy}
                      onClick={() => void onToggleActive(ep)}
                    >
                      {ep.isActive ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={whBusy || !ep.isActive}
                      onClick={() => void onTestWebhook(ep.id)}
                    >
                      Test ping
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={whBusy || deliveriesBusy}
                      onClick={() => void onToggleDeliveries(ep.id)}
                    >
                      <Icon icon={History} size="sm" />
                      {deliveriesFor === ep.id ? 'Hide log' : 'Deliveries'}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={whBusy}
                      onClick={() => void onRotateSecret(ep)}
                    >
                      <Icon icon={KeyRound} size="sm" />
                      Rotate secret
                    </Button>
                    <Button
                      type="button"
                      variant="dangerOutline"
                      disabled={whBusy}
                      onClick={() => void onDeleteWebhook(ep.id)}
                    >
                      <Icon icon={Trash2} size="sm" />
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <form className={styles.simForm} onSubmit={onCreateWebhook}>
            <h3 className={styles.subhead}>Add endpoint</h3>
            <label>
              Name
              <input
                value={whName}
                onChange={(e) => setWhName(e.target.value)}
                required
                minLength={2}
                placeholder="Ops notifier"
              />
            </label>
            <label>
              URL
              <input
                value={whUrl}
                onChange={(e) => setWhUrl(e.target.value)}
                required
                type="url"
                placeholder="https://hooks.example.com/logit"
              />
            </label>
            <fieldset className={styles.eventSet}>
              <legend>Events</legend>
              {eventCatalog.map((code) => (
                <label key={code} className={styles.checkRow}>
                  <input
                    type="checkbox"
                    checked={whEvents.includes(code)}
                    onChange={() => toggleEvent(code)}
                  />
                  {code}
                </label>
              ))}
            </fieldset>
            <label className={styles.checkRow}>
              <input
                type="checkbox"
                checked={whActive}
                onChange={(e) => setWhActive(e.target.checked)}
              />
              Active immediately
            </label>
            <Button type="submit" disabled={whBusy}>
              {whBusy ? 'Saving…' : 'Create webhook'}
            </Button>
          </form>
        </section>

        <section className={styles.panel}>
          <PanelHeading icon={Link2}>Webhook URLs</PanelHeading>
          <p className={styles.hint}>
            Paste these into Slack, Teams, or your email inbound parse provider.
            See <code>docs/INTEGRATIONS_SLACK_TEAMS.md</code> and{' '}
            <code>docs/INTEGRATIONS_EMAIL.md</code>.
          </p>
          <ul className={styles.urlList}>
            {[
              ['Slack Events', status?.slack.eventsUrl],
              ['Slack Slash /logit', status?.slack.slashUrl],
              ['Teams messages', status?.teams.messagesUrl],
              ['Email inbound', status?.email?.inbound.webhookUrl],
            ].map(([label, url]) =>
              url ? (
                <li key={label}>
                  <div>
                    <strong>{label}</strong>
                    <code>{url}</code>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => copy(String(label), String(url))}
                  >
                    <Icon icon={Copy} size="sm" />
                    {copied === label ? 'Copied' : 'Copy'}
                  </Button>
                </li>
              ) : null,
            )}
          </ul>
        </section>

        <section className={styles.panel}>
          <PanelHeading icon={Mail}>Email setup</PanelHeading>
          <p className={styles.hint}>
            Outbound uses nodemailer + SMTP. Inbound webhook and optional IMAP
            poller share the same pipeline: reply headers (
            <code>In-Reply-To</code> / <code>References</code>) or subject token{' '}
            <code>[INC-2026-…]</code> comment on a ticket; otherwise a new
            incident is created. Message-IDs are stored for threading and dedupe.
          </p>
          <ol className={styles.steps}>
            <li>
              Set <code>SMTP_HOST</code>, <code>SMTP_PORT</code>,{' '}
              <code>SMTP_USER</code>, <code>SMTP_PASS</code>,{' '}
              <code>EMAIL_FROM</code>, and <code>APP_PUBLIC_URL</code>.
            </li>
            <li>
              Point your inbound parse webhook at the Email inbound URL.
              Optional: <code>EMAIL_INBOUND_SECRET</code> as Bearer auth.
            </li>
            <li>
              Optional IMAP: set <code>IMAP_HOST</code>, <code>IMAP_USER</code>,{' '}
              <code>IMAP_PASS</code> (and <code>IMAP_POLL_MINUTES</code>).
            </li>
            <li>
              Prefer reply-header threading; subject tokens remain a fallback
              (LogIt outbound includes <code>[TICKET-…]</code>).
            </li>
          </ol>
          {status?.email?.imap?.configured ? (
            <Button
              type="button"
              variant="secondary"
              disabled={imapBusy}
              onClick={() => void onImapPoll()}
              className={styles.imapBtn}
            >
              {imapBusy ? 'Polling…' : 'Run IMAP poll now'}
            </Button>
          ) : null}
        </section>

        <section className={styles.panel}>
          <PanelHeading icon={MessageSquareText}>Message examples</PanelHeading>
          <ul className={styles.examples}>
            {(status?.examples ?? []).map((ex) => (
              <li key={ex}>
                <code>{ex}</code>
              </li>
            ))}
          </ul>
          <ol className={styles.steps}>
            <li>Create a Slack app; enable Events + Slash Commands.</li>
            <li>
              Set <code>SLACK_SIGNING_SECRET</code> (and optional{' '}
              <code>SLACK_BOT_TOKEN</code>) in API env.
            </li>
            <li>
              For Teams, point the bot messaging endpoint at the Teams URL. Prefer{' '}
              <code>TEAMS_APP_ID</code> (Bot Framework JWT). Optional fallback:{' '}
              <code>TEAMS_WEBHOOK_SECRET</code> as shared Bearer.
            </li>
            <li>
              Set <code>APP_PUBLIC_URL</code> so chat/email replies include deep
              links.
            </li>
          </ol>
        </section>

        <section className={styles.panel}>
          <PanelHeading icon={Activity}>Monitoring ingest</PanelHeading>
          <p className={styles.hint}>
            External monitors (Prometheus Alertmanager, Datadog, custom) can POST
            alerts to create an <strong>ITSM incident ticket</strong>. This is
            separate from the <a href="/app/im">Incident command (IMS)</a> board —
            promote to IMS manually when you need a war-room / PIR.
          </p>
          <ol className={styles.steps}>
            <li>
              Set <code>MONITORING_INGEST_SECRET</code> in the API environment
              (a long random string).
            </li>
            <li>
              POST JSON to{' '}
              <code>
                {typeof window !== 'undefined'
                  ? `${window.location.origin.replace(/:\d+$/, ':4100')}/api/v1/integrations/monitoring/alerts`
                  : '/api/v1/integrations/monitoring/alerts'}
              </code>{' '}
              with header{' '}
              <code>Authorization: Bearer &lt;MONITORING_INGEST_SECRET&gt;</code>
              .
            </li>
            <li>
              Body fields: <code>title</code>, <code>description</code>, optional{' '}
              <code>severity</code> (<code>sev1</code>–<code>sev4</code> /{' '}
              <code>critical</code>), optional <code>source</code>.
            </li>
          </ol>
          <pre className={styles.hint} style={{ whiteSpace: 'pre-wrap' }}>
            {`curl -X POST "$API/integrations/monitoring/alerts" \\
  -H "Authorization: Bearer $MONITORING_INGEST_SECRET" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"API 5xx spike","description":"p99 latency","severity":"sev2","source":"alertmanager"}'`}
          </pre>
        </section>

        <section className={styles.panel}>
          <PanelHeading icon={Send}>Dev simulate</PanelHeading>
          <p className={styles.hint}>
            Sysadmin-only. Creates a real ticket without Slack/Teams — use this
            to demo the chat-to-ticket flow locally.
          </p>
          <form className={styles.simForm} onSubmit={onSimulate}>
            <label>
              Chat text
              <textarea
                value={simText}
                onChange={(e) => setSimText(e.target.value)}
                rows={3}
                required
              />
            </label>
            <Button type="submit" disabled={busy}>
              {busy ? 'Creating…' : 'Simulate ticket create'}
            </Button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
