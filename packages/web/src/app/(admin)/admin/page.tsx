'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

type TabId = 'moderation' | 'teachers' | 'reviews' | 'analytics';

interface AdminStats {
  totalUsers: number;
  totalTeachers: number;
  totalStudents: number;
  totalClasses: number;
  totalBookings: number;
  gmv: number;
  mau: number;
  revenue: number;
}

interface PendingClass {
  id: string;
  title: string;
  subject: string;
  status: string;
  createdAt: string;
  teacher: {
    id: string;
    bio: string;
    user: { name: string; email: string };
  };
}

interface TeacherItem {
  id: string;
  bio: string;
  education: string;
  subjects: string[];
  rating: number;
  reviewCount: number;
  verified: boolean;
  user: { name: string; email: string };
}

interface FlaggedReview {
  id: string;
  rating: number;
  comment?: string;
  flagged: boolean;
  flagReason?: string;
  createdAt: string;
  enrollment: {
    child: { name: string };
    section: { class: { title: string } };
  };
}

const tabs: { id: TabId; label: string }[] = [
  { id: 'moderation', label: 'Модерация' },
  { id: 'teachers', label: 'Учителя' },
  { id: 'reviews', label: 'Отзывы' },
  { id: 'analytics', label: 'Аналитика' },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`text-sm ${i < Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`}
        >
          &#9733;
        </span>
      ))}
    </span>
  );
}

