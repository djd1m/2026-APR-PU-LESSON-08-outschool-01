# Review Report: reviews-ratings
**Reviewer:** brutal-honesty-review (Linus + Ramsay)
**Date:** 2026-05-21

## Summary
- Severity: 2 blocker, 3 high, 3 medium, 2 low
- Verdict: NEEDS FIX

## Findings

### [blocker] — Review author identity not verified against authenticated user
**What's broken:** The `POST /reviews` endpoint accepts an `enrollmentId` in the request body but never checks that the authenticated user is the parent who owns that enrollment. Any authenticated user can leave a review on any enrollment.
**Why it's wrong:** This is a classic Broken Access Control (OWASP A01). User A can leave a review on User B's enrollment. An attacker could flood any class with fake reviews by enumerating enrollment UUIDs.
**How to fix:** After fetching the enrollment, verify `enrollment.child.parentId === currentUser.id`. Inject `@CurrentUser('id')` into the controller and pass it to the service.
**File:** `packages/api/src/modules/reviews/reviews.service.ts:17-37`

### [blocker] — No XSS sanitization on review comments
**What's broken:** The `comment` field is stored raw and returned raw via the API. The frontend renders `review.text` directly in JSX (`{review.text}`). While React escapes JSX by default, the spec mentions `whitespace-pre-line` rendering and the comment is persisted unsanitized in the database. If any other consumer (email notifications, admin panel, RSS, server-side rendering with `dangerouslySetInnerHTML`) reads this data, stored XSS is guaranteed.
**Why it's wrong:** Defense-in-depth requires sanitization at the storage layer, not relying on every single consumer to escape correctly. The spec requires moderation for content quality anyway, but there is zero content filtering.
**How to fix:** Strip HTML tags and dangerous characters on input in the service layer. Use a library like `sanitize-html` or at minimum `validator.escape()`. Add a `@MaxLength()` constraint as well.
**File:** `packages/api/src/modules/reviews/reviews.service.ts:17`

### [high] — Rating manipulation: no integer validation
**What's broken:** The rating is checked for range `1-5` but not validated as an integer. A client can submit `rating: 4.99999` or `rating: 1.0001`. The database column is `SmallInt` so Prisma will truncate/round, but the Bayesian average calculation uses the raw aggregate which will produce inconsistent results between what was validated and what was stored.
**Why it's wrong:** The service validates `< 1 || > 5` but accepts `1.5`, `2.7`, etc. The Prisma schema uses `@db.SmallInt` which truncates decimals silently, so `4.9` becomes `4`. This means the rating the user submitted is not the rating that gets stored.
**How to fix:** Add `if (!Number.isInteger(rating))` check in the service, or use class-validator `@IsInt()` in a proper DTO.
**File:** `packages/api/src/modules/reviews/reviews.service.ts:18-19`

### [high] — Missing moderation workflow (spec vs implementation gap)
**What's broken:** The spec requires a `pending_moderation` status, `flagged` status, admin approve/reject workflow, and auto-moderation for suspicious content. The implementation has NONE of this. Reviews are published immediately upon creation. The Review model in Prisma has no `status` field at all.
**Why it's wrong:** The entire moderation feature specified in `01_specification.md` (3 full Gherkin scenarios) is unimplemented. This is not a minor gap — it's a missing feature that was specified as High priority (US-A02).
**How to fix:** Add a `status` enum (`PENDING`, `PUBLISHED`, `FLAGGED`, `REJECTED`) to the Review model. Implement moderation endpoints. Filter `findByClass` to only return `PUBLISHED` reviews.
**File:** `packages/api/prisma/schema.prisma:189-201`

### [high] — Minimum comment length not enforced (spec requires >= 50 chars)
**What's broken:** The spec explicitly states "текст >= 50 символов" and a Gherkin scenario for "Отзыв с текстом менее 50 символов". The implementation has `comment?: string` — it's optional with no length validation at all. An empty string or single character passes.
**Why it's wrong:** Direct violation of acceptance criteria.
**How to fix:** If comment is provided, validate `comment.length >= 50`. Consider making comment required per spec.
**File:** `packages/api/src/modules/reviews/reviews.service.ts:17`

