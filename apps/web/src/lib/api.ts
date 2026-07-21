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
};
