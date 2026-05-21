'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

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
  birthDate: string;
}

interface TrialBookingCardProps {
  classId: string;
  pricePerSession: number;
  sections: Section[];
}

export function TrialBookingCard({
  classId,
  pricePerSession,
  sections,
}: TrialBookingCardProps) {
  const { user } = useAuth();
  const router = useRouter();

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [trialUsed, setTrialUsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch parent's children
  useEffect(() => {
    if (!user) return;
    apiFetch<Child[]>('/users/me/children')
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setChildren(list);
        if (list.length === 1) {
          setSelectedChildId(list[0].id);
        }
      })
      .catch(() => setChildren([]));
  }, [user]);

  // Check trial status when child changes
  const checkTrialStatus = useCallback(async () => {
    if (!selectedChildId || !classId) return;
    try {
      const res = await apiFetch<{ hasTrial: boolean }>(
        `/enrollments/trial-status?childId=${selectedChildId}&classId=${classId}`,
      );
      setTrialUsed(res.hasTrial);
    } catch {
      setTrialUsed(false);
    }
  }, [selectedChildId, classId]);

  useEffect(() => {
    checkTrialStatus();
  }, [checkTrialStatus]);

  // Pre-select first section
  useEffect(() => {
    if (sections.length > 0 && !selectedSectionId) {
      const available = sections.find((s) => s.enrolledCount < s.maxStudents);
      if (available) setSelectedSectionId(available.id);
    }
  }, [sections, selectedSectionId]);

  const handleTrialBooking = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!selectedChildId || !selectedSectionId) {
      setError('Выберите ребёнка и время занятия');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch('/enrollments/trial', {
        method: 'POST',
        body: JSON.stringify({
          childId: selectedChildId,
          sectionId: selectedSectionId,
        }),
      });
      setSuccess('Пробное занятие забронировано!');
      setTrialUsed(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Не удалось забронировать';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handlePaidBooking = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
    if (!selectedChildId || !selectedSectionId) {
      setError('Выберите ребёнка и время занятия');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await apiFetch('/enrollments', {
        method: 'POST',
        body: JSON.stringify({
          childId: selectedChildId,
          sectionId: selectedSectionId,
        }),
      });
      setSuccess('Запись оформлена! Перейдите к оплате.');
      router.push('/bookings');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Не удалось записаться';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="sticky top-8 p-6">
      <p className="text-3xl font-bold text-gray-900">
        от {(pricePerSession ?? 0).toLocaleString('ru-RU')} &#8381;
      </p>
      <p className="text-sm text-gray-500">за занятие</p>

      {/* Child selector */}
      {user && children.length > 1 && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ребёнок
          </label>
          <select
            value={selectedChildId}
            onChange={(e) => setSelectedChildId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:ring-1 focus:ring-primary-500"
          >
            <option value="">Выберите ребёнка</option>
            {children.map((child) => (
              <option key={child.id} value={child.id}>
                {child.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Section picker */}
      {sections.length > 0 && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Время занятия
          </label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {sections.map((section) => {
              const isFull = section.enrolledCount >= section.maxStudents;
              const seatsLeft = section.maxStudents - section.enrolledCount;
              return (
                <label
                  key={section.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    selectedSectionId === section.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  } ${isFull ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="section"
                      value={section.id}
                      checked={selectedSectionId === section.id}
                      onChange={() => !isFull && setSelectedSectionId(section.id)}
                      disabled={isFull}
                      className="text-primary-600"
                    />
                    <span>{formatDateTime(section.startTime)}</span>
                  </div>
                  <span className={`text-xs ${seatsLeft <= 3 ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>
                    {isFull ? 'Мест нет' : `${seatsLeft} мест`}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Trial button */}
      {!trialUsed ? (
        <Button
          className="mt-6 w-full bg-green-600 hover:bg-green-700 focus-visible:ring-green-500"
          onClick={handleTrialBooking}
          disabled={loading}
        >
          {loading ? 'Бронируем...' : 'Попробовать бесплатно'}
        </Button>
      ) : (
        <p className="mt-6 w-full text-center rounded-lg bg-gray-100 px-4 py-2.5 text-sm text-gray-500">
          Пробное занятие использовано
        </p>
      )}

      {/* Paid enrollment button */}
      <Button
        className="mt-3 w-full"
        variant="primary"
        onClick={handlePaidBooking}
        disabled={loading}
      >
        Записаться
      </Button>

      <p className="mt-3 text-center text-xs text-gray-400">
        Бесплатная отмена за 24 часа
      </p>

      {error && (
        <p className="mt-3 text-center text-sm text-red-600">{error}</p>
      )}
      {success && (
        <p className="mt-3 text-center text-sm text-green-600">{success}</p>
      )}
    </Card>
  );
}