### [medium] — No DTO/validation pipe on review creation body
**What's broken:** The controller uses an inline `@Body() body: { enrollmentId: string; rating: number; comment?: string }` type annotation. This is a TypeScript type — it provides zero runtime validation. There is no class-validator DTO and no `ZodValidationPipe` applied.
**Why it's wrong:** Any JSON body will be accepted. `rating: "not-a-number"`, `enrollmentId: 42` (not UUID) — all pass through to the service. The `ParseUUIDPipe` is used on path params elsewhere but not on body fields.
**How to fix:** Create a `CreateReviewDto` with `@IsUUID()`, `@IsInt()`, `@Min(1)`, `@Max(5)`, `@IsString()`, `@MinLength(50)` decorators. Apply `ValidationPipe` globally or per-handler.
**File:** `packages/api/src/modules/reviews/reviews.controller.ts:24-26`

### [medium] — Teacher rating update is not atomic with review creation
**What's broken:** The review creation and teacher rating recalculation happen in separate queries with no transaction. If the rating update fails (e.g., teacher profile not found), the review is created but the teacher's average is stale. If two reviews are created concurrently, the aggregate may miss one.
**Why it's wrong:** Race condition + inconsistent state. The spec requires accurate rating recalculation (Bayesian average with C=10, m=3.5). The current implementation uses simple `_avg` — no Bayesian weighting at all.
**How to fix:** Wrap in `prisma.$transaction()`. Implement Bayesian average: `(C * m + sum) / (C + n)` instead of raw average.
**File:** `packages/api/src/modules/reviews/reviews.service.ts:38-57`

### [medium] — Review deletion doesn't recalculate teacher rating
**What's broken:** When an admin deletes a review, the teacher's `rating` and `reviewCount` fields are not recalculated. The aggregate becomes permanently stale.
**Why it's wrong:** Deleting a 1-star review should raise the teacher's average. It doesn't.
**How to fix:** After deletion, recalculate and update the teacher profile, same as in `create()`.
**File:** `packages/api/src/modules/reviews/reviews.service.ts:84-87`

### [low] — Pagination defaults mismatch: API returns 20, spec says 10
**What's broken:** The spec states "список отзывов с пагинацией по 10 элементов". The controller defaults to `perPage = 20`.
**Why it's wrong:** Minor spec violation. Users get more data per page than designed.
**How to fix:** Change default to 10 in `findByClass`.
**File:** `packages/api/src/modules/reviews/reviews.service.ts:70`

### [low] — No rate limiting on review creation
**What's broken:** An authenticated user could spam the review endpoint. While the duplicate check prevents multiple reviews per enrollment, there's no throttle on the POST endpoint itself.
**Why it's wrong:** An attacker with many enrollments (or by manipulating enrollment IDs before the ownership check is added) could create reviews at machine speed.
**How to fix:** Add `@Throttle()` decorator from `@nestjs/throttler`.
**File:** `packages/api/src/modules/reviews/reviews.controller.ts:22`

## Security Checklist
- [ ] **A01 Broken Access Control:** FAIL — no ownership verification on review creation
- [ ] **A03 Injection:** PARTIAL — Prisma parameterizes queries, but comment text is unsanitized
- [ ] **A04 Insecure Design:** FAIL — moderation workflow entirely missing
- [x] **A07 Auth Failures:** PASS — JWT guard present on create, admin guard on delete
- [ ] **A09 Logging:** FAIL — no audit trail for review creation or deletion

## Code Quality
| Criteria | Rating | Notes |
|----------|--------|-------|
| Correctness | Failing | Missing ownership check, missing moderation, wrong average formula |
| Input Validation | Failing | No DTO, no sanitization, no length checks |
| Error Handling | Passing | Proper HTTP exceptions used |
| Testability | Passing | Clean service/repository separation |
| Spec Compliance | Failing | ~40% of specified scenarios are unimplemented |
