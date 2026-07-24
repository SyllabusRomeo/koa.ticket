'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Siren } from 'lucide-react';
import styles from '../tickets/tickets.module.css';

type ImRow = {
  id: string;
  number: string;
  title: string;
  severity: string;
  status: string;
  startedAt: string;
  commander?: { firstName: string; lastName: string } | null;
  ticket?: { number: string } | null;
  _count?: { updates: number };
};

export default function ImBoardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rows, setRows] = useState<ImRow[]>([]);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [severity, setSeverity] = useState('sev2');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const list = await api.listImIncidents();
    setRows(list);
  }

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
  }, [router]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!can(user, 'im:write')) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createImIncident({
        title,
        summary: summary || undefined,
        severity,
      });
      setTitle('');
      setSummary('');
      router.push(`/app/im/${encodeURIComponent(created.number)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not declare incident');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return (
      <main className={styles.page}>
        <p>Loading incidents…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={() => api.logout().then(() => router.replace('/login'))} title="Incident Management">
      <div className={styles.layout}>
        {can(user, 'im:write') ? (
          <form className={styles.form} onSubmit={onCreate}>
            <h2>Declare incident</h2>
            <label>
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={3}
              />
            </label>
            <label>
              Severity
              <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
                <option value="sev1">SEV1</option>
                <option value="sev2">SEV2</option>
                <option value="sev3">SEV3</option>
                <option value="sev4">SEV4</option>
              </select>
            </label>
            <label>
              Summary
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={3}
              />
            </label>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={saving}>
              {saving ? 'Declaring…' : 'Declare'}
            </Button>
          </form>
        ) : null}

        <div className={styles.list}>
          <div className={styles.listHead}>
            <h2>Active & recent</h2>
          </div>
          {rows.length === 0 ? (
            <EmptyState icon={Siren}>No IM incidents yet.</EmptyState>
          ) : (
            <ul className={styles.ticketList}>
              {rows.map((r) => (
                <li key={r.id}>
                  <a href={`/app/im/${encodeURIComponent(r.number)}`}>
                    <strong>{r.number}</strong> · {r.title}
                  </a>
                  <div className={styles.meta}>
                    {r.severity.toUpperCase()} · {r.status}
                    {r.commander
                      ? ` · ${r.commander.firstName} ${r.commander.lastName}`
                      : ''}
                    {r.ticket ? ` · ITSM ${r.ticket.number}` : ''}
                    {r._count?.updates != null
                      ? ` · ${r._count.updates} updates`
                      : ''}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
