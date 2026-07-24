'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser, type TicketSummary } from '@/lib/api';
import { showAgentWorkspace } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { EmptyState } from '@/components/EmptyState';
import { StatusBadge } from '@/components/StatusBadge';
import { SlaTimer } from '@/components/SlaTimer';
import { Icon } from '@/components/Icon';
import {
  AlertTriangle,
  GitBranch,
  History,
  RefreshCw,
  Siren,
  UserX,
} from 'lucide-react';
import { SectionHeading } from '@/components/SectionHeading';
import styles from './mi.module.css';

type MiTicket = TicketSummary & {
  children?: Array<{
    id: string;
    number: string;
    title: string;
    status: { code: string; name: string; isTerminal?: boolean };
    priority?: { code: string; name: string } | null;
    type: { code: string; name: string };
    assignee?: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
  }>;
  parent?: {
    id: string;
    number: string;
    title: string;
    majorIncident?: boolean;
    status: { code: string; name: string };
  } | null;
};

type OpsData = {
  kpis: {
    active: number;
    breached: number;
    unassigned: number;
    withRelated: number;
    resolvedLast7d: number;
    totalTracked: number;
  };
  active: MiTicket[];
  recentlyResolved: TicketSummary[];
  generatedAt: string;
};

function personLabel(
  p?: { firstName?: string; lastName?: string; email?: string } | null,
) {
  if (!p) return 'Unassigned';
  const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
  return name || p.email || 'Unassigned';
}

function isBreached(t: TicketSummary) {
  return (
    !!t.slaBreached || (t.slaRemainingMs != null && t.slaRemainingMs < 0)
  );
}

