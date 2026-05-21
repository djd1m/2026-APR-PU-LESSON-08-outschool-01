# Завершение: Панель администратора

## План тестирования

### Unit-тесты

| Компонент | Тест | Ожидание |
|-----------|------|----------|
| AnalyticsService.getPlatformStats | Период с 100 платежами | GMV, avgCheck, конверсия корректны |
| AnalyticsService.getPlatformStats | Пустой период | Все метрики = 0, без ошибок |
| TeacherModerationService.approve | Валидная заявка | Статус verified, аудит-лог создан |
| TeacherModerationService.reject | Без причины | BadRequestException |
| BatchModerationService.batch | 3 заявки, approve | Все обновлены, 3 аудит-записи |
| BatchModerationService.batch | 51 элемент | BadRequestException |
| AdminGuard | Роль PARENT | 403 Forbidden |
| AdminGuard | ADMIN без 2FA | 403 Forbidden |
| AdminGuard | ADMIN с 2FA | Доступ разрешён |
| AuditService.log | Действие модерации | Запись создана с IP и timestamp |

### Integration-тесты

| Сценарий | Шаги | Проверка |
|----------|------|----------|
| Полный цикл верификации | Заявка → одобрение → статус verified | Аудит-лог, уведомление |
| Батч-отклонение | 5 заявок → batch reject | Все rejected, 5 аудит-записей |
| Конкурентная модерация | 2 админа → одна заявка | Один 200, один 409 |
| Аналитика с кешем | GET stats → повторный GET | Второй запрос из Redis (< 10ms) |
| Аудит-лог | 3 действия модерации | GET /admin/audit-log → 3 записи |

### E2E-тесты

| Тест | Описание |
|------|----------|
| Доступ к панели | ADMIN с 2FA → /admin загружается; PARENT → 403 |
| Верификация преподавателя | Открыть очередь → одобрить → заявка исчезает |
| Модерация отзыва | Открыть flagged отзыв → отклонить с причиной |
| Аналитика | Переключение периодов → данные обновляются |
| Батч-операция | Выбрать 3 чекбокса → "Одобрить выбранные" → все обработаны |

## Деплой

### Миграция БД
1. `CREATE TABLE audit_logs` — аудит-лог действий администраторов
2. Индексы: `(admin_id, created_at)`, `(action, created_at)`, `(target_id, target_type)`
3. Materialized view: `mv_daily_stats` (DAU, регистрации, платежи по дням)
4. Cron job: `REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_stats` каждый час

### 2FA
- Добавить поле `two_factor_enabled` и `two_factor_secret` в таблицу users
- Интеграция с TOTP (Google Authenticator / Яндекс.Ключ)
- Обязательная активация при первом входе администратора

### Конфигурация
- `ADMIN_IP_WHITELIST=10.0.0.0/8,172.16.0.0/12` — разрешённые IP
- `ADMIN_SESSION_TIMEOUT=1800` — таймаут сессии (30 мин)
- `ADMIN_BATCH_LIMIT=50` — лимит батч-операций
- `ANALYTICS_CACHE_TTL=900` — TTL кеша аналитики (15 мин)

## Мониторинг

| Метрика | Алерт | Порог |
|---------|-------|-------|
| admin.login.failed | Warning | > 5 неудачных попыток за 10 мин |
| admin.moderation.queue_size | Warning | > 100 необработанных заявок |
| admin.stats.latency | Warning | P95 > 3 секунды |
| admin.batch.size | Info | Батч > 30 элементов |
| admin.audit.unauthorized_access | Critical | Любая попытка доступа без ADMIN роли |
| admin.2fa.disabled | Critical | Администратор без 2FA (проверка ежедневно) |

## Критерии готовности к релизу

- [ ] Все unit и integration тесты проходят
- [ ] E2E: доступ, модерация, аналитика, батч-операции
- [ ] 2FA настроена и протестирована для всех администраторов
- [ ] IP whitelist сконфигурирован в Nginx
- [ ] Аудит-логирование работает для всех действий
- [ ] Materialized views созданы, cron настроен
- [ ] Мониторинг и алерты настроены в Grafana
- [ ] Penetration test: попытки доступа без прав отклоняются
