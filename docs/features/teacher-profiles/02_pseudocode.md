# Псевдокод: Профили учителей

## 1. CRUD профиля учителя

```
FUNCTION updateTeacherProfile(userId, dto):
    teacher = db.teacher.findUnique({ userId })
    IF NOT teacher:
        THROW NotFoundException("Профиль учителя не найден")

    // Валидация
    VALIDATE dto.bio IS string, max 2000 chars (optional)
    VALIDATE dto.qualification IS string, max 1000 chars (optional)
    VALIDATE dto.subjects IS array of known subjects (optional)
    VALIDATE dto.avatar IS url or null (optional)

    updated = db.teacher.update(teacher.id, {
        bio: dto.bio ?? teacher.bio,
        qualification: dto.qualification ?? teacher.qualification,
        subjects: dto.subjects ?? teacher.subjects,
        avatar: dto.avatar ?? teacher.avatar,
        updatedAt: NOW()
    })

    RETURN sanitize(updated)
```

## 2. Workflow верификации

```
STATE_MACHINE TeacherVerification:
    STATES: UNVERIFIED → PENDING → VERIFIED | REJECTED
    TRANSITIONS:
        UNVERIFIED → PENDING:  teacher.requestVerification()
        PENDING → VERIFIED:    admin.approve()
        PENDING → REJECTED:    admin.reject(reason)
        REJECTED → PENDING:    teacher.requestVerification() (повторная подача)

FUNCTION requestVerification(userId):
    teacher = db.teacher.findUnique({ userId })

    // Проверка полноты профиля
    IF NOT teacher.bio OR teacher.bio.length < 50:
        THROW BadRequestException("Биография должна содержать минимум 50 символов")
    IF NOT teacher.qualification OR teacher.qualification.length < 20:
        THROW BadRequestException("Укажите квалификацию")
    IF teacher.verificationStatus == "PENDING":
        THROW ConflictException("Запрос уже отправлен")
    IF teacher.verificationStatus == "VERIFIED":
        THROW ConflictException("Профиль уже верифицирован")

    updated = db.teacher.update(teacher.id, {
        verificationStatus: "PENDING",
        verificationRequestedAt: NOW()
    })

    // Уведомление администраторам
    notificationService.notify("ADMIN", {
        type: "TEACHER_VERIFICATION_REQUEST",
        teacherId: teacher.id,
        teacherName: teacher.displayName
    })

    RETURN updated

FUNCTION approveVerification(teacherId, adminId):
    teacher = db.teacher.findUnique(teacherId)
    IF teacher.verificationStatus != "PENDING":
        THROW BadRequestException("Учитель не в статусе ожидания")

    db.teacher.update(teacher.id, {
        verificationStatus: "VERIFIED",
        verifiedAt: NOW(),
        verifiedBy: adminId
    })

FUNCTION rejectVerification(teacherId, adminId, reason):
    VALIDATE reason IS non_empty_string
    teacher = db.teacher.findUnique(teacherId)
    IF teacher.verificationStatus != "PENDING":
        THROW BadRequestException("Учитель не в статусе ожидания")

    db.teacher.update(teacher.id, {
        verificationStatus: "REJECTED",
        rejectionReason: reason,
        rejectedAt: NOW(),
        rejectedBy: adminId
    })
```

## 3. Агрегация рейтинга

```
FUNCTION recalculateRating(teacherId):
    reviews = db.review.findMany({ teacherId, status: "APPROVED" })

    IF reviews.length == 0:
        db.teacher.update(teacherId, { rating: 0, reviewCount: 0 })
        RETURN

    totalScore = SUM(reviews.map(r => r.score))
    avgRating = ROUND(totalScore / reviews.length, 2)

    db.teacher.update(teacherId, {
        rating: avgRating,
        reviewCount: reviews.length
    })

    // Вызывается триггером после создания/обновления/удаления отзыва
```

## 4. Список учителей с фильтрацией

```
FUNCTION listTeachers(params):
    where = {}

    IF params.subject:
        where.subjects = { has: params.subject }
    IF params.minRating:
        where.rating = { gte: params.minRating }
    IF params.query:
        where.OR = [
            { user: { displayName: { contains: params.query, mode: "insensitive" } } },
            { bio: { contains: params.query, mode: "insensitive" } }
        ]

    // Только учителя с хотя бы 1 опубликованным занятием (или верифицированные)
    where.OR_visibility = [
        { verificationStatus: "VERIFIED" },
        { classes: { some: { status: "PUBLISHED" } } }
    ]

    teachers = db.teacher.findMany({
        where,
        orderBy: { rating: "desc" },
        include: { user: { select: { displayName: true, avatar: true } } },
        take: params.limit || 20,
        skip: params.offset || 0
    })

    total = db.teacher.count({ where })

    RETURN { items: teachers, total }
```

## API-контракты

| Endpoint | Request | Response |
|----------|---------|----------|
| GET /teachers | query?, subject?, minRating?, limit?, offset? | `{ items[], total }` |
| GET /teachers/:id | - | `{ id, bio, qualification, subjects, rating, reviewCount, verified, classes[] }` |
| PUT /teachers/me | `{ bio?, qualification?, subjects?, avatar? }` | `{ id, bio, qualification, ... }` |
| POST /teachers/me/verify | - | `{ verificationStatus: "PENDING" }` |
