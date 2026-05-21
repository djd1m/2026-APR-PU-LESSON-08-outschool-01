import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface ClassDetail {
  id: string;
  title: string;
  description: string;
  subject: string;
  ageMin: number;
  ageMax: number;
  pricePerSession: number;
  sessionsPerWeek: number;
  durationMinutes: number;
  rating: number;
  reviewCount: number;
  imageUrl: string | null;
  teacher: {
    id: string;
    name: string;
    bio: string;
    avatarUrl: string | null;
    rating: number;
    totalStudents: number;
  };
  schedule: Array<{
    dayOfWeek: string;
    time: string;
  }>;
  reviews: Array<{
    id: string;
    authorName: string;
    rating: number;
    text: string;
    createdAt: string;
  }>;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={i < Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}
        >
          &#9733;
        </span>
      ))}
      <span className="ml-1 text-gray-600">{rating.toFixed(1)}</span>
    </span>
  );
}

async function getClass(id: string): Promise<ClassDetail | null> {
  try {
    return await apiFetch<ClassDetail>(`/classes/${id}`);
  } catch {
    return null;
  }
}

export default async function ClassDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const cls = await getClass(params.id);

  if (!cls) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Занятие не найдено</h1>
        <p className="mt-2 text-gray-600">
          Возможно, оно было удалено или ссылка неверна.
        </p>
        <Link
          href="/classes"
          className="mt-6 inline-block text-primary-600 hover:underline"
        >
          Вернуться к каталогу
        </Link>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <Link
        href="/classes"
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        &larr; Каталог
      </Link>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Header */}
          <div>
            {cls.imageUrl && (
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gray-100">
                <img
                  src={cls.imageUrl}
                  alt={cls.title}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="primary">{cls.subject}</Badge>
              <Badge variant="secondary">{cls.ageMin}-{cls.ageMax} лет</Badge>
            </div>
            <h1 className="mt-3 text-3xl font-bold text-gray-900">
              {cls.title}
            </h1>
            <div className="mt-2 flex items-center gap-4">
              <StarRating rating={cls.rating} />
              <span className="text-sm text-gray-500">
                {cls.reviewCount} отзывов
              </span>
            </div>
          </div>

          {/* Description */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Описание</h2>
            <p className="mt-3 text-gray-600 leading-relaxed whitespace-pre-line">
              {cls.description}
            </p>
          </div>

          {/* Schedule */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Расписание</h2>
            <div className="mt-3 space-y-2">
              {cls.schedule.map((slot, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-gray-900">
                    {slot.dayOfWeek}
                  </span>
                  <span className="text-gray-600">{slot.time}</span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {cls.sessionsPerWeek}x в неделю, {cls.durationMinutes} мин
            </p>
          </div>

          {/* Reviews */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Отзывы</h2>
            {cls.reviews.length === 0 ? (
              <p className="mt-3 text-gray-500">Пока нет отзывов</p>
            ) : (
              <div className="mt-4 space-y-4">
                {cls.reviews.map((review) => (
                  <Card key={review.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900">
                        {review.authorName}
                      </span>
                      <StarRating rating={review.rating} />
                    </div>
                    <p className="mt-2 text-sm text-gray-600">{review.text}</p>
                    <p className="mt-2 text-xs text-gray-400">
                      {new Date(review.createdAt).toLocaleDateString('ru-RU')}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Booking card */}
          <Card className="sticky top-8 p-6">
            <p className="text-3xl font-bold text-gray-900">
              от {cls.pricePerSession.toLocaleString('ru-RU')} &#8381;
            </p>
            <p className="text-sm text-gray-500">за занятие</p>
            <Button className="mt-6 w-full">Записаться</Button>
            <p className="mt-3 text-center text-xs text-gray-400">
              Бесплатная отмена за 24 часа
            </p>
          </Card>

          {/* Teacher card */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
              Преподаватель
            </h3>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg">
                {cls.teacher.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-gray-900">{cls.teacher.name}</p>
                <StarRating rating={cls.teacher.rating} />
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600">{cls.teacher.bio}</p>
            <p className="mt-2 text-xs text-gray-400">
              {cls.teacher.totalStudents} учеников
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
