import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

interface SectionItem {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  maxStudents: number;
  enrolledCount: number;
}

interface ReviewItem {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface TeacherProfile {
  id: string;
  bio: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
  };
  _count?: {
    classes: number;
  };
}

interface ClassDetail {
  id: string;
  title: string;
  description: string;
  subject: string;
  ageMin: number;
  ageMax: number;
  price: number;
  maxStudents: number;
  slug: string;
  imageUrl: string | null;
  status: string;
  createdAt: string;
  teacher: TeacherProfile;
  sections: SectionItem[];
  reviews: ReviewItem[];
  avgRating: number;
  reviewCount: number;
  _count?: {
    reviews: number;
    sections: number;
  };
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

function formatDateTime(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr);
  const date = d.toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
  const time = d.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return { date, time };
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

  const teacherName = cls.teacher?.user
    ? `${cls.teacher.user.firstName} ${cls.teacher.user.lastName}`
    : '';
  const teacherInitial = teacherName.charAt(0) || '?';
  const teacherClassesCount = cls.teacher?._count?.classes ?? 0;

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
          {/* Hero */}
          <div>
            {cls.imageUrl ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gray-100">
                <img
                  src={cls.imageUrl}
                  alt={cls.title}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                <span className="text-white/60 text-6xl font-bold">
                  {cls.subject.charAt(0)}
                </span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge variant="primary">{cls.subject}</Badge>
              <Badge variant="secondary">{cls.ageMin}-{cls.ageMax} лет</Badge>
              <Badge variant="secondary">до {cls.maxStudents} учеников</Badge>
            </div>

            <h1 className="mt-3 text-3xl font-bold text-gray-900">
              {cls.title}
            </h1>

            <div className="mt-2 flex items-center gap-4">
              <StarRating rating={cls.avgRating} />
              <span className="text-sm text-gray-500">
                {cls.reviewCount} {cls.reviewCount === 1 ? 'отзыв' : cls.reviewCount < 5 ? 'отзыва' : 'отзывов'}
              </span>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {cls.price.toLocaleString('ru-RU')} &#8381;
              </p>
              <p className="text-xs text-gray-500 mt-1">за занятие</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {cls.ageMin}-{cls.ageMax}
              </p>
              <p className="text-xs text-gray-500 mt-1">лет</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {cls.maxStudents}
              </p>
              <p className="text-xs text-gray-500 mt-1">макс. учеников</p>
            </Card>
            <Card className="p-4 text-center">
              <p className="text-2xl font-bold text-yellow-500">
                {cls.avgRating.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500 mt-1">рейтинг</p>
            </Card>
          </div>

          {/* Description */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Описание</h2>
            <p className="mt-3 text-gray-600 leading-relaxed whitespace-pre-line">
              {cls.description}
            </p>
          </div>

          {/* Upcoming sections */}
          {cls.sections && cls.sections.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Ближайшие занятия
              </h2>
              <div className="mt-3 space-y-2">
                {cls.sections.map((section) => {
                  const { date, time } = formatDateTime(section.startTime);
                  const available = section.maxStudents - section.enrolledCount;
                  return (
                    <div
                      key={section.id}
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3 text-sm"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-medium text-gray-900">
                          {date}
                        </span>
                        <span className="text-gray-600">{time}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-xs ${available > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {available > 0
                            ? `${available} мест свободно`
                            : 'Мест нет'}
                        </span>
                        {available > 0 && (
                          <Button size="sm">Записаться</Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              Отзывы ({cls.reviewCount})
            </h2>
            {(!cls.reviews || cls.reviews.length === 0) ? (
              <p className="mt-3 text-gray-500">Пока нет отзывов</p>
            ) : (
              <div className="mt-4 space-y-4">
                {cls.reviews.map((review) => {
                  const reviewerName = review.user
                    ? `${review.user.firstName} ${review.user.lastName}`
                    : 'Аноним';
                  return (
                    <Card key={review.id} className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-900">
                          {reviewerName}
                        </span>
                        <StarRating rating={review.rating} />
                      </div>
                      {review.comment && (
                        <p className="mt-2 text-sm text-gray-600">{review.comment}</p>
                      )}
                      <p className="mt-2 text-xs text-gray-400">
                        {new Date(review.createdAt).toLocaleDateString('ru-RU')}
                      </p>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Booking card */}
          <Card className="sticky top-8 p-6">
            <p className="text-3xl font-bold text-gray-900">
              от {cls.price.toLocaleString('ru-RU')} &#8381;
            </p>
            <p className="text-sm text-gray-500">за занятие</p>
            <Button className="mt-6 w-full" size="lg">
              Записаться
            </Button>
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
                {cls.teacher?.user?.avatarUrl ? (
                  <img
                    src={cls.teacher.user.avatarUrl}
                    alt={teacherName}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  teacherInitial
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">{teacherName}</p>
                <p className="text-xs text-gray-500">
                  {teacherClassesCount} {teacherClassesCount === 1 ? 'занятие' : teacherClassesCount < 5 ? 'занятия' : 'занятий'}
                </p>
              </div>
            </div>
            {cls.teacher?.bio && (
              <p className="mt-3 text-sm text-gray-600">{cls.teacher.bio}</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
