# Завершение: Онбординг-квиз

## План тестирования

### Unit-тесты (ChildrenService)

| Тест | Описание | Ожидание |
|------|----------|----------|
| create_child_success | Валидные данные | Child создан, возвращен с id |
| create_child_age_too_young | birthDate = 2 года назад | BadRequestException "Минимальный возраст 3 года" |
| create_child_age_too_old | birthDate = 19 лет назад | BadRequestException "Максимальный возраст 18 лет" |
| create_child_empty_name | name = "" | BadRequestException |
| create_child_invalid_interest | interests = ["unknown"] | BadRequestException "Неизвестный интерес" |
| create_child_max_limit | У родителя уже 5 детей | BadRequestException "Достигнут лимит профилей" |
| list_children | Родитель с 2 детьми | Массив из 2 профилей |
| list_children_empty | Родитель без детей | Пустой массив |

### Unit-тесты (frontend — useQuizState)

| Тест | Описание | Ожидание |
|------|----------|----------|
| initial_state | Начальное состояние | currentStep=NAME, data пустые |
| next_from_name_valid | name="Маша" → nextStep | currentStep=AGE |
| next_from_name_empty | name="" → nextStep | Ошибка, currentStep=NAME |
| prev_from_age | prevStep на шаге AGE | currentStep=NAME, данные сохранены |
| next_from_interests_none | interests=[] → nextStep | Ошибка, currentStep=INTERESTS |
| skip_quiz | skip() | redirect вызван |

### Интеграционные тесты (endpoints)

| Тест | Метод | Path | Ожидание |
|------|-------|------|----------|
| Create child | POST | /users/children | 201, body содержит child |
| Create child unauthorized | POST | /users/children (no JWT) | 401 |
| List children | GET | /users/children | 200, массив |
| Get interests | GET | /interests | 200, массив интересов |

### E2E-тесты

1. **Полный квиз**: регистрация → шаг 1 (имя) → шаг 2 (возраст) → шаг 3 (интересы) → шаг 4 (подтверждение) → каталог с фильтрами
2. **Пропуск квиза**: регистрация → "Пропустить" → каталог без фильтров → повторный вход → banner "Заполните профиль"
3. **Навигация назад**: шаг 3 → "Назад" → шаг 2 → данные сохранены → "Далее" → шаг 3 с прежними интересами

## Деплой

### Миграции

- `create_children_table`: модель Child с индексом по parentId
- Данные: предзаполнение каталога интересов не требуется (hardcoded в константах)

### Переменные окружения

Дополнительные переменные не требуются — фича использует существующую аутентификацию.

## Мониторинг

| Метрика | Тип | Алерт |
|---------|-----|-------|
| onboarding.quiz.started | counter | - |
| onboarding.quiz.completed | counter | - |
| onboarding.quiz.skipped | counter | skip_rate > 50% → review UX |
| onboarding.quiz.step_dropout | histogram | Высокий dropout на конкретном шаге → review UX |
| children.created | counter | - |

## Чеклист готовности

- [x] Unit-тесты ChildrenService (8 кейсов)
- [x] Unit-тесты useQuizState (6 кейсов)
- [x] Интеграционные тесты (4 endpoint)
- [x] E2E-тесты (3 сценария)
- [x] Мобильная адаптация (320px+)
- [x] SessionStorage для сохранения промежуточного состояния
- [x] Анимации переходов между шагами
- [x] Миграция применена
