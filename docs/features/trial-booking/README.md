# Feature: Запись на пробное занятие

**ID:** trial-booking
**Branch:** feature/006-trial-booking
**Epic:** E3
**Updated:** 2026-05-21

## Реализованный UI Flow
1. Родитель добавляет ребёнка (Dashboard → Дети → Добавить)
2. Открывает класс (`/classes/:id`) → sidebar `EnrollmentCard`
3. Выбирает ребёнка из dropdown + время секции
4. Нажимает **"Попробовать бесплатно"** → enrollment CONFIRMED
5. Проверяет в `/bookings` → видит запись
6. Может отменить кнопкой **"Отменить"** → статус CANCELLED

### Компоненты
- `EnrollmentCard.tsx` — клиентский компонент выбора ребёнка + секции + записи
- `bookings/page.tsx` — список записей с отменой
**Stories:** US-016, US-017, US-018
**Effort:** M
**Status:** done

## Описание

Бесплатная запись на первое пробное занятие без привязки банковской карты. Родитель может записать ребенка на пробное занятие один раз для каждого класса. Система проверяет возрастное соответствие ребенка, наличие свободных мест и отсутствие дублирующих записей.

## Реализованные компоненты

### Backend
- `src/modules/enrollments/enrollments.controller.ts` — контроллер записей на занятия
- `src/modules/enrollments/enrollments.service.ts` — бизнес-логика пробных записей
- `src/modules/enrollments/dto/create-trial.dto.ts` — DTO записи на пробное занятие
- `src/modules/enrollments/guards/enrollment.guard.ts` — guard проверки дублей и возраста
- `prisma/schema.prisma` — модель Enrollment с полями type (TRIAL/PAID), status, childId, sectionId

### Frontend
- `src/components/booking/TrialBookingCard.tsx` — карточка записи на пробное занятие
- `src/components/booking/SeatAvailability.tsx` — индикатор свободных мест
- `src/components/booking/AgeCheck.tsx` — предупреждение о возрастном несоответствии
- `src/pages/MyEnrollmentsPage.tsx` — список записей родителя

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /enrollments/trial | Yes (Parent) | Запись ребенка на пробное занятие |
| GET | /enrollments/trial-status | Yes (Parent) | Проверка доступности пробного занятия для ребенка и класса |
| DELETE | /enrollments/:id | Yes (Parent) | Отмена записи на занятие |

## Ключевые решения
- Правило one-trial-per-class: один ребенок может записаться на пробное занятие конкретного класса только один раз (уникальный индекс childId + classId + type=TRIAL)
- Валидация возраста: возраст ребенка проверяется на соответствие диапазону ageMin-ageMax класса
- Проверка доступности мест: количество активных записей сравнивается с maxStudents секции
- TrialBookingCard отображает доступность, возрастное соответствие и статус предыдущей записи в одном компоненте
