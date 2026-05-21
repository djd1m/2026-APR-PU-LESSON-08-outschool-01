# Feature: Дашборд учителя

**ID:** teacher-dashboard
**Branch:** feature/012-teacher-dashboard
**Epic:** E5
**Stories:** US-T03, US-T05
**Effort:** M
**Status:** done

## Описание
Дашборд учителя с summary-карточками (заработок, студенты, рейтинг, активные классы), списком предстоящих секций, последними отзывами и быстрыми ссылками на создание класса и управление расписанием.

## Реализованные компоненты

### Backend
- `packages/api/src/modules/users/users.controller.ts` — GET /users/teacher/dashboard
- `packages/api/src/modules/users/users.service.ts` — getTeacherDashboard() агрегация

### Frontend
- `packages/web/src/app/(main)/teach/dashboard/page.tsx` — teacher dashboard page

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /users/teacher/dashboard | TEACHER | Агрегированная статистика учителя |
| GET | /payments/teacher/earnings | TEACHER | Детальный заработок |
| GET | /sections/teacher/schedule | TEACHER | Расписание секций |

## Ключевые решения
- Summary cards: total earned (Decimal), students this month, avg rating, active classes
- Upcoming sections с количеством записанных учеников
- Recent reviews (последние 5)
- Quick links: создать класс, расписание, заработок
