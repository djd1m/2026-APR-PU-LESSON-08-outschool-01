# Review Report: payment-integration
**Reviewer:** brutal-honesty-review (Linus + Ramsay)
**Date:** 2026-05-21

## Summary
- Severity: 4 blocker, 4 high, 3 medium, 2 low
- Verdict: NEEDS FIX

## Findings

### [blocker] --- Webhook endpoint has NO HMAC signature verification
**What's broken:** `payments.controller.ts:46-52` accepts the YooKassa webhook as a plain `@Body()` with zero signature verification. The spec (FR-2) and Architecture doc both mandate HMAC-SHA256 verification of every webhook. The Architecture even specifies a dedicated `PaymentsWebhook` component at `payments.webhook.ts` for this purpose. It does not exist.
**Why it's wrong:** Any attacker who knows the endpoint URL can forge a `payment.succeeded` webhook and mark arbitrary enrollments as CONFIRMED without actual payment. This is a payment fraud vector. Security calibration: Level 3 (Brutal) --- this is negligent.
**How to fix:** 1) Read the raw request body (use `@RawBody()` or a raw-body middleware) before JSON parsing. 2) Compute `HMAC-SHA256(rawBody, YOOKASSA_WEBHOOK_SECRET)`. 3) Compare with the `Signature` header from YooKassa. 4) Reject with 401 if mismatch. 5) Store `YOOKASSA_WEBHOOK_SECRET` in env (currently missing from `env.schema.ts`).
**File:** `packages/api/src/modules/payments/payments.controller.ts:46-52`

### [blocker] --- Float arithmetic for money calculations
**What's broken:** `payments.service.ts:23-25` converts price to `Number()` and performs float math: `Math.round(amount * COMMISSION_RATE * 100) / 100`. The spec explicitly states: "All financial calculations --- Decimal (decimal.js), NEVER float." The Architecture doc states: "Decimal for all amounts --- eliminates float errors: 0.1+0.2 !== 0.3."
**Why it's wrong:** `Number(enrollment.section.class.price)` converts a Prisma Decimal to a JavaScript float, losing precision. With `COMMISSION_RATE = 0.22` and prices that are Decimal(10,2), the intermediate multiplication can produce floating-point artifacts. Example: `Number(1999.99) * 0.22 = 439.9978` --- the rounding may produce incorrect kopeck amounts. Over thousands of transactions, systematic rounding errors accumulate.
**How to fix:** Use `decimal.js` or Prisma's built-in Decimal type throughout: `const amount = enrollment.section.class.price; const commission = amount.mul(COMMISSION_RATE).toDecimalPlaces(2); const teacherPayout = amount.sub(commission);`. Store `COMMISSION_RATE` as a Decimal constant. Never call `Number()` on monetary values.
**File:** `packages/api/src/modules/payments/payments.service.ts:23-25`

### [blocker] --- No idempotency on webhook processing
**What's broken:** `handleWebhook()` processes every incoming webhook call without checking if it was already processed. The spec (FR-2) requires idempotent processing. The Architecture specifies a `WebhookLog` table with `eventId @unique` for exactly this purpose. Neither the table nor the deduplication logic exists.
**Why it's wrong:** YooKassa explicitly documents that it may resend webhooks. Without idempotency, a retried `payment.succeeded` webhook could trigger duplicate side effects (double confirmation, duplicate notifications). A retried `canceled` webhook after a `succeeded` one could incorrectly mark a completed payment as refunded.
**How to fix:** 1) Add `WebhookLog` model to Prisma schema (per Architecture doc). 2) In `handleWebhook()`, attempt to insert into `WebhookLog` first --- if duplicate `eventId` → return `{ received: true }` immediately. 3) Wrap the status update + log insert in a transaction.
**File:** `packages/api/src/modules/payments/payments.service.ts:43-67`

