'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  type ApprovalPolicy,
  type AuthUser,
} from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { ClipboardCheck } from 'lucide-react';
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
        const [p, meta] = await Promise.all([
          api.approvalPolicies(),
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

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
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
      await api.createApprovalPolicy({
        name: name.trim(),
        ticketTypeId: ticketTypeId || undefined,
        priority,
        steps,
      });
      setName('');
      setMessage('Approval policy created.');
      setPolicies(await api.approvalPolicies());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create policy');
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
        Configure multi-step approval chains by ticket type. Step 1 must finish
        before step 2 is created. Mode <strong>any</strong> = first approval
        wins; <strong>all</strong> = every user with that role must approve.
      </p>
      {error ? (
        <p className={appStyles.error} role="alert">
          {error}
        </p>
      ) : null}
      {message ? <p className={appStyles.ok}>{message}</p> : null}

      <div className={styles.grid}>
        <section className={styles.panel}>
          <h2>
            <Icon icon={ClipboardCheck} size="sm" />
            Active policies
          </h2>
          {policies.length === 0 ? (
            <EmptyState icon={ClipboardCheck}>
              No policies yet — fallback is all Approver-role users (legacy).
            </EmptyState>
          ) : (
            <ul className={styles.list}>
              {policies.map((p) => (
                <li key={p.id}>
                  <strong>
                    #{p.priority} {p.name}
                  </strong>
                  <em>
                    {p.steps
                      .map(
                        (s) =>
                          `${s.stepOrder}. ${s.name} (${s.approverRoleCode}, ${s.mode})`,
                      )
                      .join(' → ')}
                  </em>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.panel}>
          <h2>Add policy</h2>
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

            <button type="submit" className={appStyles.btn} disabled={busy}>
              Create policy
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  );
}
