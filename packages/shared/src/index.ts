/** Shared LogIT constants & types (API + web + worker). */

export const APP_NAME = 'LogIT' as const;

export const TICKET_TYPE_PREFIX = {
  INCIDENT: 'INC',
  SERVICE_REQUEST: 'REQ',
  ACCESS_REQUEST: 'ACC',
  SECURITY_INCIDENT: 'SEC',
  PROBLEM: 'PRB',
  CHANGE: 'CHG',
  TASK: 'TSK',
} as const;

export type TicketTypeCode = keyof typeof TICKET_TYPE_PREFIX;

export const ROLES = {
  EMPLOYEE: 'employee',
  AGENT: 'agent',
  SENIOR_AGENT: 'senior_agent',
  IT_MANAGER: 'it_manager',
  APPROVER: 'approver',
  SYSADMIN: 'sysadmin',
  AUDITOR: 'auditor',
} as const;

export type RoleCode = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  USERS_READ: 'users:read',
  USERS_WRITE: 'users:write',
  USERS_MANAGE: 'users:manage',
  ROLES_MANAGE: 'roles:manage',
  TICKETS_READ_OWN: 'tickets:read_own',
  TICKETS_READ_QUEUE: 'tickets:read_queue',
  TICKETS_READ_ALL: 'tickets:read_all',
  TICKETS_WRITE: 'tickets:write',
  TICKETS_ASSIGN: 'tickets:assign',
  TICKETS_INTERNAL_NOTE: 'tickets:internal_note',
  ORG_READ: 'org:read',
  ORG_MANAGE: 'org:manage',
  AUDIT_READ: 'audit:read',
  REPORTS_READ: 'reports:read',
  SETTINGS_MANAGE: 'settings:manage',
  KNOWLEDGE_READ: 'knowledge:read',
  KNOWLEDGE_WRITE: 'knowledge:write',
  ASSETS_READ: 'assets:read',
  ASSETS_WRITE: 'assets:write',
  APPROVALS_READ: 'approvals:read',
  APPROVALS_DECIDE: 'approvals:decide',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const TICKET_STATUSES = [
  'new',
  'open',
  'assigned',
  'in_progress',
  'pending_user',
  'pending_vendor',
  'pending_approval',
  'on_hold',
  'resolved',
  'closed',
  'cancelled',
] as const;

export type TicketStatusCode = (typeof TICKET_STATUSES)[number];

export const PRIORITIES = [
  'p1_critical',
  'p2_high',
  'p3_medium',
  'p4_low',
  'p5_planning',
] as const;

export type PriorityCode = (typeof PRIORITIES)[number];

/** LogIT brand tokens — keep in sync with apps/web CSS variables. */
export const BRAND = {
  primary: '#0F4A40',
  primaryLight: '#EDF4AC',
  secondary: '#456433',
  background: '#FFFFFF',
  backgroundWarm: '#FBF1DA',
  backgroundAccent: '#F9DDFF',
  danger: '#FF4747',
  accentOrange: '#E74524',
  accentMuted: '#DE884F',
  textPrimary: '#0F4A40',
  textOnPrimary: '#FFFFFF',
} as const;

export const SESSION_COOKIE = 'logit_session' as const;
