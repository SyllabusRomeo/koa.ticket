'use client';

import { useEffect } from 'react';
import { api, type PortalThemeColors } from '@/lib/api';

const CSS_MAP: Record<keyof PortalThemeColors, string> = {
  primary: '--color-primary',
  primaryLight: '--color-primary-light',
  secondary: '--color-secondary',
  background: '--color-background',
  backgroundWarm: '--color-background-warm',
  backgroundAccent: '--color-background-accent',
  danger: '--color-danger',
  accentOrange: '--color-accent-orange',
  accentMuted: '--color-accent-muted',
  textPrimary: '--color-text-primary',
  textOnPrimary: '--color-text-on-primary',
};

export function applyPortalThemeColors(colors: PortalThemeColors) {
  const root = document.documentElement;
  for (const [key, cssVar] of Object.entries(CSS_MAP) as Array<
    [keyof PortalThemeColors, string]
  >) {
    root.style.setProperty(cssVar, colors[key]);
  }
}

/** Loads public branding theme and applies CSS variables site-wide (L4). */
export function PortalThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const branding = await api.branding();
        if (cancelled || !branding.theme?.colors) return;
        applyPortalThemeColors(branding.theme.colors);
      } catch {
        /* keep CSS defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return <>{children}</>;
}
