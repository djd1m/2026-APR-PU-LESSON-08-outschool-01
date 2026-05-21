# Завершение: Отзывы и рейтинги

## План тестирования

### Unit-тесты

| Компонент | Тест | Ожидание |
|-----------|------|----------|
| ReviewsService.create | Отзыв с валидными данными | Создаётся со статусом pending_moderation |
| ReviewsService.create | Нет завершённых занятий | ForbiddenException |
| ReviewsService.create | Дублирующий отзыв | ConflictException |
| ReviewsService.create | Текст < 50 символов | BadRequestException |
| autoModerate | Текст с запрещённым словом | Возвращает флаг banned_words |
| autoModerate | Новый аккаунт (< 7 дней) | Возвращает флаг new_account |
| recalculateRating | 0 отзывов | Bayesian avg = 3.5 (априорное) |
| recalculateRating | 10 пятизвёздочных | Bayesian avg ≈ 4.25 (сглаженный) |
| publishReview | Уже опубликован | Idempotent, без ошибки |

### Integration-тесты

| Сценарий | Шаги | Проверка |
|----------|------|----------|
| Полный цикл отзыва | Создать → автомодерация → публикация | Рейтинг класса обновлён |
| Модерация | Создать flagged → админ reject | Статус rejected, уведомление |
| Автопубликация | Создать без флагов → ждать 24ч | BullMQ job срабатывает, статус published |
| Пагинация | Создать 25 отзывов | GET page=1 limit=10 возвращает 10, total=25 |

### E2E-тесты

| Тест | Описание |
|------|----------|
| Родитель оставляет отзыв | Заполнение формы → отправка → отзыв в списке (после модерации) |
| Админ модерирует отзыв | Переход в модерацию → одобрение → отзыв на карточке |
| Кнопка "Оставить отзыв" скрыта | Для незаписанных пользователей кнопка не отображается |

## Деплой

### Миграция БД
1. `npx prisma migrate dev --name add-reviews-table` — создание таблицы reviews
2. Добавить поля `average_rating` и `review_count` в таблицу classes (если отсутствуют)
3. Seed: файл banned_words.json в конфигурации

### BullMQ
- Добавить очередь `review-auto-publish` в конфигурацию BullMQ
- Worker: `ReviewAutoPublishProcessor` с retry policy (3 попытки, exponential backoff)

### Feature flag
- `FEATURE_REVIEWS_ENABLED=true` — включение функциональности отзывов
- Позволяет отключить при обнаружении проблем без отката деплоя

## Мониторинг

| Метрика | Алерт | Порог |
|---------|-------|-------|
| reviews.created.count | Info | > 100/час (аномальная активность) |
| reviews.flagged.ratio | Warning | > 30% от всех новых отзывов |
| reviews.moderation.queue_size | Warning | > 50 необработанных |
| reviews.rating_recalc.duration | Error | > 5 секунд |
| reviews.auto_publish.failed | Error | > 3 подряд |

## Критерии готовности к релизу

- [ ] Все unit и integration тесты проходят
- [ ] E2E тест полного цикла отзыва (создание → модерация → публикация)
- [ ] Banned words словарь загружен и проверен
- [ ] BullMQ worker запущен и обрабатывает задачи
- [ ] Мониторинг настроен в Grafana
- [ ] Документация API обновлена в OpenAPI spec
