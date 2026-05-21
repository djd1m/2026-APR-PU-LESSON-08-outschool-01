# Review Report: scheduling
**Reviewer:** brutal-honesty-review (Linus + Ramsay)
**Date:** 2026-05-21

## Summary
- Severity: 2 blocker, 3 high, 3 medium, 2 low
- Verdict: NEEDS FIX

## Findings

### [blocker] --- SectionsModule does not exist --- feature is NOT implemented
**What's broken:** The Architecture specifies 5 backend components: `SectionsController`, `SectionsService`, `SectionsConflict`, `CreateSectionDto`, `UpdateSectionDto` --- all under `src/modules/sections/`. This directory does not exist. There is no `SectionsModule` in the codebase. `app.module.ts` does not import any sections module. The `Section` model exists in the Prisma schema but there is zero application code to manage it.
**Why it's wrong:** The entire scheduling feature is a specification without implementation. Teachers cannot create, update, cancel, or view sections. The enrollment system references sections (you can enroll in a section), but there is no way to create sections through the API.
**How to fix:** Implement the full `SectionsModule` per Architecture: controller with CRUD endpoints, service with business logic, conflict detection algorithm, DTOs with validation. Register in `AppModule`.
**File:** `packages/api/src/modules/sections/` (directory does not exist)

### [blocker] --- No overlap/conflict detection anywhere in the codebase
**What's broken:** FR-4 requires the system to detect time conflicts when creating or updating sections. The Architecture specifies a dedicated `SectionsConflict` component at `sections.conflict.ts` with an O(log N) algorithm using the `@@index([classId, startTime])` index. No conflict detection logic exists anywhere.
**Why it's wrong:** Without conflict detection, a teacher can schedule overlapping sections --- e.g., two classes at the same time. This is the core differentiating logic of a scheduling system. The spec explicitly mandates it in acceptance criteria.
**How to fix:** Implement the conflict detection: given a teacher's `profileId`, a `startTime`, and a `duration`, query `SELECT * FROM sections s JOIN classes c ON s.class_id = c.id WHERE c.teacher_id = ? AND s.status = 'SCHEDULED' AND s.start_time < ? AND s.end_time > ?` (where the second `?` is `newEndTime` and third `?` is `newStartTime`). Return conflicts if any rows match.
**File:** N/A --- component does not exist

### [high] --- Prisma schema stores endTime but Architecture says compute it
**What's broken:** The Prisma `Section` model has both `startTime` and `endTime` as stored fields. The Architecture explicitly says: "Computed endTime --- not stored in DB, calculated as startTime + duration." The Architecture model stores `duration Int` (minutes 15-180) but no `endTime`. The Prisma schema stores `endTime` but has no `duration` field.
**Why it's wrong:** This is a design divergence. Storing `endTime` without `duration` means: (1) there is no validation that duration is within 15-180 minutes, (2) updating `startTime` requires also updating `endTime` (two-field update instead of one), (3) data can become inconsistent if only one is updated. Conversely, storing `endTime` does simplify overlap queries.
**How to fix:** Choose one approach and be consistent. If keeping `endTime` in DB (pragmatic for queries), also add a `duration` field and enforce the invariant `endTime = startTime + duration` in a pre-save hook or service layer. Add `@db.SmallInt` for duration with CHECK constraint 15-180.
**File:** `packages/api/prisma/schema.prisma:127-144`

### [high] --- No UTC/timezone handling in the codebase
**What's broken:** The spec (NFR) requires "Storage in UTC, display in Europe/Moscow." The Architecture details a timezone conversion flow: `Frontend (Europe/Moscow) -> Backend toUTC() -> PostgreSQL (UTC)`. There is no timezone conversion utility anywhere in the shared package, API, or web app. PostgreSQL `DateTime` in Prisma uses `timestamp(3)` which stores without timezone info --- the burden is on the application layer.
**Why it's wrong:** If the frontend sends `"2026-05-21T10:00:00"` without explicit timezone and the server is in UTC, the time will be stored as-is. If the server is in Moscow time, it will be stored as Moscow time. There is no contract for what timezone the client should send. DST edge cases (Russia abolished DST in 2014, but this must still be documented/enforced) are completely unhandled.
**How to fix:** 1) Define the API contract: all times must be ISO 8601 with explicit timezone (`2026-05-21T10:00:00+03:00` or `2026-05-21T07:00:00Z`). 2) In DTOs, validate the format. 3) In the service layer, normalize to UTC before storage. 4) On response, return UTC and let the frontend convert. 5) Add `date-fns-tz` or `luxon` for timezone handling.
**File:** N/A --- no timezone handling exists

### [high] --- Missing frontend scheduling components
**What's broken:** The Architecture specifies 5 frontend components: `TeacherSchedulePage`, `WeeklyGrid`, `SectionForm`, `TimeSlot`, `ConflictWarning`. None exist. There is no route for `/teach/schedule/` in the web app. Teachers have no UI to manage their schedule.
**Why it's wrong:** The scheduling feature has no user-facing implementation. This is a core teacher workflow.
**How to fix:** Implement the teacher schedule page with weekly grid view, section creation form with date/time picker, and conflict warning display.
**File:** `packages/web/src/app/(main)/teach/schedule/` (directory does not exist)

