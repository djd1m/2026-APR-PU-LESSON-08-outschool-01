# 6. Troubleshooting

Common issues encountered during development and deployment, along with their solutions.

---

## 6.1. Elasticsearch: `vm.max_map_count` Too Low

**Symptom:** Elasticsearch container exits immediately with the error:
```
max virtual memory areas vm.max_map_count [65530] is too low, increase to at least [262144]
```

**Cause:** The Linux kernel parameter `vm.max_map_count` defaults to 65530, but Elasticsearch requires at least 262144.

**Solution:**

```bash
# Temporary (until reboot)
sudo sysctl -w vm.max_map_count=262144

# Permanent
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

Then restart the Elasticsearch container:
```bash
docker compose restart elasticsearch
```

---

## 6.2. Prisma Migration Conflicts

**Symptom:** `npx prisma migrate dev` fails with a migration conflict or drift error.

**Cause:** Migration history in the database diverges from migration files on disk. This often happens when multiple developers create migrations on different branches.

**Solution:**

```bash
# Option 1: Reset the dev database (DESTROYS DATA)
npx prisma migrate reset

# Option 2: Mark a migration as applied without running it
npx prisma migrate resolve --applied <migration-name>

# Option 3: If shadow database is unreachable
# Set DATABASE_URL_SHADOW explicitly in .env
DATABASE_URL_SHADOW="postgresql://user:pass@localhost:5433/klassmarket_shadow"
```

**Insight:** Prisma `migrate dev` fails silently if the shadow database is unreachable. Always set `DATABASE_URL_SHADOW` explicitly when using a non-default PostgreSQL setup.

---

## 6.3. Jitsi WebRTC Issues

**Symptom:** Video calls fail to connect, show a black screen, or have severe latency.

**Cause:** WebRTC requires specific network configuration for STUN/TURN and UDP port access.

**Solution:**

1. **Ensure UDP ports are open** on the firewall:
   ```bash
   sudo ufw allow 10000/udp   # Jitsi Videobridge (JVB) media port
   sudo ufw allow 4443/tcp    # JVB TCP fallback
   ```

2. **Configure STUN/TURN** in the Jitsi environment:
   ```env
   JVB_STUN_SERVERS=stun:stun.l.google.com:19302
   ENABLE_OCSPS=0
   ```

3. **For users behind symmetric NAT**, ensure a TURN server is configured (e.g., `coturn`):
   ```env
   TURN_HOST=turn.klassmarket.ru
   TURN_PORT=443
   TURN_TRANSPORT=tcp
   ```

4. **Self-hosted Jitsi requires significant resources** for video:
   - 1 vCPU + 2 GB RAM per 5 concurrent participants
   - Separate JVB instances for production at scale

---

## 6.4. JWT_SECRET Missing

**Symptom:** The API crashes on startup with an error about missing JWT configuration, or (worse) tokens are signed with a hardcoded fallback secret.

**Cause:** The `JWT_SECRET` environment variable is empty or not set.

**Solution:**

1. Generate a strong secret:
   ```bash
   openssl rand -base64 64
   ```

2. Add it to `.env`:
   ```env
   JWT_SECRET=your-generated-secret-here
   ```

3. **Important:** The application must crash on startup if `JWT_SECRET` is missing. A hardcoded fallback allows token forgery. If the current codebase has a fallback, remove it:
   ```typescript
   // BAD: fallback allows token forgery
   const secret = process.env.JWT_SECRET || 'default-secret';

   // GOOD: crash if missing
   const secret = process.env.JWT_SECRET;
   if (!secret) throw new Error('JWT_SECRET is required');
   ```

---

## 6.5. YooKassa Webhook HMAC Verification

**Symptom:** Payments are accepted in YooKassa but enrollment status never updates to "confirmed" in the application.

**Cause:** The webhook endpoint is not verifying the HMAC signature, or the signature check fails and silently drops the request.

**Solution:**

1. Ensure `YUKASSA_SECRET_KEY` is set in `.env`.

2. Verify the webhook signature in the controller:
   ```typescript
   const signature = req.headers['x-yukassa-signature'];
   const expectedSignature = crypto
     .createHmac('sha256', process.env.YUKASSA_SECRET_KEY)
     .update(JSON.stringify(req.body))
     .digest('hex');

   if (signature !== expectedSignature) {
     throw new UnauthorizedException('Invalid webhook signature');
   }
   ```

3. Configure the webhook URL in the YooKassa dashboard:
   ```
   https://klassmarket.ru/api/v1/payments/webhook
   ```

4. Ensure the endpoint is accessible from YooKassa's IP range (no firewall block, no authentication required on the webhook route).

---

## 6.6. Docker Port Conflicts

**Symptom:** `docker compose up` fails with "port is already allocated" error.

**Cause:** Another process or a previous Docker run is occupying the same port.

**Solution:**

1. **Find what is using the port:**
   ```bash
   sudo lsof -i :5432   # PostgreSQL
   sudo lsof -i :6379   # Redis
   sudo lsof -i :9200   # Elasticsearch
   sudo lsof -i :3000   # Next.js
   sudo lsof -i :3001   # NestJS
   ```

2. **Stop the conflicting process** or change the port mapping in `docker-compose.yml`:
   ```yaml
   services:
     postgres:
       ports:
         - "5433:5432"   # Map to a different host port
   ```

3. **Clean up orphaned containers:**
   ```bash
   docker compose down --remove-orphans
   docker system prune -f
   ```

---

## 6.7. `/run` Skips `/feature` Pipeline

**Symptom:** Running `/run mvp` only executes Phase 3 (implementation). Phase 1 (SPARC docs), Phase 2 (validation), and Phase 4 (code review) are skipped entirely.

**Cause:** Known issue where the LLM optimizes for speed in autonomous mode and ignores the 4-phase pipeline rules. This is a text-based governance issue -- the `/run` command spawns raw agents instead of routing through `/go` -> `/feature`.

**Impact:** Code is written without project documentation, requirements validation, or code review.

**Solution / Workarounds:**

1. **Use `/feature <name>` directly** for each feature instead of `/run mvp`.
2. **Use `/go <name>`** which automatically selects between `/plan` and `/feature`.
3. If `/run` was already used, run retroactive phases:
   - Phase 1: Generate SPARC docs for each feature
   - Phase 2: Run validation reports
   - Phase 4: Run `brutal-honesty-review` on implemented code
4. Check that `docs/features/<id>/review-report.md` exists for every feature before considering the pipeline complete.

**Reference:** `.claude/insights/index.md`, `.claude/rules/feature-lifecycle.md`

---

## 6.8. General Debugging Tips

### Check Container Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f elasticsearch

# Last 100 lines
docker compose logs --tail 100 api
```

### Check API Health

```bash
curl http://localhost:3001/api/v1/health
curl http://localhost:3001/api/v1/health/detailed  # requires admin token
```

### Check Database Connectivity

```bash
docker compose exec postgres psql -U klassmarket -c "SELECT 1;"
```

### Check Redis Connectivity

```bash
docker compose exec redis redis-cli ping
# Expected: PONG
```

### Check Elasticsearch Cluster Health

```bash
curl http://localhost:9200/_cluster/health?pretty
```

### Reset Everything (Development Only)

```bash
docker compose down -v          # Remove containers AND volumes (data loss!)
docker compose up -d            # Recreate everything
npx prisma migrate reset        # Reset database
npx prisma db seed              # Reseed data
```
