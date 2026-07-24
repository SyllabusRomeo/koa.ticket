const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/api/v1';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  roles: string[];
  permissions: string[];
  departmentId: string | null;
  locationId: string | null;
};

export type CatalogFormFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'number'
  | 'checkbox';

export type CatalogFormField = {
  name: string;
  label: string;
  type: CatalogFormFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: Array<string | { value: string; label: string }>;
  min?: number;
  max?: number;
  defaultValue?: string | number | boolean;
};

export type PersonRef = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
};

export type AssetLocationRef = {
  id: string;
  code: string;
  name: string;
  site?: string | null;
  country?: string | null;
};

export type AssetRow = {
  id: string;
  assetTag: string;
  name?: string | null;
  displayName: string;
  status: string;
  statusName: string;
  serialNumber?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  notes?: string | null;
  purchaseDate?: string | null;
  warrantyExpiresAt?: string | null;
  locationId?: string | null;
  type: { id?: string; name: string; code?: string };
  assignedUser?: PersonRef | null;
  location?: AssetLocationRef | null;
};

export type AssetDetail = AssetRow & {
  tickets?: Array<{
    ticketId: string;
    ticket: {
      id: string;
      number: string;
      title: string;
      status: { code: string; name: string };
    };
  }>;
  source?: string;
};

export type AssetRelationRow = {
  id: string;
  relationType: string;
  relationTypeName: string;
  notes?: string | null;
  direction: 'outgoing' | 'incoming';
  otherAsset: AssetRow;
  fromAsset: AssetRow;
  toAsset: AssetRow;
};

export type AssetImpact = {
  root: AssetRow;
  depth: number;
  impactedCount: number;
  nodes: Array<AssetRow & { hop: number }>;
  edges: Array<{
    fromAssetId: string;
    toAssetId: string;
    relationType: string;
    relationTypeName: string;
  }>;
};

export type TeamRef = {
  id: string;
  code: string;
  name: string;
};

export type LocationRef = {
  id: string;
  code: string;
  name: string;
  site?: string | null;
  country?: string | null;
  timezone?: string;
  isActive?: boolean;
};

export type TicketSummary = {
  id: string;
  number: string;
  title: string;
  version: number;
  status: { code: string; name: string; isTerminal?: boolean };
  priority?: { code: string; name: string } | null;
  type: { code: string; name: string };
  assignee?: PersonRef | null;
  team?: TeamRef | null;
  location?: LocationRef | null;
  locationId?: string | null;
  requester?: PersonRef;
  /** Intake channel: web | email | slack | teams | chat | api */
  channel?: string | null;
  channelMeta?: Record<string, unknown> | null;
  majorIncident?: boolean;
  impact?: string | null;
  urgency?: string | null;
  restricted?: boolean;
  resolutionCode?: { id: string; code: string; name: string } | null;
  resolutionCodeId?: string | null;
  createdAt: string;
  /** Resolution target (ticket.dueAt or active resolution SLA). */
  dueAt?: string | null;
  slaDueAt?: string | null;
  /** Positive = remaining; negative = overdue. Null when completed / no SLA. */
  slaRemainingMs?: number | null;
  slaBreached?: boolean;
  slaPaused?: boolean;
  slaCompleted?: boolean;
  slaPercentConsumed?: number | null;
  /** Preformatted label from API (HH:MM or Xd Xh). */
  timeToResolution?: string | null;
};

export type TicketWorkLog = {
  id: string;
  minutes: number;
  note: string | null;
  workedAt: string;
  author: PersonRef;
};

export type TicketDetail = TicketSummary & {
  description: string;
  watching?: boolean;
  rootCause?: string | null;
  workaround?: string | null;
  changeRisk?: string | null;
  changePlan?: string | null;
  rollbackPlan?: string | null;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  cabRequired?: boolean;
  category?: { code: string; name: string } | null;
  parent?: {
    id: string;
    number: string;
    title: string;
    status: { code: string; name: string };
  } | null;
  children?: Array<{
    id: string;
    number: string;
    title: string;
    status: { code: string; name: string };
    priority?: { code: string; name: string } | null;
  }>;
  mergedInto?: {
    id: string;
    number: string;
    title: string;
    status: { code: string; name: string };
  } | null;
  mergedFrom?: Array<{
    id: string;
    number: string;
    title: string;
    status: { code: string; name: string };
  }>;
  stageDurations?: {
    stages: Array<{
      statusCode: string;
      enteredAt: string;
      exitedAt: string | null;
      durationMs: number;
      current: boolean;
    }>;
    totalsByStatus: Array<{
      statusCode: string;
      durationMs: number;
      label: string;
    }>;
    ticketAgeMs: number | null;
  };
  allowedTransitions?: Array<{
    code: string;
    name: string;
    isTerminal: boolean;
  }>;
  canSoftDelete?: boolean;
  slaInstances?: Array<{
    id: string;
    metric: string;
    startedAt: string;
    dueAt: string;
    pausedAt: string | null;
    completedAt: string | null;
    breachedAt: string | null;
    percentConsumed: number;
  }>;
  comments?: Array<{
    id: string;
    body: string;
    isInternal: boolean;
    createdAt: string;
    author: PersonRef;
  }>;
  history?: Array<{
    id: string;
    field: string;
    oldValue: string | null;
    newValue: string | null;
    oldLabel?: string | null;
    newLabel?: string | null;
    summary?: string;
    actorName?: string;
    createdAt: string;
    actor?: PersonRef | null;
  }>;
};

export type TeamWithMembers = TeamRef & {
  description?: string | null;
  isActive?: boolean;
  location?: { id: string; code: string; name: string } | null;
  department?: { id: string; code: string; name: string } | null;
  members: Array<{
    isLead: boolean;
    user: PersonRef;
  }>;
};

export type AuditEvent = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  ipAddress?: string | null;
  actor: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  } | null;
  after?: Record<string, unknown> | null;
};

export type AuditListResponse = {
  rows: AuditEvent[];
  total: number;
  limit: number;
};

export type AssignmentRule = {
  id: string;
  name: string;
  priority: number;
  autoAssignAssignee?: boolean;
  category: { id: string; code: string; name: string } | null;
  ticketType: { id: string; code: string; name: string } | null;
  location: { id: string; code: string; name: string } | null;
  team: TeamRef | null;
  skill?: { id: string; code: string; name: string } | null;
};

export type Skill = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive?: boolean;
  _count?: { users: number };
};

export type KnowledgeAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  kind: string;
  createdAt: string;
  uploadedById: string;
  articleId?: string | null;
  url: string;
  downloadUrl: string;
  uploadedBy?: PersonRef | null;
};

export type KnowledgeArticle = {
  id: string;
  slug: string;
  title: string;
  body?: string;
  category: string | null;
  status?: string;
  publishedAt?: string | null;
  updatedAt?: string;
  attachments?: KnowledgeAttachment[];
};

