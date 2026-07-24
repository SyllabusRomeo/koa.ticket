'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import styles from '../../tickets/tickets.module.css';

type ImDetail = Awaited<ReturnType<typeof api.getImIncident>>;
type StaffUser = Awaited<ReturnType<typeof api.listUsers>>[number];

const ROLE_OPTIONS = [
  { value: 'commander', label: 'Commander' },
  { value: 'scribe', label: 'Scribe' },
  { value: 'comms', label: 'Comms' },
  { value: 'responder', label: 'Responder' },
] as const;

export default function ImDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const idOrNumber = decodeURIComponent(params.id ?? '');
  const [user, setUser] = useState<AuthUser | null>(null);
  const [incident, setIncident] = useState<ImDetail | null>(null);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [body, setBody] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [roleUserId, setRoleUserId] = useState('');
  const [roleCode, setRoleCode] =
    useState<(typeof ROLE_OPTIONS)[number]['value']>('commander');
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
      let sessionUser: AuthUser;
      try {
        const { user } = await api.me();
        if (cancelled) return;
        if (!can(user, 'im:read')) {
          router.replace('/app');
          return;
        }
        sessionUser = user;
        setUser(user);
      } catch {
        if (!cancelled) router.replace('/login');
        return;
      }
      try {
        await load();
        if (
          can(sessionUser, 'im:write') ||
          can(sessionUser, 'im:command') ||
          can(sessionUser, 'users:read')
        ) {
          try {
            const users = await api.listUsers();
            if (!cancelled) {
              setStaff(users.filter((u) => u.isActive));
            }
          } catch {
            /* optional for role assign */
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load incident',
          );
        }
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

  async function onAssignRole(e: FormEvent) {
    e.preventDefault();
    if (!incident || !roleUserId) return;
    if (!can(user, 'im:write') && !can(user, 'im:command')) return;
    setBusy(true);
    setError(null);
    try {
      await api.assignImRole(incident.number, {
        userId: roleUserId,
        role: roleCode,
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not assign role');
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
        <a href="/app/im">Back to Incidents</a>
      </AppShell>
    );
  }

  const canCommand = can(user, 'im:write') || can(user, 'im:command');

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
          <div className={styles.detailActions}>
            {can(user, 'im:write') ? (
              <label className={styles.field}>
                Status
                <select
                  value={incident.status}
                  disabled={busy}
                  onChange={async (e) => {
                    const next = e.target.value as
                      | 'declared'
                      | 'active'
                      | 'mitigated'
                      | 'resolved'
                      | 'closed';
                    setBusy(true);
                    setError(null);
                    try {
                      await api.updateImStatus(incident.number, next);
                      await load();
                    } catch (err) {
                      setError(
                        err instanceof Error
                          ? err.message
                          : 'Could not update status',
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <option value="declared">Declared</option>
                  <option value="active">Active</option>
                  <option value="mitigated">Mitigated</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError(null);
                try {
                  const pir = await api.getImPir(incident.number);
                  const blob = new Blob([pir.markdown], {
                    type: 'text/markdown;charset=utf-8',
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${pir.number}-PIR.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  setError(
                    err instanceof Error ? err.message : 'PIR export failed',
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Export PIR
            </Button>
            <a href="/app/im">← Board</a>
          </div>
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

        <section className={styles.actionsPanel}>
          <h3>Roles</h3>
          {incident.roles.length ? (
            <ul>
              {incident.roles.map((r) => (
                <li key={`${r.role}-${r.user.id}`}>
                  <strong>{r.role}</strong> — {r.user.firstName}{' '}
                  {r.user.lastName}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.hint}>No roles assigned yet.</p>
          )}

          {canCommand ? (
            <form onSubmit={onAssignRole} className={styles.commentForm}>
              <label>
                Person
                <select
                  value={roleUserId}
                  onChange={(e) => setRoleUserId(e.target.value)}
                  required
                >
                  <option value="">Select user…</option>
                  {staff.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.firstName} {u.lastName} ({u.email})
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Role
                <select
                  value={roleCode}
                  onChange={(e) =>
                    setRoleCode(
                      e.target.value as (typeof ROLE_OPTIONS)[number]['value'],
                    )
                  }
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" disabled={busy || !roleUserId}>
                Assign role
              </Button>
            </form>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
