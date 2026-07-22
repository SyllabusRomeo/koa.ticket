'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { api, type AuthUser } from '@/lib/api';
import { notificationHref } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { EmptyState } from '@/components/EmptyState';
import { Icon } from '@/components/Icon';
import { Button } from '@/components/Button';
import appStyles from '../app.module.css';
import styles from './notifications.module.css';

type Note = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt?: string;
};

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const n = await api.notifications();
    setNotes(n);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (cancelled) return;
        setUser(user);
        await refresh();
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

  async function onOpen(note: Note) {
    if (!note.readAt) {
      try {
        await api.markNotificationRead(note.id);
        setNotes((prev) =>
          prev.map((n) =>
            n.id === note.id ? { ...n, readAt: new Date().toISOString() } : n,
          ),
        );
      } catch {
        /* ignore */
      }
    }
    const href = notificationHref(note);
    if (href) router.push(href);
  }

  async function onMarkAll() {
    setBusy(true);
    try {
      await api.markAllNotificationsRead();
      await refresh();
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

  const unread = notes.filter((n) => !n.readAt).length;

  return (
    <AppShell user={user} onLogout={logout} title="Notifications">
      <p className={appStyles.mission}>
        Alerts for tickets you opened, own, are assigned to, or watch — plus
        approvals and SLA. Manage channels in{' '}
        <a href="/app/profile">My profile</a>.
      </p>

      <div className={styles.toolbar}>
        <p className={styles.unread}>
          {unread === 0 ? 'All caught up' : `${unread} unread`}
        </p>
        <Button
          type="button"
          variant="secondary"
          disabled={busy || unread === 0}
          onClick={() => void onMarkAll()}
        >
          <Icon icon={CheckCheck} size="sm" />
          Mark all read
        </Button>
      </div>

      {notes.length === 0 ? (
        <EmptyState icon={Bell}>No notifications yet.</EmptyState>
      ) : (
        <ul className={styles.list}>
          {notes.map((n) => (
            <li key={n.id} className={n.readAt ? styles.read : styles.unreadRow}>
              <button type="button" onClick={() => void onOpen(n)}>
                <strong>{n.title}</strong>
                <span>{n.body}</span>
                {n.createdAt ? (
                  <em>{new Date(n.createdAt).toLocaleString()}</em>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
