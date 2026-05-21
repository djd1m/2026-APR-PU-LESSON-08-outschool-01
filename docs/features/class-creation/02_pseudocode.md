# Псевдокод: Создание и модерация занятий

## 1. Машина состояний жизненного цикла занятия

```
STATE_MACHINE ClassLifecycle:
    STATES: DRAFT → PENDING_REVIEW → PUBLISHED | REJECTED
    TRANSITIONS:
        DRAFT → PENDING_REVIEW:      teacher.submit()    [обязательные поля заполнены]
        PENDING_REVIEW → PUBLISHED:  admin.approve()      [индексация в ES]
        PENDING_REVIEW → REJECTED:   admin.reject(reason) [reason обязателен]
        REJECTED → DRAFT:            teacher.edit()        [автоматически при редактировании]
        REJECTED → PENDING_REVIEW:   teacher.resubmit()   [повторная отправка]
        PUBLISHED → DRAFT:           teacher.unpublish()   [удаление из ES]

FUNCTION validateTransition(currentStatus, targetStatus):
    allowed = {
        DRAFT: [PENDING_REVIEW],
        PENDING_REVIEW: [PUBLISHED, REJECTED],
        REJECTED: [DRAFT, PENDING_REVIEW],
        PUBLISHED: [DRAFT]
    }
    IF targetStatus NOT IN allowed[currentStatus]:
        THROW BadRequestException(
            "Переход из " + currentStatus + " в " + targetStatus + " невозможен"
        )
```

## 2. Создание занятия

```
FUNCTION createClass(teacherId, dto):
    // Валидация
    VALIDATE dto.title IS non_empty, max 200 chars
    VALIDATE dto.description IS string, max 5000 chars (optional for DRAFT)
    VALIDATE dto.subject IS known_subject
    VALIDATE dto.ageMin >= 3 AND dto.ageMax <= 18 AND dto.ageMin <= dto.ageMax
    VALIDATE dto.price >= 0 AND dto.price <= 50000
    VALIDATE dto.format IN ["ONLINE", "OFFLINE", "HYBRID"]

    // Проверка лимита
    activeCount = db.class.count({ teacherId, status: { not: "DRAFT" } })
    IF activeCount >= 50:
        THROW BadRequestException("Достигнут лимит занятий (50)")

    // Генерация slug
    slug = generateSlug(dto.title)

    classEntity = db.class.create({
        teacherId,
        title: dto.title,
        description: dto.description,
        subject: dto.subject,
        ageMin: dto.ageMin,
        ageMax: dto.ageMax,
        price: dto.price,
        format: dto.format,
        slug: slug,
        status: "DRAFT"
    })

    RETURN classEntity
```

## 3. Генерация slug с транслитерацией

```
TRANSLITERATION_MAP = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e",
    "ё": "yo", "ж": "zh", "з": "z", "и": "i", "й": "y", "к": "k",
    "л": "l", "м": "m", "н": "n", "о": "o", "п": "p", "р": "r",
    "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts",
    "ч": "ch", "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "",
    "э": "e", "ю": "yu", "я": "ya"
}

FUNCTION generateSlug(title):
    // Транслитерация кириллицы
    slug = title.toLowerCase()
    FOR char, replacement IN TRANSLITERATION_MAP:
        slug = slug.replace(char, replacement)

    // Очистка
    slug = slug.replace(/[^a-z0-9]+/g, "-")    // не-буквенные → дефисы
    slug = slug.replace(/^-|-$/g, "")            // убрать крайние дефисы
    slug = slug.substring(0, 100)                // ограничить длину

    // Уникальность
    existing = db.class.count({ slug: { startsWith: slug } })
    IF existing > 0:
        slug = slug + "-" + (existing + 1)

    RETURN slug
```

## 4. Отправка на модерацию

```
FUNCTION submitForReview(classId, teacherId):
    classEntity = db.class.findUnique(classId)

    // Проверка владельца
    IF classEntity.teacherId != teacherId:
        THROW ForbiddenException("Вы не являетесь автором этого занятия")

    validateTransition(classEntity.status, "PENDING_REVIEW")

    // Проверка обязательных полей
    required = ["title", "description", "subject", "ageMin", "ageMax", "price", "format"]
    missing = required.filter(field => !classEntity[field])
    IF missing.length > 0:
        THROW BadRequestException("Заполните обязательные поля: " + missing.join(", "))

    db.class.update(classId, {
        status: "PENDING_REVIEW",
        submittedAt: NOW()
    })

    notificationService.notify("ADMIN", {
        type: "CLASS_SUBMITTED",
        classId, title: classEntity.title
    })
```

## 5. Одобрение / Отклонение

```
FUNCTION approveClass(classId, adminId):
    classEntity = db.class.findUnique(classId)
    validateTransition(classEntity.status, "PUBLISHED")

    db.class.update(classId, {
        status: "PUBLISHED",
        publishedAt: NOW(),
        approvedBy: adminId
    })

    // Индексация в Elasticsearch
    classesSearchService.indexClass(classEntity)

    notificationService.notify(classEntity.teacherId, {
        type: "CLASS_APPROVED",
        classId, title: classEntity.title
    })

FUNCTION rejectClass(classId, adminId, reason):
    VALIDATE reason IS non_empty_string, min 10 chars
    classEntity = db.class.findUnique(classId)
    validateTransition(classEntity.status, "REJECTED")

    db.class.update(classId, {
        status: "REJECTED",
        rejectionReason: reason,
        rejectedAt: NOW(),
        rejectedBy: adminId
    })

    notificationService.notify(classEntity.teacherId, {
        type: "CLASS_REJECTED",
        classId, title: classEntity.title, reason
    })
```

## API-контракты

| Endpoint | Request | Response |
|----------|---------|----------|
| POST /classes | `{ title, description?, subject, ageMin, ageMax, price, format }` | `{ id, slug, status: "DRAFT", ... }` |
| PUT /classes/:id | `{ title?, description?, ... }` | `{ id, status, ... }` |
| DELETE /classes/:id | - | 204 |
| POST /classes/:id/submit | - | `{ status: "PENDING_REVIEW" }` |
| POST /classes/:id/approve | - | `{ status: "PUBLISHED" }` |
| POST /classes/:id/reject | `{ reason }` | `{ status: "REJECTED" }` |
