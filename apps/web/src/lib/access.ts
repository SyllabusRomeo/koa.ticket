import type { AuthUser } from './api';

export function can(user: AuthUser | null | undefined, permission: string) {
  return !!user?.permissions.includes(permission);
}

export function hasRole(user: AuthUser | null | undefined, role: string) {
  return !!user?.roles.includes(role);
}

/** Agent / IT service-desk Home (KPI workspace), not employee self-service. */
export function showAgentWorkspace(user: AuthUser) {
  if (
    hasRole(user, 'agent') ||
    hasRole(user, 'senior_agent') ||
    hasRole(user, 'it_manager') ||
    hasRole(user, 'sysadmin')
  ) {
    return true;
  }
  return (
    can(user, 'tickets:read_all') || can(user, 'tickets:read_queue')
  );
}

export function roleLabel(roles: string[]) {
  const map: Record<string, string> = {
    employee: 'Employee self-service',
    agent: 'IT Support Agent',
    senior_agent: 'Senior IT Agent',
    it_manager: 'IT Manager',
    approver: 'Approver',
    sysadmin: 'System Administrator',
    auditor: 'Auditor',
  };
  return roles.map((r) => map[r] ?? r).join(' · ');
}

export function workspaceMission(user: AuthUser) {
  if (hasRole(user, 'sysadmin')) {
    return 'Configure users, roles, and platform settings. You have full access.';
  }
  if (hasRole(user, 'it_manager')) {
    return 'Monitor SLA, workload, and service quality across IT.';
  }
  if (hasRole(user, 'senior_agent') || hasRole(user, 'agent')) {
    return 'Work the support queue, update tickets, and keep requesters informed.';
  }
  if (hasRole(user, 'approver')) {
    return 'Review and approve or reject service and access requests awaiting you.';
  }
  if (hasRole(user, 'auditor')) {
    return 'Review audit trails, reports, and historical records (read-focused).';
  }
  return 'Report issues, request services, and track your own tickets.';
}

export type WorkspaceAction = {
  href: string;
  label: string;
  /** Primary CTA gets solid button styling */
  primary?: boolean;
};

/**
 * Role-appropriate next steps for Home (and similar surfaces).
 * Ordered by importance; first primary action is the main "what do I do?" CTA.
 */
export function workspaceNextActions(user: AuthUser): WorkspaceAction[] {
  const actions: WorkspaceAction[] = [];
  const push = (action: WorkspaceAction) => {
    if (!actions.some((a) => a.href === action.href)) actions.push(action);
  };

  if (hasRole(user, 'sysadmin')) {
    if (can(user, 'roles:manage') || can(user, 'users:manage')) {
      push({
        href: '/app/admin/roles',
        label: 'Manage Roles & Access',
        primary: true,
      });
    }
    if (can(user, 'org:manage')) {
      push({ href: '/app/admin/teams', label: 'Service teams' });
      push({ href: '/app/admin/locations', label: 'Locations' });
    }
    push({ href: '/app/admin/integrations', label: 'Integrations' });
    push({ href: '/app/admin/branding', label: 'Branding' });
    if (can(user, 'settings:manage') || can(user, 'org:manage')) {
      push({ href: '/app/admin/routing', label: 'Routing & SLA' });
    }
    if (can(user, 'tickets:read_all') || can(user, 'tickets:read_queue')) {
      push({ href: '/app/tickets', label: 'Open ticket queue' });
    }
    if (can(user, 'knowledge:write')) {
      push({ href: '/app/knowledge/new', label: 'Create knowledge article' });
    }
    if (can(user, 'settings:manage')) {
      push({ href: '/app/catalog', label: 'Manage service catalog' });
    }
    if (can(user, 'assets:write')) {
      push({ href: '/app/assets', label: 'Register asset' });
    }
    if (can(user, 'audit:read')) {
      push({ href: '/app/audit', label: 'Open Audit trail' });
    }
    if (can(user, 'reports:read')) {
      push({ href: '/app/reports', label: 'Open Reports' });
    }
    return actions;
  }

  if (hasRole(user, 'auditor')) {
    if (can(user, 'audit:read')) {
      push({ href: '/app/audit', label: 'Open Audit trail', primary: true });
    }
    if (can(user, 'reports:read')) {
      push({ href: '/app/reports', label: 'Open Reports' });
    }
    if (can(user, 'tickets:read_all') || can(user, 'tickets:read_queue')) {
      push({ href: '/app/tickets', label: 'View tickets' });
    }
    return actions;
  }

  if (hasRole(user, 'it_manager')) {
    if (can(user, 'reports:read')) {
      push({ href: '/app/reports', label: 'Open Reports', primary: true });
    }
    if (can(user, 'org:manage')) {
      push({ href: '/app/admin/teams', label: 'Service teams' });
      push({ href: '/app/admin/locations', label: 'Locations' });
    }
    if (
      can(user, 'tickets:read_queue') ||
      can(user, 'tickets:read_all') ||
      can(user, 'tickets:read_own')
    ) {
      push({ href: '/app/tickets', label: 'Open ticket queue' });
    }
    if (can(user, 'approvals:read')) {
      push({ href: '/app/approvals', label: 'Open Approvals' });
    }
    if (can(user, 'assets:read')) {
      push({ href: '/app/assets', label: 'Review assets' });
    }
    return actions;
  }

  if (hasRole(user, 'approver') || can(user, 'approvals:decide')) {
    if (can(user, 'approvals:read')) {
      push({ href: '/app/approvals', label: 'Open Approvals', primary: true });
    }
    if (can(user, 'tickets:write') || can(user, 'tickets:read_own')) {
      push({ href: '/app/tickets', label: 'View tickets' });
    }
    push({ href: '/app/catalog', label: 'Browse catalog' });
    return actions;
  }

  if (hasRole(user, 'senior_agent') || hasRole(user, 'agent')) {
    push({ href: '/app/tickets', label: 'Open ticket queue', primary: true });
    if (can(user, 'knowledge:write')) {
      push({ href: '/app/knowledge/new', label: 'Create knowledge article' });
    } else if (can(user, 'knowledge:read')) {
      push({ href: '/app/knowledge', label: 'Browse knowledge' });
    }
    if (can(user, 'assets:read')) {
      push({ href: '/app/assets', label: 'Review assets' });
    }
    return actions;
  }

  // Employee (default self-service)
  if (can(user, 'tickets:write')) {
    push({ href: '/app/tickets', label: 'Create a ticket', primary: true });
  } else if (
    can(user, 'tickets:read_own') ||
    can(user, 'tickets:read_queue') ||
    can(user, 'tickets:read_all')
  ) {
    push({ href: '/app/tickets', label: 'View my tickets', primary: true });
  }
  push({ href: '/app/catalog', label: 'Browse service catalog' });
  if (can(user, 'knowledge:read')) {
    push({ href: '/app/knowledge', label: 'Browse knowledge' });
  }
  return actions;
}

