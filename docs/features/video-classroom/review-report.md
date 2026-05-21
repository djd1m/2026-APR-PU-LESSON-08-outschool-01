# Review Report: video-classroom
**Reviewer:** brutal-honesty-review (Linus + Ramsay)
**Date:** 2026-05-21

## Summary
- Severity: 3 blocker, 3 high, 3 medium, 2 low
- Verdict: NEEDS FIX

## Findings

### [blocker] --- VideoModule does not exist --- feature is NOT implemented
**What's broken:** The Architecture specifies 5 backend components: `VideoController`, `VideoService`, `JitsiJwtService`, `RoomCloseProcessor`, `VideoGuard` --- all under `src/modules/video/`. This directory does not exist. There is no `VideoModule` in the codebase. `app.module.ts` does not import any video module. The entire video classroom backend is absent.
**Why it's wrong:** This is designated "Critical priority (core product --- live classes)" in the spec. The product's core value proposition --- live video lessons --- has zero backend implementation. No room creation, no JWT generation, no access control, no auto-close.
**How to fix:** Implement the full `VideoModule` per Architecture: controller with room access endpoint, service with enrollment verification and room lifecycle, JWT service for Jitsi token generation, BullMQ processor for auto-close, guard for enrollment/ownership check. Register in `AppModule`.
**File:** `packages/api/src/modules/video/` (directory does not exist)

### [blocker] --- No enrollment-based access control for video rooms
**What's broken:** FR-2 states: "Entry is allowed only for users with active enrollment for the section." The Architecture specifies a `VideoGuard` at `guards/video.guard.ts` that checks enrollment status before allowing room access. Since the entire module is missing, there is NO access control. If Jitsi were deployed, anyone with the room URL pattern (`km-{sectionId}-{dateYYYYMMDD}`) could join.
**Why it's wrong:** This is a child safety issue (436-FZ compliance). Unauthorized adults could enter video rooms with children. The room naming pattern is predictable (UUID + date), so room URLs are guessable if you know any sectionId.
**How to fix:** The `VideoGuard` must verify: (1) user has an active enrollment for the sectionId OR is the teacher of the class, (2) current time is within the 15-minute pre-start window through endTime+10min, (3) room session is in `open` status. JWT tokens for Jitsi must encode the user's role and enrollment, and Jitsi's prosody must be configured to reject connections without valid JWTs.
**File:** N/A --- component does not exist

### [blocker] --- No Jitsi JWT generation --- anonymous access to video
**What's broken:** The Architecture specifies `JitsiJwtService` that generates HMAC-SHA256 signed JWTs for Jitsi prosody authentication. Without this, Jitsi would need to run in unauthenticated mode (anonymous access), meaning anyone with the room URL can join without identity verification.
**Why it's wrong:** Anonymous Jitsi access in a children's education platform is a 436-FZ violation. The JWT must contain the user's identity, role (teacher/student), and enrollment context. Without JWT auth, Jitsi cannot enforce moderator privileges for teachers or participant limits.
**How to fix:** Implement `JitsiJwtService` with: `{ iss: JITSI_APP_ID, sub: JITSI_DOMAIN, room: roomName, exp: sectionEndTime + 10min, context: { user: { name, email, avatar }, features: { 'screen-sharing': isTeacher } } }`. Sign with `JITSI_JWT_SECRET`. Add `JITSI_DOMAIN`, `JITSI_APP_ID`, `JITSI_JWT_SECRET` to env.schema.ts.
**File:** `packages/api/src/config/env.schema.ts` (missing Jitsi env vars)

### [high] --- No Jitsi infrastructure in Docker Compose
**What's broken:** The Architecture specifies 4 Jitsi Docker services in docker-compose.yml: `jitsi-web`, `jitsi-prosody`, `jitsi-jicofo`, `jitsi-jvb`. Looking at the project, there is likely a docker-compose.yml but it would not contain Jitsi services since the feature is unimplemented.
**Why it's wrong:** Without the Jitsi infrastructure, there is no video conferencing capability even if the backend code existed.
**How to fix:** Add the 4 Jitsi services to docker-compose.yml per Architecture spec. Configure JWT auth via environment variables. Expose JVB port 10000/udp for WebRTC media. Configure OWASP-recommended security headers on jitsi-web.
**File:** `docker-compose.yml` (Jitsi services missing)

### [high] --- No auto-close mechanism for video rooms
**What's broken:** FR-4 requires rooms to auto-close 10 minutes after the scheduled end time via a BullMQ delayed job. The Architecture specifies `RoomCloseProcessor` as a BullMQ worker. Neither the processor nor any BullMQ queue configuration exists.
**Why it's wrong:** Without auto-close: (1) rooms stay open indefinitely, wasting server resources, (2) children can stay in unsupervised video calls after the lesson ends, (3) the `RoomSession` table (also missing) cannot track "stuck" rooms. This is both a resource and safety issue.
**How to fix:** When a room is created (15 min before section start), schedule a BullMQ delayed job with delay = `duration + 25 minutes` (15 min early open + duration + 10 min grace). The processor sends a Jitsi API call to destroy the room and updates `RoomSession.closedAt`.
**File:** N/A --- component does not exist

