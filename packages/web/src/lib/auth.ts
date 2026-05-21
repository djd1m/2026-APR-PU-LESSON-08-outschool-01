export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const IS_SERVER = typeof window === 'undefined';

export function storeTokens(tokens: AuthTokens): void {
  if (IS_SERVER) return;
  localStorage.setItem('accessToken', tokens.accessToken);
  localStorage.setItem('refreshToken', tokens.refreshToken);
}

export function getStoredTokens(): AuthTokens | null {
  if (IS_SERVER) return null;
  const accessToken = localStorage.getItem('accessToken');
  const refreshToken = localStorage.getItem('refreshToken');
  if (!accessToken || !refreshToken) return null;
  return { accessToken, refreshToken };
}

export function clearTokens(): void {
  if (IS_SERVER) return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export function isAuthenticated(): boolean {
  return getStoredTokens() !== null;
}

export function getAccessToken(): string | null {
  if (IS_SERVER) return null;
  return localStorage.getItem('accessToken');
}
