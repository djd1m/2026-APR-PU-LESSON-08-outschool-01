# Feature: Отзывы и рейтинги

**ID:** reviews-ratings
**Branch:** feature/010-reviews-ratings
**Effort:** M
**Status:** done

## Описание

Система отзывов и рейтингов для классов и преподавателей. Родители могут оставить один отзыв на каждую завершенную или активную запись ребенка. Отзыв содержит оценку от 1 до 5 звезд и комментарий до 2000 символов. Средний рейтинг преподавателя пересчитывается автоматически при создании нового отзыва. Любой пользователь может пометить отзыв для модерации, а администратор может удалить помеченные отзывы.

## Реализованные компоненты

### Backend
- `src/modules/reviews/reviews.controller.ts` -- контроллер с маршрутами создания, получения, удаления и пометки отзывов
- `src/modules/reviews/reviews.service.ts` -- бизнес-логика: валидация, проверка владельца, расчет среднего рейтинга, модерация
- `src/modules/reviews/reviews.repository.ts` -- репозиторий с поддержкой фильтрации по классу, учителю, флагам
- `src/modules/reviews/dto/create-review.dto.ts` -- DTO создания отзыва (enrollmentId, rating, comment)
- `prisma/schema.prisma` -- поля flagged и flagReason в модели Review

### Frontend
- `src/components/ReviewCard.tsx` -- карточка отзыва (имя, звезды, комментарий, дата)
- `src/components/ReviewForm.tsx` -- форма создания отзыва (селектор звезд, textarea, отправка)
- `src/app/(main)/classes/[id]/ClassDetailReviewSection.tsx` -- секция отзывов на странице класса с формой для записанных родителей

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /reviews | Yes (Parent) | Создание отзыва для завершенной записи |
| GET | /reviews?classId=X | No | Список отзывов по классу |
| GET | /reviews?teacherId=X | No | Список отзывов по преподавателю |
| GET | /reviews/class/:classId | No | Список отзывов по классу (legacy) |
| GET | /reviews/:id | No | Получение отзыва по ID |
| DELETE | /reviews/:id | Yes (Admin) | Удаление отзыва (модерация) |
| POST | /reviews/:id/flag | Yes | Пометка отзыва для модерации |

## Ключевые решения
- Один отзыв на одну запись (enrollment): уникальный индекс enrollmentId в модели Review
- Проверка владельца: parentId сверяется через enrollment.child.parentId
- Автоматический пересчет рейтинга преподавателя через агрегацию Prisma
- Система модерации через флаг flagged с причиной flagReason
