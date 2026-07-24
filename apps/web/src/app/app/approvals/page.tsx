'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type ApprovalItem, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import styles from '../app.module.css';
import { Check, ClipboardCheck, X } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';

export default function ApprovalsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<ApprovalItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setItems(await api.approvals('pending'));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (!can(user, 'approvals:read')) {
          router.replace('/app');
          return;
        }
        if (!cancelled) setUser(user);
      } catch {
        if (!cancelled) router.replace('/login');
        return;
      }
      try {
        await load();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load approvals');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function decide(id: string, decision: 'approved' | 'rejected') {
    setBusyId(id);
    setError(null);
    try {
      const comment =
        decision === 'rejected'
          ? window.prompt('Rejection comment (optional)') ?? undefined
          : window.prompt('Approval comment (optional)') ?? undefined;
      await api.decideApproval(id, decision, comment || undefined);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Decision failed');
    } finally {
      setBusyId(null);
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
        <p className={styles.muted}>Loading approvals…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="Approvals">
      <section className={styles.panel}>
        <p className={styles.mission}>
          Approve or reject service and access requests assigned to you. Use
          Approve / Reject on each row below.
        </p>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {items.length === 0 ? (
          <EmptyState icon={ClipboardCheck}>
            No pending approvals right now.{' '}
            <a href="/app">Back to Home</a>
          </EmptyState>
        ) : (
          <ul className={styles.ticketList}>
            {items.map((a) => (
              <li key={a.id}>
                <strong>{a.ticket.number}</strong> {a.ticket.title}
                <em>
                  {a.ticket.type.name}
                  {a.step
                    ? ` · Step ${a.step.stepOrder}: ${a.step.name}`
                    : ''}
                  {a.policy ? ` · ${a.policy.name}` : ''}
                  {' · Requester '}
                  {a.ticket.requester.firstName} {a.ticket.requester.lastName} (
                  {a.ticket.requester.email})
                </em>
                {can(user, 'approvals:decide') ? (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={styles.btnSuccess}
                      disabled={busyId === a.id}
                      onClick={() => decide(a.id, 'approved')}
                    >
                      <Icon icon={Check} size="sm" />
                      Approve
                    </button>
                    <button
                      type="button"
                      className={styles.btnDanger}
                      disabled={busyId === a.id}
                      onClick={() => decide(a.id, 'rejected')}
                    >
                      <Icon icon={X} size="sm" />
                      Reject
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
