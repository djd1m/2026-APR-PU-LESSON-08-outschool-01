# Review Report: teacher-profiles

**Reviewer:** brutal-honesty-review (Linus + Ramsay)
**Date:** 2026-05-21

## Summary
- Severity: 2 blocker, 2 high, 3 medium, 2 low
- Verdict: NEEDS FIX

## Findings

### [blocker] -- No teacher-specific endpoints exist

**What's broken:** There is no `/teachers` route, no teacher listing endpoint, no teacher public profile endpoint, no teacher search endpoint. The `UsersController` has generic CRUD but no teacher-specific functionality. There is no:
- `GET /teachers` (list with filters by subject/rating)
- `GET /teachers/:id` (public profile)
- `PUT /teachers/me` (update teacher profile -- bio, education, subjects)
- `POST /teachers/me/verify` (request verification)
- `PATCH /teachers/:id/verify` (admin approve/reject)

The spec describes two full features (public profiles + management) and the refinement doc has detailed edge cases for verification workflow. None of it is implemented.

**Why it's wrong:** Teacher profiles are a High-priority feature. Parents need to evaluate teachers before enrolling children. The `TeacherProfile` Prisma model exists with `bio`, `education`, `subjects`, `rating`, `reviewCount`, `verified` fields, but there is zero API surface to read or write these fields.

**How to fix:** Create a `TeachersModule` with:
1. `TeachersController` with public listing/detail and authenticated profile management.
2. `TeachersService` with business logic for verification workflow, rating aggregation.
3. Teacher-specific DTOs (UpdateProfileDto, RequestVerificationDto).
4. Admin endpoints for verify/reject with reason.

**File:** Feature missing. Expected at `packages/api/src/modules/teachers/`

---

### [blocker] -- No teacher profile UI pages exist

**What's broken:** There is no `/app/(main)/teachers/` directory. No teacher listing page, no teacher detail page, no teacher profile management page. The frontend has no way to browse teachers, view a teacher's profile, or for teachers to edit their own profiles.

**Why it's wrong:** The entire teacher discovery flow is missing. The spec describes rich teacher cards with avatars, ratings, subjects, and verification badges. The frontend `ClassCard` and class detail page reference teacher data, but there is no standalone teacher browsing experience.

**How to fix:** Create:
1. `/app/(main)/teachers/page.tsx` -- teacher listing with filters
2. `/app/(main)/teachers/[id]/page.tsx` -- public teacher profile
3. `/app/(main)/teach/profile/page.tsx` -- teacher self-service profile editor

**File:** Expected at `packages/web/src/app/(main)/teachers/`

---

### [high] -- GET /users/:id exposes full user data to any authenticated user

**What's broken:** `UsersController.findOne()` at `GET /users/:id` returns the full user record (including `teacherProfile` and `children` relations) to any authenticated user. There is no ownership check -- any logged-in user can view any other user's profile, including their children's data.

**Why it's wrong:** This is OWASP A01 (Broken Access Control). A parent's children data (names, birth dates) is PII protected under 152-FZ. Any authenticated user can enumerate user IDs and scrape child data. The refinement doc specifies: "Public data: only bio, qualification, subjects, rating, reviewCount (without email, userId)."

**How to fix:**
1. For teacher public profiles: create a dedicated `GET /teachers/:id` that returns only public fields.
2. For `GET /users/:id`: restrict to ADMIN only, or return different projections based on the requester's relationship to the target.
3. For `GET /users/me`: keep as-is (returns own data).

**File:** `packages/api/src/modules/users/users.controller.ts:42-44`, `packages/api/src/modules/users/users.repository.ts:10-13`

---

### [high] -- Teacher profile created at registration has no bio, subjects, or education

**What's broken:** When a teacher registers, `auth.service.ts:40-42` creates a `TeacherProfile` with only `{ userId: user.id }`. All other fields use Prisma defaults: `bio: ""`, `education: ""`, `subjects: []`, `rating: 0`, `verified: false`. There is no endpoint to update these fields.

**Why it's wrong:** Teachers cannot fill out their profiles after registration. The `PATCH /users/me` endpoint accepts `{ name, phone, avatarUrl }` but NOT `bio`, `education`, or `subjects` -- those live on `TeacherProfile`, not `User`. The profile is permanently empty.

**How to fix:**
1. Create `PUT /teachers/me` that updates `TeacherProfile` fields.
2. Or extend `PATCH /users/me` to accept teacher-specific fields when `user.role === TEACHER` and proxy to the profile model.

**File:** `packages/api/src/modules/auth/auth.service.ts:39-43`, `packages/api/src/modules/users/users.controller.ts:47-52`

---

### [medium] -- No verification workflow

**What's broken:** The spec describes a full verification lifecycle: teacher requests verification -> admin reviews -> approve/reject with reason -> teacher can resubmit. None of this exists. The `TeacherProfile.verified` boolean field exists but there are no endpoints to toggle it and no state machine.

