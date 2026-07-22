'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  type AuthUser,
  type TicketSummary,
} from '@/lib/api';
import { can, showAgentWorkspace } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { SlaTimer } from '@/components/SlaTimer';
import { Button, ButtonLink } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { GitBranchPlus, Plus, Search } from 'lucide-react';
import styles from '../tickets/tickets.module.css';

export default function ProblemsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [problems, setProblems] = useState<TicketSummary[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openOnly, setOpenOnly] = useState(true);

  async function load() {
    const list = await api.listTickets({ typeCode: 'problem' });
    setProblems(list);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user: me } = await api.me();
        if (cancelled) return;
        if (!showAgentWorkspace(me)) {
          router.replace('/app/tickets');
          return;
        }
        setUser(me);
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

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      const created = await api.createTicket({
        title: title.trim(),
        description: description.trim(),
        typeCode: 'problem',
      });
      setTitle('');
      setDescription('');
      router.push(`/app/tickets/${encodeURIComponent(created.number)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create problem');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) {
    return (
      <main className={styles.page}>
        <p>Loading problems…</p>
      </main>
    );
  }

  const canWrite = can(user, 'tickets:write');
  const visible = openOnly
    ? problems.filter((p) => !p.status.isTerminal)
    : problems;

  return (
    <AppShell user={user} onLogout={logout} title="Problems">
      <div className={styles.top}>
        <div>
          <p className={styles.eyebrow}>Problem management</p>
          <h1>Problems</h1>
          <p className={styles.hint}>
            Track root causes and known errors. Link related incidents as
            children on the problem record.
          </p>
        </div>
        <ButtonLink href="/app/tickets" variant="tertiary">
          All tickets
        </ButtonLink>
      </div>

      <section className={styles.grid}>
        {canWrite ? (
          <form className={styles.form} onSubmit={onCreate}>
            <h2>
              <Icon icon={Plus} size="sm" />
              Raise a problem
            </h2>
            <p className={styles.hint}>
              Or open an incident and use <strong>Raise problem</strong> to
              create a PRB linked to that ticket.
            </p>
            <label>
              Title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                minLength={3}
                placeholder="Recurring VPN disconnects"
              />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={3}
                rows={5}
                placeholder="Symptoms, impact, related incidents…"
              />
            </label>
            {error ? <p className={styles.error}>{error}</p> : null}
            <button type="submit" className={styles.btn} disabled={saving}>
              Create PRB
            </button>
          </form>
        ) : null}

        <div className={styles.list}>
          <div className={styles.listHead}>
            <h2>
              <Icon icon={Search} size="sm" />
              Problem queue
            </h2>
            <label className={styles.checkLabel}>
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(e) => setOpenOnly(e.target.checked)}
              />
              Open only
            </label>
          </div>
          {visible.length === 0 ? (
            <EmptyState icon={GitBranchPlus}>
              No problems yet. Raise one here or promote from an incident.
            </EmptyState>
          ) : (
            <ul className={styles.commentList}>
              {visible.map((t) => (
                <li key={t.id}>
                  <a
                    href={`/app/tickets/${encodeURIComponent(t.number)}`}
                    className={styles.ticketLink}
                  >
                    <div className={styles.ticketRowTop}>
                      <strong>{t.number}</strong>
                      <div className={styles.ticketRowBadges}>
                        <SlaTimer
                          dueAt={t.dueAt}
                          slaDueAt={t.slaDueAt}
                          slaRemainingMs={t.slaRemainingMs}
                          slaBreached={t.slaBreached}
                          slaPaused={t.slaPaused}
                          slaCompleted={t.slaCompleted}
                          timeToResolution={t.timeToResolution}
                        />
                        <StatusBadge
                          code={t.status.code}
                          name={t.status.name}
                        />
                      </div>
                    </div>
                    <span>{t.title}</span>
                    <em>
                      {[
                        t.priority?.name,
                        t.assignee
                          ? `${t.assignee.firstName} ${t.assignee.lastName}`.trim()
                          : 'Unassigned',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </em>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}
