'use client';

import { Card } from '@/components/ui/Card';

interface ReviewCardProps {
  review: {
    id: string;
    authorName: string;
    rating: number;
    comment?: string;
    createdAt: string;
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

export function ReviewCard({ review }: ReviewCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-900">{review.authorName}</span>
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
}
