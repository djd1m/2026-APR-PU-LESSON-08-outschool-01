# Review Report: trial-booking
**Reviewer:** brutal-honesty-review (Linus + Ramsay)
**Date:** 2026-05-21

## Summary
- Severity: 3 blocker, 3 high, 4 medium, 2 low
- Verdict: NEEDS FIX

## Findings

### [blocker] --- Race condition on last seat (TOCTOU)
**What's broken:** `enrollments.service.ts:26-33` reads `section.enrolledCount`, compares it to `maxStudents`, then creates the enrollment in a **separate** query. Two concurrent requests can both read `enrolledCount=11` (max 12), both pass the check, and both enroll --- resulting in 13 students in a 12-seat section.
**Why it's wrong:** The SPARC Architecture doc (03_architecture.md) explicitly mandates a `SERIALIZABLE` Prisma transaction (`Prisma TX (SERIALIZABLE)`) for exactly this reason. The implementation uses no transaction at all --- the `findUnique`, the check, the `create`, and the `section.update` are four independent queries.
**How to fix:** Wrap the entire check-and-create flow in a `prisma.$transaction` with `isolationLevel: Serializable`. Alternatively, use an atomic `UPDATE sections SET enrolled_count = enrolled_count + 1 WHERE id = ? AND enrolled_count < max_students` returning the affected row count, and abort if 0 rows affected.
**File:** `packages/api/src/modules/enrollments/enrollments.service.ts:17-46`

### [blocker] --- No trial/paid enrollment type distinction
**What's broken:** The Prisma schema `Enrollment` model has no `type` field (no `EnrollmentType` enum exists). The spec requires `type=TRIAL` vs `type=PAID` with a unique composite index `@@unique([childId, classId, type])` named `one_trial_per_class`. The actual schema only has `@@unique([childId, sectionId])` --- which enforces one enrollment per section, NOT one trial per class.
**Why it's wrong:** A child can take unlimited "trial" enrollments across different sections of the same class, completely violating FR-2 (one-trial-per-class rule). The spec's core business rule is unenforceable at the database level.
**How to fix:** Add `type EnrollmentType` enum (`TRIAL | PAID`) to the Prisma schema, add a `type` field to `Enrollment`, add a `classId` field to `Enrollment`, and create the composite unique index `@@unique([childId, classId, type], name: "one_trial_per_class")`.
**File:** `packages/api/prisma/schema.prisma:146-167`

### [blocker] --- No age validation on enrollment
**What's broken:** `enrollments.service.ts:create()` checks for duplicate enrollment and seat availability, but performs ZERO age validation. FR-3 requires the child's age to be checked against the class's `ageMin..ageMax` range. The child's `birthDate` is available via Prisma but is never queried or compared.
**Why it's wrong:** A 3-year-old can be enrolled in a class designed for 16-18 year olds. This is a safety concern for a children's education platform.
**How to fix:** In `create()`, fetch the child's `birthDate`, fetch the class's `ageMin`/`ageMax` (via the section relation), calculate the child's age using `calculateAge()` from `@klassmarket/shared`, and throw `BadRequestException` if the age is outside the range.
**File:** `packages/api/src/modules/enrollments/enrollments.service.ts:17-47`

### [high] --- No parent ownership check on enrollment creation
**What's broken:** The `POST /enrollments` endpoint accepts `{ childId, sectionId }` from any authenticated user. There is no guard or service-level check that the authenticated user is the parent of the specified `childId`. Any logged-in user can enroll any child.
**Why it's wrong:** The spec (NFR "Security") states: "Only the authorized parent can enroll their own children." The Architecture doc specifies an `EnrollmentGuard` at `guards/enrollment.guard.ts` that should verify parent ownership. This guard does not exist.
**How to fix:** Create an `EnrollmentGuard` or add a check in `create()` that verifies `child.parentId === currentUser.id`. The controller currently doesn't even pass `userId` to the service for enrollment creation.
**File:** `packages/api/src/modules/enrollments/enrollments.controller.ts:21-26`

### [high] --- enrolledCount decrement on cancel has no lower-bound check
**What's broken:** `enrollments.service.ts:85-88` decrements `enrolledCount` unconditionally. If `cancel()` is called twice on the same enrollment (which is possible since there's no status check preventing re-cancellation of already-cancelled enrollments), `enrolledCount` goes negative.
**Why it's wrong:** Negative seat counts corrupt the availability display and could allow enrollments beyond the actual capacity.
**How to fix:** Add a status check: if `enrollment.status === 'CANCELLED'`, throw `BadRequestException('Already cancelled')`. Wrap in a transaction with `enrolledCount: { decrement: 1 }` and add a database constraint `CHECK (enrolled_count >= 0)`.
**File:** `packages/api/src/modules/enrollments/enrollments.service.ts:77-91`

### [high] --- No authorization check on findById and cancel
**What's broken:** `GET /enrollments/:id` and `PATCH /enrollments/:id/cancel` are accessible to any authenticated user. There is no check that the requesting user owns the enrollment (is the parent of the enrolled child). Any authenticated user can view or cancel any enrollment by guessing/iterating UUIDs.
**Why it's wrong:** This is a broken access control vulnerability (OWASP A01). Enrollment data includes child information, which is PII for minors.
**How to fix:** In `findById()` and `cancel()`, verify that the enrollment's child belongs to the requesting user (or the user is an admin). Pass the `userId` from the controller and compare against `enrollment.child.parentId`.
**File:** `packages/api/src/modules/enrollments/enrollments.controller.ts:42-49`

