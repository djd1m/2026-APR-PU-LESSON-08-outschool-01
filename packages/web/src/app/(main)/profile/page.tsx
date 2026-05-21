'use client';

import { useState, FormEvent } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/hooks/useAuth';
import { apiFetch } from '@/lib/api';

export default function ProfilePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  if (user && !initialized) {
    setName(user.name);
    setEmail(user.email);
    setInitialized(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ name, email }),
      });
      setMessage('Профиль обновлён');
    } catch {
      setMessage('Ошибка при сохранении');
    } finally {
      setIsSaving(false);
    }
  }

  if (authLoading) {
    return (
      <div className="container-page py-16 text-center text-gray-500">
        Загрузка...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container-page py-16 text-center text-gray-500">
        Авторизуйтесь для доступа к профилю.
      </div>
    );
  }

  return (
    <div className="container-page py-8">
      <h1 className="text-3xl font-bold text-gray-900">Профиль</h1>
      <p className="mt-2 text-gray-600">Управляйте своими данными</p>

      <Card className="mt-8 max-w-lg p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          {message && (
            <div
              className={`rounded-lg p-4 text-sm ${
                message.includes('Ошибка')
                  ? 'bg-red-50 text-red-700'
                  : 'bg-green-50 text-green-700'
              }`}
            >
              {message}
            </div>
          )}

          <Input
            label="Имя"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-700">Роль</p>
            <p className="text-sm text-gray-500 capitalize">{user.role}</p>
          </div>

          <Button type="submit" disabled={isSaving}>
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
