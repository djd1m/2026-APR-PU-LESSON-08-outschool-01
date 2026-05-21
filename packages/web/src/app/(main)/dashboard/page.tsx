'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

interface Booking {
  id: string;
  classTitle: string;
  classId: string;
  teacherName: string;
  nextSession: string;
  status: 'upcoming' | 'completed' | 'cancelled';
}

export default function DashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    apiFetch<{ data: Booking[] }>('/bookings/my')
      .then((res) => setBookings(res.data))
      .catch(() => setBookings([]))
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

  const statusLabel: Record<Booking['status'], string> = {
    upcoming: 'Предстоит',
    completed: 'Завершено',
    cancelled: 'Отменено',
  };

  const statusVariant: Record<Booking['status'], 'primary' | 'secondary'> = {
    upcoming: 'primary',
    completed: 'secondary',
    cancelled: 'secondary',
  };

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold text-gray-900">
        Привет, {user.name}!
      </h1>
      <p className="mt-2 text-gray-600">Ваши записи на занятия</p>

      <div className="mt-8">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-gray-100"
              />
            ))}
          </div>
        ) : bookings.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-lg text-gray-500">У вас пока нет записей</p>
            <Link
              href="/classes"
              className="mt-4 inline-block text-primary-600 hover:underline"
            >
              Посмотреть каталог занятий
            </Link>
          </Card>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => (
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
                <div className="text-right">
                  <Badge variant={statusVariant[booking.status]}>
                    {statusLabel[booking.status]}
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
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
