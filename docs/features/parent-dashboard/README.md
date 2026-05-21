# Feature: Дашборд родителя

**ID:** parent-dashboard
**Branch:** feature/011-parent-dashboard
**Epic:** E5
**Updated:** 2026-05-21

## Реализованный UI Flow — вкладка "Дети"
1. Таб **"Дети"** в личном кабинете (`/dashboard`)
2. **Добавить ребёнка**: имя + дата рождения + интересы (чекбоксы)
3. Ребёнок отображается карточкой (аватар-инициал, имя, возраст, теги интересов)
4. **Удалить ребёнка**: кнопка "Удалить" с подтверждением
5. Можно добавить несколько детей (кнопка "+ Добавить ещё ребёнка")

### API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | /users/children | Создать профиль ребёнка |
| GET | /users/children | Список детей |
| DELETE | /users/children/:id | Удалить ребёнка |
**Stories:** US-P08
**Effort:** M
**Status:** done

## Описание
Четырёхтабовый дашборд родителя: расписание предстоящих занятий с кнопкой "Войти в класс", прогресс по каждому ребёнку, история платежей, управление профилями детей.

## Реализованные компоненты

### Backend
- `packages/api/src/modules/users/users.controller.ts` — GET /users/dashboard
- `packages/api/src/modules/users/users.service.ts` — getParentDashboard() агрегация

### Frontend
- `packages/web/src/app/(main)/dashboard/page.tsx` — 4-tab dashboard (Расписание | Прогресс | Платежи | Дети)

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /users/dashboard | PARENT | Агрегированная статистика родителя |
| GET | /users/children | PARENT | Список детей |
| GET | /enrollments | PARENT | Записи на занятия |
| GET | /payments | PARENT | История платежей |

## Ключевые решения
- Lazy loading для каждого таба (React Query с staleTime)
- "Войти в класс" кнопка появляется за 15 мин до начала
- Per-child progress: количество занятий, предметы, часы
- Timezone-aware расписание (Moscow default)
