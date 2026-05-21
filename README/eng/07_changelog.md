# 7. Changelog

All notable changes to KlassMarket, grouped by development phases.

---

## Phase 0: Product Discovery

- Conducted market research on the Russian EdTech landscape (154 billion RUB market, tutoring segment 19 billion RUB, +50% YoY)
- Analyzed the Outschool model ($192M revenue, 200K+ classes) for Russian market adaptation
- Identified three key differentiators: AI personalization, gamification, deep localization
- Defined target personas: caring parent, investing parent, homeschooler, teacher
- Validated business model: platform commission 20-25% from teacher + 5-10% marketplace fee from parent

---

## Phase 1: SPARC Planning

- Created Product Requirements Document (PRD) with MVP scope
- Defined 30+ user stories with acceptance criteria for all three roles
- Authored technical Specification covering all modules
- Designed system Architecture (Distributed Monolith, monorepo)
- Wrote Pseudocode for core algorithms (search ranking, payment split, gamification, AI recommendations)
- Completed Refinement with edge cases and error handling
- Finalized Completion phase with deployment and testing strategy
- Produced C4 diagrams (Context, Container, Component levels)
- Created BDD test scenarios for critical user flows

---

## Phase 2: Validation

- Ran requirements validation (INVEST + SMART criteria) across all features
- Generated validation reports for each feature with scores
- All features passed with GREEN or CAVEATS verdicts (average score >= 70)
- No blockers identified; caveats documented for follow-up

---

## Phase 3: Implementation (MVP)

### Auth and Users
- User registration (email, VK ID, Yandex ID)
- JWT authentication with access + refresh tokens
- RBAC guards (Parent, Teacher, Admin roles)
- Email verification flow
- Password reset flow

### Classes and Catalog
- Class CRUD for teachers
- Category management (hierarchical)
- Class card with full details
- Sections (scheduled sessions) management

### Search
- Elasticsearch integration with Russian morphology analyzer
- Full-text search with filters (age, category, price, format, rating)
- Autocomplete suggestions
- Search results ranking (relevance x rating x freshness)

### Enrollments
- Child enrollment in sections
- Trial class enrollment (free)
- Enrollment status management (pending, confirmed, attended, cancelled)

### Payments
- YooKassa integration (API v3)
- Payment initiation and confirmation flow
- Webhook processing for payment status updates
- Commission calculation (22% platform, 78% teacher)
- Fiscal receipt generation (54-FZ)

### Video
- Jitsi Meet integration for live video classes
- Room creation and access control (enrollment-based)
- Teacher controls (screen sharing, recording, mute, remove)

### Teacher Dashboard
- Upcoming classes and enrolled students view
- Earnings and payout tracking
- Class management interface

### Parent Dashboard
- Child progress tracking (XP, levels, badges, streaks)
- Enrollment management
- Review submission

### Gamification
- XP system with level progression
- Achievement/badge definitions and earning logic
- Streak tracking (consecutive attendance days)

### Admin Panel
- Class moderation queue (approve/reject)
- Teacher verification workflow
- Review moderation
- Analytics overview dashboard

### Notifications
- Email notifications (registration, enrollment, payment, class reminders)
- Push notifications (class starting, child joined)
- In-app notification center

### Infrastructure
- Docker Compose setup (dev + prod overlays)
- Multi-stage Dockerfile
- Nginx reverse proxy with SSL configuration
- Prometheus + Grafana monitoring
- Winston structured logging

---

## Phase 4: Review

- Ran brutal-honesty-review across all 13 MVP features
- Identified critical security issues:
  - Privilege escalation in registration (ADMIN role assignable via API) -- **fixed**
  - JWT hardcoded fallback secret -- **fixed**
  - Tokens in localStorage instead of httpOnly cookies -- **migration planned**
  - YooKassa webhook missing HMAC verification -- **fixed**
- Identified code quality issues:
  - Float instead of Decimal for payment amounts -- **fixed** (migrated to kopecks as bigint)
  - Elasticsearch integration code orphaned (not called) -- **wired up**
  - 40-50% of specification not yet implemented (scheduling, advanced video, teacher dashboard details) -- **backlog**
- All blockers resolved; medium/low findings logged for future iterations

---

## Backlog (Post-MVP)

- Advanced scheduling (recurring classes, calendar sync)
- LiveKit as alternative to Jitsi (modern SFU)
- AI recommendations engine (MCP server, collaborative + content-based filtering)
- Teacher-student matching algorithm
- Referral system with bonus credits
- Mobile app (React Native)
- Subscription model for power users
- Multi-language support
- Advanced analytics (cohort analysis, LTV, churn prediction)
- CDN for static assets and video recordings
