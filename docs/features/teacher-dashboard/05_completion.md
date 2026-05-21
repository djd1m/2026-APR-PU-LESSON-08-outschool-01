# Завершение: Личный кабинет преподавателя

## План тестирования

### Unit-тесты

| Компонент | Тест | Ожидание |
|-----------|------|----------|
| EarningsService.getEarnings | 10 платежей, комиссия 20% | gross, commission, net корректны |
| EarningsService.getEarnings | Нет платежей за период | Все суммы = 0 |
| PayoutService.requestPayout | Баланс 5000, вывод 3000 | Payout создан, available уменьшен |
| PayoutService.requestPayout | Баланс 500, вывод 1000 | BadRequestException |
| PayoutService.requestPayout | Уже есть processing-payout | ConflictException |
| getUpcomingSessions | 3 секции на неделе | 3 карточки, canStart корректен |
| getUpcomingSessions | Нет секций | Пустой массив |
| getStudentsSummary | 2 секции по 5 учеников, 3 пересечения | totalUnique = 7 |

### Integration-тесты

| Сценарий | Шаги | Проверка |
|----------|------|----------|
| Полный цикл вывода | Создать payout → BullMQ → mock ЮKassa success | Статус completed, баланс обновлён |
| Вывод с ошибкой | Payout → ЮKassa reject (3 попытки) | Статус failed, баланс восстановлен |
| Конкурентный баланс | Параллельно: +1000 (платёж) и -2000 (вывод) | Нет race condition |
| Дашборд полный | Учитель с данными | Все 4 блока возвращают данные |

### E2E-тесты

| Тест | Описание |
|------|----------|
| Дашборд загружается | Преподаватель → /teach/dashboard → 4 блока отображаются |
| Вывод средств | Клик "Вывести" → модалка → подтверждение → статус "Обрабатывается" |
| Пустой дашборд | Новый верифицированный учитель → CTA "Создать класс" |
| История начислений | Переход в детальную историю → таблица с пагинацией |

## Деплой

### Миграция БД
1. `CREATE TABLE teacher_balances` — баланс преподавателя
2. `CREATE TABLE payouts` — история выводов
3. Инициализация баланса для существующих преподавателей (пересчёт из payments)
4. Индексы: `(teacher_id, created_at DESC)` на payouts

### BullMQ
- Очередь `process-payout` с retry policy: 3 попытки, backoff 30s/60s/120s
- Worker: `PayoutProcessor` — интеграция с ЮKassa Payouts API
- Dead letter queue для failed payouts

### Конфигурация
- `PAYOUT_MIN_AMOUNT=1000` — минимальная сумма вывода
- `PLATFORM_COMMISSION_RATE=0.20` — комиссия платформы
- `PAYOUT_MAX_DAILY=3` — максимум заявок на вывод в сутки

## Мониторинг

| Метрика | Алерт | Порог |
|---------|-------|-------|
| teacher.dashboard.latency | Warning | P95 > 2 секунды |
| payouts.processing.duration | Warning | > 3 рабочих дней |
| payouts.failed.count | Error | > 5 за день |
| payouts.total_amount.daily | Info | > 500,000 руб. (аномалия) |
| teacher.balance.negative | Critical | Любой отрицательный баланс |

## Критерии готовности к релизу

- [ ] Все unit и integration тесты проходят
- [ ] E2E: дашборд загружается, вывод средств работает
- [ ] Миграция баланса для существующих преподавателей выполнена
- [ ] ЮKassa Payouts API интеграция протестирована в sandbox
- [ ] Аудит-логирование финансовых операций проверено
- [ ] Мониторинг и алерты настроены в Grafana
