'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

const SUBJECTS = [
  'Математика',
  'Программирование',
  'Английский язык',
  'Рисование',
  'Музыка',
  'Наука',
  'Робототехника',
];

const STEPS = ['Основное', 'Стоимость', 'Аудитория', 'Просмотр'];

interface FormData {
  title: string;
  description: string;
  subject: string;
  price: string;
  ageMin: string;
  ageMax: string;
  maxStudents: string;
  imageUrl: string;
}

const initialForm: FormData = {
  title: '',
  description: '',
  subject: '',
  price: '',
  ageMin: '3',
  ageMax: '18',
  maxStudents: '12',
  imageUrl: '',
};

export default function CreateClassPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(initialForm);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  function updateField(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function validateStep(s: number): boolean {
    const errs: Partial<FormData> = {};

    if (s === 0) {
      if (form.title.length < 5) errs.title = 'Минимум 5 символов';
      if (form.description.length < 20) errs.description = 'Минимум 20 символов';
      if (!form.subject) errs.subject = 'Выберите предмет';
    }

    if (s === 1) {
      const price = Number(form.price);
      if (!form.price || isNaN(price) || price < 500 || price > 10000) {
        errs.price = 'Цена от 500 до 10 000 ₽';
      }
    }

    if (s === 2) {
      const ageMin = Number(form.ageMin);
      const ageMax = Number(form.ageMax);
      const max = Number(form.maxStudents);
      if (isNaN(ageMin) || ageMin < 3 || ageMin > 18) errs.ageMin = 'От 3 до 18';
      if (isNaN(ageMax) || ageMax < 3 || ageMax > 18) errs.ageMax = 'От 3 до 18';
      if (ageMin > ageMax) errs.ageMax = 'Макс. возраст >= мин. возраст';
      if (isNaN(max) || max < 1 || max > 12) errs.maxStudents = 'От 1 до 12';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function nextStep() {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }
  }

  function prevStep() {
    setStep((s) => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        subject: form.subject,
        price: Number(form.price),
        ageMin: Number(form.ageMin),
        ageMax: Number(form.ageMax),
        maxStudents: Number(form.maxStudents),
        imageUrl: form.imageUrl || undefined,
      };

      const created = await apiFetch<{ id: string }>('/classes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // Auto-submit for review
      await apiFetch(`/classes/${created.id}/submit`, { method: 'POST' });

      router.push('/teach/classes');
    } catch (err: any) {
      setSubmitError(err.message || 'Произошла ошибка при создании занятия');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSaveDraft() {
    setIsSubmitting(true);
    setSubmitError('');

    try {
      const payload = {
        title: form.title.trim() || 'Черновик',
        description: form.description.trim() || 'Описание будет добавлено позже',
        subject: form.subject || 'Математика',
        price: Number(form.price) || 500,
        ageMin: Number(form.ageMin) || 3,
        ageMax: Number(form.ageMax) || 18,
        maxStudents: Number(form.maxStudents) || 12,
        imageUrl: form.imageUrl || undefined,
      };

      await apiFetch('/classes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      router.push('/teach/classes');
    } catch (err: any) {
      setSubmitError(err.message || 'Произошла ошибка при сохранении черновика');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!user || user.role !== 'TEACHER') {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Доступ ограничен</h1>
        <p className="mt-2 text-gray-600">
          Только учителя могут создавать занятия
        </p>
      </div>
    );
  }

  return (
    <div className="container-page py-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900">Создать занятие</h1>
      <p className="mt-2 text-gray-600">
        Заполните информацию о вашем занятии
      </p>

      {/* Step indicator */}
      <div className="mt-8 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              onClick={() => {
                if (i < step) setStep(i);
              }}
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                i === step
                  ? 'bg-primary-600 text-white'
                  : i < step
                    ? 'bg-primary-100 text-primary-700 cursor-pointer'
                    : 'bg-gray-100 text-gray-400'
              }`}
            >
              {i + 1}
            </button>
            <span
              className={`text-sm hidden sm:inline ${
                i === step ? 'text-gray-900 font-medium' : 'text-gray-400'
              }`}
            >
              {label}
            </span>
            {i < STEPS.length - 1 && (
              <div className="w-8 h-px bg-gray-200" />
            )}
          </div>
        ))}
      </div>

      {submitError && (
        <div className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {submitError}
        </div>
      )}

      <Card className="mt-6 p-6">
        {/* Step 0: Basic Info */}
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Основная информация
            </h2>

            <Input
              label="Название занятия"
              placeholder="Например: Программирование на Python для начинающих"
              value={form.title}
              onChange={(e) => updateField('title', e.target.value)}
              error={errors.title}
            />

            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Описание
              </label>
              <textarea
                rows={5}
                placeholder="Опишите, чему научатся ученики, формат занятий, что потребуется..."
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                className={`block w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 ${
                  errors.description
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300'
                }`}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
              <p className="mt-1 text-xs text-gray-400">
                {form.description.length} / 5000 символов (мин. 20)
              </p>
            </div>

            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Предмет
              </label>
              <select
                value={form.subject}
                onChange={(e) => updateField('subject', e.target.value)}
                className={`block w-full rounded-lg border px-3 py-2.5 text-sm text-gray-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 ${
                  errors.subject
                    ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
                    : 'border-gray-300'
                }`}
              >
                <option value="">Выберите предмет</option>
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              {errors.subject && (
                <p className="mt-1 text-sm text-red-600">{errors.subject}</p>
              )}
            </div>
          </div>
        )}

        {/* Step 1: Pricing */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">Стоимость</h2>

            <Input
              label="Цена за занятие (₽)"
              type="number"
              placeholder="1500"
              min={500}
              max={10000}
              value={form.price}
              onChange={(e) => updateField('price', e.target.value)}
              error={errors.price}
            />

            <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-600">
              <p className="font-medium text-gray-900">Комиссия платформы: 22%</p>
              {form.price && !isNaN(Number(form.price)) && (
                <p className="mt-1">
                  Вы получите:{' '}
                  <span className="font-semibold text-gray-900">
                    {Math.round(Number(form.price) * 0.78).toLocaleString('ru-RU')} ₽
                  </span>{' '}
                  за занятие
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Audience */}
        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">Аудитория</h2>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Возраст от (лет)"
                type="number"
                min={3}
                max={18}
                value={form.ageMin}
                onChange={(e) => updateField('ageMin', e.target.value)}
                error={errors.ageMin}
              />
              <Input
                label="Возраст до (лет)"
                type="number"
                min={3}
                max={18}
                value={form.ageMax}
                onChange={(e) => updateField('ageMax', e.target.value)}
                error={errors.ageMax}
              />
            </div>

            <Input
              label="Максимум учеников в группе"
              type="number"
              min={1}
              max={12}
              value={form.maxStudents}
              onChange={(e) => updateField('maxStudents', e.target.value)}
              error={errors.maxStudents}
            />

            <div className="w-full">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Изображение (URL)
              </label>
              <Input
                placeholder="https://example.com/image.jpg"
                value={form.imageUrl}
                onChange={(e) => updateField('imageUrl', e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-400">
                Необязательно. Загрузка файлов будет доступна позже.
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-lg font-semibold text-gray-900">
              Предпросмотр занятия
            </h2>

            <div className="rounded-lg border border-gray-200 overflow-hidden">
              {/* Image preview */}
              <div className="aspect-video w-full bg-gray-100 relative">
                {form.imageUrl ? (
                  <img
                    src={form.imageUrl}
                    alt={form.title}
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
                  {form.ageMin}-{form.ageMax} лет
                </Badge>
              </div>

              <div className="p-5 space-y-3">
                <Badge variant="primary">{form.subject}</Badge>
                <h3 className="text-xl font-bold text-gray-900">{form.title}</h3>
                <p className="text-gray-600 whitespace-pre-line">
                  {form.description}
                </p>

                <div className="flex items-center gap-4 pt-3 border-t border-gray-100">
                  <div>
                    <p className="text-sm text-gray-500">Цена</p>
                    <p className="text-lg font-bold text-gray-900">
                      {Number(form.price).toLocaleString('ru-RU')} &#8381;
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Учеников</p>
                    <p className="text-lg font-bold text-gray-900">
                      до {form.maxStudents}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-lg bg-blue-50 p-4 text-sm text-blue-700">
              После отправки занятие пройдёт модерацию перед публикацией.
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between">
          <div>
            {step > 0 && (
              <Button variant="outline" onClick={prevStep}>
                Назад
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {step < STEPS.length - 1 && (
              <>
                <Button
                  variant="secondary"
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
                >
                  Сохранить черновик
                </Button>
                <Button onClick={nextStep}>Далее</Button>
              </>
            )}

            {step === STEPS.length - 1 && (
              <>
                <Button
                  variant="secondary"
                  onClick={handleSaveDraft}
                  disabled={isSubmitting}
                >
                  Сохранить как черновик
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting}>
                  {isSubmitting ? 'Отправка...' : 'Отправить на модерацию'}
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
