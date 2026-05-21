# 1. Quick Start

## Prerequisites

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| Node.js | 20+ | LTS recommended |
| npm | 10+ | Comes with Node.js |
| Docker | 24+ | Docker Desktop or Docker Engine |
| Docker Compose | 2.x | V2 plugin (bundled with Docker Desktop) |
| Git | 2.30+ | Any recent version |

---

## Step-by-Step Setup

### 1. Clone the repository

```bash
git clone <repository-url> klassmarket
cd klassmarket
```

### 2. Copy the environment file

```bash
cp .env.example .env
```

Edit `.env` and fill in the required values:

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@localhost:5432/klassmarket` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Secret key for JWT signing | (generate a strong random string) |
| `YUKASSA_SHOP_ID` | YooKassa merchant ID | `123456` |
| `YUKASSA_SECRET_KEY` | YooKassa API secret | (from YooKassa dashboard) |
| `ELASTICSEARCH_URL` | Elasticsearch node URL | `http://localhost:9200` |
| `MINIO_ENDPOINT` | MinIO server URL | `http://localhost:9000` |
| `MINIO_ACCESS_KEY` | MinIO access key | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO secret key | `minioadmin` |

### 3. Start infrastructure services

```bash
docker compose up -d
```

This starts PostgreSQL, Redis, Elasticsearch, MinIO, and Jitsi Meet containers.

### 4. Install dependencies and run migrations

```bash
npm install
npx prisma migrate dev
npx prisma db seed    # optional: loads sample data (categories, badges)
```

### 5. Start the development servers

```bash
npm run dev
```

This uses Turborepo to start all packages in parallel:
- **Frontend (Next.js):** http://localhost:3000
- **Backend (NestJS):** http://localhost:3001
- **API docs (Swagger):** http://localhost:3001/api/docs

---

## Verify Installation

1. Open http://localhost:3000 in your browser.
2. You should see the KlassMarket home page with a class catalog.
3. Register a test account (parent or teacher) to confirm auth works.
4. Check http://localhost:3001/api/health for API health status.

---

## Monorepo Structure

```
packages/
  web/          # Next.js frontend
  api/          # NestJS backend
  shared/       # Shared types and utilities
  video/        # Video service wrapper (Jitsi/LiveKit)
  ai/           # MCP AI recommendation service
  workers/      # Background jobs (BullMQ)
```

---

## Useful Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all packages in dev mode |
| `npm run build` | Build all packages |
| `npm run test` | Run all tests |
| `npm run lint` | Run ESLint across all packages |
| `npm run typecheck` | TypeScript type checking |
| `docker compose up -d` | Start infrastructure containers |
| `docker compose down` | Stop infrastructure containers |
| `npx prisma studio` | Open Prisma database browser |
