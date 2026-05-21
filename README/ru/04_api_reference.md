# 4. Справочник API

Базовый URL: `http://localhost:3001/api/v1`

Все эндпоинты возвращают JSON. Аутентификация через JWT Bearer-токен (если не указано иное). Денежные суммы -- в **копейках** (1 рубль = 100 копеек).

---

## 4.1. Аутентификация (Auth)

| Метод | Эндпоинт | Авторизация | Описание |
|-------|----------|-------------|----------|
| POST | `/auth/register` | Публичный | Регистрация пользователя |
| POST | `/auth/login` | Публичный | Вход по email + пароль |
| POST | `/auth/oauth/vk` | Публичный | Вход через VK ID |
| POST | `/auth/oauth/yandex` | Публичный | Вход через Yandex ID |
| POST | `/auth/refresh` | Публичный | Обновление access-токена |
| POST | `/auth/logout` | Bearer | Инвалидация refresh-токена |
| POST | `/auth/forgot-password` | Публичный | Отправка письма сброса пароля |
| POST | `/auth/reset-password` | Публичный | Сброс пароля по токену |
| POST | `/auth/verify-email` | Публичный | Подтверждение email |

### Пример: регистрация

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "parent@example.com", "password": "SecurePass123!",
  "firstName": "Елена", "lastName": "Иванова",
  "phone": "+79991234567", "role": "PARENT"
}
```

**Ответ (201):**
```json
{
  "user": { "id": "550e8400-...", "email": "parent@example.com", "role": "PARENT" },
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g..."
}
```

---

## 4.2. Классы (Classes)

| Метод | Эндпоинт | Авторизация | Описание |
|-------|----------|-------------|----------|
| GET | `/classes` | Публичный | Список/поиск классов |
| GET | `/classes/:id` | Публичный | Детали класса по ID |
| POST | `/classes` | Учитель | Создание класса |
| PATCH | `/classes/:id` | Учитель (владелец) | Обновление класса |
| DELETE | `/classes/:id` | Учитель / Админ | Удаление класса |
| POST | `/classes/:id/publish` | Учитель (владелец) | Отправка на модерацию |

### Параметры поиска `GET /classes`

| Параметр | Тип | Описание |
|----------|-----|----------|
| `q` | string | Полнотекстовый поиск (Elasticsearch) |
| `categoryId` | uuid | Фильтр по категории |
| `ageMin` / `ageMax` | int | Возрастной диапазон |
| `priceMin` / `priceMax` | int | Диапазон цены (копейки) |
| `format` | enum | `ONE_TIME`, `MULTI_SESSION`, `ONGOING` |
| `hasTrial` | bool | Только с пробным занятием |
| `sort` | string | `relevance`, `price_asc`, `price_desc`, `rating`, `newest` |
| `page` / `limit` | int | Пагинация (по умолчанию: 1 / 20, макс. 50) |

### Пример ответа

```json
{
  "items": [{
    "id": "...", "title": "Python для детей", "slug": "python-for-kids",
    "teacher": { "name": "Ольга Петрова", "rating": 4.8 },
    "ageMin": 8, "ageMax": 12, "format": "MULTI_SESSION",
    "priceKopecks": 150000, "rating": 4.9, "reviewCount": 42
  }],
  "total": 87, "page": 1, "limit": 10
}
```

---

## 4.3. Секции (Sections)

| Метод | Эндпоинт | Авторизация | Описание |
|-------|----------|-------------|----------|
| GET | `/classes/:classId/sections` | Публичный | Список секций класса |
| POST | `/classes/:classId/sections` | Учитель (владелец) | Создание секции |
| PATCH | `/sections/:id` | Учитель (владелец) | Обновление секции |
| DELETE | `/sections/:id` | Учитель / Админ | Удаление секции |

Тело запроса на создание: `title`, `startTime`, `endTime`, `timezone`, `maxStudents`, `isTrial`.

---

## 4.4. Записи на занятия (Enrollments)

| Метод | Эндпоинт | Авторизация | Описание |
|-------|----------|-------------|----------|
| GET | `/enrollments` | Bearer | Список записей пользователя |
| POST | `/enrollments` | Родитель | Записать ребёнка на секцию |
| PATCH | `/enrollments/:id/cancel` | Родитель / Админ | Отменить запись |

### Пример: запись ребёнка

```http
POST /api/v1/enrollments
Authorization: Bearer eyJhbGci...