### [high] --- No parent notification on child connection
**What's broken:** FR-5 requires that when a child connects to a video room, the parent receives a push notification within 5 seconds. There is no push notification service, no Firebase Cloud Messaging integration, no web-push setup, and no event emission on room join.
**Why it's wrong:** Parent notification is a child safety feature. Parents must know when their child enters a video call with an adult (the teacher). This is part of the platform's duty of care.
**How to fix:** 1) Implement a push notification service (FCM or web-push). 2) On room join event (detectable via Jitsi webhook or prosody events), emit a notification to the parent of the enrolled child. 3) Store push subscription tokens for parents. 4) Add the `Notification` model (already in schema) integration.
**File:** N/A --- no notification integration exists

### [medium] --- RoomSession model missing from Prisma schema
**What's broken:** The Architecture specifies a `RoomSession` model with `id`, `sectionId`, `roomName`, `openedAt`, `closedAt`, `status (open|closed|stuck)`. This model does not exist in the Prisma schema.
**Why it's wrong:** Without room session tracking: (1) no audit trail for video sessions, (2) no way to detect "stuck" rooms that failed to close, (3) no way to verify if a room was opened for a given section, (4) no data for usage analytics or billing.
**How to fix:** Add the `RoomSession` model to `schema.prisma` per Architecture spec. Add `RoomStatus` enum.
**File:** `packages/api/prisma/schema.prisma` (model missing)

### [medium] --- Missing frontend video components
**What's broken:** Architecture specifies 4 frontend components: `JitsiMeetComponent` (iframe API wrapper), `JoinButton` (with countdown timer), `ConnectionStatus` (quality indicator), `ClassroomPage` (video + chat layout). None exist in the web package. There is no `/classroom/` route.
**Why it's wrong:** The video classroom has no user interface. Students and teachers cannot join video sessions.
**How to fix:** Implement the 4 components. `JitsiMeet.tsx` should use the Jitsi iframe API (`@jitsi/react-sdk` or raw iframe with `external_api.js`). `JoinButton` should show a countdown to the 15-minute pre-start window. `ClassroomPage` should handle the full room lifecycle.
**File:** `packages/web/src/components/video/` (directory does not exist)

### [medium] --- No 436-FZ compliance measures
**What's broken:** The spec references child safety (436-FZ is Russia's law on protecting children from harmful information). The platform involves video calls between adult teachers and children. There are no implemented safeguards: no recording consent mechanisms, no parental consent flow for video participation, no content moderation, no reporting mechanism, no mandatory recording for safeguarding.
**Why it's wrong:** Operating a platform where adults have video access to children without proper safeguards is a legal and ethical risk. 436-FZ requires specific measures for online services targeting minors.
**How to fix:** 1) Require explicit parental consent for video participation (consent stored in DB). 2) Implement optional mandatory recording with access restricted to admins for safeguarding review. 3) Add a reporting mechanism for inappropriate behavior. 4) Log all room access events. 5) Consult legal counsel on 436-FZ specific requirements.
**File:** N/A --- no compliance infrastructure exists

### [low] --- Room naming pattern is predictable
**What's broken:** The spec states room names follow `km-{sectionId}-{dateYYYYMMDD}`. SectionIds are UUIDs (not sequential), but the date component is trivially predictable. If an attacker obtains any sectionId (e.g., from the class listing API which includes sections), they can construct the room URL.
**Why it's wrong:** Defense in depth --- room URLs should not be guessable. While JWT auth should prevent unauthorized access, security should not rely on a single control.
**How to fix:** Add a random component to room names: `km-{sectionId}-{dateYYYYMMDD}-{randomHex(8)}`. Store the full room name in `RoomSession` and only serve it to authorized users via the API.
**File:** N/A --- naming logic not yet implemented

### [low] --- No reconnection handling specified in backend
**What's broken:** The spec includes a scenario for automatic reconnection on connection loss (3-second retry). This is primarily a frontend/Jitsi concern, but the backend should handle the case where a user's JWT expires during a session and needs re-authentication without losing their room access.
**Why it's wrong:** If the JWT has a short TTL (matching the session duration), a reconnecting client would need a fresh JWT. Without a refresh mechanism, reconnection fails.
**How to fix:** Set JWT expiry to `sectionEndTime + 10min` (not a fixed TTL). The client can reuse the same JWT for reconnection within the session window. Add a `GET /video/refresh-token/:sectionId` endpoint for sessions that need extended time.
**File:** N/A --- not yet implemented

## Security Checklist
- [ ] **CRITICAL FAIL:** No enrollment-based access control --- anyone can join rooms
- [ ] **CRITICAL FAIL:** No JWT authentication for Jitsi --- anonymous video access
- [ ] **CRITICAL FAIL:** No 436-FZ compliance measures for child safety
- [ ] **FAIL:** No Jitsi env variables in env.schema.ts
- [ ] **FAIL:** No room session audit trail
- [ ] **FAIL:** No parent notification on child connection
- [ ] **FAIL:** Predictable room naming without JWT is exploitable
- [x] Prisma schema has Notification model (unused but available)

## Code Quality
| Criteria | Assessment |
|----------|------------|
| Correctness | NOT APPLICABLE --- feature is completely unimplemented |
| Architecture compliance | FAILING --- 0 of 9+ Architecture-specified components exist (backend + frontend + infra) |
| Child safety | CRITICAL --- no safeguards for adult-child video interaction |
| Infrastructure | FAILING --- no Jitsi Docker services |
| Test coverage | N/A --- nothing to test |
