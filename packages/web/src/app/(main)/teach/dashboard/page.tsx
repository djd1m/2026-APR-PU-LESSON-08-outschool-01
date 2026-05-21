'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

interface UpcomingSection {
  sectionId: string;
  classId: string;
  classTitle: string;
  startTime: string;
  endTime: string;
  enrolledCount: number;
  maxStudents: number;
}

interface RecentReview {
  id: string;
  rating: number;
  comment?: string;
  childName: string;
  className: string;
  createdAt: string;
}

interface TeacherDashboardData {
  teacher: {
    id: string;
    name: string;
    rating: number;
    reviewCount: number;
    verified: boolean;
  };
  totalEarned: number;
  studentsThisMonth: number;
  avgRating: number;
  activeClassesCount: number;
  totalClassesCount: number;
  upcomingSections: UpcomingSection[];
  recentReviews: RecentReview[];
}

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

export default function TeacherDashboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [data, setData] = useState<TeacherDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'TEACHER') return;

    apiFetch<TeacherDashboardData>('/users/teacher/dashboard')
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

  if (!user || user.role !== 'TEACHER') {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Доступ запрещен</h1>
        <p className="mt-2 text-gray-600">
          Эта страница доступна только преподавателям.
        </p>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Панель преподавателя
          </h1>
          <p className="mt-2 text-gray-600">
            Добро пожаловать, {user.name}
            {data?.teacher?.verified && (
              <Badge variant="primary" className="ml-2">Верифицирован</Badge>
            )}
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : !data ? (
        <div className="mt-8 text-center text-gray-500">
          Не удалось загрузить данные
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-5 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {(data.totalEarned ?? 0).toLocaleString('ru-RU')} &#8381;
              </p>
              <p className="mt-1 text-sm text-gray-500">Всего заработано</p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {data.studentsThisMonth}
              </p>
              <p className="mt-1 text-sm text-gray-500">Учеников в этом месяце</p>
            </Card>
            <Card className="p-5 text-center">
              <div className="flex items-center justify-center gap-2">
                <StarRating rating={data.avgRating} />
                <span className="text-2xl font-bold text-gray-900">
                  {(data.avgRating ?? 0).toFixed(1)}
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Средняя оценка ({data.teacher?.reviewCount ?? 0} отзывов)
              </p>
            </Card>
            <Card className="p-5 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {data.activeClassesCount}
              </p>
              <p className="mt-1 text-sm text-gray-500">Активных занятий</p>
            </Card>
          </div>

          {/* Quick links */}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/classes/create">
              <Button>Создать занятие</Button>
            </Link>
            <Link href="/teach/schedule">
              <Button variant="outline">Управление расписанием</Button>
            </Link>
            <Link href="/teach/earnings">
              <Button variant="outline">Доходы</Button>
            </Link>
          </div>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Upcoming sections */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Ближайшие занятия
              </h2>
              {data.upcomingSections.length === 0 ? (
                <Card className="mt-4 p-6 text-center">
                  <p className="text-gray-500">Нет запланированных занятий</p>
                </Card>
              ) : (
                <div className="mt-4 space-y-3">
                  {data.upcomingSections.map((section) => (
                    <Card key={section.sectionId} className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Link
                            href={`/classes/${section.classId}`}
                            className="font-medium text-gray-900 hover:text-primary-600"
                          >
                            {section.classTitle}
                          </Link>
                          <p className="mt-1 text-sm text-gray-500">
                            {new Date(section.startTime).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'long',
                            })}{' '}
                            {new Date(section.startTime).toLocaleTimeString('ru-RU', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <Badge variant="secondary">
                          {section.enrolledCount}/{section.maxStudents}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Recent reviews */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Последние отзывы
              </h2>
              {data.recentReviews.length === 0 ? (
                <Card className="mt-4 p-6 text-center">
                  <p className="text-gray-500">Пока нет отзывов</p>
                </Card>
              ) : (
                <div className="mt-4 space-y-3">
                  {data.recentReviews.map((review) => (
                    <Card key={review.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">
                          {review.childName}
                        </span>
                        <StarRating rating={review.rating} />
                      </div>
                      <p className="mt-1 text-xs text-gray-400">
                        {review.className}
                      </p>
                      {review.comment && (
                        <p className="mt-2 text-sm text-gray-600">
                          {review.comment}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-gray-400">
                        {new Date(review.createdAt).toLocaleDateString('ru-RU')}
                      </p>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
