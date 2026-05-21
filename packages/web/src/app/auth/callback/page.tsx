'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { storeTokens } from '@/lib/auth';

/**
 * OAuth callback page.
 * The backend redirects here after VK/Yandex OAuth with
 * ?accessToken=...&refreshToken=... query params.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (accessToken && refreshToken) {
      storeTokens({ accessToken, refreshToken });
      router.replace('/classes');
    } else {
      router.replace('/login?error=oauth_failed');
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        <p className="mt-4 text-gray-600">Авторизация...</p>
      </div>
    </div>
  );
}
