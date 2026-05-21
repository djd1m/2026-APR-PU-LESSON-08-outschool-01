# Review Report: admin-panel
**Reviewer:** brutal-honesty-review (Linus + Ramsay)
**Date:** 2026-05-21

## Summary
- Severity: 3 blocker, 3 high, 3 medium, 2 low
- Verdict: NEEDS FIX

## Findings

### [blocker] — CRITICAL: Anyone can register as ADMIN via the registration endpoint
**What's broken:** The `RegisterDto` accepts an optional `role` field with `@IsEnum(UserRole)` validation. The `AuthService.register()` method directly uses `dto.role` to set the user's role: `role: (dto.role as UserRole) ?? UserRole.PARENT`. An attacker can send `POST /auth/register` with `{ "role": "ADMIN", "email": "...", "password": "...", "name": "..." }` and get a fully privileged admin account.
**Why it's wrong:** This is a CRITICAL privilege escalation vulnerability. There is absolutely no restriction on which roles can be self-assigned during registration. ADMIN role should NEVER be self-assignable. This single vulnerability compromises the ENTIRE admin panel security — all ADMIN-only endpoints are now accessible to any attacker.
**How to fix:** Remove `role` from `RegisterDto` entirely, or whitelist only `PARENT` and `TEACHER` roles. ADMIN accounts should only be created via database seeding, CLI tools, or a super-admin endpoint with additional verification.
**File:** `packages/api/src/modules/auth/dto/register.dto.ts:16-18` and `packages/api/src/modules/auth/auth.service.ts:35`

### [blocker] — No admin API module exists; `/admin/stats` endpoint is a ghost
**What's broken:** The admin frontend page calls `apiFetch<AdminStats>('/admin/stats')` but there is no `AdminController`, no `AdminModule`, no `/admin/*` route in the entire API codebase. The stats endpoint does not exist. The admin dashboard will always show "Не удалось загрузить статистику".
**Why it's wrong:** The admin panel is visually rendered but functionally dead. The spec defines 3 major features (teacher moderation, review moderation, analytics) with 9 Gherkin scenarios. Zero backend implementation exists.
**How to fix:** Create `packages/api/src/modules/admin/` with `AdminController`, `AdminService`, `AdminModule`. Implement at minimum:
  - `GET /admin/stats` — aggregate platform metrics
  - `GET /admin/teachers/pending` — verification queue
  - `PATCH /admin/teachers/:id/verify` — approve/reject
  - `GET /admin/reviews/pending` — moderation queue
  - `PATCH /admin/reviews/:id/moderate` — approve/reject
**File:** No admin module exists — needs full creation.

### [blocker] — Admin panel frontend has client-side-only role check, no server-side guard
**What's broken:** The admin page checks `if (!user || user.role !== 'admin')` in the React component after the page has already loaded. This is a client-side role check that depends on the user object from the auth hook. There is no Next.js middleware, no server-side redirect, and no layout-level protection for the `/(admin)` route group.
**Why it's wrong:** (1) The page HTML/JS bundle is served to all users regardless of role — any user can inspect the admin page source. (2) The role check uses lowercase `'admin'` while the enum value is `'ADMIN'` — this may fail depending on how the auth hook normalizes the role. (3) Client-side guards are bypassable; security must be enforced server-side.
**How to fix:** Add Next.js middleware for the `/(admin)` route group that verifies the JWT and role server-side. Return 403/redirect before serving any admin page content.
**File:** `packages/web/src/app/(admin)/admin/page.tsx:38`

### [high] — No audit logging anywhere in the system
**What's broken:** The spec explicitly requires: "Все действия логируются в аудит-лог (adminId, action, target, timestamp, IP)". There is no audit log table in the Prisma schema, no logging middleware, no audit trail for any admin action (user deletion, review deletion, etc.).
**Why it's wrong:** Without audit logging, there is no accountability for admin actions. If an admin deletes users or manipulates data, there is no record. This is a compliance requirement in many jurisdictions.
**How to fix:** Create an `AuditLog` model in Prisma. Create an `AuditService` that logs all admin actions. Add middleware or interceptor that captures admin actions automatically.
**File:** `packages/api/prisma/schema.prisma` (no AuditLog model)

### [high] — No 2FA for admin accounts (spec requirement)
**What's broken:** The spec states: "Двухфакторная аутентификация обязательна для всех администраторов". There is no 2FA implementation in the auth module. Admin accounts use the same single-factor JWT auth as regular users.
**Why it's wrong:** Combined with the self-registration-as-ADMIN vulnerability, the lack of 2FA means there is literally zero additional security for the most privileged accounts on the platform.
**How to fix:** Implement TOTP-based 2FA (Google Authenticator compatible). Require 2FA setup on first admin login. Reject admin API calls without valid 2FA token.
**File:** `packages/api/src/modules/auth/auth.service.ts`

