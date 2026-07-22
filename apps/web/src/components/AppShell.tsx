'use client';

import {
  useEffect,
  useId,
  useRef,
  useState,
  type RefObject,
} from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Menu, UserRound, X } from 'lucide-react';
import styles from '../app/app/app.module.css';
import shell from './AppShell.module.css';
import { api, type AuthUser } from '@/lib/api';
import {
  isNavActive,
  navGroupsForUser,
  roleLabel,
  type NavItem,
} from '@/lib/access';
import { Icon } from '@/components/Icon';
import { BrandMarkIcon, NAV_ICONS } from '@/lib/nav-icons';

function initials(user: AuthUser) {
  const a = user.firstName?.trim()?.[0] ?? '';
  const b = user.lastName?.trim()?.[0] ?? '';
  const pair = `${a}${b}`.toUpperCase();
  if (pair) return pair;
  return (user.email?.[0] ?? '?').toUpperCase();
}

function displayName(user: AuthUser) {
  const name = `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim();
  return name || user.email;
}

function NavAnchor({
  item,
  pathname,
  onNavigate,
  className,
  activeClassName,
}: {
  item: NavItem;
  pathname: string;
  onNavigate?: () => void;
  className: string;
  activeClassName: string;
}) {
  const active = isNavActive(pathname, item.href);
  const NavIcon = NAV_ICONS[item.href];
  return (
    <Link
      href={item.href}
      className={`${className}${active ? ` ${activeClassName}` : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onNavigate}
    >
      {NavIcon ? <Icon icon={NavIcon} size="sm" /> : null}
      {item.label}
    </Link>
  );
}

