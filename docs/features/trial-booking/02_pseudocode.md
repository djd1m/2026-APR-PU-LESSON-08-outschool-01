# Псевдокод: Запись на пробное занятие

## 1. Алгоритм проверки допустимости пробного занятия

```
FUNCTION checkTrialEligibility(parentId, childId, classId, sectionId):
  // 1. Проверить, что ребенок принадлежит родителю
  child = db.children.findOne(id=childId, parentId=parentId)
  IF child IS NULL:
    THROW ForbiddenError("Ребенок не найден")

  // 2. Загрузить класс с возрастными ограничениями
  class = db.classes.findOne(id=classId)
  IF class IS NULL:
    THROW NotFoundError("Класс не найден")

  // 3. Проверить возраст ребенка на дату секции
  section = db.sections.findOne(id=sectionId, classId=classId)
  childAge = calculateAge(child.birthDate, section.startTime)
  IF childAge < class.ageMin OR childAge > class.ageMax:
    RETURN { eligible: false, reason: "AGE_MISMATCH", childAge, ageMin: class.ageMin, ageMax: class.ageMax }

  // 4. Проверить правило одного пробного
  existingTrial = db.enrollments.findOne(childId=childId, classId=classId, type=TRIAL)
  IF existingTrial IS NOT NULL:
    RETURN { eligible: false, reason: "TRIAL_ALREADY_USED" }

  // 5. Проверить свободные места
  activeCount = db.enrollments.count(sectionId=sectionId, status IN [confirmed, active])
  IF activeCount >= section.maxStudents:
    RETURN { eligible: false, reason: "NO_SEATS" }

  RETURN { eligible: true }
```

## 2. Алгоритм создания пробной записи

```
FUNCTION createTrialEnrollment(parentId, childId, sectionId):
  BEGIN TRANSACTION (SERIALIZABLE)

    // Атомарная проверка + создание в одной транзакции
    eligibility = checkTrialEligibility(parentId, childId, classId, sectionId)
    IF NOT eligibility.eligible:
      ROLLBACK
      THROW ConflictError(eligibility.reason)

    // Создание записи
    enrollment = db.enrollments.create({
      childId,
      sectionId,
      classId: section.classId,
      type: TRIAL,
      status: CONFIRMED,
      price: 0,
      createdAt: NOW()
    })

  COMMIT TRANSACTION

  // Постобработка (вне транзакции)
  ASYNC sendConfirmationEmail(parentId, enrollment)
  ASYNC sendCalendarInvite(parentId, section)

  RETURN enrollment
```

## 3. Счетчик свободных мест

```
FUNCTION getAvailableSeats(sectionId):
  section = db.sections.findOne(id=sectionId)
  occupied = db.enrollments.count(
    sectionId=sectionId,
    status IN [confirmed, active]
  )
  RETURN section.maxStudents - occupied
```

## 4. API-контракты

### POST /enrollments/trial
```json
// Request
{ "childId": "uuid", "sectionId": "uuid" }

// Response 201
{
  "id": "uuid",
  "childId": "uuid",
  "sectionId": "uuid",
  "classId": "uuid",
  "type": "TRIAL",
  "status": "confirmed",
  "createdAt": "2026-05-21T10:00:00Z"
}

// Error 409
{ "error": "TRIAL_ALREADY_USED", "message": "Пробное занятие уже использовано" }
```

### GET /enrollments/trial-status?childId=uuid&classId=uuid
```json
// Response 200
{
  "eligible": true,
  "availableSeats": 3,
  "childAge": 8,
  "ageRange": { "min": 6, "max": 10 }
}
```

### DELETE /enrollments/:id
```json
// Response 200
{ "id": "uuid", "status": "cancelled" }
```

## 5. Диаграмма потока данных

```
Родитель → [TrialBookingCard] → POST /enrollments/trial
                                       ↓
                              [EnrollmentGuard: auth + ownership]
                                       ↓
                              [EnrollmentsService.createTrialEnrollment]
                                       ↓
                              BEGIN TX → checkEligibility → INSERT enrollment → COMMIT
                                       ↓
                              ASYNC: email + calendar invite
```
