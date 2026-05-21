# Завершение: Расписание занятий

## 1. План тестирования

### Unit-тесты

| Тест | Файл | Приоритет |
|------|------|-----------|
| detectConflicts: пересечение интервалов | `sections.conflict.spec.ts` | Критический |
| detectConflicts: граничные касания (10:00-11:00 vs 11:00-12:00) | `sections.conflict.spec.ts` | Критический |
| detectConflicts: excludeSectionId при update | `sections.conflict.spec.ts` | Высокий |
| toUTC/fromUTC: Europe/Moscow | `sections.service.spec.ts` | Критический |
| toUTC/fromUTC: Asia/Vladivostok | `sections.service.spec.ts` | Высокий |
| toUTC/fromUTC: граница дня (23:30 МСК) | `sections.service.spec.ts` | Критический |
| createSection: happy path | `sections.service.spec.ts` | Высокий |
| cancelSection: trial + paid enrollments | `sections.service.spec.ts` | Высокий |
| getWeekSchedule: корректный диапазон | `sections.service.spec.ts` | Средний |

### **Критические тесты: часовые пояса**

```
TEST "timezone edge cases"
  // Тест 1: Moscow → UTC (стандарт)
  ASSERT toUTC("2026-06-15T10:00", "Europe/Moscow") === "2026-06-15T07:00:00Z"

  // Тест 2: Vladivostok → UTC
  ASSERT toUTC("2026-06-15T10:00", "Asia/Vladivostok") === "2026-06-15T00:00:00Z"

  // Тест 3: Граница дня
  ASSERT toUTC("2026-06-15T01:00", "Europe/Moscow") === "2026-06-14T22:00:00Z"
  // Дата в UTC — предыдущий день!

  // Тест 4: Новогодняя ночь
  ASSERT toUTC("2026-12-31T23:00", "Europe/Moscow") === "2026-12-31T20:00:00Z"

  // Тест 5: Round-trip
  original = "2026-06-15T15:30"
  ASSERT fromUTC(toUTC(original, "Europe/Moscow"), "Europe/Moscow") === original
```

### Integration-тесты

| Тест | Приоритет |
|------|-----------|
| POST /sections → 201 (без конфликтов) | Высокий |
| POST /sections → 409 (конфликт) | Критический |
| PUT /sections/:id → 200 (без нового конфликта) | Высокий |
| PUT /sections/:id → 422 (maxStudents < enrolled) | Высокий |
| DELETE /sections/:id → 200 + enrollments cancelled | Высокий |
| GET /sections/teacher/schedule → корректные секции за неделю | Средний |

### E2E-тесты (Playwright)

| Сценарий | Приоритет |
|----------|-----------|
| Создание секции через SectionForm → появление в WeeklyGrid | Высокий |
| Drag-and-drop для создания секции | Средний |
| Отображение ConflictWarning при конфликте | Высокий |

## 2. План развертывания

### Миграция БД
1. Модель Section с индексом `(classId, startTime)`
2. Seed: тестовые секции для demo-учителей

### Порядок деплоя
1. Backend: SectionsModule + endpoints
2. Frontend: TeacherSchedulePage + WeeklyGrid
3. Smoke test: создать/обновить/удалить секцию

## 3. Мониторинг

| Метрика | Алерт |
|---------|-------|
| section_created (counter) | — |
| section_cancelled (counter) | — |
| section_conflict_detected (counter) | — (информационно) |
| schedule_query_duration_ms (histogram) | p95 > 300ms |
| sections_per_teacher_per_week (gauge) | > 50 → warning |

### Логирование
- INFO: создание/обновление/отмена секции (sectionId, teacherId)
- WARN: конфликт обнаружен (sectionId, conflictingIds)
- WARN: отмена < 24ч до начала (sectionId, timeToStart)

## 4. Критерии готовности к релизу

- [ ] Тесты конфликтов зеленые (включая граничные касания)
- [ ] Тесты часовых поясов зеленые (все 5 кейсов)
- [ ] Отмена секции корректно обрабатывает enrollments
- [ ] WeeklyGrid отображает секции корректно
- [ ] Мониторинг настроен
