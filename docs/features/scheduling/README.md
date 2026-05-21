# Feature: Расписание занятий

**ID:** scheduling
**Branch:** feature/008-scheduling
**Epic:** E3
**Stories:** US-023, US-024, US-025
**Effort:** L
**Status:** done

## Описание

Управление расписанием секций (конкретных сеансов занятий) с поддержкой часовых поясов. Учитель создает секции с указанием даты, времени и длительности. Система хранит все временные данные в UTC, отображает в московском времени (Europe/Moscow) и проверяет конфликты расписания учителя.

## Реализованные компоненты

### Backend
- `src/modules/sections/sections.controller.ts` — CRUD контроллер секций
- `src/modules/sections/sections.service.ts` — бизнес-логика расписания и проверки конфликтов
- `src/modules/sections/dto/create-section.dto.ts` — DTO создания секции
- `src/modules/sections/dto/update-section.dto.ts` — DTO обновления секции
- `src/modules/sections/sections.conflict.ts` — алгоритм обнаружения конфликтов по времени
- `prisma/schema.prisma` — модель Section с полями startTime (DateTime), duration, maxStudents, classId

### Frontend
- `src/pages/TeacherSchedulePage.tsx` — страница расписания учителя
- `src/components/scheduling/WeeklyGrid.tsx` — недельная сетка расписания
- `src/components/scheduling/SectionForm.tsx` — форма создания/редактирования секции
- `src/components/scheduling/TimeSlot.tsx` — ячейка временного слота в сетке
- `src/components/scheduling/ConflictWarning.tsx` — предупреждение о конфликте расписания

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /sections | Yes (Teacher) | Создание секции для занятия |
| PUT | /sections/:id | Yes (Teacher) | Обновление секции |
| DELETE | /sections/:id | Yes (Teacher) | Удаление секции |
| GET | /sections | No | Список секций для конкретного занятия (query: classId) |
| GET | /sections/teacher/schedule | Yes (Teacher) | Расписание учителя за период (query: from, to) |

## Ключевые решения
- UTC хранение: все временные метки сохраняются в UTC в PostgreSQL, конвертация в Europe/Moscow происходит на фронтенде
- Обнаружение конфликтов: при создании/обновлении секции проверяется пересечение с существующими секциями учителя по формуле (startA < endB AND startB < endA)
- Недельная сетка (WeeklyGrid): визуализация расписания с горизонтальной осью дней и вертикальной осью часов, drag-and-drop для быстрого создания секций
- Длительность секции задается в минутах и валидируется на бэкенде (минимум 15, максимум 180 минут)
