# КлассМаркет

Маркетплейс живых онлайн-классов для детей 3-18 лет. Аналог [Outschool.com](https://outschool.com) для российского рынка.

## Tech Stack

Next.js 14 | NestJS | PostgreSQL 15 | Redis 7 | Elasticsearch 8 | Jitsi Meet | ЮKassa | Docker

## Quick Start

```bash
# 1. Clone
git clone https://github.com/djd1m/2026-APR-PU-LESSON-08-outschool-01.git
cd 2026-APR-PU-LESSON-08-outschool-01

# 2. Setup environment
cp .env.example .env  # заполнить переменные

# 3. Start
docker compose up -d

# Open http://localhost:3000
```

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Next.js   │────▶│   NestJS    │────▶│  PostgreSQL   │
│  :3000      │     │   :4000     │     │  :5432        │
└─────────────┘     └──────┬──────┘     └──────────────┘
                           │
                    ┌──────┼──────────────┐
                    ▼      ▼              ▼
              ┌─────────┐ ┌────────┐ ┌─────────┐
              │  Redis  │ │Elastic │ │  Jitsi  │
              │  :6379  │ │ :9200  │ │  :8443  │
              └─────────┘ └────────┘ └─────────┘
```

**Pattern:** Distributed Monolith (Monorepo) | **Deploy:** Docker Compose → VPS

## Claude Code Commands

| Команда | Описание |
|---------|----------|
| `/start` | Bootstrap проекта из SPARC docs |
| `/feature [name]` | Полный цикл фичи (PLAN → VALIDATE → IMPLEMENT → REVIEW) |
| `/plan [name]` | Лёгкое планирование (≤ 3 файлов) |
| `/go [name]` | Автовыбор /plan или /feature |
| `/next` | Следующая фича из roadmap |
| `/run mvp` | Автономная реализация MVP-фич |
| `/deploy [env]` | Деплой (dev/staging/production) |
| `/myinsights` | Сохранить инсайт разработки |

## Documentation

| Документ | Описание |
|----------|----------|
| [PRD](docs/PRD.md) | Product Requirements |
| [Specification](docs/Specification.md) | User Stories + AC |
| [Architecture](docs/Architecture.md) | System Design |
| [Pseudocode](docs/Pseudocode.md) | Algorithms + API |
| [CJM](docs/CJM.html) | Customer Journey Map |
| [DEVELOPMENT_GUIDE](DEVELOPMENT_GUIDE.md) | Dev Lifecycle |

## License

Private — All rights reserved.
