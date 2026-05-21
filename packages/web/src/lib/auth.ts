export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Token storage strategy:
 * - Production: httpOnly cookies set by backend (Set-Cookie header)
 * - Development: localStorage fallback for easier debugging
 *
 * In production, tokens are managed server-side via cookies.
 * The frontend never directly accesses tokens — they're sent
 * automatically with credentials: 'include'.
 */

const IS_SERVER = typeof window === 'undefined';
const USE_COOKIES = process.env.NEXT_PUBLIC_AUTH_MODE !== 'localStorage';

export function getStoredTokens(): AuthTokens | null {
  if (IS_SERVER) return null;

  if (USE_COOKIES) {
    // In cookie mode, we don't have direct access to httpOnly cookies.
    // The presence of a non-httpOnly marker cookie indicates auth state.
    const hasAuth = document.cookie.includes('auth_status=active');
    if (!hasAuth) return null;
    // Actual tokens are in httpOnly cookies, sent automatically
    return { accessToken: '__httpOnly__', refreshToken: '__httpOnly__' };
  }

  // Fallback: localStorage (dev only)
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function storeTokens(tokens: AuthTokens): void {
  if (IS_SERVER) return;

  if (USE_COOKIES) {
    // In cookie mode, backend sets httpOnly cookies via Set-Cookie.
    // We only set a non-httpOnly marker for client-side auth state detection.
    document.cookie = 'auth_status=active; path=/; max-age=604800; SameSite=Strict';
    return;
  }

  localStorage.setItem('accessToken', tokens.accessToken);
  localStorage.setItem('refreshToken', tokens.refreshToken);
}

export function clearTokens(): void {
  if (IS_SERVER) return;

  if (USE_COOKIES) {
    document.cookie = 'auth_status=; path=/; max-age=0';
    return;
  }

  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export function isAuthenticated(): boolean {
  return getStoredTokens() !== null;
}

export function getAccessToken(): string | null {
  if (IS_SERVER) return null;

  if (USE_COOKIES) {
    // httpOnly cookies — no direct access, return marker
    return isAuthenticated() ? '__httpOnly__' : null;
  }

  return localStorage.getItem('accessToken');
}
