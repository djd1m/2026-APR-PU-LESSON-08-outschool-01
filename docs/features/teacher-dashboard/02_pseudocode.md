# Псевдокод: Личный кабинет преподавателя

## 1. Агрегация заработка

```
FUNCTION getEarnings(teacherId, period):
    // period = { from: Date, to: Date }
    payments = db.payment.findMany({
        WHERE section.class.teacherId == teacherId
        AND status == "completed"
        AND createdAt BETWEEN period.from AND period.to
        ORDER BY createdAt DESC
    })

    grossTotal = payments.reduce((sum, p) => sum + p.amount, 0)
    commissionRate = 0.20
    commissionTotal = grossTotal * commissionRate
    netTotal = grossTotal - commissionTotal

    // Текущий баланс (доступно к выводу)
    balance = db.teacherBalance.findUnique({ teacherId })

    RETURN {
        balance: balance.available,
        pendingPayout: balance.pendingPayout,
        periodStats: {
            gross: grossTotal,
            commission: commissionTotal,
            net: netTotal,
            lessonsCount: payments.length
        },
        history: payments.map(p => ({
            date: p.createdAt,
            classTitle: p.section.class.title,
            studentsCount: p.section.enrollments.count,
            gross: p.amount,
            commission: ROUND(p.amount * commissionRate, 2),
            net: ROUND(p.amount * (1 - commissionRate), 2)
        }))
    }
```

## 2. Подсчёт учеников

```
FUNCTION getStudentsSummary(teacherId):
    sections = db.section.findMany({
        WHERE class.teacherId == teacherId
        AND status IN ["active", "upcoming"]
        INCLUDE: enrollments.child
    })

    totalStudents = new Set()
    sectionDetails = sections.map(s => {
        students = s.enrollments.map(e => {
            totalStudents.add(e.childId)
            attendance = db.attendance.count({
                enrollmentId: e.id, status: "attended"
            })
            totalSessions = db.session.count({ sectionId: s.id, status: "completed" })

            RETURN {
                childName: e.child.name,
                age: calculateAge(e.child.birthDate),
                attendanceRate: totalSessions > 0
                    ? ROUND(attendance / totalSessions * 100) : 0
            }
        })
        RETURN { sectionTitle: s.class.title, students }
    })

    RETURN {
        totalUniqueStudents: totalStudents.size,
        sections: sectionDetails
    }
```

## 3. Ближайшие занятия

```
FUNCTION getUpcomingSessions(teacherId, limit = 5):
    sessions = db.session.findMany({
        WHERE section.class.teacherId == teacherId
        AND startAt > NOW()
        AND section.status == "active"
        ORDER BY startAt ASC
        TAKE: limit
        INCLUDE: section.class, section.enrollments
    })

    RETURN sessions.map(s => ({
        id: s.id,
        classTitle: s.section.class.title,
        startAt: s.startAt,
        endAt: s.endAt,
        enrolledCount: s.section.enrollments.count,
        maxStudents: s.section.class.maxStudents,
        canStart: s.startAt - NOW() <= 15_MIN,
        joinUrl: s.startAt - NOW() <= 15_MIN ? generateTeacherJoinUrl(s) : null
    }))
```

## 4. Вывод средств

```
FUNCTION requestPayout(teacherId, amount):
    balance = db.teacherBalance.findUnique({ teacherId })

    IF amount < 1000 THEN THROW BadRequestException("Минимум 1000 руб.")
    IF amount > balance.available THEN THROW BadRequestException("Недостаточно средств")

    // Проверить, что нет активной заявки на вывод
    pendingPayout = db.payout.findFirst({
        teacherId, status: "processing"
    })
    IF pendingPayout THEN THROW ConflictException("Заявка на вывод уже создана")

    payout = db.payout.create({
        teacherId, amount, status: "processing",
        createdAt: NOW()
    })

    // Заморозить сумму на балансе
    db.teacherBalance.update(teacherId, {
        available: balance.available - amount,
        pendingPayout: balance.pendingPayout + amount
    })

    // Отправить в ЮKassa
    queue.add("process-payout", { payoutId: payout.id })

    RETURN payout
```

## 5. Последние отзывы

```
FUNCTION getRecentReviews(teacherId, limit = 5):
    reviews = db.review.findMany({
        WHERE section.class.teacherId == teacherId
        AND status == "published"
        ORDER BY publishedAt DESC
        TAKE: limit
        INCLUDE: section.class
    })

    avgRating = db.review.aggregate({
        WHERE section.class.teacherId == teacherId AND status == "published"
        AVG: rating
    })

    RETURN { reviews, averageRating: ROUND(avgRating, 1) }
```

## API-контракты

| Endpoint | Method | Auth | Параметры | Ответ |
|----------|--------|------|-----------|-------|
| /teacher/dashboard | GET | Teacher | — | `{ earnings, students, upcoming, reviews }` |
| /teacher/earnings | GET | Teacher | `from, to, page, limit` | `{ balance, periodStats, history[] }` |
| /teacher/students | GET | Teacher | — | `{ totalUniqueStudents, sections[] }` |
| /teacher/payouts | POST | Teacher | `{ amount }` | `{ payout }` |
| /teacher/payouts | GET | Teacher | `page, limit` | `{ payouts[] }` |
