'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';

interface Enrollment {
  id: string;
  status: string;
  isTrial: boolean;
  enrolledAt: string;
  cancelledAt: string | null;
  child: {
    id: string;
    name: string;
  };
  section: {
    id: string;
    startTime: string;
    endTime: string;
    class: {
      id: string;
      title: string;
      subject: string;
      teacher: {
        user: {
          name: string;
        };
      };
    };
  };
}

interface EnrollmentsResponse {
  items: Enrollment[];
  meta: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

const statusLabels: Record<string, string> = {
  PENDING: 'Ожидает оплаты',
  CONFIRMED: 'Подтверждено',
  ACTIVE: 'Активно',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено',
  REFUNDED: 'Возврат',
};

const statusColors: Record<string, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700',
  CONFIRMED: 'bg-green-50 text-green-700',
  ACTIVE: 'bg-blue-50 text-blue-700',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-50 text-red-600',
  REFUNDED: 'bg-orange-50 text-orange-600',
};

function isUpcoming(enrollment: Enrollment): boolean {
  const now = new Date();
  const sectionStart = new Date(enrollment.section.startTime);
  return (
    sectionStart > now &&
    enrollment.status !== 'CANCELLED' &&
    enrollment.status !== 'REFUNDED' &&
    enrollment.status !== 'COMPLETED'
  );
}

export default function BookingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchEnrollments = useCallback(async () => {
    try {
      const res = await apiFetch<EnrollmentsResponse>('/enrollments');
      setEnrollments(res.items);
    } catch {
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchEnrollments();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [user, authLoading, fetchEnrollments]);

  const handleCancel = async (enrollmentId: string) => {
    if (!confirm('Вы уверены, что хотите отменить запись?')) return;

    setCancellingId(enrollmentId);
    try {
      await apiFetch(`/enrollments/${enrollmentId}`, { method: 'DELETE' });
      await fetchEnrollments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка при отмене';
      alert(message);
    } finally {
      setCancellingId(null);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('ru-RU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!authLoading && !user) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Мои записи</h1>
        <p className="mt-2 text-gray-600">
          Войдите в аккаунт, чтобы увидеть свои записи.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          Войти
        </Link>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container-page py-16 text-center">
        <p className="text-gray-500">Загрузка...</p>
      </div>
    );
  }

  const upcoming = enrollments.filter(isUpcoming);
  const past = enrollments.filter((e) => !isUpcoming(e));

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold text-gray-900">Мои записи</h1>

      {enrollments.length === 0 ? (
        <div className="mt-8 text-center">
          <p className="text-gray-500">У вас пока нет записей.</p>
          <Link
            href="/classes"
            className="mt-4 inline-block text-primary-600 hover:underline"
          >
            Перейти в каталог
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-10">
          {/* Upcoming */}
          {upcoming.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Предстоящие
              </h2>
              <div className="space-y-4">
                {upcoming.map((enrollment) => (
                  <Card key={enrollment.id} className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/classes/${enrollment.section.class.id}`}
                            className="font-semibold text-gray-900 hover:text-primary-600"
                          >
                            {enrollment.section.class.title}
                          </Link>
                          {enrollment.isTrial && (
                            <Badge variant="primary">Пробное</Badge>
                          )}
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              statusColors[enrollment.status] || 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {statusLabels[enrollment.status] || enrollment.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {enrollment.child.name} &middot;{' '}
                          {enrollment.section.class.teacher.user.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(enrollment.section.startTime)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(enrollment.id)}
                        disabled={cancellingId === enrollment.id}
                      >
                        {cancellingId === enrollment.id
                          ? 'Отмена...'
                          : 'Отменить'}
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Past */}
          {past.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Прошедшие
              </h2>
              <div className="space-y-4">
                {past.map((enrollment) => (
                  <Card key={enrollment.id} className="p-5 opacity-75">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={`/classes/${enrollment.section.class.id}`}
                            className="font-semibold text-gray-900 hover:text-primary-600"
                          >
                            {enrollment.section.class.title}
                          </Link>
                          {enrollment.isTrial && (
                            <Badge variant="primary">Пробное</Badge>
                          )}
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              statusColors[enrollment.status] || 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {statusLabels[enrollment.status] || enrollment.status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {enrollment.child.name} &middot;{' '}
                          {enrollment.section.class.teacher.user.name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDate(enrollment.section.startTime)}
                        </p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
