# TOOLKIT_HARVEST: КлассМаркет

**Project:** КлассМаркет (EdTech marketplace for live online children's classes)
**Date:** 2026-05-21
**Stack:** NestJS + Next.js (App Router) + PostgreSQL + Prisma + Redis + BullMQ + Elasticsearch + Jitsi Meet + MinIO + Docker
**Artifacts found:** 48

---

## Паттерны

- [x] #P1: NestJS Module Pattern (Controller → Service → Repository → DTO) — Complete layered architecture with strict separation: Controller handles HTTP/validation, Service owns business logic, Repository encapsulates Prisma queries, DTO defines input schemas. Each module is self-contained with its own `*.module.ts` wiring. | Source: `packages/api/src/modules/classes/` (exemplar: controller, service, repository, dto/) | Maturity: 🟢 Production

- [x] #P2: Payment Commission Split (Decimal math) — Platform takes a configurable commission rate from each payment. Calculates `commission = amount * RATE`, `teacherPayout = amount - commission` using `Prisma.Decimal` (never floats). Creates Payment record, calls external API, stores external ID for webhook reconciliation. | Source: `packages/api/src/modules/payments/payments.service.ts:51-54` | Maturity: 🟡 Beta (duplicate method definitions exist)

- [x] #P3: Webhook HMAC-SHA256 Verification — Verifies inbound webhooks using `crypto.createHmac('sha256', secret)` + `crypto.timingSafeEqual`. Skips verification in dev mode when secret is absent. Returns idempotent `{ received: true }` for already-processed events. | Source: `packages/api/src/modules/payments/payments.service.ts:327-345` | Maturity: 🟢 Production

- [x] #P4: Elasticsearch Circuit Breaker — Tracks consecutive failures (`esFailCount`). After `ES_MAX_FAILURES` (3), sets `esAvailable = false` and falls back to empty results. Resets after `ES_RESET_MS` (30s) via `setTimeout`. All ES operations wrapped in `withCircuitBreaker(fn, fallback)`. | Source: `packages/api/src/modules/search/search.service.ts:53-68` | Maturity: 🟢 Production

- [x] #P5: Two-Sided Marketplace Enrollment — Multi-step enrollment flow: verify child ownership → verify section exists → check seat availability → validate age range → check duplicate/trial limits → create enrollment → increment enrolled count. Supports both free trial (instant confirm) and paid (pending payment). | Source: `packages/api/src/modules/enrollments/enrollments.service.ts:22-95` | Maturity: 🟡 Beta

- [x] #P6: Jitsi JWT Generation (HMAC-SHA256) — Generates Jitsi-compatible JWT without external library. Manual `base64UrlEncode` for header + payload, HMAC-SHA256 signature. Payload includes `iss`, `sub`, `aud`, `room`, `exp`, `context.user` with moderator flag. | Source: `packages/api/src/modules/video/video.service.ts:27-105` | Maturity: 🟢 Production

- [x] #P7: BullMQ Delayed Job (auto-close rooms) — Schedules a delayed BullMQ job at `endTime + 10min` to auto-close video rooms. Uses `jobId` for idempotency, `removeOnComplete: true`, `removeOnFail: 5`. Worker calls internal API endpoint. | Source: `packages/api/src/modules/video/video.service.ts:142-156`, `packages/workers/src/processors/video-room-close.processor.ts` | Maturity: 🟡 Beta

- [x] #P8: BullMQ Worker Bootstrap with Graceful Shutdown — Centralized worker entrypoint: creates shared Redis connection, registers N workers with per-queue concurrency/limiter settings, handles SIGINT/SIGTERM for graceful close. | Source: `packages/workers/src/main.ts` | Maturity: 🟢 Production

- [x] #P9: RBAC Guard + Decorator Pattern — `@Roles(UserRole.ADMIN)` decorator sets metadata via `SetMetadata`. `RolesGuard` reads metadata via `Reflector`, compares against `request.user.role`. Permissive when no roles specified. | Source: `packages/api/src/common/guards/roles.guard.ts`, `packages/api/src/common/decorators/roles.decorator.ts` | Maturity: 🟢 Production

- [x] #P10: JWT Cookie-or-Header Extraction — Tries `req.cookies.accessToken` first, falls back to `Authorization: Bearer` header. Crashes on startup if `JWT_SECRET` is missing or < 32 chars (no fallback). | Source: `packages/api/src/modules/auth/strategies/jwt.strategy.ts:16-25` | Maturity: 🟢 Production

- [x] #P11: Content Moderation Lifecycle — Class goes through DRAFT → PENDING_REVIEW → PUBLISHED/DRAFT(rejected). Teacher submits for review, admin approves/rejects with reason. Published classes auto-index in Elasticsearch. Re-editing a published class resets to DRAFT. | Source: `packages/api/src/modules/classes/classes.service.ts:216-283` | Maturity: 🟡 Beta

- [x] #P12: Mock API Pattern (pure Node.js HTTP) — Zero-dependency mock API server using only `http` and `url` modules. In-memory stores for users, children, enrollments. Supports CRUD + auth + webhook simulation. Perfect for frontend development without backend. | Source: `/tmp/km-api.js` | Maturity: 🔴 Alpha

- [x] #P13: EnrollmentCard UX Pattern — Client component with child selector + section picker + trial/paid booking buttons. Shows contextual messages: "add child first" (amber), "select time" hints, "Войти в класс" after success. Progressive disclosure. | Source: `packages/web/src/app/(main)/classes/[id]/EnrollmentCard.tsx` | Maturity: 🔴 Alpha

- [x] #P14: Server Component + Client Island — Server component fetches data via localhost (internal), passes to client component for interactivity. Avoids CORS/external URL issues in SSR. Pattern: `fetch('http://localhost:PORT/api')` in server, `apiFetch` in client. | Source: `packages/web/src/app/(main)/classes/[id]/page.tsx` | Maturity: 🔴 Alpha

---

## Правила

- [x] #R1: /run bypasses /feature pipeline (LLM optimization bias) — `/run mvp` executed only Phase 3 (IMPLEMENT), skipping Phase 1 (PLAN), Phase 2 (VALIDATE), Phase 4 (REVIEW). LLM optimizes for speed in autonomous mode. Preventive: `/run` MUST invoke `/go` -> `/feature` via Skill tool, not raw Agent tools. | Source: `.claude/insights/index.md:52-69`

- [x] #R2: Phase 4 REVIEW repeatedly forgotten — brutal-honesty-review was skipped twice even after explicit reminders. LLM consistently "forgets" the review phase. Fix: auto-trigger Phase 4 after code commit; add `"review": "pending"/"done"` to feature-roadmap.json. | Source: `.claude/insights/index.md:32-49`

- [x] #R3: autopush.cjs must be LAST in Stop hooks — Claude Code executes Stop hooks sequentially. If autopush runs before autocommit-* hooks, those commits won't be included in the push. | Source: `.claude/insights/index.md:73-84`

- [x] #R4: Subagents cannot write to .claude/ directory — Write and Bash tools are blocked in subagent scope for `.claude/`. Create files in `.claude/` from the main conversation context; subagents can only generate content. | Source: `.claude/insights/index.md:87-99`

- [x] #R5: Decimal for ALL money operations — Never use `Number()` or `float` for prices, commissions, payouts. Use `Prisma.Decimal` or the `Decimal` library. Float precision loss causes real financial discrepancies. | Source: `.claude/insights/index.md:15`, `packages/api/src/modules/payments/payments.service.ts:51`

- [x] #R6: Never store external payment URLs — Payment gateway confirmation URLs expire. Always re-fetch from the payment gateway API when needed. Store only the external payment ID (`yookassaId`). | Source: `packages/api/src/modules/payments/payments.service.ts:62-77`

- [x] #R7: JWT secret must crash on startup if missing — No fallback, no empty string, no dev defaults for JWT secrets. `throw new Error('FATAL: JWT_SECRET must be set...')` in strategy constructor. | Source: `packages/api/src/modules/auth/strategies/jwt.strategy.ts:31-33`

- [x] #R8: Webhook handlers must be idempotent — Check terminal state (`COMPLETED`, `REFUNDED`) before processing. Return `{ received: true }` for duplicates to prevent gateway retries. | Source: `packages/api/src/modules/payments/payments.service.ts:170-173`

- [x] #R9: Mock API resets on restart — In-memory mock APIs lose state on process restart. Users must re-add data (children, enrollments). Pre-seed critical test data in mock startup. | Source: `/tmp/km-api.js`

- [x] #R10: NEXT_PUBLIC env vars need restart — Next.js inlines NEXT_PUBLIC_ vars at build/start time. Changing .env without restarting dev server has no effect on client code. | Source: debug session

- [x] #R11: useCallback + Date object = infinite loop — `useCallback` with `new Date()` in deps creates new object each render → callback recreates → useEffect refires → infinite loop. Fix: depend on `.getTime()` (stable number). | Source: `packages/web/src/app/(main)/teach/schedule/page.tsx`

- [x] #R12: Server components fetch via localhost, not external IP — Next.js server components run on the server. `fetch('http://external-ip:port')` may fail (firewall, DNS). Always use `http://localhost:PORT` for internal API calls in server components. | Source: debug session

- [x] #R13: Register must restrict role to PARENT|TEACHER — Never allow role: ADMIN in registration DTO. ADMIN accounts created manually or via seed. Privilege escalation vector if not restricted. | Source: `packages/api/src/modules/auth/dto/register.dto.ts`

---

## Шаблоны

- [x] #T1: NestJS Module Scaffold — 5-file module structure: `*.module.ts` (wiring), `*.controller.ts` (routes), `*.service.ts` (logic), `*.repository.ts` (data), `dto/*.dto.ts` (validation). Standardized imports, `@Module` decorator with `imports/controllers/providers/exports`. | Source: `packages/api/src/modules/classes/` (complete exemplar), `.claude/skills/coding-standards/SKILL.md`

- [x] #T2: Docker Compose Multi-Service (6 services) — Production-ready compose: `web` (Next.js), `api` (NestJS), `workers` (BullMQ), `postgres` (15-alpine), `redis` (7-alpine), `elasticsearch` (8.12), `minio`. All with healthchecks, named volumes, shared bridge network, env-var substitution for secrets. | Source: `docker-compose.yml`

- [x] #T3: Multi-Stage Dockerfile for NestJS Monorepo — 3-stage build: `deps` (npm ci), `build` (compile shared + api), `production` (minimal runtime with non-root user, healthcheck). Copies only `dist/` and `node_modules/` to final image. | Source: `Dockerfile`

- [x] #T4: Zod Environment Validation Schema — Typed env config with defaults, coercion (`z.coerce.number()`), min-length constraints for secrets (`z.string().min(32)`), optional fields for external services. `validateEnv()` crashes on startup with field-level errors. | Source: `packages/api/src/config/env.schema.ts`

- [x] #T5: BullMQ Queue Registry with Typed Job Data — Centralized `QUEUES` const object + typed interfaces per queue (`EmailJobData`, `PayoutJobData`, `VideoRoomCloseJobData`, etc.). Enforces contract between producers and consumers. | Source: `packages/workers/src/queues.ts`

- [x] #T6: Shared Package (types + constants + utils) — Monorepo `packages/shared/` exporting domain types, business constants, and utility functions. Single `index.ts` barrel file. Consumed by both API and Web packages. | Source: `packages/shared/src/index.ts`

- [x] #T7: Standardized API Response Envelope — `{ success: boolean, data: T, error?: { code, message }, meta?: { page, perPage, total, totalPages } }`. Enforced by `TransformInterceptor` (wraps success) and `HttpExceptionFilter` (wraps errors). | Source: `packages/api/src/common/interceptors/transform.interceptor.ts`, `packages/api/src/common/filters/http-exception.filter.ts`, `packages/shared/src/types/api.ts`

- [x] #T8: PrismaService Lifecycle Wrapper — Extends `PrismaClient`, implements `OnModuleInit` (connect) and `OnModuleDestroy` (disconnect). Injectable NestJS service. | Source: `packages/api/src/prisma/prisma.service.ts`

- [x] #T9: Feature SPARC docs template (7 files per feature) — 01_specification.md, 02_pseudocode.md, 03_architecture.md, 04_refinement.md, 05_completion.md, validation-report.md, review-report.md + README.md | Source: `docs/features/auth-registration/` | Maturity: 🟢 Production

---

## Сниппеты

- [x] #S1: sanitizeHtml — Strip HTML tags from user-generated content using regex. No dependency needed for text-only fields. Handles encoded entities (`&lt;`, `&gt;`, `&amp;`). | Source: `packages/api/src/common/utils/sanitize.ts:5-12`

- [x] #S2: formatPrice (kopecks to RUB) — Converts integer kopecks to formatted Russian currency string using `Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' })`. | Source: `packages/shared/src/utils/index.ts:6-13`

- [x] #S3: slugify with Cyrillic transliteration — Full Cyrillic-to-Latin mapping (33 chars), then sanitize to URL-safe slug. `"Математика для детей"` -> `"matematika-dlya-detey"`. | Source: `packages/shared/src/utils/index.ts:82-98`

- [x] #S4: ZodValidationPipe for NestJS — Generic pipe that accepts any `ZodSchema`, runs `safeParse`, throws `BadRequestException` with path-qualified error messages. Drop-in replacement for class-validator. | Source: `packages/api/src/common/pipes/zod-validation.pipe.ts`

- [x] #S5: @CurrentUser decorator — `createParamDecorator` that extracts `request.user` from Passport. Supports property access: `@CurrentUser('id')` returns just the ID. | Source: `packages/api/src/common/decorators/current-user.decorator.ts`

- [x] #S6: Elasticsearch query sanitizer — Escapes all ES special characters (`+`, `-`, `=`, `&`, `|`, `>`, `<`, `!`, `(`, `)`, `{`, `}`, `[`, `]`, `^`, `"`, `~`, `*`, `?`, `:`, `\\`, `/`) to prevent query injection. | Source: `packages/api/src/modules/search/search.service.ts:48-51`

- [x] #S7: base64UrlEncode — Buffer-based Base64URL encoding (replaces `+` with `-`, `/` with `_`, strips trailing `=`). Used for JWT construction without library dependency. | Source: `packages/api/src/modules/video/video.service.ts:27-33`

- [x] #S8: calculateAge — Age calculation from birth date with month/day boundary handling. Avoids the common off-by-one error with partial-year birthdays. | Source: `packages/shared/src/utils/index.ts:20-28`

---

## Хуки

- [x] #H1: session-insights.cjs (SessionStart) — Injects up to 3 most recent insights from `.claude/insights/index.md` into Claude's session context via stdout. Splits on `## ` headings, takes last 3. Silent on missing file. | Source: `.claude/hooks/session-insights.cjs`

- [x] #H2: autocommit-roadmap.cjs (Stop) — Auto-commits `.claude/feature-roadmap.json` if changed. Uses `execFileSync('git', [...])` (no shell). Stages only the target file, checks `git diff --cached --quiet`, commits with `--only`. | Source: `.claude/hooks/autocommit-roadmap.cjs`

- [x] #H3: autocommit-insights.cjs (Stop) — Auto-commits `.claude/insights/` directory if changed. Same pattern as #H2. Commit message: `docs(insights): auto-capture`. | Source: `.claude/hooks/autocommit-insights.cjs`

- [x] #H4: autopush.cjs (Stop, MUST BE LAST) — Auto-pushes current branch to origin after all autocommit hooks. Checks: has remotes, not detached HEAD, no uncommitted changes. Non-fatal on failure (e.g., no network). | Source: `.claude/hooks/autopush.cjs`

- [x] #H5: post-agent-insights.cjs (PostToolUse:Agent) — After each Agent tool call, checks if insights or roadmap changed, commits+pushes if so. Enables real-time persistence of knowledge captured by subagents. | Source: `.claude/hooks/post-agent-insights.cjs`

- [x] #H6: settings.json Hook Orchestration — Complete hook configuration: SessionStart (inject insights) -> PostToolUse:Agent (commit after agents) -> Stop (autocommit roadmap, insights, plans, then autopush). Ordering is critical (see #R3). | Source: `.claude/settings.json`

---

## Скиллы

- [x] #SK1: project-context — Domain knowledge skill template. Defines business terminology, user roles, business model flow, key metrics (GMV, ARPU, NPS). Reusable structure for any marketplace/SaaS project. Replace domain terms and metrics. | Source: `.claude/skills/project-context/`

- [x] #SK2: coding-standards — Tech-stack coding standards skill with NestJS module template, API response format, error handling patterns, Prisma conventions. Reusable for any NestJS project by swapping examples. | Source: `.claude/skills/coding-standards/`

---

## Команды

- [x] #C1: /feature (4-phase SPARC lifecycle) — Full feature lifecycle: PLAN (5 SPARC docs) -> VALIDATE (INVEST/SMART scoring) -> IMPLEMENT (parallel agents) -> REVIEW (brutal-honesty-review). Generates 7 docs per feature in `docs/features/<name>/`. Supports both fresh and existing projects. | Source: `.claude/commands/feature.md`

---

## Исключения (не извлекаем)

- Domain-specific business rules (commission 22%, age range 3-18, max class size 12, min withdrawal 1000 RUB)
- Project-specific API endpoints and route structure (`/api/v1/classes`, `/api/v1/enrollments`, etc.)
- YooKassa-specific integration code (API URL, request/response format, dev simulation)
- VK/Yandex OAuth provider-specific configuration
- KlassMarket-specific Prisma schema (User/Class/Section/Enrollment/Payment models)
- Russian-locale UI strings and error messages
- Project-specific Elasticsearch index mappings (classes index with Russian analyzer)
