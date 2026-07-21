'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  type AssignmentRule,
  type AuthUser,
  type TeamWithMembers,
} from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { GitBranch, Timer } from 'lucide-react';
import appStyles from '../../app.module.css';
import styles from './routing.module.css';

type SlaPolicy = {
  id: string;
  name: string;
  priorityId: string | null;
  firstResponseMinutes: number;
  resolveMinutes: number;
  isActive: boolean;
  escalations?: Array<{
    id: string;
    thresholdPercent: number;
    notifyRoleCodes: string;
  }>;
};

type Priority = { id: string; code: string; name: string };
type Category = { id: string; code: string; name: string };
type TicketType = { id: string; code: string; name: string };
type Location = { id: string; code: string; name: string };

export default function RoutingAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<TicketType[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [slaName, setSlaName] = useState('');
  const [slaPriorityId, setSlaPriorityId] = useState('');
  const [slaFirst, setSlaFirst] = useState(60);
  const [slaResolve, setSlaResolve] = useState(480);

  const [ruleName, setRuleName] = useState('');
  const [ruleTeamId, setRuleTeamId] = useState('');
  const [ruleCategoryId, setRuleCategoryId] = useState('');
  const [ruleTypeId, setRuleTypeId] = useState('');
  const [ruleLocationId, setRuleLocationId] = useState('');
  const [rulePriority, setRulePriority] = useState(100);

  const canSla = !!user && can(user, 'settings:manage');
  const canRules = !!user && can(user, 'org:manage');
  const canReadRules = !!user && (can(user, 'org:read') || can(user, 'org:manage'));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (
          !can(user, 'settings:manage') &&
          !can(user, 'org:read') &&
          !can(user, 'org:manage')
        ) {
          router.replace('/app');
          return;
        }
        if (!cancelled) setUser(user);

        if (can(user, 'settings:manage')) {
          const p = await api.slaPolicies();
          if (!cancelled) setPolicies(p);
        }
        if (can(user, 'org:read') || can(user, 'org:manage')) {
          const [r, t] = await Promise.all([
            api.assignmentRules(),
            api.listTeams(),
          ]);
          if (!cancelled) {
            setRules(r);
            setTeams(t);
          }
        }
        if (can(user, 'org:manage')) {
          const locs = await api.listLocations();
          if (!cancelled) setLocations(locs);
        }
        try {
          const meta = await api.ticketMeta();
          if (!cancelled) {
            if (meta.priorities) setPriorities(meta.priorities);
            setCategories(meta.categories ?? []);
            setTypes(meta.types ?? []);
          }
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

  async function onCreateSla(e: FormEvent) {
    e.preventDefault();
    if (!canSla) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.createSlaPolicy({
        name: slaName.trim(),
        priorityId: slaPriorityId || undefined,
        firstResponseMinutes: slaFirst,
        resolveMinutes: slaResolve,
      });
      setSlaName('');
      setSlaPriorityId('');
      setMessage('SLA policy created.');
      setPolicies(await api.slaPolicies());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create policy');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateRule(e: FormEvent) {
    e.preventDefault();
    if (!canRules) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.createAssignmentRule({
        name: ruleName.trim(),
        teamId: ruleTeamId,
        categoryId: ruleCategoryId || undefined,
        ticketTypeId: ruleTypeId || undefined,
        locationId: ruleLocationId || undefined,
        priority: rulePriority,
      });
      setRuleName('');
      setRuleTeamId('');
      setRuleCategoryId('');
      setRuleTypeId('');
      setRuleLocationId('');
      setMessage('Assignment rule created.');
      setRules(await api.assignmentRules());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <main className={appStyles.page}>
        <p className={appStyles.muted}>Loading…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="Routing & SLA">
      <p className={appStyles.mission}>
        Configure SLA targets and automatic team routing. Sysadmins manage SLA
        policies; org managers manage assignment rules.
      </p>
      {error ? (
        <p className={appStyles.error} role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className={appStyles.ok}>{message}</p> : null}

      <div className={styles.grid}>
        {canSla || policies.length > 0 ? (
          <section className={styles.panel}>
            <h2>
              <Icon icon={Timer} size="sm" />
              SLA policies
            </h2>
            {policies.length === 0 ? (
              <EmptyState icon={Timer}>No active SLA policies yet.</EmptyState>
            ) : (
              <ul className={styles.list}>
                {policies.map((p) => (
                  <li key={p.id}>
                    <strong>{p.name}</strong>
                    <em>
                      First response {p.firstResponseMinutes}m · Resolve{' '}
                      {p.resolveMinutes}m
                      {p.escalations?.length
                        ? ` · ${p.escalations.length} escalations`
                        : ''}
                    </em>
                  </li>
                ))}
              </ul>
            )}
            {canSla ? (
              <form className={styles.form} onSubmit={onCreateSla}>
                <h3>Add policy</h3>
                <label>
                  Name
                  <input
                    value={slaName}
                    onChange={(e) => setSlaName(e.target.value)}
                    required
                    minLength={2}
                  />
                </label>
                <label>
                  Priority (optional)
                  <select
                    value={slaPriorityId}
                    onChange={(e) => setSlaPriorityId(e.target.value)}
                  >
                    <option value="">Any / default</option>
                    {priorities.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  First response (minutes)
                  <input
                    type="number"
                    min={1}
                    value={slaFirst}
                    onChange={(e) => setSlaFirst(Number(e.target.value))}
                    required
                  />
                </label>
                <label>
                  Resolution (minutes)
                  <input
                    type="number"
                    min={1}
                    value={slaResolve}
                    onChange={(e) => setSlaResolve(Number(e.target.value))}
                    required
                  />
                </label>
                <button type="submit" className={appStyles.btn} disabled={busy}>
                  Create SLA policy
                </button>
              </form>
            ) : null}
          </section>
        ) : null}

        {canReadRules ? (
          <section className={styles.panel}>
            <h2>
              <Icon icon={GitBranch} size="sm" />
              Assignment rules
            </h2>
            {rules.length === 0 ? (
              <EmptyState icon={GitBranch}>
                No active assignment rules. Tickets will not auto-route to a
                team.
              </EmptyState>
            ) : (
              <ul className={styles.list}>
                {rules.map((r) => (
                  <li key={r.id}>
                    <strong>
                      #{r.priority} {r.name}
                    </strong>
                    <em>
                      {r.category?.name ?? 'Any category'}
                      {r.ticketType ? ` · ${r.ticketType.name}` : ''}
                      {r.location ? ` · ${r.location.name}` : ''}
                      {' → '}
                      {r.team?.name ?? 'team'}
                    </em>
                  </li>
                ))}
              </ul>
            )}
            {canRules ? (
              <form className={styles.form} onSubmit={onCreateRule}>
                <h3>Add rule</h3>
                <label>
                  Name
                  <input
                    value={ruleName}
                    onChange={(e) => setRuleName(e.target.value)}
                    required
                    minLength={2}
                  />
                </label>
                <label>
                  Target team
                  <select
                    value={ruleTeamId}
                    onChange={(e) => setRuleTeamId(e.target.value)}
                    required
                  >
                    <option value="">Select team</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Category (optional)
                  <select
                    value={ruleCategoryId}
                    onChange={(e) => setRuleCategoryId(e.target.value)}
                  >
                    <option value="">Any</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Ticket type (optional)
                  <select
                    value={ruleTypeId}
                    onChange={(e) => setRuleTypeId(e.target.value)}
                  >
                    <option value="">Any</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Location (optional)
                  <select
                    value={ruleLocationId}
                    onChange={(e) => setRuleLocationId(e.target.value)}
                  >
                    <option value="">Any</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Match priority (lower runs first)
                  <input
                    type="number"
                    min={1}
                    value={rulePriority}
                    onChange={(e) => setRulePriority(Number(e.target.value))}
                  />
                </label>
                <button
                  type="submit"
                  className={appStyles.btn}
                  disabled={busy || !ruleTeamId}
                >
                  Create assignment rule
                </button>
              </form>
            ) : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
