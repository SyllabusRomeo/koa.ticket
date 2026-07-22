'use client';

import {
  DragEvent,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { Columns3, RefreshCw } from 'lucide-react';
import { Icon } from '@/components/Icon';
import styles from './queue.module.css';

type Scope = 'all' | 'mine' | 'unassigned';

function parseScope(raw: string | null): Scope {
  if (raw === 'mine' || raw === 'unassigned') return raw;
  return 'all';
}

type BoardColumn = {
  code: string;
  name: string;
  tickets: TicketSummary[];
};

type BoardData = {
  scope: string;
  total: number;
  generatedAt: string;
  columns: BoardColumn[];
  workload: Array<{ userId: string | null; name: string; count: number }>;
  transitions: Record<string, string[]>;
};

function personLabel(
  p?: { firstName?: string; lastName?: string; email?: string } | null,
) {
  if (!p) return 'Unassigned';
  const name = `${p.firstName ?? ''} ${p.lastName ?? ''}`.trim();
  return name || p.email || 'Unassigned';
}

function QueueBoardInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const scope = parseScope(searchParams.get('scope'));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const load = useCallback(async (nextScope: Scope) => {
    setError(null);
    const data = await api.ticketBoard(nextScope);
    setBoard(data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { user: me } = await api.me();
        if (cancelled) return;
        if (!showAgentWorkspace(me)) {
          router.replace('/app/tickets');
          return;
        }
        setUser(me);
        await load(scope);
      } catch {
        if (!cancelled) router.replace('/login');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, load, scope]);

  function changeScope(next: Scope) {
    const qs = next === 'all' ? '' : `?scope=${next}`;
    router.replace(`/app/queue${qs}`);
  }

  const allowedTargets = useMemo(() => {
    if (!dragFrom || !board) return null;
    return new Set(board.transitions[dragFrom] ?? []);
  }, [dragFrom, board]);

  const maxWorkload = useMemo(
    () => Math.max(1, ...(board?.workload.map((w) => w.count) ?? [1])),
    [board],
  );

  function onDragStart(ticket: TicketSummary, e: DragEvent) {
    if (!can(user, 'tickets:write')) {
      e.preventDefault();
      return;
    }
    setDragId(ticket.id);
    setDragFrom(ticket.status.code);
    e.dataTransfer.setData('text/ticket-id', ticket.id);
    e.dataTransfer.effectAllowed = 'move';
  }

  function onDragEnd() {
    setDragId(null);
    setDragFrom(null);
  }

  function columnDropClass(code: string) {
    if (!dragId || !dragFrom) return '';
    if (code === dragFrom) return '';
    if (allowedTargets?.has(code)) return styles.columnDropOk;
    return styles.columnDropNo;
  }

  async function moveTicket(ticketId: string, toStatus: string) {
    if (!board || !user) return;
    const fromCol = board.columns.find((c) =>
      c.tickets.some((t) => t.id === ticketId),
    );
    const ticket = fromCol?.tickets.find((t) => t.id === ticketId);
    if (!ticket || ticket.status.code === toStatus) return;

    const allowed = board.transitions[ticket.status.code] ?? [];
    if (!allowed.includes(toStatus)) {
      setError(
        `Cannot move from ${ticket.status.name} to that status (invalid transition).`,
      );
      return;
    }

    const prev = board;
    const nextColumns = board.columns.map((col) => ({
      ...col,
      tickets: col.tickets.filter((t) => t.id !== ticketId),
    }));
    const target = nextColumns.find((c) => c.code === toStatus);
    if (target) {
      target.tickets = [
        {
          ...ticket,
          status: { ...ticket.status, code: toStatus, name: target.name },
          version: ticket.version + 1,
        },
        ...target.tickets,
      ];
    }
    setBoard({ ...board, columns: nextColumns });
    setMovingId(ticketId);
    setError(null);

    try {
      await api.updateTicket(ticket.number, {
        version: ticket.version,
        statusCode: toStatus,
      });
      await load(scope);
    } catch (e) {
      setBoard(prev);
      setError(
        e instanceof Error ? e.message : 'Could not update ticket status',
      );
    } finally {
      setMovingId(null);
    }
  }

  function onDropColumn(toStatus: string, e: DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/ticket-id') || dragId || '';
    onDragEnd();
    if (id) void moveTicket(id, toStatus);
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  }

  if (loading && !board) {
    return (
      <main className={styles.page}>
        <p className={styles.meta}>Loading queue board…</p>
      </main>
    );
  }

  if (!user) return null;

  const canWrite = can(user, 'tickets:write');

  return (
    <AppShell user={user} onLogout={logout} title="Queue board">
      <div className={styles.page}>
        <header className={styles.top}>
          <div>
            <p className={styles.eyebrow}>Agent workspace</p>
            <h1>Queue board</h1>
            <p className={styles.lede}>
              Pipeline view of open work — drag cards to advance status
              {canWrite ? '' : ' (read-only)'}.
            </p>
          </div>
          <div className={styles.topActions}>
            <div
              className={styles.scopes}
              role="tablist"
              aria-label="Queue scope"
            >
              {(
                [
                  ['all', 'All open'],
                  ['mine', 'Mine'],
                  ['unassigned', 'Unassigned'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={scope === value}
                  className={`${styles.scopeBtn} ${
                    scope === value ? styles.scopeBtnActive : ''
                  }`}
                  onClick={() => changeScope(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <Button
              type="button"
              variant="tertiary"
              onClick={() => void load(scope)}
            >
              <Icon icon={RefreshCw} size="sm" />
              Refresh
            </Button>
          </div>
        </header>

        {error ? <p className={styles.error}>{error}</p> : null}

        {!board || board.total === 0 ? (
          <EmptyState icon={Columns3}>
            <p>
              <strong>No open tickets in this view.</strong> Try another scope,
              or create work from Tickets.
            </p>
            <ButtonLink href="/app/tickets" variant="secondary">
              Open tickets
            </ButtonLink>
          </EmptyState>
        ) : (
          <div className={styles.layout}>
            <div className={styles.boardWrap}>
              <div className={styles.board} role="list">
                {board.columns.map((col) => (
                  <section
                    key={col.code}
                    className={`${styles.column} ${columnDropClass(col.code)}`}
                    aria-label={`${col.name} column`}
                    onDragOver={(e) => {
                      if (!canWrite || !dragFrom) return;
                      const ok =
                        col.code === dragFrom ||
                        (allowedTargets?.has(col.code) ?? false);
                      if (ok) {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }
                    }}
                    onDrop={(e) => onDropColumn(col.code, e)}
                  >
                    <div className={styles.columnHead}>
                      <h2>{col.name}</h2>
                      <span className={styles.count}>{col.tickets.length}</span>
                    </div>
                    <div className={styles.cards}>
                      {col.tickets.length === 0 ? (
                        <p className={styles.emptyCol}>Drop here</p>
                      ) : (
                        col.tickets.map((t) => (
                          <article
                            key={t.id}
                            className={`${styles.card} ${
                              dragId === t.id ? styles.cardDragging : ''
                            } ${movingId === t.id ? styles.cardBusy : ''}`}
                            draggable={canWrite}
                            onDragStart={(e) => onDragStart(t, e)}
                            onDragEnd={onDragEnd}
                            role="listitem"
                          >
                            <div className={styles.cardTop}>
                              <a
                                className={styles.cardNumber}
                                href={`/app/tickets/${encodeURIComponent(t.number)}`}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {t.number}
                              </a>
                              {t.majorIncident ? (
                                <span className={styles.miBadge}>Major</span>
                              ) : null}
                              {t.priority ? (
                                <StatusBadge
                                  code={t.priority.code}
                                  name={t.priority.name}
                                  hideIcon
                                />
                              ) : null}
                            </div>
                            <a
                              href={`/app/tickets/${encodeURIComponent(t.number)}`}
                              className={styles.cardTitle}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {t.title}
                            </a>
                            <div className={styles.cardMeta}>
                              <span className={styles.assignee}>
                                {personLabel(t.assignee)}
                              </span>
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
                          </article>
                        ))
                      )}
                    </div>
                  </section>
                ))}
              </div>
            </div>

            <aside className={styles.workload} aria-label="Workload">
              <h2>Workload</h2>
              <ul className={styles.workloadList}>
                {board.workload.map((w) => (
                  <li key={w.userId ?? 'unassigned'}>
                    <div className={styles.workloadRow}>
                      <span>{w.name}</span>
                      <strong>{w.count}</strong>
                    </div>
                    <div className={styles.workloadTrack}>
                      <div
                        className={styles.workloadFill}
                        style={{
                          width: `${Math.round((w.count / maxWorkload) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <p className={styles.hint}>
                {board.total} open · updated{' '}
                {new Date(board.generatedAt).toLocaleTimeString()}
                {canWrite
                  ? ' · Drag to a highlighted column to change status'
                  : ''}
              </p>
            </aside>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function QueueBoardPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <p className={styles.meta}>Loading queue board…</p>
        </main>
      }
    >
      <QueueBoardInner />
    </Suspense>
  );
}
