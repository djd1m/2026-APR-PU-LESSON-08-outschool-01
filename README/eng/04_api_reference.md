# 4. API Reference

Base URL: `http://localhost:3001/api/v1`

All endpoints return JSON. Authentication is via JWT Bearer token (unless marked as public). Monetary amounts are in **kopecks** (1 ruble = 100 kopecks).

---

## 4.1. Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | Public | Register a new user |
| POST | `/auth/login` | Public | Login with email + password |
| POST | `/auth/oauth/vk` | Public | Login/register via VK ID |
| POST | `/auth/oauth/yandex` | Public | Login/register via Yandex ID |
| POST | `/auth/refresh` | Public | Refresh access token |
| POST | `/auth/logout` | Bearer | Invalidate refresh token |
| POST | `/auth/forgot-password` | Public | Send password reset email |
| POST | `/auth/reset-password` | Public | Reset password with token |
| POST | `/auth/verify-email` | Public | Verify email address |

### Example: Register

```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "parent@example.com",
  "password": "SecurePass123!",
  "firstName": "Elena",
  "lastName": "Ivanova",
  "phone": "+79991234567",
  "role": "PARENT"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "parent@example.com",
    "firstName": "Elena",
    "lastName": "Ivanova",
    "role": "PARENT",
    "createdAt": "2026-05-21T10:00:00Z"
  },
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g..."
}
```

### Example: Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "parent@example.com",
  "password": "SecurePass123!"
}
```

**Response (200):**
```json
{
  "user": { "id": "...", "email": "...", "role": "PARENT" },
  "accessToken": "eyJhbGciOiJSUzI1NiIs...",
  "refreshToken": "dGhpcyBpcyBhIHJlZnJlc2g..."
}
```

---

## 4.2. Classes

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/classes` | Public | List/search classes (with filters) |
| GET | `/classes/:id` | Public | Get class details |
| GET | `/classes/:slug` | Public | Get class by slug |
| POST | `/classes` | Teacher | Create a new class |
| PATCH | `/classes/:id` | Teacher (owner) | Update a class |
| DELETE | `/classes/:id` | Teacher (owner) / Admin | Delete a class |
| POST | `/classes/:id/publish` | Teacher (owner) | Submit for moderation |

### Query Parameters for `GET /classes`

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Full-text search query (Elasticsearch) |
| `categoryId` | uuid | Filter by category |
| `ageMin` | int | Minimum age |
| `ageMax` | int | Maximum age |
| `priceMin` | int | Min price in kopecks |
| `priceMax` | int | Max price in kopecks |
| `format` | enum | `ONE_TIME`, `MULTI_SESSION`, `ONGOING` |
| `hasTrial` | bool | Only classes with a trial session |
| `rating` | float | Minimum teacher rating |
| `dayOfWeek` | int[] | Days of week (1=Mon, 7=Sun) |
| `sort` | string | `relevance`, `price_asc`, `price_desc`, `rating`, `newest` |
| `page` | int | Page number (default: 1) |
| `limit` | int | Items per page (default: 20, max: 50) |

### Example: Search Classes

```http
GET /api/v1/classes?q=programming&ageMin=8&ageMax=12&sort=rating&limit=10
```

**Response (200):**
```json
{
  "items": [
    {
      "id": "...",
      "title": "Python for Kids",
      "slug": "python-for-kids",
      "description": "Learn Python through game development...",
      "categoryName": "Programming",
      "teacher": { "id": "...", "name": "Olga Petrova", "rating": 4.8 },
      "ageMin": 8,
      "ageMax": 12,
      "format": "MULTI_SESSION",
      "durationMinutes": 60,
      "maxStudents": 8,
      "priceKopecks": 150000,
      "hasTrialClass": true,
      "rating": 4.9,
      "reviewCount": 42,
      "nextSectionStart": "2026-05-25T14:00:00Z"
    }
  ],
  "total": 87,
  "page": 1,
  "limit": 10
}
```

---

## 4.3. Sections

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/classes/:classId/sections` | Public | List sections for a class |
| GET | `/sections/:id` | Public | Get section details |
| POST | `/classes/:classId/sections` | Teacher (owner) | Create a section |
| PATCH | `/sections/:id` | Teacher (owner) | Update a section |
| DELETE | `/sections/:id` | Teacher (owner) / Admin | Delete a section |

### Example: Create a Section

```http
POST /api/v1/classes/550e8400.../sections
Authorization: Bearer eyJhbGci...
Content-Type: application/json

