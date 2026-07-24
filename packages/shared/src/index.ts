/** Shared LogIt constants & types (API + web + worker). */

export const APP_NAME = 'LogIt' as const;

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
  IM_READ: 'im:read',
  IM_WRITE: 'im:write',
  IM_COMMAND: 'im:command',
  IM_POSTMORTEM: 'im:postmortem',
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

/** Canonical IT asset lifecycle statuses (CMDB-lite register). */
export const ASSET_STATUSES = [
  'in_stock',
  'in_service',
  'in_repair',
  'retired',
  'disposed',
] as const;

export type AssetStatusCode = (typeof ASSET_STATUSES)[number];

/** Legacy aliases accepted on write; normalized to ASSET_STATUSES. */
export const ASSET_STATUS_ALIASES: Record<string, AssetStatusCode> = {
  in_use: 'in_service',
  under_repair: 'in_repair',
  in_stock: 'in_stock',
  in_service: 'in_service',
  in_repair: 'in_repair',
  retired: 'retired',
  disposed: 'disposed',
};

/** CMDB relationship types between configuration items (assets). */
export const ASSET_RELATION_TYPES = [
  'depends_on',
  'runs_on',
  'hosted_by',
  'connected_to',
  'uses',
  'backs_up',
  'member_of',
] as const;

export type AssetRelationType = (typeof ASSET_RELATION_TYPES)[number];

export const ASSET_RELATION_TYPE_LABELS: Record<AssetRelationType, string> = {
  depends_on: 'Depends on',
  runs_on: 'Runs on',
  hosted_by: 'Hosted by',
  connected_to: 'Connected to',
  uses: 'Uses',
  backs_up: 'Backs up',
  member_of: 'Member of',
};

/** LogIt brand tokens — keep in sync with apps/web CSS variables. */
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

export type PortalThemeColors = {
  primary: string;
  primaryLight: string;
  secondary: string;
  background: string;
  backgroundWarm: string;
  backgroundAccent: string;
  danger: string;
  accentOrange: string;
  accentMuted: string;
  textPrimary: string;
  textOnPrimary: string;
};

export type PortalThemePreset = {
  id: string;
  name: string;
  description: string;
  colors: PortalThemeColors;
};

/** Built-in portal themes (L4). Avoid purple / terracotta AI-generic looks. */
export const PORTAL_THEME_PRESETS: PortalThemePreset[] = [
  {
    id: 'logit',
    name: 'LogIt Forest',
    description: 'Default LogIt forest primary with lime and warm cream.',
    colors: { ...BRAND },
  },
  {
    id: 'coastal',
    name: 'Coastal Teal',
    description: 'Deep teal with soft aqua highlights for a calm portal.',
    colors: {
      primary: '#0A4D56',
      primaryLight: '#C8E8E4',
      secondary: '#1F6B66',
      background: '#FFFFFF',
      backgroundWarm: '#E8F4F2',
      backgroundAccent: '#D4EEF5',
      danger: '#D64545',
      accentOrange: '#C65D2E',
      accentMuted: '#B07A4B',
      textPrimary: '#0A4D56',
      textOnPrimary: '#FFFFFF',
    },
  },
  {
    id: 'slate',
    name: 'Slate Professional',
    description: 'Charcoal and cool gray for a denser enterprise look.',
    colors: {
      primary: '#1F2A32',
      primaryLight: '#D5DDE3',
      secondary: '#3D4F5C',
      background: '#FFFFFF',
      backgroundWarm: '#EEF1F3',
      backgroundAccent: '#E2E8ED',
      danger: '#C62828',
      accentOrange: '#B85C2E',
      accentMuted: '#8B7355',
      textPrimary: '#1F2A32',
      textOnPrimary: '#FFFFFF',
    },
  },
  {
    id: 'olive',
    name: 'Olive Sand',
    description: 'Muted olive with sand neutrals — still on-brand, softer.',
    colors: {
      primary: '#3F4A2E',
      primaryLight: '#E4E8C8',
      secondary: '#5C6B3C',
      background: '#FFFFFF',
      backgroundWarm: '#F3EFE4',
      backgroundAccent: '#E8E4D4',
      danger: '#C44B4B',
      accentOrange: '#C56A2D',
      accentMuted: '#A8895A',
      textPrimary: '#3F4A2E',
      textOnPrimary: '#FFFFFF',
    },
  },
];

export const DEFAULT_PORTAL_THEME_ID = 'logit' as const;

export function getPortalThemePreset(id: string): PortalThemePreset {
  return (
    PORTAL_THEME_PRESETS.find((t) => t.id === id) ?? PORTAL_THEME_PRESETS[0]!
  );
}

export const SESSION_COOKIE = 'logit_session' as const;