### [blocker] --- No actual YooKassa API integration for checkout
**What's broken:** `createForEnrollment()` creates a Payment record in the database but never calls the YooKassa API to create an actual payment. The Architecture shows: `[PaymentsService] → YooKassa API: createPayment → confirmationUrl`. The method returns the database record, not a payment URL. There is no `yookassaId` set on creation, no `confirmationUrl` returned, and no HTTP client for YooKassa.
**Why it's wrong:** The payment flow is a dead end. Parents cannot actually pay. The frontend has nowhere to redirect to. The `yookassaId` field will always be null on creation, so the webhook handler's `findByYookassaId` will never match anything.
**How to fix:** Integrate with the YooKassa v3 API: `POST https://api.yookassa.ru/v3/payments` with Basic Auth (`YOOKASSA_SHOP_ID:YOOKASSA_SECRET_KEY`). Set `yookassaId` from the response. Return the `confirmation.confirmation_url` to the client. Use an `idempotency_key` header per YooKassa docs.
**File:** `packages/api/src/modules/payments/payments.service.ts:13-33`

### [high] --- YOOKASSA_WEBHOOK_SECRET missing from env schema
**What's broken:** `env.schema.ts` defines `YOOKASSA_SHOP_ID` and `YOOKASSA_SECRET_KEY` as optional, but `YOOKASSA_WEBHOOK_SECRET` is completely missing. The Architecture doc lists it as a required env variable.
**Why it's wrong:** Even if webhook verification is implemented, without the secret in the validated env schema, it would fail silently or use an undefined value. Also, `YOOKASSA_SHOP_ID` and `YOOKASSA_SECRET_KEY` being `.optional()` means the app can start without payment credentials --- in production this would mean all checkout attempts fail at runtime instead of failing fast at startup.
**How to fix:** Add `YOOKASSA_WEBHOOK_SECRET: z.string().min(16)` to env schema. Make `YOOKASSA_SHOP_ID` and `YOOKASSA_SECRET_KEY` required in production: `z.string().min(1)` (or conditional based on `NODE_ENV`).
**File:** `packages/api/src/config/env.schema.ts:23-24`

### [high] --- Webhook handler throws NotFoundException for unknown payments
**What's broken:** `handleWebhook()` throws `NotFoundException('Payment not found')` when `findByYookassaId` returns null. This returns HTTP 404 to YooKassa.
**Why it's wrong:** YooKassa interprets non-2xx responses as delivery failures and will retry the webhook aggressively (up to several days). If the payment doesn't exist (e.g., created in a different environment, or the system was restored from backup), YooKassa will hammer the endpoint indefinitely. Webhook handlers should ALWAYS return 200 OK, even for unknown events, and log the anomaly.
**How to fix:** Return `{ received: true }` with 200 status even when the payment is not found. Log a warning for investigation.
**File:** `packages/api/src/modules/payments/payments.service.ts:44-47`

### [high] --- No refund endpoint or logic
**What's broken:** FR-3 specifies admin-initiated refunds via YooKassa. The Architecture specifies refund functionality. The implementation has no refund endpoint, no refund service method, and no YooKassa refund API call. The `webhook` handler incorrectly sets `status: 'REFUNDED'` on a `canceled` webhook event --- but YooKassa `payment.canceled` is NOT the same as `refund.succeeded`.
**Why it's wrong:** Refund flow is entirely missing. The conflation of "canceled" (payment never completed) with "refunded" (money returned after completion) is a financial accounting error.
**How to fix:** Add `POST /payments/:id/refund` (admin-only). Implement `YooKassa POST /v3/refunds`. Handle `refund.succeeded` webhook separately from `payment.canceled`. Add proper status transitions: canceled (payment abandoned) vs refunded (money returned).
**File:** `packages/api/src/modules/payments/payments.service.ts:59-64`

### [high] --- No teacher earnings or withdrawal functionality
**What's broken:** FR-4 (earnings dashboard) and FR-5 (withdrawal) are specified with `TeacherEarningsPage`, `EarningsChart`, `WithdrawButton`, `PaymentsPayout`, `PaymentsQueue`, `TeacherBalance` model, and `Payout` model. None of these exist. The commission is calculated and stored but never accumulated into a teacher balance.
**Why it's wrong:** Teachers have no visibility into their earnings and no way to withdraw funds. The `TeacherBalance` and `Payout` models from the Architecture are not in the Prisma schema.
**How to fix:** Add `TeacherBalance` and `Payout` models to schema. Create earnings query endpoints. Implement BullMQ-based payout queue with retry logic per Architecture.
**File:** `packages/api/prisma/schema.prisma` (missing models)

