'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser, type TicketSummary } from '@/lib/api';
import {
  can,
  hasRole,
  notificationHref,
  showAgentWorkspace,
  workspaceMission,
  workspaceNextActions,
} from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import {
  AgentWorkspace,
  type WorkspaceMetrics,
} from '@/components/AgentWorkspace';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { StatusBadge } from '@/components/StatusBadge';
import {
  AlertTriangle,
  Bell,
  CircleDot,
  FolderOpen,
  Ticket,
  UserX,
} from 'lucide-react';
import styles from './app.module.css';

type Note = {
  id: string;
  title: string;
  body: string;
  link: string | null;
};

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
  const [workspace, setWorkspace] = useState<WorkspaceMetrics | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function loadHome() {
      try {
        const { user } = await api.me();
        if (cancelled) return;
        setUser(user);

        const agentHome = showAgentWorkspace(user);

        if (agentHome) {
          try {
            const w = await api.reportWorkspace();
            if (!cancelled) setWorkspace(w);
          } catch {
            /* fall back to lighter home */
          }
        } else {
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
    }

    void loadHome();
    const refresh = window.setInterval(() => {
      void loadHome();
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(refresh);
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

  if (showAgentWorkspace(user) && workspace) {
    return (
      <AppShell user={user} onLogout={logout}>
        <AgentWorkspace
          firstName={user.firstName}
          metrics={workspace}
          pendingApprovals={pendingApprovals}
          canWrite={can(user, 'tickets:write')}
          canApprovals={can(user, 'approvals:read')}
          canIm={can(user, 'im:read')}
          isSysadmin={hasRole(user, 'sysadmin')}
        />
        {notes.length > 0 ? (
          <section className={styles.panel} style={{ marginTop: '1.25rem' }}>
            <h2 className={styles.sectionTitle}>
              <Icon icon={Bell} size="sm" />
              Notifications
            </h2>
            <ul className={styles.ticketList}>
              {notes.map((n) => {
                const href = notificationHref(n);
                const content = (
                  <>
                    <strong>{n.title}</strong> {n.body}
                  </>
                );
                return (
                  <li key={n.id}>
                    {href ? (
                      <a className={styles.rowLink} href={href}>
                        {content}
                      </a>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}
      </AppShell>
    );
  }

  const nextActions = workspaceNextActions(user);
  const canSeeTickets =
    can(user, 'tickets:read_own') ||
    can(user, 'tickets:read_queue') ||
    can(user, 'tickets:read_all');

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

        {nextActions.length > 0 ? (
          <div className={styles.nextStep}>
            <p className={styles.nextStepLabel}>Next step</p>
            <div className={styles.ctaRow}>
              {nextActions.map((action) => (
                <a
                  key={action.href}
                  href={action.href}
                  className={
                    action.primary ? styles.btn : styles.btnSecondary
                  }
                >
                  {action.label}
                  {action.href === '/app/approvals' && pendingApprovals > 0
                    ? ` (${pendingApprovals})`
                    : ''}
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {pendingApprovals > 0 &&
        !nextActions.some((a) => a.href === '/app/approvals') ? (
          <p>
            You have <strong>{pendingApprovals}</strong> pending approval
            {pendingApprovals === 1 ? '' : 's'}.{' '}
            <a href="/app/approvals">Review approvals</a>
          </p>
        ) : null}

        {summary ? (
          <div className={styles.stats}>
            <div>
              <span className={styles.statsIcon}><Icon icon={FolderOpen} size="sm" /></span>
              <strong>{summary.openTickets}</strong>
              <span>Open</span>
            </div>
            <div>
              <span className={styles.statsIcon}><Icon icon={Ticket} size="sm" /></span>
              <strong>{summary.createdToday}</strong>
              <span>Created today</span>
            </div>
            <div>
              <span className={styles.statsIcon}><Icon icon={CircleDot} size="sm" /></span>
              <strong>{summary.resolvedToday}</strong>
              <span>Resolved today</span>
            </div>
            <div>
              <span className={styles.statsIcon}><Icon icon={AlertTriangle} size="sm" /></span>
              <strong>{summary.slaBreaches}</strong>
              <span>SLA breaches</span>
            </div>
            <div>
              <span className={styles.statsIcon}><Icon icon={UserX} size="sm" /></span>
              <strong>{summary.unassigned}</strong>
              <span>Unassigned</span>
            </div>
          </div>
        ) : null}

        {canSeeTickets ? (
          <>
            <h2 className={styles.sectionTitle}>
              <Icon icon={Ticket} size="sm" />
              Recent tickets
            </h2>
            {tickets.length === 0 ? (
              <EmptyState icon={Ticket}>
                No tickets in your view yet.{' '}
                {can(user, 'tickets:write') ? (
                  <a href="/app/tickets">Create a ticket</a>
                ) : (
                  <a href="/app/tickets">Open Tickets</a>
                )}
              </EmptyState>
            ) : (
              <ul className={styles.ticketList}>
                {tickets.map((t) => (
                  <li key={t.id}>
                    <a
                      className={styles.rowLink}
                      href={`/app/tickets/${t.number}`}
                    >
                      <div className={styles.ticketRowTop}>
                        <strong>{t.number}</strong>
                        <StatusBadge
                          code={t.status.code}
                          name={t.status.name}
                        />
                      </div>
                      <span>{t.title}</span>
                      {t.priority ? <em>{t.priority.name}</em> : null}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : null}

        {notes.length > 0 ? (
          <>
            <h2 className={styles.sectionTitle}>
              <Icon icon={Bell} size="sm" />
              Notifications
            </h2>
            <ul className={styles.ticketList}>
              {notes.map((n) => {
                const href = notificationHref(n);
                const content = (
                  <>
                    <strong>{n.title}</strong> {n.body}
                  </>
                );
                return (
                  <li key={n.id}>
                    {href ? (
                      <a className={styles.rowLink} href={href}>
                        {content}
                      </a>
                    ) : (
                      content
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        ) : null}
      </section>
    </AppShell>
  );
}
