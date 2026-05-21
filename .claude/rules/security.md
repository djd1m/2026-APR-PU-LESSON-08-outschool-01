# Security Rules — КлассМаркет

## Законодательство РФ

### 152-ФЗ (Персональные данные)
- Серверы ТОЛЬКО в РФ (AdminVPS / HOSTKEY)
- PII (ФИО, email, телефон) зашифрованы at rest (AES-256-GCM)
- Согласие на обработку ПД при регистрации (checkbox + текст)
- Право на удаление данных (GDPR-like): API endpoint для полного удаления
- Логирование доступа к PII (audit trail)

### 436-ФЗ (Защита детей)
- Ребёнок входит ТОЛЬКО через аккаунт родителя (нет самостоятельной регистрации)
- Возрастная маркировка контента классов
- Модерация всех описаний классов перед публикацией
- Запрет прямых сообщений между учителем и ребёнком вне класса
- Родительский контроль: лимит экранного времени

### 54-ФЗ (Онлайн-кассы)
- Фискализация через ЮKassa (автоматическая генерация чеков)
- Чек при оплате и при возврате

## Аутентификация
```
Flow: VK ID / Яндекс ID / Email+Password
  → OAuth2 callback / login endpoint
  → Generate JWT pair:
    - Access Token: RS256, 15 min TTL, httpOnly cookie
    - Refresh Token: 7 days TTL, httpOnly cookie, rotate on use
  → RBAC role in JWT payload: parent | teacher | child | admin
```

## RBAC Matrix
| Ресурс | parent | teacher | child | admin |
|--------|:------:|:-------:|:-----:|:-----:|
| Просмотр каталога | ✅ | ✅ | ✅ | ✅ |
| Бронирование | ✅ | ❌ | ❌ | ✅ |
| Создание класса | ❌ | ✅ | ❌ | ✅ |
| Оставить отзыв | ✅ | ❌ | ❌ | ✅ |
| Модерация | ❌ | ❌ | ❌ | ✅ |
| Вход в видеокомнату | ✅ | ✅ | ✅* | ✅ |
| Вывод средств | ❌ | ✅ | ❌ | ❌ |

*child — только при активном enrollment и через аккаунт родителя

## Input Validation
- Zod schema на КАЖДОМ endpoint (controller level)
- Sanitize HTML в UGC: DOMPurify (описания классов, отзывы)
- File upload: whitelist (`image/jpeg`, `image/png`, `image/webp`, `application/pdf`), max 10MB
- Query params: whitelist разрешённых полей для фильтрации

## Rate Limiting
| Endpoint | Лимит | Window |
|----------|-------|--------|
| Global | 100 req | 1 min |
| POST /auth/* | 10 req | 1 min |
| POST /payments/* | 5 req | 1 min |
| POST /reviews | 3 req | 1 min |
| Search | 30 req | 1 min |

## Защита от атак
- **CSRF:** Double Submit Cookie pattern для мутаций
- **XSS:** React auto-escaping + Content-Security-Policy header
- **SQL Injection:** Prisma ORM (parameterized queries only)
- **Clickjacking:** X-Frame-Options: DENY
- **CORS:** whitelist только наших доменов
- **HTTPS:** TLS 1.3 обязательно, HSTS header

## Audit Logging
Логировать ВСЕ операции с:
- Платежами (создание, подтверждение, возврат)
- Админскими действиями (модерация, бан, изменение ролей)
- Доступом к PII (просмотр персональных данных)
- Попытками неавторизованного доступа

Формат: structured JSON → Loki / ELK