### [medium] --- Payment created without enrollment status check
**What's broken:** `createForEnrollment()` creates a payment for any enrollment regardless of its status. A CANCELLED or COMPLETED enrollment can have a payment created for it.
**Why it's wrong:** Paying for a cancelled enrollment makes no business sense. Paying for an already-completed enrollment creates duplicate charges.
**How to fix:** Check `enrollment.status === 'PENDING'` before creating payment. Throw `BadRequestException` otherwise.
**File:** `packages/api/src/modules/payments/payments.service.ts:14-21`

### [medium] --- No access control on payment creation and viewing
**What's broken:** `POST /payments` has `JwtAuthGuard` but no ownership check. Any authenticated user can create a payment for any enrollment by providing any `enrollmentId`. `GET /payments/:id` has `JwtAuthGuard` but no check that the requester is the parent who owns the enrollment.
**Why it's wrong:** OWASP A01 (Broken Access Control). User A can initiate a payment flow for User B's enrollment, or view User B's payment details including amounts.
**How to fix:** Verify that the enrollment's child belongs to the requesting user before creating a payment or returning payment details.
**File:** `packages/api/src/modules/payments/payments.controller.ts:21-30`

### [medium] --- Missing frontend components
**What's broken:** CheckoutPage, PaymentSuccessPage, TeacherEarningsPage, PriceDisplay, EarningsChart, WithdrawButton --- all specified in Architecture --- are absent from the web package. There is no checkout flow in the UI.
**Why it's wrong:** The payment feature has no user-facing implementation.
**How to fix:** Implement the 6 frontend components. Wire checkout to the payment creation endpoint. Handle YooKassa redirect flow with success/failure pages.
**File:** `packages/web/src/` (missing components)

### [low] --- COMMISSION_RATE is a float constant
**What's broken:** `packages/shared/src/constants/index.ts:5` defines `COMMISSION_RATE = 0.22` as a JavaScript number (float). All downstream calculations that use this will inherit float imprecision.
**Why it's wrong:** Violates the spec's "all financial calculations in Decimal" requirement at the source.
**How to fix:** Either use `decimal.js` for the constant (`new Decimal('0.22')`) or store commission rate as basis points (integer 2200) and divide by 10000.
**File:** `packages/shared/src/constants/index.ts:5`

### [low] --- shared Payment type uses `number` for monetary fields
**What's broken:** `packages/shared/src/types/payment.ts` defines `amount`, `commission`, and `teacherPayout` as `number` type. While the Prisma schema correctly uses `Decimal(10,2)`, the shared type definition loses this guarantee at the TypeScript level.
**Why it's wrong:** Any code that imports the shared `Payment` type and performs arithmetic will use float math, even if the DB stores Decimal.
**How to fix:** Use `string` type for monetary fields in the shared type (Prisma returns Decimals as strings in JSON serialization) or use a Decimal library type.
**File:** `packages/shared/src/types/payment.ts:10-12`

## Security Checklist
- [ ] **CRITICAL FAIL:** No HMAC verification on webhook --- payment fraud possible
- [ ] **FAIL:** No idempotency --- duplicate processing risk
- [ ] **FAIL:** No access control on payment creation/viewing --- OWASP A01
- [ ] **FAIL:** `YOOKASSA_WEBHOOK_SECRET` missing from env validation
- [ ] **FAIL:** YooKassa credentials marked optional --- app starts without them
- [x] Admin-only guard on `GET /payments` (list all)
- [x] UUID validation on path params
- [x] No SQL injection (Prisma parameterized)

## Code Quality
| Criteria | Assessment |
|----------|------------|
| Correctness | FAILING --- 4 blockers; core payment flow (checkout + webhook) fundamentally broken |
| Architecture compliance | FAILING --- 8+ Architecture-specified components missing entirely |
| Financial safety | FAILING --- Float arithmetic for money, no idempotency, no HMAC |
| Error handling | Poor --- webhook returns 404 to payment provider |
| Test coverage | Unknown --- no test files found |
