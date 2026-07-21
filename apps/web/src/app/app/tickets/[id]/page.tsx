'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  api,
  type AssignmentRule,
  type AuthUser,
  type TeamWithMembers,
  type TicketAttachment,
  type TicketDetail,
} from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/Icon';
import { StatusBadge } from '@/components/StatusBadge';
import { TicketAttachments } from '@/components/TicketAttachments';
import {
  Clock,
  Save,
  Trash2,
} from 'lucide-react';
import styles from '../tickets.module.css';
import { SlaTimer } from '@/components/SlaTimer';

const ACTION_LABELS: Record<string, string> = {
  open: 'Open / Reopen',
  assigned: 'Mark assigned',
  in_progress: 'Start progress',
  pending_user: 'Pending user',
  pending_vendor: 'Pending vendor',
  pending_approval: 'Pending approval',
  on_hold: 'On hold',
  resolved: 'Resolve',
  closed: 'Close',
  cancelled: 'Cancel',
};

/** Resolve = success; Close = primary; cancel = danger; else secondary. */
function actionVariant(
  code: string,
): 'success' | 'primary' | 'danger' | 'secondary' {
  if (code === 'resolved') return 'success';
  if (code === 'closed') return 'primary';
  if (code === 'cancelled') return 'danger';
  return 'secondary';
}

