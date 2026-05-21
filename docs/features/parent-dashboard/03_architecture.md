# Архитектура: Личный кабинет родителя

## Размещение компонентов

### Backend (NestJS)

```
packages/api/src/modules/users/
├── dashboard/
│   ├── dashboard.controller.ts    — REST-эндпоинты дашборда (schedule, progress, payments)
│   ├── dashboard.service.ts       — агрегация данных из нескольких модулей
│   └── dto/
│       ├── schedule-query.dto.ts  — weekStart, timezone
│       └── payments-query.dto.ts  — page, limit
├── children/
│   ├── children.controller.ts     — CRUD профилей детей
│   ├── children.service.ts        — бизнес-логика
│   └── dto/
│       ├── create-child.dto.ts
│       └── update-child.dto.ts
```

### Frontend (Next.js)

```
packages/web/src/
├── pages/dashboard/
│   └── index.tsx                   — страница дашборда с табами
├── components/dashboard/
│   ├── DashboardTabs.tsx           — навигация по вкладкам
│   ├── ScheduleTab.tsx             — вкладка расписания (календарь на неделю)
│   ├── ScheduleCard.tsx            — карточка одного занятия в расписании
│   ├── ProgressTab.tsx             — вкладка прогресса (переключатель детей)
│   ├── ProgressCard.tsx            — прогресс по одному курсу (прогресс-бар)
│   ├── PaymentsTab.tsx             — вкладка платежей (таблица с пагинацией)
│   ├── ChildrenTab.tsx             — вкладка управления профилями детей
│   ├── ChildCard.tsx               — карточка ребёнка
│   ├── ChildForm.tsx               — форма добавления/редактирования ребёнка
│   └── EmptyState.tsx              — компонент пустого состояния
├── hooks/
│   ├── useDashboard.ts             — React Query: schedule, progress
│   ├── usePayments.ts              — React Query: payment history
│   └── useChildren.ts              — React Query: CRUD children
```

### Зависимости модулей

| Модуль | Зависит от | Тип связи |
|--------|------------|-----------|
| dashboard | enrollments | Read: активные записи детей |
| dashboard | sessions | Read: расписание занятий |
| dashboard | payments | Read: история платежей |
| dashboard | gamification | Read: XP, бейджи |
| children | users | FK: parentId → users.id |
| children | recommendations (MCP) | Trigger: обновление рекомендаций |

### Стратегия загрузки данных

```
DashboardPage
├── ScheduleTab  → GET /dashboard/schedule     (prefetch при mount)
├── ProgressTab  → GET /dashboard/progress/:id (lazy load при клике)
├── PaymentsTab  → GET /dashboard/payments     (lazy load при клике)
└── ChildrenTab  → GET /children               (lazy load при клике)
```

- Первая вкладка (Расписание) загружается при открытии дашборда
- Остальные вкладки загружаются лениво при первом клике
- React Query с `staleTime: 5min` для кеширования между переключениями табов

### Диаграмма компонентов

```
DashboardPage
  └── DashboardTabs (state: activeTab)
      ├── ScheduleTab
      │   └── ScheduleCard[] (map sessions)
      ├── ProgressTab
      │   ├── ChildSelector (dropdown)
      │   └── ProgressCard[] (map courses)
      ├── PaymentsTab
      │   └── PaymentRow[] + Pagination
      └── ChildrenTab
          ├── ChildCard[] (map children)
          └── ChildForm (modal)
```
