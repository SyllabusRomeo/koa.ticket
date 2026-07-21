'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type BrandingConfig } from '@/lib/api';
import styles from './login.module.css';
import { LogIn } from 'lucide-react';
import { Icon } from '@/components/Icon';
import { BrandMarkIcon } from '@/lib/nav-icons';

function cacheBust(url: string | null, updatedAt: string | null) {
  if (!url) return null;
  if (!updatedAt) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(updatedAt)}`;
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@logit.local');
  const [password, setPassword] = useState('LogIT-Admin-2026!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await api.branding();
        if (!cancelled) setBranding(b);
      } catch {
        /* keep default LogIT look if branding API unavailable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.login(email, password);
      router.push('/app');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  const logoUrl = cacheBust(
    branding?.logoUrl ?? null,
    branding?.updatedAt ?? null,
  );
  const bannerUrl = cacheBust(
    branding?.loginBannerUrl ?? null,
    branding?.updatedAt ?? null,
  );

  return (
    <main
      className={`${styles.page}${bannerUrl ? ` ${styles.pageWithBanner}` : ''}`}
      style={
        bannerUrl
          ? {
              backgroundImage: `linear-gradient(rgba(251, 241, 218, 0.55), rgba(255, 255, 255, 0.7)), url(${bannerUrl})`,
            }
          : undefined
      }
    >
      <header className={styles.brand}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className={styles.logo} src={logoUrl} alt="LogIT" />
        ) : (
          <span className={styles.mark} aria-hidden>
            <Icon icon={BrandMarkIcon} size="md" />
          </span>
        )}
        <span className={styles.name}>LogIT</span>
      </header>

      <section className={styles.card} aria-labelledby="login-title">
        <h1 id="login-title">Sign in</h1>
        <p className={styles.sub}>Access your IT service desk workspace.</p>

        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <label className={styles.label}>
            Email
            <input
              className={styles.input}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>

          <label className={styles.label}>
            Password
            <input
              className={styles.input}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <button className={styles.submit} type="submit" disabled={loading}>
            <Icon icon={LogIn} size="sm" />
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className={styles.hint}>
          Dev accounts are seeded after <code>npm run db:seed</code>.
        </p>
      </section>
    </main>
  );
}
