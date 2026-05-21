'use client';

import { useEffect, useState } from 'react';
import { ReviewCard } from '@/components/ReviewCard';
import { ReviewForm } from '@/components/ReviewForm';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

interface ReviewData {
  id: string;
  authorName: string;
  rating: number;
  text: string;
  createdAt: string;
}

interface Enrollment {
  id: string;
  status: string;
  classId: string;
  hasReview: boolean;
}

interface ClassDetailReviewSectionProps {
  classId: string;
  reviews: ReviewData[];
}

export function ClassDetailReviewSection({ classId, reviews: initialReviews }: ClassDetailReviewSectionProps) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState(initialReviews);
  const [completedEnrollmentId, setCompletedEnrollmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Check if the user has a completed enrollment for this class without a review
    apiFetch<{ data: Enrollment[] }>('/enrollments?status=completed')
      .then((res) => {
        const eligible = res.data?.find(
          (e) => e.classId === classId && !e.hasReview &&
            (e.status === 'COMPLETED' || e.status === 'ACTIVE'),
        );
        if (eligible) {
          setCompletedEnrollmentId(eligible.id);
        }
      })
      .catch(() => {
        // Silently fail - user may not have enrollments
      });
  }, [user, classId]);

  const handleReviewSubmitted = () => {
    // Refresh reviews list
    apiFetch<{ items: Array<{ id: string; rating: number; comment?: string; createdAt: string; enrollment: { child: { name: string } } }> }>(`/reviews/class/${classId}`)
      .then((res) => {
        setReviews(
          res.items.map((r) => ({
            id: r.id,
            authorName: r.enrollment.child.name,
            rating: r.rating,
            text: r.comment || '',
            createdAt: r.createdAt,
          })),
        );
      })
      .catch(() => {});
    setCompletedEnrollmentId(null);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900">Отзывы</h2>

      {/* Review form for enrolled+completed parents */}
      {completedEnrollmentId && (
        <div className="mt-4">
          <ReviewForm
            enrollmentId={completedEnrollmentId}
            onSubmitted={handleReviewSubmitted}
          />
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="mt-3 text-gray-500">Пока нет отзывов</p>
      ) : (
        <div className="mt-4 space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={{
                id: review.id,
                authorName: review.authorName,
                rating: review.rating,
                comment: review.text,
                createdAt: review.createdAt,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
