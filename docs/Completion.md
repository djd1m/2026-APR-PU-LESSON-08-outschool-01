# Completion: Маркетплейс онлайн-классов для детей (Outschool RU)

## 1. Предрелизный чек-лист

### 1.1 Код и сборка

- [ ] Все тесты проходят (`npm run test` — 0 failures)
- [ ] Покрытие юнит-тестами >= 80% (`npm run test:cov`)
- [ ] E2E-тесты проходят на staging (`npm run test:e2e`)
- [ ] Линтер без ошибок (`npm run lint` — 0 errors, 0 warnings)
- [ ] TypeScript компиляция без ошибок (`npm run build` — exit code 0)
- [ ] Docker-образы собираются без ошибок (`docker compose build`)
- [ ] Размер Docker-образов в пределах нормы (API < 500MB, Web < 300MB)
- [ ] Нет неиспользуемых зависимостей (`npx depcheck`)
- [ ] `npm audit` — 0 critical, 0 high vulnerabilities

### 1.2 База данных

- [ ] Все миграции применяются с нуля (`npx prisma migrate deploy`)
- [ ] Миграция обратимая (rollback протестирован)
- [ ] Seed-данные загружаются корректно (`npx prisma db seed`)
- [ ] Индексы созданы для всех частых запросов
- [ ] Backup/restore процедура протестирована
- [ ] Connection pooling настроен (PgBouncer)

### 1.3 Безопасность

