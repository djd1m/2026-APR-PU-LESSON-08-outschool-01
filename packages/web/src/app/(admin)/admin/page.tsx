'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

interface AdminStats {
  totalUsers: number;
  totalTeachers: number;
  totalClasses: number;
  totalBookings: number;
  revenue: number;
}

export default function AdminDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    apiFetch<AdminStats>('/admin/stats')
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setIsLoading(false));
  }, [user]);

  if (authLoading) {
    return (
      <div className="container-page py-16 text-center text-gray-500">
        Загрузка...
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Доступ запрещён</h1>
        <p className="mt-2 text-gray-600">
          Эта страница доступна только администраторам.
        </p>
      </div>
    );
  }

  const statCards = stats
    ? [
        { label: 'Пользователей', value: stats.totalUsers },
        { label: 'Преподавателей', value: stats.totalTeachers },
        { label: 'Классов', value: stats.totalClasses },
        { label: 'Бронирований', value: stats.totalBookings },
        {
          label: 'Выручка',
          value: `${stats.revenue.toLocaleString('ru-RU')} \u20BD`,
        },
      ]
    : [];

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold text-gray-900">
        Панель администратора
      </h1>
      <p className="mt-2 text-gray-600">Обзор платформы</p>

      {isLoading ? (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-gray-100"
            />
          ))}
        </div>
      ) : stats ? (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {statCards.map((card) => (
            <Card key={card.label} className="p-5 text-center">
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="mt-1 text-sm text-gray-500">{card.label}</p>
            </Card>
          ))}
        </div>
      ) : (
        <div className="mt-8 text-center text-gray-500">
          Не удалось загрузить статистику
        </div>
      )}
    </div>
  );
}