export type ApprovalItem = {
  id: string;
  status: string;
  comment: string | null;
  createdAt: string;
  stepOrder?: number | null;
  step?: {
    id: string;
    name: string;
    stepOrder: number;
    mode: string;
  } | null;
  policy?: { id: string; name: string } | null;
  ticket: {
    id: string;
    number: string;
    title: string;
    status: { code: string; name: string };
    type: { code: string; name: string };
    requester: {
      email: string;
      firstName: string;
      lastName: string;
    };
  };
};

export type ApprovalPolicy = {
  id: string;
  name: string;
  priority: number;
  ticketTypeId: string | null;
  categoryId: string | null;
  changeRisk: string | null;
  isActive: boolean;
  steps: Array<{
    id: string;
    name: string;
    stepOrder: number;
    approverRoleCode: string;
    mode: string;
  }>;
};

export type WebhookEndpoint = {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  eventTypes: string[];
  secretHint: string;
  secret?: string;
  createdAt: string;
  updatedAt: string;
};

export type TicketAttachment = {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedById: string;
  uploadedBy: PersonRef | null;
};

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

export type BrandingConfig = {
  logoUrl: string | null;
  loginBannerUrl: string | null;
  hasLogo: boolean;
  hasBanner: boolean;
  logoMime: string | null;
  bannerMime: string | null;
  updatedAt: string | null;
  theme?: {
    id: string;
    name: string;
    description: string;
    colors: PortalThemeColors;
    presets: Array<{
      id: string;
      name: string;
      description: string;
      colors: PortalThemeColors;
    }>;
  };
  limits: {
    logo: { maxBytes: number; extensions: string[] };
    banner: { maxBytes: number; extensions: string[] };
  };
};

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message =
      (data as { message?: string | string[] }).message ?? 'Request failed';
    throw new Error(Array.isArray(message) ? message.join(', ') : message);
  }
  return data as T;
}

