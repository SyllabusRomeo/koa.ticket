'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api,
  formatBytes,
  type AuthUser,
  type BrandingConfig,
  type PortalThemeColors,
} from '@/lib/api';
import { hasRole } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { applyPortalThemeColors } from '@/components/PortalThemeProvider';
import { RotateCcw, Save, Paintbrush, Image, ImagePlus, Eye } from 'lucide-react';
import { SectionHeading } from '@/components/SectionHeading';
import appStyles from '../../app.module.css';
import styles from './branding.module.css';

function cacheBust(url: string | null, updatedAt: string | null) {
  if (!url) return null;
  if (!updatedAt) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}v=${encodeURIComponent(updatedAt)}`;
}

const CUSTOM_FIELDS: Array<{ key: keyof PortalThemeColors; label: string }> = [
  { key: 'primary', label: 'Primary' },
  { key: 'primaryLight', label: 'Primary light' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'backgroundWarm', label: 'Warm background' },
  { key: 'backgroundAccent', label: 'Accent wash' },
  { key: 'textPrimary', label: 'Text' },
];

export default function BrandingAdminPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [branding, setBranding] = useState<BrandingConfig | null>(null);
  const [pendingLogo, setPendingLogo] = useState<File | null>(null);
  const [pendingBanner, setPendingBanner] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [themeId, setThemeId] = useState('logit');
  const [customColors, setCustomColors] = useState<PortalThemeColors | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const logoInput = useRef<HTMLInputElement>(null);
  const bannerInput = useRef<HTMLInputElement>(null);

  function syncThemeFromBranding(b: BrandingConfig) {
    if (!b.theme) return;
    setThemeId(b.theme.id);
    setCustomColors(b.theme.colors);
    applyPortalThemeColors(b.theme.colors);
  }

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
        if (!cancelled) {
          setBranding(b);
          syncThemeFromBranding(b);
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

  function selectPreset(id: string) {
    const preset = branding?.theme?.presets.find((p) => p.id === id);
    if (!preset) return;
    setThemeId(id);
    setCustomColors(preset.colors);
    applyPortalThemeColors(preset.colors);
    setMessage(null);
  }

  function onCustomColor(key: keyof PortalThemeColors, value: string) {
    setThemeId('custom');
    setCustomColors((prev) => {
      const base =
        prev ??
        branding?.theme?.colors ??
        branding?.theme?.presets[0]?.colors;
      if (!base) return prev;
      const next = { ...base, [key]: value };
      applyPortalThemeColors(next);
      return next;
    });
    setMessage(null);
  }

  async function onSaveAssets() {
    if (!pendingLogo && !pendingBanner) {
      setMessage('No asset changes — choose a logo or banner first.');
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
      if (next) syncThemeFromBranding(next);
      setPendingLogo(null);
      setPendingBanner(null);
      if (logoInput.current) logoInput.current.value = '';
      if (bannerInput.current) bannerInput.current.value = '';
      setMessage('Logo/banner saved. Open /login to confirm the public page.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onSaveTheme() {
    if (!customColors) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const preset = branding?.theme?.presets.find((p) => p.id === themeId);
      const isUntouchedPreset =
        themeId !== 'custom' &&
        !!preset &&
        Object.keys(customColors).every(
          (k) =>
            customColors[k as keyof PortalThemeColors].toUpperCase() ===
            preset.colors[k as keyof PortalThemeColors].toUpperCase(),
        );
      const next = await api.updateBrandingTheme(
        isUntouchedPreset
          ? { themeId, colors: null }
          : { themeId: 'custom', colors: customColors },
      );
      setBranding(next);
      syncThemeFromBranding(next);
      setMessage(`Portal theme saved: ${next.theme?.name ?? themeId}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Theme save failed');
    } finally {
      setBusy(false);
    }
  }

  async function onReset() {
    if (
      !window.confirm(
        'Reset branding to LogIT defaults? Custom logo, banner, and portal theme will be removed.',
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
      syncThemeFromBranding(next);
      setPendingLogo(null);
      setPendingBanner(null);
      if (logoInput.current) logoInput.current.value = '';
      if (bannerInput.current) bannerInput.current.value = '';
      setMessage('Branding reset to LogIT defaults.');
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
  const assetDirty = Boolean(pendingLogo || pendingBanner);
  const presets = branding?.theme?.presets ?? [];
  const primaryPreview = customColors?.primary ?? '#0F4A40';

  return (
    <AppShell user={user} onLogout={logout} title="Branding">
      <div className={styles.layout}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Administration · Sysadmin</p>
          <p className={styles.lede}>
            Customize portal colors (themes), the public sign-in logo, and login
            background. Themes apply across the workspace via CSS variables.
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
          <SectionHeading icon={Paintbrush}>Portal theme</SectionHeading>
          <p className={styles.hint}>
            Pick a preset or tweak colors for a custom theme. Changes preview
            immediately; click <strong>Save theme</strong> to persist.
          </p>
          <div className={styles.themeGrid}>
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                className={styles.themeCard}
                data-active={themeId === p.id || undefined}
                onClick={() => selectPreset(p.id)}
              >
                <span
                  className={styles.themeSwatch}
                  style={{
                    background: `linear-gradient(135deg, ${p.colors.primary}, ${p.colors.secondary})`,
                  }}
                  aria-hidden
                />
                <span className={styles.themeName}>{p.name}</span>
                <span className={styles.themeDesc}>{p.description}</span>
              </button>
            ))}
            <button
              type="button"
              className={styles.themeCard}
              data-active={themeId === 'custom' || undefined}
              onClick={() => {
                setThemeId('custom');
                if (customColors) applyPortalThemeColors(customColors);
              }}
            >
              <span
                className={styles.themeSwatch}
                style={{
                  background: `linear-gradient(135deg, ${primaryPreview}, ${customColors?.secondary ?? '#456433'})`,
                }}
                aria-hidden
              />
              <span className={styles.themeName}>Custom</span>
              <span className={styles.themeDesc}>
                Set your own portal color tokens below.
              </span>
            </button>
          </div>

          {customColors ? (
            <div className={styles.colorGrid}>
              {CUSTOM_FIELDS.map(({ key, label }) => (
                <label key={key} className={styles.colorField}>
                  <span>{label}</span>
                  <input
                    type="color"
                    value={customColors[key]}
                    onChange={(e) => onCustomColor(key, e.target.value)}
                  />
                  <code>{customColors[key]}</code>
                </label>
              ))}
            </div>
          ) : null}

          <div className={styles.actions} style={{ marginTop: '1rem' }}>
            <Button
              type="button"
              variant="primary"
              disabled={busy || !customColors}
              onClick={onSaveTheme}
            >
              <Icon icon={Save} size="sm" />
              {busy ? 'Saving…' : 'Save theme'}
            </Button>
          </div>
        </section>

        <section className={styles.panel}>
          <SectionHeading icon={Image}>Logo</SectionHeading>
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
                <span className={styles.defaultMark} aria-hidden />
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
          <SectionHeading icon={ImagePlus}>Login banner background</SectionHeading>
          <p className={styles.hint}>
            JPG, PNG, or WebP — max{' '}
            {formatBytes(branding?.limits.banner.maxBytes ?? 5 * 1024 * 1024)}.
            Covers the full login viewport; falls back to the theme gradient when
            unset.
          </p>
          <div
            className={styles.bannerBox}
            style={
              previewBanner
                ? {
                    backgroundImage: `linear-gradient(color-mix(in srgb, ${primaryPreview} 35%, transparent), color-mix(in srgb, ${primaryPreview} 45%, transparent)), url(${previewBanner})`,
                  }
                : undefined
            }
            data-default={!previewBanner || undefined}
            aria-label="Banner preview"
          >
            <span className={styles.bannerLabel}>
              {previewBanner ? 'Image banner' : 'Theme gradient'}
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
                  : 'Using theme gradient'}
            </p>
          </div>
        </section>

        <section className={styles.panel}>
          <SectionHeading icon={Eye}>Login preview</SectionHeading>
          <div
            className={styles.loginPreview}
            style={
              previewBanner
                ? {
                    backgroundImage: `linear-gradient(color-mix(in srgb, var(--color-background-warm) 55%, transparent), color-mix(in srgb, var(--color-background) 72%, transparent)), url(${previewBanner})`,
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
                <span className={styles.defaultMark} aria-hidden />
              )}
              <span>LogIT</span>
            </div>
            <div className={styles.previewCard}>Sign in</div>
          </div>
        </section>

        <div className={styles.actions}>
          <Button
            type="button"
            variant="primary"
            disabled={busy || !assetDirty}
            onClick={onSaveAssets}
          >
            <Icon icon={Save} size="sm" />
            {busy ? 'Saving…' : 'Save logo / banner'}
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
