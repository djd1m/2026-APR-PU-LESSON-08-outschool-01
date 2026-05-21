# Feature: Профили учителей

**ID:** teacher-profiles
**Branch:** feature/004-teacher-profiles
**Epic:** E2
**Stories:** US-010, US-011, US-012
**Effort:** L
**Status:** done

## Описание

Публичные профили учителей с биографией, квалификацией, списком занятий и агрегированным рейтингом. Включает процесс верификации учителей и личный кабинет для редактирования профиля. Страница списка учителей с поиском и фильтрацией по предмету и рейтингу.

## Реализованные компоненты

### Backend
- `src/modules/teachers/teachers.controller.ts` — контроллер публичных профилей и верификации
- `src/modules/teachers/teachers.service.ts` — бизнес-логика профилей и агрегации рейтинга
- `src/modules/teachers/dto/update-teacher.dto.ts` — DTO обновления профиля
- `src/modules/teachers/dto/verify-teacher.dto.ts` — DTO запроса на верификацию
- `prisma/schema.prisma` — модель Teacher с полями bio, qualification, verified, rating

### Frontend
- `src/pages/TeachersPage.tsx` — страница списка учителей
- `src/pages/TeacherProfilePage.tsx` — публичный профиль учителя
- `src/pages/TeacherDashboardPage.tsx` — личный кабинет учителя
- `src/components/teachers/TeacherCard.tsx` — карточка учителя в списке
- `src/components/teachers/VerificationBadge.tsx` — бейдж верификации
- `src/components/teachers/RatingStars.tsx` — компонент отображения рейтинга

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /teachers | No | Список учителей с фильтрами (subject, minRating, query) |
| GET | /teachers/:id | No | Публичный профиль учителя с занятиями и рейтингом |
| PUT | /teachers/me | Yes (Teacher) | Обновление собственного профиля |
| POST | /teachers/me/verify | Yes (Teacher) | Отправка запроса на верификацию |

## Ключевые решения
- Агрегированный рейтинг пересчитывается при каждом новом отзыве и кэшируется в поле Teacher.rating для быстрой сортировки
- Workflow верификации: UNVERIFIED -> PENDING -> VERIFIED/REJECTED, модерируется администратором
- TeacherCard показывает аватар, имя, предметы, рейтинг и бейдж верификации в едином компоненте
- Профиль учителя включает список его занятий с пагинацией для переиспользования компонентов каталога
