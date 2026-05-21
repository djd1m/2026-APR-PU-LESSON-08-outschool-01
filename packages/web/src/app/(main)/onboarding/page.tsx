'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { apiFetch } from '@/lib/api';

const INTEREST_OPTIONS = [
  'Математика',
  'Английский',
  'Программирование',
  'Рисование',
  'Музыка',
  'Шахматы',
  'Наука',
  'Спорт',
  'Чтение',
  'Другое',
];

const TOTAL_STEPS = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest],
    );
  }

  async function handleNext() {
    setError('');

    if (step === 1 && name.trim().length < 2) {
      setError('Имя должно содержать минимум 2 символа');
      return;
    }

    if (step === 2 && !birthDate) {
      setError('Укажите дату рождения');
      return;
    }

    if (step < 3) {
      setStep(step + 1);
      return;
    }

    // Step 3: submit data and move to step 4
    if (step === 3) {
      setIsSubmitting(true);
      try {
        await apiFetch('/users/children', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            birthDate,
            interests,
          }),
        });
        setStep(4);
      } catch {
        setError('Не удалось сохранить данные. Попробуйте ещё раз.');
      } finally {
        setIsSubmitting(false);
      }
    }
  }

  function handleSkip() {
    if (step < 3) {
      setStep(step + 1);
    } else if (step === 3) {
      // Skip interests, still create child if name exists
      if (name.trim().length >= 2 && birthDate) {
        setIsSubmitting(true);
        apiFetch('/users/children', {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            birthDate,
            interests: [],
          }),
        })
          .then(() => setStep(4))
          .catch(() => setStep(4))
          .finally(() => setIsSubmitting(false));
      } else {
        setStep(4);
      }
    } else {
      router.push('/classes');
    }
  }

  function handleFinish() {
    router.push('/classes');
  }

  return (
    <div className="container-page py-12">
      <div className="mx-auto max-w-lg">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-500 mb-2">
            <span>Шаг {step} из {TOTAL_STEPS}</span>
            <button
              onClick={handleSkip}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              Пропустить
            </button>
          </div>
          <div className="h-2 w-full rounded-full bg-gray-100">
            <div
              className="h-2 rounded-full bg-primary-600 transition-all duration-300"
              style={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Name */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Как зовут вашего ребёнка?
              </h1>
              <p className="mt-2 text-gray-600">
                Мы подберём подходящие занятия
              </p>
            </div>
            <Input
              label="Имя ребёнка"
              placeholder="Например, Алиса"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={error}
              autoFocus
            />
            <Button size="lg" className="w-full" onClick={handleNext}>
              Далее
            </Button>
          </div>
        )}

        {/* Step 2: Birth date */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Сколько лет?
              </h1>
              <p className="mt-2 text-gray-600">
                Укажите дату рождения, чтобы мы подобрали занятия по возрасту
              </p>
            </div>
            <Input
              label="Дата рождения"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              error={error}
              max={new Date().toISOString().split('T')[0]}
              autoFocus
            />
            <Button size="lg" className="w-full" onClick={handleNext}>
              Далее
            </Button>
          </div>
        )}

        {/* Step 3: Interests */}
        {step === 3 && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Что интересно?
              </h1>
              <p className="mt-2 text-gray-600">
                Выберите темы, которые нравятся вашему ребёнку
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {INTEREST_OPTIONS.map((interest) => {
                const isSelected = interests.includes(interest);
                return (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`rounded-xl border-2 px-4 py-3 text-sm font-medium transition-colors ${
                      isSelected
                        ? 'border-primary-600 bg-primary-50 text-primary-700'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {interest}
                  </button>
                );
              })}
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              size="lg"
              className="w-full"
              onClick={handleNext}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Сохраняем...' : 'Далее'}
            </Button>
          </div>
        )}

        {/* Step 4: Done */}
        {step === 4 && (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Готово! Мы подобрали классы для {name || 'вашего ребёнка'}
              </h1>
              <p className="mt-2 text-gray-600">
                Посмотрите занятия, которые подходят по возрасту и интересам
              </p>
            </div>
            <Button size="lg" className="w-full" onClick={handleFinish}>
              Перейти к занятиям
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
