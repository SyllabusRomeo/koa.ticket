'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser, type TicketSummary } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import styles from './tickets.module.css';

export default function TicketsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [types, setTypes] = useState<Array<{ code: string; name: string }>>([]);
  const [categories, setCategories] = useState<
    Array<{ code: string; name: string }>
  >([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [typeCode, setTypeCode] = useState('incident');
  const [categoryCode, setCategoryCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [list, meta] = await Promise.all([
      api.listTickets(),
      api.ticketMeta(),
    ]);
    setTickets(list);
    setTypes(meta.types);
    setCategories(meta.categories);
    if (!categoryCode && meta.categories[0]) {
      setCategoryCode(meta.categories[0].code);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (cancelled) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createTicket({
        title,
        description,
        typeCode,
        categoryCode: categoryCode || undefined,
        impact: 'medium',
        urgency: 'medium',
      });
      setTitle('');
      setDescription('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create ticket');
    } finally {
      setSaving(false);
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
      <main className={styles.page}>
        <p>Loading tickets…</p>
      </main>
    );
  }

  const canWrite = can(user, 'tickets:write');

  return (
    <AppShell user={user} onLogout={logout} title="Tickets">
      <section className={styles.grid}>
        {canWrite ? (
          <form className={styles.form} onSubmit={onCreate}>
            <h2>Create ticket</h2>
            <p className={styles.hint}>
              Service and access requests go to <strong>Pending Approval</strong>{' '}
              for approvers.
            </p>
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
              Type
              <select
                value={typeCode}
                onChange={(e) => setTypeCode(e.target.value)}
              >
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value)}
              >
                {categories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={3}
                rows={5}
              />
            </label>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" disabled={saving}>
              {saving ? 'Submitting…' : 'Submit ticket'}
            </button>
          </form>
        ) : (
          <div className={styles.form}>
            <h2>View only</h2>
            <p>Your role can view tickets but cannot create them.</p>
          </div>
        )}

        <div className={styles.list}>
          <h2>Your ticket view</h2>
          {tickets.length === 0 ? (
            <p className={styles.empty}>No tickets yet.</p>
          ) : (
            <ul>
              {tickets.map((t) => (
                <li key={t.id}>
                  <strong>{t.number}</strong>
                  <span>{t.title}</span>
                  <em>
                    {t.status.name}
                    {t.priority ? ` · ${t.priority.name}` : ''} · {t.type.name}
                  </em>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}