/** Destinations for in-app notifications when API `link` is missing. */
export function notificationHref(note: {
  title: string;
  body?: string;
  link?: string | null;
}): string | null {
  if (note.link) return note.link;

  const title = note.title.toLowerCase();
  const body = (note.body ?? '').toLowerCase();
  const text = `${title} ${body}`;

  if (title.includes('approval') || text.includes('approval needed')) {
    return '/app/approvals';
  }
  if (
    title.includes('ticket') ||
    title.includes('sla') ||
    title.includes('request ') ||
    /\b(acc|inc|req|sec|prb|chg|tsk)-\d/i.test(note.title)
  ) {
    return '/app/tickets';
  }
  return null;
}

export type NavItem = { href: string; label: string };

export function navForUser(user: AuthUser): NavItem[] {
  const items: NavItem[] = [{ href: '/app', label: 'Home' }];

  if (
    can(user, 'tickets:read_own') ||
    can(user, 'tickets:read_queue') ||
    can(user, 'tickets:read_all')
  ) {
    items.push({ href: '/app/tickets', label: 'Tickets' });
  }
  if (can(user, 'approvals:read')) {
    items.push({ href: '/app/approvals', label: 'Approvals' });
  }
  if (can(user, 'knowledge:read')) {
    items.push({ href: '/app/knowledge', label: 'Knowledge' });
  }
  // Catalog is employee-facing; allow anyone authenticated who can create/view requests
  if (
    can(user, 'tickets:write') ||
    hasRole(user, 'employee') ||
    hasRole(user, 'approver')
  ) {
    items.push({ href: '/app/catalog', label: 'Catalog' });
  }
  if (can(user, 'assets:read')) {
    items.push({ href: '/app/assets', label: 'Assets' });
  }
  if (can(user, 'reports:read')) {
    items.push({ href: '/app/reports', label: 'Reports' });
  }
  if (can(user, 'audit:read')) {
    items.push({ href: '/app/audit', label: 'Audit' });
  }
  if (can(user, 'roles:manage') || can(user, 'users:manage')) {
    items.push({ href: '/app/admin/roles', label: 'Roles & Access' });
  }
  if (can(user, 'org:manage')) {
    items.push({ href: '/app/admin/teams', label: 'Teams' });
    items.push({ href: '/app/admin/locations', label: 'Locations' });
  }
  if (can(user, 'settings:manage') || can(user, 'org:manage')) {
    items.push({ href: '/app/admin/routing', label: 'Routing & SLA' });
  }
  if (hasRole(user, 'sysadmin')) {
    items.push({ href: '/app/admin/integrations', label: 'Integrations' });
    items.push({ href: '/app/admin/branding', label: 'Branding' });
  }

  return items;
}
