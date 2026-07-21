'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { hasRole } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import appStyles from '../../app.module.css';
import styles from './integrations.module.css';
import { Link2, Plug, Play } from 'lucide-react';
import { Icon } from '@/components/Icon';

type Status = Awaited<ReturnType<typeof api.integrationsStatus>>;

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
  const [copied, setCopied] = useState<string | null>(null);

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
        const s = await api.integrationsStatus();
        if (!cancelled) setStatus(s);
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
            Connect Slack and Microsoft Teams so people can create LogIT tickets
            with a slash command or @mention. Secrets live in environment
            variables — never in the database.
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
                App id: {status?.teams.appId ? 'yes' : 'no'} · Webhook secret:{' '}
                {status?.teams.webhookSecret ? 'yes' : 'no'}
              </em>
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
          <h2>
            Webhook URLs
          </h2>
          <p className={styles.hint}>
            Paste these into the Slack app or Teams bot messaging endpoint.
            Full setup: docs/INTEGRATIONS_SLACK_TEAMS.md
          </p>
          <ul className={styles.urlList}>
            {[
              ['Slack Events', status?.slack.eventsUrl],
              ['Slack Slash /logit', status?.slack.slashUrl],
              ['Teams messages', status?.teams.messagesUrl],
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
              Set <code>APP_PUBLIC_URL</code> so chat replies include deep links.
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
