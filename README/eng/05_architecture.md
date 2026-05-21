# 5. Architecture

## 5.1. Distributed Monolith Overview

KlassMarket uses a **Distributed Monolith** pattern. All modules live in a single monorepo (`packages/*`) and share types and utilities through a shared package. Each package is deployed as a separate Docker container, allowing independent scaling while maintaining the simplicity of a monolith.

### Guiding Principles

1. **Monorepo with clear boundaries** -- each package has its own `package.json`; types and utilities are shared via the `shared` package.
2. **API-first** -- all interactions go through REST API with an OpenAPI specification.
3. **Infrastructure as Code** -- all infrastructure is described in `docker-compose.yml`.
4. **Security by Default** -- 152-FZ compliance, encryption, RBAC at every level.
5. **Observability** -- logs, metrics, and tracing for every component.

---

## 5.2. Monorepo Structure

```
klassmarket/
  packages/
    web/              # Next.js 14 frontend (App Router, SSR/ISR)
      src/
        app/          # Routes: (auth), (main), (admin), (video)
        components/   # UI kit, layout, classes, video, gamification
        hooks/        # React hooks
        store/        # Zustand state management
        lib/          # API client, utilities
        styles/       # Tailwind CSS

    api/              # NestJS backend (REST + WebSocket)
      src/
        common/       # Guards, decorators, interceptors, filters, pipes, middleware
        modules/      # Auth, Users, Children, Teachers, Classes, Sections,
                      # Enrollments, Payments, Reviews, Achievements,
                      # Notifications, Search, Recommendations, Admin, Media
        database/     # Migrations, seeds, entities
        config/       # Environment config and validation

    shared/           # Shared TypeScript types and utilities
      src/
        types/        # User, Class, Enrollment, Payment, etc.
        constants/    # Enums, error codes
        validators/   # Zod / class-validator schemas
        utils/        # Date and money formatting helpers

    video/            # Video service wrapper
      src/
        jitsi/        # Jitsi Meet API wrapper
        livekit/      # LiveKit API wrapper (alternative)
        room.service.ts
        recording.service.ts

    ai/               # MCP AI service
      src/
        mcp-server.ts              # Model Context Protocol server
        recommendations/           # Collaborative, content-based, hybrid filtering
        matching/                  # Teacher-student matching
        embeddings/                # Vector embeddings (future)

    workers/          # Background jobs (BullMQ)
      src/
        queues/       # email, notification, payment, search-index,
                      # gamification, recording
        processors/   # Queue handlers

  docker/
    nginx/            # Reverse proxy config
    jitsi/            # Jitsi Meet config
    postgres/         # DB init scripts
    elasticsearch/    # ES config

  docker-compose.yml
  docker-compose.dev.yml
  docker-compose.prod.yml
  Dockerfile          # Multi-stage build
  turbo.json          # Turborepo config
  .env.example
```

---

## 5.3. Tech Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Frontend | Next.js (React) | 14.x | SSR/SSG for SEO, App Router, Server Components |
| Styling | Tailwind CSS + shadcn/ui | 3.x | Rapid UI development, consistent design |
| State Management | Zustand | 4.x | Lightweight client state |
| Backend | NestJS | 10.x | Modular architecture, DI, decorators, OpenAPI |
| Language | TypeScript | 5.x | End-to-end type safety |
| ORM | TypeORM | 0.3.x | Migrations, decorators, PostgreSQL support |
| Validation | class-validator + class-transformer | -- | Declarative DTO validation in NestJS |
| Primary Database | PostgreSQL | 15.x | Relational storage, JSON support, extensions |
| Cache / Sessions / Queue Broker | Redis | 7.x | In-memory speed, pub/sub, BullMQ backend |
| Task Queue | BullMQ | 4.x | Reliable job delivery, retries, priorities |
| Search Engine | Elasticsearch | 8.x | Full-text search with Russian morphology, facets, autocomplete |
| Video Conferencing | Jitsi Meet (self-hosted) | latest | WebRTC, recording, moderation; alternative: LiveKit |
| File Storage | MinIO | latest | S3-compatible, self-hosted (152-FZ) |
| Payments | YooKassa (ex. Yandex.Checkout) | API v3 | Cards, SBP, YooMoney, fiscal receipts (54-FZ), split payments |
| Authentication | Passport.js + JWT | -- | VK ID OAuth2, Yandex ID OAuth2, email+password (bcrypt), JWT RS256 |
| AI / ML | MCP Server (Node.js) | -- | AI-powered class recommendations |
| Reverse Proxy | Nginx | 1.25.x | SSL termination, rate limiting, WebSocket proxy |
| Containers | Docker + Docker Compose | 24.x / 2.x | Service isolation, reproducible environments |
| Monorepo Manager | Turborepo | 1.x | Parallel builds, caching, dependency graph |
| CI/CD | GitHub Actions | -- | Automated tests, linting, build, deploy |
| Monitoring | Prometheus + Grafana | -- | Metrics, dashboards, alerts |
| Logging | Winston + Loki | -- | Structured JSON logs, Grafana visualization |
| Infrastructure | VPS (AdminVPS / HOSTKEY) | -- | Russian data centers for 152-FZ compliance |

