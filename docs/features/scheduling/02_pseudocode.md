# Псевдокод: Расписание занятий

## 1. Алгоритм обнаружения конфликтов

```
FUNCTION detectConflicts(teacherId, startTime, duration, excludeSectionId?):
  // Рассчитать endTime
  endTime = startTime.plus(duration, MINUTES)

  // Найти пересекающиеся секции учителя
  // Формула: два интервала пересекаются, если startA < endB AND startB < endA
  conflicts = db.sections.findMany({
    WHERE: {
      class: { teacherId: teacherId },
      status: ACTIVE,
      id: { NOT: excludeSectionId },  // исключить текущую при update
      AND: [
        { startTime: { lt: endTime } },
        { endTime: { gt: startTime } }   // endTime = startTime + duration (computed)
      ]
    }
  })

  RETURN conflicts  // пустой массив = нет конфликтов
```

## 2. Конвертация UTC

```
FUNCTION toUTC(localTime, timezone = "Europe/Moscow"):
  // Frontend отправляет локальное время + timezone
  // Backend конвертирует в UTC для хранения
  RETURN dayjs(localTime).tz(timezone).utc().toDate()

FUNCTION fromUTC(utcTime, timezone = "Europe/Moscow"):
  // Backend возвращает UTC, frontend конвертирует для отображения
  RETURN dayjs(utcTime).utc().tz(timezone)
```

## 3. Запрос расписания за неделю

```
FUNCTION getWeekSchedule(teacherId, weekStart):
  // weekStart — понедельник 00:00 UTC
  weekEnd = weekStart.plus(7, DAYS)

  sections = db.sections.findMany({
    WHERE: {
      class: { teacherId: teacherId },
      status: IN [ACTIVE, CANCELLED],  // cancelled тоже показываем (зачеркнутые)
      startTime: { gte: weekStart, lt: weekEnd }
    },
    INCLUDE: {
      class: { select: { title: true, ageMin: true, ageMax: true } },
      _count: { enrollments: { where: { status: IN [confirmed, active] } } }
    },
    ORDER_BY: { startTime: ASC }
  })

  RETURN sections.map(s => ({
    ...s,
    enrolledCount: s._count.enrollments,
    dayOfWeek: dayjs(s.startTime).day(),
    localTime: fromUTC(s.startTime)
  }))
```

## 4. Создание секции

```
FUNCTION createSection(teacherId, dto):
  // 1. Проверить ownership класса
  class = db.classes.findOne(id=dto.classId, teacherId=teacherId)
  IF class IS NULL:
    THROW ForbiddenError("Класс не принадлежит учителю")

  // 2. Валидировать длительность
  IF dto.duration < 15 OR dto.duration > 180:
    THROW ValidationError("Длительность: 15-180 минут")

  // 3. Конвертировать в UTC
  startTimeUTC = toUTC(dto.startTime, dto.timezone)

  // 4. Проверить конфликты
  conflicts = detectConflicts(teacherId, startTimeUTC, dto.duration)
  IF conflicts.length > 0:
    THROW ConflictError("Конфликт расписания", { conflicts })

  // 5. Создать секцию
  section = db.sections.create({
    classId: dto.classId,
    startTime: startTimeUTC,
    duration: dto.duration,
    maxStudents: dto.maxStudents,
    status: ACTIVE
  })

  RETURN section
```

## 5. Отмена секции

```
FUNCTION cancelSection(teacherId, sectionId):
  section = db.sections.findOne(id=sectionId, class: { teacherId })
  IF section IS NULL:
    THROW NotFoundError("Секция не найдена")

  BEGIN TRANSACTION
    db.sections.update(id=sectionId, { status: CANCELLED })

    // Отменить trial-записи
    db.enrollments.updateMany(
      { sectionId, type: TRIAL, status: IN [confirmed, active] },
      { status: CANCELLED }
    )

    // Передать paid-записи на возврат
    paidEnrollments = db.enrollments.findMany(
      { sectionId, type: PAID, status: IN [confirmed, active] }
    )
    FOR EACH enrollment IN paidEnrollments:
      refundQueue.add("process-refund", { enrollmentId: enrollment.id })
  COMMIT

  ASYNC notifyEnrolledStudents(sectionId, "SECTION_CANCELLED")
```

## 6. API-контракты

### POST /sections
```json
// Request
{ "classId": "uuid", "startTime": "2026-06-01T10:00:00", "timezone": "Europe/Moscow", "duration": 60, "maxStudents": 8 }
// Response 201
{ "id": "uuid", "startTime": "2026-06-01T07:00:00Z", "duration": 60, "maxStudents": 8, "status": "active" }
```

### GET /sections/teacher/schedule?from=2026-06-01&to=2026-06-07
```json
[{ "id": "uuid", "startTime": "...", "duration": 60, "class": { "title": "..." }, "enrolledCount": 3 }]
```

### DELETE /sections/:id
```json
{ "id": "uuid", "status": "cancelled" }
```
