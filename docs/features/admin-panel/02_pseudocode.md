# Псевдокод: Панель администратора

## 1. Агрегация метрик платформы

```
FUNCTION getPlatformStats(period):
    // period = { from: Date, to: Date, granularity: "day"|"week"|"month" }
    prevPeriod = { from: period.from - duration, to: period.from }

    // DAU/MAU
    dau = db.session_log.countDistinct("userId", {
        WHERE createdAt >= TODAY()
    })
    mau = db.session_log.countDistinct("userId", {
        WHERE createdAt >= period.from AND createdAt <= period.to
    })

    // GMV (Gross Merchandise Volume)
    gmv = db.payment.aggregate({
        SUM: amount,
        WHERE status == "completed"
        AND createdAt BETWEEN period.from AND period.to
    })
    prevGmv = db.payment.aggregate({ SUM: amount, WHERE ... prevPeriod })
    gmvGrowth = prevGmv > 0 ? ((gmv - prevGmv) / prevGmv * 100) : 0

    // Конверсия: регистрация → первая оплата
    registrations = db.user.count({
        WHERE createdAt BETWEEN period.from AND period.to
    })
    firstPayments = db.payment.countDistinct("userId", {
        WHERE createdAt BETWEEN period.from AND period.to
        AND isFirst == true
    })
    conversionRate = registrations > 0 ? (firstPayments / registrations * 100) : 0

    // Средний чек
    avgCheck = db.payment.aggregate({
        AVG: amount,
        WHERE status == "completed" AND createdAt BETWEEN period.from AND period.to
    })

    RETURN {
        dau, mau, gmv, gmvGrowth,
        conversionRate: ROUND(conversionRate, 1),
        avgCheck: ROUND(avgCheck, 0),
        activeClasses: db.class.count({ status: "published" }),
        activeSections: db.section.count({ status: "active" })
    }
```

## 2. Очередь модерации преподавателей

```
FUNCTION getTeacherModerationQueue(page, limit, status = "pending_verification"):
    offset = (page - 1) * limit

    teachers = db.teacherProfile.findMany({
        WHERE status == status,
        ORDER BY createdAt ASC,  // FIFO
        SKIP: offset, TAKE: limit,
        INCLUDE: user, documents, videoIntro
    })

    total = db.teacherProfile.count({ status })
    RETURN { teachers, total, page }
```

## 3. Батч-операция модерации

```
FUNCTION batchModerateTeachers(adminId, teacherIds, action, reason = null):
    IF teacherIds.length > 50 THEN THROW BadRequestException("Максимум 50 элементов")
    IF action == "reject" AND NOT reason THEN THROW BadRequestException("Укажите причину")

    newStatus = action == "approve" ? "verified" : "rejected"

    // Атомарная транзакция
    await db.$transaction(async (tx) => {
        FOR EACH teacherId IN teacherIds:
            teacher = tx.teacherProfile.update(teacherId, { status: newStatus })

            // Аудит-лог
            tx.auditLog.create({
                adminId, action: "teacher_" + action,
                targetId: teacherId, targetType: "teacher",
                reason, ip: request.ip, timestamp: NOW()
            })

            // Уведомление преподавателю
            queue.add("send-notification", {
                userId: teacher.userId,
                type: action == "approve" ? "teacher_verified" : "teacher_rejected",
                data: { reason }
            })
    })

    RETURN { updated: teacherIds.length, status: newStatus }
```

## 4. Топ-10 классов и преподавателей

```
FUNCTION getTopClasses(period, limit = 10):
    RETURN db.class.findMany({
        SELECT: { id, title, enrollmentCount, averageRating, teacher.displayName },
        WHERE status == "published",
        ORDER BY enrollmentCount DESC,
        TAKE: limit
    })

FUNCTION getTopTeachers(period, limit = 10):
    RETURN db.teacherProfile.findMany({
        SELECT: { userId, user.displayName, averageRating, totalStudents, classCount },
        WHERE status == "verified",
        ORDER BY averageRating DESC,
        TAKE: limit,
        HAVING: reviewCount >= 5  // минимум 5 отзывов для попадания в топ
    })
```

## 5. Аудит-логирование

```
FUNCTION logAdminAction(adminId, action, targetId, targetType, details, ip):
    db.auditLog.create({
        adminId, action, targetId, targetType,
        details: JSON.stringify(details),
        ip, userAgent: request.headers['user-agent'],
        timestamp: NOW()
    })
```

## API-контракты

| Endpoint | Method | Auth | Параметры | Ответ |
|----------|--------|------|-----------|-------|
| /admin/stats | GET | Admin | `from, to` | `{ dau, mau, gmv, ... }` |
| /admin/teachers/queue | GET | Admin | `page, limit, status` | `{ teachers[], total }` |
| /admin/teachers/batch | POST | Admin | `{ teacherIds[], action, reason? }` | `{ updated, status }` |
| /admin/teachers/:id/moderate | PATCH | Admin | `{ action, reason? }` | `{ teacher }` |
| /admin/reviews/queue | GET | Admin | `page, limit, status` | `{ reviews[], total }` |
| /admin/reviews/:id/moderate | PATCH | Admin | `{ action, reason? }` | `{ review }` |
| /admin/top/classes | GET | Admin | `from, to, limit` | `{ classes[] }` |
| /admin/top/teachers | GET | Admin | `from, to, limit` | `{ teachers[] }` |
| /admin/audit-log | GET | Admin | `page, limit, action?` | `{ logs[], total }` |
