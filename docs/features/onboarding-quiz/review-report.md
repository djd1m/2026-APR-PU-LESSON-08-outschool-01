# Review Report: onboarding-quiz

**Reviewer:** brutal-honesty-review (Linus + Ramsay)
**Date:** 2026-05-21

## Summary
- Severity: 1 blocker, 2 high, 3 medium, 2 low
- Verdict: NEEDS FIX

## Findings

### [blocker] -- Onboarding quiz does not exist in the codebase

**What's broken:** There is no onboarding quiz implementation anywhere in the project. No `/app/(main)/onboarding/` directory exists. No children-related endpoints exist in `users.controller.ts`. No `POST /users/children` endpoint. No quiz UI components. The feature is specified in full SPARC documentation but has zero implementation.

**Why it's wrong:** The spec (01_specification.md) marks this as High priority. The SPARC docs describe a 4-step wizard (name -> age -> interests -> confirmation), children model endpoints, and sessionStorage persistence. The Prisma schema includes a `Child` model and a `children` relation on `User`, but no API code exposes child CRUD operations.

**How to fix:** Implement the entire feature:
1. Backend: Add children endpoints to `UsersController` -- `POST /users/children`, `GET /users/children`, `DELETE /users/children/:id`.
2. Backend: Validate child data (name min 2 chars, max 100, birthDate produces age 3-18, interests array max 10 from predefined catalog).
3. Frontend: Create `/app/(main)/onboarding/` with multi-step wizard component.
4. Frontend: Persist intermediate state in `sessionStorage` as specified in refinement doc.
5. Frontend: Add skip functionality, back button, progress bar.
6. Wire the post-registration redirect to `/onboarding` when `children.length === 0`.

**File:** Feature entirely missing. Expected at `packages/api/src/modules/users/` (children endpoints) and `packages/web/src/app/(main)/onboarding/`

---

### [high] -- Child model exists in schema but interests field is missing

**What's broken:** The `Child` Prisma model (schema.prisma:66-81) has `name`, `birthDate`, `avatarUrl`, `parentId` but no `interests` field. The spec requires storing 1-10 interests per child from a predefined catalog.

**Why it's wrong:** The entire recommendation engine depends on child interests. Without this field, the quiz's step 3 (select interests) has nowhere to persist data. The catalog filtering by interests cannot work.

**How to fix:** Add `interests String[] @default([])` to the `Child` model, or create a separate `ChildInterest` junction table if interests come from a predefined `Interest` table.

**File:** `packages/api/prisma/schema.prisma:66-81`

---

### [high] -- No redirect to onboarding after registration

**What's broken:** After successful registration, `register/page.tsx:41` redirects to `/dashboard`. The spec says: "After registration, parent is redirected to onboarding quiz if they have no children profiles."

**Why it's wrong:** The onboarding flow is the primary mechanism for personalizing the platform experience. Sending parents directly to an empty dashboard defeats the purpose of the quiz.

**How to fix:** After registration with role=PARENT, redirect to `/onboarding` instead of `/dashboard`. The dashboard can then check for children and show a banner if onboarding was skipped.

**File:** `packages/web/src/app/(auth)/register/page.tsx:41`

---

### [medium] -- No predefined interests catalog

**What's broken:** The spec says interests come from a "predefined catalog" (step 3). There is no interests table, no API endpoint to fetch available interests, and no seed data for interests.

**Why it's wrong:** Without a server-managed catalog, the frontend would need to hardcode interest options, making them impossible to update without redeployment. The refinement doc specifies backend validation of interest IDs.

**How to fix:** Create an `Interest` model or a constants file with predefined interests. Add `GET /interests` endpoint. Validate submitted interest IDs against the catalog.

**File:** No file exists

---

### [medium] -- No child count limit enforcement

**What's broken:** The refinement doc specifies "Max 5 children per parent". No backend validation enforces this limit since no children endpoints exist.

**Why it's wrong:** Without the limit, a single parent account could create unbounded child profiles, potentially used for abuse.

**How to fix:** When implementing `POST /users/children`, check `count(children where parentId = userId) < 5` before creating.

**File:** Expected in future `users.controller.ts` or `children.service.ts`

---

### [medium] -- No XSS sanitization for child names

**What's broken:** The refinement doc specifies: "Child name: sanitize XSS (strip HTML tags), max 100 chars". No sanitization exists because no child creation exists.

**Why it's wrong:** When implemented, child names could contain `<script>` tags that render in the UI.

**How to fix:** When implementing, use a sanitization library (e.g., `sanitize-html`) on the name field before storing.

**File:** Expected in future children creation endpoint

---

### [low] -- Dashboard page fetches bookings but never checks for onboarding state

**What's broken:** `dashboard/page.tsx` shows bookings but has no logic to detect "parent with no children" and suggest onboarding.

**Why it's wrong:** The spec says "if children=0, quiz is offered again (banner on catalog)". The dashboard is a natural place for this nudge.

**How to fix:** Add a check: if `user.role === 'parent'` and user has no children, show a CTA banner linking to `/onboarding`.

**File:** `packages/web/src/app/(main)/dashboard/page.tsx`

---

### [low] -- No sessionStorage persistence for quiz state

**What's broken:** The refinement doc says: "Save intermediate state in sessionStorage. On page refresh, restore from sessionStorage." Since the quiz doesn't exist, this is obviously missing, but it's worth noting as a requirement for when it's built.

**Why it's wrong:** Without sessionStorage, accidental page refreshes during the quiz lose all entered data, creating a frustrating UX.

**How to fix:** When implementing the quiz, persist step state in sessionStorage after each step transition.

**File:** Expected in future onboarding components

## Security Checklist
- [ ] Input validation on all endpoints -- N/A: endpoints don't exist
- [ ] Auth/RBAC enforced -- N/A: no children endpoints to protect
- [ ] No SQL injection vectors -- N/A
- [ ] No XSS vectors -- N/A (no child name rendering)
- [ ] Rate limiting -- N/A
- [ ] Secrets not hardcoded -- N/A
- [ ] PII encrypted (152-FZ) -- CONCERN: child birthdates are PII (minors' data requires extra protection under 152-FZ)

## Code Quality
- Patterns: N/A -- feature not implemented
- Error handling: N/A
- Type safety: PARTIAL -- Prisma schema has Child model but missing interests
- Naming conventions: N/A
