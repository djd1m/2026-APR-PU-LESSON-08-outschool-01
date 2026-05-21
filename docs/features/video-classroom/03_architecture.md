# Архитектура: Видеокласс

## 1. Размещение компонентов

### Backend (NestJS)

| Компонент | Путь | Назначение |
|-----------|------|-----------|
| VideoController | `src/modules/video/video.controller.ts` | Endpoints: GET /room/:sectionId, POST /recording |
| VideoService | `src/modules/video/video.service.ts` | Бизнес-логика: access check, JWT generation, room lifecycle |
| JitsiJwtService | `src/modules/video/jitsi-jwt.service.ts` | Генерация JWT токена для Jitsi Meet |
| RoomCloseProcessor | `src/modules/video/room-close.processor.ts` | BullMQ worker для автозакрытия комнат |
| VideoGuard | `src/modules/video/guards/video.guard.ts` | Проверка enrollment или teacher ownership |

### Frontend (React + TypeScript)

| Компонент | Путь | Назначение |
|-----------|------|-----------|
| JitsiMeetComponent | `src/components/video/JitsiMeet.tsx` | Обертка над Jitsi Meet iframe API |
| JoinButton | `src/components/video/JoinButton.tsx` | Кнопка "Присоединиться" с таймером до начала |
| ConnectionStatus | `src/components/video/ConnectionStatus.tsx` | Индикатор качества соединения |
| ClassroomPage | `src/pages/ClassroomPage.tsx` | Страница видеозанятия с Jitsi + чат |

### Инфраструктура

| Компонент | Технология | Назначение |
|-----------|-----------|-----------|
| Jitsi Meet | Docker (jitsi/web + prosody + jicofo + jvb) | Видеоконференции |
| BullMQ | Redis | Очередь delayed jobs для автозакрытия |
| Push Service | Firebase Cloud Messaging / web-push | Уведомления родителям |

### Модель данных

Новых моделей не требуется. Используются существующие:
- `Section` — временные рамки комнаты
- `Enrollment` — проверка доступа
- `Class` — определение teacher ownership

Добавляется таблица для логирования:

```prisma
model RoomSession {
  id         String   @id @default(uuid())
  sectionId  String
  roomName   String
  openedAt   DateTime @default(now())
  closedAt   DateTime?
  status     RoomStatus // open | closed | stuck
}
```

## 2. Внешние зависимости

```
VideoModule
  ├── Jitsi Meet (self-hosted Docker)
  │     ├── prosody — XMPP server + JWT auth
  │     ├── jicofo — conference focus
  │     └── jvb — video bridge
  ├── BullMQ + Redis — delayed job для close
  ├── Push Service — уведомления родителям
  ├── imports: [PrismaModule, AuthModule]
  ├── depends on: EnrollmentsModule (access check)
  ├── depends on: SectionsModule (time window)
  └── env: JITSI_DOMAIN, JITSI_APP_ID, JITSI_JWT_SECRET
```

## 3. Диаграмма взаимодействия

```
[JoinButton] → GET /video/room/:sectionId → [VideoController]
                                                    │
                                           [VideoGuard: enrollment check]
                                                    │
                                           [VideoService.getRoomAccess]
                                                    │
                                           [JitsiJwtService.generateJWT]
                                                    │
                               ←── { roomName, jwt, domain } ──┘
                                                    │
[JitsiMeet] → iframe: https://meet.klassmarket.ru/{roomName}?jwt={token}
                                                    │
                                           Jitsi prosody validates JWT
                                                    │
                                           Video/audio stream via jvb
                                                    │
[BullMQ delayed] ───── after endTime+10min ────→ [RoomCloseProcessor]
                                                    │
                                           jitsiApi.closeRoom(roomName)
```

## 4. Jitsi Docker Compose

```yaml
# Добавляется в docker-compose.yml
jitsi-web:
  image: jitsi/web:stable
  environment:
    - ENABLE_AUTH=1
    - AUTH_TYPE=jwt
    - JWT_APP_ID=${JITSI_APP_ID}
    - JWT_APP_SECRET=${JITSI_JWT_SECRET}
jitsi-prosody:
  image: jitsi/prosody:stable
jitsi-jicofo:
  image: jitsi/jicofo:stable
jitsi-jvb:
  image: jitsi/jvb:stable
  ports:
    - "10000:10000/udp"
```

## 5. Ключевые архитектурные решения

| Решение | Обоснование |
|---------|------------|
| Self-hosted Jitsi | Контроль данных, нет зависимости от SaaS, дешевле при масштабе |
| JWT auth через prosody | Нативная интеграция Jitsi, нет custom middleware |
| BullMQ delayed job для close | Надежнее cron, точное время, retry при сбое |
| iframe API для frontend | Простая интеграция, Jitsi управляет WebRTC |
| RoomSession таблица | Аудит и обнаружение "застрявших" комнат |
