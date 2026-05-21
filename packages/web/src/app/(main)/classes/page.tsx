'use client';

import { useState, useEffect, useCallback } from 'react';
import { SearchBar } from '@/components/SearchBar';
import { ClassCard } from '@/components/ClassCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
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

interface ClassesResponse {
  items: Array<{
    id: string;
    title: string;
    teacherName: string;
    price: number;
    ageMin: number;
    ageMax: number;
    imageUrl: string | null;
    subject: string;
    reviewCount: number;
  }>;
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    nextCursor: string | null;
  };
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

const SORT_OPTIONS = [
  { label: 'По рейтингу', value: 'rating' },
  { label: 'По цене \u2191', value: 'price_asc' },
  { label: 'По цене \u2193', value: 'price_desc' },
  { label: 'Новые', value: 'newest' },
] as const;

const PRICE_MIN = 500;
const PRICE_MAX = 5000;
const PRICE_STEP = 100;

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('Все предметы');
  const [ageRange, setAgeRange] = useState(AGE_RANGES[0]);
  const [sort, setSort] = useState<string>('newest');
  const [priceMin, setPriceMin] = useState(PRICE_MIN);
  const [priceMax, setPriceMax] = useState(PRICE_MAX);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchClasses = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
      }

      const params = new URLSearchParams();
      if (search) params.set('query', search);
      if (subject !== 'Все предметы') params.set('subject', subject);
      if (ageRange.min > 0) params.set('ageMin', String(ageRange.min));
      if (ageRange.max < 18) params.set('ageMax', String(ageRange.max));
      if (priceMin > PRICE_MIN) params.set('priceMin', String(priceMin));
      if (priceMax < PRICE_MAX) params.set('priceMax', String(priceMax));
      params.set('sort', sort);
      params.set('page', String(pageNum));
      params.set('limit', '12');

      try {
        const res = await apiFetch<ClassesResponse>(`/classes?${params.toString()}`);
        const mapped: ClassItem[] = (res?.items || []).map((item) => ({
          id: item.id,
          title: item.title,
          teacherName: item.teacherName,
          priceFrom: item.price,
          rating: 0,
          reviewCount: item.reviewCount,
          ageMin: item.ageMin,
          ageMax: item.ageMax,
          imageUrl: item.imageUrl,
          subject: item.subject,
        }));

        if (append) {
          setClasses((prev) => [...prev, ...mapped]);
        } else {
          setClasses(mapped);
        }
        setTotalPages(res?.meta?.totalPages ?? 1);
        setTotal(res?.meta?.total ?? 0);
      } catch {
        if (!append) setClasses([]);
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [search, subject, ageRange, priceMin, priceMax, sort],
  );

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
    fetchClasses(1, false);
  }, [fetchClasses]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchClasses(nextPage, true);
  };

  const activeFilters: string[] = [];
  if (subject !== 'Все предметы') activeFilters.push(subject);
  if (ageRange.label !== 'Все возрасты') activeFilters.push(ageRange.label);
  if (priceMin > PRICE_MIN || priceMax < PRICE_MAX) {
    activeFilters.push(`${priceMin}-${priceMax} \u20BD`);
  }

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold text-gray-900">Каталог занятий</h1>
      <p className="mt-2 text-gray-600">
        Найдите идеальное занятие для вашего ребёнка
      </p>

      {/* Search bar */}
      <div className="mt-6">
        <SearchBar value={search} onChange={setSearch} />
      </div>

      <div className="mt-8 flex flex-col lg:flex-row gap-8">
        {/* Sidebar filters */}
        <aside className="w-full lg:w-64 shrink-0 space-y-6">
          {/* Subject filter */}
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

          {/* Age filter */}
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

          {/* Price range filter */}
          <div>
            <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
              Цена
            </h3>
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 w-6">от</label>
                <input
                  type="range"
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  step={PRICE_STEP}
                  value={priceMin}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPriceMin(Math.min(val, priceMax - PRICE_STEP));
                  }}
                  className="flex-1 accent-primary-600"
                />
                <span className="text-xs text-gray-700 w-16 text-right">
                  {priceMin} &#8381;
                </span>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500 w-6">до</label>
                <input
                  type="range"
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  step={PRICE_STEP}
                  value={priceMax}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setPriceMax(Math.max(val, priceMin + PRICE_STEP));
                  }}
                  className="flex-1 accent-primary-600"
                />
                <span className="text-xs text-gray-700 w-16 text-right">
                  {priceMax} &#8381;
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1">
          {/* Sort + active filters */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {activeFilters.map((f) => (
                <Badge key={f} variant="primary">
                  {f}
                </Badge>
              ))}
              {total > 0 && (
                <span className="text-sm text-gray-500">
                  {total} {total === 1 ? 'занятие' : total < 5 ? 'занятия' : 'занятий'}
                </span>
              )}
            </div>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Class grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl bg-gray-100 overflow-hidden">
                  <div className="aspect-video bg-gray-200" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-16" />
                    <div className="h-5 bg-gray-200 rounded w-3/4" />
                    <div className="h-4 bg-gray-200 rounded w-1/2" />
                    <div className="flex justify-between">
                      <div className="h-4 bg-gray-200 rounded w-24" />
                      <div className="h-4 bg-gray-200 rounded w-16" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : classes.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl mb-4 text-gray-300">
                &#128270;
              </div>
              <p className="text-lg font-medium text-gray-700">Ничего не найдено</p>
              <p className="mt-1 text-sm text-gray-500">
                Попробуйте изменить параметры поиска или сбросить фильтры
              </p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => {
                  setSearch('');
                  setSubject('Все предметы');
                  setAgeRange(AGE_RANGES[0]);
                  setPriceMin(PRICE_MIN);
                  setPriceMax(PRICE_MAX);
                  setSort('newest');
                }}
              >
                Сбросить фильтры
              </Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {classes.map((cls) => (
                  <ClassCard key={cls.id} classItem={cls} />
                ))}
              </div>

              {/* Load more pagination */}
              {page < totalPages && (
                <div className="mt-8 text-center">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? 'Загрузка...' : 'Показать ещё'}
                  </Button>
                  <p className="mt-2 text-xs text-gray-400">
                    Показано {classes.length} из {total}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
