'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import styles from '../app.module.css';

export default function AuditPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rows, setRows] = useState<
    Array<{
      id: string;
      action: string;
      entityType: string;
      entityId: string | null;
      createdAt: string;
      actor: { email: string; firstName: string; lastName: string } | null;
    }>
  >([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (!can(user, 'audit:read')) {
          router.replace('/app');
          return;
        }
        if (!cancelled) setUser(user);
        const data = await api.audit(80);
        if (!cancelled) setRows(data);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed');
          router.replace('/login');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

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
        <p className={styles.muted}>Loading audit…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="Audit trail">
      <section className={styles.panel}>
        <p className={styles.mission}>
          Read-only business audit events. Records are not editable.
        </p>
        {error ? <p className={styles.error}>{error}</p> : null}
        <ul className={styles.ticketList}>
          {rows.map((r) => (
            <li key={r.id}>
              <strong>{r.action}</strong> on {r.entityType}
              {r.entityId ? ` (${r.entityId.slice(0, 8)}…)` : ''}
              <em>
                {r.actor
                  ? `${r.actor.firstName} ${r.actor.lastName} · ${r.actor.email}`
                  : 'system'}{' '}
                · {new Date(r.createdAt).toLocaleString()}
              </em>
            </li>
          ))}
        </ul>
      </section>
    </AppShell>
  );
}
