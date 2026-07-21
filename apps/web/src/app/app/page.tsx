'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser, type TicketSummary } from '@/lib/api';
import { workspaceMission } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import styles from './app.module.css';

export default function AppHomePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [summary, setSummary] = useState<{
    openTickets: number;
    createdToday: number;
    resolvedToday: number;
    slaBreaches: number;
    unassigned: number;
  } | null>(null);
  const [notes, setNotes] = useState<
    Array<{ id: string; title: string; body: string }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (cancelled) return;
        setUser(user);

        try {
          const list = await api.listTickets();
          if (!cancelled) setTickets(list.slice(0, 8));
        } catch {
          /* no ticket access */
        }

        if (user.permissions.includes('reports:read')) {
          try {
            const s = await api.reportSummary();
            if (!cancelled) setSummary(s);
          } catch {
            /* optional */
          }
        }

        if (user.permissions.includes('approvals:read')) {
          try {
            const a = await api.approvals('pending');
            if (!cancelled) setPendingApprovals(a.length);
          } catch {
            /* optional */
          }
        }

        try {
          const n = await api.notifications();
          if (!cancelled) setNotes(n.filter((x) => !x.readAt).slice(0, 5));
        } catch {
          /* optional */
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

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  }

  if (loading) {
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Loading workspace…</p>
      </main>
    );
  }
  if (!user) return null;

  return (
    <AppShell user={user} onLogout={logout}>
      <section className={styles.panel}>
        <h1>
          Welcome, {user.firstName} {user.lastName}
        </h1>
        <p className={styles.lede}>
          Signed in as <strong>{user.email}</strong>
        </p>
        <p className={styles.mission}>{workspaceMission(user)}</p>

        {pendingApprovals > 0 ? (
          <p>
            You have <strong>{pendingApprovals}</strong> pending approval
            {pendingApprovals === 1 ? '' : 's'}.{' '}
            <a href="/app/approvals">Review approvals</a>
          </p>
        ) : null}

        {summary ? (
          <div className={styles.stats}>
            <div>
              <strong>{summary.openTickets}</strong>
              <span>Open</span>
            </div>
            <div>
              <strong>{summary.createdToday}</strong>
              <span>Created today</span>
            </div>
            <div>
              <strong>{summary.resolvedToday}</strong>
              <span>Resolved today</span>
            </div>
            <div>
              <strong>{summary.slaBreaches}</strong>
              <span>SLA breaches</span>
            </div>
            <div>
              <strong>{summary.unassigned}</strong>
              <span>Unassigned</span>
            </div>
          </div>
        ) : null}

        <h2 className={styles.sectionTitle}>Recent tickets</h2>
        {tickets.length === 0 ? (
          <p className={styles.muted}>No tickets in your view yet.</p>
        ) : (
          <ul className={styles.ticketList}>
            {tickets.map((t) => (
              <li key={t.id}>
                <strong>{t.number}</strong> {t.title}
                <em>
                  {t.status.name}
                  {t.priority ? ` · ${t.priority.name}` : ''}
                </em>
              </li>
            ))}
          </ul>
        )}

        {notes.length > 0 ? (
          <>
            <h2 className={styles.sectionTitle}>Notifications</h2>
            <ul className={styles.ticketList}>
              {notes.map((n) => (
                <li key={n.id}>
                  <strong>{n.title}</strong> {n.body}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
