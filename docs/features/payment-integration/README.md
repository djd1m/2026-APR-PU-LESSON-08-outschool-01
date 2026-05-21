# Feature: Интеграция платежей

**ID:** payment-integration
**Branch:** feature/007-payment-integration
**Epic:** E4
**Stories:** US-019, US-020, US-021, US-022
**Effort:** XL
**Status:** done

## Описание

Интеграция с ЮKassa для приема платежей за занятия, расчета комиссии платформы, обработки возвратов и выплат учителям. Вебхуки ЮKassa обрабатываются с HMAC-верификацией и идемпотентностью. Выплаты учителям выполняются через очередь BullMQ для надежной асинхронной обработки.

## Реализованные компоненты

### Backend
- `src/modules/payments/payments.controller.ts` — контроллер платежей и вебхуков
- `src/modules/payments/payments.service.ts` — бизнес-логика чекаута и возвратов
- `src/modules/payments/payments.webhook.ts` — обработка вебхуков ЮKassa с HMAC верификацией
- `src/modules/payments/payments.payout.ts` — логика выплат учителям
- `src/modules/payments/payments.queue.ts` — BullMQ очередь выплат
- `src/modules/payments/dto/checkout.dto.ts` — DTO создания платежа
- `prisma/schema.prisma` — модели Payment, Payout с Decimal полями

### Frontend
- `src/pages/CheckoutPage.tsx` — страница оформления платежа
- `src/pages/PaymentSuccessPage.tsx` — страница успешного платежа
- `src/pages/TeacherEarningsPage.tsx` — страница доходов учителя
- `src/components/payments/PriceDisplay.tsx` — отображение цены с комиссией
- `src/components/payments/EarningsChart.tsx` — график доходов учителя
- `src/components/payments/WithdrawButton.tsx` — кнопка запроса выплаты

## API Endpoints
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /payments/checkout | Yes (Parent) | Создание платежа в ЮKassa и редирект на оплату |
| POST | /payments/webhook | No (HMAC) | Обработка вебхуков ЮKassa (payment.succeeded, refund.succeeded) |
| POST | /payments/:id/refund | Yes (Admin) | Инициация возврата платежа |
| GET | /payments/teacher/earnings | Yes (Teacher) | Доходы учителя с детализацией по периодам |
| POST | /payments/teacher/withdraw | Yes (Teacher) | Запрос на выплату накопленных средств |

## Ключевые решения
- Decimal математика (Prisma Decimal / decimal.js) для всех финансовых расчетов — исключает ошибки округления с плавающей точкой
- HMAC-SHA256 верификация подписи вебхуков ЮKassa для защиты от подделки уведомлений
- Идемпотентность обработки вебхуков: idempotencyKey хранится в БД, повторные вебхуки игнорируются
- BullMQ очередь для выплат учителям: retry с экспоненциальным backoff, dead letter queue для сбойных задач
- Комиссия платформы рассчитывается как процент от суммы занятия и фиксируется в момент создания платежа
