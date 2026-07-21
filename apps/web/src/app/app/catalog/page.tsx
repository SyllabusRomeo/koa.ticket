'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type AuthUser } from '@/lib/api';
import { can } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import styles from '../app.module.css';
import { LayoutGrid, Plus, Send, Ticket } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';

type CatalogItem = {
  id: string;
  code: string;
  name: string;
  description: string;
  ticketTypeCode: string;
};

export default function CatalogPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [types, setTypes] = useState<Array<{ code: string; name: string }>>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [ticketTypeCode, setTicketTypeCode] = useState('service_request');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [notesById, setNotesById] = useState<Record<string, string>>({});

  async function load() {
    setItems(await api.catalog());
  }

  useEffect(() => {
    (async () => {
      try {
        const { user } = await api.me();
        setUser(user);
        await load();
        try {
          const meta = await api.ticketMeta();
          setTypes(meta.types);
          if (meta.types[0]) setTicketTypeCode(meta.types[0].code);
        } catch {
          /* optional */
        }
      } catch {
        router.replace('/login');
      }
    })();
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
    setSaving(true);
    setError(null);
    try {
      await api.createCatalogItem({
        code,
        name,
        description,
        ticketTypeCode,
      });
      setCode('');
      setName('');
      setDescription('');
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  async function onRequest(item: CatalogItem) {
    if (!can(user, 'tickets:write')) {
      setError('You do not have permission to create tickets.');
      return;
    }
    setRequestingId(item.id);
    setError(null);
    setMessage(null);
    try {
      const { ticket } = await api.requestCatalogItem(
        item.id,
        notesById[item.id],
      );
      setMessage(`Created ${ticket.number} from ${item.code}.`);
      router.push(`/app/tickets/${encodeURIComponent(ticket.number)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setRequestingId(null);
    }
  }

  if (!user) {
    return (
      <main className={styles.page}>
        <p className={styles.muted}>Loading…</p>
      </main>
    );
  }

  const canManage = can(user, 'settings:manage');
  const canRequest = can(user, 'tickets:write');

  return (
    <AppShell user={user} onLogout={logout} title="Service catalog">
      <section className={styles.panel}>
        <p className={styles.mission}>
          Browse requestable services and submit one-click requests. Service and
          access requests go to Approvals when required.
          {canManage
            ? ' As sysadmin you can also add catalog items below.'
            : ''}
        </p>
        <div className={styles.ctaRow} style={{ marginBottom: '1rem' }}>
          <a href="/app/tickets" className={styles.btn}>
            <Icon icon={Ticket} size="sm" />
            Open tickets
          </a>
          {canManage ? (
            <button
              type="button"
              className={styles.btnSecondary}
              onClick={() => setShowCreate((v) => !v)}
            >
              {showCreate ? 'Hide create form' : 'Add catalog item'}
            </button>
          ) : null}
          <a href="/app" className={styles.btnSecondary}>
            Back to Home
          </a>
        </div>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className={styles.ok}>{message}</p> : null}

        {canManage && showCreate ? (
          <form
            onSubmit={onCreate}
            style={{
              display: 'grid',
              gap: '0.75rem',
              maxWidth: 520,
              marginBottom: '1.25rem',
            }}
          >
            <h2 className={styles.sectionTitle}>New catalog item</h2>
            <label>
              Code
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                minLength={2}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <label>
              Name
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={3}
                rows={3}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <label>
              Ticket type
              <select
                value={ticketTypeCode}
                onChange={(e) => setTicketTypeCode(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              >
                {types.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={styles.btn} disabled={saving}>
              {saving ? 'Saving…' : 'Create catalog item'}
            </button>
          </form>
        ) : null}

        {items.length === 0 ? (
          <EmptyState icon={LayoutGrid}>
            No catalog items yet.{' '}
            {canManage ? (
              <button
                type="button"
                className={styles.btn}
                onClick={() => setShowCreate(true)}
              >
                <Icon icon={Plus} size="sm" />
                Add the first item
              </button>
            ) : (
              <>
                You can still <a href="/app/tickets">create a ticket</a>.
              </>
            )}
          </EmptyState>
        ) : (
          <ul className={styles.ticketList}>
            {items.map((i) => (
              <li key={i.id}>
                <div className={styles.rowLink} style={{ display: 'block' }}>
                  <strong>
                    {i.name} ({i.code})
                  </strong>
                  <em>
                    {i.description}
                    {i.ticketTypeCode ? ` · ${i.ticketTypeCode}` : ''}
                  </em>
                  {canRequest ? (
                    <div
                      style={{
                        marginTop: '0.75rem',
                        display: 'grid',
                        gap: '0.5rem',
                      }}
                    >
                      <label>
                        Optional notes
                        <textarea
                          rows={2}
                          value={notesById[i.id] ?? ''}
                          onChange={(e) =>
                            setNotesById((prev) => ({
                              ...prev,
                              [i.id]: e.target.value,
                            }))
                          }
                          placeholder="Add context for IT (optional)"
                          style={{
                            display: 'block',
                            width: '100%',
                            marginTop: 4,
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className={styles.btn}
                        disabled={requestingId === i.id}
                        onClick={() => onRequest(i)}
                      >
                        <Icon icon={Send} size="sm" />
                        {requestingId === i.id
                          ? 'Submitting…'
                          : 'Request this service'}
                      </button>
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
