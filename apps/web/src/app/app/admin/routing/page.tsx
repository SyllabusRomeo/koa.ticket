'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  type AssignmentRule,
  type AuthUser,
  type Skill,
  type TeamWithMembers,
} from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { GitBranch, Timer, Wrench } from 'lucide-react';
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
type DirectoryUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
};

export default function RoutingAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [policies, setPolicies] = useState<SlaPolicy[]>([]);
  const [rules, setRules] = useState<AssignmentRule[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
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
  const [ruleSkillId, setRuleSkillId] = useState('');
  const [ruleAutoAssign, setRuleAutoAssign] = useState(false);
  const [rulePriority, setRulePriority] = useState(100);

  const [skillCode, setSkillCode] = useState('');
  const [skillName, setSkillName] = useState('');
  const [skillDesc, setSkillDesc] = useState('');

  const [agentUserId, setAgentUserId] = useState('');
  const [agentSkillIds, setAgentSkillIds] = useState<string[]>([]);

  const canSla = !!user && can(user, 'settings:manage');
  const canRules = !!user && can(user, 'org:manage');
  const canReadRules =
    !!user && (can(user, 'org:read') || can(user, 'org:manage'));
  const canUsers = !!user && can(user, 'users:read');

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
          const [r, t, s] = await Promise.all([
            api.assignmentRules(),
            api.listTeams(),
            api.listSkills(),
          ]);
          if (!cancelled) {
            setRules(r);
            setTeams(t);
            setSkills(s);
          }
        }
        if (can(user, 'org:manage')) {
          const locs = await api.listLocations();
          if (!cancelled) setLocations(locs);
        }
        if (can(user, 'users:read')) {
          try {
            const users = await api.listUsers();
            if (!cancelled) {
              setDirectory(
                users.filter((u) => u.isActive).map((u) => ({
                  id: u.id,
                  email: u.email,
                  firstName: u.firstName,
                  lastName: u.lastName,
                  isActive: u.isActive,
                })),
              );
            }
          } catch {
            /* optional */
          }
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
        skillId: ruleSkillId || undefined,
        autoAssignAssignee: ruleAutoAssign,
        priority: rulePriority,
      });
      setRuleName('');
      setRuleTeamId('');
      setRuleCategoryId('');
      setRuleTypeId('');
      setRuleLocationId('');
      setRuleSkillId('');
      setRuleAutoAssign(false);
      setMessage('Assignment rule created.');
      setRules(await api.assignmentRules());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setBusy(false);
    }
  }

  async function onCreateSkill(e: FormEvent) {
    e.preventDefault();
    if (!canRules) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.createSkill({
        code: skillCode.trim(),
        name: skillName.trim(),
        description: skillDesc.trim() || undefined,
      });
      setSkillCode('');
      setSkillName('');
      setSkillDesc('');
      setMessage('Skill created.');
      setSkills(await api.listSkills());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create skill');
    } finally {
      setBusy(false);
    }
  }

  async function onLoadAgentSkills(userId: string) {
    setAgentUserId(userId);
    setAgentSkillIds([]);
    if (!userId) return;
    try {
      const owned = await api.getUserSkills(userId);
      setAgentSkillIds(owned.map((s) => s.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    }
  }

  async function onSaveAgentSkills(e: FormEvent) {
    e.preventDefault();
    if (!canRules || !agentUserId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.setUserSkills(agentUserId, agentSkillIds);
      setMessage('Agent skills updated.');
      setSkills(await api.listSkills());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save skills');
    } finally {
      setBusy(false);
    }
  }

  function toggleAgentSkill(skillId: string) {
    setAgentSkillIds((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId],
    );
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
        Configure SLA targets, skills, and automatic routing. Rules can send
        tickets to a team and optionally auto-assign the least-loaded skilled
        agent.
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
                      {r.autoAssignAssignee
                        ? ` · auto-assign${r.skill ? ` (${r.skill.name})` : ' (least open)'}`
                        : ''}
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
                <label className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={ruleAutoAssign}
                    onChange={(e) => setRuleAutoAssign(e.target.checked)}
                  />
                  Auto-assign least-loaded agent on the team
                </label>
                {ruleAutoAssign ? (
                  <label>
                    Required skill (optional)
                    <select
                      value={ruleSkillId}
                      onChange={(e) => setRuleSkillId(e.target.value)}
                    >
                      <option value="">Any team member</option>
                      {skills.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
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

        {canReadRules ? (
          <section className={styles.panel}>
            <h2>
              <Icon icon={Wrench} size="sm" />
              Skills
            </h2>
            {skills.length === 0 ? (
              <EmptyState icon={Wrench}>
                No skills yet. Create skills, assign them to agents, then use
                them on auto-assign rules.
              </EmptyState>
            ) : (
              <ul className={styles.list}>
                {skills.map((s) => (
                  <li key={s.id}>
                    <strong>
                      {s.name} <code>{s.code}</code>
                    </strong>
                    <em>
                      {s.description || 'No description'}
                      {typeof s._count?.users === 'number'
                        ? ` · ${s._count.users} agent${s._count.users === 1 ? '' : 's'}`
                        : ''}
                    </em>
                  </li>
                ))}
              </ul>
            )}
            {canRules ? (
              <>
                <form className={styles.form} onSubmit={onCreateSkill}>
                  <h3>Add skill</h3>
                  <label>
                    Code
                    <input
                      value={skillCode}
                      onChange={(e) => setSkillCode(e.target.value)}
                      required
                      minLength={2}
                      placeholder="NETWORK"
                    />
                  </label>
                  <label>
                    Name
                    <input
                      value={skillName}
                      onChange={(e) => setSkillName(e.target.value)}
                      required
                      minLength={2}
                    />
                  </label>
                  <label>
                    Description
                    <input
                      value={skillDesc}
                      onChange={(e) => setSkillDesc(e.target.value)}
                    />
                  </label>
                  <button type="submit" className={appStyles.btn} disabled={busy}>
                    Create skill
                  </button>
                </form>

                {canUsers || directory.length > 0 ? (
                  <form className={styles.form} onSubmit={onSaveAgentSkills}>
                    <h3>Assign skills to agent</h3>
                    <label>
                      Agent
                      <select
                        value={agentUserId}
                        onChange={(e) => onLoadAgentSkills(e.target.value)}
                      >
                        <option value="">Select agent</option>
                        {(directory.length
                          ? directory
                          : teams.flatMap((t) =>
                              t.members.map((m) => ({
                                id: m.user.id,
                                email: m.user.email,
                                firstName: m.user.firstName,
                                lastName: m.user.lastName,
                                isActive: true,
                              })),
                            )
                        )
                          .filter(
                            (u, i, arr) =>
                              arr.findIndex((x) => x.id === u.id) === i,
                          )
                          .map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.firstName} {u.lastName} ({u.email})
                            </option>
                          ))}
                      </select>
                    </label>
                    {agentUserId && skills.length > 0 ? (
                      <fieldset className={styles.skillSet}>
                        <legend>Skills</legend>
                        {skills.map((s) => (
                          <label key={s.id} className={styles.checkLabel}>
                            <input
                              type="checkbox"
                              checked={agentSkillIds.includes(s.id)}
                              onChange={() => toggleAgentSkill(s.id)}
                            />
                            {s.name}
                          </label>
                        ))}
                      </fieldset>
                    ) : null}
                    <button
                      type="submit"
                      className={appStyles.btn}
                      disabled={busy || !agentUserId}
                    >
                      Save agent skills
                    </button>
                  </form>
                ) : null}
              </>
            ) : null}
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
