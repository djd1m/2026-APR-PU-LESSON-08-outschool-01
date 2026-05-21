'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { clearTokens, storeTokens, isAuthenticated } from '@/lib/auth';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'PARENT' | 'TEACHER' | 'CHILD' | 'ADMIN';
  avatarUrl?: string;
  phone?: string;
}

interface UseAuthReturn {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refetch: () => void;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(() => {
    if (!isAuthenticated()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    apiFetch<User>('/auth/me')
      .then(setUser)
      .catch(() => {
        clearTokens();
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        user: User;
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      storeTokens({
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
      setUser(res.user);
    },
    [],
  );

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    window.location.href = '/';
  }, []);

  return {
    user,
    isAuthenticated: user !== null,
    isLoading,
    login,
    logout,
    refetch: fetchUser,
  };
}
