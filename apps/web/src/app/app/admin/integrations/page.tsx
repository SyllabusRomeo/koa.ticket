'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser, type WebhookEndpoint } from '@/lib/api';
import { hasRole } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import appStyles from '../../app.module.css';
import styles from './integrations.module.css';

type Status = Awaited<ReturnType<typeof api.integrationsStatus>>;

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
          api.webhookEvents().catch(() => ({ enabled: true, events: DEFAULT_EVENTS })),
          api.webhookEndpoints().catch(() => [] as WebhookEndpoint[]),
        ]);
        if (!cancelled) {
          setStatus(s);
          setWebhooksEnabled(events.enabled);
          setEventCatalog(events.events?.length ? events.events : DEFAULT_EVENTS);
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
      setResult(`Webhook “${created.name}” created. Copy the secret now — it won’t be shown again.`);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Test ping failed');
    } finally {
      setWhBusy(false);
    }
  }

  async function onDeleteWebhook(id: string) {
    if (!window.confirm('Delete this webhook endpoint?')) return;
    setWhBusy(true);
    setError(null);
    try {
      await api.deleteWebhookEndpoint(id);
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
            update LogIT tickets from chat or mailbox. Configure signed outbound
            webhooks for external systems. Chat secrets live in environment
            variables; outbound webhook secrets are stored per endpoint.
          </p>
        </header>

        {error ? (
          <p className={appStyles.error} role="alert">
            {error}
          </p>
        ) : null}

        <section className={styles.panel}>
          <h2>
            Status
          </h2>
          <div className={styles.statusGrid}>
            <div
              className={`${styles.statusCard} ${
                status?.slack.configured ? styles.ready : styles.pending
              }`}
            >
              <strong>Slack</strong>
              <span>
                {status?.slack.configured
                  ? 'Env configured'
                  : 'Not configured (dev simulate still works)'}
              </span>
              <em>
                Signing secret:{' '}
                {status?.slack.signingSecret ? 'yes' : 'no'} · Bot token:{' '}
                {status?.slack.botToken ? 'yes' : 'no'}
                {status?.slack.authRequired ? ' · auth required' : ''}
              </em>
            </div>
            <div
              className={`${styles.statusCard} ${
                status?.teams.configured ? styles.ready : styles.pending
              }`}
            >
              <strong>Microsoft Teams</strong>
              <span>
                {status?.teams.configured
                  ? 'Env configured'
                  : 'Not configured (dev simulate still works)'}
              </span>
              <em>
                App id (JWT): {status?.teams.appId ? 'yes' : 'no'} · Webhook
                secret: {status?.teams.webhookSecret ? 'yes' : 'no'}
                {status?.teams.jwtVerification ? ' · JWT on' : ''}
                {status?.teams.allowEmulator ? ' · emulator' : ''}
                {status?.teams.authRequired ? ' · auth required' : ''}
              </em>
            </div>
            <div
              className={`${styles.statusCard} ${
                status?.email?.configured ? styles.ready : styles.pending
              }`}
            >
              <strong>Email (SMTP)</strong>
              <span>
                {status?.email?.configured
                  ? 'Outbound SMTP configured'
                  : 'Not configured — outbound emails are logged and skipped'}
              </span>
              <em>
                Host: {status?.email?.outbound.hostValue ?? '—'} · From:{' '}
                {status?.email?.outbound.from ?? '—'} · Inbound secret:{' '}
                {status?.email?.inbound.secretConfigured ? 'yes' : 'no'}
              </em>
            </div>
            <div
              className={`${styles.statusCard} ${
                status?.email?.imap?.configured ? styles.ready : styles.pending
              }`}
            >
              <strong>Email (IMAP)</strong>
              <span>
                {status?.email?.imap?.configured
                  ? `Polling ${status.email.imap.mailbox ?? 'INBOX'} every ${status.email.imap.pollMinutes ?? 5}m`
                  : 'Not configured — webhook inbound still works'}
              </span>
              <em>
                Host: {status?.email?.imap?.host ?? '—'} ·{' '}
                {status?.email?.imap?.note ?? ''}
              </em>
            </div>
            <div
              className={`${styles.statusCard} ${
                webhooksEnabled ? styles.ready : styles.pending
              }`}
            >
              <strong>Outbound webhooks</strong>
              <span>
                {webhooksEnabled
                  ? `${endpoints.filter((e) => e.isActive).length} active · ${endpoints.length} total`
                  : 'Disabled (WEBHOOKS_ENABLED=false)'}
              </span>
              <em>HMAC-SHA256 signed POSTs on ticket lifecycle events</em>
            </div>
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
          <h2>Outbound webhooks</h2>
          <p className={styles.hint}>
            LogIT POSTs JSON to your URL on ticket events. Verify{' '}
            <code>X-LogIT-Signature</code> (HMAC-SHA256 of the raw body,{' '}
            <code>sha256=&lt;hex&gt;</code>) with the endpoint secret. Also
            check <code>X-LogIT-Event</code>, <code>X-LogIT-Delivery-Id</code>,{' '}
            <code>X-LogIT-Timestamp</code>. Docs:{' '}
            INTEGRATIONS_OUTBOUND_WEBHOOKS.md
          </p>

          {revealedSecret ? (
            <div className={styles.secretBox}>
              <strong>New signing secret (copy now)</strong>
              <code>{revealedSecret}</code>
              <button
                type="button"
                className={styles.copyBtn}
                onClick={() => copy('webhook-secret', revealedSecret)}
              >
                {copied === 'webhook-secret' ? 'Copied' : 'Copy secret'}
              </button>
            </div>
          ) : null}

          {endpoints.length === 0 ? (
            <p className={styles.hint}>No endpoints yet — add one below.</p>
          ) : (
            <ul className={styles.endpointList}>
              {endpoints.map((ep) => (
                <li key={ep.id}>
                  <div>
                    <strong>
                      {ep.name}{' '}
                      <span className={ep.isActive ? styles.badgeOn : styles.badgeOff}>
                        {ep.isActive ? 'active' : 'inactive'}
                      </span>
                    </strong>
                    <code>{ep.url}</code>
                    <em>
                      Events: {ep.eventTypes.join(', ') || '—'} · Secret:{' '}
                      {ep.secretHint}
                    </em>
                  </div>
                  <div className={styles.endpointActions}>
                    <button
                      type="button"
                      className={styles.copyBtn}
                      disabled={whBusy}
                      onClick={() => void onToggleActive(ep)}
                    >
                      {ep.isActive ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      className={styles.copyBtn}
                      disabled={whBusy || !ep.isActive}
                      onClick={() => void onTestWebhook(ep.id)}
                    >
                      Test ping
                    </button>
                    <button
                      type="button"
                      className={styles.copyBtn}
                      disabled={whBusy}
                      onClick={() => void onDeleteWebhook(ep.id)}
                    >
                      Delete
                    </button>
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
            <button type="submit" className={appStyles.btn} disabled={whBusy}>
              {whBusy ? 'Saving…' : 'Create webhook'}
            </button>
          </form>
        </section>

        <section className={styles.panel}>
          <h2>
            Webhook URLs
          </h2>
          <p className={styles.hint}>
            Paste these into Slack, Teams, or your email inbound parse provider.
            Docs: INTEGRATIONS_SLACK_TEAMS.md · INTEGRATIONS_EMAIL.md
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
                  <button
                    type="button"
                    className={styles.copyBtn}
                    onClick={() => copy(String(label), String(url))}
                  >
                    {copied === label ? 'Copied' : 'Copy'}
                  </button>
                </li>
              ) : null,
            )}
          </ul>
        </section>

        <section className={styles.panel}>
          <h2>Email setup</h2>
          <p className={styles.hint}>
            Outbound uses nodemailer + SMTP. Inbound webhook and optional IMAP
            poller share the same pipeline: reply headers (
            <code>In-Reply-To</code> / <code>References</code>) or subject token{' '}
            <code>[INC-2026-…]</code> comment on a ticket; otherwise a new
            incident is created. Message-IDs are stored for threading and
            dedupe.
          </p>
          <ol className={styles.steps}>
            <li>
              Set <code>SMTP_HOST</code>, <code>SMTP_PORT</code>,{' '}
              <code>SMTP_USER</code>, <code>SMTP_PASS</code>,{' '}
              <code>EMAIL_FROM</code>, and <code>APP_PUBLIC_URL</code>.
            </li>
            <li>
              Point your inbound parse webhook at the Email inbound URL. Optional:{' '}
              <code>EMAIL_INBOUND_SECRET</code> as Bearer auth.
            </li>
            <li>
              Optional IMAP: set <code>IMAP_HOST</code>, <code>IMAP_USER</code>,{' '}
              <code>IMAP_PASS</code> (and <code>IMAP_POLL_MINUTES</code>).
            </li>
            <li>
              Prefer reply-header threading; subject tokens remain a fallback
              (LogIT outbound includes <code>[TICKET-…]</code>).
            </li>
          </ol>
          {status?.email?.imap?.configured ? (
            <button
              type="button"
              className={appStyles.btnSecondary}
              disabled={imapBusy}
              onClick={() => void onImapPoll()}
              style={{ marginTop: '0.75rem' }}
            >
              {imapBusy ? 'Polling…' : 'Run IMAP poll now'}
            </button>
          ) : null}
        </section>

        <section className={styles.panel}>
          <h2>Message examples</h2>
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
              For Teams, point the bot messaging endpoint at the Teams URL and
              set <code>TEAMS_WEBHOOK_SECRET</code>.
            </li>
            <li>
              Set <code>APP_PUBLIC_URL</code> so chat/email replies include deep
              links.
            </li>
          </ol>
        </section>

        <section className={styles.panel}>
          <h2>
            Dev simulate
          </h2>
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
            <button type="submit" className={appStyles.btn} disabled={busy}>
              {busy ? 'Creating…' : 'Simulate ticket create'}
            </button>
          </form>
          {result ? (
            <pre className={styles.result}>{result}</pre>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
