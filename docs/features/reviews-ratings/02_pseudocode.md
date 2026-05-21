# Псевдокод: Отзывы и рейтинги

## 1. Проверка права на отзыв

```
FUNCTION checkReviewEligibility(userId, sectionId):
    // Проверяем, что у родителя есть enrollment с завершённым занятием
    enrollment = db.enrollment.findFirst({
        userId: userId,
        sectionId: sectionId,
        status: IN ["active", "completed"]
    })
    IF NOT enrollment THEN THROW ForbiddenException("Нет завершённых занятий")

    // Проверяем посещаемость
    attendedLessons = db.attendance.count({
        enrollmentId: enrollment.id,
        status: "attended"
    })
    IF attendedLessons == 0 THEN THROW ForbiddenException("Посетите хотя бы одно занятие")

    // Проверяем уникальность отзыва
    existingReview = db.review.findFirst({ userId, sectionId })
    IF existingReview THEN THROW ConflictException("Отзыв уже существует")

    RETURN { eligible: true, enrollment }
```

## 2. Создание отзыва

```
FUNCTION createReview(userId, sectionId, rating, text):
    VALIDATE rating IN [1, 2, 3, 4, 5]
    VALIDATE text.length >= 50 AND text.length <= 2000

    checkReviewEligibility(userId, sectionId)

    // Автомодерация
    flags = autoModerate(text, userId)
    status = flags.length > 0 ? "flagged" : "pending_moderation"

    review = db.review.create({
        userId, sectionId, rating, text, status,
        flags: flags,
        autoPublishAt: status == "pending_moderation"
            ? NOW() + 24_HOURS : null
    })

    // Если нет флагов — запланировать автопубликацию
    IF status == "pending_moderation":
        queue.add("auto-publish-review", { reviewId: review.id }, { delay: 24_HOURS })

    RETURN review
```

## 3. Автомодерация

```
FUNCTION autoModerate(text, userId):
    flags = []

    // Проверка запрещённых слов
    IF containsBannedWords(text):
        flags.push("banned_words")

    // Подозрительный аккаунт (новый, сразу 5 звёзд)
    user = db.user.findUnique(userId)
    IF daysSince(user.createdAt) < 7:
        flags.push("new_account")

    // Слишком короткий текст при высоком рейтинге
    IF text.length < 80 AND rating == 5:
        flags.push("suspiciously_short_positive")

    RETURN flags
```

## 4. Пересчёт рейтинга (Bayesian Average)

```
FUNCTION recalculateRating(classId):
    // Bayesian average: (C * m + sum(ratings)) / (C + count)
    // C = 10 (вес априорного), m = 3.5 (среднее по платформе)
    C = 10
    m = 3.5

    reviews = db.review.findMany({
        classId: classId,
        status: "published"
    })

    count = reviews.length
    sum = reviews.reduce((acc, r) => acc + r.rating, 0)

    bayesianAvg = (C * m + sum) / (C + count)

    db.class.update(classId, {
        averageRating: ROUND(bayesianAvg, 2),
        reviewCount: count
    })

    // Обновить рейтинг преподавателя (среднее по всем классам)
    teacherId = db.class.findUnique(classId).teacherId
    recalculateTeacherRating(teacherId)
```

## 5. Публикация отзыва (ручная или автоматическая)

```
FUNCTION publishReview(reviewId, moderatorId = null):
    review = db.review.findUnique(reviewId)
    IF review.status == "published" THEN RETURN review

    db.review.update(reviewId, {
        status: "published",
        publishedAt: NOW(),
        moderatedBy: moderatorId
    })

    // Пересчитать рейтинги
    section = db.section.findUnique(review.sectionId)
    recalculateRating(section.classId)

    RETURN review
```

## API-контракты

| Endpoint | Method | Auth | Request | Response |
|----------|--------|------|---------|----------|
| /reviews | POST | Parent | `{ sectionId, rating, text }` | `{ review }` |
| /reviews/class/:classId | GET | Public | query: `page, limit` | `{ reviews[], total, avgRating }` |
| /reviews/:id | PATCH | Admin | `{ status, reason? }` | `{ review }` |
| /reviews/moderation | GET | Admin | query: `status, page` | `{ reviews[], total }` |

## Поток данных

```
Родитель → POST /reviews → checkEligibility → autoModerate → save
    ↓ (если нет флагов)
    BullMQ delay 24h → autoPublish → recalculateRating
    ↓ (если есть флаги)
    Очередь модерации → Админ решает → publish/reject → recalculateRating
```
