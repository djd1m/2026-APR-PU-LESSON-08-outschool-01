# Архитектура: Личный кабинет преподавателя

## Размещение компонентов

### Backend (NestJS)

```
packages/api/src/modules/users/
├── teacher-dashboard/
│   ├── teacher-dashboard.controller.ts  — REST-эндпоинты дашборда
│   ├── teacher-dashboard.service.ts     — агрегация данных
│   ├── earnings.service.ts              — расчёт заработка, баланс
│   ├── payout.service.ts                — логика вывода средств
│   ├── payout.processor.ts              — BullMQ worker для ЮKassa payouts
│   └── dto/
│       ├── earnings-query.dto.ts        — period, page, limit
│       └── payout-request.dto.ts        — amount
```

### Frontend (Next.js)

```
packages/web/src/
├── pages/teach/
│   └── dashboard.tsx                    — страница дашборда преподавателя
├── components/teach/
│   ├── EarningsCard.tsx                 — карточка: баланс, месяц, кнопка вывода
│   ├── EarningsHistory.tsx              — таблица начислений с пагинацией
│   ├── StudentsOverview.tsx             — сводка по ученикам
│   ├── StudentRow.tsx                   — строка ученика (имя, возраст, посещаемость)
│   ├── UpcomingSessions.tsx             — список ближайших занятий
│   ├── SessionCard.tsx                  — карточка занятия (название, время, записано)
│   ├── RecentReviews.tsx               — последние отзывы с рейтингом
│   ├── PayoutModal.tsx                  — модальное окно вывода средств
│   └── TeacherEmptyState.tsx            — пустые состояния для новых учителей
├── hooks/
│   ├── useTeacherDashboard.ts           — React Query: агрегированные данные
│   ├── useEarnings.ts                   — React Query: заработок и история
│   └── usePayouts.ts                    — React Query: запрос вывода
```

### База данных (дополнительные таблицы)

```sql
CREATE TABLE teacher_balances (
    teacher_id UUID PRIMARY KEY REFERENCES users(id),
    available DECIMAL(10,2) NOT NULL DEFAULT 0,
    pending_payout DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_earned DECIMAL(10,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'processing',
    yukassa_payout_id VARCHAR(100),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payouts_teacher ON payouts(teacher_id, created_at DESC);
```

## Зависимости модулей

| Модуль | Зависит от | Тип связи |
|--------|------------|-----------|
| teacher-dashboard | payments | Read: история начислений |
| teacher-dashboard | sections | Read: ученики, расписание |
| teacher-dashboard | reviews | Read: последние отзывы |
| teacher-dashboard | enrollments | Read: количество записанных |
| payout | teacher_balances | Write: обновление баланса |
| payout | ЮKassa API | External: вывод средств |
| payout | BullMQ | Async: обработка выплат |

## Диаграмма страницы

```
TeacherDashboardPage
├── EarningsCard (баланс, месячная статистика)
│   └── PayoutModal (по клику на "Вывести")
├── UpcomingSessions (список ближайших занятий)
│   └── SessionCard[] (до 5 карточек)
├── StudentsOverview (общее кол-во, список по секциям)
│   └── StudentRow[] (имя, возраст, посещаемость)
└── RecentReviews (последние 5 отзывов)
    └── ReviewCard[] (рейтинг, текст, класс)
```

Все блоки загружаются параллельно через React Query при открытии дашборда.
