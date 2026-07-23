'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGrid, LogIn } from 'lucide-react';
import { api } from '@/lib/api';
import { Icon } from '@/components/Icon';
import { BrandMarkIcon } from '@/lib/nav-icons';
import styles from './page.module.css';

export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.me();
        if (!cancelled) router.replace('/app');
      } catch {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (checking) {
    return (
      <main className={styles.shell}>
        <p className={styles.lede} style={{ padding: '2rem' }}>
          Loading…
        </p>
      </main>
    );
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <Icon icon={BrandMarkIcon} size="md" />
          <span className={styles.brandName}>LogIT</span>
        </div>
        <nav className={styles.nav} aria-label="Primary">
          <a href="#portal">Portal</a>
          <a href="#status">Status</a>
          <a href="/login">Sign in</a>
        </nav>
      </header>

      <section className={styles.hero} aria-labelledby="hero-heading">
        <p className={styles.eyebrow}>IT Service Management</p>
        <h1 id="hero-heading" className={styles.title}>
          LogIT
        </h1>
        <p className={styles.lede}>
          Report issues, request services, and track IT work in one secure place.
        </p>
        <div className={styles.actions}>
          <a className={styles.primaryBtn} href="/login">
            <Icon icon={LogIn} size="sm" />
            Sign in
          </a>
          <a className={styles.secondaryBtn} href="/login">
            Open workspace
          </a>
        </div>
      </section>

      <section id="portal" className={styles.panel} aria-labelledby="portal-heading">
        <h2 id="portal-heading" className={styles.panelTitle}>
          <span className={styles.panelTitleIcon} aria-hidden>
            <Icon icon={LayoutGrid} size="sm" />
          </span>
          Self-service portal
        </h2>
        <p>
          Sign in to report issues, request services, and track IT work. Phase 1
          auth and Phase 2 organization foundations are live.
        </p>
      </section>

      <footer className={styles.footer} id="status">
        <span>LogIT · Phase 0</span>
        <span>API health: /health</span>
      </footer>
    </main>
  );
}
