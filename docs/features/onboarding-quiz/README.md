# Feature: Онбординг-квиз

**ID:** onboarding-quiz
**Branch:** feature/002-onboarding-quiz
**Epic:** E1
**Stories:** US-005, US-006
**Effort:** M
**Status:** done

## Описание

Многошаговый квиз для создания профиля ребенка после регистрации родителя. Четырехшаговый визард собирает имя, возраст, интересы и предпочтения ребенка. Данные сохраняются в модели Child с привязкой к родительскому аккаунту и используются для персонализации каталога занятий.

## Реализованные компоненты

### Backend
- `src/modules/users/children.controller.ts` — CRUD контроллер профилей детей
- `src/modules/users/children.service.ts` — бизнес-логика создания и обновления профилей
- `src/modules/users/dto/create-child.dto.ts` — DTO с валидацией полей ребенка
- `prisma/schema.prisma` — модель Child с полями name, birthDate, interests (String[])

### Frontend
- `src/pages/OnboardingPage.tsx` — страница-контейнер квиза
- `src/components/onboarding/StepName.tsx` — шаг 1: имя ребенка
- `src/components/onboarding/StepAge.tsx` — шаг 2: дата рождения
- `src/components/onboarding/StepInterests.tsx` — шаг 3: выбор интересов из каталога
- `src/components/onboarding/StepConfirm.tsx` — шаг 4: подтверждение и сохранение
- `src/components/onboarding/ProgressBar.tsx` — индикатор прогресса по шагам

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /users/children | Yes | Создание профиля ребенка |
| GET | /users/children | Yes | Список профилей детей текущего пользователя |

## Ключевые решения
- 4-шаговый визард с сохранением промежуточного состояния в React state (не на сервере) для минимизации запросов
- Интересы хранятся как массив строк в Prisma (Child.interests: String[]) — просто и достаточно для текущего масштаба
- Валидация возраста на бэкенде: допустимый диапазон 3-18 лет
- После завершения квиза — автоматический редирект в каталог с учетом выбранных интересов
