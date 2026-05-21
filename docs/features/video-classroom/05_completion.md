# Завершение: Видеокласс

## 1. План тестирования

### Unit-тесты

| Тест | Файл | Приоритет |
|------|------|-----------|
| generateJitsiJWT: структура и подпись | `jitsi-jwt.service.spec.ts` | Критический |
| generateJitsiJWT: teacher vs student features | `jitsi-jwt.service.spec.ts` | Высокий |
| generateJitsiJWT: TTL = duration + 10min | `jitsi-jwt.service.spec.ts` | Высокий |
| getRoomAccess: teacher access | `video.service.spec.ts` | Высокий |
| getRoomAccess: student with enrollment | `video.service.spec.ts` | Критический |
| getRoomAccess: no enrollment → 403 | `video.service.spec.ts` | Критический |
| getRoomAccess: too early → 425 | `video.service.spec.ts` | Высокий |
| getRoomAccess: after end → 410 | `video.service.spec.ts` | Высокий |
| processRoomClose: success | `room-close.processor.spec.ts` | Высокий |

### **Критический тест: проверка enrollment для доступа**

```
TEST "only enrolled users can access room"
  GIVEN секция с 2 enrolled детьми и 1 не-enrolled
  WHEN enrolled child requests room access
  THEN получает JWT с role=student

  WHEN non-enrolled user requests room access
  THEN получает 403 Forbidden
  AND security log записан

  WHEN teacher (class owner) requests room access
  THEN получает JWT с role=teacher и moderator=true
```

### **Критический тест: автозакрытие комнаты**

```
TEST "room auto-closes after duration + 10 min"
  GIVEN секция с duration=60 мин
  WHEN job запланирован через getRoomAccess
  THEN job.delay === (endTime + 10min - NOW()) в миллисекундах
  AND job.jobId === "close-{sectionId}" (идемпотентность)

  WHEN job выполняется
  THEN jitsiApi.closeRoom вызван
  AND RoomSession.closedAt установлен
  AND Section.status = COMPLETED
```

### Integration-тесты (с mock Jitsi)

| Тест | Приоритет |
|------|-----------|
| GET /video/room/:sectionId → 200 + JWT (enrolled student) | Критический |
| GET /video/room/:sectionId → 403 (no enrollment) | Критический |
| GET /video/room/:sectionId → 425 (too early) | Высокий |
| GET /video/room/:sectionId → 200 + moderator (teacher) | Высокий |
| JWT валидация: подпись корректна, payload содержит room | Критический |
| BullMQ close job: создается с правильным delay | Высокий |

### E2E-тесты (Playwright)

| Сценарий | Приоритет |
|----------|-----------|
| JoinButton: таймер до начала → кнопка активна → iframe загружается | Высокий |
| Неавторизованный пользователь → ошибка доступа | Высокий |
| ConnectionStatus: отображение качества | Средний |

## 2. План развертывания

### Инфраструктура
1. Развернуть Jitsi Meet Docker stack (web + prosody + jicofo + jvb)
2. Настроить JWT auth в prosody: APP_ID + JWT_SECRET
3. Открыть порт 10000/udp для JVB (video bridge)
4. SSL сертификат для meet.klassmarket.ru

### Миграция БД
1. Таблица RoomSession для аудита
2. Seed: не требуется

### Env variables
```
JITSI_DOMAIN=meet.klassmarket.ru
JITSI_APP_ID=klassmarket
JITSI_JWT_SECRET=<random 64 chars>
```

### Порядок деплоя
1. Jitsi Docker stack + SSL
2. Backend: VideoModule + endpoints
3. Smoke test: создать комнату, войти, проверить JWT
4. Frontend: JitsiMeet + JoinButton + ClassroomPage
5. E2E test: полный флоу учитель + ученик

## 3. Мониторинг

| Метрика | Алерт |
|---------|-------|
| room_access_granted (counter, label: role) | — |
| room_access_denied (counter) | > 10/мин → алерт безопасности |
| room_opened (counter) | — |
| room_closed (counter) | — |
| room_stuck_open (gauge) | > 0 → алерт |
| jvb_health | unhealthy → критический алерт |
| jwt_generation_duration_ms (histogram) | p95 > 50ms |
| parent_notification_delay_ms (histogram) | p95 > 5000ms |

## 4. Критерии готовности к релизу

- [ ] JWT генерация и валидация протестированы
- [ ] Enrollment check блокирует неавторизованных
- [ ] Jitsi Docker stack стабильно работает
- [ ] Автозакрытие комнат работает через BullMQ
- [ ] Push-уведомления родителям доставляются < 5с
- [ ] Security logging настроен
- [ ] Мониторинг Jitsi и room lifecycle настроен
