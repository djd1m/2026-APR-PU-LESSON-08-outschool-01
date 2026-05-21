# Review Report: teacher-dashboard
**Reviewer:** brutal-honesty-review (Linus + Ramsay)
**Date:** 2026-05-21

## Summary
- Severity: 2 blocker, 2 high, 2 medium, 1 low
- Verdict: NEEDS FIX

## Findings

### [blocker] — Teacher dashboard page does not exist
**What's broken:** The file `packages/web/src/app/(main)/teach/dashboard/page.tsx` does not exist. There is no teacher dashboard page in the web application at all. The route `/teach/dashboard` will return a 404.
**Why it's wrong:** The entire teacher-dashboard feature (US-T03, US-T05) is unimplemented on the frontend. The spec defines 4 blocks (Earnings, Students, Upcoming Sessions, Recent Reviews) with 7 Gherkin scenarios. Zero are implemented.
**How to fix:** Create the teacher dashboard page with the specified blocks. Will need corresponding API endpoints for teacher-specific data aggregation.
**File:** `packages/web/src/app/(main)/teach/dashboard/page.tsx` (MISSING)

### [blocker] — No teacher dashboard API endpoints exist
**What's broken:** There are no API endpoints for teacher-specific dashboard data. The spec requires: current balance, monthly earnings, commission breakdown, payout history, student list by section, upcoming sessions, recent reviews. None of these endpoints exist. The `UsersController` has `GET /users/me` which returns basic user data + teacherProfile, but no earnings, no students, no schedule aggregation.
**Why it's wrong:** Without backend endpoints, even if the frontend existed, it would have nothing to call. The teacher dashboard is a full-stack non-delivery.
**How to fix:** Create a `TeacherDashboardController` (or add to `UsersController`) with endpoints:
  - `GET /teacher/earnings` — balance, monthly totals, commission
  - `GET /teacher/students` — students grouped by section
  - `GET /teacher/schedule` — upcoming sessions
  - `GET /teacher/reviews` — recent reviews for teacher's classes
**File:** No file exists — needs creation.

### [high] — Earnings calculation uses JavaScript floating-point, not Decimal
**What's broken:** In `PaymentsService.createForEnrollment()`, the commission is calculated as `Math.round(amount * COMMISSION_RATE * 100) / 100` where `amount = Number(enrollment.section.class.price)`. The `price` field is `Decimal(10,2)` in Prisma, but it's cast to a JavaScript `Number` (IEEE 754 float) for arithmetic. For example, `9999.99 * 0.2 = 1999.9980000000003` in JS.
**Why it's wrong:** Financial calculations with floating-point produce rounding errors. The spec says commission is 20%. On a 9999.99 rub class: `9999.99 * 0.2 = 1999.998` which rounds to `2000.00`, but the actual teacher payout becomes `7999.99` — the math loses 0.01 rub per transaction. At scale, these pennies accumulate into material discrepancies.
**How to fix:** Use a Decimal library (`decimal.js` or Prisma's built-in `Decimal`) for all monetary arithmetic. Never convert Decimal to Number for financial math.
**File:** `packages/api/src/modules/payments/payments.service.ts:23-25`

### [high] — Teacher can only see own data: NOT enforced at API level
**What's broken:** There is no concept of "teacher sees only own data" enforced anywhere. The `GET /users/:id` endpoint (UsersController) is accessible to any authenticated user and returns full user data including `teacherProfile` and `children`. There are no teacher-scoped queries in the codebase at all.
**Why it's wrong:** The spec requires teacher data isolation — a teacher should see only their own students, their own earnings, their own classes. Currently, `GET /users/:id` with any teacher's UUID exposes their profile to any authenticated user.
**How to fix:** The `GET /users/:id` endpoint should either be restricted to ADMIN or should filter sensitive fields for non-owner requests. Teacher dashboard endpoints (when created) must scope all queries by `teacherId`.
**File:** `packages/api/src/modules/users/users.controller.ts:42-44`

### [medium] — TeacherProfile.rating is Decimal(3,2) — max value 9.99, insufficient if using weighted average
**What's broken:** The `rating` field on `TeacherProfile` is defined as `Decimal(3,2)` which allows values from 0.00 to 9.99. For a 1-5 star system this technically works, but the Bayesian average formula `(C * m + sum) / (C + n)` with `C=10, m=3.5` can produce intermediate values that need more precision. More critically, `Decimal(3,2)` means only 1 digit before the decimal point — so max is `9.99`. This is fine for 1-5 ratings but leaves no headroom.
**Why it's wrong:** Marginal issue, but `Decimal(3,2)` is misleadingly tight. If anyone changes to a 10-point scale, it breaks silently.
**How to fix:** Consider `Decimal(4,2)` for headroom, or document the constraint explicitly.
**File:** `packages/api/prisma/schema.prisma:89`

### [medium] — No withdrawal/payout system implemented
**What's broken:** The spec describes a payout flow: "Вывести средства" button, minimum 1000 rub threshold, processing status, 1-3 business day bank transfer. There is no payout model, no payout endpoint, no balance tracking. The `Payment` model tracks per-enrollment payments but there is no aggregated teacher balance or withdrawal mechanism.
**Why it's wrong:** Teachers cannot get paid. This is a core business requirement (US-T05, High priority).
**How to fix:** Create a `TeacherBalance` model (or computed view), a `Payout` model with status tracking, and corresponding API endpoints for requesting and processing withdrawals.
**File:** `packages/api/prisma/schema.prisma` (no Payout model)

### [low] — No test coverage for teacher-specific flows
**What's broken:** With no teacher dashboard implementation, there are naturally zero tests for it. But even the existing payment commission calculation — the one piece of teacher-relevant logic — appears to have no unit tests.
**Why it's wrong:** Financial calculations without tests are a liability.
**How to fix:** Write unit tests for `PaymentsService.createForEnrollment()` with edge cases: very small amounts, very large amounts, amounts that produce repeating decimals.
**File:** N/A — no test files found

## Security Checklist
- [ ] **A01 Broken Access Control:** FAIL — `GET /users/:id` exposes any user's data; no teacher data scoping
- [x] **A03 Injection:** PASS — Prisma parameterized queries
- [ ] **A04 Insecure Design:** FAIL — no teacher data isolation architecture
- [x] **A07 Auth:** PASS — JWT guard on user endpoints
- [ ] **A09 Logging:** FAIL — no audit trail for any teacher actions

## Code Quality
| Criteria | Rating | Notes |
|----------|--------|-------|
| Correctness | N/A | Feature does not exist |
| Feature Completeness | Failing | 0% of spec implemented (no frontend, no backend) |
| Financial Accuracy | Failing | Floating-point arithmetic for money |
| Security | Failing | No data isolation for teacher-specific data |
| Architecture | Failing | No teacher-scoped service layer at all |
