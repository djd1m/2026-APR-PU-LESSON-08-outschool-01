# Архитектура: Онбординг-квиз

## Размещение компонентов

```
src/
  modules/
    users/
      users.module.ts              # Расширение модуля пользователей
      children.controller.ts       # REST: POST /users/children, GET /users/children
      children.service.ts          # Бизнес-логика: создание, валидация, список
      dto/
        create-child.dto.ts        # name, birthDate, interests[] — class-validator
      interests.controller.ts      # GET /interests — справочник интересов
  prisma/
    schema.prisma                  # Модель Child

frontend/src/
  pages/
    OnboardingPage.tsx             # Контейнер квиза, управление шагами
  components/
    onboarding/
      StepName.tsx                 # Шаг 1: ввод имени
      StepAge.tsx                  # Шаг 2: выбор даты рождения
      StepInterests.tsx            # Шаг 3: выбор интересов из каталога
      StepConfirm.tsx              # Шаг 4: итоговая карточка + кнопка "Готово"
      ProgressBar.tsx              # Индикатор шага (1/4, 2/4, 3/4, 4/4)
      InterestChip.tsx             # Чип интереса с иконкой и toggle-состоянием
  hooks/
    useQuizState.ts                # React hook: state machine квиза
  constants/
    interests.ts                   # Каталог интересов (id, label, icon, subjects)
```

## Зависимости модуля

```
UsersModule (расширение)
  ├── controllers: ChildrenController, InterestsController
  ├── providers: ChildrenService
  ├── imports: PrismaModule, AuthModule (для JwtAuthGuard)
  └── exports: ChildrenService
```

## Схема данных (Prisma)

```prisma
model Child {
  id         String   @id @default(uuid())
  parentId   String
  parent     User     @relation(fields: [parentId], references: [id])
  name       String
  birthDate  DateTime
  interests  String[] // массив ID интересов: ["math", "art"]
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@index([parentId])
}
```

## Диаграмма потока

```
Регистрация завершена
        │
        ▼
  ┌─────────────┐
  │  Шаг 1: Имя │ ←── "Назад" из шага 2
  └──────┬──────┘
         │ "Далее" (name не пустое)
         ▼
  ┌──────────────┐
  │ Шаг 2: Возраст│ ←── "Назад" из шага 3
  └──────┬───────┘
         │ "Далее" (возраст 3-18)
         ▼
  ┌────────────────┐
  │ Шаг 3: Интересы │ ←── "Назад" из шага 4
  └──────┬─────────┘
         │ "Далее" (>=1 интерес)
         ▼
  ┌─────────────────────┐
  │ Шаг 4: Подтверждение │
  └──────┬──────────────┘
         │ "Готово"
         ▼
    POST /users/children
         │
         ▼
    Каталог (?subjects=...)
```

**Пропуск:** на любом шаге кнопка "Пропустить" -> каталог без фильтров, `quiz_skipped=true` в localStorage.

## Границы модуля

- **ChildrenController** — часть UsersModule, не отдельный модуль
- Квиз — чисто frontend state machine, промежуточные данные НЕ отправляются на сервер
- Каталог интересов статичен (hardcoded), не требует отдельной таблицы
- При добавлении второго ребенка используется тот же квиз-компонент

## Интеграционные точки

| Потребитель | Что использует | Способ |
|-------------|---------------|--------|
| CatalogPage | Child.interests | Маппинг интересов в subject-фильтры |
| UserProfile | Children список | GET /users/children |
| OnboardingPage | AuthContext | Проверка авторизации, redirect если не залогинен |
