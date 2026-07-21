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

export type TicketSummary = {
  id: string;
  number: string;
  title: string;
  status: { code: string; name: string };
  priority?: { code: string; name: string } | null;
  type: { code: string; name: string };
  createdAt: string;
};

export type ApprovalItem = {
  id: string;
  status: string;
  comment: string | null;
  createdAt: string;
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
    return request<{ user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  logout() {
    return request<{ ok: boolean }>('/auth/logout', { method: 'POST' });
  },
  me() {
    return request<{ user: AuthUser }>('/auth/me');
  },
  listTickets() {
    return request<TicketSummary[]>('/tickets');
  },
  createTicket(body: {
    title: string;
    description: string;
    typeCode: string;
    categoryCode?: string;
    impact?: string;
    urgency?: string;
  }) {
    return request<TicketSummary>('/tickets', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },
  ticketMeta() {
    return request<{
      types: Array<{ code: string; name: string }>;
      categories: Array<{ code: string; name: string }>;
    }>('/tickets/meta');
  },
  reportSummary() {
    return request<{
      openTickets: number;
      createdToday: number;
      resolvedToday: number;
      slaBreaches: number;
      unassigned: number;
    }>('/reports/summary');
  },
  notifications() {
    return request<
      Array<{ id: string; title: string; body: string; readAt: string | null }>
    >('/notifications');
  },
  knowledge() {
    return request<
      Array<{ id: string; slug: string; title: string; category: string | null }>
    >('/knowledge');
  },
  catalog() {
    return request<
      Array<{ id: string; code: string; name: string; description: string }>
    >('/catalog');
  },
  assets() {
    return request<
      Array<{
        id: string;
        assetTag: string;
        status: string;
        type: { name: string };
      }>
    >('/assets');
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
  listUsers() {
    return request<
      Array<{
        id: string;
        email: string;
        firstName: string;
        lastName: string;
        isActive: boolean;
        roles: Array<{ code: string; name: string }>;
      }>
    >('/users');
  },
  rolesMatrix() {
    return request<
      Array<{
        id: string;
        code: string;
        name: string;
        description: string | null;
        userCount: number;
        permissions: string[];
      }>
    >('/users/roles/matrix');
  },
  setUserRoles(userId: string, roleCodes: string[]) {
    return request(`/users/${userId}/roles`, {
      method: 'PATCH',
      body: JSON.stringify({ roleCodes }),
    });
  },
  audit(limit = 50) {
    return request<
      Array<{
        id: string;
        action: string;
        entityType: string;
        entityId: string | null;
        createdAt: string;
        actor: {
          email: string;
          firstName: string;
          lastName: string;
        } | null;
      }>
    >(`/audit?limit=${limit}`);
  },
};
