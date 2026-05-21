# Завершение: Создание и модерация занятий

## План тестирования

### Unit-тесты (ClassesService)

| Тест | Описание | Ожидание |
|------|----------|----------|
| create_class_success | Валидные данные | Class создан, status=DRAFT, slug сгенерирован |
| create_class_limit | 50 активных занятий | BadRequestException "Лимит" |
| submit_success | DRAFT, все поля заполнены | status → PENDING_REVIEW |
| submit_incomplete | DRAFT, description пустое | BadRequestException |
| submit_wrong_status | PUBLISHED → submit | BadRequestException |
| approve_success | PENDING_REVIEW | status → PUBLISHED, ES indexed |
| approve_wrong_status | DRAFT → approve | BadRequestException |
| reject_success | PENDING_REVIEW + reason | status → REJECTED, reason сохранен |
| reject_no_reason | PENDING_REVIEW, reason пустой | BadRequestException |
| unpublish | PUBLISHED → DRAFT | status → DRAFT, ES removed |
| resubmit | REJECTED → PENDING_REVIEW | status → PENDING_REVIEW, reason очищен |
| delete_own_class | Владелец удаляет | Soft delete |
| delete_others_class | Не владелец | ForbiddenException |

### Unit-тесты (SlugService)

| Тест | Описание | Ожидание |
|------|----------|----------|
| slug_cyrillic | "Математика для детей" | "matematika-dlya-detey" |
| slug_special_chars | "Hello, World!" | "hello-world" |
| slug_duplicate | Slug уже существует | Суффикс "-2" |
| slug_long_title | 300 символов | Обрезка до 100 |
| slug_trim | "  пробелы  " | "probely" |

### Интеграционные тесты (endpoints)

| Тест | Метод | Path | Ожидание |
|------|-------|------|----------|
| Create class | POST | /classes | 201, status=DRAFT |
| Update class | PUT | /classes/:id | 200, поля обновлены |
| Delete class | DELETE | /classes/:id | 204 |
| Submit for review | POST | /classes/:id/submit | 200, status=PENDING_REVIEW |
| Approve class | POST | /classes/:id/approve | 200, status=PUBLISHED |
| Reject class | POST | /classes/:id/reject | 200, status=REJECTED |
| Unauthorized create | POST | /classes (no JWT) | 401 |
| Forbidden update | PUT | /classes/:id (not owner) | 403 |
| Admin reject no reason | POST | /classes/:id/reject {} | 400 |

### E2E-тесты

1. **Полный цикл**: создание DRAFT → заполнение → submit → approve → виден в каталоге
2. **Отклонение и повторная подача**: создание → submit → reject → edit → resubmit → approve
3. **Снятие с публикации**: PUBLISHED → unpublish → не виден в каталоге → submit → approve → виден снова
4. **Конкурентность**: два PUT одновременно → один успешен, второй 409

## Деплой

### Миграции

- `create_classes_table`: основная модель Class с индексами
- `add_class_moderation_fields`: submittedAt, approvedBy, rejectedAt, rejectedBy, rejectionReason
- `add_class_version`: поле version для optimistic locking

### Переменные окружения

```
CLASS_LIMIT_PER_TEACHER=50
CLASS_MODERATION_SLA_HOURS=24
SLUG_MAX_LENGTH=100
```

## Мониторинг

| Метрика | Тип | Алерт |
|---------|-----|-------|
| classes.created | counter | - |
| classes.submitted | counter | - |
| classes.approved | counter | - |
| classes.rejected | counter | reject_rate > 40% → review качества контента |
| classes.moderation.pending_count | gauge | > 50 → alert |
| classes.moderation.avg_wait_hours | histogram | > 24h → SLA breach alert |
| classes.es_index.failures | counter | > 0 → alert |
| classes.slug.collisions | counter | > 10/день → review алгоритма |

## Чеклист готовности

- [x] Unit-тесты ClassesService (13 кейсов)
- [x] Unit-тесты SlugService (5 кейсов)
- [x] Интеграционные тесты (9 endpoints)
- [x] E2E-тесты (4 сценария)
- [x] State machine все переходы валидированы
- [x] Optimistic locking для конкурентности
- [x] ES-индексация при approve / удаление при unpublish
- [x] Slug-генерация с транслитерацией и уникальностью
- [x] Миграции применены