function personName(p?: { firstName: string; lastName: string } | null) {
  if (!p) return '—';
  return `${p.firstName} ${p.lastName}`;
}

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const idOrNumber = decodeURIComponent(params.id ?? '');

  const [user, setUser] = useState<AuthUser | null>(null);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [teamId, setTeamId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [childNumber, setChildNumber] = useState('');

  const load = useCallback(async () => {
    const t = await api.getTicket(idOrNumber);
    setTicket(t);
    setTeamId(t.team?.id ?? '');
    setAssigneeId(t.assignee?.id ?? '');
    try {
      const files = await api.listAttachments(t.number);
      setAttachments(files);
    } catch {
      setAttachments([]);
    }
  }, [idOrNumber]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (cancelled) return;
        setUser(user);
        await load();
        if (can(user, 'org:read') || can(user, 'tickets:assign')) {
          try {
            const [t, r] = await Promise.all([
              api.listTeams(),
              can(user, 'org:read')
                ? api.assignmentRules()
                : Promise.resolve([]),
            ]);
            if (!cancelled) {
              setTeams(t);
              setRules(r);
            }
          } catch {
            /* optional for employees */
          }
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
  }, [load, router]);

  const assignees = useMemo(() => {
    if (!teamId) {
      const map = new Map<string, { id: string; firstName: string; lastName: string; email: string }>();
      for (const t of teams) {
        for (const m of t.members) map.set(m.user.id, m.user);
      }
      return [...map.values()];
    }
    const team = teams.find((t) => t.id === teamId);
    return team?.members.map((m) => m.user) ?? [];
  }, [teamId, teams]);

  async function applyStatus(statusCode: string) {
    if (!ticket) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.updateTicket(ticket.number, {
        version: ticket.version,
        statusCode,
      });
      setTicket(updated);
      setMessage(`Status updated to ${updated.status.name}.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Status update failed');
      try {
        await load();
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveAssignment(e: FormEvent) {
    e.preventDefault();
    if (!ticket) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.updateTicket(ticket.number, {
        version: ticket.version,
        teamId: teamId || null,
        assigneeId: assigneeId || null,
      });
      setTicket(updated);
      setMessage('Assignment saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
      try {
        await load();
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }

  async function assignToMe() {
    if (!ticket || !user) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.updateTicket(ticket.number, {
        version: ticket.version,
        assigneeId: user.id,
        ...(ticket.status.code === 'new' || ticket.status.code === 'open'
          ? { statusCode: 'assigned' }
          : {}),
      });
      setTicket(updated);
      setAssigneeId(user.id);
      setMessage('Assigned to you.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assign failed');
      try {
        await load();
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }

  async function onComment(e: FormEvent) {
    e.preventDefault();
    if (!ticket || !comment.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api.addComment(ticket.number, {
        body: comment.trim(),
        isInternal: internal,
      });
      setComment('');
      setInternal(false);
      await load();
      setMessage('Comment added.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comment failed');
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!ticket) return;
    if (
      !window.confirm(
        `Delete ${ticket.number}? It will leave the queue but remain auditable.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.deleteTicket(ticket.number);
      router.replace('/app/tickets');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setBusy(false);
    }
  }

  async function onLinkChild(e: FormEvent) {
    e.preventDefault();
    if (!ticket || !childNumber.trim()) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.linkChildTicket(ticket.number, childNumber.trim());
      setTicket(updated);
      setChildNumber('');
      setMessage(`Linked child ticket.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Link failed');
    } finally {
      setBusy(false);
    }
  }

  async function onUnlinkChild(childIdOrNumber: string) {
    if (!ticket) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.unlinkChildTicket(
        ticket.number,
        childIdOrNumber,
      );
      setTicket(updated);
      setMessage('Unlinked child ticket.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unlink failed');
    } finally {
      setBusy(false);
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
        <p>Loading ticket…</p>
      </main>
    );
  }

  if (!ticket) {
    return (
      <AppShell user={user} onLogout={logout} title="Ticket">
        <p className={styles.error}>Ticket not found.</p>
        <a href="/app/tickets">Back to tickets</a>
      </AppShell>
    );
  }

  const canAssign = can(user, 'tickets:assign');
  const canAttach =
    ticket.requester?.id === user.id || can(user, 'tickets:write');
  const transitions = ticket.allowedTransitions ?? [];
  const ownership = ticket.assignee
    ? `${personName(ticket.assignee)} · ${ticket.team?.name ?? 'No team'}`
    : ticket.team
      ? `Unassigned agent · Team: ${ticket.team.name}`
      : 'Unassigned (no team routed yet)';

  return (
    <AppShell user={user} onLogout={logout} title={ticket.number}>
      <p className={styles.backRow}>
        <a href="/app/tickets">
          Back to Tickets
        </a>
      </p>

      <section className={styles.detailLayout}>
        <div className={styles.detailMain}>
          <header className={styles.detailHeader}>
            <p className={styles.eyebrow}>{ticket.type.name}</p>
            <h2>{ticket.title}</h2>
            <p className={styles.metaLine}>
              <StatusBadge
                code={ticket.status.code}
                name={ticket.status.name}
              />
              {ticket.priority ? (
                <span className={styles.metaChip}>
                  {ticket.priority.name}
                </span>
              ) : null}
              {ticket.category ? (
                <span className={styles.metaChip}>{ticket.category.name}</span>
              ) : null}
            </p>
            <p className={styles.ownership}>
              Owner: <strong>{ownership}</strong>
            </p>
            <p className={styles.mutedSmall}>
              Requester: {personName(ticket.requester)} (
              {ticket.requester?.email})
            </p>
          </header>

          <div className={styles.descriptionBlock}>
            <h3>Description</h3>
            <p>{ticket.description}</p>
          </div>

          <section className={styles.actionsPanel} aria-labelledby="related-tickets">
            <h3 id="related-tickets">Related tickets</h3>
            {ticket.parent ? (
              <p className={styles.hint}>
                Parent:{' '}
                <a href={`/app/tickets/${encodeURIComponent(ticket.parent.number)}`}>
                  {ticket.parent.number}
                </a>{' '}
                — {ticket.parent.title} ({ticket.parent.status.name})
              </p>
            ) : (
              <p className={styles.hint}>No parent ticket linked.</p>
            )}
            <ul className={styles.commentList}>
              {(ticket.children ?? []).length === 0 ? (
                <li className={styles.hint}>No child tickets.</li>
              ) : (
                (ticket.children ?? []).map((c) => (
                  <li key={c.id}>
                    <a href={`/app/tickets/${encodeURIComponent(c.number)}`}>
                      <strong>{c.number}</strong>
                    </a>{' '}
                    — {c.title} ({c.status.name})
                    {can(user, 'tickets:read_queue') ||
                    can(user, 'tickets:read_all') ? (
                      <button
                        type="button"
                        className={styles.btnSecondary}
                        style={{ marginLeft: '0.5rem' }}
                        disabled={busy}
                        onClick={() => onUnlinkChild(c.number)}
                      >
                        Unlink
                      </button>
                    ) : null}
                  </li>
                ))
              )}
            </ul>
            {(can(user, 'tickets:read_queue') ||
              can(user, 'tickets:read_all')) &&
            can(user, 'tickets:write') ? (
              <form className={styles.commentForm} onSubmit={onLinkChild}>
                <label>
                  Link existing ticket as child
                  <input
                    value={childNumber}
                    onChange={(e) => setChildNumber(e.target.value)}
                    placeholder="e.g. INC-2026-000123"
                    required
                    minLength={3}
                  />
                </label>
                <button type="submit" className={styles.btn} disabled={busy}>
                  Link child
                </button>
              </form>
            ) : null}
          </section>

          {ticket.stageDurations ? (
            <section className={styles.actionsPanel} aria-labelledby="stage-time">
              <h3 id="stage-time">Stage duration</h3>
              <p className={styles.hint}>
                Time spent in each status (from ticket history). Current stage
                is still counting.
              </p>
              <ul className={styles.commentList}>
                {ticket.stageDurations.totalsByStatus.map((s) => (
                  <li key={s.statusCode}>
                    <strong>{s.statusCode}</strong> — {s.label}
                    {ticket.stageDurations?.stages.find(
                      (st) => st.current && st.statusCode === s.statusCode,
                    )
                      ? ' (current)'
                      : ''}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <TicketAttachments
            ticketIdOrNumber={ticket.number}
            canUpload={canAttach}
            attachments={attachments}
            onChanged={load}
          />

          <section className={styles.actionsPanel} aria-labelledby="ticket-actions">
            <h3 id="ticket-actions">Ticket actions</h3>
            <p className={styles.hint}>
              Allowed next steps for your role and the current status. Workflow
              blocks invalid jumps.
            </p>
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
            {message ? <p className={styles.ok}>{message}</p> : null}

            {transitions.length === 0 ? (
              <p className={styles.hint}>
                No status actions available from{' '}
                <strong>{ticket.status.name}</strong> for your role.
              </p>
            ) : (
              <div className={styles.actionButtons}>
                {transitions.map((t) => {
                  const label = ACTION_LABELS[t.code] ?? t.name;
                  const variant = actionVariant(t.code);
                  const className =
                    variant === 'success'
                      ? styles.btnSuccess
                      : variant === 'primary'
                        ? styles.btn
                        : variant === 'danger'
                          ? styles.btnDanger
                          : styles.btnSecondary;
                  return (
                    <button
                      key={t.code}
                      type="button"
                      disabled={busy}
                      className={className}
                      onClick={() => applyStatus(t.code)}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}

            {ticket.canSoftDelete ? (
              <div className={styles.deleteRow}>
                <button
                  type="button"
                  className={styles.btnDangerOutline}
                  disabled={busy}
                  aria-label={`Delete ticket ${ticket.number}`}
                  onClick={onDelete}
                >
                  <Icon icon={Trash2} size="sm" />
                  Delete
                </button>
                <span className={styles.hint}>
                  Sysadmin / IT Manager — removes from active queues.
                </span>
              </div>
            ) : null}
          </section>

          <section className={styles.commentsBlock}>
            <h3>
              Comments
            </h3>
            <ul className={styles.commentList}>
              {(ticket.comments ?? []).length === 0 ? (
                <li className={styles.hint}>No comments yet.</li>
              ) : (
                (ticket.comments ?? []).map((c) => (
                  <li key={c.id}>
                    <strong>
                      {personName(c.author)}
                      {c.isInternal ? ' · Internal' : ''}
                    </strong>
                    <p>{c.body}</p>
                  </li>
                ))
              )}
            </ul>
            {(can(user, 'tickets:write') ||
              ticket.requester?.id === user.id) && (
              <form className={styles.commentForm} onSubmit={onComment}>
                <label>
                  Add comment
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    required
                    minLength={1}
                  />
                </label>
                {can(user, 'tickets:internal_note') ? (
                  <label className={styles.checkLabel}>
                    <input
                      type="checkbox"
                      checked={internal}
                      onChange={(e) => setInternal(e.target.checked)}
                    />
                    Internal note (hidden from requester)
                  </label>
                ) : null}
                <button type="submit" className={styles.btn} disabled={busy}>
                  Post comment
                </button>
              </form>
            )}
          </section>
        </div>

        <aside className={styles.detailSide}>
          <div className={styles.slaPanel}>
            <h3>
              <Icon icon={Clock} size="sm" />
              Time to resolution
            </h3>
            <SlaTimer
              variant="panel"
              dueAt={ticket.dueAt}
              slaDueAt={ticket.slaDueAt}
              slaRemainingMs={ticket.slaRemainingMs}
              slaBreached={ticket.slaBreached}
              slaPaused={ticket.slaPaused}
              slaCompleted={ticket.slaCompleted}
              timeToResolution={ticket.timeToResolution}
            />
          </div>

          {canAssign ? (
            <form className={styles.assignPanel} onSubmit={saveAssignment}>
              <h3>
                Assignment
              </h3>
              <p className={styles.hint}>
                Auto-routing can set a team on create (see rules below). Agents
                and managers assign / reassign team + person here.
              </p>
              <label>
                Support team
                <select
                  value={teamId}
                  onChange={(e) => {
                    setTeamId(e.target.value);
                    setAssigneeId('');
                  }}
                >
                  <option value="">Unassigned team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Assignee
                <select
                  value={assigneeId}
                  onChange={(e) => setAssigneeId(e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {assignees.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.firstName} {a.lastName}
                    </option>
                  ))}
                </select>
              </label>
              <div className={styles.actionButtons}>
                <button type="submit" className={styles.btn} disabled={busy}>
                  <Icon icon={Save} size="sm" />
                  Save assignment
                </button>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  disabled={busy}
                  onClick={assignToMe}
                >
                  Assign to me
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.assignPanel}>
              <h3>Ownership</h3>
              <p>{ownership}</p>
              <p className={styles.hint}>
                Only roles with <code>tickets:assign</code> can change team or
                assignee (agents, managers, sysadmin).
              </p>
            </div>
          )}

          {rules.length > 0 ? (
            <div className={styles.rulesPanel}>
              <h3>How auto-assignment works</h3>
              <p className={styles.hint}>
                On create, the first matching active rule routes the ticket to a
                team. People are not auto-picked — assign an agent after routing.
              </p>
              <ul>
                {rules.map((r) => (
                  <li key={r.id}>
                    <strong>{r.name}</strong>
                    <em>
                      {r.category?.name ?? 'Any category'}
                      {r.ticketType ? ` · ${r.ticketType.name}` : ''}
                      {' to '}
                      {r.team?.name ?? 'team'}
                    </em>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </section>
    </AppShell>
  );
}
