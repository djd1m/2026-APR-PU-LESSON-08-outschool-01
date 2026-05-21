'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { storeTokens } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(
    searchParams.get('error') === 'oauth_failed'
      ? 'Ошибка авторизации через внешний сервис'
      : null,
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Client-side validation
    if (!email.trim()) {
      setError('Введите email');
      setIsLoading(false);
      return;
    }
    if (password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов');
      setIsLoading(false);
      return;
    }

    try {
      const result = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string; name: string; role: string };
      }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      storeTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      router.push('/classes');
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Неверный email или пароль',
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold text-primary-600">
            КлассМаркет
          </Link>
          <h1 className="mt-6 text-3xl font-bold text-gray-900">Вход</h1>
          <p className="mt-2 text-sm text-gray-600">
            Нет аккаунта?{' '}
            <Link href="/register" className="text-primary-600 hover:underline">
              Зарегистрируйтесь
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <Input
              label="Пароль"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              minLength={8}
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Вход...' : 'Войти'}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-gray-50 px-4 text-gray-500">
                или войдите через
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <a
              href={`${API_URL}/auth/vk`}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="text-blue-600 font-bold">VK</span>
              VK ID
            </a>
            <a
              href={`${API_URL}/auth/yandex`}
              className="flex items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <span className="text-red-500 font-bold">Я</span>
              Яндекс ID
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}
