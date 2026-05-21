# Development Guide — КлассМаркет

## Quick Start

### Prerequisites
- Node.js 20+
- Docker + Docker Compose
- Git

### Setup
```bash
git clone https://github.com/djd1m/2026-APR-PU-LESSON-08-outschool-01.git
cd 2026-APR-PU-LESSON-08-outschool-01
cp .env.example .env  # заполнить переменные
docker compose up -d
npm install
npx prisma migrate dev
npx prisma db seed
```

### Development
```bash
# API (NestJS)
npm run dev -w packages/api

# Web (Next.js)
npm run dev -w packages/web

# Workers (BullMQ)
npm run dev -w packages/workers
```

Open: http://localhost:3000 (web), http://localhost:4000/api (API docs)

---

## Project Structure

```
packages/
├── web/              # Next.js 14 frontend (App Router)
├── api/              # NestJS backend (REST + WebSocket)
├── shared/           # Shared types and utils
├── workers/          # BullMQ background jobs
└── ai/               # MCP AI service (recommendations)

docs/                 # SPARC documentation (10 docs)
.claude/
├── agents/           # AI agents (planner, reviewer, architect)
├── commands/         # Slash commands (/feature, /plan, /go, etc.)
├── rules/            # Coding style, security, testing rules
├── skills/           # Domain knowledge, coding standards
├── hooks/            # Auto-commit, auto-push hooks
└── feature-roadmap.json  # Feature backlog with dependencies
```

---

## Development Workflow

### 1. Pick a Feature
```bash
# Показать следующие 3 фичи из roadmap
/next

# Или выбрать конкретную
/next auth-registration
```

### 2. Plan or Implement
```bash
# Для простых задач (≤ 3 файлов)
/plan auth-registration

# Для сложных задач (≥ 4 файлов)
/feature auth-registration

# Автовыбор
/go auth-registration
```

### 3. Branch Strategy
```
main                    # production-ready
feature/<id>-<slug>     # per-feature branch
hotfix/<slug>           # emergency fixes
```

### 4. Commit Convention
```
<type>(<scope>): <subject>

Types: feat, fix, docs, refactor, test, chore, perf, style, ci
Example: feat(auth): add VK ID OAuth flow
```

---

## Adding a New Feature

### Backend (NestJS Module)
```bash
# Создать структуру модуля
packages/api/src/modules/[name]/
├── [name].module.ts
├── [name].controller.ts
├── [name].service.ts
├── [name].repository.ts
├── dto/
│   ├── create-[name].dto.ts
│   └── update-[name].dto.ts
└── [name].spec.ts
```

См. `.claude/skills/coding-standards/SKILL.md` для шаблонов.

### Frontend (Next.js Page)
```bash
packages/web/app/[route]/
├── page.tsx           # Page component
├── layout.tsx         # Layout (if needed)
└── components/        # Page-specific components
```

### Database Migration
```bash
# Изменить schema
# packages/api/prisma/schema.prisma

# Создать миграцию
npx prisma migrate dev --name add_[table_name]

# Seed данные
npx prisma db seed
```

---

## Testing

### Unit Tests
```bash
npm run test              # все пакеты
npm run test -w packages/api  # только API
npm run test:coverage     # с покрытием
```

### Integration Tests
```bash
npm run test:integration  # требует Docker (Testcontainers)
```

### E2E Tests
```bash
npm run test:e2e          # Playwright, требует запущенное приложение
```

### Coverage Targets
| Слой | Target |
|------|:------:|
| Services | 80%+ |
| Payment logic | 90%+ |
| Controllers | 70%+ |
| Frontend | 60%+ |

---

## Deployment

### Environments
| Env | URL | Branch |
|-----|-----|--------|
| Dev | localhost:3000 | любая |
| Staging | staging.klassmarket.ru | main |
| Production | klassmarket.ru | main (tag) |

### Deploy Command
```bash
# Via Claude Code
/deploy staging
/deploy production

# Manual
ssh vps "cd /app && git pull && docker compose up -d --build"
```

### Pre-Deploy Checklist
- [ ] Тесты проходят
- [ ] Lint чистый
- [ ] Миграции применены
- [ ] .env актуален
- [ ] Нет секретов в коде

---

## Environment Variables

| Variable | Description | Required |
|----------|-------------|:--------:|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `ELASTICSEARCH_URL` | Elasticsearch URL | Yes |
| `YOOKASSA_SHOP_ID` | ЮKassa shop ID | Yes |
| `YOOKASSA_SECRET_KEY` | ЮKassa secret | Yes |
| `JWT_PRIVATE_KEY` | RS256 private key | Yes |
| `JWT_PUBLIC_KEY` | RS256 public key | Yes |
| `VK_CLIENT_ID` | VK OAuth client ID | Yes |
| `VK_CLIENT_SECRET` | VK OAuth secret | Yes |
| `YANDEX_CLIENT_ID` | Яндекс OAuth client ID | Yes |
| `YANDEX_CLIENT_SECRET` | Яндекс OAuth secret | Yes |
| `JITSI_URL` | Jitsi Meet server URL | Yes |
| `MINIO_ENDPOINT` | MinIO endpoint | Yes |
| `MINIO_ACCESS_KEY` | MinIO access key | Yes |
| `MINIO_SECRET_KEY` | MinIO secret key | Yes |

---

## Troubleshooting

### Elasticsearch не запускается
```bash
# Увеличить vm.max_map_count (Linux)
sudo sysctl -w vm.max_map_count=262144
```

### Prisma миграции конфликтуют
```bash
npx prisma migrate reset  # ОСТОРОЖНО: удаляет данные
npx prisma migrate dev
```

### Jitsi WebRTC не работает
- Проверить порты: 8443 (HTTPS), 10000/UDP (media)
- Проверить TURN/STUN сервер конфигурацию
- Проверить SSL-сертификат
