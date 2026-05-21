'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { apiFetch } from '@/lib/api';

interface TeacherClass {
  id: string;
  title: string;
  subject: string;
  price: number;
  ageMin: number;
  ageMax: number;
  imageUrl: string | null;
}

interface TeacherReview {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  className: string;
  reviewerName: string;
}

interface TeacherProfile {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  memberSince: string;
  bio: string;
  education: string;
  experience: string;
  subjects: string[];
  rating: number;
  reviewCount: number;
  verified: boolean;
  totalStudents: number;
  totalClasses: number;
  classes: TeacherClass[];
  reviews: TeacherReview[];
}

function StarRating({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const textSize = size === 'lg' ? 'text-xl' : 'text-sm';
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`${textSize} ${i < Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`}
        >
          &#9733;
        </span>
      ))}
    </span>
  );
}

function Avatar({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        className="h-24 w-24 rounded-full object-cover border-4 border-white shadow-md"
      />
    );
  }

  const initials = name
    .split(' ')
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-100 text-3xl font-bold text-primary-700 border-4 border-white shadow-md">
      {initials}
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}

export default function TeacherProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    apiFetch<TeacherProfile>(`/teachers/${id}`)
      .then(setProfile)
      .catch((err) => setError(err.message || 'Failed to load profile'))
      .finally(() => setIsLoading(false));
  }, [id]);

  if (isLoading) {
    return (
      <div className="container-page py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-48 rounded-2xl bg-gray-100" />
          <div className="h-64 rounded-2xl bg-gray-100" />
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container-page py-16 text-center">
        <p className="text-lg text-gray-500">
          {error || 'Профиль не найден'}
        </p>
        <Link
          href="/teachers"
          className="mt-4 inline-block text-primary-600 hover:underline"
        >
          Вернуться к списку преподавателей
        </Link>
      </div>
    );
  }

  const yearsSince = new Date().getFullYear() - new Date(profile.memberSince).getFullYear();

  return (
    <div className="container-page py-8 space-y-8">
      {/* Hero section */}
      <Card className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start gap-6">
          <Avatar name={profile.name} avatarUrl={profile.avatarUrl} />

          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {profile.name}
              </h1>
              {profile.verified && (
                <span
                  className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-500 text-white text-sm"
                  title="Верифицированный преподаватель"
                >
                  &#10003;
                </span>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {(profile.subjects || []).map((subj) => (
                <Badge key={subj} variant="primary">
                  {subj}
                </Badge>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <StarRating rating={profile.rating} size="lg" />
              <span className="text-sm text-gray-500">
                {(profile.rating ?? 0).toFixed(1)} ({profile.reviewCount ?? 0}{' '}
                {profile.reviewCount === 1
                  ? 'отзыв'
                  : profile.reviewCount < 5
                    ? 'отзыва'
                    : 'отзывов'}
                )
              </span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mt-6 pt-6 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatBlock label="Рейтинг" value={(profile.rating ?? 0).toFixed(1)} />
          <StatBlock label="Учеников" value={profile.totalStudents} />
          <StatBlock label="Занятий" value={profile.totalClasses} />
          <StatBlock
            label="На платформе"
            value={`${yearsSince > 0 ? yearsSince : '<1'} ${yearsSince === 1 ? 'год' : yearsSince < 5 ? 'года' : 'лет'}`}
          />
        </div>
      </Card>

      {/* Bio, Education, Experience */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {profile.bio && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              О преподавателе
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {profile.bio}
            </p>
          </Card>
        )}

        {profile.education && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Образование
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {profile.education}
            </p>
          </Card>
        )}

        {profile.experience && (
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">
              Опыт работы
            </h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
              {profile.experience}
            </p>
          </Card>
        )}
      </div>

      {/* Classes by this teacher */}
      {(profile.classes || []).length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Занятия преподавателя
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(profile.classes || []).map((cls) => (
              <Link key={cls.id} href={`/classes/${cls.id}`}>
                <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="aspect-video w-full bg-gray-100 relative">
                    {cls.imageUrl ? (
                      <img
                        src={cls.imageUrl}
                        alt={cls.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center text-gray-300 text-4xl">
                        &#128218;
                      </div>
                    )}
                    <Badge
                      variant="secondary"
                      className="absolute top-3 right-3 bg-white/90 backdrop-blur"
                    >
                      {cls.ageMin}-{cls.ageMax} лет
                    </Badge>
                  </div>
                  <div className="p-4">
                    <Badge variant="primary" className="mb-2">
                      {cls.subject}
                    </Badge>
                    <h3 className="text-base font-semibold text-gray-900 line-clamp-2">
                      {cls.title}
                    </h3>
                    <p className="mt-2 text-base font-bold text-gray-900">
                      от {(cls.price ?? 0).toLocaleString('ru-RU')} &#8381;
                    </p>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      {(profile.reviews || []).length > 0 && (
        <section>
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Отзывы
          </h2>
          <div className="space-y-4">
            {(profile.reviews || []).map((review) => (
              <Card key={review.id} className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-gray-900">
                      {review.reviewerName}
                    </span>
                    <span className="mx-2 text-gray-300">|</span>
                    <span className="text-sm text-gray-500">
                      {review.className}
                    </span>
                  </div>
                  <time className="text-xs text-gray-400">
                    {new Date(review.createdAt).toLocaleDateString('ru-RU')}
                  </time>
                </div>
                <div className="mt-2">
                  <StarRating rating={review.rating} />
                </div>
                {review.comment && (
                  <p className="mt-2 text-sm text-gray-600">
                    {review.comment}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
