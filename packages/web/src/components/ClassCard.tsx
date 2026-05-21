import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

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

const SUBJECT_GRADIENTS: Record<string, string> = {
  'Математика': 'from-blue-400 to-indigo-500',
  'Программирование': 'from-emerald-400 to-teal-600',
  'Английский язык': 'from-red-400 to-rose-500',
  'Рисование': 'from-pink-400 to-fuchsia-500',
  'Музыка': 'from-violet-400 to-purple-600',
  'Наука': 'from-amber-400 to-orange-500',
  'Робототехника': 'from-cyan-400 to-blue-600',
};

const DEFAULT_GRADIENT = 'from-gray-400 to-gray-500';

function getSubjectGradient(subject: string): string {
  return SUBJECT_GRADIENTS[subject] ?? DEFAULT_GRADIENT;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          className={`text-sm ${i < Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`}
        >
          &#9733;
        </span>
      ))}
      <span className="ml-1 text-xs text-gray-600 font-medium">
        {(rating ?? 0).toFixed(1)}
      </span>
    </span>
  );
}

export function ClassCard({ classItem }: { classItem: ClassItem }) {
  const gradient = getSubjectGradient(classItem.subject);

  return (
    <Link href={`/classes/${classItem.id}`}>
      <Card className="overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer">
        {/* Image / Gradient Placeholder */}
        <div className="aspect-video w-full relative">
          {classItem.imageUrl ? (
            <img
              src={classItem.imageUrl}
              alt={classItem.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className={`h-full w-full bg-gradient-to-br ${gradient} flex items-center justify-center`}
            >
              <span className="text-white/80 text-4xl font-bold">
                {classItem.subject?.charAt(0) || '?'}
              </span>
            </div>
          )}
          <Badge
            variant="secondary"
            className="absolute top-3 right-3 bg-white/90 backdrop-blur"
          >
            {classItem.ageMin}-{classItem.ageMax} лет
          </Badge>
        </div>

        {/* Content */}
        <div className="p-4">
          <Badge variant="primary" className="mb-2">
            {classItem.subject}
          </Badge>
          <h3 className="text-base font-semibold text-gray-900 line-clamp-2">
            {classItem.title}
          </h3>
          <p className="mt-1 text-sm text-gray-500">{classItem.teacherName}</p>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <StarRating rating={classItem.rating} />
              <span className="text-xs text-gray-400">
                ({classItem.reviewCount})
              </span>
            </div>
            <p className="text-base font-bold text-gray-900">
              от {(classItem.priceFrom ?? 0).toLocaleString('ru-RU')} &#8381;
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
