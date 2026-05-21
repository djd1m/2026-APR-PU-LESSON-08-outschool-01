# Архитектура: Создание и модерация занятий

## Размещение компонентов

```
src/
  modules/
    classes/
      classes.module.ts            # NestJS модуль (расширение каталога)
      classes.controller.ts        # REST: CRUD + модерация
      classes.service.ts           # Бизнес-логика: создание, переходы статусов
      classes.search.ts            # Индексация ES при публикации
      slug.service.ts              # Генерация уникальных slug с транслитерацией
      dto/
        create-class.dto.ts        # title, description, subject, ageMin, ageMax, price, format
        update-class.dto.ts        # Partial<CreateClassDto>
        reject-class.dto.ts        # reason: string
      guards/
        class-owner.guard.ts       # Проверка teacherId == class.teacherId

frontend/src/
  pages/
    ClassCreatePage.tsx            # Форма создания (новое занятие)
    ClassEditPage.tsx              # Форма редактирования (существующее)
    ModerationPage.tsx             # Админ: очередь PENDING_REVIEW
    TeacherClassesPage.tsx         # Личный кабинет: мои занятия
  components/
    classes/
      ClassForm.tsx                # Переиспользуемая форма (create + edit)
      StatusBadge.tsx              # Бейдж: DRAFT(серый), PENDING(желтый), PUBLISHED(зеленый), REJECTED(красный)
      ModerationActions.tsx        # Кнопки "Одобрить" / "Отклонить" + поле причины
      RejectionNotice.tsx          # Карточка с причиной отклонения для учителя
```

## Зависимости модуля

```
ClassesModule
  ├── imports: PrismaModule, SearchModule, AuthModule, NotificationsModule
  ├── providers: ClassesService, SlugService, ClassesSearchService
  ├── controllers: ClassesController
  └── exports: ClassesService
```

## Схема данных (Prisma)

```prisma
model Class {
  id              String       @id @default(uuid())
  teacherId       String
  teacher         Teacher      @relation(fields: [teacherId], references: [id])
  title           String
  slug            String       @unique
  description     String?
  subject         String
  ageMin          Int
  ageMax          Int
  price           Int          // в рублях
  format          ClassFormat
  status          ClassStatus  @default(DRAFT)
  submittedAt     DateTime?
  publishedAt     DateTime?
  approvedBy      String?
  rejectionReason String?
  rejectedAt      DateTime?
  rejectedBy      String?
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([teacherId])
  @@index([status])
  @@index([slug])
}

enum ClassStatus {
  DRAFT
  PENDING_REVIEW
  PUBLISHED
  REJECTED
}

enum ClassFormat {
  ONLINE
  OFFLINE
  HYBRID
}
```

## Диаграмма state machine

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
              ┌──────────┐     submit()    ┌────────────────┐ │
              │  DRAFT   │ ──────────────> │ PENDING_REVIEW │ │
              └──────────┘                 └───────┬────────┘ │
                    ▲                         │         │      │
                    │                   approve()  reject()    │
                    │                         │         │      │
                    │                         ▼         ▼      │
                    │                 ┌───────────┐ ┌──────────┘
                    │                 │ PUBLISHED │ │ REJECTED │
                    │                 └─────┬─────┘ └──────────┘
                    │                       │           │
                    │                 unpublish()  resubmit()
                    │                       │           │
                    └───────────────────────┘           │
                    └──────────────────────────────────-┘
```

## Потоки модерации

### Учитель → Модерация → Публикация
```
Учитель                   ClassesController        ClassesService         Elasticsearch
  │                             │                       │                      │
  ├─ POST /classes ────────────>│                       │                      │
  │                             ├─ create() ──────────>│                      │
  │                             │                       ├─ generateSlug() ────│
  │                             │                       ├─ db.create(DRAFT) ──│
  │<── { class, DRAFT } ───────┤                       │                      │
  │                             │                       │                      │
  ├─ POST /classes/:id/submit ─>│                       │                      │
  │                             ├─ submit() ──────────>│                      │
  │                             │                       ├─ validate fields ───│
  │                             │                       ├─ status=PENDING ────│
  │<── { PENDING_REVIEW } ─────┤                       │                      │
  │                             │                       │                      │
  │    [Администратор]          │                       │                      │
  │ POST /classes/:id/approve ─>│                       │                      │
  │                             ├─ approve() ─────────>│                      │
  │                             │                       ├─ status=PUBLISHED ──│
  │                             │                       ├─ indexClass() ──────>│
  │<── { PUBLISHED } ──────────┤                       │                      │
```

## Границы модуля

- CRUD и модерация — в одном ClassesModule (общие entities)
- Админские endpoints защищены @Roles(Role.ADMIN)
- Учительские endpoints защищены ClassOwnerGuard
- Индексация в ES только при PUBLISHED; удаление из ES при unpublish
- SlugService переиспользуемый (может применяться для teacher profiles в будущем)

## Интеграционные точки

| Потребитель | Что использует | Способ |
|-------------|---------------|--------|
| ClassesSearchService | Class entity при индексации | Прямой вызов |
| CatalogPage | Только PUBLISHED занятия | ES-индекс (не PostgreSQL) |
| TeacherProfile | Список занятий учителя | Prisma relation |
| NotificationsModule | События submit/approve/reject | Event emitter |
