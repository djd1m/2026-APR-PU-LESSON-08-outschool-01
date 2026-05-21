# Псевдокод: Личный кабинет родителя

## 1. Агрегация данных для расписания

```
FUNCTION getSchedule(parentId, weekStart, timezone):
    children = db.child.findMany({ parentId })
    childIds = children.map(c => c.id)

    weekEnd = weekStart + 7_DAYS

    // Получить все занятия детей на неделю
    sessions = db.session.findMany({
        WHERE enrollment.childId IN childIds
        AND enrollment.status IN ["active", "confirmed"]
        AND session.startAt >= weekStart
        AND session.startAt < weekEnd
        ORDER BY session.startAt ASC
        INCLUDE: section.class.title, section.class.teacher.displayName
    })

    // Конвертировать время в часовой пояс родителя
    RETURN sessions.map(s => ({
        id: s.id,
        classTitle: s.section.class.title,
        teacherName: s.section.class.teacher.displayName,
        childName: s.enrollment.child.name,
        startAt: convertTZ(s.startAt, timezone),
        endAt: convertTZ(s.endAt, timezone),
        joinUrl: s.startAt - NOW() <= 15_MIN ? generateJoinUrl(s) : null
    }))
```

## 2. Расчёт прогресса ребёнка

```
FUNCTION getChildProgress(childId):
    enrollments = db.enrollment.findMany({
        childId: childId,
        status: IN ["active", "completed"],
        INCLUDE: section.class, section.sessions, attendance
    })

    courses = enrollments.map(e => {
        totalSessions = e.section.sessions.length
        attendedSessions = e.attendance.filter(a => a.status == "attended").length

        RETURN {
            classTitle: e.section.class.title,
            totalSessions: totalSessions,
            attendedSessions: attendedSessions,
            progressPercent: ROUND(attendedSessions / totalSessions * 100),
            status: e.status
        }
    })

    // Геймификация
    gamification = db.gamification.findUnique({ childId })

    RETURN {
        courses,
        xp: gamification?.xp ?? 0,
        level: gamification?.level ?? 1,
        badges: db.badge.findMany({ childId, earned: true }),
        attendanceRate: calculateOverallAttendance(enrollments)
    }
```

## 3. Агрегация истории платежей

```
FUNCTION getPaymentHistory(parentId, page, limit):
    offset = (page - 1) * limit

    payments = db.payment.findMany({
        WHERE userId: parentId,
        ORDER BY createdAt DESC,
        SKIP: offset,
        TAKE: limit,
        INCLUDE: enrollment.section.class.title
    })

    total = db.payment.count({ userId: parentId })

    RETURN {
        payments: payments.map(p => ({
            id: p.id,
            date: p.createdAt,
            amount: p.amount,
            classTitle: p.enrollment.section.class.title,
            status: p.status,  // completed | refunded | pending
            receiptUrl: p.status == "completed" ? `/payments/${p.id}/receipt` : null
        })),
        total,
        page,
        totalPages: CEIL(total / limit)
    }
```

## 4. Управление профилями детей

```
FUNCTION addChild(parentId, data):
    VALIDATE data.name LENGTH 2..50
    VALIDATE data.birthDate IS valid_date AND age BETWEEN 3 AND 18

    childCount = db.child.count({ parentId })
    IF childCount >= 10 THEN THROW BadRequestException("Максимум 10 детей")

    child = db.child.create({
        parentId,
        name: data.name,
        birthDate: data.birthDate,
        interests: data.interests ?? [],
        avatar: data.avatar ?? generateDefaultAvatar(data.name)
    })

    // Обновить рекомендации
    queue.add("update-recommendations", { parentId })

    RETURN child
```

## API-контракты

| Endpoint | Method | Auth | Параметры | Ответ |
|----------|--------|------|-----------|-------|
| /dashboard/schedule | GET | Parent | `weekStart, timezone` | `{ sessions[] }` |
| /dashboard/progress/:childId | GET | Parent | — | `{ courses[], xp, level, badges[] }` |
| /dashboard/payments | GET | Parent | `page, limit` | `{ payments[], total, page }` |
| /children | GET | Parent | — | `{ children[] }` |
| /children | POST | Parent | `{ name, birthDate, interests }` | `{ child }` |
| /children/:id | PATCH | Parent | `{ name?, interests? }` | `{ child }` |
| /payments/:id/receipt | GET | Parent | — | PDF-файл |
