# Архитектура: Запись на пробное занятие

## 1. Размещение компонентов

### Backend (NestJS)

| Компонент | Путь | Назначение |
|-----------|------|-----------|
| EnrollmentsController | `src/modules/enrollments/enrollments.controller.ts` | REST endpoints: POST /trial, GET /trial-status, DELETE /:id |
| EnrollmentsService | `src/modules/enrollments/enrollments.service.ts` | Бизнес-логика: eligibility check, создание/отмена записи |
| CreateTrialDto | `src/modules/enrollments/dto/create-trial.dto.ts` | Валидация входных данных: childId (UUID), sectionId (UUID) |
| EnrollmentGuard | `src/modules/enrollments/guards/enrollment.guard.ts` | Проверка: родитель является владельцем ребенка |
| Prisma Schema | `prisma/schema.prisma` | Модель Enrollment: type (TRIAL/PAID), status, childId, sectionId, classId |

### Frontend (React + TypeScript)

| Компонент | Путь | Назначение |
|-----------|------|-----------|
| TrialBookingCard | `src/components/booking/TrialBookingCard.tsx` | Основной UI: кнопка записи, статус, выбор ребенка |
| SeatAvailability | `src/components/booking/SeatAvailability.tsx` | Бейдж "осталось N мест" с цветовой индикацией |
| AgeCheck | `src/components/booking/AgeCheck.tsx` | Предупреждение при возрастном несоответствии |
| MyEnrollmentsPage | `src/pages/MyEnrollmentsPage.tsx` | Список всех записей родителя |

### Модель данных

```prisma
model Enrollment {
  id        String           @id @default(uuid())
  type      EnrollmentType   // TRIAL | PAID
  status    EnrollmentStatus // confirmed | active | completed | cancelled
  price     Decimal          @default(0)
  childId   String
  child     Child            @relation(fields: [childId], references: [id])
  sectionId String
  section   Section          @relation(fields: [sectionId], references: [id])
  classId   String
  class     Class            @relation(fields: [classId], references: [id])
  createdAt DateTime         @default(now())

  @@unique([childId, classId, type], name: "one_trial_per_class")
}
```

## 2. Зависимости модуля

```
EnrollmentsModule
  ├── imports: [PrismaModule, AuthModule, NotificationsModule]
  ├── depends on: ChildrenModule (проверка владельца)
  ├── depends on: SectionsModule (проверка мест)
  └── depends on: ClassesModule (проверка возраста)
```

## 3. Взаимодействие компонентов

```
[TrialBookingCard] ──GET /trial-status──→ [EnrollmentsController]
       │                                          │
       │                                  [EnrollmentsService.checkEligibility]
       │                                          │
       │               ←── { eligible, seats } ───┘
       │
       ├──POST /enrollments/trial──→ [EnrollmentGuard] → [EnrollmentsService]
       │                                                        │
       │                                              Prisma TX (SERIALIZABLE)
       │                                                        │
       │               ←── enrollment ──────────────────────────┘
       │
[SeatAvailability] обновляет счетчик мест
[AgeCheck] показывает/скрывает предупреждение
```

## 4. Ключевые архитектурные решения

| Решение | Обоснование |
|---------|------------|
| SERIALIZABLE транзакция | Предотвращает гонку на последнем месте |
| Уникальный составной индекс | DB-уровень гарантии one-trial-per-class |
| Async уведомления вне TX | Не блокируем транзакцию сетевыми вызовами |
| Guard для ownership | Переиспользуемый для всех enrollment-операций |
