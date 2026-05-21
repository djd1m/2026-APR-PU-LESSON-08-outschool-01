# 3. Admin Guide

This guide covers production deployment, monitoring, backups, security, and operational procedures for KlassMarket.

---

## 3.1. VPS Deployment (Docker Compose)

### Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 4 vCPU | 8 vCPU |
| RAM | 8 GB | 16 GB |
| Disk | 100 GB SSD | 250 GB NVMe |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| Provider | AdminVPS / HOSTKEY | AdminVPS / HOSTKEY |

Russian-based VPS providers are required for 152-FZ (personal data residency) compliance.

### Deployment Steps

```bash
# 1. SSH into the server
ssh deploy@your-server-ip

# 2. Install Docker and Docker Compose (if not installed)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy

# 3. Clone the repository
git clone <repository-url> /opt/klassmarket
cd /opt/klassmarket

# 4. Configure environment
cp .env.example .env
nano .env  # fill in production values

# 5. Build and start all services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 6. Run database migrations
docker compose exec api npx prisma migrate deploy

# 7. Seed initial data (categories, badges, admin user)
docker compose exec api npx prisma db seed

# 8. Verify
docker compose ps
curl -s http://localhost:3001/api/health
```

### Docker Compose Services

| Service | Port | Description |
|---------|------|-------------|
| `web` | 3000 | Next.js frontend |
| `api` | 3001 | NestJS backend |
| `workers` | - | BullMQ background workers |
| `postgres` | 5432 | PostgreSQL 15 |
| `redis` | 6379 | Redis 7 |
| `elasticsearch` | 9200 | Elasticsearch 8 |
| `minio` | 9000 / 9001 | MinIO (API / Console) |
| `jitsi` | 8443 | Jitsi Meet video |
| `nginx` | 80 / 443 | Reverse proxy |

---

## 3.2. Nginx + SSL Setup

### Install Certbot and Obtain Certificates

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d klassmarket.ru -d www.klassmarket.ru
```

### Nginx Configuration Highlights

```nginx
server {
    listen 443 ssl http2;
    server_name klassmarket.ru;

    ssl_certificate     /etc/letsencrypt/live/klassmarket.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/klassmarket.ru/privkey.pem;
    ssl_protocols       TLSv1.3;

    # Frontend
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

        # Rate limiting
        limit_req zone=api burst=20 nodelay;
    }

    # WebSocket (video)
    location /ws/ {
        proxy_pass http://localhost:8443;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}

# Rate limiting zone
limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
```

### Auto-Renewal

```bash
sudo certbot renew --dry-run
# Cron is set up automatically by certbot
```

---

## 3.3. Monitoring (Prometheus + Grafana)

### Architecture

```
NestJS / Workers / PostgreSQL / Redis
        |
        v (metrics endpoints)
   Prometheus (scrape every 15s)
        |
        v
     Grafana (dashboards + alerts)
        |
        v
   Alertmanager --> Telegram / Email
```

### Key Dashboards

| Dashboard | Metrics |
|-----------|---------|
| **API Performance** | Request rate, latency (P50/P95/P99), error rate, active connections |
| **Database** | Query duration, connection pool, replication lag, table sizes |
| **Redis** | Memory usage, hit rate, connected clients, queue lengths |
| **Elasticsearch** | Query latency, indexing rate, cluster health, JVM heap |
| **Business** | DAU/MAU, registrations, enrollments, payments, revenue |

### Alert Rules (Examples)

| Alert | Condition | Severity |
|-------|-----------|----------|
| API Error Rate High | error_rate > 5% for 5 min | critical |
| API Latency P99 High | p99_latency > 2s for 5 min | warning |
| Database Connection Pool Exhausted | available_connections < 5 | critical |
| Redis Memory > 80% | used_memory_pct > 80% | warning |
| Disk Usage > 90% | disk_used_pct > 90% | critical |
| Elasticsearch Cluster Red | cluster_status == "red" | critical |

---

## 3.4. PostgreSQL Backups

### Automated Daily Backups

```bash
#!/bin/bash
# /opt/klassmarket/scripts/backup-db.sh

BACKUP_DIR="/opt/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="klassmarket_${TIMESTAMP}.sql.gz"

mkdir -p "$BACKUP_DIR"

docker compose exec -T postgres pg_dump -U klassmarket klassmarket \
  | gzip > "$BACKUP_DIR/$FILENAME"

# Keep last 30 daily backups
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete

echo "Backup created: $FILENAME"
```

### Cron Schedule

```cron
# Daily at 3:00 AM Moscow time
0 3 * * * /opt/klassmarket/scripts/backup-db.sh >> /var/log/backup.log 2>&1
```

### Restore

```bash
gunzip -c /opt/backups/postgres/klassmarket_20260521_030000.sql.gz \
  | docker compose exec -T postgres psql -U klassmarket klassmarket
```

### Backup Verification

Run a weekly restore test on a staging server to confirm backup integrity.

---

## 3.5. Secret Management

### Environment Variables (Production)

Never commit `.env` files to the repository. The `.gitignore` must exclude:
- `.env`
- `.env.*` (except `.env.example`)

### Required Secrets

| Secret | Where Used | Rotation Policy |
|--------|-----------|-----------------|
| `JWT_SECRET` | Token signing (NestJS) | Every 90 days |
| `DATABASE_URL` | PostgreSQL connection | On credential change |
| `REDIS_URL` | Redis connection | On credential change |
| `YUKASSA_SECRET_KEY` | Payment webhook HMAC | Per YooKassa policy |
| `MINIO_SECRET_KEY` | File storage | Every 90 days |
| `VK_CLIENT_SECRET` | VK OAuth | Per VK policy |
| `YANDEX_CLIENT_SECRET` | Yandex OAuth | Per Yandex policy |

### Best Practices

1. Use Docker secrets or a vault (e.g., HashiCorp Vault) for production deployments.
2. Never log secrets -- configure Winston to redact sensitive fields.
3. Rotate secrets on a fixed schedule and after any suspected compromise.
4. Restrict `.env` file permissions: `chmod 600 .env`.

---

## 3.6. Updates and Scaling

### Updating the Application

```bash
cd /opt/klassmarket

# Pull latest code
git pull origin main

# Rebuild and restart (zero-downtime with health checks)
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Run new migrations
docker compose exec api npx prisma migrate deploy
```

### Horizontal Scaling

| Component | Scaling Strategy |
|-----------|-----------------|
| **API (NestJS)** | Stateless -- add more container replicas behind Nginx load balancer |
| **Workers (BullMQ)** | Add worker replicas -- BullMQ distributes jobs via Redis |
| **PostgreSQL** | Vertical scaling first; add read replicas for read-heavy queries |
| **Redis** | Vertical scaling; Redis Cluster for > 32 GB |
| **Elasticsearch** | Add data nodes to the cluster |
| **Jitsi** | Separate Jitsi Videobridge (JVB) instances per N concurrent rooms |

### Scaling Milestones

| Users | Infrastructure Changes |
|-------|-----------------------|
| 0 - 1,000 | Single VPS, all services on one machine |
| 1,000 - 10,000 | Separate DB server, 2 API replicas, dedicated Jitsi server |
| 10,000 - 50,000 | Redis Cluster, ES cluster (3 nodes), multiple JVB instances |
| 50,000+ | Consider microservices extraction, CDN for static assets, managed DB |
