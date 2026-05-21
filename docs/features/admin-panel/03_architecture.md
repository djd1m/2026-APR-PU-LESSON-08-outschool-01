# Архитектура: Панель администратора

## Размещение компонентов

### Backend (NestJS)

```
packages/api/src/modules/admin/
├── admin.module.ts                — модуль NestJS, импорты, guards
├── admin.controller.ts            — REST-эндпоинты (stats, moderation, audit)
├── admin.service.ts               — агрегация данных для дашборда
├── moderation/
│   ├── teacher-moderation.service.ts  — очередь и действия над преподавателями
│   ├── review-moderation.service.ts   — очередь и действия над отзывами
│   └── batch-moderation.service.ts    — батч-операции
├── analytics/
│   ├── analytics.service.ts       — расчёт метрик (DAU, MAU, GMV, конверсии)
│   └── analytics.cache.ts         — Redis-кеширование метрик
├── audit/
│   ├── audit.service.ts           — запись и чтение аудит-логов
│   └── audit.interceptor.ts       — NestJS interceptor для автологирования
├── guards/
│   └── admin.guard.ts             — проверка роли ADMIN + 2FA
├── dto/
│   ├── stats-query.dto.ts         — from, to
│   ├── moderate-teacher.dto.ts    — action, reason
│   ├── batch-moderate.dto.ts      — teacherIds[], action, reason
│   └── moderate-review.dto.ts     — action, reason
└── entities/
    └── audit-log.entity.ts        — Prisma-модель AuditLog
```

### Frontend (Next.js)

```
packages/web/src/
├── pages/admin/
│   └── index.tsx                   — страница админ-панели с 4 вкладками
├── components/admin/
│   ├── AdminTabs.tsx               — навигация: Модерация | Преподаватели | Отзывы | Аналитика
│   ├── ModerationTab.tsx           — очередь модерации классов
│   ├── TeachersTab.tsx             — верификация преподавателей
│   ├── TeacherApplicationCard.tsx  — карточка заявки (документы, видео, кнопки)
│   ├── ReviewsTab.tsx              — модерация отзывов
│   ├── ReviewModerationCard.tsx    — карточка отзыва с флагами
│   ├── AnalyticsTab.tsx            — дашборд метрик
│   ├── MetricCard.tsx              — карточка одной метрики (значение, рост)
│   ├── TopList.tsx                 — топ-10 список (классы или преподаватели)
│   ├── PeriodSelector.tsx          — переключатель периода (день/неделя/месяц/квартал)
│   ├── BatchActions.tsx            — панель батч-операций (чекбоксы + действия)
│   └── AuditLogTable.tsx           — таблица аудит-логов
├── hooks/
│   ├── useAdminStats.ts            — React Query: метрики платформы
│   ├── useModeration.ts            — React Query: очереди модерации
│   └── useAuditLog.ts              — React Query: аудит-логи
```

### База данных

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    target_id UUID,
    target_type VARCHAR(30),
    reason TEXT,
    details JSONB,
    ip INET NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_admin ON audit_logs(admin_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_target ON audit_logs(target_id, target_type);
```

## Зависимости модулей

| Модуль | Зависит от | Тип связи |
|--------|------------|-----------|
| admin/analytics | payments | Read: GMV, средний чек |
| admin/analytics | users | Read: DAU, MAU, регистрации |
| admin/analytics | classes, sections | Read: активные классы |
| admin/moderation | teacher_profiles | Write: обновление статуса |
| admin/moderation | reviews | Write: обновление статуса |
| admin/audit | audit_logs | Write: запись действий |
| admin | Redis | Cache: метрики аналитики |
| admin | BullMQ | Async: уведомления при модерации |

## Стратегия кеширования аналитики

```
GET /admin/stats?from=...&to=...
    → Redis key: "admin:stats:{from}:{to}"
    → TTL: 15 минут (для текущего периода), 1 час (для прошлых периодов)
    → Инвалидация: не требуется (TTL-based)
```
