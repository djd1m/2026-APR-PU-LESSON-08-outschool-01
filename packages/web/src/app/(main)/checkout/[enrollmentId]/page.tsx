'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface EnrollmentDetail {
  id: string;
  status: string;
  child: { id: string; name: string };
  section: {
    id: string;
    startTime: string;
    endTime: string;
    class: {
      id: string;
      title: string;
      price: number;
      subject: string;
    };
  };
  payment?: {
    id: string;
    amount: number;
    commission: number;
    teacherPayout: number;
    status: string;
    yookassaId: string | null;
    paidAt: string | null;
  };
}

interface CheckoutResponse {
  paymentId: string;
  confirmationUrl: string;
}

type PageStatus = 'loading' | 'ready' | 'processing' | 'paid' | 'error';

const COMMISSION_RATE = 0.22;

function formatPrice(value: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function CheckoutPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const enrollmentId = params.enrollmentId as string;

  const [enrollment, setEnrollment] = useState<EnrollmentDetail | null>(null);
  const [status, setStatus] = useState<PageStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const fetchEnrollment = useCallback(async () => {
    try {
      const data = await apiFetch<EnrollmentDetail>(
        `/enrollments/${enrollmentId}`,
      );
      setEnrollment(data);

      // Check if already paid
      if (
        data.payment?.status === 'COMPLETED' ||
        data.status === 'CONFIRMED'
      ) {
        setStatus('paid');
      } else {
        setStatus('ready');
      }
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to load enrollment',
      );
    }
  }, [enrollmentId]);

  useEffect(() => {
    fetchEnrollment();
  }, [fetchEnrollment]);

  // Poll payment status after returning from ЮKassa
  useEffect(() => {
    const paymentId = searchParams.get('paymentId');
    const simulated = searchParams.get('simulated');

    if (!paymentId && !simulated) return;

    setStatus('processing');

    const interval = setInterval(async () => {
      try {
        const data = await apiFetch<EnrollmentDetail>(
          `/enrollments/${enrollmentId}`,
        );
        setEnrollment(data);

        if (
          data.payment?.status === 'COMPLETED' ||
          data.status === 'CONFIRMED'
        ) {
          setStatus('paid');
          clearInterval(interval);
        }
      } catch {
        // Keep polling
      }
    }, 3000);

    // Stop polling after 5 minutes
    const timeout = setTimeout(() => {
      clearInterval(interval);
      if (status === 'processing') {
        setStatus('ready');
      }
    }, 5 * 60 * 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [searchParams, enrollmentId, status]);

  const handleCheckout = async () => {
    setStatus('processing');
    try {
      const result = await apiFetch<CheckoutResponse>('/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ enrollmentId }),
      });

      // Redirect to ЮKassa payment page
      window.location.href = result.confirmationUrl;
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to create payment',
      );
    }
  };

  if (status === 'loading') {
    return (
      <div className="container-page py-16 text-center">
        <div className="animate-pulse">
          <div className="mx-auto h-8 w-48 bg-gray-200 rounded mb-4" />
          <div className="mx-auto h-4 w-32 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Ошибка</h1>
        <p className="mt-2 text-gray-600">{errorMessage}</p>
        <Button
          className="mt-6"
          onClick={() => {
            setStatus('loading');
            fetchEnrollment();
          }}
        >
          Попробовать снова
        </Button>
      </div>
    );
  }

  if (status === 'paid') {
    return (
      <div className="container-page py-16 text-center">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <svg
            className="w-8 h-8 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Оплата прошла успешно!</h1>
        <p className="mt-2 text-gray-600">
          {enrollment?.child.name} записан(а) на занятие &laquo;
          {enrollment?.section.class.title}&raquo;
        </p>
        <a
          href="/dashboard"
          className="mt-6 inline-block text-primary-600 hover:underline"
        >
          Перейти в личный кабинет
        </a>
      </div>
    );
  }

  if (!enrollment) return null;

  const price = enrollment.section.class.price;
  const commission = Math.round(price * COMMISSION_RATE * 100) / 100;

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold text-gray-900">Оплата занятия</h1>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Class info */}
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {enrollment.section.class.title}
          </h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <span className="font-medium text-gray-700">Предмет:</span>{' '}
              {enrollment.section.class.subject}
            </p>
            <p>
              <span className="font-medium text-gray-700">Ученик:</span>{' '}
              {enrollment.child.name}
            </p>
            <p>
              <span className="font-medium text-gray-700">Начало:</span>{' '}
              {new Date(enrollment.section.startTime).toLocaleDateString(
                'ru-RU',
                {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                },
              )}
            </p>
          </div>
        </Card>

        {/* Payment summary */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Итого к оплате
          </h2>

          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Стоимость занятия</span>
              <span className="font-medium text-gray-900">
                {formatPrice(price)}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">
                Сервисный сбор ({(COMMISSION_RATE * 100).toFixed(0)}%)
              </span>
              <span className="text-gray-500">
                включён в стоимость
              </span>
            </div>
            <div className="border-t border-gray-100 pt-3">
              <div className="flex justify-between">
                <span className="text-base font-semibold text-gray-900">
                  Итого
                </span>
                <span className="text-xl font-bold text-gray-900">
                  {formatPrice(price)}
                </span>
              </div>
            </div>
          </div>

          <Button
            className="mt-6 w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={status === 'processing'}
          >
            {status === 'processing' ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Обработка...
              </span>
            ) : (
              'Оплатить через ЮKassa'
            )}
          </Button>

          <p className="mt-3 text-center text-xs text-gray-400">
            Безопасная оплата через ЮKassa. Возврат возможен до начала занятия.
          </p>
        </Card>
      </div>
    </div>
  );
}
