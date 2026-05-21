import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

interface TeacherCardProps {
  teacher: {
    id: string;
    name: string;
    avatarUrl: string | null;
    subjects: string[];
    rating: number;
    reviewCount: number;
    classesCount: number;
    verified: boolean;
  };
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
        className="h-16 w-16 rounded-full object-cover"
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
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-xl font-semibold text-primary-700">
      {initials}
    </div>
  );
}

export function TeacherCard({ teacher }: TeacherCardProps) {
  return (
    <Link href={`/teachers/${teacher.id}`}>
      <Card className="p-5 hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex items-start gap-4">
          <Avatar name={teacher.name} avatarUrl={teacher.avatarUrl} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-gray-900 truncate">
                {teacher.name}
              </h3>
              {teacher.verified && (
                <span
                  className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-blue-500 text-white text-xs flex-shrink-0"
                  title="Верифицированный преподаватель"
                >
                  &#10003;
                </span>
              )}
            </div>

            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {teacher.subjects.slice(0, 3).map((subj) => (
                <Badge key={subj} variant="primary">
                  {subj}
                </Badge>
              ))}
              {teacher.subjects.length > 3 && (
                <Badge variant="secondary">
                  +{teacher.subjects.length - 3}
                </Badge>
              )}
            </div>

            <div className="mt-3 flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <StarRating rating={teacher.rating} />
                <span className="text-xs text-gray-400">
                  ({teacher.reviewCount})
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {teacher.classesCount}{' '}
                {teacher.classesCount === 1
                  ? 'занятие'
                  : teacher.classesCount < 5
                    ? 'занятия'
                    : 'занятий'}
              </span>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
