'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

export function Navbar() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        {/* Logo */}
        <Link href="/" className="text-xl font-bold text-primary-600">
          КлассМаркет
        </Link>

        {/* Center nav */}
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/classes"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Каталог
          </Link>
          <Link
            href="/teachers"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Преподаватели
          </Link>
          <Link
            href="/register"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Для учителей
          </Link>
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
              >
                Мои занятия
              </Link>
              <Link
                href="/profile"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-medium text-primary-700"
              >
                {user.name.charAt(0).toUpperCase()}
              </Link>
              <button
                onClick={logout}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Выйти
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
            >
              Войти
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
