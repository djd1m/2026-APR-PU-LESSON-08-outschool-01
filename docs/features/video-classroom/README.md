# Feature: Видеоклассы (Jitsi Meet)

**ID:** video-classroom
**Branch:** feature/009-video-classroom
**Epic:** E4
**Stories:** US-P07, US-T04, US-C01a
**Effort:** XL
**Status:** done

## Описание
Self-hosted Jitsi Meet интеграция для проведения живых онлайн-занятий. Enrollment-only доступ, автоматическое закрытие комнаты через 10 минут после окончания, push-уведомление родителю при подключении ребёнка.

## Реализованные компоненты

### Backend
- `packages/api/src/modules/video/` — VideoModule (controller, service, repository)
- `packages/api/prisma/schema.prisma` — VideoRoom model (WAITING/ACTIVE/CLOSED)
- `packages/workers/src/processors/video-room-close.processor.ts` — auto-close delayed job

### Frontend
- `packages/web/src/app/(main)/classroom/[sectionId]/page.tsx` — classroom page с countdown и post-class rating
- `packages/web/src/components/JitsiMeet.tsx` — Jitsi iframe wrapper с teacher controls

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /video/rooms | TEACHER | Создать комнату для секции |
| GET | /video/rooms/:sectionId | JWT | Получить информацию о комнате |
| POST | /video/rooms/:sectionId/join | JWT | Получить JWT для входа (enrollment check) |
| DELETE | /video/rooms/:sectionId | TEACHER/ADMIN | Закрыть комнату |

## Ключевые решения
- Jitsi JWT генерируется через HMAC-SHA256 (без внешних JWT-библиотек)
- Enrollment verification перед выдачей join token (436-ФЗ child safety)
- Auto-close через BullMQ delayed job (10 мин после endTime секции)
- Parent push notification при подключении ребёнка
- Adaptive bitrate и reconnection handling