- [ ] Нет секретов в коде (gitleaks scan чист)
- [ ] HTTPS настроен (Let's Encrypt / Certbot)
- [ ] CORS настроен только для разрешённых доменов
- [ ] Rate limiting включён на всех публичных эндпоинтах
- [ ] CSP-заголовки настроены
- [ ] Cookies: HttpOnly, Secure, SameSite=Strict
- [ ] Webhook-подписи ЮKassa верифицируются
- [ ] 152-ФЗ: согласие на обработку ПД, хранение в РФ, политика приватности опубликована
- [ ] Пентест пройден (OWASP ZAP отчёт без critical/high)
- [ ] SSL Labs рейтинг: A+

### 1.4 Инфраструктура

- [ ] VPS провижен (CPU: 8 ядер, RAM: 32GB, SSD: 500GB)
- [ ] Docker + Docker Compose установлены
- [ ] Firewall настроен (ufw: 22, 80, 443, 5349)
- [ ] SSH-ключи настроены, пароли отключены
- [ ] Домен и DNS настроены (A-записи, CNAME для www)
- [ ] Email: SPF, DKIM, DMARC записи добавлены
- [ ] Автоматическое обновление сертификатов (certbot renew cron)
- [ ] Логротация настроена
- [ ] Бэкапы: ежедневные автоматические, хранение 30 дней

### 1.5 Мониторинг

- [ ] Prometheus собирает метрики с API и инфраструктуры
- [ ] Grafana дашборды настроены (API, DB, Video, Payments)
- [ ] Алерты настроены (email + Telegram-бот)
- [ ] Loki собирает логи со всех контейнеров
- [ ] Healthcheck-эндпоинты работают (/api/health, /api/health/db, /api/health/redis)
- [ ] Uptime-мониторинг настроен (внешний: UptimeRobot)

### 1.6 Бизнес-логика

- [ ] Оплата через ЮKassa протестирована на тестовом окружении
- [ ] Webhook-обработка ЮKassa работает корректно (все статусы)
- [ ] Возвраты работают (полный, частичный)
- [ ] Видеозвонки через Jitsi работают (до 30 участников)
- [ ] Email-уведомления отправляются (регистрация, бронирование, отмена, напоминание)
- [ ] Поиск через Elasticsearch возвращает релевантные результаты
- [ ] Расписание корректно работает с часовыми поясами РФ

---

## 2. Последовательность деплоя

### 2.1 Подготовка инфраструктуры (однократно)

```bash
# 1. Подключение к VPS
ssh deploy@production-server

# 2. Установка зависимостей
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker deploy

# 3. Создание директорий
mkdir -p /opt/outschool-ru/{data,backups,certs,logs}
mkdir -p /opt/outschool-ru/data/{postgres,redis,elasticsearch,uploads}

# 4. Копирование конфигурации
scp .env.production deploy@production-server:/opt/outschool-ru/.env
scp docker-compose.production.yml deploy@production-server:/opt/outschool-ru/docker-compose.yml

# 5. Настройка SSL (Let's Encrypt)
sudo apt install -y certbot
sudo certbot certonly --standalone -d outschool-ru.com -d www.outschool-ru.com
```

### 2.2 Деплой (каждый релиз)

```bash
#!/bin/bash
# deploy.sh — Zero-downtime deployment script
set -euo pipefail

DEPLOY_DIR="/opt/outschool-ru"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${DEPLOY_DIR}/backups/${TIMESTAMP}"

echo "=== [1/7] Создание бэкапа БД ==="
mkdir -p "${BACKUP_DIR}"
docker compose -f ${DEPLOY_DIR}/docker-compose.yml exec -T postgres \
  pg_dump -U outschool outschool_db | gzip > "${BACKUP_DIR}/db_backup.sql.gz"
echo "Бэкап создан: ${BACKUP_DIR}/db_backup.sql.gz"

echo "=== [2/7] Загрузка новых образов ==="
docker compose -f ${DEPLOY_DIR}/docker-compose.yml pull

echo "=== [3/7] Сборка образов ==="
docker compose -f ${DEPLOY_DIR}/docker-compose.yml build --no-cache api web

echo "=== [4/7] Применение миграций БД ==="
docker compose -f ${DEPLOY_DIR}/docker-compose.yml run --rm api \
  npx prisma migrate deploy

echo "=== [5/7] Blue-Green деплой ==="
# Запускаем новые контейнеры параллельно со старыми
docker compose -f ${DEPLOY_DIR}/docker-compose.yml up -d --no-deps --scale api=2 api
sleep 10  # ждём, пока новый контейнер пройдёт healthcheck

# Убираем старый контейнер
docker compose -f ${DEPLOY_DIR}/docker-compose.yml up -d --no-deps --scale api=1 api

# Обновляем web
docker compose -f ${DEPLOY_DIR}/docker-compose.yml up -d --no-deps web

echo "=== [6/7] Health Checks ==="
for i in {1..30}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "API healthcheck пройден"
    break
  fi
  if [ "$i" = "30" ]; then
    echo "ОШИБКА: API не отвечает после 30 попыток. Откатываемся."
    ${DEPLOY_DIR}/rollback.sh "${BACKUP_DIR}"
    exit 1
  fi
  sleep 2
done

echo "=== [7/7] Smoke Tests ==="
# Проверка основных эндпоинтов
curl -sf http://localhost:3001/api/health/db > /dev/null || { echo "DB health failed"; exit 1; }
curl -sf http://localhost:3001/api/health/redis > /dev/null || { echo "Redis health failed"; exit 1; }
curl -sf http://localhost:3000 > /dev/null || { echo "Web app failed"; exit 1; }

echo "=== Деплой успешно завершён: ${TIMESTAMP} ==="
```

### 2.3 docker-compose.production.yml (структура)

```yaml
version: "3.8"

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - /opt/outschool-ru/certs:/etc/letsencrypt:ro
    depends_on:
      - web
      - api
    restart: always

  web:
    build:
      context: .
      dockerfile: Dockerfile.web
    environment:
      - NEXT_PUBLIC_API_URL=https://api.outschool-ru.com
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: always

  api:
    build:
      context: .
      dockerfile: Dockerfile.api
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    restart: always

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: outschool_db
      POSTGRES_USER: outschool
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    volumes:
      - /opt/outschool-ru/data/postgres:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U outschool"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: always

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - /opt/outschool-ru/data/redis:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: always

  elasticsearch:
    image: elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=true
      - ES_JAVA_OPTS=-Xms1g -Xmx1g
    volumes:
      - /opt/outschool-ru/data/elasticsearch:/usr/share/elasticsearch/data
    restart: always

  jitsi-web:
    image: jitsi/web:stable
    env_file: .env.jitsi
    restart: always

  jitsi-prosody:
    image: jitsi/prosody:stable
    env_file: .env.jitsi
    restart: always

  jitsi-jicofo:
    image: jitsi/jicofo:stable
    env_file: .env.jitsi
    restart: always

  jitsi-jvb:
    image: jitsi/jvb:stable
    env_file: .env.jitsi
    ports:
      - "10000:10000/udp"
    restart: always

  worker:
    build:
      context: .
      dockerfile: Dockerfile.api
    command: node dist/worker.js
    env_file: .env
    depends_on:
      - redis
      - postgres
    restart: always

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    restart: always

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - /opt/outschool-ru/data/grafana:/var/lib/grafana
    restart: always

  loki:
    image: grafana/loki:latest
    volumes:
      - /opt/outschool-ru/data/loki:/loki
    restart: always
```

---

## 3. Процедура отката

```bash
#!/bin/bash
# rollback.sh — Откат к предыдущей версии
set -euo pipefail

BACKUP_DIR="${1:?Укажите директорию бэкапа}"
DEPLOY_DIR="/opt/outschool-ru"

echo "=== ОТКАТ: начало ==="

echo "[1/4] Остановка текущих сервисов API и Web..."
docker compose -f ${DEPLOY_DIR}/docker-compose.yml stop api web worker

echo "[2/4] Восстановление БД из бэкапа..."
gunzip -c "${BACKUP_DIR}/db_backup.sql.gz" | \
  docker compose -f ${DEPLOY_DIR}/docker-compose.yml exec -T postgres \
  psql -U outschool outschool_db

echo "[3/4] Запуск предыдущей версии..."
# Используем предыдущие образы (Docker хранит предыдущие слои)
docker compose -f ${DEPLOY_DIR}/docker-compose.yml up -d api web worker

echo "[4/4] Проверка здоровья..."
for i in {1..20}; do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health)
  if [ "$HTTP_CODE" = "200" ]; then
    echo "Откат успешно завершён"
    exit 0
  fi
  sleep 3
done

echo "КРИТИЧЕСКАЯ ОШИБКА: откат не удался. Требуется ручное вмешательство."
exit 1
```

### Условия отката

| Триггер | Автоматический | Действие |
|---------|---------------|----------|
| Healthcheck не проходит 30 сек после деплоя | Да | Полный откат (БД + образы) |
| Error rate > 5% в первые 10 мин | Да (через алерт) | Полный откат |
| Критическая ошибка в логах | Нет | Ручной откат после анализа |
| Невозможность принимать платежи | Да (через алерт) | Полный откат |
| Деградация видео (MOS < 3.0) | Нет | Анализ → частичный откат Jitsi |

---

## 4. CI/CD конфигурация (GitHub Actions)

### 4.1 Основной pipeline

```yaml
# .github/workflows/ci-cd.yml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: "20"
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  # ============================================
  # Стадия 1: Линтинг и проверка типов
  # ============================================
  lint:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npx gitleaks detect --source . --verbose

  # ============================================
  # Стадия 2: Тестирование
  # ============================================
  test-unit:
    name: Unit Tests
    needs: lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"
      - run: npm ci
      - run: npm run test -- --coverage --ci
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  test-integration:
    name: Integration Tests
    needs: lint
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: test_db
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"
      - run: npm ci
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
      - run: npm run test:integration
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/test_db
          REDIS_URL: redis://localhost:6379

  test-e2e:
    name: E2E Tests
    needs: [test-unit, test-integration]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: "npm"
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run build
      - run: npm run test:e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/

  # ============================================
  # Стадия 3: Сборка Docker-образов
  # ============================================
  build:
    name: Build Docker Images
    needs: [test-unit, test-integration]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || github.ref == 'refs/heads/develop'
    steps:
      - uses: actions/checkout@v4
      - uses: docker/setup-buildx-action@v3
      - uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile.api
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/api:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
      - uses: docker/build-push-action@v5
        with:
          context: .
          file: Dockerfile.web
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/web:${{ github.sha }}
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}/web:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max

  # ============================================
  # Стадия 4: Деплой
  # ============================================
  deploy-staging:
    name: Deploy to Staging
    needs: [build, test-e2e]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.STAGING_HOST }}
          username: deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/outschool-ru
            ./deploy.sh

  deploy-production:
    name: Deploy to Production
    needs: [build, test-e2e]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PRODUCTION_HOST }}
          username: deploy
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/outschool-ru
            ./deploy.sh
```

### 4.2 Управление секретами

| Секрет | Окружение | Хранение |
|--------|-----------|----------|
| `DATABASE_URL` | staging, production | GitHub Secrets + .env на VPS |
| `REDIS_PASSWORD` | staging, production | GitHub Secrets |
| `YUKASSA_SHOP_ID` | staging, production | GitHub Secrets |
| `YUKASSA_SECRET_KEY` | staging, production | GitHub Secrets |
| `JWT_SECRET` | staging, production | GitHub Secrets |
| `SSH_PRIVATE_KEY` | CI/CD | GitHub Secrets |
| `JITSI_JWT_SECRET` | staging, production | GitHub Secrets |
| `ELASTICSEARCH_PASSWORD` | staging, production | GitHub Secrets |
| `GRAFANA_PASSWORD` | production | GitHub Secrets |

**Правила:**
- Секреты никогда не хранятся в коде или Docker-образах
- Ротация секретов каждые 90 дней
- Разные значения для staging и production
- `.env.example` содержит все переменные без значений

---

## 5. Мониторинг и алертинг

### 5.1 Ключевые метрики

| Метрика | Источник | Порог (warning) | Порог (critical) | Алерт-канал |
|---------|----------|-----------------|-------------------|-------------|
| API response time p50 | Prometheus (NestJS) | > 100ms | > 300ms | Grafana → Telegram |
| API response time p99 | Prometheus (NestJS) | > 500ms | > 2000ms | Grafana → Telegram + Email |
| API error rate (5xx) | Prometheus (NestJS) | > 1% | > 5% | Grafana → Telegram + Email |
| Payment success rate | Prometheus (custom) | < 95% | < 85% | Grafana → Telegram + Email + SMS |
| Active concurrent users | Prometheus (WebSocket gauge) | > 5000 | > 8000 | Grafana → Telegram |
| Video MOS score (среднее) | Jitsi metrics | < 3.5 | < 3.0 | Grafana → Telegram |
| Video participant count | Jitsi metrics | > 3000 | > 4500 | Grafana → Telegram |
| DB connection pool usage | PgBouncer metrics | > 70% | > 90% | Grafana → Telegram |
| DB query time p99 | PostgreSQL pg_stat | > 100ms | > 500ms | Grafana → Telegram |
| Redis memory usage | Redis INFO | > 70% | > 90% | Grafana → Telegram |
| Redis hit rate | Redis INFO | < 80% | < 60% | Grafana (info) |
| Elasticsearch query time | ES metrics | > 200ms | > 1000ms | Grafana → Telegram |
| Disk usage (VPS) | node_exporter | > 70% | > 85% | Grafana → Telegram + Email |
| CPU usage (VPS) | node_exporter | > 70% (5 мин) | > 90% (5 мин) | Grafana → Telegram |
| Memory usage (VPS) | node_exporter | > 75% | > 90% | Grafana → Telegram |
| Container restart count | Docker metrics | > 2 за 10 мин | > 5 за 10 мин | Grafana → Telegram + Email |
| SSL certificate expiry | blackbox_exporter | < 14 дней | < 3 дня | Grafana → Email |
| Webhook processing lag | Bull queue metrics | > 30 сек | > 2 мин | Grafana → Telegram |
| Failed login attempts | Custom counter | > 50/мин с одного IP | > 200/мин с одного IP | Grafana → Telegram + Email |

### 5.2 Grafana-дашборды

| Дашборд | Панели |
|---------|--------|
| **Overview** | Активные пользователи, RPS, error rate, uptime |
| **API Performance** | Latency (p50/p95/p99), throughput, errors по эндпоинтам |
| **Payments** | Успешные/неудачные платежи, средний чек, возвраты, выплаты учителям |
| **Video** | Активные комнаты, участники, MOS score, bandwidth |
| **Database** | Queries/sec, slow queries, connections, disk usage, replication lag |
| **Infrastructure** | CPU, RAM, Disk, Network per container |
| **Search** | Query rate, latency, index size, cache hit rate |
| **Business** | Регистрации, бронирования, GMV, активные учителя |

### 5.3 Конфигурация Prometheus

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "alerts.yml"

alerting:
  alertmanagers:
    - static_configs:
        - targets: ["alertmanager:9093"]

scrape_configs:
  - job_name: "api"
    static_configs:
      - targets: ["api:3001"]
    metrics_path: "/api/metrics"

  - job_name: "node"
    static_configs:
      - targets: ["node-exporter:9100"]

  - job_name: "postgres"
    static_configs:
      - targets: ["postgres-exporter:9187"]

  - job_name: "redis"
    static_configs:
      - targets: ["redis-exporter:9121"]

  - job_name: "elasticsearch"
    static_configs:
      - targets: ["elasticsearch-exporter:9114"]

  - job_name: "nginx"
    static_configs:
      - targets: ["nginx-exporter:9113"]
```

---

## 6. Стратегия логирования

### 6.1 Формат (структурированный JSON)

```json
{
  "timestamp": "2026-05-21T14:30:00.123Z",
  "level": "info",
  "service": "api",
  "traceId": "abc123def456",
  "spanId": "789ghi",
  "userId": "usr_12345",
  "method": "POST",
  "path": "/api/enrollments",
  "statusCode": 201,
  "responseTime": 142,
  "message": "Enrollment created successfully",
  "metadata": {
    "classId": "cls_67890",
    "childId": "ch_11111",
    "paymentId": "pay_22222"
  }
}
```

### 6.2 Уровни логирования

| Уровень | Использование | Примеры |
|---------|---------------|---------|
| `error` | Ошибки, требующие внимания | Ошибка БД, недоступность ЮKassa, исключения |
| `warn` | Потенциальные проблемы | Rate limit exceeded, slow query > 500ms, retry |
| `info` | Бизнес-события | Регистрация, бронирование, платёж, начало/конец занятия |
| `debug` | Отладочная информация (только dev/staging) | SQL-запросы, cache hit/miss, полные HTTP-запросы |

### 6.3 Обязательные логируемые события

| Событие | Уровень | Дополнительные поля |
|---------|---------|---------------------|
| Регистрация пользователя | info | provider (email/vk/yandex), role |
| Логин (успех/неудача) | info/warn | ip, userAgent, provider |
| Создание платежа | info | amount, method, classId |
| Webhook получен | info | type, paymentId, status |
| Запись на занятие | info | classId, childId, remainingSeats |
| Начало видеосессии | info | roomId, participantCount |
| Ошибка API (5xx) | error | stack trace, request body (sanitized) |
| Rate limit triggered | warn | ip, endpoint, count |
| Подозрительная активность | warn | ip, action, details |

### 6.4 Стек сбора логов: Loki

```
Контейнеры → Docker logging driver (json-file) → Promtail → Loki → Grafana
```

| Компонент | Роль |
|-----------|------|
| Docker json-file driver | Первичное логирование в stdout/stderr |
| Promtail | Агент сбора, парсинг JSON, добавление меток (service, level) |
| Loki | Хранение, индексирование по меткам, LogQL-запросы |
| Grafana | Визуализация, поиск, корреляция с метриками |

### 6.5 Политика ротации и хранения

| Среда | Retention | Хранение |
|-------|-----------|----------|
| Production | 90 дней | Loki (local SSD) |
| Staging | 14 дней | Loki (local SSD) |
| Development | 3 дня | Локальные файлы |
| Аудит-логи | 1 год | Отдельная таблица в PostgreSQL + архив |

---

## 7. Чек-листы передачи (Handoff)

### 7.1 Разработчикам

- [ ] README.md с инструкцией по локальному запуску
- [ ] DEVELOPMENT_GUIDE.md с архитектурой и конвенциями
- [ ] Все `.env.example` файлы заполнены описаниями переменных
- [ ] Docker Compose для локальной разработки (`docker-compose.yml`)
- [ ] Seed-данные для разработки (`npx prisma db seed`)
- [ ] Swagger/OpenAPI документация API (`/api/docs`)
- [ ] Storybook для UI-компонентов (если применимо)
- [ ] Git hooks настроены (husky: pre-commit lint, commit-msg format)
- [ ] Все TODO в коде оформлены как GitHub Issues
- [ ] Архитектурные решения (ADR) задокументированы

### 7.2 QA-команде

- [ ] Тестовые окружения доступны (staging URL, credentials)
- [ ] Тестовые аккаунты созданы (родитель, учитель, админ)
- [ ] Тестовая карта ЮKassa для проверки платежей
- [ ] Gherkin-сценарии переданы (docs/Refinement.md)
- [ ] Описание API-эндпоинтов (Swagger)
- [ ] Известные ограничения и workaround-ы задокументированы
- [ ] Матрица поддерживаемых браузеров (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+)
- [ ] Чек-лист для тестирования мобильной версии (responsive)
- [ ] Доступ к логам staging-окружения (Grafana)

### 7.3 Операционной команде (DevOps/SRE)

- [ ] Документация инфраструктуры (VPS спецификации, сетевая схема)
- [ ] Runbook для типовых инцидентов:
  - API не отвечает → перезапуск контейнера → проверка БД → откат
  - БД недоступна → проверка диска → перезапуск PostgreSQL → restore из бэкапа
  - Jitsi не работает → перезапуск JVB → проверка портов → перезапуск стека
  - Диск заполнен → очистка логов → очистка Docker → расширение диска
- [ ] Доступы к мониторингу (Grafana URL, credentials)
- [ ] Процедура бэкапа и восстановления протестирована
- [ ] Процедура обновления SSL-сертификатов
- [ ] Контакты для эскалации (разработчик, тимлид, CTO)
- [ ] SLA определён: 99.5% uptime, RTO: 1 час, RPO: 1 час
- [ ] Расписание обслуживания (maintenance window): воскресенье 03:00-05:00 МСК
- [ ] Процедура масштабирования (вертикальное: upgrade VPS, горизонтальное: добавить VPS)