export default function MajorIncidentsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [data, setData] = useState<OpsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const ops = await api.majorIncidentsOps();
    setData(ops);
  }, []);

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
      } catch {
        if (!cancelled) router.replace('/login');
        return;
      }
      try {
        await load();
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Could not load major incidents',
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, load]);

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  }

  async function refresh() {
    setLoading(true);
    try {
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to refresh');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !data) {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>Loading major incident ops…</p>
      </main>
    );
  }

  if (!user) return null;

  const kpis = data?.kpis;

  return (
    <AppShell user={user} onLogout={logout} title="Major incidents">
      <div className={styles.page}>
        <header className={styles.hero}>
          <div>
            <p className={styles.eyebrow}>War room</p>
            <h1>Major incidents</h1>
            <p className={styles.lede}>
              Active P1 / business-critical outages, related work, and SLA
              pressure — one place to coordinate response.
            </p>
          </div>
          <div className={styles.ctaRow}>
            <a
              href="/app/tickets?queue=major"
              className={`${styles.cta} ${styles.ctaSolid}`}
            >
              Tickets · Major filter
            </a>
            <button type="button" className={styles.cta} onClick={() => void refresh()}>
              <Icon icon={RefreshCw} size="sm" />
              Refresh
            </button>
          </div>
        </header>

        {error ? <p className={styles.quiet}>{error}</p> : null}

        {kpis ? (
          <section className={styles.kpiRow} aria-label="Major incident KPIs">
            <div className={styles.kpi}>
              <strong>{kpis.active}</strong>
              <span>Active MI</span>
            </div>
            <div
              className={`${styles.kpi} ${
                kpis.breached > 0 ? styles.kpiAlert : ''
              }`}
            >
              <strong>{kpis.breached}</strong>
              <span>SLA breached</span>
            </div>
            <div
              className={`${styles.kpi} ${
                kpis.unassigned > 0 ? styles.kpiAlert : ''
              }`}
            >
              <strong>{kpis.unassigned}</strong>
              <span>Unassigned</span>
            </div>
            <div className={styles.kpi}>
              <strong>{kpis.withRelated}</strong>
              <span>With related work</span>
            </div>
            <div className={styles.kpi}>
              <strong>{kpis.resolvedLast7d}</strong>
              <span>Resolved (7d)</span>
            </div>
          </section>
        ) : null}

        <section className={styles.section} aria-labelledby="active-mi">
          <div className={styles.sectionHead}>
            <h2 id="active-mi">
              <Icon icon={Siren} size="sm" />
              Active major incidents
            </h2>
            {data ? (
              <span className={styles.meta}>
                Updated {new Date(data.generatedAt).toLocaleTimeString()}
              </span>
            ) : null}
          </div>
          <p className={styles.hint}>
            Grouped with child tickets when linked. Mark incidents as major from
            ticket detail; link related work under Related tickets.
          </p>

          {!data || data.active.length === 0 ? (
            <EmptyState icon={AlertTriangle}>
              No active major incidents. Clear skies — or flag one from an
              incident ticket.
            </EmptyState>
          ) : (
            <ul className={styles.cards}>
              {data.active.map((t) => {
                const breached = isBreached(t);
                return (
                  <li
                    key={t.id}
                    className={`${styles.card} ${
                      breached ? styles.cardBreached : ''
                    }`}
                  >
                    <div className={styles.cardTop}>
                      <a href={`/app/tickets/${encodeURIComponent(t.number)}`}>
                        {t.number}
                      </a>
                      <div className={styles.badges}>
                        <span className={styles.miBadge}>
                          <Icon icon={AlertTriangle} size="sm" />
                          Major
                        </span>
                        <StatusBadge
                          code={t.status.code}
                          name={t.status.name}
                        />
                        <SlaTimer
                          dueAt={t.dueAt}
                          slaDueAt={t.slaDueAt}
                          slaRemainingMs={t.slaRemainingMs}
                          slaBreached={t.slaBreached}
                          slaPaused={t.slaPaused}
                          slaCompleted={t.slaCompleted}
                          timeToResolution={t.timeToResolution}
                        />
                      </div>
                    </div>
                    <p className={styles.title}>
                      <a href={`/app/tickets/${encodeURIComponent(t.number)}`}>
                        {t.title}
                      </a>
                    </p>
                    <p className={styles.cardMeta}>
                      {t.priority?.name ?? 'No priority'}
                      {' · '}
                      {personLabel(t.assignee)}
                      {t.team ? ` · ${t.team.name}` : ''}
                      {t.location
                        ? ` · ${t.location.site ? `${t.location.name} · ${t.location.site}` : t.location.name}`
                        : ''}
                      {!t.assignee ? (
                        <>
                          {' · '}
                          <Icon icon={UserX} size="sm" /> unassigned
                        </>
                      ) : null}
                    </p>

                    {t.parent || (t.children && t.children.length > 0) ? (
                      <div className={styles.related}>
                        <h3>
                          <Icon icon={GitBranch} size="sm" /> Related work
                        </h3>
                        <ul>
                          {t.parent ? (
                            <li>
                              <span>Parent</span>
                              <a
                                href={`/app/tickets/${encodeURIComponent(t.parent.number)}`}
                              >
                                {t.parent.number}
                              </a>
                              <span>— {t.parent.title}</span>
                              <StatusBadge
                                code={t.parent.status.code}
                                name={t.parent.status.name}
                                hideIcon
                              />
                            </li>
                          ) : null}
                          {(t.children ?? []).map((c) => (
                            <li key={c.id}>
                              <span>{c.type.name}</span>
                              <a
                                href={`/app/tickets/${encodeURIComponent(c.number)}`}
                              >
                                {c.number}
                              </a>
                              <span>— {c.title}</span>
                              <StatusBadge
                                code={c.status.code}
                                name={c.status.name}
                                hideIcon
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className={styles.quiet}>
                        No related tickets linked yet.
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className={styles.section} aria-labelledby="recent-mi">
          <div className={styles.sectionHead}>
            <SectionHeading id="recent-mi" icon={History}>
              Recently resolved (7 days)
            </SectionHeading>
          </div>
          {!data || data.recentlyResolved.length === 0 ? (
            <p className={styles.quiet}>None in the last week.</p>
          ) : (
            <ul className={styles.cards}>
              {data.recentlyResolved.map((t) => (
                <li key={t.id} className={styles.card}>
                  <div className={styles.cardTop}>
                    <a href={`/app/tickets/${encodeURIComponent(t.number)}`}>
                      {t.number}
                    </a>
                    <StatusBadge code={t.status.code} name={t.status.name} />
                  </div>
                  <p className={styles.title}>
                    <a href={`/app/tickets/${encodeURIComponent(t.number)}`}>
                      {t.title}
                    </a>
                  </p>
                  <p className={styles.cardMeta}>
                    {personLabel(t.assignee)}
                    {t.team ? ` · ${t.team.name}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
