'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  api,
  type AssignmentRule,
  type AuthUser,
  type LocationRef,
  type TeamWithMembers,
  type TicketAttachment,
  type TicketDetail,
  type TicketWorkLog,
} from '@/lib/api';
import { can, showAgentWorkspace } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Icon } from '@/components/Icon';
import { StatusBadge } from '@/components/StatusBadge';
import { TicketAttachments } from '@/components/TicketAttachments';
import { LocationSelect } from '@/components/LocationSelect';
import {
  AlertTriangle,
  CalendarClock,
  Clock,
  Eye,
  EyeOff,
  GitBranchPlus,
  History,
  MapPin,
  MessageSquare,
  Save,
  Timer,
  Trash2,
  UserRound,
} from 'lucide-react';
import styles from '../tickets.module.css';
import { SlaTimer } from '@/components/SlaTimer';
import { Button } from '@/components/Button';

const ACTION_LABELS: Record<string, string> = {
  open: 'Open / Reopen',
  assigned: 'Mark assigned',
  in_progress: 'Start progress',
  under_investigation: 'Under investigation',
  known_error: 'Mark known error',
  scheduled: 'Mark scheduled',
  implementing: 'Start implementing',
  pending_user: 'Pending user',
  pending_vendor: 'Pending vendor',
  pending_approval: 'Pending approval',
  on_hold: 'On hold',
  resolved: 'Resolve',
  closed: 'Close',
  cancelled: 'Cancel',
};

const HISTORY_SKIP = new Set([
  'comment',
  'internal_note',
  'work_log',
]);

type ActivityFilter = 'all' | 'events' | 'comments';