### [medium] --- No trial-specific endpoint or DTO
**What's broken:** The Architecture doc specifies `POST /trial`, `GET /trial-status`, and a `CreateTrialDto`. The implementation has only a generic `POST /enrollments` that creates all enrollments identically. There is no way to distinguish a trial booking from a paid enrollment in the API contract.
**Why it's wrong:** Frontend components (TrialBookingCard, SeatAvailability, AgeCheck) described in the architecture cannot function without trial-specific endpoints.
**How to fix:** Add `POST /enrollments/trial` with a `CreateTrialDto`, implement eligibility check endpoint `GET /enrollments/trial-status`, and differentiate trial creation logic.
**File:** `packages/api/src/modules/enrollments/enrollments.controller.ts`

### [medium] --- Missing frontend components
**What's broken:** The Architecture specifies `TrialBookingCard.tsx`, `SeatAvailability.tsx`, `AgeCheck.tsx`, and `MyEnrollmentsPage.tsx`. None of these components exist in the web package. The class detail page (`[id]/page.tsx`) has a generic "Записаться" button with no trial booking flow, no seat availability display, and no age check.
**Why it's wrong:** The user-facing trial booking UX is entirely absent.
**How to fix:** Implement the 4 frontend components per Architecture spec. Wire the booking card to the trial endpoint with child selection, seat display, and age validation.
**File:** `packages/web/src/app/(main)/classes/[id]/page.tsx:190`

### [medium] --- Cancel does not check enrollment type for re-enrollment blocking
**What's broken:** FR-5 states: "After cancellation, re-enrollment for the same class trial is impossible." The current cancel logic sets status to CANCELLED but the duplicate check in `create()` uses `findByChildAndSection` which matches on `childId + sectionId`. A cancelled enrollment still exists, so re-enrollment to the same section is blocked, but re-enrollment to a different section of the same class is allowed. With no `type` field, this cannot be properly enforced.
**Why it's wrong:** The business rule is only partially enforced by accident (same section blocked) but not by design (same class blocked).
**How to fix:** After adding the `type` and `classId` fields to Enrollment, the duplicate check should query for `childId + classId + type=TRIAL` regardless of status.
**File:** `packages/api/src/modules/enrollments/enrollments.service.ts:18-24`

### [medium] --- No email notification on trial booking
**What's broken:** The spec states that upon successful trial booking, the parent receives an email with details and an ICS calendar invitation. There is no notification/email service invocation anywhere in the enrollment flow.
**Why it's wrong:** Parents have no confirmation of their booking. The Architecture doc shows `NotificationsModule` as a dependency of `EnrollmentsModule`, but it is not imported.
**How to fix:** Integrate with a notification service (even if stubbed) that sends confirmation emails after successful enrollment creation. Emit events asynchronously outside the transaction as specified in the architecture.
**File:** `packages/api/src/modules/enrollments/enrollments.module.ts`

### [low] --- parseInt without upper bound on pagination
**What's broken:** `page` and `perPage` query params are parsed with `parseInt` but have no upper bound validation. A request with `perPage=999999` could cause a full table scan and OOM.
**Why it's wrong:** DoS vector through unbounded pagination.
**How to fix:** Add `Math.min(perPage, 100)` or validate with a Zod/class-validator pipe.
**File:** `packages/api/src/modules/enrollments/enrollments.controller.ts:33-34`

### [low] --- Enrollment duplicate check does not filter by active status
**What's broken:** `findByChildAndSection` finds any enrollment for the child+section pair, including CANCELLED or REFUNDED ones. If an enrollment was cancelled and we want to allow re-enrollment for paid sections (not trials), the current logic would block it.
**Why it's wrong:** Overly broad duplicate detection may block legitimate re-enrollments in non-trial scenarios.
**How to fix:** Filter by active statuses: `where: { childId, sectionId, status: { notIn: ['CANCELLED', 'REFUNDED'] } }` for paid enrollments, and filter by `classId + type=TRIAL` (any status) for trials.
**File:** `packages/api/src/modules/enrollments/enrollments.repository.ts:27-29`

## Security Checklist
- [x] JWT auth guard on all endpoints
- [ ] **FAIL:** No parent ownership verification (any user can enroll/view/cancel any child) --- OWASP A01
- [ ] **FAIL:** No SERIALIZABLE transaction --- data integrity at risk
- [ ] **FAIL:** No age boundary validation --- child safety concern
- [ ] **FAIL:** No rate limiting on enrollment creation
- [x] No SQL injection (uses Prisma parameterized queries)
- [x] UUID validation on path params

## Code Quality
| Criteria | Assessment |
|----------|------------|
| Correctness | FAILING --- 3 blockers indicate fundamental business rules are unimplemented |
| Architecture compliance | FAILING --- Implementation deviates from Architecture doc on 6+ points |
| Error handling | Partial --- uses NestJS exceptions but missing critical validation |
| Testability | Acceptable --- service/repo separation allows mocking |
| Test coverage | Unknown --- no test files found |