{
  "title": "Session 1: Introduction to Python",
  "startTime": "2026-05-25T14:00:00+03:00",
  "endTime": "2026-05-25T15:00:00+03:00",
  "timezone": "Europe/Moscow",
  "maxStudents": 8,
  "isTrial": false
}
```

**Response (201):**
```json
{
  "id": "...",
  "classId": "550e8400...",
  "title": "Session 1: Introduction to Python",
  "startTime": "2026-05-25T14:00:00+03:00",
  "endTime": "2026-05-25T15:00:00+03:00",
  "maxStudents": 8,
  "currentStudents": 0,
  "status": "SCHEDULED",
  "isTrial": false
}
```

---

## 4.4. Enrollments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/enrollments` | Bearer | List user's enrollments |
| GET | `/enrollments/:id` | Bearer | Get enrollment details |
| POST | `/enrollments` | Parent | Enroll a child in a section |
| PATCH | `/enrollments/:id/cancel` | Parent / Admin | Cancel enrollment |

### Example: Enroll a Child

```http
POST /api/v1/enrollments
Authorization: Bearer eyJhbGci...
Content-Type: application/json

{
  "childId": "child-uuid-here",
  "sectionId": "section-uuid-here"
}
```

**Response (201):**
```json
{
  "id": "enrollment-uuid",
  "childId": "child-uuid-here",
  "sectionId": "section-uuid-here",
  "parentId": "parent-uuid",
  "status": "PENDING",
  "createdAt": "2026-05-21T10:30:00Z"
}
```

---

## 4.5. Payments

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/payments` | Bearer | List user's payments |
| GET | `/payments/:id` | Bearer | Get payment details |
| POST | `/payments` | Parent | Initiate payment via YooKassa |
| POST | `/payments/webhook` | YooKassa IP | YooKassa webhook callback |

### Example: Initiate Payment

```http
POST /api/v1/payments
Authorization: Bearer eyJhbGci...
Content-Type: application/json

{
  "enrollmentId": "enrollment-uuid",
  "returnUrl": "https://klassmarket.ru/payment/success"
}
```

**Response (201):**
```json
{
  "id": "payment-uuid",
  "externalId": "yukassa-payment-id",
  "amountKopecks": 150000,
  "commissionKopecks": 33000,
  "teacherAmountKopecks": 117000,
  "status": "PENDING",
  "confirmationUrl": "https://yoomoney.ru/checkout/payments/v2/contract?orderId=...",
  "createdAt": "2026-05-21T10:35:00Z"
}
```

### Webhook Payload (from YooKassa)

```json
{
  "type": "notification",
  "event": "payment.succeeded",
  "object": {
    "id": "yukassa-payment-id",
    "status": "succeeded",
    "amount": { "value": "1500.00", "currency": "RUB" },
    "metadata": { "enrollmentId": "enrollment-uuid" }
  }
}
```

The webhook endpoint verifies the HMAC signature using `YUKASSA_SECRET_KEY` before processing.

---

## 4.6. Reviews

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/classes/:classId/reviews` | Public | List reviews for a class |
| GET | `/reviews/:id` | Public | Get review details |
| POST | `/classes/:classId/reviews` | Parent | Create a review |
| PATCH | `/reviews/:id` | Parent (author) / Admin | Update a review |
| DELETE | `/reviews/:id` | Admin | Delete a review |

### Example: Create a Review

```http
POST /api/v1/classes/class-uuid/reviews
Authorization: Bearer eyJhbGci...
Content-Type: application/json

{
  "childId": "child-uuid",
  "enrollmentId": "enrollment-uuid",
  "rating": 5,
  "text": "Excellent class! My son learned a lot about Python basics."
}
```

**Response (201):**
```json
{
  "id": "review-uuid",
  "classId": "class-uuid",
  "parentId": "parent-uuid",
  "rating": 5,
  "text": "Excellent class! My son learned a lot about Python basics.",
  "status": "PENDING_MODERATION",
  "createdAt": "2026-05-21T11:00:00Z"
}
```

---

