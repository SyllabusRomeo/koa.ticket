'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import styles from '../../tickets/tickets.module.css';

type ImDetail = Awaited<ReturnType<typeof api.getImIncident>>;

export default function ImDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const idOrNumber = decodeURIComponent(params.id ?? '');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [incident, setIncident] = useState<ImDetail | null>(null);
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const row = await api.getImIncident(idOrNumber);
    setIncident(row);
  }, [idOrNumber]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (cancelled) return;
        if (!can(user, 'im:read')) {
          router.replace('/app');
          return;
        }
        setUser(user);
        await load();
      } catch {
        if (!cancelled) router.replace('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load, router]);

  async function onUpdate(e: FormEvent) {
    e.preventDefault();
    if (!incident || !can(user, 'im:write')) return;
    setBusy(true);
    setError(null);
    try {
      await api.addImUpdate(incident.number, {
        body,
        isInternal,
      });
      setBody('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not post update');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <main className={styles.page}>
        <p>Loading incident…</p>
      </main>
    );
  }

  if (!incident) {
    return (
      <AppShell
        user={user}
        onLogout={() => api.logout().then(() => router.replace('/login'))}
        title="Incident"
      >
        <p className={styles.error}>Incident not found.</p>
        <a href="/app/im">Back to IM</a>
      </AppShell>
    );
  }

  return (
    <AppShell
      user={user}
      onLogout={() => api.logout().then(() => router.replace('/login'))}
      title={incident.number}
    >
      <div className={styles.detail}>
        <header className={styles.detailHead}>
          <div>
            <p className={styles.eyebrow}>{incident.number}</p>
            <h1>{incident.title}</h1>
            <p className={styles.meta}>
              {incident.severity.toUpperCase()} · {incident.status}
              {incident.commander
                ? ` · Commander ${incident.commander.firstName} ${incident.commander.lastName}`
                : ''}
            </p>
            {incident.summary ? <p>{incident.summary}</p> : null}
            {incident.ticket ? (
              <p className={styles.hint}>
                Linked ITSM:{' '}
                <a
                  href={`/app/tickets/${encodeURIComponent(incident.ticket.number)}`}
                >
                  {incident.ticket.number}
                </a>
              </p>
            ) : null}
          </div>
          <a href="/app/im">← Board</a>
        </header>

        <section className={styles.actionsPanel}>
          <h3>Timeline</h3>
          <ul className={styles.activityList}>
            {incident.updates.map((u) => (
              <li key={u.id}>
                <div className={styles.activityMeta}>
                  <strong>
                    {u.author.firstName} {u.author.lastName}
                  </strong>
                  <span>{new Date(u.createdAt).toLocaleString()}</span>
                  {u.isInternal ? <span> · internal</span> : null}
                </div>
                <p>{u.body}</p>
              </li>
            ))}
          </ul>

          {can(user, 'im:write') ? (
            <form onSubmit={onUpdate} className={styles.commentForm}>
              <label>
                Post update
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                  rows={3}
                />
              </label>
              <label className={styles.check}>
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                />
                Internal only
              </label>
              {error ? (
                <p className={styles.error} role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" disabled={busy}>
                {busy ? 'Posting…' : 'Post'}
              </Button>
            </form>
          ) : null}
        </section>

        {incident.roles.length ? (
          <section className={styles.actionsPanel}>
            <h3>Roles</h3>
            <ul>
              {incident.roles.map((r) => (
                <li key={`${r.role}-${r.user.id}`}>
                  <strong>{r.role}</strong> — {r.user.firstName}{' '}
                  {r.user.lastName}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
