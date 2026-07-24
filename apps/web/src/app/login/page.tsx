'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, type BrandingConfig } from '@/lib/api';
import styles from './login.module.css';
import { LogIn, ShieldCheck } from 'lucide-react';
import { Icon } from '@/components/Icon';
import { BrandMarkIcon } from '@/lib/nav-icons';

function cacheBust(url: string | null, updatedAt: string | null) {
  if (!url) return null;
  if (!updatedAt) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(updatedAt)}`;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('admin@logit.local');
  const [password, setPassword] = useState('LogIt-Admin-2026!');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [entraEnabled, setEntraEnabled] = useState(false);

  useEffect(() => {
    const ssoError = searchParams.get('ssoError');
    if (ssoError) setError(ssoError);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const b = await api.branding();
        if (!cancelled) setBranding(b);
      } catch {
        /* keep default LogIt look if branding API unavailable */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { providers } = await api.ssoProviders();
        if (!cancelled) {
          setEntraEnabled(providers.some((p) => p.id === 'entra'));
        }
      } catch {
        /* SSO optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await api.me();
        if (!cancelled) router.replace('/app');
      } catch {
        /* stay on login */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await api.login(email, password);
      if (result.mfaRequired && result.mfaToken) {
        setMfaToken(result.mfaToken);
        setMfaCode('');
        return;
      }
      router.push('/app');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyMfa(e: FormEvent) {
    e.preventDefault();
    if (!mfaToken) return;
    setError(null);
    setLoading(true);
    try {
      await api.verifyMfaLogin(mfaToken, mfaCode.replace(/\s+/g, ''));
      router.push('/app');
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Invalid authenticator code',
      );
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
        <a href="/" className={styles.brandLink} aria-label="LogIt homepage">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.logo} src={logoUrl} alt="" />
          ) : (
            <span className={styles.mark} aria-hidden>
              <Icon icon={BrandMarkIcon} size="md" />
            </span>
          )}
          <span className={styles.name}>LogIt</span>
        </a>
      </header>

      <section className={styles.card} aria-labelledby="login-title">
        <h1 id="login-title">{mfaToken ? 'Authenticator code' : 'Sign in'}</h1>
        <p className={styles.sub}>
          {mfaToken
            ? 'Enter the 6-digit code from your authenticator app.'
            : 'Access your IT service desk workspace.'}
        </p>

        {mfaToken ? (
          <form className={styles.form} onSubmit={onVerifyMfa} noValidate>
            <label className={styles.label}>
              Code
              <input
                className={styles.input}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                value={mfaCode}
                onChange={(e) =>
                  setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                required
                autoFocus
              />
            </label>

            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}

            <button className={styles.submit} type="submit" disabled={loading}>
              <Icon icon={ShieldCheck} size="sm" />
              {loading ? 'Verifying…' : 'Verify and continue'}
            </button>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => {
                setMfaToken(null);
                setMfaCode('');
                setError(null);
              }}
            >
              Back to password
            </button>
          </form>
        ) : (
          <>
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

            {entraEnabled ? (
              <div className={styles.ssoBlock}>
                <p className={styles.or}>or</p>
                <a className={styles.ssoBtn} href={api.ssoEntraStartUrl()}>
                  Sign in with Microsoft
                </a>
              </div>
            ) : null}

            <p className={styles.hint}>
              Dev accounts are seeded after <code>npm run db:seed</code>.
            </p>
          </>
        )}
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className={styles.page}>
          <p className={styles.hint}>Loading sign-in…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
