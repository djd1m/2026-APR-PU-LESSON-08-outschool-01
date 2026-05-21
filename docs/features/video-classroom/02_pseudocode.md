# Псевдокод: Видеокласс

## 1. Генерация Jitsi JWT (HMAC-SHA256)

```
FUNCTION generateJitsiJWT(userId, role, roomName, sectionDuration):
  header = { alg: "HS256", typ: "JWT" }

  payload = {
    iss: JITSI_APP_ID,
    sub: JITSI_DOMAIN,
    aud: "jitsi",
    room: roomName,
    exp: NOW() + sectionDuration + 10min,  // grace period
    context: {
      user: {
        id: userId,
        name: user.displayName,
        avatar: user.avatarUrl
      },
      features: {
        recording: (role === "teacher"),
        livestreaming: false,
        "screen-sharing": (role === "teacher")
      }
    },
    moderator: (role === "teacher")
  }

  token = base64url(header) + "." + base64url(payload)
  signature = hmacSha256(JITSI_JWT_SECRET, token)
  RETURN token + "." + base64url(signature)
```

## 2. Жизненный цикл комнаты

```
FUNCTION getRoomAccess(userId, sectionId):
  // 1. Загрузить секцию
  section = db.sections.findOne(id=sectionId, status=ACTIVE)
  IF section IS NULL:
    THROW NotFoundError("Секция не найдена")

  // 2. Определить роль
  class = db.classes.findOne(id=section.classId)
  IF class.teacherId === userId:
    role = "teacher"
  ELSE:
    // 3. Проверить enrollment
    enrollment = db.enrollments.findOne(
      sectionId=sectionId,
      child: { parentId: userId },
      status: IN [confirmed, active]
    )
    IF enrollment IS NULL:
      LOG.security("Unauthorized room access attempt", { userId, sectionId })
      THROW ForbiddenError("Нет доступа к занятию")
    role = "student"

  // 4. Проверить временное окно
  windowStart = section.startTime.minus(15, MINUTES)
  windowEnd = section.startTime.plus(section.duration + 10, MINUTES)
  IF NOW() < windowStart:
    THROW TooEarlyError("Комната откроется за 15 минут до начала")
  IF NOW() > windowEnd:
    THROW TooLateError("Занятие завершено")

  // 5. Генерировать JWT и roomName
  roomName = "km-" + sectionId + "-" + formatDate(section.startTime, "YYYYMMDD")
  jwt = generateJitsiJWT(userId, role, roomName, section.duration)

  // 6. Уведомить родителя (если student)
  IF role === "student":
    ASYNC notifyParent(enrollment.child.parentId, section)

  // 7. Запланировать автозакрытие (если еще не запланировано)
  IF NOT roomCloseScheduled(sectionId):
    closeTime = section.startTime.plus(section.duration + 10, MINUTES)
    closeDelay = closeTime.diff(NOW(), MILLISECONDS)
    roomCloseQueue.add("close-room", { sectionId, roomName }, {
      delay: closeDelay,
      jobId: "close-" + sectionId  // идемпотентность
    })

  RETURN { roomName, jwt, jitsiDomain: JITSI_DOMAIN, role }
```

## 3. Автозакрытие комнаты (BullMQ delayed job)

```
FUNCTION processRoomClose(job):
  { sectionId, roomName } = job.data

  // Отправить команду закрытия через Jitsi API
  TRY:
    jitsiApi.closeRoom(roomName)
    db.sections.update(id=sectionId, { status: COMPLETED })
    LOG.info("Room closed", { sectionId, roomName })
  CATCH error:
    LOG.error("Failed to close room", { sectionId, error })
    // Retry через BullMQ
    THROW error
```

## 4. Уведомление родителя

```
FUNCTION notifyParent(parentId, section):
  parent = db.users.findOne(id=parentId)
  class = db.classes.findOne(id=section.classId)

  pushNotification.send(parentId, {
    title: "Ребенок присоединился к занятию",
    body: class.title + " — занятие началось",
    data: { sectionId: section.id, type: "CHILD_JOINED" }
  })
  // SLA: доставка < 5 секунд
```

## 5. API-контракты

### GET /video/room/:sectionId
```json
// Response 200
{
  "roomName": "km-uuid-20260601",
  "jwt": "eyJhbGciOi...",
  "jitsiDomain": "meet.klassmarket.ru",
  "role": "student",
  "startsAt": "2026-06-01T10:00:00Z",
  "duration": 60
}

// Error 403
{ "error": "NO_ENROLLMENT", "message": "Нет доступа к занятию" }

// Error 425
{ "error": "TOO_EARLY", "message": "Комната откроется за 15 минут до начала", "opensAt": "..." }
```

### POST /video/room/:sectionId/recording (Teacher only)
```json
// Request
{ "enabled": true }
// Response 200
{ "recordingStatus": "started" }
```
