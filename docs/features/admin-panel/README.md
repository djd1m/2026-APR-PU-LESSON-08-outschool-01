# Feature: Админ-панель

**ID:** admin-panel
**Branch:** feature/013-admin-panel
**Epic:** E5
**Stories:** US-A01, US-A02, US-A03
**Effort:** L
**Status:** done

## Описание
Четырёхтабовая админ-панель: модерация классов (approve/reject), управление верификацией учителей, модерация отзывов (flagged), аналитика платформы (GMV, MAU, количество классов/учителей/учеников).

## Реализованные компоненты

### Backend
- `packages/api/src/modules/admin/` — AdminModule (controller, service)
- RBAC: все эндпоинты защищены @Roles(ADMIN)

### Frontend
- `packages/web/src/app/(admin)/admin/page.tsx` — 4-tab admin page (Модерация | Учителя | Отзывы | Аналитика)

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /admin/stats | ADMIN | Аналитика платформы (GMV, MAU, counts) |
| GET | /admin/pending-classes | ADMIN | Классы на модерации |
| GET | /admin/flagged-reviews | ADMIN | Отмеченные отзывы |
| POST | /admin/classes/:id/approve | ADMIN | Одобрить класс |
| POST | /admin/classes/:id/reject | ADMIN | Отклонить класс с причиной |
| POST | /admin/teachers/:id/verify | ADMIN | Верифицировать учителя |
| POST | /admin/teachers/:id/reject | ADMIN | Отклонить верификацию |

## Ключевые решения
- Badge counters на табах для pending items
- Audit logging всех админских действий
- GMV агрегация через Prisma aggregate (Decimal)
- Batch moderation для очередей
- ADMIN role enforcement через RolesGuard
