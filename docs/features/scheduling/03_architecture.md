# Архитектура: Расписание занятий

## 1. Размещение компонентов

### Backend (NestJS)

| Компонент | Путь | Назначение |
|-----------|------|-----------|
| SectionsController | `src/modules/sections/sections.controller.ts` | CRUD endpoints: POST, PUT, DELETE, GET |
| SectionsService | `src/modules/sections/sections.service.ts` | Бизнес-логика: создание, обновление, отмена, расписание |
| SectionsConflict | `src/modules/sections/sections.conflict.ts` | Алгоритм обнаружения конфликтов по времени |
| CreateSectionDto | `src/modules/sections/dto/create-section.dto.ts` | Валидация: classId, startTime, duration (15-180), maxStudents (1-30) |
| UpdateSectionDto | `src/modules/sections/dto/update-section.dto.ts` | Partial update: startTime, duration, maxStudents |

### Frontend (React + TypeScript)

| Компонент | Путь | Назначение |
|-----------|------|-----------|
| TeacherSchedulePage | `src/pages/TeacherSchedulePage.tsx` | Страница расписания с навигацией по неделям |
| WeeklyGrid | `src/components/scheduling/WeeklyGrid.tsx` | Недельная сетка: дни (X) x часы (Y), drag-and-drop |
| SectionForm | `src/components/scheduling/SectionForm.tsx` | Форма создания/редактирования с выбором даты и времени |
| TimeSlot | `src/components/scheduling/TimeSlot.tsx` | Ячейка в сетке: цвет по заполненности, клик для деталей |
| ConflictWarning | `src/components/scheduling/ConflictWarning.tsx` | Inline-предупреждение при обнаружении конфликта |

### Модель данных

```prisma
model Section {
  id          String        @id @default(uuid())
  classId     String
  class       Class         @relation(fields: [classId], references: [id])
  startTime   DateTime      // Хранится в UTC
  duration    Int           // Минуты (15-180)
  maxStudents Int           // Лимит учеников (1-30)
  status      SectionStatus // active | cancelled | completed
  enrollments Enrollment[]
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@index([classId, startTime])
}
```

## 2. Зависимости модуля

```
SectionsModule
  ├── imports: [PrismaModule, AuthModule]
  ├── depends on: ClassesModule (ownership check)
  ├── consumed by: EnrollmentsModule (seat check)
  └── consumed by: PaymentsModule (refund on cancel)
```

## 3. Диаграмма взаимодействия

```
[TeacherSchedulePage] ─── GET /sections/teacher/schedule ──→ [SectionsController]
       │                                                            │
       │                                                   [SectionsService.getWeekSchedule]
       │                                                            │
       │                   ←── sections[] ──────────────────────────┘
       │
[WeeklyGrid] → отрисовка секций по дням/часам
       │
[SectionForm] ─── POST /sections ──→ [SectionsController]
       │                                      │
       │                             [SectionsConflict.detect]
       │                                      │
       │                             IF conflicts → 409
       │                             ELSE → db.sections.create
       │
[ConflictWarning] ← отображается при 409
```

## 4. Обработка часовых поясов

```
Frontend (Europe/Moscow)          Backend (UTC)              PostgreSQL (UTC)
  "10:00 МСК"           →    toUTC("10:00", "MSK")    →    07:00:00Z
                         ←    fromUTC(07:00:00Z)       ←    07:00:00Z
  "10:00 МСК"
```

## 5. Ключевые архитектурные решения

| Решение | Обоснование |
|---------|------------|
| UTC хранение | Единый формат, нет проблем с DST в БД |
| Conflict detection на backend | Гарантия: frontend может ошибиться, backend — источник правды |
| Computed endTime | Не хранится в БД, рассчитывается как startTime + duration |
| Индекс (classId, startTime) | Быстрый запрос расписания и обнаружение конфликтов |
| Drag-and-drop в WeeklyGrid | UX: быстрое создание секции перетаскиванием |
