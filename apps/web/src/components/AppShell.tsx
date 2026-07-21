'use client';

import { LogOut } from 'lucide-react';
import styles from '../app/app/app.module.css';
import type { AuthUser } from '@/lib/api';
import { navForUser, roleLabel } from '@/lib/access';
import { Icon } from '@/components/Icon';
import { BrandMarkIcon, NAV_ICONS } from '@/lib/nav-icons';

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
          <span className={styles.mark} aria-hidden>
            <Icon icon={BrandMarkIcon} size="md" />
          </span>
          <div>
            <strong className={styles.brandName}>LogIT</strong>
            <p className={styles.muted}>{roleLabel(user.roles)}</p>
          </div>
        </div>
        <button type="button" className={styles.ghost} onClick={onLogout}>
          <Icon icon={LogOut} size="sm" />
          Sign out
        </button>
      </header>

      <nav className={styles.navRow} aria-label="Workspace">
        {nav.map((item) => {
          const NavIcon = NAV_ICONS[item.href];
          return (
            <a key={item.href} href={item.href} className={styles.navLink}>
              {NavIcon ? <Icon icon={NavIcon} size="sm" /> : null}
              {item.label}
            </a>
          );
        })}
      </nav>

      {title ? <h1 className={styles.pageTitle}>{title}</h1> : null}
      {children}
    </main>
  );
}