export const api = {
  login(email: string, password: string) {
    return request<{
      user?: AuthUser;
      mfaRequired?: boolean;
      mfaToken?: string;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  verifyMfaLogin(mfaToken: string, code: string) {
    return request<{ user: AuthUser }>('/auth/mfa/verify-login', {
      method: 'POST',
      body: JSON.stringify({ mfaToken, code }),
    });
  },
  mfaSetup() {
    return request<{
      secret: string;
      otpauthUrl: string;
      qrDataUrl: string;
    }>('/auth/mfa/setup', { method: 'POST' });
  },
  mfaConfirm(code: string) {
    return request<{ ok: boolean; mfaEnabled: boolean }>('/auth/mfa/confirm', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  },
  mfaCancelSetup() {
    return request<{ ok: boolean }>('/auth/mfa/cancel-setup', {
      method: 'POST',
    });
  },
  mfaDisable(password: string, code: string) {
    return request<{ ok: boolean; mfaEnabled: boolean }>('/auth/mfa/disable', {
      method: 'POST',
      body: JSON.stringify({ password, code }),
    });
  },
  ssoProviders() {
    return request<{ providers: Array<{ id: string; label: string }> }>(
      '/auth/sso/providers',
    );
  },
  ssoEntraStartUrl() {
    return `${API_BASE}/auth/sso/entra`;
  },
  logout() {
    return request<{ ok: boolean }>('/auth/logout', { method: 'POST' });
  },
  me() {
    return request<{ user: AuthUser }>('/auth/me');
  },
  getProfile() {
    return request<{
      user: AuthUser;
      locations: Array<{
        id: string;
        code: string;
        name: string;
        site?: string | null;
        country?: string | null;
        timezone?: string;
        isActive?: boolean;
      }>;
      departments: Array<{
        id: string;
        code: string;
        name: string;
        locationId?: string | null;
        isActive?: boolean;
      }>;
    }>('/auth/profile');
  },
  updateProfile(body: {
    firstName?: string;
    lastName?: string;
    locationId?: string | null;
    departmentId?: string | null;
  }) {
    return request<{ user: AuthUser }>('/auth/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  changePassword(currentPassword: string, newPassword: string) {
    return request<{ ok: boolean; message?: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },
  listTickets(params: {
    locationId?: string;
    majorIncident?: boolean;
    queue?: string;
    statusCode?: string;
    typeCode?: string;
    channel?: string;
    /** Ticket number, title, description, requester/assignee */
    q?: string;
  } = {}) {
    const qs = new URLSearchParams();
    if (params.locationId) qs.set('locationId', params.locationId);
    if (params.majorIncident === true) qs.set('majorIncident', 'true');
    if (params.majorIncident === false) qs.set('majorIncident', 'false');
    if (params.queue) qs.set('queue', params.queue);
    if (params.statusCode) qs.set('statusCode', params.statusCode);
    if (params.typeCode) qs.set('typeCode', params.typeCode);
    if (params.channel) qs.set('channel', params.channel);
    if (params.q?.trim()) qs.set('q', params.q.trim());
    const query = qs.toString();
    return request<TicketSummary[]>(`/tickets${query ? `?${query}` : ''}`);
  },
  ticketBoard(scope: 'all' | 'mine' | 'unassigned' = 'all') {
    const qs = new URLSearchParams();
    if (scope !== 'all') qs.set('scope', scope);
    const query = qs.toString();
    return request<{
      scope: string;
      total: number;
      generatedAt: string;
      columns: Array<{
        code: string;
        name: string;
        tickets: TicketSummary[];
      }>;
      workload: Array<{
        userId: string | null;
        name: string;
        count: number;
      }>;
      /** fromStatusCode → allowed toStatusCodes */
      transitions: Record<string, string[]>;
    }>(`/tickets/board${query ? `?${query}` : ''}`);
  },
  majorIncidentsOps() {
    return request<{
      kpis: {
        active: number;
        breached: number;
        unassigned: number;
        withRelated: number;
        resolvedLast7d: number;
        totalTracked: number;
      };
      active: Array<
        TicketSummary & {
          children?: Array<{
            id: string;
            number: string;
            title: string;
            status: { code: string; name: string; isTerminal?: boolean };
            priority?: { code: string; name: string } | null;
            type: { code: string; name: string };
            assignee?: PersonRef | null;
          }>;
          parent?: {
            id: string;
            number: string;
            title: string;
            majorIncident?: boolean;
            status: { code: string; name: string };
          } | null;
        }
      >;
      recentlyResolved: TicketSummary[];
      generatedAt: string;
    }>('/tickets/major-incidents');
  },
  getTicket(idOrNumber: string) {
    return request<TicketDetail>(`/tickets/${encodeURIComponent(idOrNumber)}`);
  },
  createTicket(body: {
    title: string;
    description: string;
    typeCode: string;
    categoryCode?: string;
    impact?: string;
    urgency?: string;
    parentNumber?: string;
    /** Ticket origin site; defaults to requester home location on the API. */
    locationId?: string;
  }) {
    return request<TicketSummary>('/tickets', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  linkChildTicket(parentIdOrNumber: string, childNumber: string) {
    return request<TicketDetail>(
      `/tickets/${encodeURIComponent(parentIdOrNumber)}/children`,
      {
        method: 'POST',
        body: JSON.stringify({ childNumber }),
      },
    );
  },
  unlinkChildTicket(parentIdOrNumber: string, childIdOrNumber: string) {
    return request<TicketDetail>(
      `/tickets/${encodeURIComponent(parentIdOrNumber)}/children/${encodeURIComponent(childIdOrNumber)}`,
      { method: 'DELETE' },
    );
  },
  mergeTickets(targetIdOrNumber: string, sourceTicketIds: string[]) {
    return request<TicketDetail>(
      `/tickets/${encodeURIComponent(targetIdOrNumber)}/merge`,
      {
        method: 'POST',
        body: JSON.stringify({ sourceTicketIds }),
      },
    );
  },
  updateTicket(
    idOrNumber: string,
    body: {
      version: number;
      statusCode?: string;
      assigneeId?: string | null;
      teamId?: string | null;
      locationId?: string | null;
      title?: string;
      description?: string;
      impact?: string;
      urgency?: string;
      majorIncident?: boolean;
      restricted?: boolean;
      resolutionCodeId?: string | null;
      rootCause?: string | null;
      workaround?: string | null;
      changeRisk?: string | null;
      changePlan?: string | null;
      rollbackPlan?: string | null;
      scheduledStart?: string | null;
      scheduledEnd?: string | null;
      cabRequired?: boolean;
    },
  ) {
    return request<TicketDetail>(
      `/tickets/${encodeURIComponent(idOrNumber)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    );
  },
  promoteToProblem(idOrNumber: string) {
    return request<TicketDetail>(
      `/tickets/${encodeURIComponent(idOrNumber)}/promote-problem`,
      { method: 'POST' },
    );
  },
  requestCab(idOrNumber: string) {
    return request<TicketDetail>(
      `/tickets/${encodeURIComponent(idOrNumber)}/request-cab`,
      { method: 'POST' },
    );
  },
  watchTicket(idOrNumber: string) {
    return request<{ watching: boolean }>(
      `/tickets/${encodeURIComponent(idOrNumber)}/watch`,
      { method: 'POST' },
    );
  },
  unwatchTicket(idOrNumber: string) {
    return request<{ watching: boolean }>(
      `/tickets/${encodeURIComponent(idOrNumber)}/watch`,
      { method: 'DELETE' },
    );
  },
  heartbeatPresence(
    idOrNumber: string,
    mode: 'viewing' | 'composing' = 'viewing',
  ) {
    return request<{
      ticketId: string;
      number: string;
      peers: Array<{
        userId: string;
        firstName: string;
        lastName: string;
        email: string;
        mode: 'viewing' | 'composing';
        updatedAt: string;
      }>;
      self: {
        userId: string;
        mode: 'viewing' | 'composing';
        updatedAt: string;
      };
      collision: boolean;
      composingPeers: Array<{
        userId: string;
        firstName: string;
        lastName: string;
        email: string;
        mode: 'viewing' | 'composing';
      }>;
    }>(`/tickets/${encodeURIComponent(idOrNumber)}/presence`, {
      method: 'POST',
      body: JSON.stringify({ mode }),
    });
  },
  leavePresence(idOrNumber: string) {
    return request<{ ok: boolean }>(
      `/tickets/${encodeURIComponent(idOrNumber)}/presence`,
      { method: 'DELETE' },
    );
  },
  listWorkLogs(idOrNumber: string) {
    return request<TicketWorkLog[]>(
      `/tickets/${encodeURIComponent(idOrNumber)}/work-logs`,
    );
  },
  addWorkLog(idOrNumber: string, body: { minutes: number; note?: string }) {
    return request<TicketWorkLog>(
      `/tickets/${encodeURIComponent(idOrNumber)}/work-logs`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  },
  deleteTicket(idOrNumber: string) {
    return request<{ ok: boolean; number: string }>(
      `/tickets/${encodeURIComponent(idOrNumber)}`,
      { method: 'DELETE' },
    );
  },
  addComment(
    idOrNumber: string,
    body: { body: string; isInternal?: boolean },
  ) {
    return request(`/tickets/${encodeURIComponent(idOrNumber)}/comments`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  ticketMeta() {
    return request<{
      types: Array<{ id: string; code: string; name: string }>;
      categories: Array<{ id: string; code: string; name: string }>;
      statuses: Array<{ code: string; name: string }>;
      priorities?: Array<{ id: string; code: string; name: string }>;
      locations?: LocationRef[];
      resolutionCodes?: Array<{
        id: string;
        code: string;
        name: string;
        sortOrder: number;
      }>;
    }>('/tickets/meta');
  },
  listSavedViews() {
    return request<
      Array<{
        id: string;
        name: string;
        queryJson: Record<string, unknown>;
        createdAt: string;
        updatedAt: string;
      }>
    >('/tickets/views');
  },
  createSavedView(body: { name: string; queryJson: Record<string, unknown> }) {
    return request<{
      id: string;
      name: string;
      queryJson: Record<string, unknown>;
    }>('/tickets/views', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  deleteSavedView(id: string) {
    return request<{ ok: boolean }>(`/tickets/views/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
  listImIncidents() {
    return request<
      Array<{
        id: string;
        number: string;
        title: string;
        summary: string | null;
        severity: string;
        status: string;
        startedAt: string;
        resolvedAt: string | null;
        commander?: PersonRef | null;
        ticket?: { id: string; number: string; title: string } | null;
        _count?: { updates: number };
      }>
    >('/im');
  },
  getImDashboard() {
    return request<{
      generatedAt: string;
      kpis: {
        open: number;
        openSev1: number;
        openSev2: number;
        noCommander: number;
        linkedItsm: number;
        resolvedLast7d: number;
        closedLast30d: number;
        mttrMinutes: number | null;
        oldestOpenHours: number | null;
        total: number;
      };
      bySeverity: {
        sev1: number;
        sev2: number;
        sev3: number;
        sev4: number;
      };
      byStatus: {
        declared: number;
        active: number;
        mitigated: number;
        resolved: number;
        closed: number;
      };
      active: Array<{
        id: string;
        number: string;
        title: string;
        severity: string;
        status: string;
        startedAt: string;
        ageHours: number;
      }>;
    }>('/im/dashboard');
  },
  getImIncident(idOrNumber: string) {
    return request<{
      id: string;
      number: string;
      title: string;
      summary: string | null;
      severity: string;
      status: string;
      startedAt: string;
      resolvedAt: string | null;
      commander?: PersonRef | null;
      ticket?: { id: string; number: string; title: string } | null;
      roles: Array<{ role: string; user: PersonRef }>;
      updates: Array<{
        id: string;
        body: string;
        isInternal: boolean;
        createdAt: string;
        author: PersonRef;
      }>;
    }>(`/im/${encodeURIComponent(idOrNumber)}`);
  },
  createImIncident(body: {
    title: string;
    summary?: string;
    severity: string;
    ticketId?: string;
  }) {
    return request<{ id: string; number: string }>('/im', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  addImUpdate(
    idOrNumber: string,
    body: { body: string; isInternal?: boolean },
  ) {
    return request(`/im/${encodeURIComponent(idOrNumber)}/updates`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateImStatus(
    idOrNumber: string,
    status: 'declared' | 'active' | 'mitigated' | 'resolved' | 'closed',
  ) {
    return request(`/im/${encodeURIComponent(idOrNumber)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },
  getImPir(idOrNumber: string) {
    return request<{
      number: string;
      title: string;
      format: 'markdown';
      markdown: string;
      generatedAt: string;
    }>(`/im/${encodeURIComponent(idOrNumber)}/pir`);
  },
  assignImRole(
    idOrNumber: string,
    body: {
      userId: string;
      role: 'commander' | 'scribe' | 'comms' | 'responder';
    },
  ) {
    return request(`/im/${encodeURIComponent(idOrNumber)}/roles`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  listAutomationRules() {
    return request<
      Array<{
        id: string;
        name: string;
        isActive: boolean;
        sortOrder: number;
        conditions: Record<string, unknown>;
        actions: Record<string, unknown>;
        createdAt?: string;
        updatedAt?: string;
      }>
    >('/automation/rules');
  },
  createAutomationRule(body: {
    name: string;
    isActive?: boolean;
    sortOrder?: number;
    conditions: Record<string, unknown>;
    actions: Record<string, unknown>;
  }) {
    return request('/automation/rules', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateAutomationRule(
    id: string,
    body: {
      name?: string;
      isActive?: boolean;
      sortOrder?: number;
      conditions?: Record<string, unknown>;
      actions?: Record<string, unknown>;
    },
  ) {
    return request(`/automation/rules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  reportImsKpis(params: { from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const query = qs.toString();
    return request<{
      mttaMinutes: number | null;
      mttrMinutes: number | null;
      slaCompliancePercent: number | null;
      fcrPercent: number | null;
      reopenRatePercent: number | null;
      openP1P2: number;
      breachedOpen: number;
      generatedAt: string;
    }>(`/reports/ims-kpis${query ? `?${query}` : ''}`);
  },
  listTeams() {
    return request<TeamWithMembers[]>('/org/teams');
  },
  listLocations() {
    return request<LocationRef[]>('/org/locations');
  },
  createLocation(body: {
    code: string;
    name: string;
    country?: string;
    site?: string;
    timezone?: string;
  }) {
    return request<LocationRef>('/org/locations', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateLocation(
    id: string,
    body: {
      name?: string;
      country?: string | null;
      site?: string | null;
      timezone?: string;
      isActive?: boolean;
    },
  ) {
    return request<LocationRef>(`/org/locations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  deactivateLocation(id: string) {
    return request<LocationRef>(`/org/locations/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
  listDepartments() {
    return request<
      Array<{
        id: string;
        code: string;
        name: string;
        locationId: string | null;
        isActive?: boolean;
        location?: { id: string; code: string; name: string } | null;
      }>
    >('/org/departments');
  },
  createDepartment(body: {
    code: string;
    name: string;
    locationId?: string;
  }) {
    return request<{
      id: string;
      code: string;
      name: string;
      locationId: string | null;
      isActive?: boolean;
      location?: { id: string; code: string; name: string } | null;
    }>('/org/departments', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateDepartment(
    id: string,
    body: {
      name?: string;
      locationId?: string | null;
      isActive?: boolean;
    },
  ) {
    return request<{
      id: string;
      code: string;
      name: string;
      locationId: string | null;
      isActive?: boolean;
      location?: { id: string; code: string; name: string } | null;
    }>(`/org/departments/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  deactivateDepartment(id: string) {
    return request<{
      id: string;
      code: string;
      name: string;
    }>(`/org/departments/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
  createTeam(body: {
    code: string;
    name: string;
    description?: string;
    locationId?: string;
    departmentId?: string;
  }) {
    return request<TeamWithMembers>('/org/teams', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateTeam(
    id: string,
    body: {
      name?: string;
      description?: string;
      locationId?: string;
      departmentId?: string;
      isActive?: boolean;
    },
  ) {
    return request<TeamWithMembers>(`/org/teams/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  addTeamMember(teamId: string, body: { userId: string; isLead?: boolean }) {
    return request<TeamWithMembers>(
      `/org/teams/${encodeURIComponent(teamId)}/members`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  },
  removeTeamMember(teamId: string, userId: string) {
    return request<TeamWithMembers>(
      `/org/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`,
      { method: 'DELETE' },
    );
  },
  assignmentRules() {
    return request<AssignmentRule[]>('/assignment-rules');
  },
  createAssignmentRule(body: {
    name: string;
    teamId: string;
    categoryId?: string;
    ticketTypeId?: string;
    locationId?: string;
    skillId?: string;
    autoAssignAssignee?: boolean;
    priority?: number;
  }) {
    return request('/assignment-rules', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  listSkills() {
    return request<Skill[]>('/skills');
  },
  createSkill(body: { code: string; name: string; description?: string }) {
    return request<Skill>('/skills', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  getUserSkills(userId: string) {
    return request<Array<{ id: string; code: string; name: string }>>(
      `/skills/users/${encodeURIComponent(userId)}`,
    );
  },
  setUserSkills(userId: string, skillIds: string[]) {
    return request<Array<{ id: string; code: string; name: string }>>(
      `/skills/users/${encodeURIComponent(userId)}`,
      {
        method: 'PUT',
        body: JSON.stringify({ skillIds }),
      },
    );
  },
  slaPolicies() {
    return request<
      Array<{
        id: string;
        name: string;
        priorityId: string | null;
        firstResponseMinutes: number;
        resolveMinutes: number;
        isActive: boolean;
        escalations?: Array<{
          id: string;
          thresholdPercent: number;
          notifyRoleCodes: string;
        }>;
      }>
    >('/sla/policies');
  },
  createSlaPolicy(body: {
    name: string;
    priorityId?: string;
    firstResponseMinutes: number;
    resolveMinutes: number;
  }) {
    return request('/sla/policies', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  reportSummary(params: { from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const query = qs.toString();
    return request<{
      openTickets: number;
      createdToday: number;
      resolvedToday: number;
      slaBreaches: number;
      unassigned: number;
      totalInRange: number;
      from: string | null;
      to: string | null;
      byStatus: Array<{ code: string; name: string; count: number }>;
      byPriority: Array<{ code: string; name: string; count: number }>;
      byType: Array<{ code: string; name: string; count: number }>;
      byTeam: Array<{ code: string; name: string; count: number }>;
      byAssignee: Array<{ code: string; name: string; count: number }>;
      byLocation: Array<{ code: string; name: string; count: number }>;
      generatedAt: string;
    }>(`/reports/summary${query ? `?${query}` : ''}`);
  },
  reportStages(params: { from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const query = qs.toString();
    return request<{
      sampleSize: number;
      stuckThresholdHours: number;
      from: string | null;
      to: string | null;
      byStatus: Array<{
        code: string;
        name: string;
        ticketCount: number;
        currentCount: number;
        totalMs: number;
        avgMs: number;
        avgLabel: string;
        totalLabel: string;
        pctOfAll: number;
      }>;
      stuckOpen: Array<{
        number: string;
        title: string;
        statusCode: string;
        statusName: string;
        durationMs: number;
        label: string;
      }>;
      generatedAt: string;
    }>(`/reports/stages${query ? `?${query}` : ''}`);
  },
  reportHeatmap(
    params: {
      from?: string;
      to?: string;
      metric?: 'created' | 'resolved';
    } = {},
  ) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.metric) qs.set('metric', params.metric);
    const query = qs.toString();
    return request<{
      metric: 'created' | 'resolved';
      from: string | null;
      to: string | null;
      sampleSize: number;
      max: number;
      days: string[];
      cells: Array<{ dayOfWeek: number; hour: number; count: number }>;
      generatedAt: string;
    }>(`/reports/heatmap${query ? `?${query}` : ''}`);
  },
  listReportSchedules() {
    return request<
      Array<{
        id: string;
        userId: string;
        cadence: 'daily' | 'weekly';
        format: 'csv' | 'pdf';
        email: string;
        filters: { rangeDays: number };
        lastRunAt: string | null;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
      }>
    >('/reports/schedules');
  },
  createReportSchedule(body: {
    cadence: 'daily' | 'weekly';
    format: 'csv' | 'pdf';
    email: string;
    rangeDays?: number;
    isActive?: boolean;
  }) {
    return request('/reports/schedules', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateReportSchedule(
    id: string,
    body: {
      cadence?: 'daily' | 'weekly';
      format?: 'csv' | 'pdf';
      email?: string;
      rangeDays?: number;
      isActive?: boolean;
    },
  ) {
    return request(`/reports/schedules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  deleteReportSchedule(id: string) {
    return request<{ ok: boolean }>(
      `/reports/schedules/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },
  runReportSchedule(id: string) {
    return request<{ ok: boolean; result: 'ok' | 'skipped' }>(
      `/reports/schedules/${encodeURIComponent(id)}/run`,
      { method: 'POST' },
    );
  },
  async downloadExport(path: string, fallbackFilename: string) {
    const res = await fetch(`${API_BASE}${path}`, { credentials: 'include' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message =
        (data as { message?: string | string[] }).message ?? 'Download failed';
      throw new Error(Array.isArray(message) ? message.join(', ') : message);
    }
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const filename = match?.[1]?.trim() || fallbackFilename;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  downloadReportCsv(params: { from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const query = qs.toString();
    return this.downloadExport(
      `/reports/export.csv${query ? `?${query}` : ''}`,
      'logit-report.csv',
    );
  },
  downloadReportPdf(params: { from?: string; to?: string } = {}) {
    const qs = new URLSearchParams();
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    const query = qs.toString();
    return this.downloadExport(
      `/reports/export.pdf${query ? `?${query}` : ''}`,
      'logit-report.pdf',
    );
  },
  downloadTicketsCsv() {
    return this.downloadExport('/tickets/export.csv', 'logit-tickets.csv');
  },
  downloadAuditCsv(params: {
    limit?: number;
    action?: string;
    actor?: string;
    entityType?: string;
    from?: string;
    to?: string;
    q?: string;
  } = {}) {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.action) qs.set('action', params.action);
    if (params.actor) qs.set('actor', params.actor);
    if (params.entityType) qs.set('entityType', params.entityType);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.q) qs.set('q', params.q);
    const query = qs.toString();
    return this.downloadExport(
      `/audit/export.csv${query ? `?${query}` : ''}`,
      'logit-audit.csv',
    );
  },
  reportWorkspace() {
    return request<{
      kpis: {
        overdue: number;
        dueToday: number;
        open: number;
        onHoldPending: number;
        unassigned: number;
        assignedToMe: number;
      };
      byPriority: Array<{ code: string; name: string; count: number }>;
      byStatus: Array<{
        code: string;
        name: string;
        count: number;
        isTerminal: boolean;
      }>;
      recent: Array<{
        id: string;
        number: string;
        title: string;
        assigneeId: string | null;
        status: { code: string; name: string; isTerminal?: boolean };
        priority?: { code: string; name: string } | null;
        dueAt?: string | null;
        slaDueAt?: string | null;
        slaRemainingMs?: number | null;
        slaBreached?: boolean;
        slaPaused?: boolean;
        slaCompleted?: boolean;
        timeToResolution?: string | null;
      }>;
      generatedAt: string;
    }>('/reports/workspace');
  },
  notifications() {
    return request<
      Array<{
        id: string;
        title: string;
        body: string;
        link: string | null;
        readAt: string | null;
        createdAt?: string;
      }>
    >('/notifications');
  },
  notificationUnreadCount() {
    return request<{ count: number }>('/notifications/unread-count');
  },
  markNotificationRead(id: string) {
    return request(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST',
    });
  },
  markAllNotificationsRead() {
    return request('/notifications/read-all', { method: 'POST' });
  },
  notificationPreferences() {
    return request<
      Array<{
        eventType: string;
        label: string;
        description: string;
        inAppEnabled: boolean;
        emailEnabled: boolean;
      }>
    >('/notifications/preferences');
  },
  setNotificationPreference(body: {
    eventType: string;
    inAppEnabled?: boolean;
    emailEnabled?: boolean;
  }) {
    return request('/notifications/preferences', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  notificationDigestSettings() {
    return request<{
      frequency: 'none' | 'daily' | 'weekly';
      lastDigestAt: string | null;
      quietStartHour: number | null;
      quietEndHour: number | null;
      timezone: string;
      timezoneSource: 'location' | 'default';
      locationName?: string | null;
    }>('/notifications/digest');
  },
  setNotificationDigestSettings(body: {
    frequency?: 'none' | 'daily' | 'weekly';
    quietStartHour?: number | null;
    quietEndHour?: number | null;
  }) {
    return request<{
      frequency: 'none' | 'daily' | 'weekly';
      lastDigestAt: string | null;
      quietStartHour: number | null;
      quietEndHour: number | null;
      timezone: string;
      timezoneSource: 'location' | 'default';
      locationName?: string | null;
    }>('/notifications/digest', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  knowledge() {
    return request<KnowledgeArticle[]>('/knowledge');
  },
  getKnowledge(slug: string) {
    return request<KnowledgeArticle>(
      `/knowledge/${encodeURIComponent(slug)}`,
    );
  },
  knowledgeFeedback(
    id: string,
    eventType: 'helpful' | 'not_helpful' | 'deflected',
  ) {
    return request(`/knowledge/${encodeURIComponent(id)}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ eventType }),
    });
  },
  knowledgeDeflectionAnalytics(days = 30) {
    return request<{
      from: string;
      to: string;
      rangeDays: number;
      totals: {
        views: number;
        helpful: number;
        notHelpful: number;
        deflected: number;
      };
      helpfulRate: number | null;
      deflectionRate: number | null;
      topArticles: Array<{
        id: string;
        slug: string;
        title: string;
        category: string | null;
        views: number;
        helpful: number;
        notHelpful: number;
        deflected: number;
      }>;
      daily: Array<{
        date: string;
        views: number;
        deflected: number;
        helpful: number;
      }>;
    }>(`/knowledge/analytics/deflection?days=${days}`);
  },
  aiClassify(body: { title: string; description?: string }) {
    return request<{
      provider: string;
      typeCode: string;
      typeName: string;
      categoryCode: string | null;
      categoryName: string | null;
      impact: string;
      urgency: string;
      priorityCode: string | null;
      confidence: number;
      rationale: string;
    }>('/ai/assist/classify', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  aiSummarize(body: {
    title?: string;
    description?: string;
    ticketId?: string;
    ticketNumber?: string;
  }) {
    return request<{ provider: string; summary: string; ticketNumber?: string }>(
      '/ai/assist/summarize',
      { method: 'POST', body: JSON.stringify(body) },
    );
  },
  aiDuplicates(body: {
    title: string;
    description?: string;
    excludeTicketId?: string;
  }) {
    return request<{
      provider: string;
      matches: Array<{
        id: string;
        number: string;
        title: string;
        status: { code: string; name: string };
        score: number;
      }>;
    }>('/ai/assist/duplicates', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  aiSlaRisk(ticketRef: string) {
    return request<{
      provider: string;
      ticketNumber: string;
      level: string;
      score: number;
      factors: string[];
      narrative?: string;
    }>(`/ai/assist/sla-risk/${encodeURIComponent(ticketRef)}`);
  },
  aiSuggestKnowledge(body: { title: string; description?: string }) {
    return request<{
      provider: string;
      matches: Array<{
        id: string;
        slug: string;
        title: string;
        category: string | null;
        score: number;
      }>;
    }>('/ai/assist/knowledge', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  createKnowledge(body: {
    title: string;
    body: string;
    slug: string;
    category?: string;
    publish?: boolean;
  }) {
    return request<KnowledgeArticle>('/knowledge', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateKnowledge(
    id: string,
    body: {
      title?: string;
      body?: string;
      category?: string;
      publish?: boolean;
    },
  ) {
    return request<KnowledgeArticle>(`/knowledge/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  publishKnowledge(id: string) {
    return request<KnowledgeArticle>(`/knowledge/${id}/publish`, {
      method: 'POST',
    });
  },
  listKnowledgeAttachments(articleId: string) {
    return request<KnowledgeAttachment[]>(
      `/knowledge/${encodeURIComponent(articleId)}/attachments`,
    );
  },
  uploadKnowledgeMedia(file: File, articleId?: string) {
    const body = new FormData();
    body.append('file', file);
    const q = articleId
      ? `?articleId=${encodeURIComponent(articleId)}`
      : '';
    return fetch(`${API_BASE}/knowledge/media${q}`, {
      method: 'POST',
      credentials: 'include',
      body,
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          (data as { message?: string | string[] }).message ?? 'Upload failed';
        throw new Error(Array.isArray(message) ? message.join(', ') : message);
      }
      return data as KnowledgeAttachment;
    });
  },
  uploadKnowledgeAttachment(articleId: string, file: File) {
    const body = new FormData();
    body.append('file', file);
    return fetch(
      `${API_BASE}/knowledge/${encodeURIComponent(articleId)}/attachments`,
      {
        method: 'POST',
        credentials: 'include',
        body,
      },
    ).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          (data as { message?: string | string[] }).message ?? 'Upload failed';
        throw new Error(Array.isArray(message) ? message.join(', ') : message);
      }
      return data as KnowledgeAttachment;
    });
  },
  async downloadKnowledgeAttachment(id: string, filename: string) {
    const res = await fetch(
      `${API_BASE}/knowledge/attachments/${encodeURIComponent(id)}/download`,
      { credentials: 'include' },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message =
        (data as { message?: string | string[] }).message ?? 'Download failed';
      throw new Error(Array.isArray(message) ? message.join(', ') : message);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  catalog() {
    return request<
      Array<{
        id: string;
        code: string;
        name: string;
        description: string;
        ticketTypeCode: string;
        categoryCode?: string | null;
        teamId?: string | null;
        formSchema?: CatalogFormField[] | null;
      }>
    >('/catalog');
  },
  createCatalogItem(body: {
    code: string;
    name: string;
    description: string;
    ticketTypeCode: string;
    categoryCode?: string;
    teamId?: string;
    formSchema?: CatalogFormField[];
  }) {
    return request('/catalog', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateCatalogItem(
    idOrCode: string,
    body: {
      name?: string;
      description?: string;
      ticketTypeCode?: string;
      categoryCode?: string | null;
      teamId?: string | null;
      isActive?: boolean;
      formSchema?: CatalogFormField[] | null;
    },
  ) {
    return request(`/catalog/${encodeURIComponent(idOrCode)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  requestCatalogItem(
    idOrCode: string,
    body?: { notes?: string; answers?: Record<string, unknown> },
  ) {
    return request<{
      ticket: TicketDetail;
      catalogItem: {
        id: string;
        code: string;
        name: string;
        ticketTypeCode: string;
        formSchema?: CatalogFormField[] | null;
      };
    }>(`/catalog/${encodeURIComponent(idOrCode)}/request`, {
      method: 'POST',
      body: JSON.stringify({
        notes: body?.notes || undefined,
        answers: body?.answers,
      }),
    });
  },
  assets(params: {
    status?: string;
    typeCode?: string;
    typeId?: string;
    locationId?: string;
    q?: string;
  } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.typeCode) qs.set('typeCode', params.typeCode);
    if (params.typeId) qs.set('typeId', params.typeId);
    if (params.locationId) qs.set('locationId', params.locationId);
    if (params.q) qs.set('q', params.q);
    const query = qs.toString();
    return request<AssetRow[]>(`/assets${query ? `?${query}` : ''}`);
  },
  asset(id: string) {
    return request<AssetDetail>(`/assets/${id}`);
  },
  assetTypes() {
    return request<Array<{ id: string; code: string; name: string }>>(
      '/assets/types',
    );
  },
  assetStatuses() {
    return request<Array<{ code: string; name: string }>>('/assets/statuses');
  },
  assetAssignees() {
    return request<PersonRef[]>('/assets/assignees');
  },
  createAsset(body: {
    assetTag: string;
    typeCode: string;
    name?: string;
    serialNumber?: string;
    manufacturer?: string;
    model?: string;
    assignedUserId?: string;
    locationId?: string;
    status?: string;
    purchaseDate?: string;
    warrantyExpiresAt?: string;
    notes?: string;
  }) {
    return request<AssetRow>('/assets', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateAsset(
    id: string,
    body: {
      assetTag?: string;
      typeCode?: string;
      name?: string | null;
      serialNumber?: string | null;
      manufacturer?: string | null;
      model?: string | null;
      assignedUserId?: string | null;
      locationId?: string | null;
      status?: string;
      purchaseDate?: string | null;
      warrantyExpiresAt?: string | null;
      notes?: string | null;
    },
  ) {
    return request<AssetRow>(`/assets/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  deleteAsset(id: string) {
    return request<AssetRow>(`/assets/${id}`, { method: 'DELETE' });
  },
  downloadAssetsCsv(params: {
    status?: string;
    typeCode?: string;
    locationId?: string;
    q?: string;
  } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.typeCode) qs.set('typeCode', params.typeCode);
    if (params.locationId) qs.set('locationId', params.locationId);
    if (params.q) qs.set('q', params.q);
    const query = qs.toString();
    return this.downloadExport(
      `/assets/export.csv${query ? `?${query}` : ''}`,
      'logit-assets.csv',
    );
  },
  linkAssetToTicket(ticketId: string, assetId: string) {
    return request(`/assets/tickets/${ticketId}/link`, {
      method: 'POST',
      body: JSON.stringify({ assetId }),
    });
  },
  assetRelationTypes() {
    return request<Array<{ code: string; name: string }>>(
      '/assets/relation-types',
    );
  },
  assetRelations(id: string) {
    return request<AssetRelationRow[]>(`/assets/${id}/relations`);
  },
  createAssetRelation(
    id: string,
    body: { toAssetId: string; relationType: string; notes?: string },
  ) {
    return request(`/assets/${id}/relations`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  deleteAssetRelation(id: string, relationId: string) {
    return request(`/assets/${id}/relations/${relationId}`, {
      method: 'DELETE',
    });
  },
  assetImpact(id: string, depth = 2) {
    return request<AssetImpact>(`/assets/${id}/impact?depth=${depth}`);
  },
  discoveryImportAssets(body: {
    csv?: string;
    assets?: Array<Record<string, string>>;
    relations?: Array<Record<string, string>>;
  }) {
    return request<{
      created: number;
      updated: number;
      relationsCreated: number;
      relationsSkipped: number;
      errors: string[];
    }>('/assets/discovery/import', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  approvals(status?: string) {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<ApprovalItem[]>(`/approvals${q}`);
  },
  decideApproval(
    id: string,
    decision: 'approved' | 'rejected',
    comment?: string,
  ) {
    return request<ApprovalItem>(`/approvals/${id}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision, comment }),
    });
  },
  approvalPolicies(includeInactive = false) {
    const q = includeInactive ? '?includeInactive=1' : '';
    return request<ApprovalPolicy[]>(`/approvals/policies${q}`);
  },
  createApprovalPolicy(body: {
    name: string;
    ticketTypeId?: string;
    categoryId?: string;
    changeRisk?: string;
    priority?: number;
    steps: Array<{
      name: string;
      approverRoleCode: string;
      mode?: 'any' | 'all';
      stepOrder?: number;
    }>;
  }) {
    return request<ApprovalPolicy>('/approvals/policies', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateApprovalPolicy(
    id: string,
    body: {
      name?: string;
      ticketTypeId?: string | null;
      categoryId?: string | null;
      changeRisk?: string | null;
      priority?: number;
      isActive?: boolean;
      steps?: Array<{
        name: string;
        approverRoleCode: string;
        mode?: 'any' | 'all';
        stepOrder?: number;
      }>;
    },
  ) {
    return request<ApprovalPolicy>(
      `/approvals/policies/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    );
  },
  listUsers() {
    return request<
      Array<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        isActive: boolean;
        departmentId?: string | null;
        locationId: string | null;
        lastLoginAt?: string | null;
        createdAt?: string;
        location?: {
          id: string;
          code: string;
          name: string;
          site: string | null;
        } | null;
        roles: Array<{ code: string; name: string }>;
        primaryRole: { code: string; name: string } | null;
        extraPermissions: string[];
      }>
    >('/users');
  },
  createUser(body: {
    email: string;
    firstName: string;
    lastName: string;
    password?: string;
    roleCodes?: string[];
    departmentId?: string;
    locationId?: string;
  }) {
    return request<{
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        mustChangePassword: boolean;
      };
      temporaryPassword?: string;
    }>('/users', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateUser(
    id: string,
    body: {
      email?: string;
      firstName?: string;
      lastName?: string;
      locationId?: string | null;
      departmentId?: string | null;
      isActive?: boolean;
    },
  ) {
    return request(`/users/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  resetUserPassword(id: string) {
    return request<{
      user: {
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        mustChangePassword: boolean;
      };
      temporaryPassword: string;
    }>(`/users/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      body: '{}',
    });
  },
  deleteUser(id: string) {
    return request<{ ok: boolean; id: string; formerEmail: string }>(
      `/users/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },
  rolesMatrix() {
    return request<{
      roles: Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        userCount: number;
        permissions: string[];
      }>;
      allPermissions: Array<{
        code: string;
        name: string;
        description: string | null;
      }>;
    }>('/users/roles/matrix');
  },
  setUserAccess(
    userId: string,
    body: { roleCode: string; extraPermissionCodes: string[] },
  ) {
    return request(`/users/${userId}/roles`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  /** @deprecated Prefer setUserAccess with a single primary role + extras. */
  setUserRoles(userId: string, roleCodes: string[]) {
    return this.setUserAccess(userId, {
      roleCode: roleCodes[0] ?? 'employee',
      extraPermissionCodes: [],
    });
  },
  listAttachments(ticketIdOrNumber: string) {
    return request<TicketAttachment[]>(
      `/tickets/${encodeURIComponent(ticketIdOrNumber)}/attachments`,
    );
  },
  uploadAttachment(ticketIdOrNumber: string, file: File) {
    const body = new FormData();
    body.append('file', file);
    return fetch(
      `${API_BASE}/tickets/${encodeURIComponent(ticketIdOrNumber)}/attachments`,
      {
        method: 'POST',
        credentials: 'include',
        body,
      },
    ).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          (data as { message?: string | string[] }).message ?? 'Upload failed';
        throw new Error(Array.isArray(message) ? message.join(', ') : message);
      }
      return data as TicketAttachment;
    });
  },
  async downloadAttachment(id: string, filename: string) {
    const res = await fetch(
      `${API_BASE}/attachments/${encodeURIComponent(id)}/download`,
      { credentials: 'include' },
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const message =
        (data as { message?: string | string[] }).message ?? 'Download failed';
      throw new Error(Array.isArray(message) ? message.join(', ') : message);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  attachmentLimits() {
    return request<{
      maxBytes: number;
      allowedExtensions: string[];
      storage: string;
      uploadDirHint: string;
    }>('/attachments/limits');
  },
  branding() {
    return request<BrandingConfig>('/branding');
  },
  updateBrandingTheme(body: {
    themeId: string;
    colors?: Partial<PortalThemeColors> | null;
  }) {
    return request<BrandingConfig>('/branding/theme', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  uploadBrandingLogo(file: File) {
    const body = new FormData();
    body.append('file', file);
    return fetch(`${API_BASE}/branding/logo`, {
      method: 'POST',
      credentials: 'include',
      body,
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          (data as { message?: string | string[] }).message ?? 'Upload failed';
        throw new Error(Array.isArray(message) ? message.join(', ') : message);
      }
      return data as BrandingConfig;
    });
  },
  uploadBrandingBanner(file: File) {
    const body = new FormData();
    body.append('file', file);
    return fetch(`${API_BASE}/branding/banner`, {
      method: 'POST',
      credentials: 'include',
      body,
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          (data as { message?: string | string[] }).message ?? 'Upload failed';
        throw new Error(Array.isArray(message) ? message.join(', ') : message);
      }
      return data as BrandingConfig;
    });
  },
  resetBranding() {
    return request<BrandingConfig>('/branding/reset', {
      method: 'POST',
    });
  },
  integrationsStatus() {
    return request<{
      slack: {
        configured: boolean;
        signingSecret: boolean;
        botToken: boolean;
        authRequired?: boolean;
        eventsUrl: string;
        slashUrl: string;
      };
      teams: {
        configured: boolean;
        appId: boolean;
        webhookSecret: boolean;
        jwtVerification?: boolean;
        allowEmulator?: boolean;
        authRequired?: boolean;
        messagesUrl: string;
      };
      email: {
        configured: boolean;
        outbound: {
          configured: boolean;
          host: boolean;
          hostValue: string | null;
          user: boolean;
          from: string | null;
        };
        inbound: {
          webhookUrl: string;
          secretConfigured: boolean;
          note: string;
        };
        imap: {
          implemented: boolean;
          configured?: boolean;
          host?: string | null;
          mailbox?: string;
          pollMinutes?: number;
          note: string;
        };
        appPublicUrl: string;
      };
      serviceUserEmail: string;
      appPublicUrl: string;
      examples: string[];
    }>('/integrations/status');
  },
  simulateChatTicket(body: {
    text: string;
    email?: string;
    displayName?: string;
  }) {
    return request<{
      ok: true;
      ticketNumber: string;
      title: string;
      url: string;
      confirmation: string;
    }>('/integrations/chat/simulate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  pollImap() {
    return request<{
      ok: boolean;
      processed: number;
      skipped: number;
      errors: number;
      reason?: string;
    }>('/integrations/email/imap/poll', { method: 'POST' });
  },
  webhookEvents() {
    return request<{ enabled: boolean; events: string[] }>('/webhooks/events');
  },
  webhookEndpoints() {
    return request<WebhookEndpoint[]>('/webhooks/endpoints');
  },
  createWebhookEndpoint(body: {
    name: string;
    url: string;
    eventTypes: string[];
    isActive?: boolean;
  }) {
    return request<WebhookEndpoint & { secret?: string }>(
      '/webhooks/endpoints',
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  },
  updateWebhookEndpoint(
    id: string,
    body: {
      name?: string;
      url?: string;
      eventTypes?: string[];
      isActive?: boolean;
      rotateSecret?: boolean;
    },
  ) {
    return request<WebhookEndpoint & { secret?: string }>(
      `/webhooks/endpoints/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      },
    );
  },
  deleteWebhookEndpoint(id: string) {
    return request<{ ok: true }>(
      `/webhooks/endpoints/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },
  testWebhookEndpoint(id: string) {
    return request<{
      ok: boolean;
      deliveryId: string;
      statusCode: number | null;
      error: string | null;
    }>(`/webhooks/endpoints/${encodeURIComponent(id)}/test`, {
      method: 'POST',
    });
  },
  webhookDeliveries(id: string) {
    return request<
      Array<{
        id: string;
        eventType: string;
        statusCode: number | null;
        success: boolean;
        error: string | null;
        createdAt: string;
      }>
    >(`/webhooks/endpoints/${encodeURIComponent(id)}/deliveries`);
  },
  audit(params: {
    limit?: number;
    action?: string;
    actor?: string;
    entityType?: string;
    from?: string;
    to?: string;
    q?: string;
  } = {}) {
    const qs = new URLSearchParams();
    if (params.limit != null) qs.set('limit', String(params.limit));
    if (params.action) qs.set('action', params.action);
    if (params.actor) qs.set('actor', params.actor);
    if (params.entityType) qs.set('entityType', params.entityType);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.q) qs.set('q', params.q);
    const query = qs.toString();
    return request<AuditListResponse>(`/audit${query ? `?${query}` : ''}`);
  },
  auditFacets() {
    return request<{ actions: string[]; entityTypes: string[] }>(
      '/audit/facets',
    );
  },
  listAuditExportSchedules() {
    return request<
      Array<{
        id: string;
        userId: string;
        cadence: 'daily' | 'weekly';
        email: string;
        filters: {
          rangeDays: number;
          action?: string;
          entityType?: string;
        };
        lastRunAt: string | null;
        isActive: boolean;
        createdAt: string;
        updatedAt: string;
      }>
    >('/audit/export-schedules');
  },
  createAuditExportSchedule(body: {
    cadence: 'daily' | 'weekly';
    email: string;
    rangeDays?: number;
    action?: string;
    entityType?: string;
    isActive?: boolean;
  }) {
    return request('/audit/export-schedules', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  updateAuditExportSchedule(
    id: string,
    body: {
      cadence?: 'daily' | 'weekly';
      email?: string;
      rangeDays?: number;
      action?: string | null;
      entityType?: string | null;
      isActive?: boolean;
    },
  ) {
    return request(`/audit/export-schedules/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  deleteAuditExportSchedule(id: string) {
    return request<{ ok: boolean }>(
      `/audit/export-schedules/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  },
  runAuditExportSchedule(id: string) {
    return request<{ ok: boolean; result: 'ok' | 'skipped' }>(
      `/audit/export-schedules/${encodeURIComponent(id)}/run`,
      { method: 'POST' },
    );
  },
  listAuditExportRuns(limit = 20) {
    return request<
      Array<{
        id: string;
        scheduleId: string | null;
        rowCount: number;
        contentSha256: string;
        rangeFrom: string | null;
        rangeTo: string | null;
        filters: {
          rangeDays: number;
          action?: string;
          entityType?: string;
        };
        createdAt: string;
      }>
    >(`/audit/export-runs?limit=${encodeURIComponent(String(limit))}`);
  },
};
