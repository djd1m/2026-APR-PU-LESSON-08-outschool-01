# Архитектура: Интеграция платежей

## 1. Размещение компонентов

### Backend (NestJS)

| Компонент | Путь | Назначение |
|-----------|------|-----------|
| PaymentsController | `src/modules/payments/payments.controller.ts` | REST endpoints: checkout, refund, earnings, withdraw |
| PaymentsWebhook | `src/modules/payments/payments.webhook.ts` | Обработка вебхуков ЮKassa с HMAC верификацией |
| PaymentsService | `src/modules/payments/payments.service.ts` | Бизнес-логика чекаута и возвратов |
| PaymentsPayout | `src/modules/payments/payments.payout.ts` | Логика выплат учителям |
| PaymentsQueue | `src/modules/payments/payments.queue.ts` | BullMQ очередь и worker для выплат |
| CheckoutDto | `src/modules/payments/dto/checkout.dto.ts` | Валидация: childId, sectionId |

### Frontend (React + TypeScript)

| Компонент | Путь | Назначение |
|-----------|------|-----------|
| CheckoutPage | `src/pages/CheckoutPage.tsx` | Страница оформления: цена, комиссия, кнопка оплаты |
| PaymentSuccessPage | `src/pages/PaymentSuccessPage.tsx` | Результат оплаты по return_url |
| TeacherEarningsPage | `src/pages/TeacherEarningsPage.tsx` | Доходы учителя с графиком |
| PriceDisplay | `src/components/payments/PriceDisplay.tsx` | Цена с разбивкой на стоимость и комиссию |
| EarningsChart | `src/components/payments/EarningsChart.tsx` | График доходов по месяцам |
| WithdrawButton | `src/components/payments/WithdrawButton.tsx` | Кнопка запроса выплаты |

### Модель данных

```prisma
model Payment {
  id              String        @id @default(uuid())
  yukassaId       String?       @unique
  idempotencyKey  String        @unique
  amount          Decimal       // Полная сумма
  platformFee     Decimal       // Комиссия платформы
  teacherEarning  Decimal       // Доход учителя
  status          PaymentStatus // pending | completed | refunded | failed
  parentId        String
  childId         String
  sectionId       String
  createdAt       DateTime      @default(now())
  completedAt     DateTime?
}

model Payout {
  id        String       @id @default(uuid())
  teacherId String
  amount    Decimal
  status    PayoutStatus // queued | processing | completed | failed
  error     String?
  createdAt DateTime     @default(now())
}

model WebhookLog {
  id          String   @id @default(uuid())
  eventId     String   @unique
  type        String
  processedAt DateTime @default(now())
}

model TeacherBalance {
  teacherId String  @id
  total     Decimal @default(0)
  available Decimal @default(0)
  paid      Decimal @default(0)
}
```

## 2. Внешние зависимости

```
PaymentsModule
  ├── ЮKassa API (https://api.yookassa.ru/v3)
  │     ├── POST /payments — создание платежа
  │     ├── POST /refunds — возврат
  │     └── POST /payouts — выплата
  ├── BullMQ + Redis — очередь выплат
  ├── imports: [PrismaModule, AuthModule, EnrollmentsModule]
  └── env: YUKASSA_SHOP_ID, YUKASSA_SECRET_KEY, YUKASSA_WEBHOOK_SECRET
```

## 3. Диаграмма взаимодействия

```
[CheckoutPage] → POST /payments/checkout → [PaymentsService]
                                                  │
                                         ЮKassa API: createPayment
                                                  │
                                         ← confirmationUrl ←
                                                  │
Родитель → ЮKassa оплата → callback → POST /payments/webhook
                                                  │
                                         [PaymentsWebhook: HMAC verify]
                                                  │
                                         [idempotency check]
                                                  │
                                         TX: Payment.completed + Enrollment.confirmed
                                                  │
                                         TeacherBalance.increment
```

## 4. Ключевые архитектурные решения

| Решение | Обоснование |
|---------|------------|
| Decimal для всех сумм | Исключает ошибки float: 0.1+0.2 !== 0.3 |
| HMAC верификация вебхуков | Защита от подделки уведомлений |
| Idempotency через eventId | ЮKassa может отправлять дубли |
| BullMQ для выплат | Retry + dead letter + delayed processing |
| WebhookLog таблица | Аудит + идемпотентность в одном |
