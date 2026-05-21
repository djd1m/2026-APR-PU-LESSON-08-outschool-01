'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { apiFetch } from '@/lib/api';

interface ReviewFormProps {
  enrollmentId: string;
  onSubmitted?: () => void;
}

export function ReviewForm({ enrollmentId, onSubmitted }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating === 0) {
      setError('Выберите оценку');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await apiFetch('/reviews', {
        method: 'POST',
        body: JSON.stringify({
          enrollmentId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });
      setSuccess(true);
      onSubmitted?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ошибка при отправке отзыва';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return (
      <Card className="p-6 text-center">
        <p className="text-lg font-medium text-green-600">
          Спасибо за ваш отзыв!
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold text-gray-900">Оставить отзыв</h3>
      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        {/* Star rating selector */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Оценка
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className={`text-2xl transition-colors ${
                  star <= (hoverRating || rating)
                    ? 'text-yellow-400'
                    : 'text-gray-200'
                } hover:text-yellow-400`}
              >
                &#9733;
              </button>
            ))}
          </div>
        </div>

        {/* Comment textarea */}
        <div>
          <label
            htmlFor="review-comment"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Комментарий (необязательно)
          </label>
          <textarea
            id="review-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Поделитесь впечатлениями о занятии..."
            className="block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <p className="mt-1 text-xs text-gray-400">
            {comment.length}/2000
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        <Button type="submit" disabled={isSubmitting || rating === 0}>
          {isSubmitting ? 'Отправка...' : 'Отправить отзыв'}
        </Button>
      </form>
    </Card>
  );
}
