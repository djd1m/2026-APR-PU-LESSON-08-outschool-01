'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

type TabId = 'schedule' | 'progress' | 'payments' | 'children';

interface UpcomingClass {
  enrollmentId: string;
  classId: string;
  classTitle: string;
  teacherName: string;
  childName: string;
  startTime: string;
  endTime: string;
  status: string;
}

interface ChildProgress {
  child: { id: string; name: string; birthDate: string };
  classesAttended: number;
  totalClasses: number;
  subjects: string[];
  hoursSpent: number;
}

interface PaymentRecord {
  id: string;
  date: string;
  className: string;
  childName: string;
  amount: number;
  status: string;
}

interface ChildData {
  id: string;
  name: string;
  birthDate: string;
  avatarUrl?: string;
}

interface DashboardData {
  user: { id: string; name: string; email: string };
  children: ChildData[];
  upcomingClasses: UpcomingClass[];
  totalSpent: number;
  childrenCount: number;
  childProgress: ChildProgress[];
  paymentHistory: PaymentRecord[];
}

const tabs: { id: TabId; label: string }[] = [
  { id: 'schedule', label: 'Расписание' },
  { id: 'progress', label: 'Прогресс' },
  { id: 'payments', label: 'Платежи' },
  { id: 'children', label: 'Дети' },
];

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
            <p className="text-2xl font-bold text-gray-900">{data.upcomingClasses.length}</p>
            <p className="mt-1 text-sm text-gray-500">Предстоящих занятий</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-2xl font-bold text-gray-900">
              {data.totalSpent.toLocaleString('ru-RU')} &#8381;
            </p>
            <p className="mt-1 text-sm text-gray-500">Потрачено</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-2xl font-bold text-gray-900">{data.childrenCount}</p>
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
          <>
            {/* Schedule tab */}
            {activeTab === 'schedule' && (
              <div>
                {data.upcomingClasses.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-lg text-gray-500">Нет предстоящих занятий</p>
                    <Link
                      href="/classes"
                      className="mt-4 inline-block text-primary-600 hover:underline"
                    >
                      Посмотреть каталог занятий
                    </Link>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {data.upcomingClasses.map((cls) => (
                      <Card key={cls.enrollmentId} className="flex items-center justify-between p-5">
                        <div>
                          <Link
                            href={`/classes/${cls.classId}`}
                            className="text-lg font-semibold text-gray-900 hover:text-primary-600"
                          >
                            {cls.classTitle}
                          </Link>
                          <p className="mt-1 text-sm text-gray-500">
                            {cls.teacherName} &middot; {cls.childName}
                          </p>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900">
                              {new Date(cls.startTime).toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                              })}
                            </p>
                            <p className="text-sm text-gray-500">
                              {new Date(cls.startTime).toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                          <Button size="sm">Войти в класс</Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Progress tab */}
            {activeTab === 'progress' && (
              <div className="space-y-6">
                {data.childProgress.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-gray-500">Нет данных о прогрессе</p>
                  </Card>
                ) : (
                  data.childProgress.map((cp) => (
                    <Card key={cp.child.id} className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {cp.child.name}
                      </h3>
                      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div>
                          <p className="text-2xl font-bold text-primary-600">
                            {cp.classesAttended}
                          </p>
                          <p className="text-sm text-gray-500">Посещено занятий</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            {cp.totalClasses}
                          </p>
                          <p className="text-sm text-gray-500">Всего записей</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            {cp.subjects.length}
                          </p>
                          <p className="text-sm text-gray-500">Предметов</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-gray-900">
                            {cp.hoursSpent}
                          </p>
                          <p className="text-sm text-gray-500">Часов</p>
                        </div>
                      </div>
                      {cp.subjects.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-2">
                          {cp.subjects.map((s) => (
                            <Badge key={s} variant="primary">{s}</Badge>
                          ))}
                        </div>
                      )}
                    </Card>
                  ))
                )}
              </div>
            )}

            {/* Payments tab */}
            {activeTab === 'payments' && (
              <div>
                {data.paymentHistory.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-gray-500">Нет истории платежей</p>
                  </Card>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-500">
                          <th className="pb-3 font-medium">Дата</th>
                          <th className="pb-3 font-medium">Занятие</th>
                          <th className="pb-3 font-medium">Ребенок</th>
                          <th className="pb-3 font-medium text-right">Сумма</th>
                          <th className="pb-3 font-medium text-right">Статус</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.paymentHistory.map((payment) => (
                          <tr key={payment.id} className="border-b border-gray-100">
                            <td className="py-3 text-gray-900">
                              {new Date(payment.date).toLocaleDateString('ru-RU')}
                            </td>
                            <td className="py-3 text-gray-900">{payment.className}</td>
                            <td className="py-3 text-gray-500">{payment.childName}</td>
                            <td className="py-3 text-right font-medium text-gray-900">
                              {payment.amount.toLocaleString('ru-RU')} &#8381;
                            </td>
                            <td className="py-3 text-right">
                              <Badge variant={payment.status === 'COMPLETED' ? 'primary' : 'secondary'}>
                                {paymentStatusLabel[payment.status] || payment.status}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Children tab */}
            {activeTab === 'children' && (
              <div className="space-y-4">
                {data.children.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-gray-500">Вы еще не добавили детей</p>
                  </Card>
                ) : (
                  data.children.map((child) => (
                    <Card key={child.id} className="flex items-center justify-between p-5">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg">
                          {child.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{child.name}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(child.birthDate).toLocaleDateString('ru-RU')}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm">
                        Редактировать
                      </Button>
                    </Card>
                  ))
                )}
                <Button variant="secondary" className="w-full">
                  + Добавить ребенка
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
