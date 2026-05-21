'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { storeTokens } from '@/lib/auth';
import { apiFetch } from '@/lib/api';

type Role = 'PARENT' | 'TEACHER';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<Role>('PARENT');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    // Client-side validation
    if (name.trim().length < 2) {
      setError('Имя должно содержать минимум 2 символа');
      setIsLoading(false);
      return;
    }

    if (password.length < 8) {
      setError('Пароль должен содержать минимум 8 символов');
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      setIsLoading(false);
      return;
    }

    if (!termsAccepted) {
      setError('Необходимо принять условия использования');
      setIsLoading(false);
      return;
    }

    try {
      const result = await apiFetch<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string; name: string; role: string };
      }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, role }),
      });

      storeTokens({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });

      // Redirect to onboarding based on role
      if (role === 'TEACHER') {
        router.push('/onboarding/teacher');
      } else {
        router.push('/onboarding/parent');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка регистрации');
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
          <h1 className="mt-6 text-3xl font-bold text-gray-900">
            Регистрация
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Уже есть аккаунт?{' '}
            <Link href="/login" className="text-primary-600 hover:underline">
              Войдите
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Role selector */}
          <div className="flex rounded-lg border border-gray-200 p-1">
            <button
              type="button"
              onClick={() => setRole('PARENT')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                role === 'PARENT'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Родитель
            </button>
            <button
              type="button"
              onClick={() => setRole('TEACHER')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                role === 'TEACHER'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Преподаватель
            </button>
          </div>

          <div className="space-y-4">
            <Input
              label="Имя"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ваше имя"
              required
              minLength={2}
              maxLength={100}
              autoComplete="name"
            />
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
              placeholder="Минимум 8 символов"
              minLength={8}
              maxLength={100}
              required
              autoComplete="new-password"
            />
            <Input
              label="Подтвердите пароль"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите пароль"
              minLength={8}
              maxLength={100}
              required
              autoComplete="new-password"
            />
          </div>

          {/* Terms acceptance checkbox */}
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-xs text-gray-500">
              Я соглашаюсь с{' '}
              <a href="/terms" className="underline text-primary-600">
                условиями использования
              </a>{' '}
              и{' '}
              <a href="/privacy" className="underline text-primary-600">
                политикой конфиденциальности
              </a>
            </span>
          </label>

          <Button
            type="submit"
            className="w-full"
            disabled={isLoading || !termsAccepted}
          >
            {isLoading ? 'Регистрация...' : 'Создать аккаунт'}
          </Button>
        </form>
      </div>
    </div>
  );
}