### [high] — GMV calculation: no endpoint, no implementation, revenue displayed as raw number
**What's broken:** The admin frontend displays `stats.revenue` but the `/admin/stats` endpoint doesn't exist. Even conceptually, there is no revenue aggregation query anywhere. The spec requires GMV, DAU/MAU, conversion rates, average check, top-10 classes/teachers. None of these analytics exist.
**Why it's wrong:** The revenue figure, if it were implemented, would need to use `Decimal` aggregation over the `Payment` table with proper status filtering (only `COMPLETED` payments). Using `Number` type for `revenue` in the `AdminStats` interface risks floating-point display errors on large sums.
**How to fix:** Create `AdminService.getStats()` that uses Prisma aggregate queries with proper Decimal handling. Filter by `status: 'COMPLETED'` for revenue. Implement period-based filtering as spec requires.
**File:** `packages/web/src/app/(admin)/admin/page.tsx:8-14`

### [medium] — `DELETE /users/:id` has no soft-delete, no confirmation, no cascading safety
**What's broken:** The `UsersController.remove()` endpoint calls `prisma.user.delete()` which is a hard delete. The Prisma schema has `onDelete: Cascade` on Child, TeacherProfile, and transitively on Enrollments, Payments, Reviews. Deleting a user cascades and destroys all associated financial records.
**Why it's wrong:** (1) The spec requires "no mass operations without confirmation" but even single delete has no confirmation mechanism. (2) Hard-deleting payment records may violate financial record-keeping regulations. (3) There is no safeguard against an admin accidentally (or maliciously) deleting a high-value user.
**How to fix:** Implement soft-delete (add `deletedAt` field). Never hard-delete users with financial history. Add a confirmation token mechanism for destructive operations.
**File:** `packages/api/src/modules/users/users.service.ts:39-42`

### [medium] — Teacher verification/moderation endpoints completely missing
**What's broken:** The spec's primary admin feature (US-A01, Critical priority) is teacher verification: approve/reject teacher applications. The `TeacherProfile` model has a `verified` boolean field, but there are no endpoints to change it. No verification queue, no approve/reject flow.
**Why it's wrong:** This is the highest-priority admin feature (Critical) and it's entirely unimplemented.
**How to fix:** Create admin endpoints for listing pending teachers and updating verification status.
**File:** `packages/api/prisma/schema.prisma:91` (field exists, no endpoint uses it)

### [medium] — Batch operations not implemented (spec requires atomic batch approve)
**What's broken:** The spec defines a scenario: "Администратор выделил 3 заявки чекбоксами → Одобрить выбранные → все 3 обновляются атомарно в одной транзакции." No batch operations exist in any controller.
**Why it's wrong:** Missing feature, but also a data integrity concern — batch operations must be transactional. When implemented, ensure `prisma.$transaction()` is used.
**How to fix:** Add batch endpoints with transaction wrapping and max-50-item limit per spec.
**File:** N/A — not implemented

### [low] — Admin page stat cards use `number` type for revenue (potential display issue)
**What's broken:** The `AdminStats` interface defines `revenue: number`. When displayed: `stats.revenue.toLocaleString('ru-RU')`. For very large numbers (e.g., 10,000,000+), JavaScript `number` loses precision beyond 2^53. More practically, revenue should be in kopecks (integer) or use a string/Decimal to avoid floating-point display.
**Why it's wrong:** `999999.99` might display as `999999.99` or `1000000` depending on intermediate calculations.
**How to fix:** Use `string` type for monetary values in API responses and format on display, or transmit as integer kopecks.
**File:** `packages/web/src/app/(admin)/admin/page.tsx:14`

### [low] — No pagination or filtering on admin dashboard
**What's broken:** The admin page shows 5 stat cards and nothing else. No user list, no class list, no pagination, no search, no filters. The spec requires comprehensive data tables with pagination.
**Why it's wrong:** An admin panel without data management capabilities is a dashboard without a steering wheel.
**How to fix:** Implement data tables for users, classes, payments, reviews with server-side pagination and filtering.
**File:** `packages/web/src/app/(admin)/admin/page.tsx`

## Security Checklist
- [ ] **A01 Broken Access Control:** CRITICAL FAIL — self-registration as ADMIN, client-side-only role checks
- [x] **A03 Injection:** PASS — Prisma parameterized queries
- [ ] **A04 Insecure Design:** FAIL — no 2FA, no audit logging, hard delete cascades financial data
- [ ] **A05 Security Misconfiguration:** FAIL — admin routes accessible without server-side guard
- [ ] **A07 Auth Failures:** FAIL — no 2FA for admin, no account lockout
- [ ] **A08 Data Integrity:** FAIL — no batch transaction safety, no confirmation for destructive ops
- [ ] **A09 Logging:** FAIL — zero audit logging

## Code Quality
| Criteria | Rating | Notes |
|----------|--------|-------|
| Correctness | Failing | Frontend calls nonexistent endpoint; always shows error state |
| Feature Completeness | Failing | ~5% of spec implemented (only the stat card UI shell) |
| Security | Failing | CRITICAL privilege escalation via self-registration as ADMIN |
| Architecture | Failing | No admin module, no service layer, no data access layer |
| Financial Integrity | Failing | No GMV calculation, hard-delete destroys payment records |
| Compliance | Failing | No audit logging, no 2FA, no record retention |
