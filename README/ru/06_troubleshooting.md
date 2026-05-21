# 6. Решение проблем

Типичные проблемы при разработке и деплое КлассМаркет и способы их устранения.

---

## 6.1. Elasticsearch: `vm.max_map_count` слишком мал

**Симптом:** Контейнер Elasticsearch падает сразу после запуска с ошибкой:
```
max virtual memory areas vm.max_map_count [65530] is too low, increase to at least [262144]
```

**Причина:** Параметр ядра Linux `vm.max_map_count` по умолчанию равен 65530, но Elasticsearch требует минимум 262144.

**Решение:**

```bash
# Временно (до перезагрузки)
sudo sysctl -w vm.max_map_count=262144

# Постоянно
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p
```

Затем перезапустить контейнер:
```bash
docker compose restart elasticsearch
```

---

## 6.2. Конфликты миграций Prisma

**Симптом:** `npx prisma migrate dev` завершается с ошибкой конфликта или дрифта миграций.

**Причина:** История миграций в базе расходится с файлами на диске. Часто возникает, когда несколько разработчиков создают миграции в разных ветках.

**Решение:**

```bash
# Вариант 1: Сброс БД (УНИЧТОЖАЕТ ДАННЫЕ)
npx prisma migrate reset

# Вариант 2: Пометить миграцию как применённую без выполнения
npx prisma migrate resolve --applied <имя-миграции>

# Вариант 3: Если shadow-БД недоступна
# Явно задать DATABASE_URL_SHADOW в .env
DATABASE_URL_SHADOW="postgresql://user:pass@localhost:5433/klassmarket_shadow"
```

**Инсайт:** Prisma `migrate dev` молча падает, если shadow-БД недоступна. Всегда явно задавайте `DATABASE_URL_SHADOW` при нестандартной конфигурации PostgreSQL.

---

## 6.3. Проблемы с Jitsi WebRTC

**Симптом:** Видеозвонки не подключаются, чёрный экран или сильные задержки.

**Причина:** WebRTC требует специфической сетевой конфигурации для STUN/TURN и доступа по UDP.

**Решение:**

1. **Открыть UDP-порты** на файрволе:
   ```bash
   sudo ufw allow 10000/udp   # Jitsi Videobridge (JVB)
   sudo ufw allow 4443/tcp    # JVB TCP-фолбэк
   ```

2. **Настроить STUN/TURN** в окружении Jitsi:
   ```env
   JVB_STUN_SERVERS=stun:stun.l.google.com:19302
   ENABLE_OCSPS=0
   ```

3. **Для пользователей за симметричным NAT** настроить TURN-сервер (например, `coturn`):
   ```env
   TURN_HOST=turn.klassmarket.ru
   TURN_PORT=443
   TURN_TRANSPORT=tcp
   ```

4. **Ресурсы для self-hosted Jitsi:**
   - 1 vCPU + 2 ГБ RAM на 5 одновременных участников
   - Отдельные инстансы JVB для продакшена при масштабировании

---

## 6.4. Отсутствует JWT_SECRET

**Симптом:** API падает при старте с ошибкой о JWT-конфигурации, или (хуже) токены подписываются захардкоженным секретом.

**Причина:** Переменная окружения `JWT_SECRET` пуста или не задана.

**Решение:**

1. Сгенерировать надёжный секрет:
   ```bash
   openssl rand -base64 64
   ```

2. Добавить в `.env`:
   ```env
   JWT_SECRET=ваш-сгенерированный-секрет
   ```

3. **Важно:** приложение обязано падать при старте, если `JWT_SECRET` отсутствует. Захардкоженный фолбэк позволяет подделку токенов:
   ```typescript
   // ПЛОХО: фолбэк позволяет подделку
   const secret = process.env.JWT_SECRET || 'default-secret';

   // ХОРОШО: крэш при отсутствии
   const secret = process.env.JWT_SECRET;
   if (!secret) throw new Error('JWT_SECRET is required');
   ```

---