export default function AdminDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('moderation');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pendingClasses, setPendingClasses] = useState<PendingClass[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [flaggedReviews, setFlaggedReviews] = useState<FlaggedReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!user || user.role !== 'admin') return;
    setIsLoading(true);

    try {
      const [statsRes, pendingRes, flaggedRes, teachersRes] = await Promise.all([
        apiFetch<AdminStats>('/admin/stats'),
        apiFetch<{ items: PendingClass[] }>('/admin/pending-classes'),
        apiFetch<{ items: FlaggedReview[] }>('/admin/flagged-reviews'),
        apiFetch<{ items: TeacherItem[] }>('/users?role=teacher&perPage=100').catch(() => ({ items: [] })),
      ]);

      setStats(statsRes);
      setPendingClasses(pendingRes.items || []);
      setFlaggedReviews(flaggedRes.items || []);
      setTeachers(teachersRes.items || []);
    } catch {
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApproveClass = async (id: string) => {
    await apiFetch(`/admin/classes/${id}/approve`, { method: 'POST' });
    setPendingClasses((prev) => prev.filter((c) => c.id !== id));
  };

  const handleRejectClass = async (id: string) => {
    await apiFetch(`/admin/classes/${id}/reject`, { method: 'POST' });
    setPendingClasses((prev) => prev.filter((c) => c.id !== id));
  };

  const handleVerifyTeacher = async (id: string) => {
    await apiFetch(`/admin/teachers/${id}/verify`, { method: 'POST' });
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, verified: true } : t)),
    );
  };

  const handleRejectTeacher = async (id: string) => {
    await apiFetch(`/admin/teachers/${id}/reject`, { method: 'POST' });
    setTeachers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, verified: false } : t)),
    );
  };

  const handleDeleteReview = async (id: string) => {
    await apiFetch(`/reviews/${id}`, { method: 'DELETE' });
    setFlaggedReviews((prev) => prev.filter((r) => r.id !== id));
  };

  const handleApproveReview = async (id: string) => {
    // Unflag the review (approve it)
    await apiFetch(`/reviews/${id}/flag`, {
      method: 'POST',
      body: JSON.stringify({ unflag: true }),
    }).catch(() => {});
    setFlaggedReviews((prev) => prev.filter((r) => r.id !== id));
  };

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
        <h1 className="text-2xl font-bold text-gray-900">Доступ запрещен</h1>
        <p className="mt-2 text-gray-600">
          Эта страница доступна только администраторам.
        </p>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold text-gray-900">
        Панель администратора
      </h1>
      <p className="mt-2 text-gray-600">Управление платформой</p>

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
              {tab.id === 'moderation' && pendingClasses.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {pendingClasses.length}
                </span>
              )}
              {tab.id === 'reviews' && flaggedReviews.length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {flaggedReviews.length}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-2xl bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <>
            {/* Moderation tab */}
            {activeTab === 'moderation' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Занятия на модерации
                </h2>
                {pendingClasses.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-gray-500">Нет занятий на модерации</p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {pendingClasses.map((cls) => (
                      <Card key={cls.id} className="p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {cls.title}
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                              {cls.teacher.user.name} &middot; {cls.subject}
                            </p>
                            <p className="text-xs text-gray-400">
                              {new Date(cls.createdAt).toLocaleDateString('ru-RU')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleApproveClass(cls.id)}
                            >
                              Одобрить
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRejectClass(cls.id)}
                            >
                              Отклонить
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Teachers tab */}
            {activeTab === 'teachers' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Преподаватели
                </h2>
                {teachers.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-gray-500">Нет преподавателей</p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {teachers.map((teacher) => (
                      <Card key={teacher.id} className="p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-gray-900">
                                {teacher.user.name}
                              </h3>
                              {teacher.verified ? (
                                <Badge variant="primary">Верифицирован</Badge>
                              ) : (
                                <Badge variant="secondary">Не верифицирован</Badge>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-gray-500">
                              {teacher.user.email}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <StarRating rating={teacher.rating} />
                              <span className="text-xs text-gray-400">
                                ({teacher.reviewCount} отзывов)
                              </span>
                            </div>
                            {teacher.subjects.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {teacher.subjects.map((s) => (
                                  <Badge key={s} variant="secondary" className="text-xs">
                                    {s}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {!teacher.verified && (
                              <Button
                                size="sm"
                                onClick={() => handleVerifyTeacher(teacher.id)}
                              >
                                Верифицировать
                              </Button>
                            )}
                            {teacher.verified && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectTeacher(teacher.id)}
                              >
                                Отозвать
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Reviews tab */}
            {activeTab === 'reviews' && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Отмеченные отзывы
                </h2>
                {flaggedReviews.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-gray-500">Нет отмеченных отзывов</p>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {flaggedReviews.map((review) => (
                      <Card key={review.id} className="p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-gray-900">
                                {review.enrollment.child.name}
                              </span>
                              <StarRating rating={review.rating} />
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                              {review.enrollment.section.class.title}
                            </p>
                            {review.comment && (
                              <p className="mt-2 text-sm text-gray-600">
                                {review.comment}
                              </p>
                            )}
                            {review.flagReason && (
                              <p className="mt-2 text-sm text-red-600">
                                Причина: {review.flagReason}
                              </p>
                            )}
                            <p className="mt-2 text-xs text-gray-400">
                              {new Date(review.createdAt).toLocaleDateString('ru-RU')}
                            </p>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproveReview(review.id)}
                            >
                              Одобрить
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDeleteReview(review.id)}
                            >
                              Удалить
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Analytics tab */}
            {activeTab === 'analytics' && stats && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
                  Ключевые метрики
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                  <Card className="p-5 text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.gmv.toLocaleString('ru-RU')} &#8381;
                    </p>
                    <p className="mt-1 text-sm text-gray-500">GMV</p>
                  </Card>
                  <Card className="p-5 text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.mau.toLocaleString('ru-RU')}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">MAU</p>
                  </Card>
                  <Card className="p-5 text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalClasses}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">Классов</p>
                  </Card>
                  <Card className="p-5 text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalTeachers}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">Преподавателей</p>
                  </Card>
                  <Card className="p-5 text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalStudents}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">Учеников</p>
                  </Card>
                </div>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="p-5 text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalUsers}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">Пользователей</p>
                  </Card>
                  <Card className="p-5 text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.totalBookings}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">Бронирований</p>
                  </Card>
                  <Card className="p-5 text-center">
                    <p className="text-2xl font-bold text-gray-900">
                      {stats.revenue.toLocaleString('ru-RU')} &#8381;
                    </p>
                    <p className="mt-1 text-sm text-gray-500">Выручка</p>
                  </Card>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