---

## 5.4. Docker Topology

```
                    Internet
                       |
                    [Nginx]
                   /   |   \
                  /    |    \
           [Next.js] [NestJS] [Jitsi]
                       |
              +--------+--------+
              |        |        |
         [PostgreSQL] [Redis] [Elasticsearch]
              |                    |
           [MinIO]            [BullMQ Workers]
                                   |
                              [MCP AI Server]
```

All services run as Docker containers orchestrated by Docker Compose. In production, Nginx handles SSL termination, rate limiting, and load balancing.

---

## 5.5. Database Schema

### Core Tables

| Table | Description | Key Fields |
|-------|-------------|-----------|
| `users` | All user accounts | id, email, phone, password_hash, role (PARENT/TEACHER/ADMIN), auth_provider, referral_code |
| `children` | Child profiles (belong to parents) | id, parent_id, first_name, birth_date, interests[], xp, level, streak_days |
| `teacher_profiles` | Teacher-specific data | id, user_id, status, bio, education, specializations[], experience_years, rating, balance_kopecks, tax_status |
| `categories` | Class categories (hierarchical) | id, slug, name, parent_id, sort_order |
| `classes` | Class listings | id, teacher_id, title, slug, category_id, age_min/max, format, duration_minutes, max_students, price_kopecks, status, rating |
| `sections` | Scheduled sessions within a class | id, class_id, title, start_time, end_time, timezone, max_students, current_students, is_trial, video_room_id |
| `enrollments` | Child-to-section enrollment | id, child_id, section_id, parent_id, payment_id, status, attended_at, xp_earned |
| `payments` | Payment records | id, external_id, user_id, enrollment_id, amount_kopecks, commission_kopecks, teacher_amount_kopecks, status, payment_method |
| `reviews` | Parent reviews for classes | id, class_id, parent_id, child_id, enrollment_id, rating, text_content, status |
| `achievements` | Badge/achievement definitions | id, slug, name, description, icon_url, category, condition (JSON), xp_reward |
| `child_achievements` | Earned achievements | id, child_id, achievement_id, earned_at |
| `notifications` | User notifications | id, user_id, type, title, body, data (JSON), is_read, channel |

### Key Relationships

```
users 1--* children
users 1--? teacher_profiles
teacher_profiles 1--* classes
classes *--1 categories
categories *--? categories (self-referencing, hierarchy)
classes 1--* sections
sections 1--* enrollments
children 1--* enrollments
enrollments ?--1 payments
classes 1--* reviews
children 1--* child_achievements
achievements 1--* child_achievements
users 1--* notifications
```

### Monetary Values

All monetary amounts are stored as `bigint` in **kopecks** (1/100 of a ruble) to avoid floating-point precision issues. The commission split is:
- Platform commission: 20-25% (average 22%)
- Teacher payout: 75-80% (average 78%)

---

## 5.6. Security

### Authentication

- **Methods**: VK ID OAuth2, Yandex ID OAuth2, email + password (bcrypt, cost factor 12)
- **Tokens**: JWT with RS256 (asymmetric signing). Access token TTL: 15 minutes. Refresh token TTL: 30 days (stored in Redis, rotated on use).
- **Token storage**: httpOnly cookies (specification requirement; current scaffold uses localStorage -- migration planned).

### RBAC (Role-Based Access Control)

Three roles: `PARENT`, `TEACHER`, `ADMIN`. Access is enforced via NestJS guards (`AuthGuard` + `RolesGuard`) on every protected endpoint. See the RBAC matrix in the Architecture document for detailed per-resource permissions.

### Data Encryption

| Layer | Technology |
|-------|-----------|
| In transit | TLS 1.3 via Nginx |
| At rest (DB) | pgcrypto for sensitive fields (phone, passport data) |
| At rest (files) | MinIO server-side encryption (SSE-S3) |
| Passwords | bcrypt (cost factor 12) |
| Tokens | JWT RS256 (asymmetric) |
| Secrets | Docker secrets / environment variables |

### Regulatory Compliance

| Regulation | Requirement | Implementation |
|-----------|-------------|----------------|
| **152-FZ** (Personal Data) | Store personal data in Russia | VPS on AdminVPS/HOSTKEY (Moscow data centers) |
| **152-FZ** | Consent for data processing | Explicit checkbox at registration, timestamp stored |
| **152-FZ** | Right to access/delete data | `GET /users/me/data-export`, `DELETE /users/me` |
| **54-FZ** (Online Cash Registers) | Fiscal receipts for online payments | YooKassa handles receipt generation |
| **436-FZ** (Child Protection) | Age-appropriate content labeling | `ageMin`/`ageMax` on every class, age labels (0+, 6+, 12+, 16+) |
| **436-FZ** | Content moderation | All classes reviewed by admin before publishing |
| **436-FZ** | Parental control | Children access only via parent account, no direct messaging with teachers |
