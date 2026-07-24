'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  type ApprovalPolicy,
  type AuthUser,
} from '@/lib/api';
import { canManageApprovalPolicies } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { EmptyState } from '@/components/EmptyState';
import { SectionHeading } from '@/components/SectionHeading';
import { Button } from '@/components/Button';
import { ClipboardCheck, Plus } from 'lucide-react';
import appStyles from '../../app.module.css';
import styles from './approvals-admin.module.css';

type TicketType = { id: string; code: string; name: string };

const ROLE_OPTIONS = [
  { code: 'approver', label: 'Approver' },
  { code: 'it_manager', label: 'IT Manager' },
  { code: 'sysadmin', label: 'Sysadmin' },
];

export default function ApprovalsAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([]);
  const [types, setTypes] = useState<TicketType[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [ticketTypeId, setTicketTypeId] = useState('');
  const [priority, setPriority] = useState(100);
  const [step1Name, setStep1Name] = useState('Business approver');
  const [step1Role, setStep1Role] = useState('approver');
  const [step1Mode, setStep1Mode] = useState<'any' | 'all'>('any');
  const [step2Enabled, setStep2Enabled] = useState(false);
  const [step2Name, setStep2Name] = useState('CAB / second approver');
  const [step2Role, setStep2Role] = useState('it_manager');
  const [step2Mode, setStep2Mode] = useState<'any' | 'all'>('any');

  async function refreshPolicies() {
    setPolicies(await api.approvalPolicies(true));
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (!canManageApprovalPolicies(user)) {
          router.replace('/app');
          return;
        }
        if (!cancelled) setUser(user);
        const [p, meta] = await Promise.all([
          api.approvalPolicies(true),
          api.ticketMeta(),
        ]);
        if (!cancelled) {
          setPolicies(p);
          setTypes(meta.types ?? []);
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

  function buildSteps() {
    const steps = [
      {
        name: step1Name.trim(),
        approverRoleCode: step1Role,
        mode: step1Mode,
        stepOrder: 1,
      },
    ];
    if (step2Enabled) {
      steps.push({
        name: step2Name.trim(),
        approverRoleCode: step2Role,
        mode: step2Mode,
        stepOrder: 2,
      });
    }
    return steps;
  }

  function loadPolicyIntoForm(p: ApprovalPolicy) {
    setEditingId(p.id);
    setName(p.name);
    setTicketTypeId(p.ticketTypeId ?? '');
    setPriority(p.priority);
    const s1 = p.steps[0];
    const s2 = p.steps[1];
    setStep1Name(s1?.name ?? 'Business approver');
    setStep1Role(s1?.approverRoleCode ?? 'approver');
    setStep1Mode(s1?.mode === 'all' ? 'all' : 'any');
    setStep2Enabled(!!s2);
    setStep2Name(s2?.name ?? 'CAB / second approver');
    setStep2Role(s2?.approverRoleCode ?? 'it_manager');
    setStep2Mode(s2?.mode === 'all' ? 'all' : 'any');
    setMessage(`Editing “${p.name}”. Save to update, or Cancel edit.`);
    setError(null);
  }

  function clearForm() {
    setEditingId(null);
    setName('');
    setTicketTypeId('');
    setPriority(100);
    setStep1Name('Business approver');
    setStep1Role('approver');
    setStep1Mode('any');
    setStep2Enabled(false);
    setStep2Name('CAB / second approver');
    setStep2Role('it_manager');
    setStep2Mode('any');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const steps = buildSteps();
      if (editingId) {
        await api.updateApprovalPolicy(editingId, {
          name: name.trim(),
          ticketTypeId: ticketTypeId || null,
          priority,
          steps,
        });
        setMessage('Approval policy updated.');
      } else {
        await api.createApprovalPolicy({
          name: name.trim(),
          ticketTypeId: ticketTypeId || undefined,
          priority,
          steps,
        });
        setMessage('Approval policy created.');
      }
      clearForm();
      await refreshPolicies();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editingId
            ? 'Failed to update policy'
            : 'Failed to create policy',
      );
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(p: ApprovalPolicy) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await api.updateApprovalPolicy(p.id, { isActive: !p.isActive });
      setMessage(
        p.isActive
          ? `Deactivated “${p.name}”.`
          : `Reactivated “${p.name}”.`,
      );
      await refreshPolicies();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
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
    <AppShell user={user} onLogout={logout} title="Approval policies">
      <p className={appStyles.mission}>
        Configure multi-step approval chains by ticket type. Admins with{' '}
        <code>approvals:manage</code> can create, edit, and activate/deactivate
        policies. Mode <strong>any</strong> = first approval wins;{' '}
        <strong>all</strong> = every user with that role must approve.
      </p>
      {error ? (
        <p className={appStyles.error} role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className={appStyles.ok}>{message}</p> : null}

      <div className={styles.grid}>
        <section className={styles.panel}>
          <SectionHeading icon={ClipboardCheck}>Policies</SectionHeading>
          {policies.length === 0 ? (
            <EmptyState icon={ClipboardCheck}>
              No policies yet — fallback is all Approver-role users (legacy).
            </EmptyState>
          ) : (
            <ul className={styles.list}>
              {policies.map((p) => (
                <li key={p.id}>
                  <strong>
                    #{p.priority} {p.name}{' '}
                    <em>{p.isActive ? 'active' : 'inactive'}</em>
                  </strong>
                  <em>
                    {p.steps
                      .map(
                        (s) =>
                          `${s.stepOrder}. ${s.name} (${s.approverRoleCode}, ${s.mode})`,
                      )
                      .join(' → ')}
                  </em>
                  <div className={styles.rowActions}>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={busy}
                      onClick={() => loadPolicyIntoForm(p)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      variant="tertiary"
                      disabled={busy}
                      onClick={() => void toggleActive(p)}
                    >
                      {p.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.panel}>
          <SectionHeading icon={Plus}>
            {editingId ? 'Edit policy' : 'Add policy'}
          </SectionHeading>
          <form className={styles.form} onSubmit={onSubmit}>
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
              Ticket type (optional)
              <select
                value={ticketTypeId}
                onChange={(e) => setTicketTypeId(e.target.value)}
              >
                <option value="">Any type</option>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Match priority (lower first)
              <input
                type="number"
                min={1}
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
              />
            </label>

            <fieldset className={styles.stepBox}>
              <legend>Step 1</legend>
              <label>
                Name
                <input
                  value={step1Name}
                  onChange={(e) => setStep1Name(e.target.value)}
                  required
                />
              </label>
              <label>
                Approver role
                <select
                  value={step1Role}
                  onChange={(e) => setStep1Role(e.target.value)}
                >
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Mode
                <select
                  value={step1Mode}
                  onChange={(e) =>
                    setStep1Mode(e.target.value as 'any' | 'all')
                  }
                >
                  <option value="any">Any one</option>
                  <option value="all">All must approve</option>
                </select>
              </label>
            </fieldset>

            <label className={styles.check}>
              <input
                type="checkbox"
                checked={step2Enabled}
                onChange={(e) => setStep2Enabled(e.target.checked)}
              />
              Add step 2 (sequential)
            </label>

            {step2Enabled ? (
              <fieldset className={styles.stepBox}>
                <legend>Step 2</legend>
                <label>
                  Name
                  <input
                    value={step2Name}
                    onChange={(e) => setStep2Name(e.target.value)}
                    required
                  />
                </label>
                <label>
                  Approver role
                  <select
                    value={step2Role}
                    onChange={(e) => setStep2Role(e.target.value)}
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.code} value={r.code}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Mode
                  <select
                    value={step2Mode}
                    onChange={(e) =>
                      setStep2Mode(e.target.value as 'any' | 'all')
                    }
                  >
                    <option value="any">Any one</option>
                    <option value="all">All must approve</option>
                  </select>
                </label>
              </fieldset>
            ) : null}

            <div className={styles.rowActions}>
              <Button type="submit" disabled={busy}>
                {busy
                  ? 'Saving…'
                  : editingId
                    ? 'Save changes'
                    : 'Create policy'}
              </Button>
              {editingId ? (
                <Button
                  type="button"
                  variant="tertiary"
                  disabled={busy}
                  onClick={() => {
                    clearForm();
                    setMessage(null);
                  }}
                >
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
