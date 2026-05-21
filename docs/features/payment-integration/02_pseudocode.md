# Псевдокод: Интеграция платежей

## 1. Расчет комиссии (Decimal арифметика)

```
FUNCTION calculateCommission(classPrice: Decimal, commissionRate: Decimal):
  // Все операции через decimal.js — НИКОГДА через float
  platformFee = classPrice.mul(commissionRate).toDecimalPlaces(2, ROUND_HALF_UP)
  teacherEarning = classPrice.sub(platformFee)

  RETURN {
    totalPrice: classPrice,
    platformFee,
    teacherEarning,
    commissionRate
  }
```

## 2. Создание платежа (ЮKassa API flow)

```
FUNCTION createCheckout(parentId, childId, sectionId):
  // 1. Загрузить секцию и класс
  section = db.sections.findOne(id=sectionId)
  class = db.classes.findOne(id=section.classId)

  // 2. Рассчитать комиссию
  commission = calculateCommission(class.price, class.commissionRate)

  // 3. Создать Payment в БД (status=pending)
  payment = db.payments.create({
    parentId, childId, sectionId,
    amount: commission.totalPrice,
    platformFee: commission.platformFee,
    teacherEarning: commission.teacherEarning,
    status: PENDING,
    idempotencyKey: generateUUID()
  })

  // 4. Создать платеж в ЮKassa
  yukassaPayment = yukassaApi.createPayment({
    amount: { value: commission.totalPrice.toString(), currency: "RUB" },
    confirmation: { type: "redirect", return_url: RETURN_URL },
    capture: true,
    description: "Оплата занятия: " + class.title,
    metadata: { paymentId: payment.id },
    receipt: {  // 54-ФЗ
      customer: { email: parent.email },
      items: [{ description: class.title, amount: commission.totalPrice, vat_code: 1 }]
    }
  })

  // 5. Сохранить yukassaId
  db.payments.update(id=payment.id, { yukassaId: yukassaPayment.id })

  RETURN { confirmationUrl: yukassaPayment.confirmation.confirmation_url }
```

## 3. Обработка вебхука (webhook handler)

```
FUNCTION handleWebhook(request):
  // 1. Верифицировать HMAC-SHA256 подпись
  signature = request.headers["X-YooKassa-Signature"]
  body = request.rawBody
  expectedSig = hmacSha256(YUKASSA_WEBHOOK_SECRET, body)
  IF signature !== expectedSig:
    THROW UnauthorizedError("Invalid webhook signature")

  event = JSON.parse(body)

  // 2. Проверить идемпотентность
  existing = db.webhookLog.findOne(eventId=event.event_id)
  IF existing IS NOT NULL:
    RETURN 200  // Уже обработан

  BEGIN TRANSACTION
    // 3. Записать в лог
    db.webhookLog.create({ eventId: event.event_id, type: event.event, processedAt: NOW() })

    // 4. Обработать по типу
    SWITCH event.event:
      CASE "payment.succeeded":
        payment = db.payments.findOne(yukassaId=event.object.id)
        db.payments.update(id=payment.id, { status: COMPLETED })
        db.enrollments.update(paymentId=payment.id, { status: CONFIRMED })
        db.teacherBalances.increment(teacherId, payment.teacherEarning)

      CASE "refund.succeeded":
        payment = db.payments.findOne(yukassaId=event.object.payment_id)
        db.payments.update(id=payment.id, { status: REFUNDED })
        db.teacherBalances.decrement(teacherId, payment.teacherEarning)

  COMMIT TRANSACTION

  ASYNC sendPaymentNotification(payment)
  RETURN 200
```

## 4. Очередь выплат (BullMQ payout)

```
FUNCTION requestWithdrawal(teacherId):
  balance = db.teacherBalances.findOne(teacherId=teacherId)
  IF balance.available < MIN_WITHDRAWAL (1000):
    THROW ValidationError("Минимальная сумма выплаты 1000 руб.")

  payout = db.payouts.create({
    teacherId,
    amount: balance.available,
    status: QUEUED
  })

  payoutQueue.add("process-payout", { payoutId: payout.id }, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 }
  })

  RETURN payout

FUNCTION processPayout(job):  // BullMQ worker
  payout = db.payouts.findOne(id=job.data.payoutId)
  TRY:
    yukassaApi.createPayout({ amount: payout.amount, destination: teacher.payoutMethod })
    db.payouts.update(id=payout.id, { status: COMPLETED })
    db.teacherBalances.deduct(teacherId, payout.amount)
  CATCH error:
    db.payouts.update(id=payout.id, { status: FAILED, error: error.message })
    THROW error  // BullMQ автоматически retry
```

## 5. API-контракты

### POST /payments/checkout
```json
// Request
{ "childId": "uuid", "sectionId": "uuid" }
// Response 201
{ "confirmationUrl": "https://yookassa.ru/payments/..." }
```

### POST /payments/webhook
```json
// ЮKassa body (не наш формат)
// Response: 200 OK (пустой)
```

### POST /payments/:id/refund
```json
// Response 200
{ "id": "uuid", "status": "refunded", "refundedAt": "..." }
```

### GET /payments/teacher/earnings?from=2026-01&to=2026-05
```json
{
  "total": "45000.00",
  "available": "12000.00",
  "periods": [{ "month": "2026-05", "earned": "15000.00", "paid": "10000.00" }]
}
```

### POST /payments/teacher/withdraw
```json
// Response 201
{ "payoutId": "uuid", "amount": "12000.00", "status": "queued" }
```
