# Review Report: auth-registration

**Reviewer:** brutal-honesty-review (Linus + Ramsay)
**Date:** 2026-05-21

## Summary
- Severity: 3 blocker, 4 high, 3 medium, 2 low
- Verdict: NEEDS FIX

## Findings

### [blocker] -- JWT secret has a hardcoded fallback default

**What's broken:** Both `jwt.strategy.ts:18` and `auth.module.ts:13` use `process.env.JWT_SECRET ?? 'change-me-in-production'` as the secret. If `JWT_SECRET` is unset, the application silently runs with a publicly known secret.

**Why it's wrong:** This is textbook A02 (Cryptographic Failures). Any attacker who reads your source code (or guesses the default) can forge valid JWTs for any user, including ADMIN. The `env.schema.ts` validates `JWT_SECRET: z.string().min(32)` but that validation is never called at application startup -- `validateEnv()` is defined but never invoked in `main.ts`. The fallback silently bypasses the safety net.

**How to fix:**
1. Remove the `?? 'change-me-in-production'` fallback from both files.
2. Call `validateEnv()` in `main.ts` before `NestFactory.create()` so the process exits if `JWT_SECRET` is missing.
3. Use `ConfigModule` to inject validated env into `JwtModule.registerAsync()`.

**File:** `packages/api/src/modules/auth/strategies/jwt.strategy.ts:18`, `packages/api/src/modules/auth/auth.module.ts:13`

---

### [blocker] -- Tokens stored in localStorage, not httpOnly cookies

**What's broken:** Both `login/page.tsx` and `register/page.tsx` store `accessToken` and `refreshToken` in `localStorage`. The spec (01_specification.md) explicitly requires: "httpOnly secure cookie with access-token".

**Why it's wrong:** Any XSS vulnerability anywhere on the site gives an attacker full access to both tokens. `localStorage` is readable by any JavaScript on the page. The 04_refinement.md explicitly lists "XSS-stealing token -> httpOnly + secure cookie" as the mitigation. The implementation does the exact opposite.

**How to fix:**
1. Set tokens as `httpOnly`, `secure`, `SameSite=Strict` cookies from the backend `auth.controller.ts`.
2. Remove all `localStorage.setItem/getItem` token logic from the frontend.
3. Let the browser automatically send cookies with credentials -- the CORS config already has `credentials: true`.

**File:** `packages/web/src/app/(auth)/login/page.tsx:35-36`, `packages/web/src/app/(auth)/register/page.tsx:38-39`, `packages/web/src/lib/auth.ts`

---

### [blocker] -- Refresh token sent via Authorization header, not validated as a token

**What's broken:** The `/auth/refresh` endpoint (`auth.controller.ts:24-28`) uses `JwtAuthGuard` and extracts `userId` from the JWT payload. The client sends the refresh token as a JSON body (`api.ts:39`), but the server never reads the body -- it reads the `Authorization: Bearer` header, which contains the (expired) access token or the refresh token depending on client logic.

**Why it's wrong:** The refresh flow is architecturally broken:
- The client tries to POST `{ refreshToken }` in the body, but the server ignores the body entirely.
- The server uses `JwtAuthGuard` which reads `Authorization: Bearer`, meaning the refresh only works if the access token is still valid (defeating the purpose).
- There is no refresh token rotation (spec requires one-time use refresh tokens).
- There is no refresh token storage/revocation in the database (spec requires hashed tokens in DB).

**How to fix:**
1. Create a dedicated refresh endpoint that reads the refresh token from the request body (or a separate httpOnly cookie).
2. Store hashed refresh tokens in the database with a family ID for rotation detection.
3. Implement token rotation: invalidate old refresh token, issue new pair.
4. Detect reuse of revoked tokens and invalidate the entire family.

**File:** `packages/api/src/modules/auth/auth.controller.ts:24-28`, `packages/api/src/modules/auth/auth.service.ts:75-82`

---

### [high] -- No rate limiting on auth endpoints

**What's broken:** The spec requires "5 attempts per minute per IP on /auth/login" and the refinement doc specifies brute force protection with account lockout after 5 failed attempts in 15 minutes. Neither is implemented.

**Why it's wrong:** Without rate limiting, an attacker can brute-force passwords at thousands of attempts per second. Without failed attempt tracking, there is no account lockout. This is OWASP A07 (Authentication Failures).

**How to fix:**
1. Install and configure `@nestjs/throttler` with `ThrottlerGuard` on auth endpoints.
2. Implement a failed login counter per email (Redis or DB) that triggers temporary lockout.
3. Return 429 Too Many Requests when limits are hit.

**File:** `packages/api/src/modules/auth/auth.controller.ts`

---

### [high] -- User can self-assign ADMIN role during registration

**What's broken:** `RegisterDto` accepts an optional `role` field with `@IsEnum(UserRole)`. The `UserRole` enum includes `ADMIN` and `CHILD`. The `auth.service.ts:35` casts it directly: `(dto.role as UserRole) ?? UserRole.PARENT`.

**Why it's wrong:** Any anonymous user can POST `{ "email": "...", "password": "...", "name": "...", "role": "ADMIN" }` to `/auth/register` and get a full administrator account. This is a privilege escalation vulnerability -- OWASP A01 (Broken Access Control).

**How to fix:**
1. Create a separate enum or validation that restricts registration to `PARENT` and `TEACHER` only.
2. In the DTO: `@IsEnum(['PARENT', 'TEACHER'])` or a custom validator.
3. ADMIN accounts should only be created through a seed script or by existing admins.

**File:** `packages/api/src/modules/auth/dto/register.dto.ts:17-18`, `packages/api/src/modules/auth/auth.service.ts:35`

