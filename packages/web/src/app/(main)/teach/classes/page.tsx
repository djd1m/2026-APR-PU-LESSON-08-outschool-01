'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface TeacherClass {
  id: string;
  title: string;
  subject: string;
  price: number;
  ageMin: number;
  ageMax: number;
  maxStudents: number;
  status: 'DRAFT' | 'PENDING_REVIEW' | 'PUBLISHED' | 'ARCHIVED';
  slug: string;
  imageUrl: string | null;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    enrollments?: number;
  };
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  PENDING_REVIEW: 'На модерации',
  PUBLISHED: 'Опубликован',
  ARCHIVED: 'В архиве',
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  PENDING_REVIEW: 'bg-yellow-50 text-yellow-700',
  PUBLISHED: 'bg-green-50 text-green-700',
  ARCHIVED: 'bg-red-50 text-red-700',
};

export default function TeacherClassesPage() {
  const { user } = useAuth();
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchClasses = useCallback(() => {
    setIsLoading(true);
    apiFetch<{ items: TeacherClass[] }>('/classes/my')
      .then((res) => setClasses(res.items))
      .catch(() => setClasses([]))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (user?.role === 'teacher') {
      fetchClasses();
    }
  }, [user, fetchClasses]);

  async function handleDelete(id: string) {
    if (!confirm('Удалить черновик? Это действие нельзя отменить.')) return;

    setActionLoading(id);
    try {
      await apiFetch(`/classes/${id}`, { method: 'DELETE' });
      setClasses((prev) => prev.filter((c) => c.id !== id));
    } catch (err: any) {
      alert(err.message || 'Ошибка при удалении');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSubmit(id: string) {
    setActionLoading(id);
    try {
      await apiFetch(`/classes/${id}/submit`, { method: 'POST' });
      fetchClasses();
    } catch (err: any) {
      alert(err.message || 'Ошибка при отправке на модерацию');
    } finally {
      setActionLoading(null);
    }
  }

  if (!user || user.role !== 'teacher') {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Доступ ограничен</h1>
        <p className="mt-2 text-gray-600">
          Только учителя могут управлять занятиями
        </p>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Мои занятия</h1>
          <p className="mt-2 text-gray-600">
            Управляйте вашими занятиями и отслеживайте их статус
          </p>
        </div>
        <Link href="/teach/create">
          <Button>Создать занятие</Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="mt-8 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl bg-gray-100"
            />
          ))}
        </div>
      ) : classes.length === 0 ? (
        <div className="mt-16 text-center">
          <div className="text-5xl text-gray-200">&#128218;</div>
          <h2 className="mt-4 text-xl font-semibold text-gray-900">
            У вас пока нет занятий
          </h2>
          <p className="mt-2 text-gray-600">
            Создайте первое занятие, чтобы начать преподавать
          </p>
          <Link href="/teach/create" className="mt-6 inline-block">
            <Button size="lg">Создать первое занятие</Button>
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {classes.map((cls) => (
            <Card key={cls.id} className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                {/* Image thumbnail */}
                <div className="w-full sm:w-32 h-20 rounded-lg bg-gray-100 overflow-hidden shrink-0">
                  {cls.imageUrl ? (
                    <img
                      src={cls.imageUrl}
                      alt={cls.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-gray-300 text-2xl">
                      &#128218;
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-base font-semibold text-gray-900 truncate">
                      {cls.title}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[cls.status] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {STATUS_LABELS[cls.status] || cls.status}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-4 text-sm text-gray-500">
                    <span>{cls.subject}</span>
                    <span>{cls.ageMin}-{cls.ageMax} лет</span>
                    <span>{Number(cls.price).toLocaleString('ru-RU')} &#8381;</span>
                    <span>до {cls.maxStudents} уч.</span>
                  </div>

                  {cls.rejectionReason && cls.status === 'DRAFT' && (
                    <div className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                      Причина отклонения: {cls.rejectionReason}
                    </div>
                  )}

                  <div className="mt-2 text-xs text-gray-400">
                    Обновлено:{' '}
                    {new Date(cls.updatedAt).toLocaleDateString('ru-RU', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  {cls.status === 'DRAFT' && (
                    <>
                      <Link href={`/classes/${cls.id}`}>
                        <Button variant="outline" size="sm">
                          Редактировать
                        </Button>
                      </Link>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleSubmit(cls.id)}
                        disabled={actionLoading === cls.id}
                      >
                        {actionLoading === cls.id
                          ? 'Отправка...'
                          : 'На модерацию'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => handleDelete(cls.id)}
                        disabled={actionLoading === cls.id}
                      >
                        Удалить
                      </Button>
                    </>
                  )}

                  {cls.status === 'PENDING_REVIEW' && (
                    <Badge variant="secondary">Ожидает проверки</Badge>
                  )}

                  {cls.status === 'PUBLISHED' && (
                    <Link href={`/classes/${cls.id}`}>
                      <Button variant="outline" size="sm">
                        Посмотреть
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