### [medium] --- Section model lacks teacher-scoped index for conflict queries
**What's broken:** The Prisma schema has `@@index([classId])` and `@@index([startTime])` as separate indexes. The Architecture specifies `@@index([classId, startTime])` as a composite index for efficient conflict detection and schedule retrieval. Without this composite index, conflict queries must do a full scan of one index and then filter.
**Why it's wrong:** Performance degrades as section count grows. The spec requires O(log N) conflict detection.
**How to fix:** Replace the two separate indexes with the composite `@@index([classId, startTime])` per Architecture. For teacher-scoped queries, consider also adding a join index or denormalizing `teacherId` onto Section.
**File:** `packages/api/prisma/schema.prisma:141-143`

### [medium] --- enrolledCount on Section is manually managed, not a computed field
**What's broken:** `Section.enrolledCount` is a denormalized counter that is incremented/decremented in `EnrollmentsService`. This creates a consistency risk: if any code path creates or cancels enrollments without updating the counter (direct DB access, migrations, manual fixes), the count drifts from reality.
**Why it's wrong:** Counter drift means the "section full" check becomes unreliable. The Architecture does not specify an `enrolledCount` field --- it implies counting active enrollments dynamically.
**How to fix:** Either: (1) use a database trigger to maintain the counter, (2) use a computed field/view `SELECT COUNT(*) FROM enrollments WHERE section_id = ? AND status IN ('CONFIRMED', 'ACTIVE')`, or (3) keep the counter but wrap all enrollment mutations in a transaction that atomically updates it (currently not done).
**File:** `packages/api/prisma/schema.prisma:134`

### [medium] --- No cancellation logic with enrolled student handling
**What's broken:** FR-3 specifies that when a teacher cancels a section: trial enrollments are auto-cancelled, paid enrollments enter the refund process, and all students are notified. There is no section cancellation logic anywhere (since SectionsModule doesn't exist), and the EnrollmentsService has no method for bulk cancellation triggered by section cancellation.
**Why it's wrong:** Teachers can't cancel sections, and even if they could, the cascade effects (notification, refund triggering) are unimplemented.
**How to fix:** In the future SectionsService.cancel(): 1) Set section status to CANCELLED. 2) Find all active enrollments. 3) For TRIAL enrollments: set status CANCELLED. 4) For PAID enrollments: initiate refund via PaymentsService. 5) Send notifications to all affected parents.
**File:** N/A --- logic does not exist

### [low] --- No validation constraints on Section fields
**What's broken:** The Prisma Section model has `maxStudents Int @default(12)` but no CHECK constraint for the 1-30 range specified in the spec. Similarly, duration (if added) needs a 15-180 constraint. Since there's no DTO or service, there's no application-level validation either.
**Why it's wrong:** Direct DB access or future API endpoints could create sections with 0 or 9999 max students.
**How to fix:** Add application-level validation in `CreateSectionDto` (when implemented) and consider PostgreSQL CHECK constraints for defense in depth.
**File:** `packages/api/prisma/schema.prisma:133`

### [low] --- class detail page shows schedule data but Section has no schedule-friendly query
**What's broken:** `packages/web/src/app/(main)/classes/[id]/page.tsx:28-31` expects `schedule: Array<{ dayOfWeek: string; time: string }>` from the API. The classes controller and repository include `sections` in the response, but sections have `startTime` and `endTime` --- there is no transformation to `dayOfWeek`/`time` format and no recurring schedule concept.
**Why it's wrong:** The frontend expects a recurring schedule format, but the data model represents individual section instances. These are fundamentally different concepts that haven't been reconciled.
**How to fix:** Either: (1) add a `ClassScheduleTemplate` model for recurring patterns, or (2) transform section instances into a schedule display format in the API response, or (3) update the frontend to display individual section instances instead of a weekly pattern.
**File:** `packages/web/src/app/(main)/classes/[id]/page.tsx:28-31`

## Security Checklist
- [ ] **FAIL:** No SectionsModule = no authorization checks for section CRUD
- [ ] **FAIL:** No teacher ownership verification (Architecture specifies ClassesModule ownership check)
- [ ] **FAIL:** No rate limiting on section creation
- [x] Prisma schema properly indexed (partially --- see composite index finding)
- [x] No sensitive data in Section model

## Code Quality
| Criteria | Assessment |
|----------|------------|
| Correctness | NOT APPLICABLE --- feature is unimplemented |
| Architecture compliance | FAILING --- 0 of 10 Architecture-specified components exist |
| Schema design | Partial --- Section model exists but diverges from Architecture on duration/endTime |
| Frontend | FAILING --- 0 of 5 components exist |
| Test coverage | N/A --- nothing to test |
