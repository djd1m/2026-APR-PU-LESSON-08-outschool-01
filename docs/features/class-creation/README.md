# Feature: Создание и модерация занятий

**ID:** class-creation
**Branch:** feature/005-class-creation
**Epic:** E3
**Stories:** US-013, US-014, US-015
**Effort:** L
**Status:** done

## Описание

CRUD-операции для занятий с workflow модерации. Учитель создает занятие в статусе DRAFT, отправляет на модерацию (PENDING_REVIEW), администратор одобряет (PUBLISHED) или отклоняет (REJECTED). При одобрении занятие автоматически индексируется в Elasticsearch и появляется в каталоге.

## Реализованные компоненты

### Backend
- `src/modules/classes/classes.controller.ts` — CRUD и маршруты модерации
- `src/modules/classes/classes.service.ts` — бизнес-логика создания и смены статусов
- `src/modules/classes/classes.search.ts` — индексация в Elasticsearch при публикации
- `src/modules/classes/dto/create-class.dto.ts` — DTO создания занятия
- `src/modules/classes/dto/update-class.dto.ts` — DTO обновления занятия
- `src/modules/classes/guards/class-owner.guard.ts` — guard проверки владельца

### Frontend
- `src/pages/ClassCreatePage.tsx` — форма создания занятия
- `src/pages/ClassEditPage.tsx` — форма редактирования занятия
- `src/pages/ModerationPage.tsx` — панель модерации для администратора
- `src/components/classes/ClassForm.tsx` — переиспользуемая форма занятия
- `src/components/classes/StatusBadge.tsx` — бейдж статуса модерации
- `src/components/classes/ModerationActions.tsx` — кнопки одобрения/отклонения

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /classes | Yes (Teacher) | Создание занятия (статус DRAFT) |
| PUT | /classes/:id | Yes (Owner) | Обновление занятия |
| DELETE | /classes/:id | Yes (Owner) | Удаление занятия |
| POST | /classes/:id/submit | Yes (Owner) | Отправка на модерацию (DRAFT -> PENDING_REVIEW) |
| POST | /classes/:id/approve | Yes (Admin) | Одобрение (PENDING_REVIEW -> PUBLISHED) |
| POST | /classes/:id/reject | Yes (Admin) | Отклонение с комментарием (PENDING_REVIEW -> REJECTED) |

## Ключевые решения
- State machine для статусов: DRAFT -> PENDING_REVIEW -> PUBLISHED/REJECTED, с возможностью повторной отправки после отклонения
- Elasticsearch индексация срабатывает только при переходе в PUBLISHED — черновики и отклоненные занятия не попадают в поиск
- Guard class-owner проверяет, что только автор занятия может его редактировать и удалять
- При отклонении администратор обязан указать причину (rejectReason), которая отображается учителю
