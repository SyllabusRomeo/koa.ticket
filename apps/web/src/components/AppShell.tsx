'use client';

import styles from '../app/app/app.module.css';
import type { AuthUser } from '@/lib/api';
import { navForUser, roleLabel } from '@/lib/access';

export function AppShell({
  user,
  onLogout,
  children,
  title,
}: {
  user: AuthUser;
  onLogout: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  const nav = navForUser(user);

  return (
    <main className={styles.page}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <span className={styles.mark} aria-hidden />
          <div>
            <strong className={styles.brandName}>LogIT</strong>
            <p className={styles.muted}>{roleLabel(user.roles)}</p>
          </div>
        </div>
        <button type="button" className={styles.ghost} onClick={onLogout}>
          Sign out
        </button>
      </header>

      <nav className={styles.navRow} aria-label="Workspace">
        {nav.map((item) => (
          <a key={item.href} href={item.href}>
            {item.label}
          </a>
        ))}
      </nav>

      {title ? <h1 className={styles.pageTitle}>{title}</h1> : null}
      {children}
    </main>
  );
}
