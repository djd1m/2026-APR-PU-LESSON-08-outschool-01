'use client';

import { useState, useEffect } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { TeacherCard } from '@/components/TeacherCard';
import { Badge } from '@/components/ui/Badge';
import { apiFetch } from '@/lib/api';

interface TeacherItem {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  bio: string;
  subjects: string[];
  rating: number;
  reviewCount: number;
  verified: boolean;
  classesCount: number;
}

const SUBJECTS = [
  'Все предметы',
  'Математика',
  'Программирование',
  'Английский язык',
  'Рисование',
  'Музыка',
  'Наука',
  'Робототехника',
];

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('Все предметы');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (subject !== 'Все предметы') params.set('subject', subject);

    apiFetch<{ items?: any[]; data?: any[] }>(`/teachers?${params.toString()}`)
      .then((res) => {
        const raw = res?.items || res?.data || [];
        // Normalize: API may return user.name instead of name at top level
        setTeachers(raw.map((t: any) => ({
          ...t,
          name: t.name || t.user?.name || 'Преподаватель',
          avatarUrl: t.avatarUrl || t.user?.avatarUrl || null,
          subjects: t.subjects || [],
          rating: t.rating ?? 0,
          reviewCount: t.reviewCount ?? 0,
          classesCount: t.classesCount ?? 0,
          verified: t.verified ?? false,
        })));
      })
      .catch(() => setTeachers([]))
      .finally(() => setIsLoading(false));
  }, [search, subject]);

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold text-gray-900">
        Наши преподаватели
      </h1>
      <p className="mt-2 text-gray-600">
        Найдите лучшего преподавателя для вашего ребёнка
      </p>

      <div className="mt-6">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Поиск преподавателей..."
        />
      </div>

      <div className="mt-8 flex flex-col lg:flex-row gap-8">
        {/* Sidebar filters */}
        <aside className="w-full lg:w-64 shrink-0">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
            Предмет
          </h3>
          <ul className="mt-3 space-y-2">
            {SUBJECTS.map((s) => (
              <li key={s}>
                <button
                  onClick={() => setSubject(s)}
                  className={`text-sm w-full text-left px-3 py-1.5 rounded-md transition-colors ${
                    subject === s
                      ? 'bg-primary-50 text-primary-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Teacher grid */}
        <div className="flex-1">
          {subject !== 'Все предметы' && (
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="primary">{subject}</Badge>
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-32 animate-pulse rounded-2xl bg-gray-100"
                />
              ))}
            </div>
          ) : teachers.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">Преподаватели не найдены</p>
              <p className="mt-1 text-sm">
                Попробуйте изменить параметры поиска
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {teachers.map((teacher) => (
                <TeacherCard key={teacher.id} teacher={teacher} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
