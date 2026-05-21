'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface EarningsSummary {
  totalEarned: string;
  pendingPayout: string;
  withdrawn: string;
}

interface PaymentItem {
  id: string;
  amount: string;
  commission: string;
  teacherPayout: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
  enrollment: {
    child: { name: string };
    section: {
      startTime: string;
      class: { title: string };
    };
  };
}

interface PaymentsResponse {
  items: PaymentItem[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

interface WithdrawResponse {
  jobId: string;
  message: string;
}

const MIN_WITHDRAW = 1000;

function formatPrice(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

function statusLabel(status: string): { text: string; className: string } {
  switch (status) {
    case 'COMPLETED':
      return { text: 'Оплачен', className: 'bg-green-100 text-green-700' };
    case 'PENDING':
      return { text: 'Ожидание', className: 'bg-yellow-100 text-yellow-700' };
    case 'PROCESSING':
      return { text: 'В обработке', className: 'bg-blue-100 text-blue-700' };
    case 'REFUNDED':
      return { text: 'Возврат', className: 'bg-red-100 text-red-700' };
    default:
      return { text: status, className: 'bg-gray-100 text-gray-700' };
  }
}

export default function TeacherEarningsPage() {
  const [earnings, setEarnings] = useState<EarningsSummary | null>(null);
  const [transactions, setTransactions] = useState<PaymentItem[]>([]);
  const [meta, setMeta] = useState<PaymentsResponse['meta'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Withdraw form
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [withdrawMessage, setWithdrawMessage] = useState('');
  const [withdrawError, setWithdrawError] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [earningsData, paymentsData] = await Promise.all([
        apiFetch<EarningsSummary>('/payments/teacher/earnings'),
        apiFetch<PaymentsResponse>('/payments/admin?page=1&perPage=50'),
      ]);
      setEarnings(earningsData);
      setTransactions(paymentsData?.items || []);
      setMeta(paymentsData?.meta || null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load earnings',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setWithdrawLoading(true);
    setWithdrawError('');
    setWithdrawMessage('');

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount < MIN_WITHDRAW) {
      setWithdrawError(`Минимальная сумма вывода: ${formatPrice(MIN_WITHDRAW)}`);
      setWithdrawLoading(false);
      return;
    }

    try {
      const result = await apiFetch<WithdrawResponse>(
        '/payments/teacher/withdraw',
        {
          method: 'POST',
          body: JSON.stringify({ amount }),
        },
      );
      setWithdrawMessage(result?.message || 'Запрос на вывод отправлен');
      setWithdrawAmount('');
      // Refresh earnings
      fetchData();
    } catch (err) {
      setWithdrawError(
        err instanceof Error ? err.message : 'Failed to request withdrawal',
      );
    } finally {
      setWithdrawLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container-page py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 bg-gray-200 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-28 bg-gray-200 rounded-2xl" />
            ))}
          </div>
          <div className="h-64 bg-gray-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Ошибка</h1>
        <p className="mt-2 text-gray-600">{error}</p>
        <Button className="mt-6" onClick={fetchData}>
          Попробовать снова
        </Button>
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <h1 className="text-2xl font-bold text-gray-900">Мои доходы</h1>

      {/* Earnings summary cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <p className="text-sm font-medium text-gray-500">Всего заработано</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {earnings ? formatPrice(earnings.totalEarned) : '--'}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-medium text-gray-500">Доступно к выводу</p>
          <p className="mt-2 text-2xl font-bold text-green-600">
            {earnings ? formatPrice(earnings.pendingPayout) : '--'}
          </p>
        </Card>
        <Card className="p-6">
          <p className="text-sm font-medium text-gray-500">Выведено</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">
            {earnings ? formatPrice(earnings.withdrawn) : '--'}
          </p>
        </Card>
      </div>

      {/* Withdrawal form */}
      <Card className="mt-8 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Вывод средств
        </h2>
        <form onSubmit={handleWithdraw} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <Input
              label="Сумма вывода (RUB)"
              type="number"
              min={MIN_WITHDRAW}
              step="0.01"
              placeholder={`Мин. ${MIN_WITHDRAW}`}
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              error={withdrawError}
            />
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              disabled={withdrawLoading}
              size="md"
            >
              {withdrawLoading ? 'Обработка...' : 'Вывести'}
            </Button>
          </div>
        </form>
        {withdrawMessage && (
          <p className="mt-3 text-sm text-green-600">{withdrawMessage}</p>
        )}
      </Card>

      {/* Transaction history table */}
      <Card className="mt-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            История транзакций
          </h2>
        </div>

        {transactions.length === 0 ? (
          <div className="px-6 py-12 text-center text-gray-500">
            Пока нет транзакций
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-3 text-left font-medium text-gray-500">
                    Дата
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">
                    Занятие
                  </th>
                  <th className="px-6 py-3 text-left font-medium text-gray-500">
                    Ученик
                  </th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">
                    Сумма
                  </th>
                  <th className="px-6 py-3 text-right font-medium text-gray-500">
                    Ваш доход
                  </th>
                  <th className="px-6 py-3 text-center font-medium text-gray-500">
                    Статус
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((tx) => {
                  const st = statusLabel(tx.status);
                  return (
                    <tr key={tx.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-gray-600 whitespace-nowrap">
                        {new Date(tx.paidAt || tx.createdAt).toLocaleDateString(
                          'ru-RU',
                          {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          },
                        )}
                      </td>
                      <td className="px-6 py-4 text-gray-900 font-medium">
                        {tx.enrollment?.section?.class?.title || 'Занятие'}
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {tx.enrollment?.child?.name || 'Ученик'}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-900">
                        {formatPrice(tx.amount)}
                      </td>
                      <td className="px-6 py-4 text-right text-green-600 font-medium">
                        {formatPrice(tx.teacherPayout)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${st.className}`}
                        >
                          {st.text}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center text-sm text-gray-500">
            <span>
              Показано {transactions.length} из {meta.total}
            </span>
            <span>
              Страница {meta.page} из {meta.totalPages}
            </span>
          </div>
        )}
      </Card>
    </div>
  );
}
