'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

type TabId = 'schedule' | 'progress' | 'payments' | 'children';

interface ChildItem {
  id: string;
  name: string;
  birthDate?: string;
  interests?: string[];
}

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
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddChild, setShowAddChild] = useState(false);
  const [childName, setChildName] = useState('');
  const [childBirthDate, setChildBirthDate] = useState('');
  const [childInterests, setChildInterests] = useState<string[]>([]);

  const interestOptions = ['Математика', 'Английский', 'Программирование', 'Рисование', 'Музыка', 'Шахматы', 'Наука', 'Спорт', 'Чтение'];

  useEffect(() => {
    if (!user) return;

    Promise.all([
      apiFetch<DashboardData>('/users/dashboard').catch(() => null),
      apiFetch<ChildItem[]>('/users/children').catch(() => []),
    ]).then(([dashData, childrenData]) => {
      setData(dashData);
      setChildren(Array.isArray(childrenData) ? childrenData : []);
    }).finally(() => setIsLoading(false));
  }, [user]);

  async function handleAddChild() {
    if (!childName.trim() || !childBirthDate) return;
    try {
      const newChild = await apiFetch<ChildItem>('/users/children', {
        method: 'POST',
        body: JSON.stringify({ name: childName, birthDate: childBirthDate, interests: childInterests }),
      });
      setChildren(prev => [...prev, newChild]);
      setChildName('');
      setChildBirthDate('');
      setChildInterests([]);
      setShowAddChild(false);
    } catch (err) {
      alert('Ошибка добавления ребёнка');
    }
  }

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
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : activeTab === 'schedule' ? (
          /* Расписание */
          <div className="space-y-4">
            {(data?.upcomingClasses || []).length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-gray-500">Нет предстоящих занятий</p>
                <Link href="/classes" className="mt-2 inline-block text-primary-600 hover:underline text-sm">
                  Перейти в каталог
                </Link>
              </Card>
            ) : (data?.upcomingClasses || []).map((booking) => (
              <Card key={booking.id} className="flex items-center justify-between p-5">
                <div>
                  <Link href={`/classes/${booking.classId}`} className="text-lg font-semibold text-gray-900 hover:text-primary-600">
                    {booking.classTitle}
                  </Link>
                  <p className="mt-1 text-sm text-gray-500">{booking.teacherName}</p>
                </div>
                <div className="text-right">
                  <Badge variant={statusVariant[booking.status] || 'secondary'}>
                    {statusLabel[booking.status] || booking.status}
                  </Badge>
                </div>
              </Card>
            ))}
          </div>
        ) : activeTab === 'progress' ? (
          /* Прогресс */
          <Card className="p-8 text-center">
            <p className="text-gray-500">
              {children.length === 0
                ? 'Добавьте ребёнка во вкладке "Дети", чтобы отслеживать прогресс'
                : 'Прогресс будет доступен после посещения занятий'}
            </p>
          </Card>
        ) : activeTab === 'payments' ? (
          /* Платежи */
          <Card className="p-8 text-center">
            <p className="text-gray-500">История платежей появится после оплаты занятий</p>
          </Card>
        ) : activeTab === 'children' ? (
          /* Дети */
          <div className="space-y-4">
            {children.length === 0 && !showAddChild && (
              <Card className="p-8 text-center">
                <p className="text-lg font-medium text-gray-900">У вас пока нет добавленных детей</p>
                <p className="mt-1 text-sm text-gray-500">
                  Добавьте ребёнка, чтобы записать его на занятия
                </p>
                <Button className="mt-4" onClick={() => setShowAddChild(true)}>
                  Добавить ребёнка
                </Button>
              </Card>
            )}

            {children.map((child) => (
              <Card key={child.id} className="p-5">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-bold text-primary-700">
                    {(child.name || '?').charAt(0)}
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{child.name}</p>
                    {child.birthDate && (
                      <p className="text-sm text-gray-500">
                        Дата рождения: {new Date(child.birthDate).toLocaleDateString('ru-RU')}
                      </p>
                    )}
                    {child.interests && child.interests.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {child.interests.map((interest) => (
                          <span key={interest} className="inline-block rounded-full bg-primary-50 px-2 py-0.5 text-xs text-primary-700">
                            {interest}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}

            {children.length > 0 && !showAddChild && (
              <Button variant="outline" onClick={() => setShowAddChild(true)}>
                + Добавить ещё ребёнка
              </Button>
            )}

            {showAddChild && (
              <Card className="p-6 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Новый ребёнок</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Имя</label>
                  <input
                    type="text"
                    value={childName}
                    onChange={(e) => setChildName(e.target.value)}
                    placeholder="Как зовут ребёнка?"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Дата рождения</label>
                  <input
                    type="date"
                    value={childBirthDate}
                    onChange={(e) => setChildBirthDate(e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Интересы</label>
                  <div className="flex flex-wrap gap-2">
                    {interestOptions.map((interest) => (
                      <button
                        key={interest}
                        type="button"
                        onClick={() => setChildInterests(prev =>
                          prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
                        )}
                        className={`rounded-full px-3 py-1 text-sm transition-colors ${
                          childInterests.includes(interest)
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {interest}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button onClick={handleAddChild} disabled={!childName.trim() || !childBirthDate}>
                    Добавить
                  </Button>
                  <Button variant="outline" onClick={() => setShowAddChild(false)}>
                    Отмена
                  </Button>
                </div>
              </Card>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
