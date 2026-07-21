import type { AuthUser } from './api';

export function can(user: AuthUser | null | undefined, permission: string) {
  return !!user?.permissions.includes(permission);
}

export function hasRole(user: AuthUser | null | undefined, role: string) {
  return !!user?.roles.includes(role);
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

export type NavItem = { href: string; label: string };

export function navForUser(user: AuthUser): NavItem[] {
  const items: NavItem[] = [{ href: '/app', label: 'Home' }];

  if (can(user, 'tickets:read_own') || can(user, 'tickets:read_queue') || can(user, 'tickets:read_all')) {
    items.push({ href: '/app/tickets', label: 'Tickets' });
  }
  if (can(user, 'approvals:read')) {
    items.push({ href: '/app/approvals', label: 'Approvals' });
  }
  if (can(user, 'knowledge:read')) {
    items.push({ href: '/app/knowledge', label: 'Knowledge' });
  }
  // Catalog is employee-facing; allow anyone authenticated who can create/view requests
  if (can(user, 'tickets:write') || hasRole(user, 'employee') || hasRole(user, 'approver')) {
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

  return items;
}
