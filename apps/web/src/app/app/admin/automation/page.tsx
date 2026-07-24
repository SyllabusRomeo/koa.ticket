'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeading } from '@/components/SectionHeading';
import { Button } from '@/components/Button';
import { Workflow } from 'lucide-react';
import appStyles from '../../app.module.css';
import styles from '../approvals/approvals-admin.module.css';

type Rule = Awaited<ReturnType<typeof api.listAutomationRules>>[number];
type Team = Awaited<ReturnType<typeof api.listTeams>>[number];

export default function AutomationAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [priorityCode, setPriorityCode] = useState('');
  const [typeCode, setTypeCode] = useState('');
  const [setTeamId, setSetTeamId] = useState('');
  const [setMajorIncident, setSetMajorIncident] = useState(false);
  const [notifyManagers, setNotifyManagers] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (!can(user, 'settings:manage')) {
          router.replace('/app');
          return;
        }
        if (!cancelled) setUser(user);
        const [r, t] = await Promise.all([
          api.listAutomationRules(),
          api.listTeams().catch(() => []),
        ]);
        if (!cancelled) {
          setRules(r);
          setTeams(t);
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

  async function refresh() {
    const r = await api.listAutomationRules();
    setRules(r);
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const conditions: Record<string, unknown> = {};
      if (categoryCode.trim()) conditions.categoryCode = categoryCode.trim();
      if (priorityCode.trim()) conditions.priorityCode = priorityCode.trim();
      if (typeCode.trim()) conditions.typeCode = typeCode.trim();

      const actions: Record<string, unknown> = {};
      if (setTeamId) actions.setTeamId = setTeamId;
      if (setMajorIncident) actions.setMajorIncident = true;
      if (notifyManagers) actions.notifyRoleCodes = ['it_manager', 'sysadmin'];

      if (!Object.keys(conditions).length && !Object.keys(actions).length) {
        throw new Error('Add at least one condition or action');
      }

      await api.createAutomationRule({
        name: name.trim(),
        conditions,
        actions,
      });
      setName('');
      setCategoryCode('');
      setPriorityCode('');
      setTypeCode('');
      setSetTeamId('');
      setSetMajorIncident(false);
      setMessage('Automation rule created.');
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create rule');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(rule: Rule) {
    setBusy(true);
    setError(null);
    try {
      await api.updateAutomationRule(rule.id, { isActive: !rule.isActive });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <main className={appStyles.page}>
        <p>Loading automation…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="Automation">
      <p className={appStyles.lede}>
        Rules evaluate when a ticket is <strong>created</strong>. Match
        conditions (category / priority / type codes) then apply actions (team,
        major flag, notify managers).
      </p>

      <div className={styles.grid}>
        <section className={styles.panel}>
          <SectionHeading icon={Workflow}>Rules</SectionHeading>
          {rules.length === 0 ? (
            <EmptyState icon={Workflow}>No automation rules yet.</EmptyState>
          ) : (
            <ul className={styles.list}>
              {rules.map((rule) => (
                <li key={rule.id}>
                  <strong>
                    {rule.name}{' '}
                    <em>{rule.isActive ? 'active' : 'inactive'}</em>
                  </strong>
                  <em>
                    If {JSON.stringify(rule.conditions)} →{' '}
                    {JSON.stringify(rule.actions)}
                  </em>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => void toggleActive(rule)}
                  >
                    {rule.isActive ? 'Disable' : 'Enable'}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.panel}>
          <SectionHeading icon={Workflow}>New rule</SectionHeading>
          <form className={styles.form} onSubmit={onCreate}>
            <label>
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
              />
            </label>
            <label>
              Match category code (optional)
              <input
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value)}
                placeholder="e.g. NETWORK"
              />
            </label>
            <label>
              Match priority code (optional)
              <input
                value={priorityCode}
                onChange={(e) => setPriorityCode(e.target.value)}
                placeholder="e.g. P1"
              />
            </label>
            <label>
              Match type code (optional)
              <input
                value={typeCode}
                onChange={(e) => setTypeCode(e.target.value)}
                placeholder="e.g. incident"
              />
            </label>
            <label>
              Assign team
              <select
                value={setTeamId}
                onChange={(e) => setSetTeamId(e.target.value)}
              >
                <option value="">— none —</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.code})
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={setMajorIncident}
                onChange={(e) => setSetMajorIncident(e.target.checked)}
              />
              Mark major incident
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={notifyManagers}
                onChange={(e) => setNotifyManagers(e.target.checked)}
              />
              Notify IT Manager / Sysadmin
            </label>
            {error ? (
              <p className={appStyles.error} role="alert">
                {error}
              </p>
            ) : null}
            {message ? <p className={appStyles.lede}>{message}</p> : null}
            <Button type="submit" disabled={busy}>
              {busy ? 'Saving…' : 'Create rule'}
            </Button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
