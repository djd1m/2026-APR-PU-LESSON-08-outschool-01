# 3. Руководство администратора

Деплой, мониторинг, резервное копирование, управление секретами и масштабирование КлассМаркет.

---

## 3.1. Деплой на VPS (Docker Compose)

### Требования к серверу

| Ресурс | Минимум | Рекомендуется |
|--------|---------|---------------|
| CPU | 4 vCPU | 8 vCPU |
| RAM | 8 ГБ | 16 ГБ |
| Диск | 100 ГБ SSD | 250 ГБ NVMe |
| ОС | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Хостинг | AdminVPS / HOSTKEY | AdminVPS / HOSTKEY |

Российские VPS-провайдеры обязательны для соблюдения 152-ФЗ (хранение персональных данных на территории РФ).

### Порядок деплоя

```bash
# 1. Подключение к серверу
ssh deploy@your-server-ip

# 2. Установка Docker и Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy

# 3. Клонирование репозитория
git clone <repository-url> /opt/klassmarket
cd /opt/klassmarket

# 4. Настройка переменных окружения
cp .env.example .env
nano .env  # заполнить продакшен-значения

# 5. Сборка и запуск всех сервисов
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 6. Применение миграций
docker compose exec api npx prisma migrate deploy

# 7. Начальные данные (категории, бейджи, администратор)
docker compose exec api npx prisma db seed

# 8. Проверка
docker compose ps
curl -s http://localhost:3001/api/health
```

### Сервисы Docker Compose

| Сервис | Порт | Описание |
|--------|------|----------|
| `web` | 3000 | Next.js (фронтенд) |
| `api` | 3001 | NestJS (бэкенд) |
| `workers` | — | BullMQ-воркеры (фоновые задачи) |
| `postgres` | 5432 | PostgreSQL 15 |
| `redis` | 6379 | Redis 7 |
| `elasticsearch` | 9200 | Elasticsearch 8 |
| `minio` | 9000 / 9001 | MinIO (API / Консоль) |
| `jitsi` | 8443 | Jitsi Meet (видеозвонки) |
| `nginx` | 80 / 443 | Обратный прокси |

---

## 3.2. Nginx + SSL

### Получение сертификата Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d klassmarket.ru -d www.klassmarket.ru
```

### Основные директивы Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name klassmarket.ru;

    ssl_certificate     /etc/letsencrypt/live/klassmarket.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/klassmarket.ru/privkey.pem;
    ssl_protocols       TLSv1.3;

    # Фронтенд
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        limit_req zone=api burst=20 nodelay;
    }

    # WebSocket (видео)
    location /ws/ {
        proxy_pass http://localhost:8443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
```

Автопродление настраивается certbot автоматически. Проверка: `sudo certbot renew --dry-run`.

---

## 3.3. Мониторинг (Prometheus + Grafana)

### Схема

```
NestJS / Workers / PostgreSQL / Redis
        |
        v (эндпоинты метрик)
   Prometheus (сбор каждые 15 сек)
        |
        v
     Grafana (дашборды + алерты)
        |
        v
   Alertmanager --> Telegram / Email
```

### Основные дашборды

| Дашборд | Метрики |
|---------|---------|
| **API** | RPS, латентность (P50/P95/P99), процент ошибок, активные соединения |
| **БД** | Длительность запросов, пул соединений, лаг репликации, размер таблиц |
| **Redis** | Потребление памяти, hit rate, длина очередей |
| **Elasticsearch** | Латентность запросов, скорость индексации, здоровье кластера |
| **Бизнес** | DAU/MAU, регистрации, записи на занятия, платежи, выручка |

### Примеры правил алертинга

| Алерт | Условие | Критичность |
|-------|---------|-------------|
| Высокий процент ошибок API | error_rate > 5% за 5 мин | critical |
| Высокая латентность P99 | p99 > 2 сек за 5 мин | warning |
| Пул соединений БД исчерпан | available_connections < 5 | critical |
| Redis память > 80% | used_memory_pct > 80% | warning |
| Диск > 90% | disk_used_pct > 90% | critical |
| Elasticsearch кластер RED | cluster_status == "red" | critical |

---

## 3.4. Резервное копирование PostgreSQL

### Ежедневный автоматический бэкап

```bash
#!/bin/bash
# /opt/klassmarket/scripts/backup-db.sh

BACKUP_DIR="/opt/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="klassmarket_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

docker compose exec -T postgres pg_dump -U klassmarket klassmarket \
  | gzip > "$BACKUP_DIR/$FILENAME"

# Хранить последние 30 бэкапов
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Бэкап создан: $FILENAME"
```

### Расписание cron

```cron
# Ежедневно в 03:00 по Москве
0 3 * * * /opt/klassmarket/scripts/backup-db.sh >> /var/log/backup.log 2>&1
```

### Восстановление из бэкапа

```bash
gunzip -c /opt/backups/postgres/klassmarket_20260521_030000.sql.gz \
  | docker compose exec -T postgres psql -U klassmarket klassmarket
```

---

## 3.5. Управление секретами

### Обязательные секреты

| Секрет | Где используется | Ротация |
|--------|-----------------|---------|
| `JWT_SECRET` | Подпись токенов (NestJS) | Каждые 90 дней |
| `DATABASE_URL` | Подключение к PostgreSQL | При смене пароля |
| `REDIS_URL` | Подключение к Redis | При смене пароля |
| `YUKASSA_SECRET_KEY` | HMAC вебхуков ЮKassa | По политике ЮKassa |
| `MINIO_SECRET_KEY` | Хранилище файлов | Каждые 90 дней |
| `VK_CLIENT_SECRET` | VK OAuth | По политике VK |
| `YANDEX_CLIENT_SECRET` | Yandex OAuth | По политике Yandex |

### Правила безопасности

1. Никогда не коммитить `.env` в репозиторий. В `.gitignore` должны быть `.env` и `.env.*` (кроме `.env.example`).
2. В продакшене использовать Docker secrets или HashiCorp Vault.
3. Запретить логирование секретов -- настроить Winston на редактирование чувствительных полей.
4. Ограничить права доступа к файлу: `chmod 600 .env`.

---

## 3.6. Обновление и масштабирование

### Обновление приложения

```bash
cd /opt/klassmarket
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose exec api npx prisma migrate deploy
```

### Горизонтальное масштабирование

| Компонент | Стратегия |
|-----------|-----------|
| **API (NestJS)** | Stateless -- добавить реплики контейнеров за Nginx |
| **Workers (BullMQ)** | Добавить реплики воркеров; BullMQ распределяет задачи через Redis |
| **PostgreSQL** | Вертикальное масштабирование; read replicas для тяжёлых запросов на чтение |
| **Redis** | Вертикальное масштабирование; Redis Cluster при > 32 ГБ |
| **Elasticsearch** | Добавить data-ноды в кластер |
| **Jitsi** | Отдельные инстансы JVB (Videobridge) на N параллельных комнат |

### Этапы масштабирования

| Пользователей | Изменения инфраструктуры |
|---------------|--------------------------|
| до 1 000 | Один VPS, все сервисы на одной машине |
| 1K -- 10K | Отдельный сервер БД, 2 реплики API, выделенный Jitsi |
| 10K -- 50K | Redis Cluster, ES-кластер (3 ноды), несколько JVB |
| 50K+ | Микросервисная декомпозиция, CDN, управляемая БД |
