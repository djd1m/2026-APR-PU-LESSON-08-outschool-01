# Feature: Панель администратора

**ID:** admin-panel
**Branch:** feature/013-admin-panel
**Effort:** L
**Status:** done

## Описание

Расширенная панель администратора с четырьмя вкладками: Модерация, Учителя, Отзывы и Аналитика. В разделе Модерация отображаются занятия на ожидании публикации с кнопками одобрения/отклонения. В разделе Учителя -- список преподавателей с их статусом верификации и кнопками управления. В разделе Отзывы -- помеченные для модерации отзывы с возможностью одобрения или удаления. В разделе Аналитика -- ключевые метрики платформы (GMV, MAU, количество классов, преподавателей, учеников).

## Реализованные компоненты

### Backend
- `src/modules/admin/admin.controller.ts` -- контроллер с маршрутами статистики, модерации классов, отзывов и верификации учителей
- `src/modules/admin/admin.service.ts` -- бизнес-логика: подсчет метрик, управление статусами классов и профилей
- `src/modules/admin/admin.module.ts` -- NestJS модуль

### Frontend
- `src/app/(admin)/admin/page.tsx` -- страница панели администратора с вкладками

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /admin/stats | Yes (Admin) | Аналитика платформы (GMV, MAU, counts) |
| GET | /admin/pending-classes | Yes (Admin) | Занятия на модерации |
| GET | /admin/flagged-reviews | Yes (Admin) | Помеченные отзывы |
| POST | /admin/classes/:id/approve | Yes (Admin) | Одобрение занятия |
| POST | /admin/classes/:id/reject | Yes (Admin) | Отклонение занятия |
| POST | /admin/teachers/:id/verify | Yes (Admin) | Верификация преподавателя |
| POST | /admin/teachers/:id/reject | Yes (Admin) | Отзыв верификации |

## Ключевые решения
- GMV считается как сумма amount всех COMPLETED платежей
- MAU приближенно определяется через updatedAt пользователей за последние 30 дней
- Все админ-маршруты защищены JwtAuthGuard + RolesGuard(ADMIN)
- Счетчики в заголовках вкладок показывают количество ожидающих элементов
- Модерация занятий: PENDING_REVIEW -> PUBLISHED (одобрение) или -> DRAFT (отклонение)
