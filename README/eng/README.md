# KlassMarket — Documentation

**KlassMarket** is a Russian EdTech marketplace for live online classes for kids aged 3-18. Teachers create and run classes; parents discover, book, and pay for the right classes for their children. The platform adapts the proven Outschool model for the Russian market with three key differentiators: AI-powered personalization, gamification, and deep localization.

---

## Table of Contents

| # | Document | Description |
|---|----------|-------------|
| 1 | [Quick Start](01_quickstart.md) | Prerequisites, installation, and first launch |
| 2 | [User Guide](02_user_guide.md) | Workflows for parents, teachers, and admins |
| 3 | [Admin Guide](03_admin_guide.md) | Deployment, monitoring, backups, and scaling |
| 4 | [API Reference](04_api_reference.md) | All REST API endpoints with request/response examples |
| 5 | [Architecture](05_architecture.md) | System design, tech stack, database schema, security |
| 6 | [Troubleshooting](06_troubleshooting.md) | Common issues and solutions |
| 7 | [Changelog](07_changelog.md) | Version history grouped by development phases |

---

## Tech Stack at a Glance

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 + TypeScript |
| Backend | NestJS + TypeScript |
| Database | PostgreSQL 15 |
| Cache / Queue | Redis 7 + BullMQ |
| Search | Elasticsearch 8 |
| Video | Jitsi Meet (self-hosted) |
| Payments | YooKassa (formerly Yandex.Checkout) |
| Files | MinIO (S3-compatible) |
| AI | MCP Server |
| Infrastructure | Docker Compose on VPS |

---

## Links

- [Russian Documentation](../ru/)
- Project root: `CLAUDE.md`
- SPARC documentation: `docs/`
