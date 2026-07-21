'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button, ButtonLink } from '@/components/Button';
import appStyles from '../../app.module.css';
import styles from './roles.module.css';
import { Save, Users } from 'lucide-react';
import { Icon } from '@/components/Icon';

type RoleRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  userCount: number;
  permissions: string[];
};

type PermRow = {
  code: string;
  name: string;
  description: string | null;
};

type UserRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  roles: Array<{ code: string; name: string }>;
  primaryRole: { code: string; name: string } | null;
  extraPermissions: string[];
};

function groupPermissions(perms: string[]) {
  const groups: Record<string, string[]> = {};
  for (const p of perms) {
    const [ns] = p.split(':');
    const key = ns || 'other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
}

function sameSet(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const set = new Set(b);
  return a.every((x) => set.has(x));
}

export default function RolesAccessPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [allPermissions, setAllPermissions] = useState<PermRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [activeRole, setActiveRole] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [primaryRole, setPrimaryRole] = useState('');
  const [baselineRole, setBaselineRole] = useState('');
  const [extraPerms, setExtraPerms] = useState<string[]>([]);
  const [baselineExtras, setBaselineExtras] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    const [matrix, userList] = await Promise.all([
      api.rolesMatrix(),
      api.listUsers(),
    ]);
    setRoles(matrix.roles);
    setAllPermissions(matrix.allPermissions);
    setUsers(userList);
    setActiveRole((prev) => prev || matrix.roles[0]?.code || '');
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (!can(user, 'roles:manage') && !can(user, 'users:manage')) {
          router.replace('/app');
          return;
        }
        if (!cancelled) setUser(user);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const selectedRole = roles.find((r) => r.code === activeRole) ?? roles[0];
  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
        u.roles.some(
          (r) => r.code.includes(q) || r.name.toLowerCase().includes(q),
        ) ||
        u.extraPermissions.some((p) => p.includes(q)),
    );
  }, [users, query]);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const rolePermSet = useMemo(() => {
    const r = roles.find((x) => x.code === primaryRole);
    return new Set(r?.permissions ?? []);
  }, [roles, primaryRole]);

  const dirty =
    !!selectedUserId &&
    (primaryRole !== baselineRole || !sameSet(extraPerms, baselineExtras));

  function onPickUser(id: string) {
    setSelectedUserId(id);
    const u = users.find((x) => x.id === id);
    const code = u?.primaryRole?.code ?? u?.roles[0]?.code ?? '';
    const extras = u?.extraPermissions ?? [];
    setPrimaryRole(code);
    setBaselineRole(code);
    setExtraPerms(extras);
    setBaselineExtras(extras);
    setMessage(null);
    setError(null);
  }

  function cancelEdit() {
    setPrimaryRole(baselineRole);
    setExtraPerms(baselineExtras);
    setMessage(null);
    setError(null);
  }

  function clearSelection() {
    setSelectedUserId('');
    setPrimaryRole('');
    setBaselineRole('');
    setExtraPerms([]);
    setBaselineExtras([]);
    setMessage(null);
    setError(null);
  }

  function onPrimaryRoleChange(code: string) {
    setPrimaryRole(code);
    const nextRole = roles.find((r) => r.code === code);
    const implied = new Set(nextRole?.permissions ?? []);
    // Keep extras that remain additive under the new role.
    setExtraPerms((prev) => prev.filter((p) => !implied.has(p)));
  }

  function toggleExtra(code: string) {
    if (rolePermSet.has(code)) return;
    setExtraPerms((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  async function saveAccess() {
    if (!selectedUserId || !primaryRole) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.setUserAccess(selectedUserId, {
        roleCode: primaryRole,
        extraPermissionCodes: extraPerms,
      });
      await load();
      setBaselineRole(primaryRole);
      setBaselineExtras(extraPerms);
      setMessage(
        'Access saved. Ask the user to re-sign-in if they already have an active session.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
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

  const extraGroups = useMemo(() => {
    const codes = allPermissions.map((p) => p.code);
    return groupPermissions(codes);
  }, [allPermissions]);

  if (loading || !user) {
    return (
      <main className={appStyles.page}>
        <p className={appStyles.muted}>Loading roles…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="Roles & Access">
      <div className={styles.layout}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Administration</p>
          <p className={styles.intro}>
            Each person has one primary role. Grant additional permissions only
            when the base role is not enough — extras are additive, never a
            second role.
          </p>
        </header>

        {error ? (
          <p className={appStyles.error} role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className={styles.bannerOk}>{message}</p> : null}

        <section className={styles.panel} aria-labelledby="understand-roles">
          <div className={styles.sectionHead}>
            <div>
              <h2 id="understand-roles" className={styles.sectionTitle}>
                Understand roles
              </h2>
              <p className={styles.sectionHint}>
                Select a role to inspect its built-in permission matrix by area.
              </p>
            </div>
            {selectedRole ? (
              <span className={styles.badge}>
                {selectedRole.permissions.length} permissions
              </span>
            ) : null}
          </div>

          <div className={styles.roleRail}>
            <div className={styles.roleListWrap}>
              <p className={styles.railLabel}>Roles</p>
              <ul className={styles.roleList}>
                {roles.map((r) => {
                  const active = selectedRole?.code === r.code;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        className={`${styles.roleBtn} ${
                          active ? styles.roleBtnActive : ''
                        }`}
                        aria-current={active ? 'true' : undefined}
                        onClick={() => setActiveRole(r.code)}
                      >
                        <strong>{r.name}</strong>
                        <span>
                          {r.userCount} user{r.userCount === 1 ? '' : 's'} ·{' '}
                          {r.permissions.length} perms
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            {selectedRole ? (
              <div className={styles.roleDetail}>
                <div className={styles.roleDetailHead}>
                  <div>
                    <p className={styles.codeTag}>{selectedRole.code}</p>
                    <h3>{selectedRole.name}</h3>
                  </div>
                  <p className={styles.roleStat}>
                    {selectedRole.userCount} assigned
                  </p>
                </div>
                <p className={styles.roleDesc}>
                  {selectedRole.description ??
                    `Role code ${selectedRole.code} — permissions below.`}
                </p>
                <div className={styles.permGroups}>
                  {groupPermissions(selectedRole.permissions).map(
                    ([group, perms]) => (
                      <div key={group} className={styles.permGroup}>
                        <h4>{group}</h4>
                        <div className={styles.permChips}>
                          {perms.map((p) => (
                            <span key={p} className={styles.permChip}>
                              {p}
                            </span>
                          ))}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.emptyPanel}>
                <strong>No role selected</strong>
                <p>Choose a role from the list to view its permissions.</p>
              </div>
            )}
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="assign-access">
          <div className={styles.sectionHead}>
            <div>
              <h2 id="assign-access" className={styles.sectionTitle}>
                Assign access
              </h2>
              <p className={styles.sectionHint}>
                Pick a person, choose one primary role (radio), then optionally
                add extra permissions (checkboxes). Save or Cancel when done.
              </p>
            </div>
          </div>

          <div className={styles.assignGrid}>
            <div className={styles.userSearch}>
              <label className={styles.fieldLabel}>
                Find user
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name, email, or role…"
                />
              </label>
              <ul className={styles.userList}>
                {filteredUsers.length === 0 ? (
                  <li className={styles.emptyInline}>No users match.</li>
                ) : (
                  filteredUsers.map((u) => {
                    const active = selectedUserId === u.id;
                    const roleLabel =
                      u.primaryRole?.code ?? u.roles[0]?.code ?? 'no role';
                    const extraN = u.extraPermissions.length;
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          className={`${styles.userRow} ${
                            active ? styles.userRowActive : ''
                          }`}
                          aria-current={active ? 'true' : undefined}
                          onClick={() => onPickUser(u.id)}
                        >
                          <strong>
                            {u.firstName} {u.lastName}
                          </strong>
                          <em>
                            {u.email}
                            {` · ${roleLabel}`}
                            {extraN
                              ? ` · +${extraN} extra`
                              : ''}
                          </em>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            <div className={styles.assignPanel}>
              {selectedUser ? (
                <>
                  <div className={styles.assignHead}>
                    <div>
                      <p className={styles.eyebrow}>Editing access</p>
                      <h3>
                        {selectedUser.firstName} {selectedUser.lastName}
                      </h3>
                      <p className={styles.sectionHint}>{selectedUser.email}</p>
                    </div>
                    <button
                      type="button"
                      className={styles.linkish}
                      onClick={clearSelection}
                    >
                      Clear
                    </button>
                  </div>

                  <fieldset className={styles.roleFieldset}>
                    <legend className={styles.fieldsetLegend}>
                      Primary role
                    </legend>
                    <p className={styles.fieldsetHint}>
                      Single choice — one role defines the base permission set.
                    </p>
                    <div
                      className={styles.roleRadios}
                      role="radiogroup"
                      aria-label="Primary role"
                    >
                      {roles.map((r) => {
                        const on = primaryRole === r.code;
                        return (
                          <label
                            key={r.code}
                            className={`${styles.roleRadio} ${
                              on ? styles.roleRadioOn : ''
                            }`}
                          >
                            <input
                              type="radio"
                              name="primary-role"
                              value={r.code}
                              checked={on}
                              onChange={() => onPrimaryRoleChange(r.code)}
                            />
                            <span>
                              <strong>{r.name}</strong>
                              <span>{r.code}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </fieldset>

                  <fieldset className={styles.permFieldset}>
                    <legend className={styles.fieldsetLegend}>
                      Additional permissions
                    </legend>
                    <p className={styles.fieldsetHint}>
                      Optional extras beyond the primary role. Permissions
                      already included in the role are shown checked and
                      disabled. Extras are additive — changing the role keeps
                      extras that still apply.
                    </p>
                    <div className={styles.extraGroups}>
                      {extraGroups.map(([group, perms]) => (
                        <div key={group} className={styles.extraGroup}>
                          <h4>{group}</h4>
                          <div className={styles.extraChecks}>
                            {perms.map((code) => {
                              const fromRole = rolePermSet.has(code);
                              const checked =
                                fromRole || extraPerms.includes(code);
                              return (
                                <label
                                  key={code}
                                  className={`${styles.extraCheck} ${
                                    fromRole ? styles.extraCheckImplied : ''
                                  } ${
                                    !fromRole && extraPerms.includes(code)
                                      ? styles.extraCheckOn
                                      : ''
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={fromRole}
                                    onChange={() => toggleExtra(code)}
                                  />
                                  <span>
                                    <code>{code}</code>
                                    {fromRole ? (
                                      <em>from role</em>
                                    ) : null}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </fieldset>

                  <div className={styles.ctaRow}>
                    <ButtonLink href="/app/audit" variant="tertiary">
                      Audit trail
                    </ButtonLink>
                    <Button
                      variant="secondary"
                      disabled={saving || !dirty}
                      onClick={cancelEdit}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      disabled={saving || !dirty || !primaryRole}
                      onClick={saveAccess}
                    >
                      <Icon icon={Save} size="sm" />
                      {saving ? 'Saving…' : 'Save access'}
                    </Button>
                  </div>
                </>
              ) : (
                <div className={styles.emptyPanel}>
                  <Icon icon={Users} size="lg" />
                  <strong>Select a user</strong>
                  <p>
                    Choose someone on the left to set their primary role and
                    any additional permissions.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