{ "childId": "child-uuid", "sectionId": "section-uuid" }
```

**Ответ (201):** `{ "id": "...", "status": "PENDING", "createdAt": "2026-05-21T10:30:00Z" }`

---

## 4.5. Платежи (Payments)

| Метод | Эндпоинт | Авторизация | Описание |
|-------|----------|-------------|----------|
| GET | `/payments` | Bearer | Список платежей |
| POST | `/payments` | Родитель | Инициировать оплату через ЮKassa |
| POST | `/payments/webhook` | IP ЮKassa | Вебхук от ЮKassa |

### Пример: инициирование платежа

```http
POST /api/v1/payments
Authorization: Bearer eyJhbGci...

{ "enrollmentId": "enrollment-uuid", "returnUrl": "https://klassmarket.ru/payment/success" }
```

**Ответ (201):**
```json
{
  "id": "payment-uuid", "amountKopecks": 150000,
  "commissionKopecks": 33000, "teacherAmountKopecks": 117000,
  "status": "PENDING",
  "confirmationUrl": "https://yoomoney.ru/checkout/payments/v2/contract?orderId=..."
}
```

Эндпоинт вебхука верифицирует HMAC-подпись через `YUKASSA_SECRET_KEY`.

---

## 4.6. Отзывы (Reviews)

| Метод | Эндпоинт | Авторизация | Описание |
|-------|----------|-------------|----------|
| GET | `/classes/:classId/reviews` | Публичный | Отзывы о классе |
| POST | `/classes/:classId/reviews` | Родитель | Оставить отзыв |
| PATCH | `/reviews/:id` | Родитель (автор) / Админ | Обновить отзыв |
| DELETE | `/reviews/:id` | Админ | Удалить отзыв |

---

## 4.7. Видео (Video)

| Метод | Эндпоинт | Авторизация | Описание |
|-------|----------|-------------|----------|
| GET | `/video/rooms/:sectionId` | Bearer | Информация о видеокомнате |
| POST | `/video/rooms/:sectionId/join` | Bearer (записан) | Получить токен подключения |
| POST | `/video/rooms/:sectionId/end` | Учитель (владелец) | Завершить видеосессию |

Доступ ограничен пользователями с активной записью на секцию.

---

## 4.8. Пользователи (Users)

| Метод | Эндпоинт | Авторизация | Описание |
|-------|----------|-------------|----------|
| GET | `/users/me` | Bearer | Профиль текущего пользователя |
| PATCH | `/users/me` | Bearer | Обновить профиль |
| GET | `/users/me/children` | Родитель | Список детей |
| POST | `/users/me/children` | Родитель | Добавить ребёнка |
| GET | `/users/me/data-export` | Bearer | Экспорт данных (152-ФЗ) |
| DELETE | `/users/me` | Bearer | Удаление аккаунта (soft delete) |

---

## 4.9. Администрирование (Admin)

| Метод | Эндпоинт | Авторизация | Описание |
|-------|----------|-------------|----------|
| GET | `/admin/classes/pending` | Админ | Классы на модерации |
| PATCH | `/admin/classes/:id/approve` | Админ | Одобрить класс |
| PATCH | `/admin/classes/:id/reject` | Админ | Отклонить класс |
| GET | `/admin/teachers/pending` | Админ | Учителя на верификации |
| PATCH | `/admin/teachers/:id/verify` | Админ | Верифицировать учителя |
| GET | `/admin/reviews/pending` | Админ | Отзывы на модерации |
| GET | `/admin/analytics/overview` | Админ | Аналитика |

---

## 4.10. Здоровье системы (Health)

| Метод | Эндпоинт | Авторизация | Описание |
|-------|----------|-------------|----------|
| GET | `/health` | Публичный | Базовая проверка |
| GET | `/health/detailed` | Админ | Детальный статус зависимостей |

**Ответ `/health/detailed` (200):**
```json
{
  "status": "ok", "version": "1.0.0",
  "dependencies": {
    "postgresql": { "status": "up", "latencyMs": 2 },
    "redis": { "status": "up", "latencyMs": 1 },
    "elasticsearch": { "status": "up", "latencyMs": 15 },
    "minio": { "status": "up", "latencyMs": 5 }
  }
}
```

---

## Формат ошибок

```json
{
  "statusCode": 400,
  "message": "Ошибка валидации",
  "errors": [{ "field": "email", "message": "Неверный формат email" }],
  "timestamp": "2026-05-21T12:00:00Z"
}
```

| Код | Значение |
|-----|----------|
| 400 | Ошибка валидации |
| 401 | Требуется аутентификация |
| 403 | Недостаточно прав |
| 404 | Ресурс не найден |
| 409 | Конфликт (например, повторная запись) |
| 429 | Превышен лимит запросов |
| 500 | Внутренняя ошибка сервера |