function historyTone(field: string): string {
  if (field === 'assignee' || field === 'team') return styles.activityAssign;
  if (field === 'status') return styles.activityStatus;
  if (field === 'created') return styles.activityCreated;
  if (field === 'major_incident') return styles.activityAlert;
  return styles.activityDefault;
}

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
  const [locations, setLocations] = useState<LocationRef[]>([]);
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [teamId, setTeamId] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attachments, setAttachments] = useState<TicketAttachment[]>([]);
  const [childNumber, setChildNumber] = useState('');
  const [mergeSources, setMergeSources] = useState('');
  const [workLogs, setWorkLogs] = useState<TicketWorkLog[]>([]);
  const [workMinutes, setWorkMinutes] = useState('15');
  const [workNote, setWorkNote] = useState('');
  const [watching, setWatching] = useState(false);
  const [rootCause, setRootCause] = useState('');
  const [workaround, setWorkaround] = useState('');
  const [changeRisk, setChangeRisk] = useState('');
  const [changePlan, setChangePlan] = useState('');
  const [rollbackPlan, setRollbackPlan] = useState('');
  const [scheduledStart, setScheduledStart] = useState('');
  const [scheduledEnd, setScheduledEnd] = useState('');
  const [cabRequired, setCabRequired] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [presencePeers, setPresencePeers] = useState<
    Array<{
      userId: string;
      firstName: string;
      lastName: string;
      mode: 'viewing' | 'composing';
    }>
  >([]);
  const [presenceCollision, setPresenceCollision] = useState(false);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    const t = await api.getTicket(idOrNumber);
    setTicket(t);
    setTeamId(t.team?.id ?? '');
    setAssigneeId(t.assignee?.id ?? '');
    setLocationId(t.location?.id ?? t.locationId ?? '');
    setWatching(!!t.watching);
    if (t.location) {
      setLocations((prev) => {
        if (prev.some((l) => l.id === t.location!.id)) return prev;
        return [
          {
            id: t.location.id,
            code: t.location.code,
            name: t.location.name,
            site: t.location.site,
            country: t.location.country,
            timezone: t.location.timezone,
            isActive: true,
          },
          ...prev,
        ];
      });
    }
    setRootCause(t.rootCause ?? '');
    setWorkaround(t.workaround ?? '');
    setChangeRisk(t.changeRisk ?? '');
    setChangePlan(t.changePlan ?? '');
    setRollbackPlan(t.rollbackPlan ?? '');
    setScheduledStart(
      t.scheduledStart ? t.scheduledStart.slice(0, 16) : '',
    );
    setScheduledEnd(t.scheduledEnd ? t.scheduledEnd.slice(0, 16) : '');
    setCabRequired(!!t.cabRequired);
    try {
      const files = await api.listAttachments(t.number);
      setAttachments(files);
    } catch {
      setAttachments([]);
    }
    try {
      const logs = await api.listWorkLogs(t.number);
      setWorkLogs(logs);
    } catch {
      setWorkLogs([]);
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
        try {
          const meta = await api.ticketMeta();
          if (!cancelled && meta.locations?.length) {
            setLocations((prev) => {
              const byId = new Map(meta.locations.map((l) => [l.id, l]));
              for (const l of prev) {
                if (!byId.has(l.id)) byId.set(l.id, l);
              }
              return [...byId.values()];
            });
          }
        } catch {
          /* optional */
        }
        if (can(user, 'org:read') || can(user, 'tickets:assign')) {
          try {
            const [t, r, locs] = await Promise.all([
              api.listTeams(),
              can(user, 'org:read')
                ? api.assignmentRules()
                : Promise.resolve([]),
              can(user, 'org:read')
                ? api.listLocations()
                : Promise.resolve([] as LocationRef[]),
            ]);
            if (!cancelled) {
              setTeams(t);
              setRules(r);
              if (locs.length) setLocations(locs);
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

  useEffect(() => {
    if (!ticket?.number) return;
    let cancelled = false;
    const ticketKey = ticket.number;

    async function beat() {
      try {
        const result = await api.heartbeatPresence(
          ticketKey,
          composing ? 'composing' : 'viewing',
        );
        if (cancelled) return;
        setPresencePeers(result.peers);
        setPresenceCollision(result.collision);
      } catch {
        /* presence is best-effort */
      }
    }

    void beat();
    const timer = window.setInterval(() => {
      void beat();
    }, 12_000);

    const onLeave = () => {
      void api.leavePresence(ticketKey).catch(() => undefined);
    };
    window.addEventListener('pagehide', onLeave);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener('pagehide', onLeave);
      void api.leavePresence(ticketKey).catch(() => undefined);
    };
  }, [ticket?.number, composing]);

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
        locationId: locationId || null,
      });
      setTicket(updated);
      setLocationId(updated.location?.id ?? '');
      setMessage('Assignment & location saved.');
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

  async function saveLocation(e: FormEvent) {
    e.preventDefault();
    if (!ticket) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.updateTicket(ticket.number, {
        version: ticket.version,
        locationId: locationId || null,
      });
      setTicket(updated);
      setLocationId(updated.location?.id ?? '');
      setMessage('Ticket origin location updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Location update failed');
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
      setRootCause(updated.rootCause ?? '');
      setWorkaround(updated.workaround ?? '');
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

  async function saveProblemAnalysis(e: FormEvent) {
    e.preventDefault();
    if (!ticket) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.updateTicket(ticket.number, {
        version: ticket.version,
        rootCause: rootCause.trim() || null,
        workaround: workaround.trim() || null,
      });
      setTicket(updated);
      setRootCause(updated.rootCause ?? '');
      setWorkaround(updated.workaround ?? '');
      setMessage('Problem analysis saved.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not save problem analysis',
      );
      try {
        await load();
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }

  async function saveChangePlan(e: FormEvent) {
    e.preventDefault();
    if (!ticket) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.updateTicket(ticket.number, {
        version: ticket.version,
        changeRisk: changeRisk.trim() || null,
        changePlan: changePlan.trim() || null,
        rollbackPlan: rollbackPlan.trim() || null,
        scheduledStart: scheduledStart
          ? new Date(scheduledStart).toISOString()
          : null,
        scheduledEnd: scheduledEnd
          ? new Date(scheduledEnd).toISOString()
          : null,
        cabRequired,
      });
      setTicket(updated);
      setChangeRisk(updated.changeRisk ?? '');
      setChangePlan(updated.changePlan ?? '');
      setRollbackPlan(updated.rollbackPlan ?? '');
      setScheduledStart(
        updated.scheduledStart ? updated.scheduledStart.slice(0, 16) : '',
      );
      setScheduledEnd(
        updated.scheduledEnd ? updated.scheduledEnd.slice(0, 16) : '',
      );
      setCabRequired(!!updated.cabRequired);
      setMessage('Change plan saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save change plan');
      try {
        await load();
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitCab() {
    if (!ticket) return;
    if (
      !window.confirm(
        `Submit ${ticket.number} to CAB? Approvers will receive an approval request.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.requestCab(ticket.number);
      setTicket(updated);
      setMessage('Submitted to CAB — pending approval.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CAB submit failed');
      try {
        await load();
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }

  async function raiseProblem() {
    if (!ticket) return;
    if (
      !window.confirm(
        `Raise a Problem (PRB) from ${ticket.number}? This ticket will be linked as a child of the new problem.`,
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const problem = await api.promoteToProblem(ticket.number);
      setMessage(`Created ${problem.number}. Opening problem…`);
      router.push(`/app/tickets/${encodeURIComponent(problem.number)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not raise problem');
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

  async function onMerge(e: FormEvent) {
    e.preventDefault();
    if (!ticket || !mergeSources.trim()) return;
    const sourceTicketIds = mergeSources
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (sourceTicketIds.length === 0) return;
    const ok = window.confirm(
      `Merge ${sourceTicketIds.join(', ')} into ${ticket.number}?\n\n` +
        `Source tickets will be closed as Merged. Comments and attachments ` +
        `are copied onto this ticket with attribution.`,
    );
    if (!ok) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.mergeTickets(ticket.number, sourceTicketIds);
      setTicket(updated);
      setMergeSources('');
      try {
        const files = await api.listAttachments(updated.number);
        setAttachments(files);
      } catch {
        /* keep existing */
      }
      setMessage(
        `Merged ${sourceTicketIds.length} ticket(s) into ${ticket.number}.`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleWatch() {
    if (!ticket) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = watching
        ? await api.unwatchTicket(ticket.number)
        : await api.watchTicket(ticket.number);
      setWatching(result.watching);
      setMessage(result.watching ? 'Watching this ticket.' : 'Stopped watching.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Watch update failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleMajorIncident() {
    if (!ticket) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await api.updateTicket(ticket.number, {
        version: ticket.version,
        majorIncident: !ticket.majorIncident,
      });
      setTicket(updated);
      setWatching(!!updated.watching);
      setMessage(
        updated.majorIncident
          ? 'Marked as major incident.'
          : 'Major incident flag cleared.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
      try {
        await load();
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(false);
    }
  }

  async function onAddWorkLog(e: FormEvent) {
    e.preventDefault();
    if (!ticket) return;
    const minutes = Number(workMinutes);
    if (!Number.isFinite(minutes) || minutes < 1) {
      setError('Enter minutes worked (at least 1).');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.addWorkLog(ticket.number, {
        minutes,
        note: workNote.trim() || undefined,
      });
      setWorkNote('');
      const logs = await api.listWorkLogs(ticket.number);
      setWorkLogs(logs);
      setMessage(`Logged ${minutes} minute${minutes === 1 ? '' : 's'}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log work');
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

  const activityItems = useMemo(() => {
    if (!ticket) return [];
    type Item =
      | {
          kind: 'event';
          id: string;
          at: string;
          field: string;
          summary: string;
          oldLabel?: string | null;
          newLabel?: string | null;
          actorName: string;
        }
      | {
          kind: 'comment';
          id: string;
          at: string;
          body: string;
          isInternal: boolean;
          authorName: string;
        };
    const events: Item[] = (ticket.history ?? [])
      .filter((h) => !HISTORY_SKIP.has(h.field))
      .map((h) => ({
        kind: 'event' as const,
        id: h.id,
        at: h.createdAt,
        field: h.field,
        summary: h.summary ?? h.field,
        oldLabel: h.oldLabel,
        newLabel: h.newLabel,
        actorName: h.actorName || personName(h.actor) || 'System',
      }));
    const comments: Item[] = (ticket.comments ?? []).map((c) => ({
      kind: 'comment' as const,
      id: c.id,
      at: c.createdAt,
      body: c.body,
      isInternal: c.isInternal,
      authorName: personName(c.author),
    }));
    return [...events, ...comments].sort(
      (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
    );
  }, [ticket]);

  const visibleActivity = useMemo(() => {
    if (activityFilter === 'events') {
      return activityItems.filter((i) => i.kind === 'event');
    }
    if (activityFilter === 'comments') {
      return activityItems.filter((i) => i.kind === 'comment');
    }
    return activityItems;
  }, [activityItems, activityFilter]);

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
  const canEditLocation =
    can(user, 'tickets:read_all') ||
    can(user, 'tickets:read_queue') ||
    can(user, 'settings:manage');
  const canAttach =
    ticket.requester?.id === user.id || can(user, 'tickets:write');
  const canLogWork = showAgentWorkspace(user) && can(user, 'tickets:write');
  const canToggleMi =
    can(user, 'tickets:read_all') || can(user, 'tickets:read_queue');
  const transitions = ticket.allowedTransitions ?? [];
  const ownership = ticket.assignee
    ? `${personName(ticket.assignee)} · ${ticket.team?.name ?? 'No team'}`
    : ticket.team
      ? `Unassigned agent · Team: ${ticket.team.name}`
      : 'Unassigned (no team routed yet)';
  const workMinutesTotal = workLogs.reduce((sum, log) => sum + log.minutes, 0);
  const originLabel = ticket.location
    ? ticket.location.site
      ? `${ticket.location.name} · ${ticket.location.site}`
      : ticket.location.name
    : 'Not set';
  const presenceLabel = presencePeers
    .map((p) => {
      const name = `${p.firstName} ${p.lastName}`.trim() || p.userId;
      return p.mode === 'composing' ? `${name} (composing)` : name;
    })
    .join(' · ');

  return (
    <AppShell user={user} onLogout={logout} title={ticket.number}>
      <p className={styles.backRow}>
        <a href="/app/tickets">
          Back to Tickets
        </a>
      </p>

      {presencePeers.length > 0 ? (
        <p className={styles.presenceBanner} role="status">
          <Icon icon={Eye} size="sm" />
          Also here: {presenceLabel}
        </p>
      ) : null}
      {presenceCollision ? (
        <p className={styles.collisionWarn} role="alert">
          <Icon icon={AlertTriangle} size="sm" />
          Another agent is composing a reply — coordinate to avoid conflicting
          updates.
        </p>
      ) : null}

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
              {ticket.majorIncident ? (
                <span className={styles.miBadge}>
                  <Icon icon={AlertTriangle} size="sm" />
                  Major incident
                </span>
              ) : null}
              {ticket.priority ? (
                <span className={styles.metaChip}>
                  {ticket.priority.name}
                </span>
              ) : null}
              {ticket.category ? (
                <span className={styles.metaChip}>{ticket.category.name}</span>
              ) : null}
              <span className={styles.metaChip} title="Ticket origin site">
                <Icon icon={MapPin} size="sm" />
                {originLabel}
              </span>
            </p>
            <div className={styles.headerActions}>
              <Button
                type="button"
                variant={watching ? 'secondary' : 'tertiary'}
                disabled={busy}
                onClick={toggleWatch}
              >
                <Icon icon={watching ? EyeOff : Eye} size="sm" />
                {watching ? 'Watching' : 'Watch'}
              </Button>
              {canToggleMi ? (
                <Button
                  type="button"
                  variant={ticket.majorIncident ? 'dangerOutline' : 'tertiary'}
                  disabled={busy}
                  onClick={toggleMajorIncident}
                >
                  <Icon icon={AlertTriangle} size="sm" />
                  {ticket.majorIncident
                    ? 'Clear major incident'
                    : 'Mark major incident'}
                </Button>
              ) : null}
            </div>
            <p className={styles.ownership}>
              Owner: <strong>{ownership}</strong>
            </p>
            <p className={styles.mutedSmall}>
              Requester: {personName(ticket.requester)} (
              {ticket.requester?.email})
            </p>
            <p className={styles.mutedSmall}>
              Ticket origin site: <strong>{originLabel}</strong>
              {ticket.location?.country
                ? ` · ${ticket.location.country}`
                : ''}
            </p>
          </header>

          <div className={styles.descriptionBlock}>
            <h3>Description</h3>
            <p>{ticket.description}</p>
          </div>

          {ticket.type.code === 'problem' ? (
            <form
              className={styles.actionsPanel}
              onSubmit={saveProblemAnalysis}
              aria-labelledby="problem-analysis"
            >
              <h3 id="problem-analysis">
                <Icon icon={GitBranchPlus} size="sm" />
                Problem analysis
              </h3>
              <p className={styles.hint}>
                Capture root cause and any workaround. Use status{' '}
                <strong>Under investigation</strong> or{' '}
                <strong>Known error</strong> as the analysis matures. Link
                related incidents under Related tickets.
              </p>
              <label>
                Root cause
                <textarea
                  value={rootCause}
                  onChange={(e) => setRootCause(e.target.value)}
                  rows={4}
                  placeholder="Confirmed underlying cause…"
                  disabled={!can(user, 'tickets:write')}
                />
              </label>
              <label>
                Workaround
                <textarea
                  value={workaround}
                  onChange={(e) => setWorkaround(e.target.value)}
                  rows={3}
                  placeholder="Temporary mitigation for known error…"
                  disabled={!can(user, 'tickets:write')}
                />
              </label>
              {can(user, 'tickets:write') ? (
                <button type="submit" className={styles.btn} disabled={busy}>
                  <Icon icon={Save} size="sm" />
                  Save analysis
                </button>
              ) : null}
            </form>
          ) : null}

          {ticket.type.code === 'change' ? (
            <form
              className={styles.actionsPanel}
              onSubmit={saveChangePlan}
              aria-labelledby="change-plan"
            >
              <h3 id="change-plan">
                <Icon icon={CalendarClock} size="sm" />
                Change plan & CAB
              </h3>
              <p className={styles.hint}>
                Document risk, implementation, and rollback. Submit to CAB when
                ready — approvers decide under Approvals. Approved changes move
                to <strong>Scheduled</strong>.
              </p>
              <label>
                Risk
                <input
                  value={changeRisk}
                  onChange={(e) => setChangeRisk(e.target.value)}
                  placeholder="low / medium / high — summary"
                  disabled={!can(user, 'tickets:write')}
                />
              </label>
              <label>
                Implementation plan
                <textarea
                  value={changePlan}
                  onChange={(e) => setChangePlan(e.target.value)}
                  rows={4}
                  placeholder="Steps, owners, validation…"
                  disabled={!can(user, 'tickets:write')}
                />
              </label>
              <label>
                Rollback plan
                <textarea
                  value={rollbackPlan}
                  onChange={(e) => setRollbackPlan(e.target.value)}
                  rows={3}
                  placeholder="Backout steps if the change fails…"
                  disabled={!can(user, 'tickets:write')}
                />
              </label>
              <label>
                Scheduled start
                <input
                  type="datetime-local"
                  value={scheduledStart}
                  onChange={(e) => setScheduledStart(e.target.value)}
                  disabled={!can(user, 'tickets:write')}
                />
              </label>
              <label>
                Scheduled end
                <input
                  type="datetime-local"
                  value={scheduledEnd}
                  onChange={(e) => setScheduledEnd(e.target.value)}
                  disabled={!can(user, 'tickets:write')}
                />
              </label>
              <label className={styles.checkLabel}>
                <input
                  type="checkbox"
                  checked={cabRequired}
                  onChange={(e) => setCabRequired(e.target.checked)}
                  disabled={!can(user, 'tickets:write')}
                />
                CAB review required
              </label>
              {can(user, 'tickets:write') ? (
                <div className={styles.actionButtons}>
                  <button type="submit" className={styles.btn} disabled={busy}>
                    <Icon icon={Save} size="sm" />
                    Save change plan
                  </button>
                  {ticket.status.code !== 'pending_approval' &&
                  !ticket.status.isTerminal ? (
                    <button
                      type="button"
                      className={styles.btnSecondary}
                      disabled={busy}
                      onClick={() => void submitCab()}
                    >
                      Submit to CAB
                    </button>
                  ) : null}
                  <a href="/app/approvals" className={styles.btnSecondary}>
                    Open Approvals
                  </a>
                </div>
              ) : null}
            </form>
          ) : null}

          <section className={styles.actionsPanel} aria-labelledby="related-tickets">
            <h3 id="related-tickets">Related tickets</h3>
            {ticket.mergedInto ? (
              <p className={styles.hint}>
                Merged into{' '}
                <a
                  href={`/app/tickets/${encodeURIComponent(ticket.mergedInto.number)}`}
                >
                  {ticket.mergedInto.number}
                </a>{' '}
                — {ticket.mergedInto.title}
              </p>
            ) : null}
            {(ticket.mergedFrom ?? []).length > 0 ? (
              <div>
                <p className={styles.hint}>Merged from:</p>
                <ul className={styles.commentList}>
                  {(ticket.mergedFrom ?? []).map((m) => (
                    <li key={m.id}>
                      <a href={`/app/tickets/${encodeURIComponent(m.number)}`}>
                        <strong>{m.number}</strong>
                      </a>{' '}
                      — {m.title} ({m.status.name})
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
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
            {!ticket.mergedInto &&
            (can(user, 'tickets:read_queue') ||
              can(user, 'tickets:read_all')) &&
            (can(user, 'tickets:write') || can(user, 'tickets:assign')) ? (
              <form className={styles.commentForm} onSubmit={onMerge}>
                <label>
                  Merge other tickets into this one
                  <input
                    value={mergeSources}
                    onChange={(e) => setMergeSources(e.target.value)}
                    placeholder="e.g. INC-2026-000124, INC-2026-000125"
                    required
                    minLength={3}
                  />
                </label>
                <p className={styles.hint}>
                  Sources keep their numbers, close as Merged, and comments /
                  attachments are copied here with attribution.
                </p>
                <button
                  type="submit"
                  className={styles.btnSecondary}
                  disabled={busy || ticket.status.code === 'merged'}
                >
                  Merge into this ticket
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
              <ul className={styles.stageBars}>
                {ticket.stageDurations.totalsByStatus.map((s) => {
                  const max = Math.max(
                    1,
                    ...ticket.stageDurations!.totalsByStatus.map(
                      (x) => x.durationMs,
                    ),
                  );
                  const isCurrent = !!ticket.stageDurations?.stages.find(
                    (st) => st.current && st.statusCode === s.statusCode,
                  );
                  return (
                    <li key={s.statusCode}>
                      <div className={styles.stageBarMeta}>
                        <strong>
                          {s.statusCode}
                          {isCurrent ? ' (current)' : ''}
                        </strong>
                        <span>{s.label}</span>
                      </div>
                      <div className={styles.stageBarTrack} aria-hidden>
                        <div
                          className={styles.stageBarFill}
                          style={{
                            width: `${Math.round((s.durationMs / max) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
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

            {ticket.type.code !== 'problem' &&
            ticket.type.code !== 'change' &&
            ticket.type.code !== 'task' &&
            (can(user, 'tickets:read_queue') ||
              can(user, 'tickets:read_all')) &&
            can(user, 'tickets:write') ? (
              <div className={styles.deleteRow}>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  disabled={busy}
                  onClick={() => void raiseProblem()}
                >
                  <Icon icon={GitBranchPlus} size="sm" />
                  Raise problem
                </button>
                <span className={styles.hint}>
                  Creates a PRB and links this ticket as a related incident.
                </span>
              </div>
            ) : null}
          </section>

          <section className={styles.activityBlock} aria-labelledby="ticket-activity">
            <div className={styles.activityHead}>
              <h3 id="ticket-activity">
                <Icon icon={History} size="sm" />
                Activity
              </h3>
              <div
                className={styles.activityFilters}
                role="tablist"
                aria-label="Activity filter"
              >
                {(
                  [
                    ['all', 'All'],
                    ['events', 'Trail'],
                    ['comments', 'Comments'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="tab"
                    aria-selected={activityFilter === value}
                    className={`${styles.activityFilterBtn} ${
                      activityFilter === value
                        ? styles.activityFilterBtnActive
                        : ''
                    }`}
                    onClick={() => setActivityFilter(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p className={styles.hint}>
              Assignment, status, and ownership changes appear here — not only
              comments.
            </p>
            <ol className={styles.activityTimeline}>
              {visibleActivity.length === 0 ? (
                <li className={styles.hint}>No activity yet.</li>
              ) : (
                visibleActivity.map((item) => {
                  if (item.kind === 'event') {
                    return (
                      <li
                        key={`e-${item.id}`}
                        className={`${styles.activityItem} ${historyTone(item.field)}`}
                      >
                        <span className={styles.activityDot} aria-hidden>
                          {item.field === 'assignee' || item.field === 'team' ? (
                            <Icon icon={UserRound} size="sm" />
                          ) : (
                            <Icon icon={History} size="sm" />
                          )}
                        </span>
                        <div className={styles.activityBody}>
                          <p className={styles.activitySummary}>
                            <strong>{item.summary}</strong>
                          </p>
                          {item.oldLabel &&
                          item.newLabel &&
                          item.oldLabel !== item.newLabel &&
                          item.field !== 'created' ? (
                            <p className={styles.activityChange}>
                              <span>{item.oldLabel}</span>
                              <span aria-hidden> → </span>
                              <span>{item.newLabel}</span>
                            </p>
                          ) : null}
                          <p className={styles.activityMeta}>
                            {item.actorName}
                            {' · '}
                            {new Date(item.at).toLocaleString(undefined, {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                            })}
                          </p>
                        </div>
                      </li>
                    );
                  }
                  return (
                    <li
                      key={`c-${item.id}`}
                      className={`${styles.activityItem} ${styles.activityComment}`}
                    >
                      <span className={styles.activityDot} aria-hidden>
                        <Icon icon={MessageSquare} size="sm" />
                      </span>
                      <div className={styles.activityBody}>
                        <p className={styles.activitySummary}>
                          <strong>
                            {item.authorName}
                            {item.isInternal ? ' · Internal note' : ''}
                          </strong>
                        </p>
                        <p className={styles.activityCommentBody}>{item.body}</p>
                        <p className={styles.activityMeta}>
                          {new Date(item.at).toLocaleString(undefined, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </p>
                      </div>
                    </li>
                  );
                })
              )}
            </ol>
            {(can(user, 'tickets:write') ||
              ticket.requester?.id === user.id) && (
              <form className={styles.commentForm} onSubmit={onComment}>
                <label>
                  Add comment
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    onFocus={() => setComposing(true)}
                    onBlur={() => setComposing(false)}
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

          <div className={styles.assignPanel}>
            <h3>
              <Icon icon={Timer} size="sm" />
              Work logs
            </h3>
            <p className={styles.hint}>
              {workMinutesTotal > 0
                ? `${workMinutesTotal} minute${workMinutesTotal === 1 ? '' : 's'} logged`
                : 'No time logged yet.'}
            </p>
            {canLogWork ? (
              <form className={styles.workLogForm} onSubmit={onAddWorkLog}>
                <label>
                  Minutes
                  <input
                    type="number"
                    min={1}
                    max={24 * 60}
                    value={workMinutes}
                    onChange={(e) => setWorkMinutes(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Note (optional)
                  <input
                    value={workNote}
                    onChange={(e) => setWorkNote(e.target.value)}
                    maxLength={500}
                    placeholder="What did you work on?"
                  />
                </label>
                <button type="submit" className={styles.btn} disabled={busy}>
                  Log time
                </button>
              </form>
            ) : null}
            {workLogs.length > 0 ? (
              <ul className={styles.workLogList}>
                {workLogs.map((log) => (
                  <li key={log.id}>
                    <strong>{log.minutes}m</strong>
                    <span>
                      {personName(log.author)} ·{' '}
                      {new Date(log.workedAt).toLocaleString()}
                    </span>
                    {log.note ? <em>{log.note}</em> : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {canEditLocation ? (
            <form className={styles.assignPanel} onSubmit={saveLocation}>
              <h3>
                <Icon icon={MapPin} size="sm" />
                Location
              </h3>
              <p className={styles.hint}>
                Ticket origin site — where the issue is located. Correct if the
                requester picked the wrong office.
              </p>
              <label>
                Site
                <LocationSelect
                  value={locationId}
                  onChange={setLocationId}
                  locations={locations}
                  includeInactive
                  allowEmpty
                  emptyLabel="No location"
                  aria-label="Ticket origin location"
                />
              </label>
              <button type="submit" className={styles.btn} disabled={busy}>
                <Icon icon={Save} size="sm" />
                Update location
              </button>
            </form>
          ) : (
            <div className={styles.assignPanel}>
              <h3>
                <Icon icon={MapPin} size="sm" />
                Location
              </h3>
              <p>
                <strong>{originLabel}</strong>
              </p>
              <p className={styles.hint}>Ticket origin site</p>
            </div>
          )}

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
                team. Rules with auto-assign also pick the least-loaded skilled
                agent on that team.
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
                      {r.autoAssignAssignee
                        ? r.skill
                          ? ` · auto (${r.skill.name})`
                          : ' · auto (least open)'
                        : ''}
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
