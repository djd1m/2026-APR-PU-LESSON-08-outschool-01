'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

// ─── Types ───────────────────────────────────────────────────────────

interface SectionItem {
  id: string;
  classId: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  maxStudents: number;
  enrolledCount: number;
  class: {
    id: string;
    title: string;
    subject: string;
  };
  enrollments?: { id: string }[];
}

interface TeacherClass {
  id: string;
  title: string;
  subject: string;
}

// ─── Constants ───────────────────────────────────────────────────────

const DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const HOURS = Array.from({ length: 15 }, (_, i) => i + 8); // 08:00–22:00

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: 'Запланировано',
  IN_PROGRESS: 'Идёт',
  COMPLETED: 'Завершено',
  CANCELLED: 'Отменено',
};

const STATUS_COLORS: Record<string, string> = {
  SCHEDULED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-red-100 text-red-700',
};

// ─── Helpers ─────────────────────────────────────────────────────────

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function addDays(d: Date, n: number): Date {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Moscow',
  });
}

function toLocalISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Component ───────────────────────────────────────────────────────

export default function TeacherSchedulePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [weekStart, setWeekStart] = useState<Date>(getMonday(new Date()));
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [conflictWarning, setConflictWarning] = useState('');

  // Form state
  const [formClassId, setFormClassId] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formDuration, setFormDuration] = useState(45);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const weekEnd = addDays(weekStart, 6);

  const fetchSchedule = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const from = weekStart.toISOString();
      const to = new Date(
        weekEnd.getFullYear(),
        weekEnd.getMonth(),
        weekEnd.getDate(),
        23, 59, 59, 999,
      ).toISOString();

      const data = await apiFetch<SectionItem[] | { items: SectionItem[] }>(
        `/sections/teacher/schedule?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      );
      setSections(Array.isArray(data) ? data : (data?.items || []));
    } catch {
      setSections([]);
    } finally {
      setIsLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, weekStart.getTime()]);

  // Fetch teacher's classes for the dropdown
  const fetchClasses = useCallback(async () => {
    if (!user) return;
    try {
      const res = await apiFetch<{ items: TeacherClass[] }>(
        '/classes?perPage=100',
      );
      setClasses(res?.items || []);
    } catch {
      setClasses([]);
    }
  }, [user]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  // ─── Week navigation ────────────────────────────────────────────

  const prevWeek = () => setWeekStart(addDays(weekStart, -7));
  const nextWeek = () => setWeekStart(addDays(weekStart, 7));
  const goToday = () => setWeekStart(getMonday(new Date()));

  // ─── Conflict check ─────────────────────────────────────────────

  useEffect(() => {
    if (!formStartTime || !formDuration) {
      setConflictWarning('');
      return;
    }

    const start = new Date(formStartTime);
    const end = new Date(start.getTime() + formDuration * 60 * 1000);

    const conflict = sections.find((s) => {
      if (s.status === 'CANCELLED') return false;
      const sStart = new Date(s.startTime);
      const sEnd = new Date(s.endTime);
      return sStart < end && sEnd > start;
    });

    if (conflict) {
      setConflictWarning(
        `Конфликт с "${conflict.class.title}" (${formatTime(conflict.startTime)} - ${formatTime(conflict.endTime)})`,
      );
    } else {
      setConflictWarning('');
    }
  }, [formStartTime, formDuration, sections]);

  // ─── Create section ─────────────────────────────────────────────

  const handleCreateSection = async () => {
    if (!formClassId || !formStartTime || !formDuration) {
      setFormError('Заполните все поля');
      return;
    }

    setFormSubmitting(true);
    setFormError('');

    try {
      await apiFetch('/sections', {
        method: 'POST',
        body: JSON.stringify({
          classId: formClassId,
          startTime: new Date(formStartTime).toISOString(),
          durationMinutes: formDuration,
          timezone: 'Europe/Moscow',
        }),
      });

      setShowModal(false);
      setFormClassId('');
      setFormStartTime('');
      setFormDuration(45);
      await fetchSchedule();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Не удалось создать занятие';
      setFormError(message);
    } finally {
      setFormSubmitting(false);
    }
  };

  // ─── Cancel section ─────────────────────────────────────────────

  const handleCancelSection = async (sectionId: string) => {
    if (!confirm('Вы уверены, что хотите отменить это занятие?')) return;

    try {
      await apiFetch(`/sections/${sectionId}`, { method: 'DELETE' });
      await fetchSchedule();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Не удалось отменить занятие';
      alert(message);
    }
  };

  // ─── Map sections to grid ──────────────────────────────────────

  function getSectionsForDayHour(dayIndex: number, hour: number): SectionItem[] {
    const dayDate = addDays(weekStart, dayIndex);
    return sections.filter((s) => {
      const d = new Date(s.startTime);
      return (
        d.getDate() === dayDate.getDate() &&
        d.getMonth() === dayDate.getMonth() &&
        d.getFullYear() === dayDate.getFullYear() &&
        d.getHours() === hour
      );
    });
  }

  // ─── Render guards ─────────────────────────────────────────────

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
        <h1 className="text-2xl font-bold text-gray-900">Доступ ограничен</h1>
        <p className="mt-2 text-gray-600">
          Эта страница доступна только для преподавателей.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-primary-600 hover:underline"
        >
          На главную
        </Link>
      </div>
    );
  }

  // ─── Main render ───────────────────────────────────────────────

  return (
    <div className="container-page py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Расписание</h1>
          <p className="mt-1 text-gray-600">
            {formatDate(weekStart)} &mdash; {formatDate(weekEnd)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevWeek}>
            &larr;
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Сегодня
          </Button>
          <Button variant="outline" size="sm" onClick={nextWeek}>
            &rarr;
          </Button>
          <Button size="sm" onClick={() => setShowModal(true)}>
            Добавить занятие
          </Button>
        </div>
      </div>

      {/* Week grid */}
      <div className="mt-6 overflow-x-auto">
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="h-16 animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <div className="min-w-[800px]">
            {/* Day headers */}
            <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 mb-2">
              <div /> {/* time column header */}
              {DAYS_RU.map((day, i) => {
                const dayDate = addDays(weekStart, i);
                const isToday =
                  dayDate.toDateString() === new Date().toDateString();
                return (
                  <div
                    key={day}
                    className={`text-center text-sm font-medium py-2 rounded-lg ${
                      isToday
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-600'
                    }`}
                  >
                    <div>{day}</div>
                    <div className="text-xs">{formatDate(dayDate)}</div>
                  </div>
                );
              })}
            </div>

            {/* Time rows */}
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 min-h-[56px]"
              >
                <div className="text-xs text-gray-400 text-right pr-2 pt-1">
                  {String(hour).padStart(2, '0')}:00
                </div>
                {DAYS_RU.map((_, dayIndex) => {
                  const daySections = getSectionsForDayHour(dayIndex, hour);
                  return (
                    <div
                      key={dayIndex}
                      className="border border-gray-50 rounded-lg min-h-[56px] p-0.5"
                    >
                      {daySections.map((s) => {
                        const enrolledCount =
                          s.enrollments?.length ?? s.enrolledCount;
                        return (
                          <div
                            key={s.id}
                            className={`rounded-md px-2 py-1 text-xs mb-0.5 ${STATUS_COLORS[s.status] || 'bg-gray-50'}`}
                          >
                            <div className="font-medium truncate">
                              {s.class.title}
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <span>
                                {formatTime(s.startTime)}-
                                {formatTime(s.endTime)}
                              </span>
                              <span>{enrolledCount}/{s.maxStudents}</span>
                            </div>
                            {s.status === 'SCHEDULED' && (
                              <button
                                onClick={() => handleCancelSection(s.id)}
                                className="mt-1 text-red-600 hover:text-red-800 text-[10px] underline"
                              >
                                Отменить
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section list (below grid for mobile) */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Занятия на этой неделе
        </h2>
        {sections.length === 0 && !isLoading ? (
          <Card className="p-6 text-center">
            <p className="text-gray-500">Нет запланированных занятий</p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => setShowModal(true)}
            >
              Добавить занятие
            </Button>
          </Card>
        ) : (
          <div className="space-y-3">
            {sections
              .filter((s) => s.status !== 'CANCELLED')
              .map((s) => {
                const enrolledCount =
                  s.enrollments?.length ?? s.enrolledCount;
                return (
                  <Card
                    key={s.id}
                    className="flex items-center justify-between p-4"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {s.class.title}
                      </p>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {new Date(s.startTime).toLocaleDateString('ru-RU', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          timeZone: 'Europe/Moscow',
                        })}{' '}
                        {formatTime(s.startTime)} &mdash;{' '}
                        {formatTime(s.endTime)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500">
                        {enrolledCount}/{s.maxStudents}
                      </span>
                      <Badge
                        variant={
                          s.status === 'SCHEDULED' ? 'primary' : 'secondary'
                        }
                      >
                        {STATUS_LABELS[s.status]}
                      </Badge>
                      {s.status === 'SCHEDULED' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancelSection(s.id)}
                        >
                          Отменить
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
          </div>
        )}
      </div>

      {/* ─── Create section modal ───────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <Card className="w-full max-w-md p-6 m-4">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              Добавить занятие
            </h2>

            {/* Class selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Класс
              </label>
              <select
                value={formClassId}
                onChange={(e) => setFormClassId(e.target.value)}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">Выберите класс</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.subject})
                  </option>
                ))}
              </select>
            </div>

            {/* Date/time */}
            <div className="mb-4">
              <Input
                label="Дата и время (МСК)"
                type="datetime-local"
                value={formStartTime}
                onChange={(e) => setFormStartTime(e.target.value)}
                min={toLocalISOString(new Date())}
              />
            </div>

            {/* Duration */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Продолжительность (мин)
              </label>
              <select
                value={formDuration}
                onChange={(e) => setFormDuration(Number(e.target.value))}
                className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {[15, 30, 45, 60, 90, 120, 150, 180].map((m) => (
                  <option key={m} value={m}>
                    {m} мин
                  </option>
                ))}
              </select>
            </div>

            {/* Conflict warning */}
            {conflictWarning && (
              <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
                {conflictWarning}
              </div>
            )}

            {/* Error */}
            {formError && (
              <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                {formError}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setShowModal(false);
                  setFormError('');
                  setConflictWarning('');
                }}
              >
                Отмена
              </Button>
              <Button
                onClick={handleCreateSection}
                disabled={formSubmitting || !!conflictWarning}
              >
                {formSubmitting ? 'Создание...' : 'Создать'}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
