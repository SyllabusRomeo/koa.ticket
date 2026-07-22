'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, KeyRound, Save, ShieldCheck, ShieldOff } from 'lucide-react';
import { api, type AuthUser } from '@/lib/api';
import { roleLabel } from '@/lib/access';
import { AppShell } from '@/components/AppShell';
import { Button } from '@/components/Button';
import { Icon } from '@/components/Icon';
import { LocationSelect } from '@/components/LocationSelect';
import appStyles from '../app.module.css';
import styles from './profile.module.css';

type DeptOption = {
  id: string;
  code: string;
  name: string;
  locationId?: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [locations, setLocations] = useState<
    Array<{
      id: string;
      code: string;
      name: string;
      site?: string | null;
      country?: string | null;
      isActive?: boolean;
    }>
  >([]);
  const [departments, setDepartments] = useState<DeptOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  const [mfaSetup, setMfaSetup] = useState<{
    secret: string;
    qrDataUrl: string;
  } | null>(null);
  const [mfaConfirmCode, setMfaConfirmCode] = useState('');
  const [mfaDisablePassword, setMfaDisablePassword] = useState('');
  const [mfaDisableCode, setMfaDisableCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);

  type PrefRow = {
    eventType: string;
    label: string;
    description: string;
    inAppEnabled: boolean;
    emailEnabled: boolean;
  };
  const [prefs, setPrefs] = useState<PrefRow[]>([]);
  const [prefsBusy, setPrefsBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getProfile();
        if (cancelled) return;
        setUser(data.user);
        setLocations(data.locations);
        setDepartments(data.departments);
        setFirstName(data.user.firstName ?? '');
        setLastName(data.user.lastName ?? '');
        setLocationId(data.user.locationId ?? '');
        setDepartmentId(data.user.departmentId ?? '');
        try {
          const p = await api.notificationPreferences();
          if (!cancelled) setPrefs(p);
        } catch {
          /* optional */
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

  const filteredDepartments = useMemo(() => {
    if (!locationId) return departments;
    return departments.filter(
      (d) => !d.locationId || d.locationId === locationId,
    );
  }, [departments, locationId]);

  async function logout() {
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    router.replace('/login');
  }

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    setError(null);
    setMessage(null);
    try {
      const { user: updated } = await api.updateProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        locationId: locationId || null,
        departmentId: departmentId || null,
      });
      setUser(updated);
      setFirstName(updated.firstName ?? '');
      setLastName(updated.lastName ?? '');
      setLocationId(updated.locationId ?? '');
      setDepartmentId(updated.departmentId ?? '');
      setMessage('Profile updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update profile');
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }
    setSavingPassword(true);
    try {
      const result = await api.changePassword(currentPassword, newPassword);
      setMessage(result.message ?? 'Password changed. Sign in again.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => router.replace('/login'), 1200);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not change password',
      );
    } finally {
      setSavingPassword(false);
    }
  }

  async function onBeginMfaSetup() {
    setError(null);
    setMessage(null);
    setMfaBusy(true);
    try {
      const setup = await api.mfaSetup();
      setMfaSetup({ secret: setup.secret, qrDataUrl: setup.qrDataUrl });
      setMfaConfirmCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start MFA setup');
    } finally {
      setMfaBusy(false);
    }
  }

  async function onConfirmMfa(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setMfaBusy(true);
    try {
      await api.mfaConfirm(mfaConfirmCode.replace(/\s+/g, ''));
      setUser((u) => (u ? { ...u, mfaEnabled: true } : u));
      setMfaSetup(null);
      setMfaConfirmCode('');
      setMessage('Two-factor authentication is enabled.');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not confirm MFA setup',
      );
    } finally {
      setMfaBusy(false);
    }
  }

  async function onCancelMfaSetup() {
    setMfaBusy(true);
    try {
      await api.mfaCancelSetup();
    } catch {
      /* ignore */
    } finally {
      setMfaSetup(null);
      setMfaConfirmCode('');
      setMfaBusy(false);
    }
  }

  async function onDisableMfa(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setMfaBusy(true);
    try {
      await api.mfaDisable(
        mfaDisablePassword,
        mfaDisableCode.replace(/\s+/g, ''),
      );
      setUser((u) => (u ? { ...u, mfaEnabled: false } : u));
      setMfaDisablePassword('');
      setMfaDisableCode('');
      setMessage('Two-factor authentication has been disabled.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable MFA');
    } finally {
      setMfaBusy(false);
    }
  }

  async function onTogglePref(
    eventType: string,
    patch: { inAppEnabled?: boolean; emailEnabled?: boolean },
  ) {
    setPrefsBusy(true);
    setError(null);
    try {
      await api.setNotificationPreference({ eventType, ...patch });
      setPrefs((prev) =>
        prev.map((p) => (p.eventType === eventType ? { ...p, ...patch } : p)),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update preference',
      );
    } finally {
      setPrefsBusy(false);
    }
  }

  if (loading || !user) {
    return (
      <main className={appStyles.page}>
        <p className={appStyles.muted}>Loading profile…</p>
      </main>
    );
  }

  return (
    <AppShell user={user} onLogout={logout} title="My profile">
      <div className={styles.layout}>
        <header className={styles.hero}>
          <p className={styles.eyebrow}>Account</p>
          <p className={styles.intro}>
            Update how you appear in LogIT, set your home location, change your
            password, manage notification alerts, and two-factor authentication.
          </p>
        </header>

        {error ? (
          <p className={appStyles.error} role="alert">
            {error}
          </p>
        ) : null}
        {message ? <p className={styles.bannerOk}>{message}</p> : null}

        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>Profile details</h2>
          <p className={styles.sectionHint}>
            Your email is managed by an administrator and cannot be changed
            here.
          </p>
          <div className={styles.readonlyMeta}>
            <span className={styles.chip}>{user.email}</span>
            <span className={styles.chip}>{roleLabel(user.roles)}</span>
          </div>

          <form className={styles.form} onSubmit={onSaveProfile}>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>First name</span>
                <input
                  required
                  minLength={1}
                  maxLength={100}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                />
              </label>
              <label className={styles.field}>
                <span>Last name</span>
                <input
                  required
                  minLength={1}
                  maxLength={100}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                />
              </label>
            </div>

            <label className={styles.field}>
              <span>Email</span>
              <input value={user.email} disabled readOnly />
            </label>

            <label className={styles.field}>
              <span>Home location</span>
              <LocationSelect
                value={locationId}
                locations={locations}
                allowEmpty
                emptyLabel="No location"
                aria-label="Home location"
                onChange={(id) => {
                  setLocationId(id);
                  if (
                    departmentId &&
                    !departments.some(
                      (d) =>
                        d.id === departmentId &&
                        (!d.locationId || d.locationId === id || !id),
                    )
                  ) {
                    setDepartmentId('');
                  }
                }}
              />
            </label>

            <label className={styles.field}>
              <span>Department</span>
              <select
                value={departmentId}
                aria-label="Department"
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="">No department</option>
                {filteredDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </label>

            <div className={styles.actions}>
              <Button type="submit" disabled={savingProfile}>
                <Icon icon={Save} size="sm" />
                {savingProfile ? 'Saving…' : 'Save profile'}
              </Button>
            </div>
          </form>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>Change password</h2>
          <p className={styles.sectionHint}>
            Use at least 12 characters with uppercase, lowercase, and a number.
            You will be signed out after a successful change.
          </p>
          <form className={styles.form} onSubmit={onChangePassword}>
            <label className={styles.field}>
              <span>Current password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </label>
            <div className={styles.row}>
              <label className={styles.field}>
                <span>New password</span>
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Confirm new password</span>
                <input
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </label>
            </div>
            <div className={styles.actions}>
              <Button type="submit" variant="secondary" disabled={savingPassword}>
                <Icon icon={KeyRound} size="sm" />
                {savingPassword ? 'Updating…' : 'Update password'}
              </Button>
            </div>
          </form>
        </section>

        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>
            <Icon icon={Bell} size="sm" /> Notification alerts
          </h2>
          <p className={styles.sectionHint}>
            Choose which ticket and approval events reach you in-app and by
            email. Defaults are on for every event.
          </p>
          {prefs.length === 0 ? (
            <p className={styles.sectionHint}>Preferences unavailable.</p>
          ) : (
            <ul className={styles.prefList}>
              {prefs.map((p) => (
                <li key={p.eventType} className={styles.prefRow}>
                  <div>
                    <strong>{p.label}</strong>
                    <span>{p.description}</span>
                  </div>
                  <label className={styles.prefToggle}>
                    <input
                      type="checkbox"
                      checked={p.inAppEnabled}
                      disabled={prefsBusy}
                      onChange={(e) =>
                        void onTogglePref(p.eventType, {
                          inAppEnabled: e.target.checked,
                        })
                      }
                    />
                    In-app
                  </label>
                  <label className={styles.prefToggle}>
                    <input
                      type="checkbox"
                      checked={p.emailEnabled}
                      disabled={prefsBusy}
                      onChange={(e) =>
                        void onTogglePref(p.eventType, {
                          emailEnabled: e.target.checked,
                        })
                      }
                    />
                    Email
                  </label>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.panel}>
          <h2 className={styles.sectionTitle}>Two-factor authentication</h2>
          <p className={styles.sectionHint}>
            Protect your account with an authenticator app (TOTP). Recommended
            for privileged roles.
          </p>
          {user.mfaEnabled ? (
            <form className={styles.form} onSubmit={onDisableMfa}>
              <p className={styles.mfaStatusOn}>MFA is enabled on this account.</p>
              <label className={styles.field}>
                <span>Current password</span>
                <input
                  type="password"
                  required
                  autoComplete="current-password"
                  value={mfaDisablePassword}
                  onChange={(e) => setMfaDisablePassword(e.target.value)}
                />
              </label>
              <label className={styles.field}>
                <span>Authenticator code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={mfaDisableCode}
                  onChange={(e) =>
                    setMfaDisableCode(
                      e.target.value.replace(/\D/g, '').slice(0, 6),
                    )
                  }
                />
              </label>
              <div className={styles.actions}>
                <Button type="submit" variant="secondary" disabled={mfaBusy}>
                  <Icon icon={ShieldOff} size="sm" />
                  {mfaBusy ? 'Disabling…' : 'Disable MFA'}
                </Button>
              </div>
            </form>
          ) : mfaSetup ? (
            <form className={styles.form} onSubmit={onConfirmMfa}>
              <p className={styles.sectionHint}>
                Scan this QR code in your authenticator app, then enter a code
                to confirm.
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className={styles.mfaQr}
                src={mfaSetup.qrDataUrl}
                alt="MFA QR code"
              />
              <p className={styles.mfaSecret}>
                Or enter secret manually:{' '}
                <code>{mfaSetup.secret}</code>
              </p>
              <label className={styles.field}>
                <span>Authenticator code</span>
                <input
                  type="text"
                  inputMode="numeric"
                  required
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={mfaConfirmCode}
                  onChange={(e) =>
                    setMfaConfirmCode(
                      e.target.value.replace(/\D/g, '').slice(0, 6),
                    )
                  }
                  autoFocus
                />
              </label>
              <div className={styles.actions}>
                <Button type="submit" disabled={mfaBusy}>
                  <Icon icon={ShieldCheck} size="sm" />
                  {mfaBusy ? 'Confirming…' : 'Confirm and enable'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={mfaBusy}
                  onClick={onCancelMfaSetup}
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className={styles.actions}>
              <Button type="button" disabled={mfaBusy} onClick={onBeginMfaSetup}>
                <Icon icon={ShieldCheck} size="sm" />
                {mfaBusy ? 'Preparing…' : 'Set up MFA'}
              </Button>
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