## 4.7. Video

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/video/rooms/:sectionId` | Bearer | Get video room info |
| POST | `/video/rooms/:sectionId/join` | Bearer (enrolled) | Get join token for video room |
| POST | `/video/rooms/:sectionId/end` | Teacher (owner) | End the video session |

### Example: Join a Video Room

```http
POST /api/v1/video/rooms/section-uuid/join
Authorization: Bearer eyJhbGci...
```

**Response (200):**
```json
{
  "roomId": "jitsi-room-id",
  "token": "jitsi-jwt-token",
  "serverUrl": "https://meet.klassmarket.ru",
  "displayName": "Ivan I."
}
```

Access is restricted to users with an active enrollment for the section.

---

## 4.8. Users

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | Bearer | Get current user profile |
| PATCH | `/users/me` | Bearer | Update profile |
| GET | `/users/me/children` | Parent | List children |
| POST | `/users/me/children` | Parent | Add a child |
| PATCH | `/users/me/children/:id` | Parent | Update child profile |
| GET | `/users/me/data-export` | Bearer | Export personal data (152-FZ) |
| DELETE | `/users/me` | Bearer | Delete account (soft delete) |

### Example: Get Profile

```http
GET /api/v1/users/me
Authorization: Bearer eyJhbGci...
```

**Response (200):**
```json
{
  "id": "user-uuid",
  "email": "parent@example.com",
  "firstName": "Elena",
  "lastName": "Ivanova",
  "phone": "+79991234567",
  "role": "PARENT",
  "avatarUrl": null,
  "isEmailVerified": true,
  "children": [
    {
      "id": "child-uuid",
      "firstName": "Ivan",
      "birthDate": "2016-03-15",
      "interests": ["programming", "robotics"],
      "xp": 450,
      "level": 3,
      "streakDays": 5
    }
  ],
  "createdAt": "2026-05-21T10:00:00Z"
}
```

---

## 4.9. Admin

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/admin/classes/pending` | Admin | List classes pending moderation |
| PATCH | `/admin/classes/:id/approve` | Admin | Approve a class |
| PATCH | `/admin/classes/:id/reject` | Admin | Reject a class (with reason) |
| GET | `/admin/teachers/pending` | Admin | List teachers pending verification |
| PATCH | `/admin/teachers/:id/verify` | Admin | Verify a teacher |
| PATCH | `/admin/teachers/:id/reject` | Admin | Reject a teacher (with reason) |
| GET | `/admin/reviews/pending` | Admin | List reviews pending moderation |
| PATCH | `/admin/reviews/:id/approve` | Admin | Approve a review |
| PATCH | `/admin/reviews/:id/reject` | Admin | Reject a review |
| GET | `/admin/users` | Admin | List all users (with filters) |
| GET | `/admin/analytics/overview` | Admin | Get analytics overview |

### Example: Approve a Class

```http
PATCH /api/v1/admin/classes/class-uuid/approve
Authorization: Bearer eyJhbGci... (admin token)
```

**Response (200):**
```json
{
  "id": "class-uuid",
  "status": "PUBLISHED",
  "publishedAt": "2026-05-21T12:00:00Z"
}
```

---

## 4.10. Health

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | Public | Basic health check |
| GET | `/health/detailed` | Admin | Detailed health with dependency status |

### Example: Health Check

```http
GET /api/v1/health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-05-21T12:00:00Z",
  "version": "1.0.0"
}
```

### Example: Detailed Health

```http
GET /api/v1/health/detailed
Authorization: Bearer eyJhbGci... (admin token)
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-05-21T12:00:00Z",
  "version": "1.0.0",
  "dependencies": {
    "postgresql": { "status": "up", "latencyMs": 2 },
    "redis": { "status": "up", "latencyMs": 1 },
    "elasticsearch": { "status": "up", "latencyMs": 15 },
    "minio": { "status": "up", "latencyMs": 5 }
  }
}
```

---

## Error Format

All errors follow a consistent format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Invalid email format" }
  ],
  "timestamp": "2026-05-21T12:00:00Z"
}
```

| Status Code | Meaning |
|-------------|---------|
| 400 | Validation error |
| 401 | Authentication required |
| 403 | Insufficient permissions |
| 404 | Resource not found |
| 409 | Conflict (e.g., duplicate enrollment) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
