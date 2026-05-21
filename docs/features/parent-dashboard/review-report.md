# Review Report: parent-dashboard
**Reviewer:** brutal-honesty-review (Linus + Ramsay)
**Date:** 2026-05-21

## Summary
- Severity: 1 blocker, 3 high, 2 medium, 2 low
- Verdict: NEEDS FIX

## Findings

### [blocker] — No dedicated parent dashboard API endpoint; frontend calls undefined `/bookings/my`
**What's broken:** The frontend `DashboardPage` calls `apiFetch<{ data: Booking[] }>('/bookings/my')` but there is NO `/bookings/my` endpoint in ANY controller in the API. The `EnrollmentsController` has `GET /enrollments` (filtered by parent), but there is no `BookingsController` and no `/bookings` route at all. The dashboard will ALWAYS fail with a 404 and show an empty state.
**Why it's wrong:** The entire parent dashboard is non-functional. It renders the empty state ("У вас пока нет записей") for every user because the API call always fails (caught by `.catch(() => setBookings([]))`). The error is silently swallowed.
**How to fix:** Either (a) create a `/bookings/my` endpoint that returns transformed enrollment data matching the `Booking` interface, or (b) change the frontend to call `GET /enrollments` and map the response to the `Booking` shape.
**File:** `packages/web/src/app/(main)/dashboard/page.tsx:27`

### [high] — Data isolation not enforced: `GET /enrollments/:id` exposes any enrollment
**What's broken:** The `EnrollmentsController.findOne()` endpoint at `GET /enrollments/:id` returns any enrollment by ID without checking ownership. Any authenticated user can view any other user's enrollment details (child name, section, payment status).
**Why it's wrong:** OWASP A01 — Broken Access Control. The spec requires "parent sees only own children." The `findByParent` method correctly scopes by parent's children, but the `findOne` method does not.
**How to fix:** In `EnrollmentsService.findById()`, add a `parentId` parameter and verify that `enrollment.child.parentId === parentId`.
**File:** `packages/api/src/modules/enrollments/enrollments.controller.ts:42-44`

### [high] — Enrollment cancellation has no ownership check
**What's broken:** `PATCH /enrollments/:id/cancel` cancels any enrollment by ID. There is no verification that the authenticated user is the parent who owns this enrollment. Any authenticated user can cancel anyone's enrollment.
**Why it's wrong:** This is destructive — cancellation decrements `enrolledCount` and could be used maliciously to kick other students out of sections.
**How to fix:** Extract `@CurrentUser('id')` in the controller and pass to `cancel()`. Verify ownership before cancelling.
**File:** `packages/api/src/modules/enrollments/enrollments.controller.ts:47-49`

### [high] — Spec requires 4 tabs (Schedule, Progress, Payments, Children); implementation has 0 tabs
**What's broken:** The specification defines 4 distinct tabs: "Расписание" (calendar view), "Прогресс" (per-child progress with XP/badges), "Платежи" (payment history with PDF receipts), and "Дети" (child profile management). The implementation is a single flat list of bookings with no tabs, no calendar, no progress tracking, no payment history, and no child management.
**Why it's wrong:** The implementation delivers approximately 10% of the specified functionality. The spec describes 13 Gherkin scenarios; the implementation covers at most 1 (listing upcoming bookings, partially).
**How to fix:** This requires a substantial rewrite. Implement tab navigation, build each tab's data-fetching and UI, create the corresponding API endpoints for schedule (calendar format), progress (with achievements), payment history, and child CRUD.
**File:** `packages/web/src/app/(main)/dashboard/page.tsx:70-130`

### [medium] — Timezone handling is absent
**What's broken:** The spec explicitly requires timezone-aware display: "время занятий отображается в его локальном часовом поясе" with auto-detection via `Intl.DateTimeFormat`. The implementation uses `new Date(booking.nextSession).toLocaleDateString('ru-RU', ...)` which uses the browser's timezone implicitly, but there is no explicit timezone handling, no timezone storage in user profile, and no server-side timezone-aware queries.
**Why it's wrong:** For a platform serving users across Russian timezones (UTC+2 to UTC+12), relying on implicit browser timezone is fragile. Server-rendered pages (Next.js SSR) will use the server's timezone, not the user's.
**How to fix:** Store user timezone preference in the User model. Pass timezone to date formatting. For SSR pages, pass timezone via cookie or header.
**File:** `packages/web/src/app/(main)/dashboard/page.tsx:117-120`

### [medium] — Error handling silently swallows API failures
**What's broken:** The `useEffect` catch block does `.catch(() => setBookings([]))` — any API error (500, network failure, auth failure) is silently swallowed and the user sees "У вас пока нет записей" with no error indication.
**Why it's wrong:** The user cannot distinguish between "no bookings" and "API is down." This makes debugging production issues nearly impossible.
**How to fix:** Add an error state. Display an error message when the fetch fails. At minimum log the error.
**File:** `packages/web/src/app/(main)/dashboard/page.tsx:29`

### [low] — Client-side auth check instead of middleware/layout guard
**What's broken:** The dashboard checks `if (!user)` in the component body and renders a "login" prompt. There is no route-level middleware or Next.js layout guard protecting `/dashboard`.
**Why it's wrong:** The page component loads, renders, runs the auth hook, then conditionally shows content. This causes a flash of loading state and unnecessary component mounting. In Next.js App Router, this should be handled by a layout or middleware redirect.
**How to fix:** Add a Next.js middleware that redirects unauthenticated users to `/login` for all `/(main)/dashboard` routes.
**File:** `packages/web/src/app/(main)/dashboard/page.tsx:41-56`

### [low] — Booking interface doesn't match any API response shape
**What's broken:** The `Booking` interface defines `classTitle`, `classId`, `teacherName`, `nextSession`, `status` — but the `Enrollment` model and its includes return `childId`, `sectionId`, `section.class.title`, etc. Even if the API endpoint existed, the response shapes don't align.
**Why it's wrong:** This indicates the frontend was designed against a hypothetical API that was never built.
**How to fix:** Align the Booking interface with the actual enrollment response shape, or create a dedicated DTO on the API side.
**File:** `packages/web/src/app/(main)/dashboard/page.tsx:10-17`

## Security Checklist
- [ ] **A01 Broken Access Control:** FAIL — `GET /enrollments/:id` and `PATCH /enrollments/:id/cancel` have no ownership checks
- [x] **A03 Injection:** PASS — Prisma handles parameterization
- [ ] **A04 Insecure Design:** FAIL — no data isolation by design; any auth'd user can access any enrollment
- [x] **A07 Auth:** PASS — JWT guard on all enrollment endpoints
- [ ] **A09 Logging:** FAIL — no audit trail for enrollment cancellation

## Code Quality
| Criteria | Rating | Notes |
|----------|--------|-------|
| Correctness | Failing | Dashboard calls nonexistent endpoint; always shows empty |
| Feature Completeness | Failing | ~10% of spec implemented |
| Error Handling | Failing | Silent error swallowing |
| Security | Failing | Missing ownership checks on 2 critical endpoints |
| UX | Failing | No tabs, no calendar, no progress, no payment history |
