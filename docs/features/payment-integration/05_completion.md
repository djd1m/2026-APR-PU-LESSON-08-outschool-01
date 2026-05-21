# Завершение: Интеграция платежей

## 1. План тестирования

### Unit-тесты

| Тест | Файл | Приоритет |
|------|------|-----------|
| calculateCommission: Decimal точность | `payments.service.spec.ts` | Критический |
| calculateCommission: округление граничных значений | `payments.service.spec.ts` | Критический |
| createCheckout: формирование запроса ЮKassa | `payments.service.spec.ts` | Высокий |
| handleWebhook: HMAC верификация (valid/invalid) | `payments.webhook.spec.ts` | Критический |
| handleWebhook: идемпотентность (повторный eventId) | `payments.webhook.spec.ts` | Критический |
| handleWebhook: payment.succeeded flow | `payments.webhook.spec.ts` | Высокий |
| handleWebhook: refund.succeeded flow | `payments.webhook.spec.ts` | Высокий |
| requestWithdrawal: проверка минимума | `payments.payout.spec.ts` | Высокий |
| processPayout: success/failure paths | `payments.payout.spec.ts` | Высокий |

### Integration-тесты (с mock ЮKassa)

| Тест | Приоритет |
|------|-----------|
| POST /payments/checkout → 201 + корректный confirmationUrl | Критический |
| POST /payments/webhook (valid HMAC) → Payment.completed | Критический |
| POST /payments/webhook (invalid HMAC) → 401 | Критический |
| POST /payments/webhook (duplicate eventId) → 200, no side effects | Критический |
| POST /payments/:id/refund → 200 + TeacherBalance уменьшен | Высокий |
| GET /payments/teacher/earnings → корректные суммы | Высокий |
| POST /payments/teacher/withdraw → 201 + payout в очереди | Высокий |

### **Критические тесты: Decimal арифметика**

```
TEST "commission calculation preserves precision"
  prices = [999.99, 0.01, 100000.00, 1.50]
  FOR EACH price IN prices:
    result = calculateCommission(Decimal(price), Decimal(0.225))
    ASSERT result.platformFee + result.teacherEarning === Decimal(price)
    ASSERT result.platformFee.decimalPlaces() <= 2
```

### **Критический тест: Webhook mock**

```
TEST "full payment lifecycle via webhook"
  1. POST /payments/checkout → получить paymentId
  2. Отправить mock webhook payment.succeeded с корректным HMAC
  3. ASSERT Payment.status === completed
  4. ASSERT Enrollment.status === confirmed
  5. ASSERT TeacherBalance.available увеличен на teacherEarning
```

### E2E-тесты (Playwright)

| Сценарий | Приоритет |
|----------|-----------|
| Checkout flow: выбор секции → redirect → return page | Высокий |
| Teacher earnings page: отображение графика | Средний |
| Withdraw button: запрос и отображение статуса | Средний |

## 2. План развертывания

### Миграция БД
1. Модели: Payment, Payout, WebhookLog, TeacherBalance
2. Индексы: yukassaId (unique), eventId (unique), parentId+status

### Инфраструктура
1. Redis для BullMQ (если еще не развернут)
2. Env variables: YUKASSA_SHOP_ID, YUKASSA_SECRET_KEY, YUKASSA_WEBHOOK_SECRET
3. Webhook URL регистрация в личном кабинете ЮKassa

### Порядок деплоя
1. Backend: миграция + PaymentsModule + webhook endpoint
2. Настройка webhook в ЮKassa (тестовый магазин)
3. Smoke test: тестовый платеж через ЮKassa sandbox
4. Frontend: CheckoutPage + TeacherEarningsPage
5. Переключение на production ЮKassa

## 3. Мониторинг

| Метрика | Алерт |
|---------|-------|
| payment_checkout_created (counter) | — |
| payment_completed (counter) | — |
| payment_failed (counter) | > 10/час |
| webhook_invalid_signature (counter) | > 0 → немедленный алерт |
| webhook_processing_duration_ms (histogram) | p95 > 4000ms |
| payout_queue_size (gauge) | > 100 |
| payout_dead_letter (counter) | > 0 → алерт |
| decimal_rounding_drift (gauge) | > 0 → критический алерт |

### Финансовый аудит
- Ежедневная сверка: sum(payments.completed) vs ЮKassa отчет
- Ежемесячный отчет: комиссии, выплаты, баланс платформы

## 4. Критерии готовности к релизу

- [ ] Decimal тесты зеленые (все граничные значения)
- [ ] Webhook HMAC тест пройден
- [ ] Идемпотентность вебхуков подтверждена
- [ ] BullMQ payout flow протестирован (success + retry + DLQ)
- [ ] Тестовый платеж через ЮKassa sandbox успешен
- [ ] Финансовые логи записываются корректно
- [ ] Алерты на невалидные подписи настроены
