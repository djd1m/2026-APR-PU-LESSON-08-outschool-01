# Быстрый старт

Запуск КлассМаркет в локальном окружении за 5 шагов.

---

## Требования

| Компонент | Минимальная версия | Проверка |
|-----------|-------------------|----------|
| Node.js | 20.0.0+ | `node --version` |
| Docker | 24.x+ | `docker --version` |
| Docker Compose | 2.x+ | `docker compose version` |
| Git | 2.30+ | `git --version` |
| Свободная RAM | 8 GB+ | — |
| Свободное место | 10 GB+ | — |

---

## Шаг 1. Клонирование репозитория

```bash
git clone <URL_РЕПОЗИТОРИЯ> klassmarket
cd klassmarket
```

## Шаг 2. Настройка переменных окружения

```bash
cp .env.example .env
```

Откройте `.env` и заполните обязательные переменные:

```env
# База данных
DB_USER=klassmarket
DB_PASSWORD=<ваш_пароль>
DATABASE_URL=postgresql://klassmarket:<ваш_пароль>@localhost:5432/outschool

# Redis
REDIS_PASSWORD=<ваш_пароль>

# JWT (ОБЯЗАТЕЛЬНО — без этого сервер не запустится)
JWT_SECRET=<длинная_случайная_строка_минимум_32_символа>

# ЮKassa (для платежей)
YUKASSA_SHOP_ID=<ваш_shop_id>
YUKASSA_SECRET_KEY=<ваш_secret_key>

# MinIO (файловое хранилище)
MINIO_USER=minioadmin
MINIO_PASSWORD=<ваш_пароль>
```

## Шаг 3. Запуск инфраструктуры через Docker Compose

```bash
docker compose up -d
```

Это запустит:
- PostgreSQL 15 (порт 5432)
- Redis 7 (порт 6379)
- Elasticsearch 8 (порт 9200)
- MinIO (порт 9000, консоль 9001)
- Jitsi Meet (порт 8443)

Убедитесь, что все контейнеры работают:

```bash
docker compose ps
```

## Шаг 4. Установка зависимостей, миграции и seed-данные

```bash
npm install
npx prisma migrate dev
npx prisma db seed
```

Или через npm-скрипты:

```bash
npm install
npm run db:migrate
npm run db:seed
```

## Шаг 5. Запуск приложения

```bash
npm run dev
```

Откройте в браузере: **http://localhost:3000**

---

## Полезные команды

| Команда | Описание |
|---------|----------|
| `npm run dev` | Запуск всех пакетов в dev-режиме |
| `npm run build` | Сборка всех пакетов |
| `npm run test` | Запуск unit-тестов |
| `npm run test:integration` | Интеграционные тесты (API) |
| `npm run test:e2e` | E2E-тесты (Playwright) |
| `npm run lint` | Проверка линтером |
| `npm run lint:fix` | Автоматическое исправление |
| `npm run format` | Форматирование кода (Prettier) |
| `npm run docker:up` | Запуск Docker-контейнеров |
| `npm run docker:down` | Остановка Docker-контейнеров |
| `npm run db:studio` | Открыть Prisma Studio (GUI для БД) |

---

## Структура монорепо

```
packages/
  web/       — Next.js 14 фронтенд (порт 3000)
  api/       — NestJS бэкенд (порт 3001)
  shared/    — Общие типы и утилиты
  video/     — Обёртка видеосервиса (Jitsi/LiveKit)
  ai/        — MCP AI-сервис рекомендаций
  workers/   — Фоновые задачи (BullMQ)
```

---

## Возможные проблемы при запуске

Если возникли проблемы, обратитесь к разделу [Устранение неполадок](06_troubleshooting.md).
