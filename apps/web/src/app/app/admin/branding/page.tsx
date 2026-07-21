'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, formatBytes, type AuthUser, type BrandingConfig } from '@/lib/api';
import { hasRole } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { BrandMarkIcon } from '@/lib/nav-icons';
import { RotateCcw, Save } from 'lucide-react';
import appStyles from '../../app.module.css';
import styles from './branding.module.css';

function cacheBust(url: string | null, updatedAt: string | null) {
  if (!url) return null;
  if (!updatedAt) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(updatedAt)}`;
}

export default function BrandingAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [pendingBanner, setPendingBanner] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { user } = await api.me();
        if (!hasRole(user, 'sysadmin')) {
          router.replace('/app');
          return;
        }
        if (!cancelled) setUser(user);
        const b = await api.branding();
        if (!cancelled) setBranding(b);
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

  useEffect(() => {
    if (!pendingLogo) {
      setLogoPreview(null);
      return;
    }
    const url = URL.createObjectURL(pendingLogo);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingLogo]);

  useEffect(() => {
    if (!pendingBanner) {
      setBannerPreview(null);
      return;
    }
    const url = URL.createObjectURL(pendingBanner);
    setBannerPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [pendingBanner]);

  async function onSave() {
    if (!pendingLogo && !pendingBanner) {
      setMessage('No changes to save — choose a logo or banner first.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      let next = branding;
      if (pendingLogo) {
        next = await api.uploadBrandingLogo(pendingLogo);
      }
      if (pendingBanner) {
        next = await api.uploadBrandingBanner(pendingBanner);
      }
      setBranding(next);
      setPendingLogo(null);
      setPendingBanner(null);
      if (logoInput.current) logoInput.current.value = '';
      if (bannerInput.current) bannerInput.current.value = '';
      setMessage('Branding saved. Open /login to confirm the public page.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    if (
      !window.confirm(
        'Reset login branding to LogIT defaults? Custom logo and banner will be removed.',
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const next = await api.resetBranding();
      setBranding(next);
      setPendingLogo(null);
      setPendingBanner(null);
      if (logoInput.current) logoInput.current.value = '';
      if (bannerInput.current) bannerInput.current.value = '';
      setMessage('Branding reset to defaults.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  }

  if (loading || !user) {
    return (
      <main className={appStyles.page}>
        <p className={appStyles.muted}>Loading branding…</p>
      </main>
    );
  }

  const liveLogo = cacheBust(branding?.logoUrl ?? null, branding?.updatedAt ?? null);
  const liveBanner = cacheBust(
    branding?.loginBannerUrl ?? null,
    branding?.updatedAt ?? null,
  );
  const previewLogo = logoPreview ?? liveLogo;
  const previewBanner = bannerPreview ?? liveBanner;
  const dirty = Boolean(pendingLogo || pendingBanner);

  return (
    <AppShell user={user} onLogout={logout} title="Branding">
      <div className={styles.layout}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Administration · Sysadmin</p>
          <p className={styles.lede}>
            Customize the public sign-in page with your organization logo and a
            full-page background banner. Leave blank to keep the default LogIT
            mark and gradient.
          </p>
        </header>

        {error ? (
          <p className={appStyles.error} role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className={styles.success} role="status">
            {message}
          </p>
        ) : null}

        <section className={styles.panel}>
          <h2>Logo</h2>
          <p className={styles.hint}>
            PNG, JPG, WebP, or SVG — max{' '}
            {formatBytes(branding?.limits.logo.maxBytes ?? 2 * 1024 * 1024)}.
            Shown next to the product name on <code>/login</code>.
          </p>
          <div className={styles.row}>
            <div className={styles.logoBox} aria-label="Logo preview">
              {previewLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewLogo} alt="Organization logo" />
              ) : (
                <span className={styles.defaultMark} aria-hidden>
                </span>
              )}
            </div>
            <div className={styles.fileBlock}>
              <input
                ref={logoInput}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,.svg,image/png,image/jpeg,image/webp,image/svg+xml"
                onChange={(e) => {
                  setPendingLogo(e.target.files?.[0] ?? null);
                  setMessage(null);
                }}
              />
              <p className={styles.meta}>
                {pendingLogo
                  ? `Selected: ${pendingLogo.name}`
                  : branding?.hasLogo
                    ? 'Custom logo active'
                    : 'Using default LogIT mark'}
              </p>
            </div>
          </div>
        </section>

        <section className={styles.panel}>
          <h2>Login banner background</h2>
          <p className={styles.hint}>
            JPG, PNG, or WebP — max{' '}
            {formatBytes(branding?.limits.banner.maxBytes ?? 5 * 1024 * 1024)}.
            Covers the full login viewport; falls back to the LogIT gradient when
            unset.
          </p>
          <div
            className={styles.bannerBox}
            style={
              previewBanner
                ? {
                    backgroundImage: `linear-gradient(rgba(15, 74, 64, 0.35), rgba(15, 74, 64, 0.45)), url(${previewBanner})`,
                  }
                : undefined
            }
            data-default={!previewBanner || undefined}
            aria-label="Banner preview"
          >
            <span className={styles.bannerLabel}>
              {previewBanner ? 'Image banner' : 'Default LogIT gradient'}
            </span>
          </div>
          <div className={styles.fileBlock}>
            <input
              ref={bannerInput}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              onChange={(e) => {
                setPendingBanner(e.target.files?.[0] ?? null);
                setMessage(null);
              }}
            />
            <p className={styles.meta}>
              {pendingBanner
                ? `Selected: ${pendingBanner.name}`
                : branding?.hasBanner
                  ? 'Custom banner active'
                  : 'Using default gradient'}
            </p>
          </div>
        </section>

        <section className={styles.panel}>
          <h2>Login preview</h2>
          <div
            className={styles.loginPreview}
            style={
              previewBanner
                ? {
                    backgroundImage: `linear-gradient(rgba(251, 241, 218, 0.55), rgba(255, 255, 255, 0.72)), url(${previewBanner})`,
                  }
                : undefined
            }
            data-default={!previewBanner || undefined}
          >
            <div className={styles.previewBrand}>
              {previewLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewLogo} alt="" className={styles.previewLogo} />
              ) : (
                <span className={styles.defaultMark} aria-hidden>
                </span>
              )}
              <span>LogIT</span>
            </div>
            <div className={styles.previewCard}>Sign in</div>
          </div>
        </section>

        <div className={styles.actions}>
          <Button type="button" variant="primary" disabled={busy || !dirty} onClick={onSave}>
            <Icon icon={Save} size="sm" />
            {busy ? 'Saving…' : 'Save'}
          </Button>
          <Button type="button" variant="secondary" disabled={busy} onClick={onReset}>
            <Icon icon={RotateCcw} size="sm" />
            Reset to defaults
          </Button>
          <a className={styles.previewLink} href="/login" target="_blank" rel="noreferrer">
            Open login page
          </a>
        </div>
      </div>
    </AppShell>
  );
}
