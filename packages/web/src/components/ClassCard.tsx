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
    </span>
  );
}

export function ClassCard({ classItem }: { classItem: ClassItem }) {
  return (
    <Link href={`/classes/${classItem.id}`}>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
        {/* Image */}
        <div className="aspect-video w-full bg-gray-100 relative">
          {classItem.imageUrl ? (
            <img
              src={classItem.imageUrl}
              alt={classItem.title}
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
              от {classItem.priceFrom.toLocaleString('ru-RU')} &#8381;
            </p>
          </div>
        </div>
      </Card>
    </Link>
  );
}
