# Завершение: Аутентификация и регистрация

## План тестирования

### Unit-тесты (AuthService)

| Тест | Описание | Ожидание |
|------|----------|----------|
| register_success | Регистрация с валидными данными | User создан, токены возвращены |
| register_duplicate_email | Регистрация с существующим email | ConflictException 409 |
| login_success | Вход с корректными данными | Токены возвращены, failedAttempts сброшен |
| login_wrong_password | Неверный пароль | UnauthorizedException, failedAttempts++ |
| login_brute_force | 5+ неудачных попыток за 15 мин | TooManyRequestsException 429 |
| refresh_valid | Валидный refresh-токен | Новая пара токенов, старый revoked |
| refresh_expired | Просроченный refresh-токен | UnauthorizedException 401 |
| refresh_revoked | Отозванный refresh-токен | UnauthorizedException 401 |
| oauth_create | Новый OAuth-пользователь | User создан с provider/providerId |
| oauth_existing | Повторный OAuth-вход | Существующий user найден |
| oauth_merge | OAuth email совпадает с LOCAL | Аккаунты объединены |

### Интеграционные тесты (endpoints)

| Тест | Метод | Path | Ожидание |
|------|-------|------|----------|
| POST register | POST | /auth/register | 201, body содержит accessToken |
| POST register conflict | POST | /auth/register | 409 при дубликате |
| POST login | POST | /auth/login | 200, cookie установлен |
| POST refresh | POST | /auth/refresh | 200, новый accessToken |
| GET me authenticated | GET | /auth/me | 200, профиль пользователя |
| GET me unauthenticated | GET | /auth/me | 401 |

### E2E-тесты (полный поток)

1. **Регистрация -> вход -> получение профиля**: POST register -> POST login -> GET me
2. **OAuth-поток**: GET /auth/vk -> mock callback -> проверка созданного user
3. **Refresh-ротация**: login -> wait -> refresh -> verify new token works
4. **Brute force**: 6 неудачных попыток -> проверка блокировки -> wait 15m -> разблокировка

## Деплой

### Переменные окружения

```
JWT_PRIVATE_KEY_PATH=/app/keys/jwt-private.pem
JWT_PUBLIC_KEY_PATH=/app/keys/jwt-public.pem
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d
VK_CLIENT_ID=...
VK_CLIENT_SECRET=...
YANDEX_CLIENT_ID=...
YANDEX_CLIENT_SECRET=...
BCRYPT_ROUNDS=12
```

### Миграции

- `create_users_table`: создание таблицы users с полями auth
- `create_refresh_tokens_table`: таблица refresh-токенов с индексом по tokenHash
- `add_user_auth_fields`: failedAttempts, lastFailedAt

### Docker

- RS256 ключи монтируются как Docker secrets (не копируются в image)
- Health check: GET /auth/health проверяет доступность БД и наличие ключей

## Мониторинг

| Метрика | Тип | Алерт |
|---------|-----|-------|
| auth.register.count | counter | - |
| auth.login.success | counter | - |
| auth.login.failure | counter | > 50/мин → alert |
| auth.refresh.count | counter | - |
| auth.brute_force.blocked | counter | > 10/мин → alert |
| auth.oauth.failure | counter | > 5/мин → alert |
| auth.token.generation_ms | histogram | p95 > 200ms → warn |

## Чеклист готовности

- [x] Unit-тесты AuthService (11 кейсов)
- [x] Интеграционные тесты endpoints (6 кейсов)
- [x] E2E-тесты полных потоков (4 сценария)
- [x] RS256 ключи сгенерированы и защищены
- [x] Rate limiting настроен
- [x] Cookie-флаги: httpOnly, secure, SameSite
- [x] Логирование без чувствительных данных
- [x] Миграции применены
