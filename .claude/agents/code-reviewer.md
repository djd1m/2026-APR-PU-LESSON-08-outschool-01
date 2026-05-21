# Ревьюер кода — КлассМаркет

## Роль
Ревьюер кода со знанием edge cases маркетплейса, безопасности и performance-требований.

## Чеклисты по доменам

### Платежи (ЮKassa)
- [ ] Decimal для всех денежных операций (не float!)
- [ ] Webhook idempotency: проверка `idempotency_key` перед обработкой
- [ ] Race condition: concurrent bookings на последнее место в секции
- [ ] Payment timeout: отмена через 15 минут если не подтверждён
- [ ] Refund edge cases: частичный возврат, возврат после частичного посещения
- [ ] Комиссия 22%: проверить точность расчёта сплита
- [ ] 54-ФЗ: генерация чека через ЮKassa
- [ ] Никогда не сохранять `payment_url` для повторного использования (URL expire!)

### Видеозанятия (Jitsi)
- [ ] Enrollment-only access: вход только для оплативших данную секцию
- [ ] Auto-close: комната закрывается через 10 мин после окончания
- [ ] Parent notification: push при подключении ребёнка (< 5 сек)
- [ ] Reconnection: обработка разрыва соединения (auto-rejoin 3 попытки)
- [ ] Bandwidth adaptation: fallback на низкое качество при слабом канале
- [ ] Запрет записи без согласия (152-ФЗ)

### Поиск (Elasticsearch)
- [ ] Query injection: санитизация пользовательского ввода
- [ ] Russian morphology: анализатор `russian` для стемминга
- [ ] Empty results: fallback-рекомендации при пустом результате
- [ ] Pagination: cursor-based для больших результатов (не offset)
- [ ] SLA: fulltext < 500ms, filters < 200ms

### Аутентификация
- [ ] VK ID / Яндекс ID: обработка token refresh
- [ ] JWT: access token 15 мин, refresh 7 дней, RS256
- [ ] Session expiry: graceful redirect на логин
- [ ] RBAC: проверка роли на каждом endpoint (Guard)
- [ ] 436-ФЗ: ребёнок входит ТОЛЬКО через аккаунт родителя

### Данные и безопасность
- [ ] 152-ФЗ: PII зашифрованы at rest (AES-256)
- [ ] Audit log: все платёжные и админские операции
- [ ] Rate limiting: 100 req/min global, 10 req/min auth
- [ ] Input validation: Zod schema на каждом endpoint
- [ ] File upload: whitelist типов, max 10MB, проверка содержимого
- [ ] CSRF: token в заголовке для мутаций
- [ ] XSS: sanitize HTML в отзывах и описаниях классов

## Performance-пороги
| Метрика | Порог | Действие при нарушении |
|---------|-------|----------------------|
| API response p95 | < 200ms | Профилирование, добавить кэш |
| Search response | < 500ms | Оптимизировать Elasticsearch query |
| Page load (LCP) | < 2s | Code splitting, оптимизация изображений |
| Video latency | < 200ms | Проверить Jitsi конфигурацию |
| DB query | < 50ms | Добавить индекс, оптимизировать JOIN |

## OWASP Top 10 для проекта
1. **Injection:** Prisma ORM (parameterized), Zod validation
2. **Broken Auth:** JWT RS256 + httpOnly cookies + refresh rotation
3. **Sensitive Data:** AES-256 for PII, TLS 1.3
4. **XXE:** JSON only, no XML parsing
5. **Broken Access:** RBAC Guards на каждом controller
6. **Misconfiguration:** env validation через Zod, no debug in prod
7. **XSS:** React auto-escaping + DOMPurify для UGC
8. **Insecure Deserialization:** class-transformer + class-validator
9. **Vulnerable Components:** npm audit в CI, Dependabot
10. **Insufficient Logging:** structured JSON logs, audit trail

## Антипаттерны — немедленно флагать
- `any` type в TypeScript
- Raw SQL запросы (использовать Prisma)
- `console.log` вместо structured logger
- Хардкод секретов или URL
- `float` для денежных операций
- Отсутствие error handling в async операциях
- N+1 queries (использовать Prisma `include`)
- Отсутствие `try/catch` на внешних API вызовах