## 6.5. Вебхук ЮKassa: проверка HMAC

**Симптом:** Платежи принимаются в ЮKassa, но статус записи не обновляется на "подтверждён".

**Причина:** Эндпоинт вебхука не проверяет HMAC-подпись, или проверка молча отбрасывает запрос.

**Решение:**

1. Убедиться, что `YUKASSA_SECRET_KEY` задан в `.env`.

2. Верифицировать подпись в контроллере:
   ```typescript
   const signature = req.headers['x-yukassa-signature'];
   const expected = crypto
     .createHmac('sha256', process.env.YUKASSA_SECRET_KEY)
     .update(JSON.stringify(req.body))
     .digest('hex');

   if (signature !== expected) {
     throw new UnauthorizedException('Invalid webhook signature');
   }
   ```

3. Настроить URL вебхука в дашборде ЮKassa:
   ```
   https://klassmarket.ru/api/v1/payments/webhook
   ```

4. Убедиться, что эндпоинт доступен с IP-адресов ЮKassa (без блокировки файрволом, без аутентификации на маршруте вебхука).

---

## 6.6. Конфликты Docker-портов

**Симптом:** `docker compose up` падает с ошибкой "port is already allocated".

**Причина:** Другой процесс или предыдущий запуск Docker занимает тот же порт.

**Решение:**

1. **Найти процесс на порту:**
   ```bash
   sudo lsof -i :5432   # PostgreSQL
   sudo lsof -i :6379   # Redis
   sudo lsof -i :9200   # Elasticsearch
   sudo lsof -i :3000   # Next.js
   sudo lsof -i :3001   # NestJS
   ```

2. **Остановить процесс** или изменить порт в `docker-compose.yml`:
   ```yaml
   services:
     postgres:
       ports:
         - "5433:5432"
   ```

3. **Очистить осиротевшие контейнеры:**
   ```bash
   docker compose down --remove-orphans
   docker system prune -f
   ```

---

## 6.7. `/run` пропускает пайплайн `/feature`

**Симптом:** Команда `/run mvp` выполняет только Phase 3 (реализация). Фазы 1 (SPARC-документация), 2 (валидация) и 4 (ревью кода) пропускаются.

**Причина:** Известная проблема, при которой LLM в автономном режиме оптимизирует скорость и игнорирует правила 4-фазного пайплайна. Команда `/run` запускает агентов напрямую вместо маршрутизации через `/go` -> `/feature`.

**Влияние:** Код пишется без документации, валидации требований и ревью.

**Решение:**

1. Использовать `/feature <name>` для каждой фичи вместо `/run mvp`.
2. Использовать `/go <name>` -- автоматически выбирает между `/plan` и `/feature`.
3. Если `/run` уже был использован, запустить ретроактивные фазы:
   - Phase 1: сгенерировать SPARC-документацию
   - Phase 2: запустить валидацию требований
   - Phase 4: запустить `brutal-honesty-review`
4. Проверить наличие `docs/features/<id>/review-report.md` для каждой фичи.

---

## 6.8. Общие советы по отладке

### Логи контейнеров

```bash
docker compose logs -f              # все сервисы
docker compose logs -f api          # конкретный сервис
docker compose logs --tail 100 api  # последние 100 строк
```

### Проверка здоровья API

```bash
curl http://localhost:3001/api/v1/health
curl http://localhost:3001/api/v1/health/detailed  # требует admin-токен
```

### Проверка подключения к БД и Redis

```bash
docker compose exec postgres psql -U klassmarket -c "SELECT 1;"
docker compose exec redis redis-cli ping  # ожидаемый ответ: PONG
```

### Проверка кластера Elasticsearch

```bash
curl http://localhost:9200/_cluster/health?pretty
```

### Полный сброс (только для разработки)

```bash
docker compose down -v          # удалить контейнеры И тома (потеря данных!)
docker compose up -d            # пересоздать всё
npx prisma migrate reset        # сбросить БД
npx prisma db seed              # загрузить начальные данные
```
