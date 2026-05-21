# Архитектура: Профили учителей

## Размещение компонентов

```
src/
  modules/
    teachers/
      teachers.module.ts           # NestJS модуль учителей
      teachers.controller.ts       # REST: список, профиль, обновление, верификация
      teachers.service.ts          # Бизнес-логика: CRUD, рейтинг, верификация
      dto/
        update-teacher.dto.ts      # bio, qualification, subjects, avatar
        verify-teacher.dto.ts      # Запрос на верификацию (пустое body)
        list-teachers.dto.ts       # query, subject, minRating, limit, offset
        reject-teacher.dto.ts      # reason: string (для администратора)
      guards/
        teacher-owner.guard.ts     # Проверка, что запрос от владельца профиля

frontend/src/
  pages/
    TeachersPage.tsx               # Список учителей с поиском и фильтрами
    TeacherProfilePage.tsx         # Публичный профиль (для всех)
    TeacherDashboardPage.tsx       # Личный кабинет (только для владельца)
  components/
    teachers/
      TeacherCard.tsx              # Карточка в списке: аватар, имя, предметы, рейтинг
      VerificationBadge.tsx        # Бейдж верификации (зеленая галочка)
      RatingStars.tsx              # 5 звезд с заполнением по рейтингу
      TeacherForm.tsx              # Форма редактирования профиля
      SubjectTags.tsx              # Теги предметов учителя
```

## Зависимости модуля

```
TeachersModule
  ├── imports: PrismaModule, AuthModule (JwtAuthGuard, RolesGuard)
  ├── imports: NotificationsModule (для уведомления админа о верификации)
  ├── providers: TeachersService
  ├── controllers: TeachersController
  └── exports: TeachersService
```

## Схема данных (Prisma)

```prisma
model Teacher {
  id                     String               @id @default(uuid())
  userId                 String               @unique
  user                   User                 @relation(fields: [userId], references: [id])
  bio                    String?
  qualification          String?
  subjects               String[]             // ["математика", "физика"]
  rating                 Float                @default(0)
  reviewCount            Int                  @default(0)
  verificationStatus     VerificationStatus   @default(UNVERIFIED)
  verificationRequestedAt DateTime?
  verifiedAt             DateTime?
  verifiedBy             String?
  rejectionReason        String?
  createdAt              DateTime             @default(now())
  updatedAt              DateTime             @updatedAt
  classes                Class[]
  reviews                Review[]

  @@index([verificationStatus])
  @@index([rating])
}

enum VerificationStatus {
  UNVERIFIED
  PENDING
  VERIFIED
  REJECTED
}
```

## Диаграмма потоков

### Публичный просмотр
```
Родитель ─> GET /teachers/:id ─> TeachersController ─> TeachersService
                                                           │
                                  ┌────────────────────────┘
                                  ├─ db.teacher.findUnique (профиль)
                                  ├─ db.class.findMany (занятия учителя)
                                  └─ return { teacher, classes }
```

### Workflow верификации
```
Учитель                    Администратор              Система
  │                              │                       │
  ├─ PUT /teachers/me ──────────>│                       │
  │  (заполняет профиль)         │                       │
  ├─ POST /teachers/me/verify ──>│                       │
  │                              │                       ├─ status = PENDING
  │                              │                       ├─ notify(ADMIN)
  │                              ├─ POST approve/reject ─>│
  │                              │                       ├─ status = VERIFIED/REJECTED
  │<─── уведомление ────────────┤<──────────────────────┤
```

## Границы модуля

- **TeachersModule** управляет только профилями и верификацией
- Рейтинг пересчитывается через event listener при создании/изменении Review
- Занятия учителя загружаются через relation, не дублируя логику ClassesModule
- Публичный профиль доступен всем (без JWT), личный кабинет — только владельцу

## Интеграционные точки

| Потребитель | Что использует | Способ |
|-------------|---------------|--------|
| ClassesModule | Teacher entity (автор занятия) | Prisma relation |
| ClassDetailPage | Мини-профиль учителя | Include в запросе класса |
| AdminPanel | Список PENDING верификаций | GET /admin/verifications |
| NotificationsModule | Уведомление о верификации | Event-based |