function MenuLinks({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const active = isNavActive(pathname, item.href);
        const NavIcon = NAV_ICONS[item.href];
        return (
          <Link
            key={item.href}
            href={item.href}
            role="menuitem"
            className={`${shell.dropdownItem}${active ? ` ${shell.dropdownItemActive}` : ''}`}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
          >
            {NavIcon ? <Icon icon={NavIcon} size="sm" /> : null}
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

function useDismissible(
  open: boolean,
  setOpen: (next: boolean) => void,
  ref: RefObject<HTMLElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen, ref]);
}

export function AppShell({
  user,
  children,
  title,
}: {
  user: AuthUser;
  /** Accepted for backward compatibility; Sign out is handled by the shell. */
  onLogout?: () => void | Promise<void>;
  children: React.ReactNode;
  title?: string;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '/app';
  const { primary, role: roleNav, admin } = navGroupsForUser(user);
  const role = roleLabel(user.roles);
  const name = displayName(user);

  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);
  const profileMenuId = useId();

  useDismissible(profileOpen, setProfileOpen, profileRef);

  useEffect(() => {
    setProfileOpen(false);
    setMobileOpen(false);
  }, [pathname]);

  const closeMobile = () => setMobileOpen(false);
  const closeProfile = () => setProfileOpen(false);

  async function signOut() {
    closeProfile();
    closeMobile();
    try {
      await api.logout();
    } catch {
      /* ignore */
    }
    // Always land on the public homepage after sign-out (not login).
    router.replace('/');
  }

  return (
    <main className={styles.page}>
      <header className={shell.chrome}>
        <div className={shell.chromeInner}>
          <Link
            href="/app"
            className={shell.brand}
            aria-label="LogIT workspace home"
            title="Workspace home"
          >
            <span className={shell.mark} aria-hidden>
              <Icon icon={BrandMarkIcon} size="md" />
            </span>
            <span className={shell.brandName}>LogIT</span>
          </Link>

          <nav className={shell.primaryNav} aria-label="Workspace">
            {primary.map((item) => (
              <NavAnchor
                key={item.href}
                item={item}
                pathname={pathname}
                className={shell.navLink}
                activeClassName={shell.navLinkActive}
              />
            ))}
          </nav>

          <div className={shell.profileCluster}>
            <div className={shell.menuWrap} ref={profileRef}>
              <button
                type="button"
                className={`${shell.profileTrigger}${profileOpen ? ` ${shell.profileTriggerOpen}` : ''}`}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
                aria-controls={profileMenuId}
                aria-label={`Account menu for ${name}`}
                onClick={() => setProfileOpen((v) => !v)}
              >
                <span className={shell.avatar} aria-hidden>
                  {initials(user)}
                </span>
                <span className={shell.profileMeta}>
                  <span className={shell.profileName}>{name}</span>
                  <span className={shell.profileRole}>{role}</span>
                </span>
                <Icon
                  icon={ChevronDown}
                  size={14}
                  className={`${shell.chevron}${profileOpen ? ` ${shell.chevronOpen}` : ''}`}
                />
              </button>
              {profileOpen ? (
                <div
                  id={profileMenuId}
                  role="menu"
                  className={`${shell.dropdown} ${shell.profilePanel}`}
                >
                  <div className={shell.profilePanelHead}>
                    <strong>{name}</strong>
                    <span>{user.email}</span>
                    <em>{role}</em>
                  </div>

                  <div className={shell.dropdownDivider} />
                  <Link
                    href="/app/profile"
                    role="menuitem"
                    className={`${shell.dropdownItem}${isNavActive(pathname, '/app/profile') ? ` ${shell.dropdownItemActive}` : ''}`}
                    aria-current={
                      isNavActive(pathname, '/app/profile') ? 'page' : undefined
                    }
                    onClick={closeProfile}
                  >
                    <Icon icon={UserRound} size="sm" />
                    My profile
                  </Link>

                  {roleNav.length > 0 ? (
                    <>
                      <div className={shell.dropdownDivider} />
                      <p className={shell.menuSection}>Your tools</p>
                      <MenuLinks
                        items={roleNav}
                        pathname={pathname}
                        onNavigate={closeProfile}
                      />
                    </>
                  ) : null}

                  {admin.length > 0 ? (
                    <>
                      <div className={shell.dropdownDivider} />
                      <p className={shell.menuSection}>Admin</p>
                      <MenuLinks
                        items={admin}
                        pathname={pathname}
                        onNavigate={closeProfile}
                      />
                    </>
                  ) : null}

                  <div className={shell.dropdownDivider} />
                  <button
                    type="button"
                    role="menuitem"
                    className={shell.dropdownItem}
                    onClick={() => void signOut()}
                  >
                    <Icon icon={LogOut} size="sm" />
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              className={shell.menuToggle}
              aria-expanded={mobileOpen}
              aria-controls="logit-mobile-nav"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((v) => !v)}
            >
              <Icon icon={mobileOpen ? X : Menu} size="md" />
            </button>
          </div>
        </div>

        <div
          id="logit-mobile-nav"
          className={`${shell.mobilePanel}${mobileOpen ? ` ${shell.mobilePanelOpen}` : ''}`}
          hidden={!mobileOpen}
        >
          <p className={shell.mobileSection}>Account</p>
          <NavAnchor
            item={{ href: '/app/profile', label: 'My profile' }}
            pathname={pathname}
            onNavigate={closeMobile}
            className={shell.dropdownItem}
            activeClassName={shell.dropdownItemActive}
          />
          <p className={shell.mobileSection}>Workspace</p>
          {primary.map((item) => (
            <NavAnchor
              key={item.href}
              item={item}
              pathname={pathname}
              onNavigate={closeMobile}
              className={shell.dropdownItem}
              activeClassName={shell.dropdownItemActive}
            />
          ))}
          {roleNav.length > 0 ? (
            <>
              <p className={shell.mobileSection}>Your tools</p>
              {roleNav.map((item) => (
                <NavAnchor
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={closeMobile}
                  className={shell.dropdownItem}
                  activeClassName={shell.dropdownItemActive}
                />
              ))}
            </>
          ) : null}
          {admin.length > 0 ? (
            <>
              <p className={shell.mobileSection}>Admin</p>
              {admin.map((item) => (
                <NavAnchor
                  key={item.href}
                  item={item}
                  pathname={pathname}
                  onNavigate={closeMobile}
                  className={shell.dropdownItem}
                  activeClassName={shell.dropdownItemActive}
                />
              ))}
            </>
          ) : null}
        </div>
      </header>

      {title ? <h1 className={styles.pageTitle}>{title}</h1> : null}
      {children}
    </main>
  );
}
