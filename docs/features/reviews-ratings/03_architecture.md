# Архитектура: Отзывы и рейтинги

## Размещение компонентов

### Backend (NestJS)

```
packages/api/src/modules/reviews/
├── reviews.module.ts           — модуль NestJS, импорты
├── reviews.controller.ts       — REST-эндпоинты (CRUD, модерация)
├── reviews.service.ts          — бизнес-логика (eligibility, CRUD)
├── reviews.moderation.ts       — автомодерация (banned words, heuristics)
├── reviews.rating.ts           — расчёт Bayesian average
├── dto/
│   ├── create-review.dto.ts    — валидация входных данных
│   └── moderate-review.dto.ts  — действия модерации
├── entities/
│   └── review.entity.ts        — Prisma-модель Review
└── reviews.processor.ts        — BullMQ worker (auto-publish)
```

### Frontend (Next.js)

```
packages/web/src/
├── components/reviews/
│   ├── ReviewCard.tsx           — карточка одного отзыва (аватар, рейтинг, текст)
│   ├── ReviewForm.tsx           — форма отправки отзыва (звёзды + textarea)
│   ├── ReviewList.tsx           — список отзывов с пагинацией
│   ├── RatingStars.tsx          — компонент звёзд (display + interactive)
│   └── RatingSummary.tsx        — сводка: средний рейтинг, распределение по звёздам
├── pages/admin/
│   └── moderation/reviews.tsx   — страница модерации отзывов
└── hooks/
    └── useReviews.ts            — React Query хуки (list, create, moderate)
```

### База данных

```sql
CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    section_id UUID NOT NULL REFERENCES sections(id),
    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text TEXT NOT NULL CHECK (char_length(text) >= 50),
    status VARCHAR(20) NOT NULL DEFAULT 'pending_moderation',
    flags JSONB DEFAULT '[]',
    moderated_by UUID REFERENCES users(id),
    moderation_reason TEXT,
    auto_publish_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, section_id)
);

CREATE INDEX idx_reviews_class ON reviews(section_id, status);
CREATE INDEX idx_reviews_moderation ON reviews(status) WHERE status IN ('pending_moderation', 'flagged');
```

## Зависимости модулей

| Модуль | Зависит от | Тип связи |
|--------|------------|-----------|
| reviews | users | FK: userId → users.id |
| reviews | sections | FK: sectionId → sections.id |
| reviews | enrollments | Проверка eligibility (read-only) |
| reviews | classes | Обновление averageRating |
| reviews | BullMQ | Отложенная автопубликация |

## Диаграмма взаимодействия

```
ReviewForm → POST /reviews → ReviewsController
    → ReviewsService.create()
        → checkEligibility(enrollments)
        → autoModerate(text)
        → save to DB
        → queue auto-publish (BullMQ)

ReviewList → GET /reviews/class/:id → ReviewsController
    → ReviewsService.findByClass()
        → DB query with pagination
        → return reviews + avgRating

AdminModerationPage → GET /reviews/moderation → ReviewsController
    → ReviewsService.findPendingModeration()

AdminModerationPage → PATCH /reviews/:id → ReviewsController
    → ReviewsService.moderate()
        → update status
        → recalculateRating()
```
