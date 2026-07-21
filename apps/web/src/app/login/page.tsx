'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import styles from './login.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@logit.local');
  const [password, setPassword] = useState('LogIT-Admin-2026!');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  return (
    <main className={styles.page}>
      <header className={styles.brand}>
        <span className={styles.mark} aria-hidden />
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
