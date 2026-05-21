# Завершение: Запись на пробное занятие

## 1. План тестирования

### Unit-тесты

| Тест | Файл | Приоритет |
|------|------|-----------|
| checkTrialEligibility: все проверки | `enrollments.service.spec.ts` | Высокий |
| calculateAge на граничных датах | `enrollments.service.spec.ts` | Высокий |
| createTrialEnrollment: happy path | `enrollments.service.spec.ts` | Высокий |
| createTrialEnrollment: duplicate rejection | `enrollments.service.spec.ts` | Высокий |
| getAvailableSeats: корректный подсчет | `enrollments.service.spec.ts` | Средний |
| EnrollmentGuard: ownership check | `enrollment.guard.spec.ts` | Высокий |
| CreateTrialDto: валидация UUID | `create-trial.dto.spec.ts` | Средний |

### Integration-тесты

| Тест | Приоритет |
|------|-----------|
| POST /enrollments/trial → 201 (happy path) | Высокий |
| POST /enrollments/trial → 409 (дубль) | Высокий |
| POST /enrollments/trial → 409 (нет мест) | Высокий |
| POST /enrollments/trial → 422 (возраст) | Высокий |
| DELETE /enrollments/:id → 200 (отмена) | Средний |
| GET /enrollments/trial-status → 200 | Средний |

### **Критический тест: конкурентная запись**

```
TEST "concurrent booking on last seat"
  GIVEN секция с maxStudents=1, 0 записей
  WHEN 10 параллельных POST /enrollments/trial с разными childId
  THEN ровно 1 запись создана со status=confirmed
  AND остальные 9 получили 409 NO_SEATS
  AND enrollments.count(sectionId) === 1
```

Этот тест верифицирует SERIALIZABLE транзакцию и является обязательным для merge.

### E2E-тесты (Playwright)

| Сценарий | Приоритет |
|----------|-----------|
| Полный флоу записи: карточка → выбор ребенка → подтверждение | Высокий |
| Отображение "нет мест" при заполненной секции | Средний |
| Отображение AgeCheck при несоответствии возраста | Средний |

## 2. План развертывания

### Миграция БД
1. `prisma migrate`: добавить модель Enrollment с уникальным индексом
2. Проверить: индекс `one_trial_per_class` создан корректно
3. Seed: тестовые секции с разным количеством мест

### Feature flags
- `TRIAL_BOOKING_ENABLED=true` — глобальный переключатель
- Rollout: 10% → 50% → 100% в течение 3 дней

### Порядок деплоя
1. Backend: миграция + API endpoints
2. Frontend: TrialBookingCard + SeatAvailability + AgeCheck
3. Smoke test: создать и отменить пробную запись

## 3. Мониторинг

| Метрика | Алерт |
|---------|-------|
| trial_enrollment_created (counter) | — |
| trial_enrollment_failed (counter, label: reason) | > 50/мин reason=INTERNAL |
| trial_eligibility_check_duration_ms (histogram) | p95 > 500ms |
| seats_exhausted_events (counter) | — (информационно) |

### Логирование
- INFO: успешная запись (enrollmentId, childId, sectionId)
- WARN: отказ по бизнес-правилу (reason)
- ERROR: DB timeout, unexpected exception

## 4. Критерии готовности к релизу

- [ ] Все unit и integration тесты зеленые
- [ ] Тест конкурентной записи пройден
- [ ] E2E smoke test пройден
- [ ] Rate limiting настроен
- [ ] Мониторинг и алерты настроены
- [ ] Документация API обновлена (Swagger)
