# Review Report: class-creation

**Reviewer:** brutal-honesty-review (Linus + Ramsay)
**Date:** 2026-05-21

## Summary
- Severity: 2 blocker, 3 high, 4 medium, 2 low
- Verdict: NEEDS FIX

## Findings

### [blocker] -- No moderation workflow exists

**What's broken:** The spec's second feature ("Moderation by admin") is entirely unimplemented. There are no endpoints for:
- `POST /classes/:id/submit` (teacher submits for review)
- `POST /classes/:id/approve` (admin approves)
- `POST /classes/:id/reject` (admin rejects with reason)
- `POST /classes/:id/unpublish` (teacher unpublishes)
- `GET /admin/classes?status=PENDING_REVIEW` (admin moderation queue)

The `ClassStatus` enum in Prisma includes `DRAFT`, `PENDING_REVIEW`, `PUBLISHED`, `ARCHIVED`, but the code never transitions between these states. Classes are created with default status `DRAFT` and stay there forever. There is no way to publish a class.

**Why it's wrong:** This is the Critical-priority admin feature. Without moderation, no class can ever reach `PUBLISHED` status. The `ClassesService.findAll()` filters by `status: 'PUBLISHED'`, meaning the public catalog will always be empty. Teachers create classes that nobody can ever see.

**How to fix:** Implement the full state machine:
1. `POST /classes/:id/submit` -- DRAFT -> PENDING_REVIEW (teacher only, validate required fields).
2. `POST /classes/:id/approve` -- PENDING_REVIEW -> PUBLISHED (admin only, trigger ES indexing).
3. `POST /classes/:id/reject` -- PENDING_REVIEW -> REJECTED (admin only, require reason >= 10 chars).
4. `POST /classes/:id/resubmit` -- REJECTED -> PENDING_REVIEW (teacher only).
5. `POST /classes/:id/unpublish` -- PUBLISHED -> DRAFT (teacher only, remove from ES).
6. Add status transition validation (no invalid jumps).

**File:** `packages/api/src/modules/classes/classes.controller.ts`, `packages/api/src/modules/classes/classes.service.ts`

---

### [blocker] -- No class creation UI exists

**What's broken:** There is no `/app/(main)/teach/` directory, no class creation form, no teacher dashboard for managing classes. The spec describes a full form with: title, description, subject, age range, price, format, schedule. None of this exists in the frontend.

**Why it's wrong:** Teachers have no way to create classes through the UI. The API endpoint `POST /classes` exists and is functional, but without a UI it's useless to non-technical users.

**How to fix:** Create:
1. `/app/(main)/teach/page.tsx` -- teacher dashboard listing their classes by status
2. `/app/(main)/teach/create/page.tsx` -- class creation form
3. `/app/(main)/teach/[id]/edit/page.tsx` -- class edit form
4. Status indicators and action buttons (submit, resubmit, unpublish)

**File:** Expected at `packages/web/src/app/(main)/teach/`

---

### [high] -- Admin delete bypass: ADMIN can delete any class without ownership check

**What's broken:** `ClassesController.remove()` has `@Roles(UserRole.TEACHER, UserRole.ADMIN)`. For admin users, the `ClassesService.delete()` method checks if `profile.id === cls.teacherId`, but admins don't have a `TeacherProfile`. When `profile` is null, the condition `!profile || cls.teacherId !== profile.id` evaluates to `true`, throwing `ForbiddenException`. So admins actually CANNOT delete classes despite having the role permission.

**Why it's wrong:** The RBAC is incoherent. The decorator says admins CAN delete, but the service logic blocks them. This is confusing and wrong in both directions: either admins should be able to delete (skip ownership check for admins), or the decorator should not list ADMIN.

**How to fix:** In `ClassesService.delete()` and `update()`, check if the requesting user is an admin and skip ownership verification:
```typescript
const user = await this.prisma.user.findUnique({ where: { id: teacherUserId } });
if (user.role !== 'ADMIN') {
  const profile = await this.prisma.teacherProfile.findUnique({ where: { userId: teacherUserId } });
  if (!profile || cls.teacherId !== profile.id) throw new ForbiddenException(...);
}
```

