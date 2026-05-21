'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

type TabId = 'schedule' | 'progress' | 'payments' | 'children';

interface BookingItem {
  id: string;
  classId: string;
  classTitle: string;
  sectionId: string;
  teacherName: string;
  nextSession: string;
  nextSessionEnd: string;
  status: 'upcoming' | 'completed' | 'cancelled';
}

interface DashboardData {
  upcomingClasses: BookingItem[];
  totalSpent: number;
  childrenCount: number;
}

const tabs: { id: TabId; label: string }[] = [
  { id: 'schedule', label: 'Расписание' },
  { id: 'progress', label: 'Прогресс' },
  { id: 'payments', label: 'Платежи' },
  { id: 'children', label: 'Дети' },
];

const statusLabel: Record<string, string> = {
  upcoming: 'Предстоит',
  completed: 'Завершено',
  cancelled: 'Отменено',
};

const statusVariant: Record<string, 'primary' | 'secondary'> = {
  upcoming: 'primary',
  completed: 'secondary',
  cancelled: 'secondary',
};

function isClassroomAvailable(nextSession: string): boolean {
  const startTime = new Date(nextSession).getTime();
  const now = Date.now();
  // Button appears 15 minutes before start
  return startTime - now <= 15 * 60 * 1000;
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('schedule');
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    apiFetch<DashboardData>('/users/dashboard')
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setIsLoading(false));
  }, [user]);

  if (authLoading) {
    return (
      <div className="container-page py-16 text-center text-gray-500">
        Загрузка...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Войдите в аккаунт</h1>
        <p className="mt-2 text-gray-600">
          Чтобы видеть ваши записи, необходимо авторизоваться.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors"
        >
          Войти
        </Link>
      </div>
    );
  }

  const paymentStatusLabel: Record<string, string> = {
    PENDING: 'Ожидание',
    PROCESSING: 'Обработка',
    COMPLETED: 'Оплачено',
    REFUNDED: 'Возврат',
  };

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold text-gray-900">
        Привет, {user.name}!
      </h1>
      <p className="mt-2 text-gray-600">Личный кабинет родителя</p>

      {/* Summary cards */}
      {data && (
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5 text-center">
            <p className="text-2xl font-bold text-gray-900">{(data.upcomingClasses || []).length}</p>
            <p className="mt-1 text-sm text-gray-500">Предстоящих занятий</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {(data.totalSpent ?? 0).toLocaleString('ru-RU')} &#8381;
            </p>
            <p className="mt-1 text-sm text-gray-500">Потрачено</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-2xl font-bold text-gray-900">{data.childrenCount ?? 0}</p>
            <p className="mt-1 text-sm text-gray-500">Детей</p>
          </Card>
        </div>
      )}

      {/* Tab navigation */}
      <div className="mt-8 border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-gray-100"
              />
            ))}
          </div>
        ) : !data ? (
          <Card className="p-8 text-center">
            <p className="text-gray-500">Не удалось загрузить данные</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {(data.upcomingClasses || []).length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-gray-500">Нет предстоящих занятий</p>
                <Link href="/classes" className="mt-2 inline-block text-primary-600 hover:underline text-sm">
                  Перейти в каталог
                </Link>
              </Card>
            ) : (data.upcomingClasses || []).map((booking) => (
              <Card key={booking.id} className="flex items-center justify-between p-5">
                <div>
                  <Link
                    href={`/classes/${booking.classId}`}
                    className="text-lg font-semibold text-gray-900 hover:text-primary-600"
                  >
                    {booking.classTitle}
                  </Link>
                  <p className="mt-1 text-sm text-gray-500">
                    {booking.teacherName}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {booking.status === 'upcoming' && isClassroomAvailable(booking.nextSession) && (
                    <Link
                      href={`/classroom/${booking.sectionId}`}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                    >
                      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                      Войти в класс
                    </Link>
                  )}
                  <div className="text-right">
                    <Badge variant={statusVariant[booking.status] || 'secondary'}>
                      {statusLabel[booking.status] || booking.status}
                    </Badge>
                    <p className="mt-1 text-sm text-gray-500">
                      {new Date(booking.nextSession).toLocaleDateString('ru-RU', {
                        day: 'numeric',
                        month: 'long',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
