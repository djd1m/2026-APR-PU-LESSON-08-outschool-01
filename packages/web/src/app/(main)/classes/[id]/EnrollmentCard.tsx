'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { apiFetch } from '@/lib/api';
import { isAuthenticated } from '@/lib/auth';

interface Section {
  id: string;
  startTime: string;
  endTime: string;
  maxStudents: number;
  enrolledCount: number;
}

interface Child {
  id: string;
  name: string;
  birthDate?: string;
}

interface Props {
  classId: string;
  price: number;
  sections: Section[];
}

export function EnrollmentCard({ classId, price, sections }: Props) {
  const router = useRouter();
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChild, setSelectedChild] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(isAuthenticated());
    if (isAuthenticated()) {
      apiFetch<Child[]>('/users/children')
        .then((data) => {
          const list = Array.isArray(data) ? data : [];
          setChildren(list);
          if (list.length === 1) setSelectedChild(list[0].id);
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (sections.length === 1) setSelectedSection(sections[0].id);
  }, [sections]);

  async function handleEnroll(trial: boolean) {
    if (!selectedChild || !selectedSection) {
      setMessage({ type: 'error', text: 'Выберите ребёнка и время занятия' });
      return;
    }
    setIsLoading(true);
    setMessage(null);
    try {
      const endpoint = trial ? '/enrollments/trial' : '/enrollments';
      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ childId: selectedChild, sectionId: selectedSection }),
      });
      setMessage({
        type: 'success',
        text: trial
          ? 'Пробное занятие забронировано!'
          : 'Вы записаны!',
      });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Ошибка записи',
      });
    } finally {
      setIsLoading(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <Card className="sticky top-8 p-6">
        <p className="text-3xl font-bold text-gray-900">
          от {(price ?? 0).toLocaleString('ru-RU')} &#8381;
        </p>
        <p className="text-sm text-gray-500">за занятие</p>
        <Button
          className="mt-6 w-full"
          size="lg"
          onClick={() => router.push('/login')}
        >
          Войти, чтобы записаться
        </Button>
      </Card>
    );
  }

  return (
    <Card className="sticky top-8 p-6 space-y-4">
      <p className="text-3xl font-bold text-gray-900">
        от {(price ?? 0).toLocaleString('ru-RU')} &#8381;
      </p>
      <p className="text-sm text-gray-500">за занятие</p>

      {/* Child selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Ребёнок
        </label>
        {children.length === 0 ? (
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-800">
              Сначала добавьте ребёнка в личном кабинете
            </p>
            <button
              onClick={() => router.push('/dashboard')}
              className="mt-2 inline-flex items-center gap-1 rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
            >
              Добавить ребёнка →
            </button>
          </div>
        ) : (
          <select
            value={selectedChild}
            onChange={(e) => setSelectedChild(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Выберите ребёнка</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Section selector */}
      {sections.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Время занятия
          </label>
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Выберите время</option>
            {sections.map((s) => {
              const d = new Date(s.startTime);
              const date = d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
              const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
              const available = s.maxStudents - s.enrolledCount;
              return (
                <option key={s.id} value={s.id} disabled={available <= 0}>
                  {date}, {time} — {available > 0 ? `${available} мест` : 'мест нет'}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Messages */}
      {message && (
        <div className={`rounded-lg p-3 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message.text}
          {message.type === 'success' && selectedSection && (
            <button
              onClick={() => router.push(`/classroom/${selectedSection}`)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
              Войти в класс
            </button>
          )}
        </div>
      )}

      {/* Hint why buttons disabled */}
      {children.length > 0 && (!selectedChild || !selectedSection) && (
        <p className="text-xs text-amber-600 text-center">
          {!selectedChild ? 'Выберите ребёнка' : 'Выберите время занятия'}
        </p>
      )}

      {/* Buttons */}
      <Button
        className="w-full bg-green-600 hover:bg-green-700"
        size="lg"
        disabled={isLoading || !selectedChild || !selectedSection}
        onClick={() => handleEnroll(true)}
      >
        {isLoading ? 'Записываем...' : 'Попробовать бесплатно'}
      </Button>

      <Button
        className="w-full"
        size="lg"
        variant="primary"
        disabled={isLoading || !selectedChild || !selectedSection}
        onClick={() => handleEnroll(false)}
      >
        Записаться за {(price ?? 0).toLocaleString('ru-RU')} ₽
      </Button>

      <p className="text-center text-xs text-gray-400">
        Бесплатная отмена за 24 часа
      </p>
    </Card>
  );
}