**File:** `packages/api/src/modules/classes/classes.service.ts:104-114`

---

### [high] -- No optimistic locking (version field missing)

**What's broken:** The refinement doc requires optimistic locking via a `version` field on `Class` for concurrent edits and status transitions. The Prisma schema has no `version` field. Neither `update()` nor any future status transition checks a version.

**Why it's wrong:** Without optimistic locking: two admins can simultaneously approve and reject the same class (race condition), a teacher can edit a class while an admin is approving it, and last-write-wins silently loses data.

**How to fix:**
1. Add `version Int @default(0)` to the `Class` model.
2. In every update/transition, include `WHERE id = :id AND version = :expected` and increment version.
3. If the update affects 0 rows, throw 409 Conflict.

**File:** `packages/api/prisma/schema.prisma:101-125`

---

### [high] -- Class creation does not index to Elasticsearch

**What's broken:** When a class is created (or theoretically published), `ClassesService.create()` writes to PostgreSQL but never calls `SearchService.indexClass()`. The `SearchService` exists with an `indexClass()` method, but it's never invoked anywhere. The `SearchModule` and `ClassesModule` are separate with no cross-dependency.

**Why it's wrong:** Even if a class somehow reaches `PUBLISHED` status, it will never appear in search results. The ES index will be permanently empty (unless manually indexed). The spec says: "class is indexed in Elasticsearch upon approval."

**How to fix:**
1. Inject `SearchService` into `ClassesService` (or use events).
2. Call `indexClass()` when a class transitions to PUBLISHED.
3. Call `removeClass()` when a class is unpublished or deleted.
4. Better: use an event-driven approach (NestJS EventEmitter) so the indexing concern is decoupled.

**File:** `packages/api/src/modules/classes/classes.service.ts`, `packages/api/src/modules/search/search.service.ts:46-62`

---

### [medium] -- Slug generation uses Date.now() which is not collision-safe

**What's broken:** `classes.service.ts:27` generates slugs as `slugify(dto.title) + '-' + Date.now().toString(36)`. The spec says duplicate slugs should get `-2`, `-3` suffixes. Instead, the code appends a timestamp in base36.

**Why it's wrong:** Two classes created in the same millisecond with the same title will have identical slugs, causing a unique constraint violation. The timestamp approach also produces ugly URLs like `matematika-dlya-doshkolnikov-lz5k8g1` instead of clean slugs. The spec explicitly describes a human-readable slug pattern.

**How to fix:**
1. First try the clean slug. If it exists, append `-2`, `-3`, etc.
2. Query: `SELECT slug FROM classes WHERE slug LIKE 'base-slug%' ORDER BY slug DESC LIMIT 1`.
3. Parse the highest suffix and increment.

**File:** `packages/api/src/modules/classes/classes.service.ts:27`

---

### [medium] -- No format field (online/offline) in class model or DTO

**What's broken:** The spec says: "teacher fills form: title, description, subject, age (6-10), price (800), format (online)". The `CreateClassDto` and `Class` model have no `format` field. The spec scenario "combined filter: search 'english' + age 7-10 + format 'online'" cannot work.

**Why it's wrong:** The format (online vs offline vs hybrid) is a key filtering criterion. Without it, parents cannot filter by delivery method, and teachers cannot specify how the class is delivered.

**How to fix:** Add `format` enum (`ONLINE`, `OFFLINE`, `HYBRID`) to the `Class` model and `CreateClassDto`.

**File:** `packages/api/prisma/schema.prisma:101-125`, `packages/api/src/modules/classes/dto/create-class.dto.ts`

---

### [medium] -- No active class limit per teacher (50 max)

