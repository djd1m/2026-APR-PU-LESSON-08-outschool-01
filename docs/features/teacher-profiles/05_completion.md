# Завершение: Профили учителей

## План тестирования

### Unit-тесты (TeachersService)

| Тест | Описание | Ожидание |
|------|----------|----------|
| update_profile_success | Валидные bio, qualification | Профиль обновлен |
| update_profile_too_long_bio | bio > 2000 символов | BadRequestException |
| request_verification_success | Полный профиль, статус UNVERIFIED | Статус → PENDING |
| request_verification_incomplete | bio пустая | BadRequestException "Заполните биографию" |
| request_verification_already_pending | Статус PENDING | ConflictException |
| request_verification_already_verified | Статус VERIFIED | ConflictException |
| approve_verification | Статус PENDING | Статус → VERIFIED, verifiedAt установлен |
| reject_verification | Статус PENDING + reason | Статус → REJECTED, rejectionReason сохранен |
| reject_verification_no_reason | Статус PENDING, reason пустой | BadRequestException |
| recalculate_rating | 3 отзыва (4, 5, 3) | rating = 4.0, reviewCount = 3 |
| recalculate_rating_no_reviews | 0 отзывов | rating = 0, reviewCount = 0 |
| list_teachers_filter | subject=математика, minRating=4 | Только подходящие учителя |

### Интеграционные тесты (endpoints)

| Тест | Метод | Path | Ожидание |
|------|-------|------|----------|
| List teachers | GET | /teachers | 200, массив с рейтингами |
| Filter by subject | GET | /teachers?subject=математика | 200, только математики |
| Teacher profile | GET | /teachers/:id | 200, полный профиль + занятия |
| Teacher not found | GET | /teachers/nonexistent | 404 |
| Update own profile | PUT | /teachers/me | 200, обновленный профиль |
| Update unauthorized | PUT | /teachers/me (no JWT) | 401 |
| Request verification | POST | /teachers/me/verify | 200, status=PENDING |
| Admin approve | POST | /admin/teachers/:id/approve | 200, status=VERIFIED |
| Admin reject | POST | /admin/teachers/:id/reject | 200, status=REJECTED |

### E2E-тесты

1. **Полный цикл верификации**: регистрация учителя → заполнение профиля → запрос верификации → одобрение → бейдж на странице
2. **Отклонение и повторная подача**: запрос → отклонение → исправление → повторный запрос → одобрение
3. **Рейтинг**: родитель записывается на занятие → оставляет отзыв → рейтинг пересчитан → отображается на профиле

## Деплой

### Миграции

- `create_teachers_table`: модель Teacher с индексами по rating и verificationStatus
- `add_teacher_verification_fields`: verificationRequestedAt, verifiedAt, verifiedBy, rejectionReason

### Переменные окружения

```
AVATAR_UPLOAD_MAX_SIZE=5242880   # 5MB
AVATAR_ALLOWED_TYPES=image/jpeg,image/png,image/webp
S3_BUCKET_AVATARS=klassmarket-avatars
```

### Хранение файлов

- Аватары загружаются в S3-совместимое хранилище (MinIO в dev, S3 в prod)
- URL аватара сохраняется в Teacher.avatar
- Resize: 200x200 thumbnail для карточек, оригинал для профиля

## Мониторинг

| Метрика | Тип | Алерт |
|---------|-----|-------|
| teachers.profile.updates | counter | - |
| teachers.verification.requested | counter | - |
| teachers.verification.approved | counter | - |
| teachers.verification.rejected | counter | reject_rate > 50% → review процесса |
| teachers.verification.pending_count | gauge | > 20 → alert (модерация отстает) |
| teachers.rating.recalculations | counter | - |
| teachers.avatar.upload_errors | counter | > 5/час → alert |

## Чеклист готовности

- [x] Unit-тесты TeachersService (12 кейсов)
- [x] Интеграционные тесты (9 endpoints)
- [x] E2E-тесты (3 сценария)
- [x] Workflow верификации полный (UNVERIFIED → PENDING → VERIFIED/REJECTED)
- [x] Рейтинг пересчитывается автоматически
- [x] Загрузка аватаров с валидацией
- [x] Публичный профиль без чувствительных данных
- [x] Миграции применены