**Why it's wrong:** Verification is a trust signal for parents. Without it, there is no way to distinguish vetted teachers from random registrations.

**How to fix:** Implement:
1. `POST /teachers/me/verify` -- teacher requests verification (check profile completeness).
2. `PATCH /admin/teachers/:id/verify` -- admin approve/reject.
3. Add `verificationStatus` enum (NONE, PENDING, VERIFIED, REJECTED) to replace the boolean `verified`.
4. Add `rejectionReason` field.
5. Notification on status change.

**File:** `packages/api/prisma/schema.prisma:83-99`

---

### [medium] -- No rating aggregation logic

**What's broken:** `TeacherProfile.rating` and `TeacherProfile.reviewCount` fields exist in the schema but are never updated. There is no trigger, cron, or service that aggregates reviews into teacher ratings.

**Why it's wrong:** The `Review` model is linked to `Enrollment`, not directly to `TeacherProfile`. Computing a teacher's rating requires joining through `Enrollment -> Section -> Class -> TeacherProfile`. Without aggregation, teacher ratings will always be 0.

**How to fix:** After each review is created, recalculate the teacher's average rating:
```sql
UPDATE teacher_profiles SET rating = (
  SELECT AVG(r.rating) FROM reviews r
  JOIN enrollments e ON r.enrollment_id = e.id
  JOIN sections s ON e.section_id = s.id
  JOIN classes c ON s.class_id = c.id
  WHERE c.teacher_id = teacher_profiles.id
), review_count = (SELECT COUNT(*) FROM ...)
WHERE id = <teacher_profile_id>;
```

**File:** Expected in `reviews.service.ts` or a dedicated `RatingService`

---

### [medium] -- PATCH /users/me accepts email but backend ignores it / allows email change without verification

**What's broken:** The `ProfilePage` (`profile/page.tsx:30-33`) sends `{ name, email }` to `PATCH /users/me`. The controller accepts `{ name, phone, avatarUrl }` -- email is not in the accepted body type. So email changes are silently dropped. BUT if the `update` method were to pass arbitrary fields to Prisma, email changes would go through without re-verification.

**Why it's wrong:** The UI shows an editable email field that gives the illusion of being updateable. Either: (a) email change should be supported with a verification flow, or (b) the email field should be read-only in the UI.

**How to fix:**
1. Make the email field read-only in `ProfilePage`.
2. If email changes are needed, implement a proper flow: send verification to new email, confirm, then update.

**File:** `packages/web/src/app/(main)/profile/page.tsx:30-33`, `packages/api/src/modules/users/users.controller.ts:47-52`

---

### [low] -- No avatar upload functionality

**What's broken:** The refinement doc describes detailed avatar upload requirements (max 5MB, jpg/png/webp only, magic bytes verification, S3 storage). The `User.avatarUrl` and `TeacherProfile` fields exist but there is no file upload endpoint, no S3 integration, no image validation.

**Why it's wrong:** Teachers cannot upload profile photos. The S3 config exists in `env.schema.ts` but is never used.

**How to fix:** Implement a `POST /upload/avatar` endpoint with:
1. Multer for file handling
2. Magic bytes verification
3. Size limit (5MB)
4. Format validation (jpg, png, webp)
5. S3 upload and URL storage

**File:** No upload endpoint exists

---

### [low] -- UsersRepository.findById includes children relation for all users

**What's broken:** `users.repository.ts:11-12` always `include: { teacherProfile: true, children: true }` regardless of user role. For teachers or admins, the `children` include is unnecessary. For parents, the `teacherProfile` include is unnecessary.

**Why it's wrong:** This is a minor performance issue (extra JOINs) and a data exposure issue (returning children data in all user queries, including when fetching teacher profiles via `GET /users/:id`).

**How to fix:** Use conditional includes based on role, or create separate repository methods for different use cases.

**File:** `packages/api/src/modules/users/users.repository.ts:10-13`

## Security Checklist
- [ ] Input validation on all endpoints -- NO teacher endpoints exist; existing `PATCH /users/me` body is unvalidated DTO
- [ ] Auth/RBAC enforced -- BROKEN: `GET /users/:id` exposes all user data to any authenticated user
- [x] No SQL injection vectors -- OK: Prisma ORM
- [ ] No XSS vectors -- NOT TESTED: bio/education fields would need sanitization
- [ ] Rate limiting -- MISSING
- [x] Secrets not hardcoded -- OK for this feature
- [ ] PII encrypted (152-FZ) -- CONCERN: children's birth dates and names exposed through `GET /users/:id`

## Code Quality
- Patterns: INCOMPLETE -- only generic user CRUD exists; teacher-specific domain is missing
- Error handling: BASIC -- NotFoundException for missing users, but no verification workflow error handling
- Type safety: WEAK -- `PATCH /users/me` body type is inline `{ name?, phone?, avatarUrl? }`, not a validated DTO
- Naming conventions: OK