**What's broken:** The refinement doc specifies: "Max 50 active classes per teacher. Exceeding returns 400." `ClassesService.create()` does not check how many active classes the teacher already has.

**Why it's wrong:** A single teacher could create thousands of classes, polluting the catalog and consuming resources.

**How to fix:** Before creating, count: `SELECT COUNT(*) FROM classes WHERE teacher_id = :id AND status != 'ARCHIVED'`. If >= 50, throw BadRequestException.

**File:** `packages/api/src/modules/classes/classes.service.ts:18-41`

---

### [medium] -- No ageMin < ageMax cross-field validation

**What's broken:** `CreateClassDto` validates `ageMin` and `ageMax` individually (both Min(3), Max(18)) but does not validate that `ageMin <= ageMax`. A teacher can create a class with ageMin=15, ageMax=5.

**Why it's wrong:** This produces nonsensical data. The refinement doc specifies: "ageMin > ageMax -> 400."

**How to fix:** Add a custom class-validator decorator or use `@ValidateIf` to ensure `ageMin <= ageMax`. Or validate in the service layer.

**File:** `packages/api/src/modules/classes/dto/create-class.dto.ts`

---

### [medium] -- Soft delete not implemented

**What's broken:** `ClassesRepository.delete()` calls `this.prisma.class.delete()` which is a hard DELETE. The refinement doc specifies: "Deletion: soft delete (not physical), for audit capability."

**Why it's wrong:** Hard deletes lose data permanently. If a class has enrollments, reviews, or payment records, cascading delete destroys financial audit trail.

**How to fix:** Add `deletedAt DateTime?` to the `Class` model. Change `delete()` to set `deletedAt = now()`. Add `where: { deletedAt: null }` to all queries.

**File:** `packages/api/src/modules/classes/classes.repository.ts:52-54`, `packages/api/prisma/schema.prisma:101-125`

---

### [low] -- Title and description max length not validated

**What's broken:** The refinement doc specifies: "title max 200 chars, description max 5000 chars." The DTO only has `@MinLength(5)` for title and `@MinLength(20)` for description, with no `@MaxLength`.

**Why it's wrong:** A teacher could submit a megabyte-long title or description, wasting storage and breaking UI layouts.

**How to fix:** Add `@MaxLength(200)` to `title` and `@MaxLength(5000)` to `description`.

**File:** `packages/api/src/modules/classes/dto/create-class.dto.ts:12-13,17`

---

### [low] -- No HTML sanitization on title/description

**What's broken:** The refinement doc specifies: "Title and description: HTML sanitization, XSS protection." The DTO accepts raw strings with no sanitization.

**Why it's wrong:** A teacher could inject `<script>alert('xss')</script>` in the class description. If rendered with `dangerouslySetInnerHTML` or even in a `<p>` tag in certain contexts, this executes.

**How to fix:** Add a sanitization step (e.g., `sanitize-html` or `DOMPurify` on server) in the service layer before persisting. The frontend uses `whitespace-pre-line` rendering which is somewhat safe, but defense-in-depth requires server-side sanitization.

**File:** `packages/api/src/modules/classes/classes.service.ts:18-41`

## Security Checklist
- [x] Input validation on all endpoints -- PARTIAL: basic DTO validation exists, but missing cross-field and max-length
- [x] Auth/RBAC enforced -- PARTIAL: teacher role required for creation, but admin delete is broken
- [x] No SQL injection vectors -- OK: Prisma ORM
- [ ] No XSS vectors -- MISSING: no HTML sanitization on title/description
- [ ] Rate limiting -- MISSING
- [x] Secrets not hardcoded -- OK
- [ ] PII encrypted (152-FZ) -- N/A for class data

## Code Quality
- Patterns: PARTIAL -- clean layering but missing state machine, event system, and cross-module integration
- Error handling: BASIC -- ForbiddenException for ownership, NotFoundException for missing, but no concurrency handling
- Type safety: OK -- DTOs with class-validator, Prisma types
- Naming conventions: OK
