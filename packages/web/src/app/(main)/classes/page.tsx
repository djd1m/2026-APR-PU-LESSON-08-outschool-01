'use client';

import { useState, useEffect } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { ClassCard } from '@/components/ClassCard';
import { Badge } from '@/components/ui/Badge';
import { apiFetch } from '@/lib/api';

interface ClassItem {
  id: string;
  title: string;
  teacherName: string;
  priceFrom: number;
  rating: number;
  reviewCount: number;
  ageMin: number;
  ageMax: number;
  imageUrl: string | null;
  subject: string;
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

const AGE_RANGES = [
  { label: 'Все возрасты', min: 0, max: 18 },
  { label: '3-6 лет', min: 3, max: 6 },
  { label: '7-10 лет', min: 7, max: 10 },
  { label: '11-14 лет', min: 11, max: 14 },
  { label: '15-18 лет', min: 15, max: 18 },
];

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('Все предметы');
  const [ageRange, setAgeRange] = useState(AGE_RANGES[0]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (subject !== 'Все предметы') params.set('subject', subject);
    if (ageRange.min > 0) params.set('ageMin', String(ageRange.min));
    if (ageRange.max < 18) params.set('ageMax', String(ageRange.max));

    apiFetch<{ data: ClassItem[] }>(`/classes?${params.toString()}`)
      .then((res) => setClasses(res.data))
      .catch(() => setClasses([]))
      .finally(() => setIsLoading(false));
  }, [search, subject, ageRange]);

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold text-gray-900">Каталог занятий</h1>
      <p className="mt-2 text-gray-600">
        Найдите идеальное занятие для вашего ребёнка
      </p>

      <div className="mt-6">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      <div className="mt-8 flex flex-col lg:flex-row gap-8">
        {/* Sidebar filters */}
        <aside className="w-full lg:w-64 shrink-0 space-y-6">
          <div>
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
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Возраст
            </h3>
            <ul className="mt-3 space-y-2">
              {AGE_RANGES.map((range) => (
                <li key={range.label}>
                  <button
                    onClick={() => setAgeRange(range)}
                    className={`text-sm w-full text-left px-3 py-1.5 rounded-md transition-colors ${
                      ageRange.label === range.label
                        ? 'bg-primary-50 text-primary-700 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {range.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Class grid */}
        <div className="flex-1">
          {subject !== 'Все предметы' && (
            <div className="mb-4 flex items-center gap-2">
              <Badge variant="primary">{subject}</Badge>
              {ageRange.label !== 'Все возрасты' && (
                <Badge variant="secondary">{ageRange.label}</Badge>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-72 animate-pulse rounded-2xl bg-gray-100"
                />
              ))}
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <p className="text-lg">Занятия не найдены</p>
              <p className="mt-1 text-sm">
                Попробуйте изменить параметры поиска
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {classes.map((cls) => (
                <ClassCard key={cls.id} classItem={cls} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
