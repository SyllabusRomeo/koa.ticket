'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser, type TeamWithMembers } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { SectionHeading } from '@/components/SectionHeading';
import { LocationSelect } from '@/components/LocationSelect';
import { Plus, Save, Users } from 'lucide-react';
import appStyles from '../../app.module.css';
import styles from './teams.module.css';

type LocationRow = {
  id: string;
  code: string;
  name: string;
};

type DepartmentRow = {
  id: string;
  code: string;
  name: string;
};

type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: Array<{ code: string; name: string }>;
};

const EMPTY_FORM = {
  code: '',
  name: '',
  description: '',
  locationId: '',
  departmentId: '',
};

export default function TeamsAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [memberUserId, setMemberUserId] = useState('');
  const [memberIsLead, setMemberIsLead] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

  const canManage = !!user && can(user, 'org:manage');

  async function refresh() {
    const [teamList, locList, deptList] = await Promise.all([
      api.listTeams(),
      api.listLocations(),
      api.listDepartments(),
    ]);
    setTeams(teamList);
    setLocations(locList);
    setDepartments(deptList);
    return teamList;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (!can(user, 'org:read') && !can(user, 'org:manage')) {
          router.replace('/app');
          return;
        }
        if (!cancelled) setUser(user);
        const teamList = await refresh();
        if (!cancelled) {
          setSelectedId((prev) => prev || teamList[0]?.id || '');
        }
        if (can(user, 'users:read') || can(user, 'users:manage')) {
          const userList = await api.listUsers();
          if (!cancelled) setUsers(userList.filter((u) => u.isActive));
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const selected = useMemo(
    () => teams.find((t) => t.id === selectedId) ?? null,
    [teams, selectedId],
  );

  useEffect(() => {
    if (!selected) {
      setEditName('');
      setEditDescription('');
      return;
    }
    setEditName(selected.name);
    setEditDescription(selected.description ?? '');
    setMemberUserId('');
    setMemberIsLead(false);
  }, [selected]);

  const agentCandidates = useMemo(() => {
    const memberIds = new Set(selected?.members.map((m) => m.user.id) ?? []);
    return users.filter((u) => {
      if (memberIds.has(u.id)) return false;
      return u.roles.some((r) =>
        ['agent', 'senior_agent', 'it_manager', 'sysadmin'].includes(r.code),
      );
    });
  }, [users, selected]);

  function pickTeam(id: string) {
    setSelectedId(id);
    setCreating(false);
    setError(null);
    setMessage(null);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!canManage) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const created = await api.createTeam({
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        locationId: form.locationId || undefined,
        departmentId: form.departmentId || undefined,
      });
      await refresh();
      setSelectedId(created.id);
      setForm(EMPTY_FORM);
      setCreating(false);
      setMessage(`Created team ${created.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !selected) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.updateTeam(selected.id, {
        name: editName.trim(),
        description: editDescription,
      });
      await refresh();
      setMessage('Team updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function onAddMember(e: FormEvent) {
    e.preventDefault();
    if (!canManage || !selected || !memberUserId) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.addTeamMember(selected.id, {
        userId: memberUserId,
        isLead: memberIsLead,
      });
      await refresh();
      setMemberUserId('');
      setMemberIsLead(false);
      setMessage('Member added');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Add member failed');
    } finally {
      setBusy(false);
    }
  }

  async function onRemoveMember(userId: string, label: string) {
    if (!canManage || !selected) return;
    if (!window.confirm(`Remove ${label} from ${selected.name}?`)) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.removeTeamMember(selected.id, userId);
      await refresh();
      setMessage('Member removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Remove failed');
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
      <main className={appStyles.page}>
        <p className={appStyles.muted}>Loading service teams…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="Service teams">
      <div className={styles.layout}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Administration · Org</p>
          <p className={styles.lede}>
            Service teams (support groups) own queues and receive routed
            tickets. Create teams here, then assign agents as members.
          </p>
        </header>

        {error ? <p className={appStyles.error}>{error}</p> : null}
        {message ? <p className={styles.bannerOk}>{message}</p> : null}

        <div className={styles.split}>
          <section className={styles.panel}>
            <div className={styles.sectionHead}>
              <div>
                <SectionHeading icon={Users} className={styles.sectionTitle}>
                  Teams
                </SectionHeading>
                <p className={styles.sectionHint}>
                  {teams.length} active · seed includes Service Desk
                </p>
              </div>
              {canManage ? (
                <Button
                  type="button"
                  variant={creating ? 'secondary' : 'primary'}
                  onClick={() => {
                    setCreating((v) => !v);
                    setError(null);
                    setMessage(null);
                  }}
                >
                  {creating ? 'Cancel' : 'New team'}
                </Button>
              ) : null}
            </div>

            {creating && canManage ? (
              <form className={styles.createForm} onSubmit={onCreate}>
                <label className={styles.field}>
                  <span>Code</span>
                  <input
                    required
                    minLength={2}
                    maxLength={32}
                    placeholder="e.g. NET"
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, code: e.target.value }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Name</span>
                  <input
                    required
                    minLength={2}
                    maxLength={120}
                    placeholder="Network Operations"
                    value={form.name}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, name: e.target.value }))
                    }
                  />
                </label>
                <label className={`${styles.field} ${styles.fieldFull}`}>
                  <span>Description</span>
                  <input
                    placeholder="Optional"
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                  />
                </label>
                <label className={styles.field}>
                  <span>Location</span>
                  <LocationSelect
                    value={form.locationId}
                    onChange={(id) =>
                      setForm((f) => ({ ...f, locationId: id }))
                    }
                    locations={locations}
                    allowEmpty
                    emptyLabel="None"
                  />
                </label>
                <label className={styles.field}>
                  <span>Department</span>
                  <select
                    value={form.departmentId}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, departmentId: e.target.value }))
                    }
                  >
                    <option value="">None</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </label>
                <div className={`${styles.formActions} ${styles.fieldFull}`}>
                  <Button type="submit" disabled={busy}>
                    <Icon icon={Plus} size="sm" />
                    {busy ? 'Creating…' : 'Create team'}
                  </Button>
                </div>
              </form>
            ) : null}

            {teams.length === 0 ? (
              <div className={styles.empty}>
                No teams yet. Create a service team to route work.
              </div>
            ) : (
              <ul className={styles.teamList}>
                {teams.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className={
                        t.id === selectedId
                          ? `${styles.teamItem} ${styles.teamItemActive}`
                          : styles.teamItem
                      }
                      onClick={() => pickTeam(t.id)}
                    >
                      <strong>{t.name}</strong>
                      <span>
                        {t.code} · {t.members.length} member
                        {t.members.length === 1 ? '' : 's'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={styles.panel}>
            {!selected ? (
              <p className={styles.emptyState}>
                Select a team to view details.
              </p>
            ) : (
              <>
                <div className={styles.sectionHead}>
                  <div>
                    <h2 className={styles.sectionTitle}>{selected.name}</h2>
                    <p className={styles.sectionHint}>
                      Code <code>{selected.code}</code>
                      {selected.department
                        ? ` · ${selected.department.name}`
                        : ''}
                      {selected.location ? ` · ${selected.location.name}` : ''}
                    </p>
                  </div>
                </div>

                {canManage ? (
                  <form className={styles.editForm} onSubmit={onSave}>
                    <label className={styles.field}>
                      <span>Name</span>
                      <input
                        required
                        minLength={2}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    </label>
                    <label className={`${styles.field} ${styles.fieldFull}`}>
                      <span>Description</span>
                      <textarea
                        rows={2}
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                      />
                    </label>
                    <div className={`${styles.formActions} ${styles.fieldFull}`}>
                      <Button type="submit" disabled={busy}>
                        <Icon icon={Save} size="sm" />
                        {busy ? 'Saving…' : 'Save changes'}
                      </Button>
                    </div>
                  </form>
                ) : (
                  <p className={styles.desc}>
                    {selected.description || 'No description.'}
                  </p>
                )}

                <h3 className={styles.subhead}>Members</h3>
                {selected.members.length === 0 ? (
                  <p className={styles.emptySmall}>
                    No members yet. Assignment rules still route to the team;
                    add agents so they get notifications.
                  </p>
                ) : (
                  <ul className={styles.memberList}>
                    {selected.members.map((m) => (
                      <li key={m.user.id} className={styles.memberRow}>
                        <div>
                          <strong>
                            {m.user.firstName} {m.user.lastName}
                            {m.isLead ? (
                              <span className={styles.leadBadge}>Lead</span>
                            ) : null}
                          </strong>
                          <span>{m.user.email}</span>
                        </div>
                        {canManage ? (
                          <Button
                            type="button"
                            variant="dangerOutline"
                            disabled={busy}
                            onClick={() =>
                              onRemoveMember(
                                m.user.id,
                                `${m.user.firstName} ${m.user.lastName}`,
                              )
                            }
                          >
                            Remove
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}

                {canManage && users.length > 0 ? (
                  <form className={styles.memberForm} onSubmit={onAddMember}>
                    <label className={styles.field}>
                      <span>Add agent</span>
                      <select
                        required
                        value={memberUserId}
                        onChange={(e) => setMemberUserId(e.target.value)}
                      >
                        <option value="">Select user…</option>
                        {agentCandidates.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.firstName} {u.lastName} · {u.email}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.check}>
                      <input
                        type="checkbox"
                        checked={memberIsLead}
                        onChange={(e) => setMemberIsLead(e.target.checked)}
                      />
                      Team lead
                    </label>
                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={busy || !memberUserId}
                    >
                      Add member
                    </Button>
                  </form>
                ) : null}
              </>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}