---

### [high] -- No password complexity validation beyond minimum length

**What's broken:** The spec requires "min 8 chars, 1 uppercase, 1 digit, 1 special character". The DTO only enforces `@MinLength(8)`. No regex, no complexity check.

**Why it's wrong:** Users can register with "aaaaaaaa" as a password, which is trivially crackable. The spec is explicit about complexity requirements.

**How to fix:** Add `@Matches(/^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/, { message: 'Password must contain uppercase, digit, and special char' })` to the `password` field in `register.dto.ts`.

**File:** `packages/api/src/modules/auth/dto/register.dto.ts:9`

---

### [high] -- OAuth login buttons are non-functional stubs

**What's broken:** The VK ID and Yandex ID buttons in `login/page.tsx:103-117` are `type="button"` with no `onClick` handler. They render but do nothing. The spec lists OAuth as a Critical priority user story.

**Why it's wrong:** This is a spec-critical feature that ships as dead UI. Users see login options that don't work, which erodes trust. There is no OAuth strategy, no callback route, no provider config anywhere in the codebase.

**How to fix:** Either implement VK/Yandex OAuth flows (passport-vkontakte, passport-yandex) or remove the buttons to avoid misleading users.

**File:** `packages/web/src/app/(auth)/login/page.tsx:103-117`

---

### [medium] -- No CSRF protection

**What's broken:** The refinement doc requires "SameSite=Strict cookie + CSRF token for mutations". The app has no CSRF middleware, and cookies are not used for auth (they use localStorage Bearer tokens).

**Why it's wrong:** If/when tokens are moved to cookies (as they should be), CSRF protection becomes essential. Even now, the pattern of reading tokens from localStorage and sending them as headers provides some CSRF protection, but the absence of any CSRF infrastructure is a gap.

**How to fix:** When migrating to httpOnly cookies, add `csurf` middleware or implement double-submit cookie pattern.

**File:** `packages/api/src/main.ts`

---

### [medium] -- No logging of auth events

**What's broken:** The refinement doc requires logging of successful logins (INFO), failed attempts (WARN), and OAuth errors (ERROR). There is zero logging in `auth.service.ts` or `auth.controller.ts`.

**Why it's wrong:** Without auth event logging, you cannot detect brute force attempts, investigate compromised accounts, or meet audit requirements. This is OWASP A09 (Security Logging Failures).

**How to fix:** Add a logger to `AuthService` and log at appropriate levels for each auth event.

**File:** `packages/api/src/modules/auth/auth.service.ts`

---

### [medium] -- API URL path mismatch between frontend and backend

**What's broken:** Frontend calls `/auth/login` and `/auth/register` directly, but `main.ts:10` sets `app.setGlobalPrefix('api/v1')`, making the actual endpoints `/api/v1/auth/login`. The `api.ts` client also calls paths like `/classes`, `/users/me` without the prefix.

**Why it's wrong:** Every single API call from the frontend will 404 in production unless the proxy or frontend URL includes `/api/v1`. This is either a pervasive bug or relies on undocumented reverse proxy configuration. The login/register pages bypass `apiFetch` and call `fetch` directly, making the inconsistency worse.

**How to fix:**
1. Update `api.ts` to include `/api/v1` in the base URL.
2. Update direct `fetch` calls in login/register pages to use `apiFetch`.
3. Or document the required reverse proxy config.

**File:** `packages/api/src/main.ts:10`, `packages/web/src/app/(auth)/login/page.tsx:21`, `packages/web/src/lib/api.ts:1`

---

### [low] -- access and refresh tokens use the same signing key and same structure

**What's broken:** Both access and refresh tokens are signed with the same `JWT_SECRET` and differ only in `expiresIn`. A refresh token is a valid JWT that could be used as an access token if the `exp` hasn't passed.

**Why it's wrong:** Best practice is to differentiate token types (e.g., different signing keys, a `type` claim, or asymmetric vs symmetric). Without differentiation, a leaked refresh token (7d TTL) functions as a long-lived access token.

**How to fix:** Add a `type: 'access' | 'refresh'` claim to the payload. Validate the claim in `JwtStrategy` (reject refresh tokens used as access tokens).

**File:** `packages/api/src/modules/auth/auth.service.ts:84-95`

---

### [low] -- Email enumeration via registration endpoint

**What's broken:** `POST /auth/register` returns 409 "Email already registered" for existing emails, confirming email existence.

**Why it's wrong:** Attackers can enumerate valid emails. Industry standard is to return the same response regardless of whether the email exists (with verification email sent to the address).

**How to fix:** Return a generic success message and send a verification email. If email exists, send a "someone tried to register with your email" notification instead.

**File:** `packages/api/src/modules/auth/auth.service.ts:24-26`

## Security Checklist
- [ ] Input validation on all endpoints -- partial: MinLength only, no password complexity
- [ ] Auth/RBAC enforced -- BROKEN: ADMIN role self-assignable at registration
- [ ] No SQL injection vectors -- OK: Prisma ORM with parameterized queries
- [ ] No XSS vectors -- RISK: tokens in localStorage accessible to XSS
- [ ] Rate limiting -- MISSING entirely
- [ ] Secrets not hardcoded -- BROKEN: JWT secret has hardcoded fallback
- [ ] PII encrypted (152-FZ) -- NOT VERIFIED: no encryption-at-rest for PII

## Code Quality
- Patterns: PARTIAL -- clean separation (controller/service/repository) but missing critical security layers
- Error handling: PARTIAL -- basic NestJS exceptions but no logging, no circuit breaker
- Type safety: OK -- TypeScript throughout, Prisma types
- Naming conventions: OK -- consistent NestJS conventions
