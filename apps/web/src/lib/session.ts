import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { api, type AuthUser } from './api';

/**
 * Load the signed-in user. Redirects to /login only when /auth/me fails.
 * Callers must load page data in a separate try/catch so API/data errors
 * do not look like a logout.
 */
export async function requireSession(
  router: Pick<AppRouterInstance, 'replace'>,
): Promise<AuthUser | null> {
  try {
    const { user } = await api.me();
    return user;
  } catch {
    router.replace('/login');
    return null;
  }
}
